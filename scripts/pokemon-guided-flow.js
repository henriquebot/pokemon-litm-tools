import {
  spendPokemonPower,
  commitContextSpend,
  applyGuidedChallengeConsequence,
  challengeConsequenceTierDelta
} from "./pokemon-combat-effects.js";

const MODULE_ID = "pokemon-litm-tools";
const LITM_SYSTEM_ID = "mist-engine-fvtt";
const SOCKET_NAME = "module." + MODULE_ID;
const SINGLE_USE_PREFIX = "① ";

const pendingGuided = new Map();
let activated = false;

const TYPE_PHASE_DEFAULTS = {
  fire: {
    label: "Fogo · Conter o incêndio",
    phaseName: "Incêndio fora de controle",
    limit: "Conter o incêndio",
    description: "O campo está tomado pelas chamas. Antes de enfrentar o Pokémon de verdade, é preciso controlar o incêndio."
  },
  water: {
    label: "Água · Superar a maré",
    phaseName: "Maré avassaladora",
    limit: "Superar a maré",
    description: "A água domina o campo e impede uma aproximação segura. Primeiro é preciso superar a maré."
  },
  grass: {
    label: "Planta · Abrir caminho",
    phaseName: "Vegetação descontrolada",
    limit: "Abrir caminho",
    description: "Raízes, cipós e vegetação tomam o campo. Primeiro é preciso abrir caminho até o Pokémon."
  },
  electric: {
    label: "Elétrico · Aterrar a energia",
    phaseName: "Campo eletrificado",
    limit: "Aterrar a energia",
    description: "A área está saturada de eletricidade. Primeiro é preciso descarregar ou aterrar a energia do campo."
  },
  ice: {
    label: "Gelo · Quebrar o gelo",
    phaseName: "Campo congelado",
    limit: "Quebrar o gelo",
    description: "O gelo bloqueia movimento e acesso. Primeiro é preciso quebrar o domínio congelado do Pokémon."
  },
  rock: {
    label: "Pedra · Abrir passagem",
    phaseName: "Barreira de rochas",
    limit: "Abrir passagem",
    description: "Rochas e destroços protegem o Pokémon. Primeiro é preciso abrir uma passagem."
  },
  ground: {
    label: "Terra · Estabilizar o terreno",
    phaseName: "Terreno instável",
    limit: "Estabilizar o terreno",
    description: "Tremores e fissuras tornam o campo perigoso. Primeiro é preciso estabilizar o terreno."
  },
  flying: {
    label: "Voador · Forçar a descida",
    phaseName: "Ventania e altitude",
    limit: "Forçar a descida",
    description: "O Pokémon domina o ar e mantém os oponentes à distância. Primeiro é preciso trazê-lo para uma posição alcançável."
  },
  psychic: {
    label: "Psíquico · Romper a distorção",
    phaseName: "Distorção psíquica",
    limit: "Romper a distorção",
    description: "A percepção e o espaço ao redor do Pokémon estão distorcidos. Primeiro é preciso romper essa influência."
  },
  ghost: {
    label: "Fantasma · Torná-lo corpóreo",
    phaseName: "Presença intangível",
    limit: "Torná-lo corpóreo",
    description: "O Pokémon não pode ser enfrentado plenamente enquanto permanece intangível. Primeiro é preciso prendê-lo à realidade."
  },
  dark: {
    label: "Sombrio · Quebrar a vantagem",
    phaseName: "Vantagem nas sombras",
    limit: "Quebrar a vantagem",
    description: "Escuridão, medo e emboscadas dão ao Pokémon controle do confronto. Primeiro é preciso quebrar essa vantagem."
  },
  poison: {
    label: "Veneno · Conter a contaminação",
    phaseName: "Área contaminada",
    limit: "Conter a contaminação",
    description: "O ambiente está contaminado e se torna cada vez mais perigoso. Primeiro é preciso conter a contaminação."
  },
  bug: {
    label: "Inseto · Limpar o campo",
    phaseName: "Infestação",
    limit: "Limpar o campo",
    description: "Enxames, teias ou casulos dominam o espaço. Primeiro é preciso limpar o campo."
  },
  fairy: {
    label: "Fada · Desfazer o encanto",
    phaseName: "Campo encantado",
    limit: "Desfazer o encanto",
    description: "O ambiente está sob uma influência feérica. Primeiro é preciso desfazer o encanto."
  }
};

const STAT_PHASE_DEFAULTS = {
  defense: {
    label: "DEF · Romper a defesa",
    phaseName: "Defesa impenetrável",
    limit: "Exposto",
    description: "A proteção física impede um confronto decisivo. Primeiro é preciso criar uma abertura."
  },
  "special-defense": {
    label: "SDEF · Romper a proteção",
    phaseName: "Proteção especial",
    limit: "Vulnerável",
    description: "Uma proteção especial neutraliza as abordagens diretas. Primeiro é preciso rompê-la."
  },
  speed: {
    label: "SPD · Conter a mobilidade",
    phaseName: "Mobilidade extrema",
    limit: "Encurralado",
    description: "O Pokémon é rápido demais para ser confrontado em condições normais. Primeiro é preciso limitar sua mobilidade."
  }
};

function esc(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

function randomId() {
  return foundry.utils.randomID(16);
}

function authorityGM() {
  return game.users
    .filter(user => user.active && user.isGM)
    .sort((a, b) => a.id.localeCompare(b.id))[0] ?? null;
}

function isAuthority() {
  return authorityGM()?.id === game.user.id;
}

function detailedSpend(message) {
  return message?.getFlag?.(LITM_SYSTEM_ID, "detailedSpend") ?? null;
}

function remainingPower(message) {
  const data = detailedSpend(message);
  if (!data) return 0;
  const spent = (data.entries ?? []).reduce((sum, entry) => sum + Number(entry?.cost ?? 0), 0);
  return Math.max(0, Number(data.total ?? 0) - spent);
}

function chatRoot(html) {
  return html instanceof HTMLElement
    ? html
    : html?.[0] instanceof HTMLElement
      ? html[0]
      : null;
}

function actorSheetRoot(app, html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (app?.element instanceof HTMLElement) return app.element;
  if (app?.element?.[0] instanceof HTMLElement) return app.element[0];
  return null;
}

function messageSceneId(message) {
  return message?.getFlag?.(MODULE_ID, "rollSceneId") ?? canvas?.scene?.id ?? null;
}

function messageTargetIds(message) {
  const ids = message?.getFlag?.(MODULE_ID, "rollTargetTokenIds");
  return Array.isArray(ids) ? ids : [];
}

function postMiniCard({ icon = "fa-sparkles", title, body = "", css = "" }) {
  const content = [
    '<div class="pokemon-guided-mini-card ' + esc(css) + '">',
    '<i class="fa-solid ' + esc(icon) + '"></i>',
    '<div><strong>' + esc(title) + '</strong>',
    body ? '<div>' + esc(body) + '</div>' : "",
    '</div></div>'
  ].join("");

  return ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker()
  });
}

