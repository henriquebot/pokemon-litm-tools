import {
  getPokemonThemes,
  getPokemonFollowerThemeId,
  setPokemonFollowerTheme
} from "./pokemon-follower.js";

const MODULE_ID = "pokemon-litm-tools";
const DYLAN_ID = "dylans-animated-tokens";
const SOCKET_NAME = `module.${MODULE_ID}`;
const COMBAT_FOLDER_NAME = "Pokémon - Combate (Gerado)";
const pendingRequests = new Map();
let activated = false;

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

function isPokemonTheme(theme) {
  return (
    theme?.documentName === "Item"
    && theme.type === "themebook"
    && theme.getFlag(MODULE_ID, "pokemonTheme") === true
    && theme.getFlag(MODULE_ID, "themeRole") !== "pokemon-reference"
    && theme.parent?.type === "litm-character"
    && theme.parent?.getFlag(MODULE_ID, "combatProjection") !== true
  );
}

function themeVisual(theme) {
  const flags = theme?.flags?.[MODULE_ID] ?? {};
  const assets = flags.assets ?? {};
  const overworld = String(
    assets.overworld
    ?? assets.token
    ?? theme.img
    ?? "icons/svg/mystery-man.svg"
  ).trim();
  const spritesheet = String(
    assets.spritesheet
    ?? overworld
  ).trim();
  const rawScale = Number(flags.tokenScale ?? 1);
  const scale = Number.isFinite(rawScale) && rawScale > 0
    ? rawScale
    : 1;

  return {
    portrait: String(
      assets.portrait
      ?? theme.img
      ?? overworld
    ).trim(),
    overworld,
    spritesheet,
    scale,
    animation:
      flags.animation && typeof flags.animation === "object"
        ? foundry.utils.deepClone(flags.animation)
        : null
  };
}

function pokemonInstanceId(theme) {
  return (
    theme?.getFlag(MODULE_ID, "pokemonInstanceId")
    ?? null
  );
}

function combatStateFromTheme(theme) {
  const state = theme?.getFlag(MODULE_ID, "combatState");
  const rows = state?.floatingTagsAndStatuses;
  return Array.isArray(rows)
    ? foundry.utils.deepClone(rows)
    : [];
}

async function saveCombatState(theme, actor) {
  if (!theme || !actor) return;
  const rows = foundry.utils.deepClone(
    actor.system?.floatingTagsAndStatuses ?? []
  );
  await theme.setFlag(MODULE_ID, "combatState", {
    floatingTagsAndStatuses: rows,
    updatedAt: Date.now()
  });
}

function deployedToken(scene, instanceId) {
  if (!scene || !instanceId) return null;
  return (
    scene.tokens.find(token =>
      token.getFlag(MODULE_ID, "pokemonCombatToken") === true
      && token.getFlag(MODULE_ID, "pokemonInstanceId") === instanceId
    )
    ?? null
  );
}

function combatActor(instanceId, trainerId = null) {
  if (!instanceId) return null;
  return game.actors.find(actor =>
    actor.getFlag(MODULE_ID, "combatProjection") === true
    && actor.getFlag(MODULE_ID, "pokemonInstanceId") === instanceId
    && (
      !trainerId
      || actor.getFlag(MODULE_ID, "sourceTrainerActorId") === trainerId
    )
  ) ?? null;
}

async function ensureCombatFolder() {
  let folder = game.folders.find(candidate =>
    candidate.type === "Actor"
    && candidate.name === COMBAT_FOLDER_NAME
  ) ?? null;

  if (folder) return folder;

  folder = await Folder.create({
    name: COMBAT_FOLDER_NAME,
    type: "Actor"
  });

  return folder ?? null;
}

function combatThemeData(theme) {
  const data = foundry.utils.deepClone(theme.toObject());
  delete data._id;

  data.flags ??= {};
  data.flags[MODULE_ID] = {
    ...(data.flags[MODULE_ID] ?? {}),
    pokemonTheme: false,
    themeRole: "combat-source",
    combatSourceTheme: true
  };

  return data;
}

async function syncCombatTheme(actor, theme) {
  const previous = actor.items
    .filter(item =>
      item.getFlag(MODULE_ID, "combatSourceTheme") === true
    )
    .map(item => item.id);

  if (previous.length) {
    await actor.deleteEmbeddedDocuments("Item", previous);
  }

  await actor.createEmbeddedDocuments(
    "Item",
    [combatThemeData(theme)]
  );
}

