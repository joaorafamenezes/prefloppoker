const suits = ["S", "H", "D", "C"];
const redSuits = new Set(["H", "D"]);
const suitGlyph = {
  S: "\u2660",
  H: "\u2665",
  D: "\u2666",
  C: "\u2663"
};
const rankOrder = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const storageKey = "preflop-trainer-state-v4";
const autoAdvanceDelayMs = 1200;

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

const state = {
  currentScenario: null,
  answered: false,
  autoAdvanceTimer: null,
  ranges: null,
  stats: {
    bySession: {}
  },
  filters: {
    tableSize: "6",
    mode: "OPEN",
    stackProfile: "STANDARD",
    position: "ALL",
    handGroup: "ALL"
  }
};

const tableSizeFilter = document.getElementById("tableSizeFilter");
const modeFilter = document.getElementById("modeFilter");
const stackProfileFilter = document.getElementById("stackProfileFilter");
const positionFilter = document.getElementById("positionFilter");
const handGroupFilter = document.getElementById("handGroupFilter");
const newHandButton = document.getElementById("newHandButton");
const resetStatsButton = document.getElementById("resetStatsButton");

const heroModeBadge = document.getElementById("heroModeBadge");
const heroAccuracyBadge = document.getElementById("heroAccuracyBadge");
const spotTitle = document.getElementById("spotTitle");
const tableSizeLabel = document.getElementById("tableSizeLabel");
const stackProfileLabel = document.getElementById("stackProfileLabel");
const villainLabel = document.getElementById("villainLabel");
const actionLegend = document.getElementById("actionLegend");
const modeLabel = document.getElementById("modeLabel");
const tableHint = document.getElementById("tableHint");
const positionLabel = document.getElementById("positionLabel");

const cardOne = document.getElementById("cardOne");
const cardTwo = document.getElementById("cardTwo");
const handCode = document.getElementById("handCode");
const handGroupLabel = document.getElementById("handGroupLabel");
const handHint = document.getElementById("handHint");
const actionNote = document.getElementById("actionNote");
const helpButton = document.getElementById("helpButton");
const feedback = document.getElementById("feedback");
const feedbackActions = document.getElementById("feedbackActions");
const showRangeButton = document.getElementById("showRangeButton");
const helpModal = document.getElementById("helpModal");
const helpBackdrop = document.getElementById("helpBackdrop");
const helpCloseButton = document.getElementById("helpCloseButton");
const helpSummary = document.getElementById("helpSummary");
const helpGrid = document.getElementById("helpGrid");

const raiseButton = document.getElementById("raiseButton");
const callButton = document.getElementById("callButton");
const foldButton = document.getElementById("foldButton");
const actionButtons = document.querySelectorAll("[data-action]");

const correctCount = document.getElementById("correctCount");
const totalCount = document.getElementById("totalCount");
const accuracyValue = document.getElementById("accuracyValue");
const vpipValue = document.getElementById("vpipValue");
const streakValue = document.getElementById("streakValue");
const modeStats = document.getElementById("modeStats");
const mistakeList = document.getElementById("mistakeList");
const mistakeCountBadge = document.getElementById("mistakeCountBadge");
const seats = document.querySelectorAll("[data-seat]");