function targetRowsForMessage(message) {
  const scene = game.scenes.get(messageSceneId(message));
  return messageTargetIds(message)
    .map(id => scene?.tokens?.get(id))
    .filter(token => !!token?.actor)
    .map(token => ({
      id: token.id,
      actorId: token.actor.id,
      name: token.name ?? token.actor.name ?? "Alvo"
    }));
}

function spendContextForMessage(message) {
  const actorId = message?.speaker?.actor ?? null;
  const actor = actorId ? game.actors.get(actorId) : null;
  const scene = game.scenes.get(messageSceneId(message));
  const sourceToken = scene?.tokens?.find(token => token.actor?.id === actorId) ?? null;
  return { actor, scene, sourceToken, targets: targetRowsForMessage(message) };
}

async function requestGuidedGM(action, payload) {
  const gm = authorityGM();
  if (!gm) throw new Error("É necessário um GM conectado.");

  if (gm.id === game.user.id) {
    return handleGuidedGMAction(action, payload);
  }

  const requestId = randomId();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingGuided.delete(requestId);
      reject(new Error("O GM não respondeu à solicitação."));
    }, 120000);

    pendingGuided.set(requestId, { resolve, reject, timer });
    game.socket.emit(SOCKET_NAME, {
      kind: "pokemon-guided-request",
      requestId,
      requestUserId: game.user.id,
      authorityUserId: gm.id,
      action,
      payload
    });
  });
}

function guidedSocketResponse(message) {
  const wait = pendingGuided.get(message?.requestId);
  if (!wait || message?.targetUserId !== game.user.id) return false;
  pendingGuided.delete(message.requestId);
  clearTimeout(wait.timer);
  if (message.ok) wait.resolve(message.result ?? null);
  else wait.reject(new Error(message.error ?? "Falha na solicitação ao GM."));
  return true;
}

async function discoverForGM(payload) {
  const scene = game.scenes.get(payload.sceneId);
  const token = payload.targetTokenId ? scene?.tokens?.get(payload.targetTokenId) : null;
  const actor = token?.actor ?? (payload.targetActorId ? game.actors.get(payload.targetActorId) : null);
  const secrets = Array.isArray(actor?.system?.secrets) ? actor.system.secrets : [];

  const secretOptions = [
    '<option value="">Resposta personalizada</option>',
    ...secrets.map((secret, index) =>
      '<option value="' + index + '">Segredo: ' + esc(secret?.name ?? ("Segredo " + (index + 1))) + '</option>'
    )
  ].join("");

  const result = await foundry.applications.api.DialogV2.input({
    window: { title: "Responder descoberta" },
    content:
      '<div class="pokemon-guided-dialog">'
      + '<p><strong>' + esc(payload.playerName ?? "Jogador") + '</strong> quer descobrir:</p>'
      + '<blockquote>' + esc(payload.question) + '</blockquote>'
      + (actor ? '<p>Sobre: <strong>' + esc(actor.name) + '</strong></p>' : "")
      + '<label>Usar um segredo<select name="secret">' + secretOptions + '</select></label>'
      + '<label>Resposta<textarea name="answer" rows="4" placeholder="O que o personagem descobre?"></textarea></label>'
      + '</div>',
    ok: { label: "Revelar", icon: "fa-solid fa-eye" },
    modal: true
  });

  if (!result) return { cancelled: true };

  const index = result.secret === "" || result.secret == null ? -1 : Number(result.secret);
  const secret = Number.isInteger(index) && index >= 0 ? secrets[index] : null;
  const answer = String(result.answer ?? "").trim()
    || String(secret?.description ?? secret?.name ?? "").trim();

  if (!answer) throw new Error("Escreva a descoberta antes de revelar.");
  return { answer };
}

async function handleGuidedGMAction(action, payload) {
  if (!game.user.isGM) throw new Error("Somente o GM pode responder.");
  if (action === "discover") return discoverForGM(payload);
  throw new Error("Ação guiada desconhecida.");
}

async function onGuidedSocket(message) {
  if (!message || typeof message !== "object") return;
  if (message.kind === "pokemon-guided-response") {
    guidedSocketResponse(message);
    return;
  }
  if (message.kind !== "pokemon-guided-request") return;
  if (message.authorityUserId !== game.user.id || !isAuthority()) return;

  try {
    const result = await handleGuidedGMAction(message.action, message.payload ?? {});
    game.socket.emit(SOCKET_NAME, {
      kind: "pokemon-guided-response",
      requestId: message.requestId,
      targetUserId: message.requestUserId,
      ok: true,
      result
    });
  } catch (error) {
    game.socket.emit(SOCKET_NAME, {
      kind: "pokemon-guided-response",
      requestId: message.requestId,
      targetUserId: message.requestUserId,
      ok: false,
      error: error?.message ?? String(error)
    });
  }
}

async function handleDiscoverSpend(message) {
  if (remainingPower(message) < 1) throw new Error("Power insuficiente.");
  const targets = targetRowsForMessage(message);
  const options = [
    '<option value="scene">Sobre o cenário</option>',
    ...targets.map(row => '<option value="token:' + esc(row.id) + '">Sobre ' + esc(row.name) + '</option>'),
    '<option value="other">Outra coisa</option>'
  ].join("");

  const choice = await foundry.applications.api.DialogV2.input({
    window: { title: "Descobrir um detalhe valioso" },
    content:
      '<div class="pokemon-guided-dialog">'
      + '<label>Quero descobrir<select name="scope">' + options + '</select></label>'
      + '<label>Pergunta<textarea name="question" rows="3" placeholder="O que você quer descobrir?"></textarea></label>'
      + '</div>',
    ok: { label: "Perguntar ao GM", icon: "fa-solid fa-magnifying-glass" },
    modal: true
  });
  if (!choice) return;

  const question = String(choice.question ?? "").trim();
  if (!question) throw new Error("Digite o que você quer descobrir.");

  const targetId = String(choice.scope ?? "").startsWith("token:")
    ? String(choice.scope).slice(6)
    : null;
  const target = targets.find(row => row.id === targetId) ?? null;

  const response = await requestGuidedGM("discover", {
    sceneId: messageSceneId(message),
    targetTokenId: target?.id ?? null,
    targetActorId: target?.actorId ?? null,
    playerName: game.user.name,
    question
  });
  if (!response || response.cancelled) return;

  await spendPokemonPower(message, {
    type: "discover",
    cost: 1,
    label: "Descoberta: " + question
  });

  await postMiniCard({
    icon: "fa-magnifying-glass",
    title: "Descoberta valiosa",
    body: question + " — " + response.answer,
    css: "discover"
  });
}