async function ensureCombatActor(trainer, theme) {
  if (!isAuthority()) {
    throw new Error("A criação do Combat Actor precisa ser executada pelo GM ativo.");
  }

  let instanceId = pokemonInstanceId(theme);
  if (!instanceId) {
    instanceId = randomId();
    await theme.setFlag(
      MODULE_ID,
      "pokemonInstanceId",
      instanceId
    );
  }

  const visual = themeVisual(theme);
  const sourceFlags = foundry.utils.deepClone(
    theme.flags?.[MODULE_ID] ?? {}
  );

  let actor = combatActor(instanceId, trainer.id);
  const actorWasNew = !actor;
  const folder = await ensureCombatFolder();

  const combatFlags = {
    ...sourceFlags,
    kind: "pokemon-combat",
    combatProjection: true,
    pokemonInstanceId: instanceId,
    sourceTrainerActorId: trainer.id,
    sourceThemeId: theme.id,
    persistentSource: "theme"
  };

  const prototypeFlags = {
    [MODULE_ID]: {
      pokemonCombatToken: true,
      pokemonInstanceId: instanceId,
      sourceTrainerActorId: trainer.id,
      sourceThemeId: theme.id
    }
  };

  if (visual.animation) {
    prototypeFlags[DYLAN_ID] = {
      ...foundry.utils.deepClone(visual.animation),
      spritesheet: true,
      sheetsrc: visual.spritesheet
    };
  }

  const actorData = {
    name: theme.name,
    img: visual.portrait,
    ownership: foundry.utils.deepClone(trainer.ownership ?? {}),
    folder: folder?.id ?? null,
    flags: {
      [MODULE_ID]: combatFlags
    },
    prototypeToken: {
      name: theme.name,
      actorLink: true,
      width: 1,
      height: 1,
      lockRotation: true,
      disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
      displayName: CONST.TOKEN_DISPLAY_MODES.NONE,
      displayBars: CONST.TOKEN_DISPLAY_MODES.NONE,
      texture: {
        src: visual.overworld,
        scaleX: visual.scale,
        scaleY: visual.scale
      },
      flags: prototypeFlags
    }
  };

  if (!actor) {
    actor = await Actor.implementation.create({
      ...actorData,
      type: "litm-character"
    });
  } else {
    await actor.update({
      name: actorData.name,
      img: actorData.img,
      ownership: actorData.ownership,
      folder: actorData.folder,
      [`flags.${MODULE_ID}`]: combatFlags,
      "prototypeToken.name": actorData.prototypeToken.name,
      "prototypeToken.actorLink": true,
      "prototypeToken.width": 1,
      "prototypeToken.height": 1,
      "prototypeToken.lockRotation": true,
      "prototypeToken.disposition": CONST.TOKEN_DISPOSITIONS.FRIENDLY,
      "prototypeToken.displayName": CONST.TOKEN_DISPLAY_MODES.NONE,
      "prototypeToken.displayBars": CONST.TOKEN_DISPLAY_MODES.NONE,
      "prototypeToken.texture.src": visual.overworld,
      "prototypeToken.texture.scaleX": visual.scale,
      "prototypeToken.texture.scaleY": visual.scale,
      "prototypeToken.flags": prototypeFlags
    });
  }

  if (!actor) {
    throw new Error("Não foi possível criar o Combat Actor do Pokémon.");
  }

  if (actorWasNew) {
    const saved = combatStateFromTheme(theme);
    if (saved.length) {
      await actor.update({
        "system.floatingTagsAndStatuses": saved
      });
    }
  }

  await theme.setFlag(MODULE_ID, "combatActorId", actor.id);
  await syncCombatTheme(actor, theme);
  return actor;
}

function snappedTopLeft(scene, position) {
  const size = Number(
    scene?.grid?.size
    ?? canvas?.grid?.size
    ?? canvas?.dimensions?.size
    ?? 100
  );

  const x = Number(position?.x ?? 0) - size / 2;
  const y = Number(position?.y ?? 0) - size / 2;

  return {
    x: Math.round(x / size) * size,
    y: Math.round(y / size) * size
  };
}

