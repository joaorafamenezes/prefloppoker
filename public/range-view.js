const rankOrder = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const modeLabels = {
  OPEN: "Open Raise",
  VS_RAISE: "Vs Raise",
  VS_3BET: "Vs 3-Bet"
};
const tableSizeLabels = {
  "6": "6-max",
  "9": "9-max"
};
const defaultStackProfiles = {
  SHORT: { label: "20-40bb", description: "Short stack" },
  STANDARD: { label: "80-120bb", description: "100bb padrao" },
  DEEP: { label: "150bb+", description: "Deep stack" }
};
const positionLabels = {
  UTG: "UTG",
  UTG1: "UTG+1",
  MP: "MP",
  LJ: "LJ",
  HJ: "HJ",
  CO: "CO",
  BTN: "BTN",
  SB: "SB",
  BB: "BB"
};
const actionLabels = {
  OPEN: { raise: "Raise", call: "Call", fold: "Fold" },
  VS_RAISE: { raise: "3-Bet", call: "Call", fold: "Fold" },
  VS_3BET: { raise: "4-Bet", call: "Call", fold: "Fold" }
};

const root = document.getElementById("rangeViewerRoot");

const state = {
  baseScenario: null,
  ranges: null,
  filters: {
    tableSize: "6",
    stackProfile: "STANDARD",
    mode: "OPEN",
    position: "BTN"
  }
};

function sortRanks(first, second) {
  return [first, second].sort((a, b) => rankOrder.indexOf(a) - rankOrder.indexOf(b));
}

function buildGridHandCode(rowRank, columnRank) {
  if (rowRank === columnRank) {
    return `${rowRank}${columnRank}`;
  }

  const rowIndex = rankOrder.indexOf(rowRank);
  const columnIndex = rankOrder.indexOf(columnRank);
  const suitedFlag = rowIndex < columnIndex ? "s" : "o";
  const [highRank, lowRank] = sortRanks(rowRank, columnRank);
  return `${highRank}${lowRank}${suitedFlag}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function getPositionLabel(position) {
  return positionLabels[position] || position;
}

function getStackProfileMeta(stackProfile) {
  return state.ranges?.stackProfiles?.[stackProfile] || defaultStackProfiles[stackProfile] || { label: stackProfile, description: stackProfile };
}

function getSpotsForMode(tableSize, stackProfile, mode) {
  return state.ranges.formats[tableSize].stackProfiles[stackProfile].modes[mode].spots;
}

function getAvailableHeroPositions(tableSize, stackProfile, mode) {
  const positions = getSpotsForMode(tableSize, stackProfile, mode).map((spot) => spot.hero);
  return [...new Set(positions)];
}

function getRecommendedAction(mode, spot, handCode) {
  if (spot.actions.raise.includes(handCode)) {
    return "raise";
  }
  if (spot.actions.call.includes(handCode)) {
    return "call";
  }
  return "fold";
}

function describeSpot(spot, tableSize, stackProfile, mode) {
  const tableLabel = tableSizeLabels[tableSize];
  const heroLabel = getPositionLabel(spot.hero);
  const villainText = spot.villain ? getPositionLabel(spot.villain) : "";
  const stackLabel = getStackProfileMeta(stackProfile).label;

  if (mode === "OPEN") {
    return {
      title: `Hero em ${heroLabel} abrindo ${tableLabel}`,
      tableHintText: `Hero em decisao | ${stackLabel}`
    };
  }

  if (mode === "VS_RAISE") {
    return {
      title: `${villainText} abre e Hero responde em ${heroLabel}`,
      tableHintText: `Open de ${villainText} | ${stackLabel}`
    };
  }

  return {
    title: `Hero em ${heroLabel} enfrenta 3-bet de ${villainText}`,
    tableHintText: `3-bet de ${villainText} | ${stackLabel}`
  };
}

function buildExplanation(scenario, recommendedAction) {
  const { tableSize, stackProfile, mode, hero, villain, handCode } = scenario;
  const tableLabel = tableSizeLabels[tableSize];
  const stackLabel = getStackProfileMeta(stackProfile).label;

  if (mode === "OPEN") {
    if (recommendedAction === "raise") {
      return `${handCode} entra no range padrao de abertura em ${getPositionLabel(hero)} no ${tableLabel} com ${stackLabel}.`;
    }
    if (recommendedAction === "call") {
      return `${handCode} aparece como mix ou limiar em ${getPositionLabel(hero)} no ${tableLabel} com ${stackLabel}.`;
    }
    return `${handCode} fica fora do range principal de open raise em ${getPositionLabel(hero)} no ${tableLabel} com ${stackLabel}.`;
  }

  if (mode === "VS_RAISE") {
    if (recommendedAction === "raise") {
      return `${handCode} funciona bem como 3-bet frente ao open de ${getPositionLabel(villain)} quando voce esta em ${getPositionLabel(hero)} no ${tableLabel} com ${stackLabel}.`;
    }
    if (recommendedAction === "call") {
      return `${handCode} joga melhor como call contra o raise de ${getPositionLabel(villain)} nesse spot de ${tableLabel} com ${stackLabel}.`;
    }
    return `${handCode} nao sustenta defesa suficiente contra a abertura de ${getPositionLabel(villain)} nesse spot de ${tableLabel} com ${stackLabel}.`;
  }

  if (recommendedAction === "raise") {
    return `${handCode} segue forte o bastante para 4-bet contra a 3-bet de ${getPositionLabel(villain)} no ${tableLabel} com ${stackLabel}.`;
  }
  if (recommendedAction === "call") {
    return `${handCode} ainda realiza equidade suficiente para continuar de call contra a 3-bet no ${tableLabel} com ${stackLabel}.`;
  }
  return `${handCode} perde valor demais ao continuar contra a 3-bet de ${getPositionLabel(villain)} no ${tableLabel} com ${stackLabel}.`;
}

function pickSpot(tableSize, stackProfile, mode, heroPreference, villainPreference) {
  const spots = getSpotsForMode(tableSize, stackProfile, mode);
  const exactSpot = spots.find((spot) => spot.hero === heroPreference && (spot.villain || null) === (villainPreference || null));
  if (exactSpot) {
    return exactSpot;
  }

  const heroSpot = spots.find((spot) => spot.hero === heroPreference);
  if (heroSpot) {
    return heroSpot;
  }

  return spots[0] || null;
}

function syncValidPosition() {
  const availablePositions = getAvailableHeroPositions(
    state.filters.tableSize,
    state.filters.stackProfile,
    state.filters.mode
  );

  if (!availablePositions.includes(state.filters.position)) {
    state.filters.position = availablePositions[0] || state.baseScenario.hero;
  }

  return availablePositions;
}

function renderEmpty(message) {
  root.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`;
}