function featSuggestion(moveName) {
  const move = String(moveName ?? "sua ação");
  return [
    "Reposicionar-se depois de " + move,
    "Empurrar ou deslocar o alvo",
    "Proteger ou abrir espaço para um aliado",
    "Interagir com um elemento do cenário",
    "Criar uma mudança ficcional imediata"
  ];
}

async function handleFeatSpend(message) {
  if (remainingPower(message) < 1) throw new Error("Power insuficiente.");
  const moveName = message.getFlag?.(MODULE_ID, "pokemonMoveId") ?? "a ação";
  const suggestions = featSuggestion(moveName);
  const options = [
    ...suggestions.map((text, index) => '<option value="' + index + '">' + esc(text) + '</option>'),
    '<option value="custom">Outro feito…</option>'
  ].join("");

  const choice = await foundry.applications.api.DialogV2.input({
    window: { title: "Feito extra" },
    content:
      '<div class="pokemon-guided-dialog">'
      + '<label>Sugestão<select name="suggestion">' + options + '</select></label>'
      + '<label>O que mais sua ação consegue fazer?<textarea name="text" rows="3" placeholder="Descreva o feito extra."></textarea></label>'
      + '</div>',
    ok: { label: "Gastar 1 Power", icon: "fa-solid fa-bolt" },
    modal: true
  });
  if (!choice) return;

  const index = Number(choice.suggestion);
  const text = String(choice.text ?? "").trim()
    || (Number.isInteger(index) ? suggestions[index] : "");
  if (!text) throw new Error("Descreva o feito extra.");

  await spendPokemonPower(message, {
    type: "feat",
    cost: 1,
    label: "Feito extra: " + text
  });

  await postMiniCard({
    icon: "fa-bolt",
    title: "Feito extra",
    body: text,
    css: "feat"
  });
}

function singleUseSuggestions(message) {
  const moveId = String(message.getFlag?.(MODULE_ID, "pokemonMoveId") ?? "").toLowerCase();
  const map = [
    [/water|aqua|surf|hydro/, "Chão encharcado"],
    [/electric|thunder|volt|spark|discharge/, "Campo eletrizado"],
    [/smoke|smog/, "Cobertura de fumaça"],
    [/string|web/, "Teias pelo chão"],
    [/ice|freeze|frost|snow/, "Piso congelado"],
    [/fire|flame|ember|heat/, "Chamas espalhadas"],
    [/grass|leaf|vine|seed/, "Vegetação favorável"]
  ];
  const contextual = map.find(([pattern]) => pattern.test(moveId))?.[1];
  return [contextual, "Abertura momentânea", "Posição vantajosa", "Cobertura improvisada"]
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);
}

function singleUseDestinations(message) {
  const context = spendContextForMessage(message);
  const rows = [];
  for (const target of context.targets) {
    rows.push({ value: "token:" + target.id, label: target.name });
  }
  if (context.sourceToken) rows.push({ value: "self", label: "Usuário da ação" });
  rows.push({ value: "scene", label: "Cena" });
  return rows;
}

async function handleSingleUseSpend(message) {
  if (remainingPower(message) !== 1) {
    throw new Error("A Tag de uso único só pode ser comprada com o último Power.");
  }

  const suggestions = singleUseSuggestions(message);
  const destinations = singleUseDestinations(message);
  const choice = await foundry.applications.api.DialogV2.input({
    window: { title: "Tag de uso único" },
    content:
      '<div class="pokemon-guided-dialog">'
      + '<label>Sugestão<select name="suggestion">'
      + suggestions.map((text, index) => '<option value="' + index + '">' + esc(text) + '</option>').join("")
      + '<option value="custom">Outra…</option></select></label>'
      + '<label>Nome<input name="name" type="text" placeholder="Deixe vazio para usar a sugestão"></label>'
      + '<label>Destino<select name="destination">'
      + destinations.map(row => '<option value="' + esc(row.value) + '">' + esc(row.label) + '</option>').join("")
      + '</select></label>'
      + '<p>Ela será marcada com ① e ficará riscada automaticamente depois de ser usada em uma rolagem.</p>'
      + '</div>',
    ok: { label: "Gastar o último Power", icon: "fa-solid fa-tag" },
    modal: true
  });
  if (!choice) return;

  const suggestionIndex = Number(choice.suggestion);
  const rawName = String(choice.name ?? "").trim()
    || (Number.isInteger(suggestionIndex) ? suggestions[suggestionIndex] : "");
  if (!rawName) throw new Error("Digite o nome da Tag.");
  const name = rawName.startsWith(SINGLE_USE_PREFIX) ? rawName : SINGLE_USE_PREFIX + rawName;

  const context = spendContextForMessage(message);
  if (!context.scene) throw new Error("Cena da rolagem não encontrada.");
  const destinationValue = String(choice.destination ?? "scene");
  let destination;
  let effectTarget = "scene";
  let holderNegative = false;

  if (destinationValue === "self") {
    destination = { kind: "self" };
    effectTarget = "self";
  } else if (destinationValue === "scene") {
    destination = { kind: "scene" };
  } else if (destinationValue.startsWith("token:")) {
    destination = { kind: "targets", tokenIds: [destinationValue.slice(6)] };
    effectTarget = "target";
    holderNegative = true;
  } else {
    throw new Error("Destino inválido.");
  }

  await commitContextSpend(message, {
    type: "singleUse",
    cost: 1,
    label: "Tag de uso único: " + name
  }, {
    sceneId: context.scene.id,
    sourceActorId: context.actor?.id ?? null,
    sourceTokenId: context.sourceToken?.id ?? null,
    moveId: message.getFlag?.(MODULE_ID, "pokemonMoveId") ?? null,
    mode: "apply",
    destination,
    effect: {
      target: effectTarget,
      kind: "tag",
      name,
      level: 1,
      positive: true,
      holderNegative,
      source: "single-use",
      trigger: "principal"
    },
    pokemonSuggested: false
  });

  await postMiniCard({
    icon: "fa-tag",
    title: "Tag de uso único criada",
    body: name,
    css: "single-use"
  });
}