async function deployDirect({
  sceneId,
  trainerActorId,
  themeId,
  position
}) {
  if (!isAuthority()) {
    throw new Error("Somente o GM ativo pode materializar o Combat Actor.");
  }

  const scene = game.scenes.get(sceneId);
  const trainer = game.actors.get(trainerActorId);
  const theme = trainer?.items?.get(themeId) ?? null;

  if (!scene || !trainer || !isPokemonTheme(theme)) {
    throw new Error("Treinador ou Theme Pokémon não encontrado.");
  }

  const instanceId = pokemonInstanceId(theme);
  const already = deployedToken(scene, instanceId);
  if (already) {
    return {
      tokenId: already.id,
      actorId: already.actorId,
      alreadyDeployed: true
    };
  }

  if (getPokemonFollowerThemeId(trainer) === theme.id) {
    await setPokemonFollowerTheme(trainer, null);

    const duplicates = scene.tokens
      .filter(token =>
        token.getFlag(MODULE_ID, "pokemonInstanceId") === instanceId
        && token.getFlag(MODULE_ID, "pokemonCombatToken") !== true
      )
      .map(token => token.id);

    if (duplicates.length) {
      await scene.deleteEmbeddedDocuments("Token", duplicates, {
        pokemonFollowerSync: true
      });
    }
  }

  const actor = await ensureCombatActor(trainer, theme);
  const visual = themeVisual(theme);
  const spot = snappedTopLeft(scene, position);
  const prototype = foundry.utils.deepClone(
    actor.prototypeToken?.toObject?.()
    ?? actor.prototypeToken
    ?? {}
  );

  delete prototype._id;

  const tokenFlags = {
    ...(prototype.flags?.[MODULE_ID] ?? {}),
    pokemonCombatToken: true,
    pokemonInstanceId: pokemonInstanceId(theme),
    sourceTrainerActorId: trainer.id,
    sourceThemeId: theme.id
  };

  prototype.flags ??= {};
  prototype.flags[MODULE_ID] = tokenFlags;

  if (visual.animation) {
    prototype.flags[DYLAN_ID] = {
      ...foundry.utils.deepClone(visual.animation),
      spritesheet: true,
      sheetsrc: visual.spritesheet
    };
  }

  const [token] = await scene.createEmbeddedDocuments("Token", [{
    ...prototype,
    name: theme.name,
    actorId: actor.id,
    actorLink: true,
    x: spot.x,
    y: spot.y,
    hidden: false,
    disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
    texture: {
      ...(prototype.texture ?? {}),
      src: visual.overworld,
      scaleX: visual.scale,
      scaleY: visual.scale
    }
  }]);

  if (!token) {
    throw new Error("Não foi possível colocar o Pokémon na cena.");
  }

  return {
    tokenId: token.id,
    actorId: actor.id,
    alreadyDeployed: false
  };
}

async function recollectDirect({
  sceneId,
  trainerActorId,
  themeId
}) {
  if (!isAuthority()) {
    throw new Error("Somente o GM ativo pode recolher o Combat Actor.");
  }

  const scene = game.scenes.get(sceneId);
  const trainer = game.actors.get(trainerActorId);
  const theme = trainer?.items?.get(themeId) ?? null;
  const instanceId = pokemonInstanceId(theme);

  if (!scene || !trainer || !instanceId) return false;

  const actor = combatActor(instanceId, trainer.id);
  if (actor && theme) {
    await saveCombatState(theme, actor);
  }

  if (theme && getPokemonFollowerThemeId(trainer) === theme.id) {
    await setPokemonFollowerTheme(trainer, null);
  }

  const ids = scene.tokens
    .filter(token =>
      token.getFlag(MODULE_ID, "pokemonCombatToken") === true
      && token.getFlag(MODULE_ID, "pokemonInstanceId") === instanceId
    )
    .map(token => token.id);

  if (ids.length) {
    await scene.deleteEmbeddedDocuments("Token", ids);
  }

  return true;
}

function socketResponse(message) {
  const pending = pendingRequests.get(message.requestId);
  if (!pending || message.targetUserId !== game.user.id) return;

  pendingRequests.delete(message.requestId);
  clearTimeout(pending.timer);

  if (message.ok) {
    pending.resolve(message.result ?? null);
  } else {
    pending.reject(
      new Error(message.error ?? "Falha na operação Pokémon.")
    );
  }
}

