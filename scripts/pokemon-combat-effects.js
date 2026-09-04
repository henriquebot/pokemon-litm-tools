import {
  getPokemonThemes,
  getPokemonFollowerThemeId,
  setPokemonFollowerTheme
} from "./pokemon-follower.js";

import {
  recollectPokemonTheme
} from "./pokemon-combat.js";

import {
  buildMoveEffects
} from "./pokemon-content.js";

const MODULE_ID = "pokemon-litm-tools";
const SOCKET_NAME = "module." + MODULE_ID;
const pending = new Map();
let activated = false;

const TYPE_COLORS = {
  normal: "#d8d8d0",
  fire: "#ff7043",
  water: "#42a5f5",
  electric: "#ffd54f",
  grass: "#66bb6a",
  ice: "#80deea",
  fighting: "#ef5350",
  poison: "#ab47bc",
  ground: "#a98264",
  flying: "#90caf9",
  psychic: "#ec407a",
  bug: "#9ccc65",
  rock: "#b0a06f",
  ghost: "#7e57c2",
  dragon: "#5c6bc0",
  dark: "#616161",
  steel: "#b0bec5",
  fairy: "#f48fb1"
};

const JB2A_PATHS = {
  fire: ["jb2a.fire_bolt.orange", "jb2a.fire_bolt"],
  ice: ["jb2a.ray_of_frost", "jb2a.ice_shard"],
  electric: ["jb2a.lightning_bolt", "jb2a.chain_lightning"],
  poison: ["jb2a.poison_spray"],
  psychic: ["jb2a.energy_beam"],
  grass: ["jb2a.entangle"],
  water: ["jb2a.water_bolt"],
  fighting: ["jb2a.unarmed_strike"],
  normal: ["jb2a.bullet.01"]
};

function authorityGM() {
  return game.users
    .filter(user => user.active && user.isGM)
    .sort((a, b) => a.id.localeCompare(b.id))[0] ?? null;
}

function isAuthority() {
  return authorityGM()?.id === game.user.id;
}

function randomId() {
  return foundry.utils.randomID(16);
}