function wireGuidedSpendControls(message, root) {
  if (!root || root.dataset.pokemonGuidedSpend === "true") return;
  if (!message.isAuthor && !game.user.isGM) return;
  const data = detailedSpend(message);
  if (!data) return;

  root.dataset.pokemonGuidedSpend = "true";
  const single = root.querySelector('[data-spend-option="singleUse"]');
  if (single) {
    const allowed = remainingPower(message) === 1;
    single.disabled = !allowed;
    single.title = allowed
      ? "Criar uma Tag de uso único com o último Power"
      : "Disponível somente quando restar exatamente 1 Power";
  }

  root.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest?.("[data-spend-option]");
    const option = button?.dataset?.spendOption;
    if (!["discover", "feat", "singleUse"].includes(option)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const handler = option === "discover"
      ? handleDiscoverSpend
      : option === "feat"
        ? handleFeatSpend
        : handleSingleUseSpend;

    void handler(message).catch(error => {
      console.error("Pokemon LITM Tools | Spend guiado:", error);
      ui.notifications.error(error?.message ?? "Não foi possível gastar Power.");
    });
  }, true);
}

function singleUseEntriesInMessage(message, data) {
  const detailed = data?.flags?.[LITM_SYSTEM_ID]?.detailedSpend
    ?? message?.getFlag?.(LITM_SYSTEM_ID, "detailedSpend")
    ?? null;
  const rows = [
    ...(detailed?.positiveTags ?? []),
    ...(detailed?.negativeTags ?? [])
  ].filter(row => String(row?.name ?? "").startsWith(SINGLE_USE_PREFIX));
  if (rows.length) return rows;

  const content = String(data?.content ?? message?.content ?? "");
  if (!content.includes("①")) return [];
  return null;
}

function selectedSingleUseWorldEntries(message, data) {
  const exact = singleUseEntriesInMessage(message, data);
  const names = exact ? new Set(exact.map(row => String(row.name))) : null;
  const result = [];
  const scene = game.scenes.get(data?.flags?.[MODULE_ID]?.rollSceneId ?? canvas?.scene?.id);
  const speakerActorId = message?.speaker?.actor ?? data?.speaker?.actor ?? null;
  const speakerActor = speakerActorId ? game.actors.get(speakerActorId) : null;
  const content = String(data?.content ?? message?.content ?? "");

  const matches = name => {
    if (!String(name ?? "").startsWith(SINGLE_USE_PREFIX)) return false;
    if (names) return names.has(String(name));
    return content.includes(esc(name)) || content.includes(String(name));
  };

  const collectFloating = (document, locator) => {
    (document?.system?.floatingTagsAndStatuses ?? []).forEach((entry, index) => {
      if (entry?.selected === true && entry?.burned !== true && matches(entry?.name)) {
        result.push({ ...locator, storage: "floating", index, name: entry.name });
      }
    });
  };

  if (speakerActor) collectFloating(speakerActor, { actorId: speakerActor.id });
  for (const item of speakerActor?.items ?? []) {
    for (const field of ["powertags", "weaknesstags"]) {
      (item.system?.[field] ?? []).forEach((entry, index) => {
        if (entry?.selected === true && entry?.burned !== true && matches(entry?.name)) {
          result.push({ actorId: speakerActor.id, storage: "theme", itemId: item.id, field, index, name: entry.name });
        }
      });
    }
  }

  if (scene) {
    const sceneData = game.items.find(item => item.type === "scene-data" && item.system?.sceneKey === scene.id) ?? null;
    collectFloating(sceneData, { sceneDataItemId: sceneData?.id ?? null });
    for (const token of scene.tokens) {
      if (token.actor?.type === "litm-npc") {
        collectFloating(token.actor, { tokenId: token.id, actorId: token.actor.id });
      }
    }
  }

  const dedupe = new Map();
  for (const row of result) {
    const key = [row.storage, row.actorId, row.tokenId, row.sceneDataItemId, row.itemId, row.field, row.index].join("|");
    dedupe.set(key, row);
  }
  return [...dedupe.values()];
}

async function burnSingleUseDirect(payload) {
  if (!isAuthority()) throw new Error("Somente o GM ativo pode riscar Tags de uso único.");
  const scene = game.scenes.get(payload.sceneId) ?? null;
  const burned = [];

  for (const row of payload.rows ?? []) {
    let document = null;
    if (row.sceneDataItemId) document = game.items.get(row.sceneDataItemId) ?? null;
    else if (row.tokenId) document = scene?.tokens?.get(row.tokenId)?.actor ?? null;
    else if (row.actorId) document = game.actors.get(row.actorId) ?? null;
    if (!document) continue;

    if (row.storage === "theme") {
      const item = document.items?.get?.(row.itemId) ?? null;
      const field = row.field === "weaknesstags" ? "weaknesstags" : "powertags";
      const list = foundry.utils.deepClone(item?.system?.[field] ?? []);
      const entry = list[Number(row.index)];
      if (!item || !entry || String(entry.name ?? "") !== String(row.name ?? "")) continue;
      entry.burned = true;
      entry.selected = false;
      entry.toBurn = false;
      await item.update({ ["system." + field]: list });
      burned.push(row.name);
      continue;
    }

    const list = foundry.utils.deepClone(document.system?.floatingTagsAndStatuses ?? []);
    const entry = list[Number(row.index)];
    if (!entry || String(entry.name ?? "") !== String(row.name ?? "")) continue;
    entry.burned = true;
    entry.selected = false;
    entry.toBurn = false;
    await document.update({ "system.floatingTagsAndStatuses": list });
    burned.push(row.name);
  }

  return { burned };
}

function requestBurnSingleUse(sceneId, rows) {
  if (!rows.length) return;
  const gm = authorityGM();
  if (!gm) return;
  if (gm.id === game.user.id) {
    void burnSingleUseDirect({ sceneId, rows }).catch(error => console.error("Pokemon LITM Tools | Single-use:", error));
    return;
  }
  game.socket.emit(SOCKET_NAME, {
    kind: "pokemon-guided-burn-single-use",
    authorityUserId: gm.id,
    sceneId,
    rows
  });
}

function onPreCreateGuidedChat(message, data, options, userId) {
  if (userId !== game.user.id) return;
  const rows = selectedSingleUseWorldEntries(message, data);
  if (!rows.length) return;
  const sceneId = data?.flags?.[MODULE_ID]?.rollSceneId ?? canvas?.scene?.id ?? null;
  if (sceneId) requestBurnSingleUse(sceneId, rows);
}