function sample(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function sortRanks(first, second) {
  return [first, second].sort((a, b) => rankOrder.indexOf(a) - rankOrder.indexOf(b));
}

function areConnected(code) {
  if (code.length !== 3) {
    return false;
  }

  const high = rankOrder.indexOf(code[0]);
  const low = rankOrder.indexOf(code[1]);
  return Math.abs(high - low) === 1;
}

function getHandGroup(code) {
  if (/^(AA|KK|QQ|JJ|AKs|AKo|AQs)$/.test(code)) {
    return "PREMIUM";
  }
  if (/^[AKQJT]{2}$/.test(code) || /^(AK|AQ|AJ|AT|KQ|KJ|QJ|JT)/.test(code)) {
    return "BROADWAY";
  }
  if (/^([AKQJT98765432])\1$/.test(code)) {
    return "POCKET_PAIR";
  }
  if (/s$/.test(code) && areConnected(code)) {
    return "SUITED_CONNECTOR";
  }
  if (/^A[2-9TJQK]s$/.test(code)) {
    return "AX_SUITED";
  }
  if (/o$/.test(code) && !/^(AK|AQ|AJ|AT|KQ|KJ|QJ)/.test(code)) {
    return "WEAK_OFFSUIT";
  }
  return "ALL";
}

function labelForGroup(group) {
  const labels = {
    ALL: "Geral",
    PREMIUM: "Premium",
    BROADWAY: "Broadway",
    POCKET_PAIR: "Pocket pair",
    SUITED_CONNECTOR: "Suited connector",
    AX_SUITED: "Ax suited",
    WEAK_OFFSUIT: "Offsuit fraca"
  };

  return labels[group] || group;
}

function formatCard(card) {
  return `${card.rank}${suitGlyph[card.suit]}`;
}

function formatAction(mode, action) {
  return actionLabels[mode][action];
}

function getPositionLabel(position) {
  return positionLabels[position] || position;
}

function createRandomCard(excluded = []) {
  while (true) {
    const card = { rank: sample(rankOrder), suit: sample(suits) };
    const key = `${card.rank}${card.suit}`;
    if (!excluded.includes(key)) {
      return card;
    }
  }
}

function buildHandCode(cardA, cardB) {
  if (cardA.rank === cardB.rank) {
    return `${cardA.rank}${cardB.rank}`;
  }

  const [highRank, lowRank] = sortRanks(cardA.rank, cardB.rank);
  const suitedFlag = cardA.suit === cardB.suit ? "s" : "o";
  return `${highRank}${lowRank}${suitedFlag}`;
}

function getStackProfileMeta(stackProfile) {
  return state.ranges?.stackProfiles?.[stackProfile] || defaultStackProfiles[stackProfile] || { label: stackProfile, description: stackProfile };
}

function getSessionStatsKey(tableSize, stackProfile) {
  return `${tableSize}:${stackProfile}`;
}

function ensureSessionStats(tableSize, stackProfile) {
  const key = getSessionStatsKey(tableSize, stackProfile);
  if (!state.stats.bySession[key]) {
    state.stats.bySession[key] = {
      correctCount: 0,
      totalCount: 0,
      playedCount: 0,
      streak: 0,
      byMode: {},
      mistakes: []
    };
  }

  return state.stats.bySession[key];
}

function ensureModeStats(tableSize, stackProfile, mode) {
  const sessionStats = ensureSessionStats(tableSize, stackProfile);
  if (!sessionStats.byMode[mode]) {
    sessionStats.byMode[mode] = { correct: 0, total: 0 };
  }
  return sessionStats.byMode[mode];
}

function getCurrentFormat() {
  return state.ranges.formats[state.filters.tableSize];
}

function getCurrentTableStats() {
  return ensureSessionStats(state.filters.tableSize, state.filters.stackProfile);
}

function getSpotsForMode(tableSize, stackProfile, mode) {
  return state.ranges.formats[tableSize].stackProfiles[stackProfile].modes[mode].spots;
}

function getSpot(tableSize, stackProfile, mode, spotId) {
  return getSpotsForMode(tableSize, stackProfile, mode).find((entry) => entry.id === spotId) || null;
}

function getAvailableSpots(tableSize, stackProfile, mode) {
  const spots = getSpotsForMode(tableSize, stackProfile, mode);
  if (state.filters.position === "ALL") {
    return spots;
  }

  return spots.filter((spot) => spot.hero === state.filters.position);
}

function getRecommendedAction(tableSize, stackProfile, mode, spotId, hand) {
  const spot = getSpot(tableSize, stackProfile, mode, spotId);
  if (!spot) {
    return "fold";
  }

  if (spot.actions.raise.includes(hand)) {
    return "raise";
  }
  if (spot.actions.call.includes(hand)) {
    return "call";
  }
  return "fold";
}

function buildExplanation(scenario, recommendedAction) {
  const { tableSize, stackProfile, mode, hero, villain, handCode: currentHand } = scenario;
  const tableLabel = tableSizeLabels[tableSize];
  const stackLabel = getStackProfileMeta(stackProfile).label;

  if (mode === "OPEN") {
    if (recommendedAction === "raise") {
      return `${currentHand} entra no range padrao de abertura em ${getPositionLabel(hero)} no ${tableLabel} com ${stackLabel}.`;
    }
    if (recommendedAction === "call") {
      return `${currentHand} aparece como mix ou limiar em ${getPositionLabel(hero)} no ${tableLabel} com ${stackLabel}.`;
    }
    return `${currentHand} fica fora do range principal de open raise em ${getPositionLabel(hero)} no ${tableLabel} com ${stackLabel}.`;
  }

  if (mode === "VS_RAISE") {
    if (recommendedAction === "raise") {
      return `${currentHand} funciona bem como 3-bet frente ao open de ${getPositionLabel(villain)} quando voce esta em ${getPositionLabel(hero)} no ${tableLabel} com ${stackLabel}.`;
    }
    if (recommendedAction === "call") {
      return `${currentHand} joga melhor como call contra o raise de ${getPositionLabel(villain)} nesse spot de ${tableLabel} com ${stackLabel}.`;
    }
    return `${currentHand} nao sustenta defesa suficiente contra a abertura de ${getPositionLabel(villain)} nesse spot de ${tableLabel} com ${stackLabel}.`;
  }

  if (recommendedAction === "raise") {
    return `${currentHand} segue forte o bastante para 4-bet contra a 3-bet de ${getPositionLabel(villain)} no ${tableLabel} com ${stackLabel}.`;
  }
  if (recommendedAction === "call") {
    return `${currentHand} ainda realiza equidade suficiente para continuar de call contra a 3-bet no ${tableLabel} com ${stackLabel}.`;
  }
  return `${currentHand} perde valor demais ao continuar contra a 3-bet de ${getPositionLabel(villain)} no ${tableLabel} com ${stackLabel}.`;
}

function updateSeatVisibility(tableSize) {
  const format = state.ranges.formats[tableSize];
  seats.forEach((seat) => {
    seat.classList.toggle("hidden", !format.seats.includes(seat.dataset.seat));
  });
}

function updateSeatHighlights(tableSize, hero, villain) {
  updateSeatVisibility(tableSize);
  seats.forEach((seat) => {
    seat.classList.toggle("active", seat.dataset.seat === hero);
    seat.classList.toggle("villain", Boolean(villain) && seat.dataset.seat === villain);
  });
}

function describeSpot(spot, tableSize, stackProfile, mode) {
  const tableLabel = tableSizeLabels[tableSize];
  const heroLabel = getPositionLabel(spot.hero);
  const villainText = spot.villain ? getPositionLabel(spot.villain) : "";
  const stackLabel = getStackProfileMeta(stackProfile).label;

  if (mode === "OPEN") {
    return {
      title: `Hero em ${heroLabel} abrindo ${tableLabel}`,
      villain: "Sem acao previa",
      tableHintText: "Hero em decisao",
      actionText: "Raise / Call / Fold",
      note: `Treine o range padrao de abertura no ${tableLabel} com ${stackLabel}.`
    };
  }

  if (mode === "VS_RAISE") {
    return {
      title: `${villainText} abre e Hero responde em ${heroLabel}`,
      villain: `${villainText} fez open raise`,
      tableHintText: `Open de ${villainText}`,
      actionText: "3-Bet / Call / Fold",
      note: `Aqui o botao Raise vale como 3-bet no ${tableLabel} com ${stackLabel}.`
    };
  }

  return {
    title: `Hero em ${heroLabel} enfrenta 3-bet de ${villainText}`,
    villain: `${villainText} aplicou 3-bet`,
    tableHintText: `3-bet de ${villainText}`,
    actionText: "4-Bet / Call / Fold",
    note: `Aqui o botao Raise vale como 4-bet no ${tableLabel} com ${stackLabel}.`
  };
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

function getHelpCopyForMode(mode, tableSize, stackProfile, hero, villain) {
  const tableLabel = tableSizeLabels[tableSize];
  const stackLabel = getStackProfileMeta(stackProfile).label;
  const heroLabel = getPositionLabel(hero);
  const villainLabelText = villain ? getPositionLabel(villain) : "";

  if (mode === "OPEN") {
    return {
      summary: `Voce esta treinando um spot de abertura em ${heroLabel}, no ${tableLabel}, com ${stackLabel}. O objetivo aqui e decidir quando abrir o pote, quando tratar a mao como mix/limiar e quando simplesmente passar.`,
      cards: [
        {
          action: "raise",
          title: "Raise",
          body: `Aqui significa abrir o pote primeiro. Em spots de open raise, essa e a acao padrao para as maos que entram no range principal dessa posicao.`
        },
        {
          action: "call",
          title: "Call",
          body: `Aqui representa maos marginais ou mixes que o trainer aceita como linha secundaria em alguns spots. Nao e a resposta mais comum, mas existe em parte dos ranges.`
        },
        {
          action: "fold",
          title: "Fold",
          body: `Use quando a mao nao entra no range de abertura desse spot. Em outras palavras, voce escolhe nao investir fichas agora.`
        }
      ]
    };
  }

  if (mode === "VS_RAISE") {
    return {
      summary: `Voce esta respondendo a um open raise de ${villainLabelText} enquanto joga em ${heroLabel}, no ${tableLabel}, com ${stackLabel}. O foco e separar maos que 3-betam, maos que defendem de call e maos que devem sair.`,
      cards: [
        {
          action: "raise",
          title: "3-Bet",
          body: `Neste modo, o botao Raise significa 3-betar. Normalmente inclui valor forte e alguns bluffs/semi-bluffs que performam bem contra a abertura do vilao.`
        },
        {
          action: "call",
          title: "Call",
          body: `Aqui voce paga o raise para ver o flop. Costuma ser a linha de maos que defendem bem, mas que nao querem inflar tanto o pote pre-flop.`
        },
        {
          action: "fold",
          title: "Fold",
          body: `Escolha essa opcao quando a mao nao sustenta uma defesa lucrativa contra a abertura desse vilao nesse stack e formato de mesa.`
        }
      ]
    };
  }

  return {
    summary: `Voce abriu e agora enfrenta uma 3-bet de ${villainLabelText}, jogando em ${heroLabel}, no ${tableLabel}, com ${stackLabel}. Aqui o treino separa as maos que continuam de 4-bet, as que pagam e as que desistem.`,
    cards: [
      {
        action: "raise",
        title: "4-Bet",
        body: `Neste modo, Raise quer dizer 4-betar. Em geral entram maos fortes de valor e, dependendo da profundidade, alguns bluffs selecionados.`
      },
      {
        action: "call",
        title: "Call",
        body: `Use quando a mao consegue realizar equidade bem jogando o pote em posicao ou mesmo fora de posicao, sem precisar aumentar de novo agora.`
      },
      {
        action: "fold",
        title: "Fold",
        body: `Aqui significa abandonar a mao porque ela nao continua bem contra a 3-bet nesse spot especifico.`
      }
    ]
  };
}

function openHelpModal() {
  if (!state.currentScenario) {
    return;
  }

  const { tableSize, stackProfile, mode, hero, villain } = state.currentScenario;
  const copy = getHelpCopyForMode(mode, tableSize, stackProfile, hero, villain);
  helpSummary.textContent = copy.summary;
  helpGrid.innerHTML = copy.cards.map((card) => `
    <article class="help-card ${card.action}">
      <h3>${card.title}</h3>
      <p>${card.body}</p>
    </article>
  `).join("");
  helpModal.classList.remove("hidden");
}

function closeHelpModal() {
  helpModal.classList.add("hidden");
}

function openRangeWindow(scenario) {
  const spot = getSpot(scenario.tableSize, scenario.stackProfile, scenario.mode, scenario.spotId);
  if (!spot) {
    return;
  }

  const payload = {
    scenario,
    spot,
    modeLabel: modeLabels[scenario.mode],
    tableLabel: tableSizeLabels[scenario.tableSize],
    stackLabel: getStackProfileMeta(scenario.stackProfile).label,
    heroLabel: getPositionLabel(scenario.hero),
    villainLabel: scenario.villain ? getPositionLabel(scenario.villain) : null,
    actionLabels: actionLabels[scenario.mode],
    explanation: buildExplanation(
      scenario,
      getRecommendedAction(scenario.tableSize, scenario.stackProfile, scenario.mode, scenario.spotId, scenario.handCode)
    ),
    tableHint: describeSpot(spot, scenario.tableSize, scenario.stackProfile, scenario.mode).tableHintText
  };

  localStorage.setItem("preflop-range-preview", JSON.stringify(payload));
  const popup = window.open(
    "",
    "_blank",
    "popup=yes,width=980,height=920,resizable=yes,scrollbars=yes"
  );
  if (!popup) {
    feedback.textContent = "O navegador bloqueou a janela de consulta. Libere pop-ups para estudar essa mao sem sair do trainer.";
    feedback.className = "feedback bad";
    return;
  }

  popup.opener = null;
  popup.location.href = "./range-view.html";
  popup.focus();
}

function renderPositionOptions() {
  const spots = getSpotsForMode(state.filters.tableSize, state.filters.stackProfile, state.filters.mode);
  const previousValue = state.filters.position;
  const positions = [...new Set(spots.map((spot) => spot.hero))];
  const validOptions = ["ALL", ...positions];

  positionFilter.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "ALL";
  allOption.textContent = "Todas";
  positionFilter.appendChild(allOption);

  positions.forEach((position) => {
    const option = document.createElement("option");
    option.value = position;
    option.textContent = getPositionLabel(position);
    positionFilter.appendChild(option);
  });

  state.filters.position = validOptions.includes(previousValue) ? previousValue : "ALL";
  positionFilter.value = state.filters.position;
}

function getRandomScenario() {
  const tableSize = state.filters.tableSize;
  const stackProfile = state.filters.stackProfile;
  const mode = state.filters.mode;
  const availableSpots = getAvailableSpots(tableSize, stackProfile, mode);

  for (let attempt = 0; attempt < 300; attempt += 1) {
    const spot = sample(availableSpots);
    if (!spot) {
      break;
    }

    const firstCard = createRandomCard();
    const secondCard = createRandomCard([`${firstCard.rank}${firstCard.suit}`]);
    const code = buildHandCode(firstCard, secondCard);
    const group = getHandGroup(code);

    if (state.filters.handGroup !== "ALL" && group !== state.filters.handGroup) {
      continue;
    }

    return {
      tableSize,
      stackProfile,
      mode,
      spotId: spot.id,
      hero: spot.hero,
      villain: spot.villain || null,
      firstCard,
      secondCard,
      handCode: code,
      handGroup: group
    };
  }

  return null;
}

function syncActionButtons(mode) {
  raiseButton.textContent = actionLabels[mode].raise;
  callButton.textContent = actionLabels[mode].call;
  foldButton.textContent = actionLabels[mode].fold;
}

function renderScenario() {
  if (state.autoAdvanceTimer) {
    clearTimeout(state.autoAdvanceTimer);
    state.autoAdvanceTimer = null;
  }

  closeHelpModal();

  const scenario = getRandomScenario();

  if (!scenario) {
    state.currentScenario = null;
    state.answered = false;
    heroModeBadge.textContent = `${tableSizeLabels[state.filters.tableSize]} ${getStackProfileMeta(state.filters.stackProfile).label}`;
    modeLabel.textContent = modeLabels[state.filters.mode];
    tableSizeLabel.textContent = tableSizeLabels[state.filters.tableSize];
    stackProfileLabel.textContent = getStackProfileMeta(state.filters.stackProfile).label;
    positionLabel.textContent = state.filters.position === "ALL" ? "-" : getPositionLabel(state.filters.position);
    tableHint.textContent = "Ajuste os filtros";
    spotTitle.textContent = "Nenhum spot disponivel";
    villainLabel.textContent = "Sem spot para os filtros";
    actionLegend.textContent = actionLabels[state.filters.mode]
      ? `${actionLabels[state.filters.mode].raise} / ${actionLabels[state.filters.mode].call} / ${actionLabels[state.filters.mode].fold}`
      : "Raise / Call / Fold";
    cardOne.textContent = "A♠";
    cardTwo.textContent = "K♠";
    cardOne.classList.remove("red");
    cardTwo.classList.remove("red");
    handCode.textContent = "--";
    handGroupLabel.textContent = "Sem spot";
    handHint.textContent = "Escolha filtros compatíveis para gerar uma nova mao.";
    actionNote.textContent = "Quando houver um spot valido, a mao sera sorteada normalmente.";
    feedback.textContent = "Nao encontrei um spot para esses filtros. Ajuste a mesa, o modo ou o grupo de maos.";
    feedback.className = "feedback bad";
    updateSeatVisibility(state.filters.tableSize);
    updateSeatHighlights(state.filters.tableSize, null, null);
    return;
  }

  const spot = getSpotsForMode(scenario.tableSize, scenario.stackProfile, scenario.mode).find((entry) => entry.id === scenario.spotId);
  const description = describeSpot(spot, scenario.tableSize, scenario.stackProfile, scenario.mode);

  state.currentScenario = scenario;
  state.answered = false;

  heroModeBadge.textContent = `${tableSizeLabels[scenario.tableSize]} ${getStackProfileMeta(scenario.stackProfile).label}`;
  modeLabel.textContent = modeLabels[scenario.mode];
  tableSizeLabel.textContent = tableSizeLabels[scenario.tableSize];
  stackProfileLabel.textContent = getStackProfileMeta(scenario.stackProfile).label;
  positionLabel.textContent = getPositionLabel(scenario.hero);
  tableHint.textContent = description.tableHintText;
  spotTitle.textContent = description.title;
  villainLabel.textContent = description.villain;
  actionLegend.textContent = description.actionText;

  cardOne.textContent = formatCard(scenario.firstCard);
  cardTwo.textContent = formatCard(scenario.secondCard);
  cardOne.classList.toggle("red", redSuits.has(scenario.firstCard.suit));
  cardTwo.classList.toggle("red", redSuits.has(scenario.secondCard.suit));

  handCode.textContent = scenario.handCode;
  handGroupLabel.textContent = labelForGroup(scenario.handGroup);
  handHint.textContent = `${modeLabels[scenario.mode]} em ${getPositionLabel(scenario.hero)} | ${getStackProfileMeta(scenario.stackProfile).label}`;
  actionNote.textContent = description.note;
  feedback.textContent = "Clique em uma acao para receber o feedback.";
  feedback.className = "feedback";

  syncActionButtons(scenario.mode);
  updateSeatHighlights(scenario.tableSize, scenario.hero, scenario.villain);
}

function pushMistake(tableSize, stackProfile, record) {
  const tableStats = ensureSessionStats(tableSize, stackProfile);
  tableStats.mistakes.unshift(record);
  tableStats.mistakes = tableStats.mistakes.slice(0, 10);
}

function handleAction(action) {
  if (!state.currentScenario) {
    return;
  }

  if (state.answered) {
    feedback.textContent = "Esse spot ja foi respondido. Aperte N ou clique em Nova mao.";
    feedback.className = "feedback";
    return;
  }

  const { tableSize, stackProfile, mode, hero, villain, handCode: currentHand, spotId } = state.currentScenario;
  const recommendedAction = getRecommendedAction(tableSize, stackProfile, mode, spotId, currentHand);
  const isCorrect = action === recommendedAction;
  const tableStats = ensureSessionStats(tableSize, stackProfile);
  const modeStatsBucket = ensureModeStats(tableSize, stackProfile, mode);

  state.answered = true;
  tableStats.totalCount += 1;
  modeStatsBucket.total += 1;
  if (recommendedAction !== "fold") {
    tableStats.playedCount += 1;
  }

  if (isCorrect) {
    tableStats.correctCount += 1;
    tableStats.streak += 1;
    modeStatsBucket.correct += 1;
  } else {
    tableStats.streak = 0;
    pushMistake(tableSize, stackProfile, {
      hand: currentHand,
      tableSize,
      stackProfile,
      mode,
      hero,
      villain,
      chosen: action,
      recommended: recommendedAction
    });
  }

  const prefix = isCorrect ? "Acertou." : "Nao foi a melhor linha para esse spot.";
  feedback.textContent = `${prefix} Sua acao: ${formatAction(mode, action)}. Melhor acao: ${formatAction(mode, recommendedAction)}. ${buildExplanation(state.currentScenario, recommendedAction)}`;
  feedback.className = `feedback ${isCorrect ? "good" : "bad"}`;

  renderStats();
  saveState();

  if (isCorrect) {
    state.autoAdvanceTimer = window.setTimeout(() => {
      state.autoAdvanceTimer = null;
      renderScenario();
    }, autoAdvanceDelayMs);
  } else {
    feedback.textContent = `${prefix} Sua acao: ${formatAction(mode, action)}. Melhor acao: ${formatAction(mode, recommendedAction)}. ${buildExplanation(state.currentScenario, recommendedAction)} Clique em Nova mao para continuar.`;
    feedback.className = "feedback bad";
  }
}

function renderStats() {
  const tableStats = getCurrentTableStats();
  correctCount.textContent = String(tableStats.correctCount);
  totalCount.textContent = String(tableStats.totalCount);
  streakValue.textContent = String(tableStats.streak);

  const overallAccuracy = tableStats.totalCount === 0
    ? 0
    : Math.round((tableStats.correctCount / tableStats.totalCount) * 100);
  const playedPercent = tableStats.totalCount === 0
    ? 0
    : Math.round((tableStats.playedCount / tableStats.totalCount) * 100);
  accuracyValue.textContent = `${overallAccuracy}%`;
  vpipValue.textContent = `${playedPercent}%`;
  heroAccuracyBadge.textContent = `${overallAccuracy}%`;

  modeStats.innerHTML = "";
  Object.keys(modeLabels).forEach((mode) => {
    const stat = ensureModeStats(state.filters.tableSize, state.filters.stackProfile, mode);
    const percent = stat.total === 0 ? 0 : Math.round((stat.correct / stat.total) * 100);
    const item = document.createElement("div");
    item.className = "mode-stat";
    item.innerHTML = `<span>${modeLabels[mode]}</span><strong>${stat.correct}/${stat.total} (${percent}%)</strong>`;
    modeStats.appendChild(item);
  });

  renderMistakes();
}

function renderMistakes() {
  const tableStats = getCurrentTableStats();
  mistakeCountBadge.textContent = `${tableStats.mistakes.length} leaks`;

  if (tableStats.mistakes.length === 0) {
    mistakeList.innerHTML = '<p class="empty-state">Nenhum erro registrado ainda.</p>';
    return;
  }

  mistakeList.innerHTML = "";
  tableStats.mistakes.forEach((mistake) => {
    const villainText = mistake.villain ? ` contra ${getPositionLabel(mistake.villain)}` : "";
    const stackText = getStackProfileMeta(mistake.stackProfile || "STANDARD").label;
    const item = document.createElement("div");
    item.className = "mistake-item";
    item.innerHTML = `
      <div><strong>${mistake.hand}</strong> em <strong>${getPositionLabel(mistake.hero)}</strong> <strong>${tableSizeLabels[mistake.tableSize]} ${stackText} ${modeLabels[mistake.mode]}</strong>${villainText}</div>
      <div class="mistake-meta">Voce marcou ${formatAction(mistake.mode, mistake.chosen)}. Melhor linha: ${formatAction(mistake.mode, mistake.recommended)}.</div>
    `;
    mistakeList.appendChild(item);
  });
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify({
    stats: state.stats,
    filters: state.filters
  }));
}

function loadState() {
  const rawValue = localStorage.getItem(storageKey);
  if (!rawValue) {
    return;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (parsed.stats?.bySession) {
      state.stats.bySession = parsed.stats.bySession;
      Object.values(state.stats.bySession).forEach((sessionStats) => {
        if (typeof sessionStats.playedCount !== "number") {
          sessionStats.playedCount = 0;
        }
      });
    } else if (parsed.stats?.byTableSize) {
      Object.entries(parsed.stats.byTableSize).forEach(([tableSize, tableStats]) => {
        state.stats.bySession[getSessionStatsKey(tableSize, "STANDARD")] = {
          ...tableStats,
          playedCount: typeof tableStats.playedCount === "number" ? tableStats.playedCount : 0,
          mistakes: (tableStats.mistakes || []).map((mistake) => ({
            ...mistake,
            stackProfile: "STANDARD"
          }))
        };
      });
    }

    if (parsed.filters) {
      state.filters.tableSize = parsed.filters.tableSize || "6";
      state.filters.mode = parsed.filters.mode || "OPEN";
      state.filters.stackProfile = parsed.filters.stackProfile || "STANDARD";
      state.filters.position = parsed.filters.position || "ALL";
      state.filters.handGroup = parsed.filters.handGroup || "ALL";
    }
  } catch (error) {
    localStorage.removeItem(storageKey);
  }
}

function syncFilterInputs() {
  tableSizeFilter.value = state.filters.tableSize;
  modeFilter.value = state.filters.mode;
  stackProfileFilter.value = state.filters.stackProfile;
  renderPositionOptions();
  handGroupFilter.value = state.filters.handGroup;
}

function resetStats() {
  state.stats.bySession[getSessionStatsKey(state.filters.tableSize, state.filters.stackProfile)] = {
    correctCount: 0,
    totalCount: 0,
    playedCount: 0,
    streak: 0,
    byMode: {},
    mistakes: []
  };
  renderStats();
  saveState();
}

function bindEvents() {
  actionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      handleAction(button.dataset.action);
    });
  });

  newHandButton.addEventListener("click", renderScenario);

  helpButton.addEventListener("click", openHelpModal);
  helpBackdrop.addEventListener("click", closeHelpModal);
  helpCloseButton.addEventListener("click", closeHelpModal);

  showRangeButton.addEventListener("click", () => {
    if (!state.currentScenario) {
      return;
    }

    openRangeWindow(state.currentScenario);
  });

  resetStatsButton.addEventListener("click", () => {
    resetStats();
    feedback.textContent = `Estatisticas do ${tableSizeLabels[state.filters.tableSize]} com ${getStackProfileMeta(state.filters.stackProfile).label} resetadas. Pronto para uma nova sessao.`;
    feedback.className = "feedback";
  });

  tableSizeFilter.addEventListener("change", () => {
    state.filters.tableSize = tableSizeFilter.value;
    renderPositionOptions();
    saveState();
    renderStats();
    renderScenario();
  });

  modeFilter.addEventListener("change", () => {
    state.filters.mode = modeFilter.value;
    renderPositionOptions();
    saveState();
    renderStats();
    renderScenario();
  });

  stackProfileFilter.addEventListener("change", () => {
    state.filters.stackProfile = stackProfileFilter.value;
    renderPositionOptions();
    saveState();
    renderStats();
    renderScenario();
  });

  positionFilter.addEventListener("change", () => {
    state.filters.position = positionFilter.value;
    saveState();
    renderScenario();
  });

  handGroupFilter.addEventListener("change", () => {
    state.filters.handGroup = handGroupFilter.value;
    saveState();
    renderScenario();
  });

  document.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLSelectElement) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "r") {
      handleAction("raise");
    } else if (key === "c") {
      handleAction("call");
    } else if (key === "f") {
      handleAction("fold");
    } else if (key === "n") {
      renderScenario();
    } else if (key === "escape" && !helpModal.classList.contains("hidden")) {
      closeHelpModal();
    }
  });
}

async function init() {
  const response = await fetch("./ranges.json");
  state.ranges = await response.json();
  loadState();
  syncFilterInputs();
  bindEvents();
  renderStats();
  renderScenario();
}

init().catch(() => {
  feedback.textContent = "Nao foi possivel carregar os ranges.";
  feedback.className = "feedback bad";
});