function renderRangeView() {
  const baseScenario = state.baseScenario;
  const availablePositions = syncValidPosition();
  const spot = pickSpot(
    state.filters.tableSize,
    state.filters.stackProfile,
    state.filters.mode,
    state.filters.position,
    baseScenario.villain
  );

  if (!spot) {
    renderEmpty("Nao encontrei um spot disponivel para esses filtros.");
    return;
  }

  const scenario = {
    ...baseScenario,
    tableSize: state.filters.tableSize,
    stackProfile: state.filters.stackProfile,
    mode: state.filters.mode,
    hero: spot.hero,
    villain: spot.villain || null,
    spotId: spot.id
  };
  const description = describeSpot(spot, scenario.tableSize, scenario.stackProfile, scenario.mode);
  const recommendedAction = getRecommendedAction(scenario.mode, spot, scenario.handCode);
  const cells = [];

  rankOrder.forEach((rowRank) => {
    rankOrder.forEach((columnRank) => {
      const handCode = buildGridHandCode(rowRank, columnRank);
      const action = getRecommendedAction(scenario.mode, spot, handCode);
      const currentClass = handCode === scenario.handCode ? " current" : "";
      const title = `${handCode}: ${actionLabels[scenario.mode][action]}`;

      cells.push(
        `<div class="range-cell ${action}${currentClass}" title="${escapeHtml(title)}">${escapeHtml(handCode)}</div>`
      );
    });
  });

  document.title = `${modeLabels[scenario.mode]} | ${scenario.handCode}`;
  root.innerHTML = `
    <section class="window-header">
      <div>
        <p class="kicker">Consulta do spot</p>
        <h1>${escapeHtml(`${modeLabels[scenario.mode]} de ${getPositionLabel(scenario.hero)}`)}</h1>
        <p class="spot-copy">${escapeHtml(buildExplanation(scenario, recommendedAction))}</p>
      </div>
      <div class="current-hand">
        <span>Mao sorteada</span>
        <strong>${escapeHtml(scenario.handCode)}</strong>
      </div>
    </section>

    <section class="filter-bar">
      <label class="filter-field">
        <span>Mesa</span>
        <select id="tableSizeSelect">
          <option value="6" ${scenario.tableSize === "6" ? "selected" : ""}>6-max</option>
          <option value="9" ${scenario.tableSize === "9" ? "selected" : ""}>9-max</option>
        </select>
      </label>

      <label class="filter-field">
        <span>Stack</span>
        <select id="stackProfileSelect">
          <option value="SHORT" ${scenario.stackProfile === "SHORT" ? "selected" : ""}>20-40bb</option>
          <option value="STANDARD" ${scenario.stackProfile === "STANDARD" ? "selected" : ""}>80-120bb</option>
          <option value="DEEP" ${scenario.stackProfile === "DEEP" ? "selected" : ""}>150bb+</option>
        </select>
      </label>

      <label class="filter-field">
        <span>Modo</span>
        <select id="modeSelect">
          <option value="OPEN" ${scenario.mode === "OPEN" ? "selected" : ""}>Open Raise</option>
          <option value="VS_RAISE" ${scenario.mode === "VS_RAISE" ? "selected" : ""}>Vs Raise</option>
          <option value="VS_3BET" ${scenario.mode === "VS_3BET" ? "selected" : ""}>Vs 3-Bet</option>
        </select>
      </label>

      <label class="filter-field">
        <span>Posicao</span>
        <select id="positionSelect">
          ${availablePositions.map((position) => `
            <option value="${escapeHtml(position)}" ${scenario.hero === position ? "selected" : ""}>${escapeHtml(getPositionLabel(position))}</option>
          `).join("")}
        </select>
      </label>
    </section>

    <section class="legend">
      <span class="legend-pill raise">${escapeHtml(actionLabels[scenario.mode].raise)}</span>
      <span class="legend-pill call">${escapeHtml(actionLabels[scenario.mode].call)}</span>
      <span class="legend-pill fold">Fold</span>
      <span class="legend-pill current">${escapeHtml(description.tableHintText)}</span>
      <span class="legend-pill">${escapeHtml(tableSizeLabels[scenario.tableSize])}</span>
      <span class="legend-pill">${escapeHtml(getStackProfileMeta(scenario.stackProfile).label)}</span>
      <span class="legend-pill">Spot: ${escapeHtml(description.title)}</span>
    </section>

    <section class="window-actions">
      <button class="window-action" id="closeRangeViewButton" type="button">Fechar janela</button>
    </section>

    <section class="range-grid" aria-live="polite">
      ${cells.join("")}
    </section>
  `;

  const tableSizeSelect = document.getElementById("tableSizeSelect");
  const stackProfileSelect = document.getElementById("stackProfileSelect");
  const modeSelect = document.getElementById("modeSelect");
  const positionSelect = document.getElementById("positionSelect");
  const closeButton = document.getElementById("closeRangeViewButton");

  tableSizeSelect.addEventListener("change", () => {
    state.filters.tableSize = tableSizeSelect.value;
    renderRangeView();
  });

  stackProfileSelect.addEventListener("change", () => {
    state.filters.stackProfile = stackProfileSelect.value;
    renderRangeView();
  });

  modeSelect.addEventListener("change", () => {
    state.filters.mode = modeSelect.value;
    renderRangeView();
  });

  positionSelect.addEventListener("change", () => {
    state.filters.position = positionSelect.value;
    renderRangeView();
  });

  closeButton.addEventListener("click", () => {
    window.close();
  });
}

async function init() {
  const rawPayload = localStorage.getItem("preflop-range-preview");
  if (!rawPayload) {
    renderEmpty("Nao encontrei um spot recente para abrir aqui. Volte ao trainer e clique novamente em consultar leque.");
    return;
  }

  state.baseScenario = JSON.parse(rawPayload).scenario;
  state.filters.tableSize = state.baseScenario.tableSize;
  state.filters.stackProfile = state.baseScenario.stackProfile || "STANDARD";
  state.filters.mode = state.baseScenario.mode;
  state.filters.position = state.baseScenario.hero;

  const response = await fetch("./ranges.json");
  state.ranges = await response.json();
  renderRangeView();
}

init().catch(() => {
  renderEmpty("Nao foi possivel carregar o leque desse spot.");
});