function esc(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

function isCombatToken(token) {
  return token?.getFlag?.(MODULE_ID, "pokemonCombatToken") === true
    || token?.actor?.getFlag?.(MODULE_ID, "combatProjection") === true;
}

function combatTokenFromHud(hud) {
  const object = hud?.object ?? null;
  const token = object?.document ?? object;
  if (token?.documentName !== "Token" || !isCombatToken(token)) return null;
  return token;
}

function hudRoot(hud, html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (hud?.element instanceof HTMLElement) return hud.element;
  if (hud?.element?.[0] instanceof HTMLElement) return hud.element[0];
  return null;
}

function sourceThemeForCombatActor(actor) {
  if (!actor?.getFlag?.(MODULE_ID, "combatProjection")) return null;
  const trainerId = actor.getFlag(MODULE_ID, "sourceTrainerActorId");
  const themeId = actor.getFlag(MODULE_ID, "sourceThemeId");
  return game.actors.get(trainerId)?.items?.get(themeId) ?? null;
}

function moveForActor(actor, moveId) {
  const moves = actor?.getFlag?.(MODULE_ID, "moves");
  if (!Array.isArray(moves)) return null;
  return moves.find(move => move?.id === moveId) ?? null;
}

function effectsForMove(actor, move) {
  if (Array.isArray(move?.effects) && move.effects.length) {
    return foundry.utils.deepClone(move.effects);
  }

  try {
    return buildMoveEffects(
      move,
      actor?.getFlag?.(MODULE_ID, "might") ?? "adventure",
      actor?.getFlag?.(MODULE_ID, "contentLanguage") ?? "pt-BR"
    );
  } catch {
    return [];
  }
}

function sourceTokenForActor(actor) {
  const controlled = canvas?.tokens?.controlled?.find(token => token.actor?.id === actor?.id);
  if (controlled) return controlled.document ?? controlled;

  const active = actor?.getActiveTokens?.(true, true) ?? [];
  const token = active[0] ?? null;
  return token?.document ?? token ?? null;
}

function tokenObject(tokenDoc) {
  return tokenDoc?.object ?? canvas?.tokens?.get?.(tokenDoc?.id) ?? null;
}

function typeColor(type) {
  return TYPE_COLORS[String(type ?? "normal")] ?? TYPE_COLORS.normal;
}

function multiplierFor(actor, moveType) {
  const map = actor?.getFlag?.(MODULE_ID, "typeEffectiveness") ?? {};
  const value = Number(map?.[moveType]);
  return Number.isFinite(value) ? value : 1;
}

function matchupLabel(multiplier) {
  if (multiplier === 0) return "Imune";
  if (multiplier >= 4) return "Extremamente efetivo ×" + multiplier;
  if (multiplier > 1) return "Super efetivo ×" + multiplier;
  if (multiplier < 1) return "Resistido ×" + multiplier;
  return "Eficácia normal";
}

function effectRank(trigger) {
  const value = String(trigger ?? "principal").toLowerCase();
  if (value === "extrema" || value === "extreme") return 3;
  if (value === "forte" || value === "strong") return 2;
  return 1;
}

function effectPositive(effect) {
  if (typeof effect?.positive === "boolean") return effect.positive;
  const source = String(effect?.source ?? "").toLowerCase();
  if (["healing", "drain-heal", "heal", "buff"].includes(source)) return true;
  if (["recoil", "recharge", "damage", "ailment", "flinch", "trap", "debuff"].includes(source)) return false;

  const target = String(effect?.target ?? "target").toLowerCase();
  if (target === "self" && !["recoil", "recharge"].includes(source)) return true;
  return false;
}

function statusEntry(effect, multiplier = 1) {
  let level = Math.max(1, Math.min(6, Number(effect?.level ?? effect?.tier ?? 1) || 1));
  const source = String(effect?.source ?? "").toLowerCase();

  if (source === "damage") {
    if (multiplier === 0) return null;
    if (multiplier >= 4) level += 2;
    else if (multiplier > 1) level += 1;
    else if (multiplier <= 0.25) level -= 2;
    else if (multiplier < 1) level -= 1;
    level = Math.max(1, Math.min(6, level));
  }

  const markings = Array(6).fill(false);
  markings[level - 1] = true;

  return {
    name: String(effect?.name ?? "efeito").trim() || "efeito",
    value: level,
    isStatus: effect?.kind !== "tag",
    burned: false,
    toBurn: false,
    selected: false,
    positive: effectPositive(effect),
    markings,
    might: 0,
    mightIcon: "adventure"
  };
}

function stackFloating(list, entry) {
  const current = foundry.utils.deepClone(Array.isArray(list) ? list : []);
  const norm = value => String(value ?? "").trim().toLowerCase();

  if (!entry.isStatus) {
    if (!current.some(row => !row.isStatus && norm(row.name) === norm(entry.name) && row.positive === entry.positive)) {
      current.push(entry);
    }
    return current;
  }

  const index = current.findIndex(row =>
    (row?.isStatus === true || Number(row?.value ?? 0) > 0)
    && norm(row.name) === norm(entry.name)
    && (row.positive !== false) === (entry.positive !== false)
  );

  if (index < 0) {
    current.push(entry);
    return current;
  }

  const existing = foundry.utils.deepClone(current[index]);
  const markings = Array.isArray(existing.markings)
    ? [...existing.markings]
    : Array(6).fill(false);

  while (markings.length < 6) markings.push(false);

  let tier = Math.max(1, Math.min(6, Number(entry.value ?? 1))) - 1;
  if (markings[tier]) {
    const next = markings.findIndex((marked, i) => i > tier && !marked);
    if (next >= 0) tier = next;
  }

  markings[tier] = true;
  existing.markings = markings.slice(0, 6);
  existing.value = existing.markings.lastIndexOf(true) + 1;
  current[index] = existing;
  return current;
}

async function applyEffectsToActor(actor, effects, multiplier, maxRank) {
  if (!actor || !Array.isArray(effects) || maxRank <= 0) return [];

  let list = foundry.utils.deepClone(actor.system?.floatingTagsAndStatuses ?? []);
  const applied = [];

  for (const effect of effects) {
    if (effectRank(effect?.trigger) > maxRank) continue;
    if (multiplier === 0 && String(effect?.target ?? "target") !== "self") continue;

    const entry = statusEntry(effect, multiplier);
    if (!entry) continue;
    list = stackFloating(list, entry);
    applied.push(entry.name + (entry.isStatus ? "-" + entry.value : ""));
  }

  if (applied.length) {
    await actor.update({
      "system.floatingTagsAndStatuses": list
    });
  }

  return applied;
}

function sequenceAvailable() {
  return game.modules.get("sequencer")?.active === true
    && typeof globalThis.Sequence === "function";
}

function databasePath(candidates) {
  if (!sequenceAvailable()) return null;
  for (const path of candidates ?? []) {
    try {
      if (globalThis.Sequencer?.Database?.getEntry?.(path)) return path;
    } catch {}
  }
  return null;
}

function pulseToken(tokenDoc, type) {
  const object = tokenObject(tokenDoc);
  const mesh = object?.mesh ?? object?.icon ?? null;
  if (!mesh) return;

  const color = Number.parseInt(typeColor(type).slice(1), 16);
  const oldTint = mesh.tint;
  const oldAlpha = mesh.alpha;

  try {
    mesh.tint = color;
    mesh.alpha = 0.62;
    setTimeout(() => {
      try {
        if (!mesh.destroyed) {
          mesh.tint = oldTint;
          mesh.alpha = oldAlpha;
        }
      } catch {}
    }, 420);
  } catch {}
}

async function playMoveVfxLocal(sceneId, sourceTokenId, targetTokenIds, type) {
  if (canvas?.scene?.id !== sceneId) return;

  const source = canvas.scene.tokens.get(sourceTokenId) ?? null;
  const targets = (targetTokenIds ?? [])
    .map(id => canvas.scene.tokens.get(id))
    .filter(Boolean);

  if (sequenceAvailable()) {
    const path = databasePath(JB2A_PATHS[type] ?? []);
    if (path && source && targets.length) {
      try {
        const seq = new Sequence({ inModuleName: MODULE_ID, softFail: true });
        for (const target of targets) {
          seq.effect()
            .file(path)
            .atLocation(tokenObject(source) ?? source)
            .stretchTo(tokenObject(target) ?? target);
        }
        await seq.play();
        return;
      } catch (error) {
        console.warn("Pokemon LITM Tools | Sequencer Move VFX:", error);
      }
    }

    try {
      const seq = new Sequence({ inModuleName: MODULE_ID, softFail: true });
      for (const target of targets.length ? targets : [source].filter(Boolean)) {
        seq.effect()
          .atLocation(tokenObject(target) ?? target)
          .shape("circle", {
            radius: 0.7,
            gridUnits: true,
            fillColor: typeColor(type),
            fillAlpha: 0.26,
            lineSize: 4,
            lineColor: typeColor(type),
            name: "pokemon-type-pulse"
          })
          .fadeIn(80)
          .fadeOut(420)
          .scaleIn(0.65, 150)
          .duration(650);
      }
      await seq.play();
      return;
    } catch (error) {
      console.warn("Pokemon LITM Tools | Sequencer fallback:", error);
    }
  }

  if (source) pulseToken(source, type);
  for (const target of targets) {
    if (target.id !== source?.id) setTimeout(() => pulseToken(target, type), 110);
  }
}

async function playAreaVfx(region, radiusGrids, type) {
  if (!region || !sequenceAvailable()) return;

  try {
    await new Sequence({ inModuleName: MODULE_ID, softFail: true })
      .effect()
        .atLocation({
          x: Number(region.shapes?.[0]?.x ?? 0),
          y: Number(region.shapes?.[0]?.y ?? 0)
        })
        .name("pokemon-area-" + region.id)
        .persist()
        .shape("circle", {
          radius: Number(radiusGrids ?? 2),
          gridUnits: true,
          fillColor: typeColor(type),
          fillAlpha: 0.16,
          lineSize: 4,
          lineColor: typeColor(type),
          name: "pokemon-area-shape"
        })
        .loopProperty("shapes.pokemon-area-shape", "scale.x", {
          from: 0.96, to: 1.04, duration: 900, pingPong: true, ease: "easeInOutSine"
        })
        .loopProperty("shapes.pokemon-area-shape", "scale.y", {
          from: 0.96, to: 1.04, duration: 900, pingPong: true, ease: "easeInOutSine"
        })
        .loopProperty("shapes.pokemon-area-shape", "alpha", {
          from: 0.55, to: 0.9, duration: 1100, pingPong: true, ease: "easeInOutSine"
        })
      .play();
  } catch (error) {
    console.warn("Pokemon LITM Tools | Sequencer Area:", error);
  }
}

async function createAreaDirect(payload) {
  if (!isAuthority()) throw new Error("Somente o GM ativo pode criar a Área Pokémon.");

  const scene = game.scenes.get(payload.sceneId);
  const sourceActor = game.actors.get(payload.sourceActorId);
  const move = moveForActor(sourceActor, payload.moveId);
  if (!scene || !sourceActor || !move) {
    throw new Error("Origem ou golpe da Área Pokémon não encontrado.");
  }

  const radiusGrids = Math.max(1, Math.min(6, Number(payload.radiusGrids ?? 2) || 2));
  const gridSize = Number(scene.grid?.size ?? canvas?.grid?.size ?? 100);
  const center = {
    x: Number(payload.center?.x ?? 0),
    y: Number(payload.center?.y ?? 0)
  };

  const [region] = await scene.createEmbeddedDocuments("Region", [{
    name: String(move.name ?? move.id ?? "Golpe") + " · Área",
    color: typeColor(move.type),
    visibility: CONST.REGION_VISIBILITY.ALWAYS,
    locked: false,
    shapes: [{
      type: "circle",
      x: center.x,
      y: center.y,
      radius: radiusGrids * gridSize,
      gridBased: true,
      hole: false
    }],
    flags: {
      [MODULE_ID]: {
        pokemonArea: true,
        moveId: move.id,
        moveName: move.name,
        type: move.type,
        sourceActorId: sourceActor.id,
        sourcePokemonInstanceId: sourceActor.getFlag(MODULE_ID, "pokemonInstanceId") ?? null,
        mode: payload.mode === "challenge" ? "challenge" : "player",
        radiusGrids,
        effects: effectsForMove(sourceActor, move)
      }
    }
  }]);

  if (!region) throw new Error("Não foi possível criar a Área Pokémon.");

  const tokenIds = [...(region.tokens ?? [])]
    .map(token => token.id)
    .filter(Boolean);

  // Region.tokens is the native v14 membership set. Fallback to the public
  // TokenDocument test for the rare case where membership has not refreshed yet.
  if (!tokenIds.length) {
    for (const token of scene.tokens) {
      try {
        if (token.testInsideRegion?.(region)) tokenIds.push(token.id);
      } catch {}
    }
  }

  await playAreaVfx(region, radiusGrids, move.type);

  Hooks.callAll("pokemonLitmAreaCreated", {
    region,
    sourceActor,
    move,
    tokenIds
  });

  return {
    regionId: region.id,
    tokenIds,
    moveId: move.id,
    type: move.type
  };
}

async function applyMoveDirect(payload) {
  if (!isAuthority()) throw new Error("Somente o GM ativo pode aplicar efeitos Pokémon.");

  const scene = game.scenes.get(payload.sceneId);
  const sourceActor = game.actors.get(payload.sourceActorId);
  const move = moveForActor(sourceActor, payload.moveId);
  if (!scene || !sourceActor || !move) {
    throw new Error("Pokémon ou golpe não encontrado.");
  }

  const maxRank = Math.max(0, Math.min(3, Number(payload.maxRank ?? 1)));
  const targetTokens = (payload.targetTokenIds ?? [])
    .map(id => scene.tokens.get(id))
    .filter(Boolean);

  const resolvedEffects = effectsForMove(sourceActor, move);
  const targetEffects = resolvedEffects.filter(effect =>
    String(effect?.target ?? "target").toLowerCase() !== "self"
  );
  const selfEffects = resolvedEffects.filter(effect =>
    String(effect?.target ?? "target").toLowerCase() === "self"
  );

  const report = [];

  if (maxRank > 0 && selfEffects.length) {
    const applied = await applyEffectsToActor(sourceActor, selfEffects, 1, maxRank);
    if (applied.length) report.push({ actorId: sourceActor.id, applied });
  }

  if (maxRank > 0) {
    for (const token of targetTokens) {
      const actor = token.actor;
      if (!actor) continue;
      const multiplier = multiplierFor(actor, move.type);
      const applied = await applyEffectsToActor(actor, targetEffects, multiplier, maxRank);
      report.push({
        actorId: actor.id,
        tokenId: token.id,
        multiplier,
        applied
      });
    }
  }

  game.socket.emit(SOCKET_NAME, {
    kind: "pokemon-fx-play",
    sceneId: scene.id,
    sourceTokenId: payload.sourceTokenId,
    targetTokenIds: targetTokens.map(token => token.id),
    type: move.type
  });

  Hooks.callAll("pokemonLitmMoveResolved", {
    sourceActor,
    move,
    targetTokens,
    maxRank,
    report
  });

  return { report };
}

async function deleteCombatProjectionDirect(payload) {
  if (!isAuthority()) throw new Error("Somente o GM ativo pode limpar Combat Actors.");

  const instanceId = String(payload.instanceId ?? "");
  if (!instanceId) return false;

  for (const scene of game.scenes) {
    const ids = scene.tokens
      .filter(token => token.getFlag(MODULE_ID, "pokemonInstanceId") === instanceId)
      .map(token => token.id);
    if (ids.length) await scene.deleteEmbeddedDocuments("Token", ids);
  }

  const actors = game.actors.filter(actor =>
    actor.getFlag(MODULE_ID, "combatProjection") === true
    && actor.getFlag(MODULE_ID, "pokemonInstanceId") === instanceId
  );

  for (const actor of actors) {
    await actor.delete();
  }

  return true;
}

function socketResponse(message) {
  const wait = pending.get(message.requestId);
  if (!wait || message.targetUserId !== game.user.id) return;

  pending.delete(message.requestId);
  clearTimeout(wait.timer);

  if (message.ok) wait.resolve(message.result ?? null);
  else wait.reject(new Error(message.error ?? "Falha na Combat Layer Pokémon."));
}

async function socketRequest(message) {
  if (message.authorityUserId !== game.user.id || !isAuthority()) return;

  try {
    let result;
    if (message.action === "create-area") result = await createAreaDirect(message.payload);
    else if (message.action === "apply-move") result = await applyMoveDirect(message.payload);
    else if (message.action === "delete-combat") result = await deleteCombatProjectionDirect(message.payload);
    else return;

    game.socket.emit(SOCKET_NAME, {
      kind: "pokemon-fx-response",
      requestId: message.requestId,
      targetUserId: message.requestUserId,
      ok: true,
      result
    });
  } catch (error) {
    console.error("Pokemon LITM Tools | Combat FX socket:", error);
    game.socket.emit(SOCKET_NAME, {
      kind: "pokemon-fx-response",
      requestId: message.requestId,
      targetUserId: message.requestUserId,
      ok: false,
      error: error?.message ?? String(error)
    });
  }
}

function onSocket(message) {
  if (!message || typeof message !== "object") return;

  if (message.kind === "pokemon-fx-response") {
    socketResponse(message);
    return;
  }

  if (message.kind === "pokemon-fx-request") {
    void socketRequest(message);
    return;
  }

  if (message.kind === "pokemon-fx-play") {
    void playMoveVfxLocal(
      message.sceneId,
      message.sourceTokenId,
      message.targetTokenIds,
      message.type
    );
  }
}

function requestAuthority(action, payload) {
  const gm = authorityGM();
  if (!gm) throw new Error("É necessário um GM conectado para a Combat Layer Pokémon.");

  if (gm.id === game.user.id) {
    if (action === "create-area") return createAreaDirect(payload);
    if (action === "apply-move") return applyMoveDirect(payload);
    if (action === "delete-combat") return deleteCombatProjectionDirect(payload);
  }

  const requestId = randomId();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error("O GM não respondeu à solicitação Pokémon."));
    }, 12000);

    pending.set(requestId, { resolve, reject, timer });

    game.socket.emit(SOCKET_NAME, {
      kind: "pokemon-fx-request",
      requestId,
      requestUserId: game.user.id,
      authorityUserId: gm.id,
      action,
      payload
    });
  });
}