function isPokemonChallenge(actor) {
  if (actor?.type !== "litm-npc") return false;
  const flags = actor.flags?.[MODULE_ID] ?? {};
  return flags.pokemonBuilder === true
    || flags.kind === "pokemon"
    || Number(flags.pokemonId ?? 0) > 0
    || (actor.system?.roles ?? []).some(role => String(role).toLowerCase() === "pokémon");
}

function sceneDataItem(sceneId) {
  return game.items.find(item => item.type === "scene-data" && item.system?.sceneKey === sceneId) ?? null;
}

function activeConsequenceSources(sceneId) {
  const scene = game.scenes.get(sceneId);
  if (!scene) return [];
  const rows = [];

  for (const token of scene.tokens) {
    const actor = token.actor;
    if (!actor || actor.type !== "litm-npc" || actor.system?.isOvercome === true) continue;
    if (isPokemonChallenge(actor)) {
      const moves = Array.isArray(actor.getFlag?.(MODULE_ID, "moves"))
        ? foundry.utils.deepClone(actor.getFlag(MODULE_ID, "moves"))
        : [];
      if (moves.length) {
        rows.push({
          id: "token:" + token.id,
          kind: "pokemon",
          label: "Pokémon · " + (token.name ?? actor.name),
          name: token.name ?? actor.name,
          actorId: actor.id,
          tokenId: token.id,
          actions: moves
        });
        continue;
      }
    }

    const threats = Array.isArray(actor.system?.threatsAndConsequences)
      ? foundry.utils.deepClone(actor.system.threatsAndConsequences)
      : [];
    if (threats.length) {
      rows.push({
        id: "token:" + token.id,
        kind: "npc",
        label: "NPC · " + (token.name ?? actor.name),
        name: token.name ?? actor.name,
        actorId: actor.id,
        tokenId: token.id,
        actions: threats
      });
    }
  }

  const data = sceneDataItem(sceneId);
  const journeyId = String(data?.system?.assignedJourneyId ?? "");
  const journey = journeyId ? game.actors.get(journeyId) : null;
  if (journey?.type === "litm-journey") {
    const consequences = Array.isArray(journey.system?.generalConsequences)
      ? journey.system.generalConsequences
      : [];
    if (consequences.length) {
      rows.push({
        id: "journey:" + journey.id,
        kind: "story",
        label: "Story · " + journey.name,
        name: journey.name,
        actorId: journey.id,
        tokenId: null,
        actions: consequences.map((text, index) => ({
          id: "story-" + index,
          name: String(text),
          description: String(text),
          list: []
        }))
      });
    }
  }

  return rows;
}

function parseStatusMarkup(source) {
  const text = [
    source?.description,
    ...(source?.list ?? []),
    typeof source === "string" ? source : ""
  ].join(" ");
  const match = text.match(/\[\/s\s+([^\s\]]+)-([1-6])\]/i);
  return match
    ? { name: match[1], level: Number(match[2]) }
    : null;
}

function consequenceTargets(sceneId, sourceTokenId) {
  const scene = game.scenes.get(sceneId);
  const seen = new Set();
  const rows = [];
  for (const token of scene?.tokens ?? []) {
    if (token.id === sourceTokenId || !token.actor || token.actor.type !== "litm-character") continue;
    const key = token.actorLink === false ? "token:" + token.id : "actor:" + token.actor.id;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ id: token.id, name: token.name ?? token.actor.name ?? "Actor" });
  }
  return rows;
}

function pokemonMoveEffects(move) {
  const effects = Array.isArray(move?.effects) ? move.effects : [];
  const target = effects.filter(effect => String(effect?.target ?? "target").toLowerCase() === "target" && effect?.intrinsic !== true);
  if (target.length) return target;
  if (Number(move?.power ?? 0) > 0 && String(move?.damageClass ?? "status") !== "status") {
    return [{ target: "target", kind: "status", name: "ferido", level: 1, positive: false, source: "damage", trigger: "principal" }];
  }
  return [];
}

async function chooseSourceAction(source) {
  const actions = source.actions ?? [];
  if (!actions.length) return null;
  const result = await foundry.applications.api.DialogV2.input({
    window: { title: source.label },
    content:
      '<div class="pokemon-guided-dialog"><label>Ação<select name="index">'
      + actions.map((action, index) => '<option value="' + index + '">' + esc(action?.name ?? action?.id ?? action) + '</option>').join("")
      + '</select></label></div>',
    ok: { label: "Continuar", icon: "fa-solid fa-arrow-right" },
    modal: true
  });
  return result ? actions[Number(result.index)] ?? null : null;
}

async function chooseThreatOrConsequence(source, action) {
  return foundry.applications.api.DialogV2.input({
    window: { title: String(action?.name ?? action?.id ?? "Ação") },
    content:
      '<div class="pokemon-guided-dialog">'
      + '<p><strong>' + esc(source.name) + '</strong> · ' + esc(action?.name ?? action?.id ?? action) + '</p>'
      + '<label>Resolver como<select name="mode"><option value="threat">Ameaça · anunciar na ficção</option><option value="consequence">Consequência · aplicar efeito</option></select></label>'
      + '</div>',
    ok: { label: "Continuar", icon: "fa-solid fa-arrow-right" },
    modal: true
  });
}