async function socketRequest(message) {
  if (
    message.authorityUserId !== game.user.id
    || !isAuthority()
  ) return;

  let result = null;
  try {
    if (message.action === "deploy") {
      result = await deployDirect(message.payload);
    } else if (message.action === "recollect") {
      result = await recollectDirect(message.payload);
    } else {
      throw new Error("Ação de combate Pokémon desconhecida.");
    }

    game.socket.emit(SOCKET_NAME, {
      kind: "response",
      requestId: message.requestId,
      targetUserId: message.requestUserId,
      ok: true,
      result
    });
  } catch (error) {
    console.error(
      "Pokemon LITM Tools | Combat socket:",
      error
    );

    game.socket.emit(SOCKET_NAME, {
      kind: "response",
      requestId: message.requestId,
      targetUserId: message.requestUserId,
      ok: false,
      error: error?.message ?? String(error)
    });
  }
}

function onSocket(message) {
  if (!message || typeof message !== "object") return;
  if (message.kind === "response") {
    socketResponse(message);
    return;
  }
  if (message.kind === "request") {
    void socketRequest(message);
  }
}

function requestAuthority(action, payload) {
  const gm = authorityGM();

  if (!gm) {
    throw new Error(
      "É necessário um GM conectado para colocar ou recolher Pokémon de combate."
    );
  }

  if (gm.id === game.user.id) {
    return action === "deploy"
      ? deployDirect(payload)
      : recollectDirect(payload);
  }

  const requestId = randomId();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(
        new Error("O GM não respondeu à solicitação de combate Pokémon.")
      );
    }, 12000);

    pendingRequests.set(
      requestId,
      { resolve, reject, timer }
    );

    game.socket.emit(SOCKET_NAME, {
      kind: "request",
      requestId,
      requestUserId: game.user.id,
      authorityUserId: gm.id,
      action,
      payload
    });
  });
}

export async function deployPokemonTheme(
  theme,
  {
    scene = canvas?.scene,
    position
  } = {}
) {
  if (!isPokemonTheme(theme)) {
    throw new Error("Este Item não é um Theme Pokémon do Time.");
  }

  if (!scene) {
    throw new Error("Nenhuma cena ativa.");
  }

  const trainer = theme.parent;
  const point = position ?? {
    x: Number(canvas?.dimensions?.width ?? 0) / 2,
    y: Number(canvas?.dimensions?.height ?? 0) / 2
  };

  return requestAuthority("deploy", {
    sceneId: scene.id,
    trainerActorId: trainer.id,
    themeId: theme.id,
    position: {
      x: Number(point.x ?? 0),
      y: Number(point.y ?? 0)
    }
  });
}

export async function recollectPokemonTheme(
  theme,
  {
    scene = canvas?.scene
  } = {}
) {
  if (!isPokemonTheme(theme) || !scene) return false;

  return requestAuthority("recollect", {
    sceneId: scene.id,
    trainerActorId: theme.parent.id,
    themeId: theme.id
  });
}

function themeFromDropSync(data) {
  if (
    data?.type !== "Item"
    || !data?.uuid
  ) return null;

  let item = null;

  try {
    if (typeof globalThis.fromUuidSync === "function") {
      item = globalThis.fromUuidSync(data.uuid);
    }
  } catch {}

  if (!item) {
    const match = String(data.uuid)
      .match(/^Actor\.([^.]+)\.Item\.([^.]+)$/);

    if (match) {
      item = game.actors
        .get(match[1])
        ?.items
        ?.get(match[2])
        ?? null;
    }
  }

  return isPokemonTheme(item) ? item : null;
}

export function isPokemonThemeCanvasDrop(data) {
  return !!themeFromDropSync(data);
}

export async function handlePokemonThemeCanvasDrop(data) {
  const theme = themeFromDropSync(data);
  if (!theme) return false;

  await deployPokemonTheme(theme, {
    scene: canvas?.scene,
    position: {
      x: Number(data.x ?? 0),
      y: Number(data.y ?? 0)
    }
  });

  return true;
}

function trainerTokenFromHud(hud) {
  const object = hud?.object ?? null;
  const token = object?.document ?? object;
  const actor = token?.actor ?? null;

  if (
    token?.documentName !== "Token"
    || actor?.type !== "litm-character"
    || actor.getFlag(MODULE_ID, "combatProjection") === true
  ) {
    return null;
  }

  return token;
}

function hudRoot(hud, html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (hud?.element instanceof HTMLElement) return hud.element;
  if (hud?.element?.[0] instanceof HTMLElement) return hud.element[0];
  return null;
}