function placementPoint(event) {
  const global = event?.global ?? event?.data?.global ?? null;
  try {
    if (global && canvas?.stage?.toLocal) return canvas.stage.toLocal(global);
  } catch {}

  try {
    if (event?.data?.getLocalPosition) return event.data.getLocalPosition(canvas.stage);
  } catch {}

  return global ?? { x: 0, y: 0 };
}

async function placeMoveArea(sourceActor, move, mode) {
  if (!canvas?.ready || !canvas?.stage || !canvas.scene) {
    throw new Error("O canvas não está pronto.");
  }

  const sourceToken = sourceTokenForActor(sourceActor);
  if (!sourceToken) {
    throw new Error("Coloque o Pokémon na cena antes de gerar a área.");
  }

  let radiusGrids = 2;
  const ghost = document.createElement("div");
  ghost.className = "pokemon-combat-area-ghost";
  ghost.style.setProperty("--pokemon-area-color", typeColor(move.type));
  document.body.appendChild(ghost);

  const redraw = event => {
    const scale = Number(canvas?.stage?.scale?.x ?? 1);
    const px = Math.max(48, radiusGrids * Number(canvas?.grid?.size ?? 100) * scale * 2);
    ghost.style.width = px + "px";
    ghost.style.height = px + "px";
    if (event) {
      ghost.style.left = event.clientX + "px";
      ghost.style.top = event.clientY + "px";
    }
  };

  redraw();

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("wheel", onWheel, true);
    canvas.stage.off?.("pointerdown", onStage);
    ghost.remove();
  };

  const onMove = event => redraw(event);

  const onWheel = event => {
    event.preventDefault();
    radiusGrids = Math.max(1, Math.min(6, radiusGrids + (event.deltaY < 0 ? 1 : -1)));
    redraw(event);
    ui.notifications.info("Área: raio " + radiusGrids + " quadrado(s).");
  };

  const onKey = event => {
    if (event.key !== "Escape") return;
    cleanup();
    ui.notifications.info("Criação de área cancelada.");
  };

  const onStage = async event => {
    const button = Number(event?.button ?? event?.data?.button ?? 0);
    if (button !== 0) return;

    const point = placementPoint(event);
    cleanup();

    try {
      const result = await requestAuthority("create-area", {
        sceneId: canvas.scene.id,
        sourceActorId: sourceActor.id,
        sourceTokenId: sourceToken.id,
        moveId: move.id,
        mode,
        radiusGrids,
        center: { x: Number(point.x ?? 0), y: Number(point.y ?? 0) }
      });

      const tokenIds = result?.tokenIds ?? [];
      canvas.tokens?.setTargets?.(new Set(tokenIds), { mode: "replace" });

      if (!tokenIds.length) {
        ui.notifications.info((move.name ?? move.id) + ": área criada sem alvos.");
        return;
      }

      if (mode === "challenge") {
        ui.notifications.info(
          (move.name ?? move.id) + ": " + tokenIds.length
          + " alvo(s) na área. Resolva a ameaça depois da reação dos jogadores."
        );
        return;
      }

      await resolveMove(sourceActor, move, tokenIds);
    } catch (error) {
      console.error("Pokemon LITM Tools | Área Pokémon:", error);
      ui.notifications.error(error?.message ?? "Não foi possível criar a Área Pokémon.");
    }
  };

  window.addEventListener("pointermove", onMove, true);
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("wheel", onWheel, { capture: true, passive: false });
  canvas.stage.on("pointerdown", onStage);

  ui.notifications.info(
    "Posicione a área de " + (move.name ?? move.id)
    + ". Roda do mouse muda o raio; Esc cancela."
  );
}