async function chooseConsequenceEffect(source, action, sceneId) {
  const targets = consequenceTargets(sceneId, source.tokenId);
  if (!targets.length) throw new Error("Não há Actors de personagem disponíveis na cena.");

  const effects = source.kind === "pokemon" ? pokemonMoveEffects(action) : [];
  const markup = parseStatusMarkup(action);
  const defaultEffect = effects[0] ?? (markup
    ? { target: "target", kind: "status", name: markup.name, level: markup.level, positive: false, source: "challenge" }
    : { target: "target", kind: "status", name: "complicado", level: 1, positive: false, source: "challenge" });

  const effectOptions = [
    ...effects.map((effect, index) => '<option value="effect:' + index + '">' + esc(effect.name ?? "efeito") + (effect.kind === "tag" ? "" : "-" + Number(effect.level ?? 1)) + '</option>'),
    '<option value="custom">Personalizado…</option>'
  ].join("");

  const result = await foundry.applications.api.DialogV2.input({
    window: { title: "Aplicar consequência" },
    position: { width: 520 },
    content:
      '<div class="pokemon-guided-dialog">'
      + (source.kind === "pokemon" ? '<label>Efeito sugerido<select name="effect">' + effectOptions + '</select></label>' : "")
      + '<label>Status / Tag<input name="name" type="text" value="' + esc(defaultEffect.name ?? "consequência") + '"></label>'
      + '<label>Tier<select name="level">' + [1,2,3,4,5,6].map(level => '<option value="' + level + '"' + (level === Number(defaultEffect.level ?? 1) ? ' selected' : '') + '>' + level + '</option>').join("") + '</select></label>'
      + '<fieldset><legend>Actors afetados</legend>'
      + targets.map((target, index) => '<label class="pokemon-guided-check"><input type="checkbox" name="target_' + index + '" checked> ' + esc(target.name) + '</label>').join("")
      + '</fieldset>'
      + '</div>',
    ok: { label: "Aplicar", icon: "fa-solid fa-burst" },
    modal: true
  });
  if (!result) return null;

  let selected = defaultEffect;
  if (source.kind === "pokemon" && String(result.effect ?? "").startsWith("effect:")) {
    selected = effects[Number(String(result.effect).slice(7))] ?? defaultEffect;
  }

  const name = String(result.name ?? selected?.name ?? "consequência").trim();
  const level = Math.max(1, Math.min(6, Number(result.level ?? selected?.level ?? 1) || 1));
  const targetTokenIds = targets
    .filter((row, index) => [true, "true", "on", "1", 1].includes(result["target_" + index]))
    .map(row => row.id);
  if (!targetTokenIds.length) throw new Error("Marque pelo menos um Actor.");

  return {
    targetTokenIds,
    effect: {
      ...foundry.utils.deepClone(selected ?? {}),
      target: "target",
      kind: selected?.kind === "tag" ? "tag" : "status",
      name,
      level,
      positive: false,
      source: selected?.source ?? "challenge-guided",
      trigger: selected?.trigger ?? "principal"
    }
  };
}

async function resolveGuidedConsequence(message, source) {
  const action = await chooseSourceAction(source);
  if (!action) return;
  const mode = await chooseThreatOrConsequence(source, action);
  if (!mode) return;

  const actionName = String(action?.name ?? action?.id ?? action);
  if (mode.mode === "threat") {
    await postMiniCard({
      icon: "fa-triangle-exclamation",
      title: source.kind === "pokemon"
        ? source.name + " usou " + actionName + "!"
        : source.name + " · " + actionName,
      css: "threat"
    });
    await message.setFlag(MODULE_ID, "guidedConsequenceResolved", {
      mode: "threat",
      source: source.id,
      action: actionName,
      at: Date.now()
    });
    return;
  }

  const chosen = await chooseConsequenceEffect(source, action, messageSceneId(message));
  if (!chosen) return;
  const result = await applyGuidedChallengeConsequence({
    sceneId: messageSceneId(message),
    sourceActorId: source.actorId,
    sourceTokenId: source.tokenId,
    moveId: source.kind === "pokemon" ? String(action?.id ?? "") : null,
    targetTokenIds: chosen.targetTokenIds,
    effect: chosen.effect
  });

  const summary = (result?.report ?? []).map(row => {
    if (row.immune) return (row.targetName ?? "Alvo") + " · imune";
    if (row.resisted) return (row.targetName ?? "Alvo") + " · resistiu";
    return (row.targetName ?? "Alvo") + " · " + (row.applied?.join(", ") || "sem alteração")
      + (row.multiplierLabel ? " (" + row.multiplierLabel + ")" : "");
  }).join(" · ");

  await postMiniCard({
    icon: "fa-burst",
    title: source.kind === "pokemon"
      ? source.name + " usou " + actionName + "!"
      : source.name + " · " + actionName,
    body: summary,
    css: "consequence"
  });

  await message.setFlag(MODULE_ID, "guidedConsequenceResolved", {
    mode: "consequence",
    source: source.id,
    action: actionName,
    at: Date.now()
  });
}

function decorateGmConsequencePanel(message, root) {
  if (!game.user.isGM || !root || root.querySelector("[data-pokemon-guided-consequence]")) return;
  const data = detailedSpend(message);
  if (!data || Number(data.consequenceResult ?? 1) > 0) return;
  if (message.getFlag?.(MODULE_ID, "pokemonReaction")) return;

  const sceneId = messageSceneId(message);
  const sources = activeConsequenceSources(sceneId);
  if (!sources.length) return;

  const panel = document.createElement("div");
  panel.className = "pokemon-guided-consequence-panel";
  panel.dataset.pokemonGuidedConsequence = "true";

  const resolved = message.getFlag?.(MODULE_ID, "guidedConsequenceResolved");
  if (resolved) {
    panel.innerHTML = '<small><i class="fa-solid fa-check"></i> Consequência do GM resolvida.</small>';
  } else {
    panel.innerHTML =
      '<strong><i class="fa-solid fa-shield-halved"></i> Consequência do GM</strong>'
      + '<small>Escolha um Challenge ativo da cena.</small>';
    const select = document.createElement("select");
    select.innerHTML = sources.map((source, index) => '<option value="' + index + '">' + esc(source.label) + '</option>').join("");
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Resolver';
    button.addEventListener("click", event => {
      event.preventDefault();
      const source = sources[Number(select.value)];
      if (!source) return;
      void resolveGuidedConsequence(message, source).catch(error => {
        console.error("Pokemon LITM Tools | Consequência guiada:", error);
        ui.notifications.error(error?.message ?? "Não foi possível resolver a consequência.");
      });
    });
    panel.append(select, button);
  }

  (root.querySelector(".message-content") ?? root).append(panel);
}

function decorateBurnedChallengeTags(actor, root) {
  if (actor?.type !== "litm-npc" || !root) return;
  const entries = actor.system?.floatingTagsAndStatuses ?? [];
  for (const row of root.querySelectorAll(".floating-tag-and-status-entry[data-index]")) {
    const index = Number(row.dataset.index);
    const entry = entries[index];
    const burned = entry?.isStatus !== true && Number(entry?.value ?? 0) <= 0 && entry?.burned === true;
    row.classList.toggle("pokemon-floating-tag-burned", burned);
    row.querySelector(".fts-input-name")?.classList.toggle("pokemon-floating-tag-burned", burned);
    row.querySelector(".fts-selectable")?.classList.toggle("pokemon-floating-tag-burned", burned);
  }
}

function bossFinalActor(actor) {
  if (!actor) return null;
  if (actor.isToken === true) return game.actors.get(actor.id) ?? actor;
  return actor;
}

function bossTierForMight(actor) {
  const might = String(actor?.getFlag?.(MODULE_ID, "might") ?? "origin");
  return might === "greatness" ? 4 : might === "adventure" ? 3 : 2;
}