function focusToken(tokenDoc) {
  const object = tokenDoc?.object;
  if (!object) return;

  try {
    object.control?.({ releaseOthers: true });
  } catch {}

  const center = object.center ?? {
    x: Number(tokenDoc.x ?? 0),
    y: Number(tokenDoc.y ?? 0)
  };

  void canvas.animatePan?.({
    x: center.x,
    y: center.y
  });
}

async function chooseAlreadyDeployed(theme, tokenDoc) {
  const choice = await foundry.applications.api.DialogV2.wait({
    window: {
      title: `${theme.name} · Em campo`
    },
    content: `
      <div class="pokemon-combat-existing">
        <p><strong>${foundry.utils.escapeHTML(theme.name)}</strong> já está nesta cena.</p>
      </div>
    `,
    buttons: [
      {
        action: "focus",
        label: "Focar Pokémon",
        icon: "fa-solid fa-crosshairs",
        default: true
      },
      {
        action: "recollect",
        label: "Recolher Pokémon",
        icon: "fa-solid fa-arrow-right-to-bracket"
      }
    ],
    rejectClose: false,
    modal: true
  });

  if (choice === "recollect") {
    await recollectPokemonTheme(theme);
    return;
  }

  if (choice === "focus") {
    focusToken(tokenDoc);
  }
}

function placementPoint(event) {
  const global = event?.global ?? event?.data?.global ?? null;

  try {
    if (global && canvas?.stage?.toLocal) {
      return canvas.stage.toLocal(global);
    }
  } catch {}

  try {
    if (event?.data?.getLocalPosition) {
      return event.data.getLocalPosition(canvas.stage);
    }
  } catch {}

  return global ?? { x: 0, y: 0 };
}

async function startPlacement(theme) {
  if (!canvas?.ready || !canvas?.stage || !canvas.scene) {
    throw new Error("O canvas não está pronto.");
  }

  const visual = themeVisual(theme);
  const ghost = document.createElement("img");
  ghost.className = "pokemon-combat-placement-ghost";
  ghost.src = visual.overworld;
  ghost.alt = theme.name;
  document.body.appendChild(ghost);

  const followMouse = event => {
    ghost.style.left = `${event.clientX}px`;
    ghost.style.top = `${event.clientY}px`;
  };

  let finished = false;

  const cleanup = () => {
    if (finished) return;
    finished = true;
    window.removeEventListener("pointermove", followMouse, true);
    window.removeEventListener("keydown", onKey, true);
    canvas.stage.off?.("pointerdown", onStage);
    ghost.remove();
  };

  const onKey = event => {
    if (event.key !== "Escape") return;
    cleanup();
    ui.notifications.info("Posicionamento cancelado.");
  };

  const onStage = async event => {
    const button = Number(
      event?.button
      ?? event?.data?.button
      ?? 0
    );
    if (button !== 0) return;

    const point = placementPoint(event);
    cleanup();

    try {
      await deployPokemonTheme(theme, {
        scene: canvas.scene,
        position: point
      });
    } catch (error) {
      console.error(
        "Pokemon LITM Tools | Deploy:",
        error
      );
      ui.notifications.error(
        error?.message
        ?? "Não foi possível colocar o Pokémon."
      );
    }
  };

  window.addEventListener("pointermove", followMouse, true);
  window.addEventListener("keydown", onKey, true);
  canvas.stage.on("pointerdown", onStage);

  ui.notifications.info(
    `Clique no mapa para posicionar ${theme.name}. Esc cancela.`
  );
}