function targetDocuments(ids = null) {
  if (Array.isArray(ids)) {
    return ids
      .map(id => canvas?.scene?.tokens?.get(id))
      .filter(Boolean);
  }

  return Array.from(game.user?.targets ?? [])
    .map(token => token.document ?? token)
    .filter(Boolean);
}

function matchupSummary(move, targets) {
  if (!targets.length) return "<p>Nenhum alvo.</p>";

  return "<div class=\"pokemon-combat-matchups\">"
    + targets.map(token => {
      const actor = token.actor;
      const multiplier = multiplierFor(actor, move.type);
      return "<div><strong>" + esc(token.name ?? actor?.name ?? "Alvo")
        + "</strong><span>" + esc(matchupLabel(multiplier)) + "</span></div>";
    }).join("")
    + "</div>";
}

async function resolveMove(sourceActor, move, explicitTokenIds = null) {
  const sourceToken = sourceTokenForActor(sourceActor);
  if (!sourceToken) throw new Error("Token do Pokémon atacante não encontrado.");

  const selfTarget = ["self", "user", "users-field"].includes(String(move.target ?? "").toLowerCase());
  const targets = selfTarget
    ? [sourceToken]
    : targetDocuments(explicitTokenIds);

  if (!targets.length) {
    ui.notifications.warn("Marque um alvo com T ou use Área.");
    return;
  }

  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: String(move.name ?? move.id) + " · Resolver" },
    content:
      "<div class=\"pokemon-combat-resolve\">"
      + "<p><strong>" + esc(move.name ?? move.id) + "</strong> · "
      + esc(String(move.type ?? "normal")) + "</p>"
      + matchupSummary(move, targets)
      + "<p class=\"hint\">Escolha até que nível de consequência deve ser aplicado.</p>"
      + "</div>",
    buttons: [
      {
        action: "principal",
        label: "Principal",
        icon: "fa-solid fa-bolt"
      },
      {
        action: "forte",
        label: "Até Forte",
        icon: "fa-solid fa-burst"
      },
      {
        action: "extrema",
        label: "Até Extrema",
        icon: "fa-solid fa-explosion"
      },
      {
        action: "visual",
        label: "Só VFX",
        icon: "fa-solid fa-wand-magic-sparkles"
      }
    ],
    rejectClose: false,
    modal: true
  });

  if (!choice) return;

  const maxRank = choice === "visual"
    ? 0
    : choice === "extrema"
      ? 3
      : choice === "forte"
        ? 2
        : 1;

  await requestAuthority("apply-move", {
    sceneId: canvas.scene.id,
    sourceActorId: sourceActor.id,
    sourceTokenId: sourceToken.id,
    moveId: move.id,
    targetTokenIds: targets.map(token => token.id),
    maxRank
  });
}