function bossPhaseCandidates(actor) {
  const flags = actor?.flags?.[MODULE_ID] ?? {};
  const rows = [];
  for (const type of flags.types ?? []) {
    const candidate = TYPE_PHASE_DEFAULTS[String(type).toLowerCase()];
    if (candidate) rows.push({ id: "type:" + type, source: "type", ...candidate });
  }

  const stats = flags.baseStats ?? {};
  const stat = ["defense", "special-defense", "speed"]
    .map(id => ({ id, value: Number(stats[id] ?? 0) || 0 }))
    .sort((a, b) => b.value - a.value)[0];
  if (stat && STAT_PHASE_DEFAULTS[stat.id]) {
    rows.push({ id: "stat:" + stat.id, source: "stat", stat: stat.id, statValue: stat.value, ...STAT_PHASE_DEFAULTS[stat.id] });
  }
  return rows;
}

async function replaceBossTokensWithPhase(finalActor, phaseActor) {
  const scene = canvas?.scene;
  if (!scene) return 0;
  const tokens = scene.tokens.filter(token => token.actor?.id === finalActor.id);
  if (!tokens.length) return 0;

  const creates = tokens.map(token => {
    const data = foundry.utils.deepClone(phaseActor.prototypeToken?.toObject?.() ?? {});
    delete data._id;
    return {
      ...data,
      name: phaseActor.name,
      actorId: phaseActor.id,
      actorLink: false,
      x: token.x,
      y: token.y,
      elevation: token.elevation,
      rotation: token.rotation,
      hidden: token.hidden,
      disposition: token.disposition
    };
  });

  await scene.createEmbeddedDocuments("Token", creates);
  await scene.deleteEmbeddedDocuments("Token", tokens.map(token => token.id));
  return tokens.length;
}

async function openBossGenerator(actor) {
  if (!game.user.isGM) return;
  const finalActor = bossFinalActor(actor);
  if (!isPokemonChallenge(finalActor)) throw new Error("Este botão é exclusivo de Challenge Pokémon.");
  if (finalActor.getFlag?.(MODULE_ID, "bossPhaseRole") === "phase1") throw new Error("Esta ficha já é uma Fase 1.");

  const existing = finalActor.getFlag?.(MODULE_ID, "bossPhase1ActorId");
  if (existing && game.actors.get(existing)) {
    game.actors.get(existing).sheet?.render?.(true);
    ui.notifications.info("Este boss já possui uma Fase 1.");
    return;
  }

  const candidates = bossPhaseCandidates(finalActor);
  if (!candidates.length) throw new Error("Não foi possível sugerir uma fase por Tipo ou DEF/SDEF/SPD.");

  const choice = await foundry.applications.api.DialogV2.input({
    window: { title: "Criar Boss em Fases" },
    position: { width: 560 },
    content:
      '<div class="pokemon-guided-dialog">'
      + '<label>Base da Fase 1<select name="candidate">'
      + candidates.map((candidate, index) => '<option value="' + index + '">' + esc(candidate.label) + '</option>').join("")
      + '</select></label>'
      + '<p>Depois de escolher a sugestão, você poderá editar completamente o nome e o Limit.</p>'
      + '</div>',
    ok: { label: "Personalizar fase", icon: "fa-solid fa-arrow-right" },
    modal: true
  });
  if (!choice) return;
  const candidate = candidates[Number(choice.candidate)] ?? candidates[0];
  const tier = bossTierForMight(finalActor);

  const custom = await foundry.applications.api.DialogV2.input({
    window: { title: finalActor.name + " · Fase 1" },
    position: { width: 600 },
    content:
      '<div class="pokemon-guided-dialog">'
      + '<label>Nome da fase<input name="phaseName" type="text" value="' + esc(candidate.phaseName) + '"></label>'
      + '<label>Limit<input name="limit" type="text" value="' + esc(candidate.limit) + '"></label>'
      + '<label>Tier do Limit<select name="tier">' + [1,2,3,4,5,6].map(value => '<option value="' + value + '"' + (value === tier ? ' selected' : '') + '>' + value + '</option>').join("") + '</select></label>'
      + '<label>Descrição<textarea name="description" rows="4">' + esc(candidate.description) + '</textarea></label>'
      + '<label class="pokemon-guided-check"><input type="checkbox" name="replaceTokens" checked> Substituir o Pokémon pela Fase 1 na cena atual</label>'
      + '</div>',
    ok: { label: "Criar Fase 1", icon: "fa-solid fa-layer-group" },
    modal: true
  });
  if (!custom) return;

  const phaseName = String(custom.phaseName ?? "").trim() || candidate.phaseName;
  const limit = String(custom.limit ?? "").trim() || candidate.limit;
  const limitTier = Math.max(1, Math.min(6, Number(custom.tier ?? tier) || tier));
  const description = String(custom.description ?? "").trim();
  const groupId = finalActor.getFlag?.(MODULE_ID, "bossPhaseGroupId") ?? randomId();

  const data = foundry.utils.deepClone(finalActor.toObject());
  delete data._id;
  data.name = finalActor.name + " · " + phaseName;
  data.system ??= {};
  data.system.limits = [{
    name: limit,
    value: String(limitTier),
    consequence: "Avançar para Fase 2"
  }];
  data.system.shortDescription = description || data.system.shortDescription;
  data.system.floatingTagsAndStatuses = (data.system.floatingTagsAndStatuses ?? [])
    .filter(entry => entry?.isStatus !== true && Number(entry?.value ?? 0) <= 0)
    .map(entry => ({ ...entry, selected: false, toBurn: false }));
  data.flags ??= {};
  data.flags[MODULE_ID] = {
    ...(data.flags[MODULE_ID] ?? {}),
    pokemonInstanceId: randomId(),
    bossPhaseGroupId: groupId,
    bossPhaseRole: "phase1",
    bossFinalActorId: finalActor.id,
    bossPhaseConfig: {
      source: candidate.id,
      phaseName,
      limit,
      tier: limitTier,
      description
    }
  };
  data.prototypeToken ??= {};
  data.prototypeToken.name = data.name;
  data.prototypeToken.actorLink = false;
  data.prototypeToken.flags ??= {};
  data.prototypeToken.flags[MODULE_ID] = foundry.utils.deepClone(data.flags[MODULE_ID]);

  const phaseActor = await Actor.implementation.create(data);
  if (!phaseActor) throw new Error("Não foi possível criar a Fase 1.");

  await phaseActor.setFlag(MODULE_ID, "bossFinalActorId", finalActor.id);
  await finalActor.update({
    ["flags." + MODULE_ID + ".bossPhaseGroupId"]: groupId,
    ["flags." + MODULE_ID + ".bossPhaseRole"]: "final",
    ["flags." + MODULE_ID + ".bossPhase1ActorId"]: phaseActor.id
  });
  await phaseActor.update({
    ["flags." + MODULE_ID + ".bossNextActorId"]: finalActor.id
  });

  const replace = [true, "true", "on", "1", 1].includes(custom.replaceTokens);
  if (replace) await replaceBossTokensWithPhase(finalActor, phaseActor);
  phaseActor.sheet?.render?.(true);
  ui.notifications.info("Fase 1 criada. O Challenge original continua sendo a fase final.");
}