async function openTeamDeployMenu(trainerToken) {
  const trainer = trainerToken?.actor;
  if (!trainer) return;

  const themes = getPokemonThemes(trainer);
  if (!themes.length) {
    ui.notifications.info("Este treinador não possui Pokémon no Time.");
    return;
  }

  const cards = themes.map((theme, index) => {
    const visual = themeVisual(theme);
    const instanceId = pokemonInstanceId(theme);
    const token = deployedToken(canvas.scene, instanceId);
    const status = token
      ? '<span class="pokemon-combat-field-badge"><i class="fa-solid fa-circle"></i> Em campo</span>'
      : '<span class="pokemon-combat-field-badge off">Disponível</span>';

    return `
      <label class="pokemon-combat-team-card">
        <input
          type="radio"
          name="themeId"
          value="${theme.id}"
          ${index === 0 ? "checked" : ""}
        >
        <img
          src="${foundry.utils.escapeHTML(visual.portrait)}"
          alt="${foundry.utils.escapeHTML(theme.name)}"
        >
        <span>
          <strong>${foundry.utils.escapeHTML(theme.name)}</strong>
          ${status}
        </span>
      </label>
    `;
  }).join("");

  const result = await foundry.applications.api.DialogV2.input({
    window: {
      title: `${trainer.name} · Pokémon`
    },
    position: {
      width: 520
    },
    content: `
      <div class="pokemon-combat-team-picker">
        <p>Escolha um Pokémon. O posicionamento é feito individualmente.</p>
        <div class="pokemon-combat-team-grid">${cards}</div>
      </div>
    `,
    ok: {
      label: "Selecionar",
      icon: "fa-solid fa-paw"
    },
    modal: true
  });

  if (!result) return;

  const theme = trainer.items.get(
    String(result.themeId ?? "")
  );

  if (!isPokemonTheme(theme)) {
    throw new Error("Pokémon do Time não encontrado.");
  }

  const token = deployedToken(
    canvas.scene,
    pokemonInstanceId(theme)
  );

  if (token) {
    await chooseAlreadyDeployed(theme, token);
    return;
  }

  await startPlacement(theme);
}

function onRenderTokenHUD(hud, html) {
  const token = trainerTokenFromHud(hud);
  if (!token) return;

  const trainer = token.actor;
  if (!trainer || (!game.user.isGM && !trainer.isOwner)) return;
  if (!getPokemonThemes(trainer).length) return;

  const root = hudRoot(hud, html);
  if (!root || root.querySelector("[data-pokemon-combat-team]")) return;

  const control = document.createElement("div");
  control.className = "control-icon pokemon-combat-hud-control";
  control.dataset.pokemonCombatTeam = "true";
  control.title = "Pokémon do Time";
  control.innerHTML = '<i class="fa-solid fa-paw"></i>';

  control.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();

    void openTeamDeployMenu(token)
      .catch(error => {
        console.error(
          "Pokemon LITM Tools | Team HUD:",
          error
        );
        ui.notifications.error(
          error?.message
          ?? "Não foi possível abrir o Time Pokémon."
        );
      });
  });

  const column =
    root.querySelector(".col.right")
    ?? root.querySelector(".right")
    ?? root.querySelector("[data-column='right']")
    ?? root.querySelector(".controls-right")
    ?? root;

  column.appendChild(control);
}

function combatActorTheme(actor) {
  if (actor?.getFlag(MODULE_ID, "combatProjection") !== true) return null;
  const trainerId = actor.getFlag(MODULE_ID, "sourceTrainerActorId");
  const themeId = actor.getFlag(MODULE_ID, "sourceThemeId");
  return game.actors.get(trainerId)?.items?.get(themeId) ?? null;
}

function onCombatActorUpdate(actor, changes) {
  if (actor?.getFlag(MODULE_ID, "combatProjection") !== true) return;

  const changed = (
    changes?.system?.floatingTagsAndStatuses !== undefined
    || Object.prototype.hasOwnProperty.call(
      changes ?? {},
      "system.floatingTagsAndStatuses"
    )
  );
  if (!changed) return;

  const theme = combatActorTheme(actor);
  if (!theme) return;

  void saveCombatState(theme, actor).catch(error => {
    console.error("Pokemon LITM Tools | Salvando estado de combate:", error);
  });
}

function onCombatActorDelete(actor) {
  if (actor?.getFlag(MODULE_ID, "combatProjection") !== true) return;

  const theme = combatActorTheme(actor);
  if (!theme) return;

  void (async () => {
    await saveCombatState(theme, actor);
    await theme.update({
      [`flags.${MODULE_ID}.-=combatActorId`]: null
    });
  })().catch(error => {
    console.error("Pokemon LITM Tools | Limpando Combat Actor:", error);
  });
}

export function activatePokemonCombatLayer() {
  if (activated) return;
  activated = true;

  game.socket.on(SOCKET_NAME, onSocket);
  Hooks.on("renderTokenHUD", onRenderTokenHUD);
  Hooks.on("updateActor", onCombatActorUpdate);
  Hooks.on("deleteActor", onCombatActorDelete);
}