async function openMoveAction(sourceActor, move) {
  const targets = targetDocuments();

  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: String(move.name ?? move.id) },
    content:
      "<div class=\"pokemon-combat-move-choice\">"
      + "<p><strong>" + esc(move.name ?? move.id) + "</strong></p>"
      + "<p>Tipo: " + esc(move.type ?? "normal") + "</p>"
      + (targets.length ? matchupSummary(move, targets) : "<p class=\"hint\">Nenhum alvo marcado.</p>")
      + "</div>",
    buttons: [
      {
        action: "use",
        label: "Usar golpe",
        icon: "fa-solid fa-bullseye"
      },
      {
        action: "area",
        label: "Gerar Área",
        icon: "fa-solid fa-circle-nodes"
      }
    ],
    rejectClose: false,
    modal: true
  });

  if (choice === "use") await resolveMove(sourceActor, move);
  else if (choice === "area") await placeMoveArea(sourceActor, move, "player");
}

async function recollectCombatToken(token) {
  const actor = token?.actor;
  const theme = sourceThemeForCombatActor(actor);
  if (!theme) throw new Error("Theme de origem deste Pokémon não foi encontrado.");

  if (getPokemonFollowerThemeId(theme.parent) === theme.id) {
    await setPokemonFollowerTheme(theme.parent, null);
  }

  await recollectPokemonTheme(theme);
}