async function advanceBossPhase(actor) {
  if (!game.user.isGM) return;
  const phaseActor = bossFinalActor(actor);
  if (phaseActor?.getFlag?.(MODULE_ID, "bossPhaseRole") !== "phase1") return;
  if (phaseActor.system?.isOvercome !== true) {
    throw new Error("A Fase 1 ainda não atingiu seu Limit.");
  }

  const finalId = phaseActor.getFlag(MODULE_ID, "bossFinalActorId") ?? phaseActor.getFlag(MODULE_ID, "bossNextActorId");
  const finalActor = game.actors.get(finalId);
  if (!finalActor) throw new Error("Challenge da Fase 2 não encontrado.");
  const scene = canvas?.scene;
  const tokens = scene?.tokens?.filter(token => token.actor?.id === phaseActor.id) ?? [];

  if (scene && tokens.length) {
    const creates = tokens.map(token => {
      const data = foundry.utils.deepClone(finalActor.prototypeToken?.toObject?.() ?? {});
      delete data._id;
      return {
        ...data,
        name: finalActor.name,
        actorId: finalActor.id,
        actorLink: false,
        x: token.x,
        y: token.y,
        elevation: token.elevation,
        rotation: token.rotation,
        hidden: token.hidden,
        disposition: token.disposition
      };
    });
    await scene.createEmbeddedDocuments("Token", creates);
    await scene.deleteEmbeddedDocuments("Token", tokens.map(token => token.id));
  }

  await postMiniCard({
    icon: "fa-layer-group",
    title: finalActor.name + " · Fase 2",
    body: "A primeira fase foi superada. O confronto muda de forma.",
    css: "boss-phase"
  });
  finalActor.sheet?.render?.(true);
}

function decorateBossHeader(actor, root) {
  if (!game.user.isGM || !isPokemonChallenge(actor) || !root) return;
  const windowRoot = root.closest?.(".application, .window-app") ?? root;
  if (windowRoot.querySelector?.("[data-pokemon-boss-phase-control]")) return;
  const header = windowRoot.querySelector?.(".window-header") ?? null;
  const host = header?.querySelector?.(".window-controls") ?? header;
  if (!host) return;

  const role = actor.getFlag?.(MODULE_ID, "bossPhaseRole");
  const canAdvance = role === "phase1" && actor.system?.isOvercome === true;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "header-control icon pokemon-boss-phase-control";
  button.dataset.pokemonBossPhaseControl = "true";
  button.title = canAdvance ? "Avançar para Fase 2" : role === "phase1" ? "Fase 1 ainda não superada" : "Criar Boss em Fases";
  button.setAttribute("aria-label", button.title);
  button.innerHTML = '<i class="fa-solid ' + (canAdvance ? "fa-forward" : "fa-layer-group") + '"></i>';
  button.disabled = role === "phase1" && !canAdvance;
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    const action = role === "phase1" ? advanceBossPhase(actor) : openBossGenerator(actor);
    void Promise.resolve(action).catch(error => {
      console.error("Pokemon LITM Tools | Boss em Fases:", error);
      ui.notifications.error(error?.message ?? "Não foi possível resolver o Boss em Fases.");
    });
  });
  host.prepend(button);
}

function onRenderGuidedChat(message, html) {
  const root = chatRoot(html);
  if (!root) return;
  if (detailedSpend(message)) {
    wireGuidedSpendControls(message, root);
    decorateGmConsequencePanel(message, root);
  }
}

function onRenderGuidedActorSheet(app, html) {
  const root = actorSheetRoot(app, html);
  const actor = app?.actor ?? app?.document ?? app?.object ?? null;
  if (!root || actor?.documentName !== "Actor") return;
  decorateBurnedChallengeTags(actor, root);
  decorateBossHeader(actor, root);
}

export function pokemonGuidedFlowSelfTest() {
  const checks = {
    discoverGuided: typeof handleDiscoverSpend === "function" && typeof discoverForGM === "function",
    extraFeatGuided: typeof handleFeatSpend === "function",
    singleUseLastPower: handleSingleUseSpend.toString().includes("remainingPower(message) !== 1"),
    singleUseAutoBurn: typeof burnSingleUseDirect === "function" && typeof onPreCreateGuidedChat === "function",
    gmConsequencePanel: typeof decorateGmConsequencePanel === "function" && typeof activeConsequenceSources === "function",
    cappedChallengeEffectiveness:
      challengeConsequenceTierDelta(4) === 1
      && challengeConsequenceTierDelta(2) === 1
      && challengeConsequenceTierDelta(1) === 0
      && challengeConsequenceTierDelta(0.5) === -1
      && challengeConsequenceTierDelta(0.25) === -1
      && challengeConsequenceTierDelta(0) === null,
    bossGenerator: typeof openBossGenerator === "function" && typeof advanceBossPhase === "function",
    bossLimitEditable: openBossGenerator.toString().includes('name="limit"'),
    burnedChallengeVisual: typeof decorateBurnedChallengeTags === "function"
  };
  return {
    revision: "2026-09-08-guided-hotfix-v1",
    checks,
    ok: Object.values(checks).every(Boolean)
  };
}

export function activatePokemonGuidedFlow() {
  if (activated) return;
  activated = true;
  game.socket.on(SOCKET_NAME, message => {
    if (message?.kind === "pokemon-guided-burn-single-use") {
      if (message.authorityUserId === game.user.id && isAuthority()) {
        void burnSingleUseDirect({ sceneId: message.sceneId, rows: message.rows ?? [] })
          .catch(error => console.error("Pokemon LITM Tools | Single-use:", error));
      }
      return;
    }
    void onGuidedSocket(message);
  });
  Hooks.on("renderChatMessageHTML", onRenderGuidedChat);
  Hooks.on("preCreateChatMessage", onPreCreateGuidedChat);
  Hooks.on("renderActorSheet", onRenderGuidedActorSheet);
  Hooks.on("renderApplicationV2", onRenderGuidedActorSheet);
}