function onRenderTokenHUD(hud, html) {
  const token = combatTokenFromHud(hud);
  if (!token || (!game.user.isGM && !token.isOwner)) return;

  const actor = token.actor;
  const moves = (actor?.getFlag(MODULE_ID, "moves") ?? []).slice(0, 4);
  const root = hudRoot(hud, html);
  if (!root || root.querySelector("[data-pokemon-combat-recollect]")) return;

  const column = root.querySelector(".col.right")
    ?? root.querySelector(".right")
    ?? root.querySelector("[data-column='right']")
    ?? root.querySelector(".controls-right")
    ?? root;

  const recollect = document.createElement("div");
  recollect.className = "control-icon pokemon-combat-hud-control";
  recollect.dataset.pokemonCombatRecollect = "true";
  recollect.title = "Recolher Pokémon";
  recollect.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i>';
  recollect.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    void recollectCombatToken(token).catch(error => {
      console.error("Pokemon LITM Tools | Recolher HUD:", error);
      ui.notifications.error(error?.message ?? "Não foi possível recolher o Pokémon.");
    });
  });
  column.append(recollect);

  for (const move of moves) {
    const control = document.createElement("div");
    control.className = "control-icon pokemon-combat-hud-control pokemon-combat-move-control";
    control.dataset.pokemonCombatMove = move.id;
    control.title = String(move.name ?? move.id) + " · usar ou gerar área";
    control.innerHTML =
      '<i class="fa-solid fa-bolt"></i>'
      + '<span class="pokemon-combat-move-letter">'
      + esc(String(move.name ?? move.id).slice(0, 2).toUpperCase())
      + "</span>";

    control.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      void openMoveAction(actor, move).catch(error => {
        console.error("Pokemon LITM Tools | Golpe HUD:", error);
        ui.notifications.error(error?.message ?? "Não foi possível usar o golpe.");
      });
    });

    column.append(control);
  }
}

export async function startPokemonChallengeMoveArea(actor, moveId) {
  if (!actor || actor.type !== "litm-npc") {
    throw new Error("Challenge Pokémon inválido.");
  }

  const move = moveForActor(actor, moveId);
  if (!move) throw new Error("Golpe não encontrado no Challenge.");

  await placeMoveArea(actor, move, "challenge");
}

export async function deletePokemonCombatProjection(instanceId) {
  if (!instanceId) return false;
  return requestAuthority("delete-combat", { instanceId });
}

async function onDeleteRegion(region) {
  if (region?.getFlag?.(MODULE_ID, "pokemonArea") !== true) return;
  if (!sequenceAvailable()) return;

  try {
    await globalThis.Sequencer?.EffectManager?.endEffects?.({
      name: "pokemon-area-" + region.id
    });
  } catch {}
}

export function activatePokemonCombatEffects() {
  if (activated) return;
  activated = true;

  game.socket.on(SOCKET_NAME, onSocket);
  Hooks.on("renderTokenHUD", onRenderTokenHUD);
  Hooks.on("deleteRegion", onDeleteRegion);
}
