import {
  getPokemonThemes,
  getPokemonFollowerThemeId,
  setPokemonFollowerTheme,
  removePokemonThemeTokens,
  withPokemonFollowerSuspended
} from "./pokemon-follower.js";

import {
  recollectPokemonTheme
} from "./pokemon-combat.js";

import {
  buildMoveEffects,
  loadPokemonMoveProfile,
  moveLitmProfile,
  effectivenessTierDelta,
  fetchPokeJson,
  pokemonGenusLabel,
  statPowerText,
  statWeaknessText
} from "./pokemon-content.js";

const MODULE_ID = "pokemon-litm-tools";
const SOCKET_NAME = "module." + MODULE_ID;
const pending = new Map();

const pendingPokemonReactions =
  new Map();

let activated = false;

let activePokemonRollApp =
  null;

const LITM_SYSTEM_ID =
  "mist-engine-fvtt";

const POKEMON_MOVE_AUTO_SOURCE =
  "pokemon-move-auto";

const POKEMON_REACTION_AUTO_SOURCE =
  "pokemon-reaction-auto";

const litmModulePromises =
  new Map();

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
  grass: ["jb2a.energy_beam", "jb2a.entangle"],
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

function moveIdentity(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}


function currentTagName(tag) {
  return String(
    tag?.name
    ?? tag?.label
    ?? ""
  ).trim();
}


function canonicalMoveFromTag(label) {
  const value = String(label ?? "").trim();
  const match = value.match(/\(([^()]+)\)\s*$/);
  const englishName = String(match?.[1] ?? "").trim();

  return {
    label: value,
    englishName,
    moveId: englishName ? moveIdentity(englishName) : null
  };
}


function movesFromPokemonItem(item) {
  const flags = item?.flags?.[MODULE_ID] ?? {};
  const cached = Array.isArray(flags.moves)
    ? flags.moves
    : [];
  const bindings = Array.isArray(flags.pokemonMoveBindings)
    ? flags.pokemonMoveBindings
    : Array.isArray(flags.tagBindings)
      ? flags.tagBindings
      : [];

  if (!bindings.length) return cached;

  const tags = Array.isArray(item?.system?.powertags)
    ? item.system.powertags
    : [];

  const rows = [];

  for (const binding of bindings) {
    if (binding?.kind !== "pokemonMove") continue;

    const index = Number(binding.tagIndex);
    const tag = Number.isInteger(index) ? tags[index] : null;
    const name = currentTagName(tag) || String(binding.tagName ?? "").trim();
    if (!name) continue;

    const parsed = canonicalMoveFromTag(name);
    const originalName = String(binding.tagName ?? "").trim();
    const changed = originalName
      ? moveIdentity(name) !== moveIdentity(originalName)
      : false;

    const id = parsed.moveId
      || (!changed ? String(binding.moveId ?? "").trim() : "");

    if (!id) {
      rows.push({
        id: "",
        name,
        englishName: "",
        type: "normal",
        effects: [],
        unresolved: true
      });
      continue;
    }

    const base = cached.find(move => move?.id === id)
      ?? cached.find(move => move?.id === binding.moveId)
      ?? {};

    rows.push({
      ...foundry.utils.deepClone(base),
      id,
      name,
      englishName: parsed.englishName || base.englishName || binding.englishName || "",
      type: base.type || binding.type || "normal",
      vfx: base.vfx || binding.vfx || ((base.type || binding.type || "normal") + "-move"),
      effects: foundry.utils.deepClone(base.effects || binding.effects || []),
      _needsEnrichment:
        !base.id
        || base.id !== id
        || !base.description
    });
  }

  return rows;
}


function dedupeMoves(rows) {
  const result = [];
  const seen = new Set();

  for (const move of rows ?? []) {
    const key = move?.id
      ? "id:" + move.id
      : "name:" + moveIdentity(move?.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(move);
  }

  return result;
}


function pokemonMovesForActor(actor) {
  if (!actor) return [];

  const itemMoves = [];
  let hasPlayerMoveTheme = false;

  for (const item of actor.items ?? []) {
    const role = item.getFlag?.(MODULE_ID, "themeRole")
      ?? item.flags?.[MODULE_ID]?.themeRole;
    if (role === "pokemon-moves") hasPlayerMoveTheme = true;

    const rows = movesFromPokemonItem(item);
    if (rows.length) itemMoves.push(...rows);
  }

  if (hasPlayerMoveTheme) {
    return dedupeMoves(itemMoves);
  }

  const collected = [...itemMoves];
  const direct = actor.getFlag?.(MODULE_ID, "moves");
  const characterMoves = actor.getFlag?.(MODULE_ID, "characterPokemonMoves");

  if (Array.isArray(direct)) collected.push(...direct);
  if (Array.isArray(characterMoves)) collected.push(...characterMoves);

  return dedupeMoves(collected);
}


const resolvedMoveCache = new Map();

async function enrichMoveForActor(actor, move) {
  if (!move?.id) return move;

  // Sempre resolve o perfil pelo ID canonico.
  // O cache abaixo evita requisicoes repetidas e impede
  // descricoes antigas de ficarem presas no Actor.
  const language = actor?.getFlag?.(MODULE_ID, "contentLanguage") ?? "pt-BR";
  const might = actor?.getFlag?.(MODULE_ID, "might") ?? "origin";
  const key = [move.id, language, might].join("|");

  if (!resolvedMoveCache.has(key)) {
    resolvedMoveCache.set(
      key,
      loadPokemonMoveProfile(
        move.id,
        { language, might }
      ).catch(error => {
        resolvedMoveCache.delete(key);
        console.warn("Pokemon LITM Tools | Move dinamico:", move.id, error);
        return null;
      })
    );
  }

  const detail = await resolvedMoveCache.get(key);
  if (!detail) return move;

  return {
    ...detail,
    ...move,
    type: detail.type ?? move.type ?? "normal",
    damageClass: detail.damageClass ?? move.damageClass,
    power: detail.power ?? move.power,
    accuracy: detail.accuracy ?? move.accuracy,
    pp: detail.pp ?? move.pp ?? 0,
    target: detail.target ?? move.target,
    description: detail.description ?? detail.shortDescription ?? move.description ?? "",
    pokemonDbUrl: detail.pokemonDbUrl ?? move.pokemonDbUrl,
    meta: foundry.utils.deepClone(detail.meta ?? move.meta ?? {}),
    statChanges: foundry.utils.deepClone(detail.statChanges ?? move.statChanges ?? []),
    effects: foundry.utils.deepClone(detail.effects ?? move.effects ?? []),
    _needsEnrichment: false
  };
}


async function resolvedPokemonMovesForActor(actor) {
  return Promise.all(
    pokemonMovesForActor(actor).map(move => enrichMoveForActor(actor, move))
  );
}


function moveForActor(actor, moveId) {
  return pokemonMovesForActor(actor)
    .find(move => move?.id === moveId)
    ?? null;
}


async function resolveMoveForActor(actor, moveId) {
  const move = moveForActor(actor, moveId);
  return move ? enrichMoveForActor(actor, move) : null;
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
  return multiplierForActorType(
    actor,
    moveType
  );
}

function matchupLabel(multiplier) {
  const value = Number(multiplier ?? 1);
  if (value === 0) return "Imune";
  if (value >= 4) return "Muito vulnerável";
  if (value > 1) return "Vulnerável";
  if (value > 0 && value <= 0.25) return "Muito resistente";
  if (value > 0 && value < 1) return "Resistente";
  return "Neutro";
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
    const delta = effectivenessTierDelta(multiplier);
    if (delta === null) return null;

    level += delta;

    if (level <= 0) {
      return null;
    }

    level = Math.min(6, level);
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
  if (!sequenceAvailable()) {
    return null;
  }

  const database =
    globalThis
      .Sequencer
      ?.Database;

  const entryExists =
    database
      ?.entryExists;

  for (
    const path
    of candidates
      ?? []
  ) {
    try {
      if (
        typeof entryExists
          === "function"
      ) {
        if (
          entryExists.call(
            database,
            path
          )
        ) {
          return path;
        }

        continue;
      }

      if (
        database
          ?.getEntry
          ?.(path, {
            softFail:
              true
          })
      ) {
        return path;
      }

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

function playPokemonScreenVfx(type) {
  document
    .querySelector(
      ".pokemon-type-screen-vfx"
    )
    ?.remove();

  const overlay =
    document.createElement(
      "div"
    );

  overlay.className =
    "pokemon-type-screen-vfx";

  overlay.style.setProperty(
    "--pokemon-vfx-color",
    typeColor(type)
  );

  document.body.appendChild(
    overlay
  );

  requestAnimationFrame(() => {
    overlay.classList.add(
      "active"
    );
  });

  setTimeout(() => {
    overlay.classList.remove(
      "active"
    );
  }, 360);

  setTimeout(() => {
    overlay.remove();
  }, 720);
}


function shakePokemonScreen() {
  const board =
    document.querySelector(
      "#board"
    )
    ??
    document.querySelector(
      "#board-container"
    );

  if (!board?.animate) return;

  try {
    board.animate(
      [
        { transform: "translate(0, 0)" },
        { transform: "translate(-3px, 1px)" },
        { transform: "translate(3px, -1px)" },
        { transform: "translate(-2px, 0)" },
        { transform: "translate(0, 0)" }
      ],
      {
        duration: 180,
        easing: "ease-out"
      }
    );
  } catch {}
}


async function playMoveVfxLocal(sceneId, sourceTokenId, targetTokenIds, type) {
  if (canvas?.scene?.id !== sceneId) return;

  playPokemonScreenVfx(type);

  const source =
    canvas.scene.tokens.get(
      sourceTokenId
    )
    ?? null;

  const targets =
    (targetTokenIds ?? [])
      .map(
        id =>
          canvas.scene.tokens.get(id)
      )
      .filter(Boolean);

  const selfOnly =
    !!source
    &&
    targets.length > 0
    &&
    targets.every(
      target =>
        target.id === source.id
    );

  if (!selfOnly) {
    shakePokemonScreen();
  }

  if (sequenceAvailable()) {
    const path =
      databasePath(
        JB2A_PATHS[type]
        ?? []
      );

    const externalTargets =
      targets.filter(
        target =>
          target.id
          !== source?.id
      );

    if (
      path
      &&
      source
      &&
      externalTargets.length
    ) {
      try {
        const seq =
          new Sequence({
            inModuleName:
              MODULE_ID,

            softFail:
              true
          });

        for (
          const target
          of externalTargets
        ) {
          seq.effect()
            .file(path)
            .atLocation(
              tokenObject(source)
              ?? source
            )
            .stretchTo(
              tokenObject(target)
              ?? target
            );
        }

        await seq.play();
        return;
      } catch (error) {
        console.warn(
          "Pokemon LITM Tools | Sequencer Move VFX:",
          error
        );
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

async function broadcastMoveVfx(
  sceneId,
  sourceTokenId,
  targetTokenIds,
  type
) {
  await playMoveVfxLocal(
    sceneId,
    sourceTokenId,
    targetTokenIds,
    type
  );

  game.socket.emit(
    SOCKET_NAME,
    {
      kind:
        "pokemon-fx-play",

      sourceUserId:
        game.user.id,

      sceneId,
      sourceTokenId,
      targetTokenIds,
      type
    }
  );
}


async function playMoveVfxAtPointLocal(
  sceneId,
  sourceTokenId,
  point,
  type
) {
  if (
    canvas?.scene?.id
      !== sceneId
  ) {
    return;
  }

  playPokemonScreenVfx(
    type
  );

  const source =
    canvas.scene.tokens.get(
      sourceTokenId
    )
    ?? null;

  const center = {
    x:
      Number(
        point?.x
        ?? 0
      ),

    y:
      Number(
        point?.y
        ?? 0
      )
  };

  if (
    sequenceAvailable()
  ) {
    const path =
      databasePath(
        JB2A_PATHS[type]
        ?? []
      );

    if (
      path
      &&
      source
    ) {
      try {
        const seq =
          new Sequence({
            inModuleName:
              MODULE_ID,

            softFail:
              true
          });

        seq.effect()
          .file(path)
          .atLocation(
            tokenObject(source)
            ?? source
          )
          .stretchTo(
            center
          );

        await seq.play();
        return;

      } catch (error) {
        console.warn(
          "Pokemon LITM Tools | Sequencer Area target:",
          error
        );
      }
    }

    try {
      const seq =
        new Sequence({
          inModuleName:
            MODULE_ID,

          softFail:
            true
        });

      seq.effect()
        .atLocation(center)
        .shape(
          "circle",
          {
            radius:
              0.9,

            gridUnits:
              true,

            fillColor:
              typeColor(type),

            fillAlpha:
              0.3,

            lineSize:
              5,

            lineColor:
              typeColor(type),

            name:
              "pokemon-area-impact"
          }
        )
        .fadeIn(70)
        .fadeOut(430)
        .scaleIn(
          0.45,
          160
        )
        .duration(650);

      await seq.play();
      return;

    } catch (error) {
      console.warn(
        "Pokemon LITM Tools | Sequencer Area impact fallback:",
        error
      );
    }
  }

  // Sem Sequencer a Region nativa continua sendo
  // a representacao visual da Area.
  if (source) {
    pulseToken(
      source,
      type
    );
  }
}


async function broadcastMoveVfxAtPoint(
  sceneId,
  sourceTokenId,
  point,
  type
) {
  game.socket.emit(
    SOCKET_NAME,
    {
      kind:
        "pokemon-fx-play-point",

      sourceUserId:
        game.user.id,

      sceneId,
      sourceTokenId,

      point: {
        x:
          Number(
            point?.x
            ?? 0
          ),

        y:
          Number(
            point?.y
            ?? 0
          )
      },

      type
    }
  );

  await playMoveVfxAtPointLocal(
    sceneId,
    sourceTokenId,
    point,
    type
  );
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
  const move = await resolveMoveForActor(sourceActor, payload.moveId);
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

  await broadcastMoveVfxAtPoint(
    scene.id,
    payload.sourceTokenId,
    center,
    move.type
  );

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
  const move = await resolveMoveForActor(sourceActor, payload.moveId);
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

  await broadcastMoveVfx(
    scene.id,
    payload.sourceTokenId,
    targetTokens.map(
      token => token.id
    ),
    move.type
  );

  Hooks.callAll("pokemonLitmMoveResolved", {
    sourceActor,
    move,
    targetTokens,
    maxRank,
    report
  });

  return { report };
}


async function applyMoveEffectDirect(payload) {
  if (!isAuthority()) {
    throw new Error("Somente o GM ativo pode aplicar efeitos Pokémon.");
  }

  const scene = game.scenes.get(payload.sceneId);
  const sourceActor = game.actors.get(payload.sourceActorId);
  const sourceToken = scene?.tokens?.get(payload.sourceTokenId) ?? null;
  const move = await resolveMoveForActor(sourceActor, payload.moveId);

  if (!scene || !sourceActor || !move) {
    throw new Error("Origem ou golpe nao encontrado.");
  }

  const effects = effectsForMove(sourceActor, move);
  const effectIndex = Number(payload.effectIndex);
  const effect = Number.isInteger(effectIndex)
    ? effects[effectIndex]
    : null;

  if (!effect) throw new Error("Efeito do golpe nao encontrado.");

  const targetKind = String(effect.target ?? "target").toLowerCase();
  if (targetKind === "scene") {
    return { sceneEffect: true, name: effect.name };
  }

  const report = [];

  if (targetKind === "self") {
    const targetActor = sourceToken?.actor ?? sourceActor;
    const applied = await applyEffectsToActor(targetActor, [effect], 1, 3);
    report.push({ actorId: targetActor.id, applied });
    return { report };
  }

  const targetTokens = (payload.targetTokenIds ?? [])
    .map(id => scene.tokens.get(id))
    .filter(Boolean);

  if (!targetTokens.length) {
    throw new Error("A rolagem nao possui alvo para este efeito.");
  }

  for (const token of targetTokens) {
    if (!token.actor) continue;
    const multiplier = multiplierFor(token.actor, move.type);
    const applied = await applyEffectsToActor(token.actor, [effect], multiplier, 3);
    report.push({
      actorId: token.actor.id,
      tokenId: token.id,
      multiplier,
      applied
    });
  }

  return { report };
}




function floatingEffectIdentity(
  entry
) {
  return {
    name:
      String(
        entry?.name
        ?? ""
      )
        .trim()
        .toLocaleLowerCase(),

    isStatus:
      entry?.isStatus === true
      ||
      Number(
        entry?.value
        ?? 0
      ) > 0,

    positive:
      entry?.positive
        !== false
  };
}


function sameFloatingEffectIdentity(
  entry,
  identity
) {
  if (
    !entry
    ||
    !identity
  ) {
    return false;
  }

  const current =
    floatingEffectIdentity(
      entry
    );

  return (
    current.name
      === identity.name
    &&
    current.isStatus
      === identity.isStatus
    &&
    current.positive
      === identity.positive
  );
}


function matchingFloatingEffects(
  list,
  identity
) {
  return foundry.utils.deepClone(
    (
      Array.isArray(list)
        ? list
        : []
    ).filter(
      entry =>
        sameFloatingEffectIdentity(
          entry,
          identity
        )
    )
  );
}


function restoreMatchingFloatingEffects(
  list,
  identity,
  replacement
) {
  const current =
    foundry.utils.deepClone(
      Array.isArray(list)
        ? list
        : []
    );

  let insertAt =
    current.length;

  for (
    let index = 0;
    index < current.length;
    index++
  ) {
    if (
      sameFloatingEffectIdentity(
        current[index],
        identity
      )
    ) {
      insertAt =
        current
          .slice(
            0,
            index
          )
          .filter(
            entry =>
              !sameFloatingEffectIdentity(
                entry,
                identity
              )
          )
          .length;

      break;
    }
  }

  const kept =
    current.filter(
      entry =>
        !sameFloatingEffectIdentity(
          entry,
          identity
        )
    );

  kept.splice(
    Math.min(
      insertAt,
      kept.length
    ),
    0,
    ...foundry.utils.deepClone(
      replacement
      ?? []
    )
  );

  return kept;
}


async function applyExplicitEffectToActor(
  actor,
  effect,
  multiplier,
  tokenId = null
) {
  const beforeList =
    foundry.utils.deepClone(
      actor?.system
        ?.floatingTagsAndStatuses
      ?? []
    );

  const preview =
    statusEntry(
      effect,
      multiplier
    );

  const identity =
    preview
      ? floatingEffectIdentity(
          preview
        )
      : null;

  const before =
    identity
      ? matchingFloatingEffects(
          beforeList,
          identity
        )
      : [];

  const applied =
    await applyEffectsToActor(
      actor,
      [effect],
      multiplier,
      3
    );

  const afterList =
    foundry.utils.deepClone(
      actor?.system
        ?.floatingTagsAndStatuses
      ?? []
    );

  const after =
    identity
      ? matchingFloatingEffects(
          afterList,
          identity
        )
      : [];

  return {
    actorId:
      actor.id,

    tokenId,

    applied,

    undo:
      identity
        ? {
            identity,
            before,
            after
          }
        : null
  };
}


async function applyExplicitEffectDirect(
  payload
) {
  if (!isAuthority()) {
    throw new Error(
      "Somente o GM ativo pode aplicar efeitos Pokémon."
    );
  }

  const scene =
    game.scenes.get(
      payload.sceneId
    );

  const sourceActor =
    game.actors.get(
      payload.sourceActorId
    );

  const sourceToken =
    scene?.tokens?.get(
      payload.sourceTokenId
    )
    ?? null;

  const move =
    await resolveMoveForActor(
      sourceActor,
      payload.moveId
    );

  if (
    !scene
    ||
    !sourceActor
    ||
    !move
  ) {
    throw new Error(
      "Origem ou golpe não encontrado."
    );
  }

  const effect =
    foundry.utils.deepClone(
      payload.effect
      ?? {}
    );

  if (!effect?.name) {
    throw new Error(
      "Efeito inválido."
    );
  }

  effect.level =
    Math.max(
      1,
      Math.min(
        6,
        Number(
          effect.level
          ?? 1
        )
      )
    );

  const targetKind =
    String(
      effect.target
      ?? "target"
    ).toLocaleLowerCase();

  if (
    targetKind === "scene"
  ) {
    return {
      sceneEffect:
        true
    };
  }

  if (
    targetKind === "self"
  ) {
    const actor =
      sourceToken?.actor
      ?? sourceActor;

    return {
      report: [
        await applyExplicitEffectToActor(
          actor,
          effect,
          1,
          sourceToken?.id
          ?? null
        )
      ]
    };
  }

  const targets =
    (
      payload.targetTokenIds
      ?? []
    )
      .map(
        id =>
          scene.tokens.get(id)
      )
      .filter(Boolean);

  if (!targets.length) {
    throw new Error(
      "Nenhum alvo disponível."
    );
  }

  const report = [];

  for (
    const token
    of targets
  ) {
    if (!token.actor) {
      continue;
    }

    const multiplier =
      effect.source === "damage"
        ? multiplierFor(
            token.actor,
            move.type
          )
        : 1;

    report.push(
      await applyExplicitEffectToActor(
        token.actor,
        effect,
        multiplier,
        token.id
      )
    );
  }

  return {
    report
  };
}


async function undoExplicitEffectDirect(
  payload
) {
  if (!isAuthority()) {
    throw new Error(
      "Somente o GM ativo pode desfazer efeitos Pokémon."
    );
  }

  const scene =
    game.scenes.get(
      payload.sceneId
    );

  const report =
    Array.isArray(
      payload?.application
        ?.report
    )
      ? payload.application.report
      : [];

  if (!report.length) {
    throw new Error(
      "Esta aplicação não possui dados para desfazer."
    );
  }

  const planned = [];

  for (
    const row
    of report
  ) {
    if (!row?.undo?.identity) {
      continue;
    }

    const actor =
      game.actors.get(
        row.actorId
      )
      ??
      scene?.tokens?.get(
        row.tokenId
      )?.actor
      ??
      null;

    if (!actor) {
      throw new Error(
        "O alvo original do efeito não foi encontrado."
      );
    }

    const current =
      foundry.utils.deepClone(
        actor.system
          ?.floatingTagsAndStatuses
        ?? []
      );

    const currentMatching =
      matchingFloatingEffects(
        current,
        row.undo.identity
      );

    if (
      JSON.stringify(
        currentMatching
      )
      !==
      JSON.stringify(
        row.undo.after
        ?? []
      )
    ) {
      throw new Error(
        (
          actor.name
          ?? "O alvo"
        )
        + " teve este mesmo Status/Tag alterado depois da aplicação. "
        + "O undo foi bloqueado para não apagar uma alteração posterior."
      );
    }

    planned.push({
      actor,

      list:
        restoreMatchingFloatingEffects(
          current,
          row.undo.identity,
          row.undo.before
            ?? []
        )
    });
  }

  for (
    const update
    of planned
  ) {
    await update.actor.update({
      "system.floatingTagsAndStatuses":
        update.list
    });
  }

  return {
    undone:
      true
  };
}


async function deletePokemonInstanceDocuments(instanceId) {
  const id = String(instanceId ?? "");
  if (!id) return false;

  for (const scene of game.scenes) {
    const ids = scene.tokens
      .filter(token =>
        token.getFlag(MODULE_ID, "pokemonInstanceId") === id
      )
      .map(token => token.id);

    if (ids.length) {
      await scene.deleteEmbeddedDocuments(
        "Token",
        ids,
        { pokemonFollowerSync: true }
      );
    }
  }

  const actors = game.actors.filter(actor =>
    actor.getFlag(MODULE_ID, "combatProjection") === true
    && actor.getFlag(MODULE_ID, "pokemonInstanceId") === id
  );

  for (const actor of actors) {
    await actor.delete();
  }

  return true;
}

async function cleanupPokemonInstanceDirect(payload) {
  if (!isAuthority()) {
    throw new Error("Somente o GM ativo pode limpar Pokémon.");
  }

  const trainer = game.actors.get(payload.trainerActorId);
  const themeId = String(payload.themeId ?? "");
  const instanceId = String(payload.instanceId ?? "");

  if (!trainer || !instanceId) {
    throw new Error("Treinador ou Pokémon não encontrado.");
  }

  return withPokemonFollowerSuspended(
    trainer,
    async () => {
      if (
        themeId
        && getPokemonFollowerThemeId(trainer) === themeId
      ) {
        await setPokemonFollowerTheme(trainer, null);
      }

      if (themeId) {
        await removePokemonThemeTokens(
          trainer,
          themeId
        );
      }

      await deletePokemonInstanceDocuments(
        instanceId
      );

      return true;
    }
  );
}

async function deleteCombatProjectionDirect(payload) {
  if (!isAuthority()) {
    throw new Error("Somente o GM ativo pode limpar Combat Actors.");
  }

  return deletePokemonInstanceDocuments(
    payload.instanceId
  );
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
    else if (message.action === "apply-effect") result = await applyMoveEffectDirect(message.payload);
    else if (message.action === "apply-explicit") result = await applyExplicitEffectDirect(message.payload);
    else if (message.action === "undo-explicit") result = await undoExplicitEffectDirect(message.payload);
    else if (message.action === "delete-combat") result = await deleteCombatProjectionDirect(message.payload);
    else if (message.action === "cleanup-instance") result = await cleanupPokemonInstanceDirect(message.payload);
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

  if (
    message.kind
      === "pokemon-reaction-offer"
  ) {
    if (
      message.targetUserId
        !== game.user.id
    ) {
      return;
    }

    void openNativePokemonReaction(
      message.reaction
    ).catch(
      error => {
        console.error(
          "Pokemon LITM Tools | Reaction:",
          error
        );

        ui.notifications.error(
          error?.message
          ?? "Não foi possível abrir a Reaction Roll."
        );
      }
    );

    return;
  }

  if (message.kind === "pokemon-fx-play-point") {
    if (
      message.sourceUserId
        === game.user.id
    ) {
      return;
    }

    void playMoveVfxAtPointLocal(
      message.sceneId,
      message.sourceTokenId,
      message.point,
      message.type
    );

    return;
  }

  if (message.kind === "pokemon-fx-play") {
    if (
      message.sourceUserId
      ===
      game.user.id
    ) {
      return;
    }

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
    if (action === "apply-effect") return applyMoveEffectDirect(payload);
    if (action === "apply-explicit") return applyExplicitEffectDirect(payload);
    if (action === "undo-explicit") return undoExplicitEffectDirect(payload);
    if (action === "delete-combat") return deleteCombatProjectionDirect(payload);
    if (action === "cleanup-instance") return cleanupPokemonInstanceDirect(payload);
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

async function placeMoveArea(sourceActor, move, mode, sourceTokenOverride = null) {
  if (!canvas?.ready || !canvas?.stage || !canvas.scene) {
    throw new Error("O canvas não está pronto.");
  }

  const sourceToken = sourceTokenOverride ?? sourceTokenForActor(sourceActor);
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

      const tokenIds =
        result?.tokenIds
        ?? [];

      ui.notifications.info(
        (move.name ?? move.id)
        + ": area criada como referencia visual"
        + (
          tokenIds.length
            ? " · "
              + tokenIds.length
              + " token(s) dentro."
            : " · nenhum token dentro."
        )
      );
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


function litmSystemRoute(
  relativePath
) {
  const raw =
    "systems/"
    + LITM_SYSTEM_ID
    + "/"
    + relativePath;

  try {
    return (
      foundry.utils.getRoute
        ?.(
          raw
        )
      ??
      (
        "/"
        + raw
      )
    );

  } catch {
    return (
      "/"
      + raw
    );
  }
}


function importLitmModule(
  relativePath
) {
  if (
    !litmModulePromises.has(
      relativePath
    )
  ) {
    litmModulePromises.set(
      relativePath,
      import(
        litmSystemRoute(
          relativePath
        )
      )
    );
  }

  return litmModulePromises.get(
    relativePath
  );
}


function pokemonBaseStats(
  actor
) {
  const direct =
    actor?.getFlag?.(
      MODULE_ID,
      "baseStats"
    );

  if (
    direct
    &&
    typeof direct
      === "object"
  ) {
    return direct;
  }

  const profile =
    actor?.getFlag?.(
      MODULE_ID,
      "characterPokemonProfile"
    );

  return (
    profile?.baseStats
    &&
    typeof profile.baseStats
      === "object"
  )
    ? profile.baseStats
    : null;
}


function pokemonTypeEffectiveness(
  actor
) {
  const direct =
    actor?.getFlag?.(
      MODULE_ID,
      "typeEffectiveness"
    );

  if (
    direct
    &&
    typeof direct
      === "object"
    &&
    Object.keys(direct).length
  ) {
    return direct;
  }

  const profile =
    actor?.getFlag?.(
      MODULE_ID,
      "characterPokemonProfile"
    );

  return (
    profile?.typeEffectiveness
    &&
    typeof profile
      .typeEffectiveness
      === "object"
  )
    ? profile.typeEffectiveness
    : {};
}


function multiplierForActorType(
  actor,
  type
) {
  const value =
    Number(
      pokemonTypeEffectiveness(
        actor
      )?.[
        type
      ]
    );

  return Number.isFinite(value)
    ? value
    : 1;
}



function activeTargetStatRows(actor) {
  if (!actor) {
    return [];
  }

  const rows = [];

  const add = (
    tag,
    source
  ) => {
    if (
      !tag
      || tag.burned === true
      || tag.expired === true
      || tag.planned === true
    ) {
      return;
    }

    const name =
      currentTagName(
        tag
      );

    if (!name) {
      return;
    }

    const isStatus =
      tag.isStatus === true
      ||
      Number(
        tag.value
        ?? 0
      ) > 0;

    rows.push({
      name,
      source,

      value:
        isStatus
          ? Math.max(
              1,
              Math.min(
                6,
                Number(
                  tag.value
                  ?? 1
                ) || 1
              )
            )
          : 1
    });
  };

  for (
    const tag
    of actor.system
      ?.floatingTagsAndStatuses
      ?? []
  ) {
    add(
      tag,
      "floating"
    );
  }

  const pokemonActor =
    actor?.getFlag?.(
      MODULE_ID,
      "kind"
    ) === "pokemon";

  const combatProjection =
    actor?.getFlag?.(
      MODULE_ID,
      "combatProjection"
    ) === true;

  /*
   * Um treinador pode possuir vários Themes Pokémon.
   * Esses Themes não podem defender o próprio treinador
   * automaticamente só porque estão na ficha dele.
   */
  const items =
    Array.from(
      actor.items
      ?? []
    ).filter(
      item =>
        pokemonActor
        ||
        combatProjection
        ||
        item.getFlag?.(
          MODULE_ID,
          "pokemonTheme"
        ) !== true
    );

  const sourceTheme =
    sourceThemeForCombatActor(
      actor
    );

  if (
    sourceTheme
    &&
    !items.some(
      item =>
        item.id
          === sourceTheme.id
    )
  ) {
    items.push(
      sourceTheme
    );
  }

  for (
    const item
    of items
  ) {
    for (
      const tag
      of item.system?.powertags
        ?? []
    ) {
      add(
        tag,
        "power-tag"
      );
    }

    for (
      const tag
      of item.system?.weaknesstags
        ?? []
    ) {
      add(
        tag,
        "weakness-tag"
      );
    }
  }

  return rows;
}


function targetStatTagValue(
  rows,
  name
) {
  const id =
    moveIdentity(
      name
    );

  return Math.max(
    0,

    ...(
      rows
      ?? []
    )
      .filter(
        row =>
          moveIdentity(
            row?.name
          ) === id
      )
      .map(
        row =>
          Number(
            row?.value
            ?? 1
          ) || 1
      )
  );
}


function defensiveContextForMove(
  move,
  actor
) {
  const damageClass =
    String(
      move?.damageClass
      ?? ""
    ).toLocaleLowerCase();

  const stat =
    damageClass === "physical"
      ? "defense"
      : damageClass === "special"
        ? "special-defense"
        : null;

  /*
   * Moves de Efeito não recebem Defense/Sp. Defense por padrão.
   * A oposição deles será resolvida por Tags ficcionalmente
   * relevantes numa etapa posterior da reforma.
   */
  if (!stat) {
    return null;
  }

  const sourceTheme =
    sourceThemeForCombatActor(
      actor
    );

  const language =
    actor?.getFlag?.(
      MODULE_ID,
      "contentLanguage"
    )
    ??
    sourceTheme?.getFlag?.(
      MODULE_ID,
      "contentLanguage"
    )
    ??
    "pt-BR";

  const strongName =
    statPowerText(
      stat,
      language
    );

  const weakName =
    statWeaknessText(
      stat,
      language
    );

  const rows =
    activeTargetStatRows(
      actor
    );

  const strongValue =
    targetStatTagValue(
      rows,
      strongName
    );

  const weakValue =
    targetStatTagValue(
      rows,
      weakName
    );

  /*
   * A Tag é a representação LitM do Stat.
   * Nunca somamos Base Stat + Tag correspondente.
   */
  if (
    strongValue
    ||
    weakValue
  ) {
    const modifier =
      weakValue
      - strongValue;

    if (!modifier) {
      return null;
    }

    return {
      stat,
      modifier,

      value:
        Math.abs(
          modifier
        ),

      positive:
        modifier > 0,

      name:
        modifier < 0
          ? strongName
          : weakName,

      source:
        "tag"
    };
  }

  /*
   * Fallback para Actors antigos que ainda não possuem
   * as Tags derivadas dos Stats.
   */
  const raw =
    Number(
      pokemonBaseStats(
        actor
      )?.[
        stat
      ]
      ?? 0
    );

  if (raw >= 90) {
    return {
      stat,

      modifier:
        -1,

      value:
        1,

      positive:
        false,

      name:
        strongName,

      source:
        "stat-fallback",

      raw
    };
  }

  if (
    raw > 0
    &&
    raw <= 45
  ) {
    return {
      stat,

      modifier:
        1,

      value:
        1,

      positive:
        true,

      name:
        weakName,

      source:
        "stat-fallback",

      raw
    };
  }

  return null;
}


function defensiveContextForTargets(
  move,
  targets
) {
  const rows =
    (
      targets
      ?? []
    ).map(
      token => {
        const context =
          defensiveContextForMove(
            move,
            token?.actor
          );

        return {
          token,
          context,

          modifier:
            Number(
              context?.modifier
              ?? 0
            )
        };
      }
    );

  if (!rows.length) {
    return null;
  }

  /*
   * Uma única rolagem com vários targets usa o alvo
   * mais difícil. As defesas nunca são somadas.
   *
   * Se todos forem vulneráveis, a menor vantagem comum
   * pode entrar como bônus.
   */
  const modifier =
    Math.min(
      ...rows.map(
        row =>
          row.modifier
      )
    );

  if (!modifier) {
    return null;
  }

  const chosen =
    rows.find(
      row =>
        row.modifier
          === modifier
    )
    ??
    rows[0];

  const targetName =
    chosen.token?.name
    ??
    chosen.token?.actor?.name
    ??
    "Alvo";

  const contextName =
    chosen.context?.name
    ??
    "Defesa do alvo";

  return {
    modifier,

    value:
      Math.abs(
        modifier
      ),

    positive:
      modifier > 0,

    name:
      rows.length === 1
        ? (
            targetName
            + " · "
            + contextName
          )
        : modifier < 0
          ? (
              "Alvo mais resistente: "
              + targetName
              + " · "
              + contextName
            )
          : (
              "Fraqueza defensiva comum: "
              + contextName
            ),

    targetId:
      chosen.token?.id
      ?? null
  };
}


function priorityReactionContext(
  move
) {
  const priority =
    Number(
      move?.priority
      ?? 0
    );

  if (priority > 0) {
    return {
      modifier:
        -1,

      name:
        "Golpe prioritário"
    };
  }

  if (priority < 0) {
    return {
      modifier:
        1,

      name:
        "Golpe lento"
    };
  }

  return null;
}


function selectedMoveBindingsForActor(
  actor
) {
  const result = [];

  for (
    const item
    of actor?.items
      ?? []
  ) {
    const flags =
      item.flags?.[
        MODULE_ID
      ]
      ?? {};

    const bindings =
      Array.isArray(
        flags.pokemonMoveBindings
      )
        ? flags.pokemonMoveBindings
        : Array.isArray(
            flags.tagBindings
          )
          ? flags.tagBindings
          : [];

    const tags =
      Array.isArray(
        item.system?.powertags
      )
        ? item.system.powertags
        : [];

    for (
      const binding
      of bindings
    ) {
      if (
        binding?.kind
          !== "pokemonMove"
      ) {
        continue;
      }

      const index =
        Number(
          binding.tagIndex
        );

      if (
        !Number.isInteger(index)
      ) {
        continue;
      }

      const tag =
        tags[index];

      if (
        tag?.selected
          !== true
      ) {
        continue;
      }

      const move =
        movesFromPokemonItem(
          item
        ).find(
          row =>
            row?.id
              === binding.moveId
        );

      if (!move) {
        continue;
      }

      result.push({
        item,
        tag,
        binding,
        move
      });
    }
  }

  return result;
}


function selectedMoveFromActorState(
  actor
) {
  const rows =
    selectedMoveBindingsForActor(
      actor
    );

  return rows.length === 1
    ? rows[0].move
    : null;
}


function stripPokemonSyntheticRollTags(
  app
) {
  app.selectedTags =
    (
      app.selectedTags
      ?? []
    ).filter(
      tag =>
        ![
          POKEMON_MOVE_AUTO_SOURCE,
          POKEMON_REACTION_AUTO_SOURCE
        ].includes(
          tag?.source
        )
    );
}


function pushSyntheticRollStatus(
  app,
  {
    name,
    value,
    positive,
    source
  }
) {
  const level =
    Math.max(
      1,
      Math.min(
        6,
        Number(
          value
          ?? 1
        )
      )
    );

  app.selectedTags.push({
    name,

    positive:
      positive === true,

    source,

    value:
      level,

    isStatus:
      true,

    isClickable:
      false
  });
}


function createMechanicBadge(
  value
) {
  const element =
    document.createElement(
      "span"
    );

  element.className =
    "pokemon-litm-mechanic-badge";

  element.textContent =
    String(
      value
      ?? ""
    );

  return element;
}


function pokemonMoveMechanicsElement(
  move
) {
  const mechanics =
    moveLitmProfile(
      move
    );

  const element =
    document.createElement(
      "div"
    );

  element.className =
    "pokemon-litm-mechanic-badges";

  for (
    const badge
    of mechanics.badges
  ) {
    element.append(
      createMechanicBadge(
        badge
      )
    );
  }

  return element;
}


function renderPokemonRollPackage(
  app,
  root,
  {
    move,
    reaction = null,
    targets = []
  }
) {
  root.querySelector(
    "[data-pokemon-roll-package]"
  )?.remove();

  const section =
    document.createElement(
      "section"
    );

  section.className =
    "pokemon-litm-roll-package";

  section.dataset
    .pokemonRollPackage =
      "true";

  const heading =
    document.createElement(
      "div"
    );

  heading.className =
    "pokemon-litm-roll-package-title";

  heading.innerHTML =
    '<i class="fa-solid fa-bolt"></i> <strong>'
    + esc(
        reaction
          ? (
              "Reação a "
              + (
                  reaction.moveName
                  ?? "golpe"
                )
            )
          : (
              move?.name
              ?? move?.id
              ?? "Golpe"
            )
      )
    + "</strong>";

  section.append(
    heading
  );

  const mechanics =
    moveLitmProfile(
      move
      ?? reaction?.move
      ?? {}
    );

  const badges =
    document.createElement(
      "div"
    );

  badges.className =
    "pokemon-litm-mechanic-badges";

  for (
    const badge
    of mechanics.badges
  ) {
    badges.append(
      createMechanicBadge(
        badge
      )
    );
  }

  if (reaction) {
    badges.append(
      createMechanicBadge(
        "Consequência "
        + reaction.effectName
        + "-"
        + reaction.proposedLevel
      )
    );

    if (
      reaction.multiplierLabel
    ) {
      badges.append(
        createMechanicBadge(
          reaction.multiplierLabel
        )
      );
    }

  } else {
    for (
      const target
      of targets
    ) {
      const multiplier =
        multiplierForActorType(
          target.actor,
          move?.type
            ?? "normal"
        );

      badges.append(
        createMechanicBadge(
          (
            target.name
            ?? target.actor?.name
            ?? "Alvo"
          )
          + ": "
          + matchupLabel(
              multiplier
            )
        )
      );
    }
  }

  section.append(
    badges
  );

  const automatic =
    (
      app.selectedTags
      ?? []
    ).filter(
      tag =>
        [
          POKEMON_MOVE_AUTO_SOURCE,
          POKEMON_REACTION_AUTO_SOURCE
        ].includes(
          tag?.source
        )
    );

  if (automatic.length) {
    const label =
      document.createElement(
        "small"
      );

    label.textContent =
      "Aplicado automaticamente à rolagem";

    section.append(
      label
    );

    const list =
      document.createElement(
        "div"
      );

    list.className =
      "pokemon-litm-roll-auto-tags";

    for (
      const tag
      of automatic
    ) {
      const row =
        document.createElement(
          "div"
        );

      row.className =
        "tag "
        + (
            tag.positive
              ? "positive"
              : "negative"
          );

      row.textContent =
        (
          tag.positive
            ? "+"
            : "-"
        )
        + Number(
            tag.value
            ?? 1
          )
        + " "
        + tag.name;

      list.append(
        row
      );
    }

    section.append(
      list
    );
  }

  const firstGroup =
    root.querySelector(
      ".form-group"
    );

  if (firstGroup) {
    firstGroup.before(
      section
    );

  } else {
    root.prepend(
      section
    );
  }

  const powerLabel =
    root.querySelector(
      ".power-label"
    );

  if (
    powerLabel
    &&
    typeof app.computePowerAmount
      === "function"
  ) {
    powerLabel.textContent =
      "Power: "
      + app.computePowerAmount();
  }
}


function isLitmDiceRollApp(
  app
) {
  return (
    !!app
    &&
    [
      "quick",
      "detailed",
      "reaction"
    ].includes(
      app.rollType
    )
    &&
    Array.isArray(
      app.selectedTags
    )
    &&
    typeof app.computePowerAmount
      === "function"
  );
}


function decoratePokemonRollDialog(
  app,
  root
) {
  if (
    !isLitmDiceRollApp(app)
    ||
    !root
  ) {
    return;
  }

  activePokemonRollApp =
    app;

  stripPokemonSyntheticRollTags(
    app
  );

  const actor =
    app.actor;

  if (!actor) {
    return;
  }

  if (
    app.rollType
      === "reaction"
  ) {
    const reaction =
      pendingPokemonReactions.get(
        actor.id
      );

    if (!reaction) {
      return;
    }

    const reactionModifiers = [
      {
        name:
          reaction.defenseName,

        modifier:
          Number(
            reaction.defenseModifier
            ?? 0
          )
      },

      {
        name:
          reaction.priorityName,

        modifier:
          Number(
            reaction.priorityModifier
            ?? 0
          )
      }
    ];

    for (
      const entry
      of reactionModifiers
    ) {
      if (
        !entry.name
        ||
        !entry.modifier
      ) {
        continue;
      }

      pushSyntheticRollStatus(
        app,
        {
          name:
            entry.name,

          value:
            Math.abs(
              entry.modifier
            ),

          positive:
            entry.modifier > 0,

          source:
            POKEMON_REACTION_AUTO_SOURCE
        }
      );
    }

    renderPokemonRollPackage(
      app,
      root,
      {
        move:
          reaction.move,

        reaction
      }
    );

    return;
  }

  const move =
    selectedMoveFromActorState(
      actor
    );

  if (!move) {
    root.querySelector(
      "[data-pokemon-roll-package]"
    )?.remove();

    return;
  }

  const targets =
    targetDocuments();

  const defense =
    defensiveContextForTargets(
      move,
      targets
    );

  if (
    defense?.modifier
  ) {
    pushSyntheticRollStatus(
      app,
      {
        name:
          defense.name,

        value:
          defense.value,

        positive:
          defense.positive,

        source:
          POKEMON_MOVE_AUTO_SOURCE
      }
    );
  }

  renderPokemonRollPackage(
    app,
    root,
    {
      move,
      targets
    }
  );
}


async function openNativePokemonReaction(
  reaction
) {
  const actor =
    game.actors.get(
      reaction.targetActorId
    );

  if (!actor) {
    throw new Error(
      "Actor da Reaction não encontrado."
    );
  }

  pendingPokemonReactions.set(
    actor.id,
    reaction
  );

  setTimeout(
    () => {
      if (
        pendingPokemonReactions.get(
          actor.id
        )?.reactionId
          === reaction.reactionId
      ) {
        pendingPokemonReactions.delete(
          actor.id
        );
      }
    },
    180000
  );

  const module =
    await importLitmModule(
      "module/apps/dice-roll-app.mjs"
    );

  const DiceRollApp =
    module.DiceRollApp;

  if (
    !DiceRollApp
      ?.getInstance
  ) {
    throw new Error(
      "Reaction Roll nativa do LitM não encontrada."
    );
  }

  const app =
    DiceRollApp.getInstance({
      actor,
      type:
        "reaction"
    });

  app.updateTagsAndStatuses();

  app.render(
    true,
    {
      focus:
        true
    }
  );

  ui.notifications.info(
    "Reaja a "
    + reaction.moveName
    + ": "
    + reaction.effectName
    + "-"
    + reaction.proposedLevel
  );
}


function reactionUserForActor(
  actor
) {
  return (
    game.users.find(
      user =>
        user.active
        &&
        !user.isGM
        &&
        actor.testUserPermission?.(
          user,
          "OWNER"
        )
    )
    ??
    (
      actor.isOwner
        ? game.user
        : authorityGM()
    )
  );
}


async function offerChallengeReaction(
  sourceActor,
  move,
  effect
) {
  if (!game.user.isGM) {
    return;
  }

  const targets =
    targetDocuments();

  if (
    targets.length !== 1
  ) {
    throw new Error(
      "Marque exatamente um alvo para a Reaction Roll."
    );
  }

  const target =
    targets[0];

  const targetActor =
    target.actor;

  if (!targetActor) {
    throw new Error(
      "O alvo não possui Actor."
    );
  }

  if (
    targetActor.type
      !== "litm-character"
  ) {
    ui.notifications.info(
      "O alvo não é um personagem LitM. Resolva a consequência normalmente."
    );

    return;
  }

  const sourceToken =
    sourceTokenForActor(
      sourceActor
    );

  if (!sourceToken) {
    throw new Error(
      "Token do Challenge não encontrado."
    );
  }

  const mechanics =
    moveLitmProfile(
      move
    );

  const originalLevel =
    Math.max(
      1,
      Math.min(
        6,
        Number(
          effect?.level
          ?? 1
        )
      )
    );

  let proposedLevel =
    originalLevel;

  let multiplier =
    1;

  if (
    String(
      effect?.source
      ?? ""
    ) === "damage"
  ) {
    multiplier =
      multiplierForActorType(
        targetActor,
        move.type
          ?? "normal"
      );

    const delta =
      effectivenessTierDelta(
        multiplier
      );

    if (
      delta === null
    ) {
      ui.notifications.info(
        (
          target.name
          ?? targetActor.name
        )
        + " é imune ao dano deste golpe."
      );

      return;
    }

    const adjustedLevel =
      originalLevel
      + delta;

    if (adjustedLevel <= 0) {
      ui.notifications.info(
        (
          target.name
          ?? targetActor.name
        )
        + " resistiu ao impacto; não há Status de dano para reagir."
      );

      return;
    }

    proposedLevel =
      Math.min(
        6,
        adjustedLevel
      );
  }

  const defense =
    defensiveContextForMove(
      move,
      targetActor
    );

  const priorityContext =
    priorityReactionContext(
      move
    );

  const reaction = {
    reactionId:
      randomId(),

    createdAt:
      Date.now(),

    sceneId:
      canvas.scene.id,

    sourceActorId:
      sourceActor.id,

    sourceTokenId:
      sourceToken.id,

    targetActorId:
      targetActor.id,

    targetTokenId:
      target.id,

    moveId:
      move.id,

    moveName:
      move.name
      ?? move.id,

    move:
      foundry.utils.deepClone(
        move
      ),

    effect:
      foundry.utils.deepClone(
        effect
      ),

    effectName:
      String(
        effect?.name
        ?? "consequência"
      ),

    originalLevel,

    proposedLevel,

    multiplier,

    multiplierLabel:
      matchupLabel(
        multiplier
      ),

    // defensiveContextForMove usa o ponto de vista do atacante;
    // a Reaction inverte o sinal.
    defenseModifier:
      defense
        ? -Number(
            defense.modifier
            ?? 0
          )
        : 0,

    defenseName:
      defense?.name
        ? (
            "Defesa: "
            + defense.name
          )
        : "",

    priorityModifier:
      priorityContext?.modifier
      ?? 0,

    priorityName:
      priorityContext?.name
      ?? ""
  };

  const user =
    reactionUserForActor(
      targetActor
    );

  if (!user) {
    throw new Error(
      "Nenhum usuário ativo pode fazer a Reaction Roll."
    );
  }

  if (
    user.id
      === game.user.id
  ) {
    await openNativePokemonReaction(
      reaction
    );

    return;
  }

  game.socket.emit(
    SOCKET_NAME,
    {
      kind:
        "pokemon-reaction-offer",

      sourceUserId:
        game.user.id,

      targetUserId:
        user.id,

      reaction
    }
  );

  ui.notifications.info(
    "Reaction Roll enviada para "
    + user.name
    + "."
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

}

function sheetRoot(
  app,
  html
) {
  if (
    html instanceof HTMLElement
  ) {
    return html;
  }

  if (
    html?.[0] instanceof HTMLElement
  ) {
    return html[0];
  }

  if (
    app?.element instanceof HTMLElement
  ) {
    return app.element;
  }

  if (
    app?.element?.[0] instanceof HTMLElement
  ) {
    return app.element[0];
  }

  return null;
}


function sheetActor(app) {
  const actor =
    app?.actor
    ??
    app?.document
    ??
    app?.object
    ?? null;

  if (!actor) return null;

  if (
    actor.documentName === "Actor"
  ) {
    return actor;
  }

  if (
    String(actor.type ?? "")
      .startsWith("litm-")
  ) {
    return actor;
  }

  return null;
}


async function applyMoveEffectAction(
  sourceActor,
  move,
  effectIndex,
  explicitTargetIds = null,
  sourceTokenOverride = null
) {
  if (!canvas?.scene) {
    throw new Error("Abra uma cena antes de aplicar o efeito.");
  }

  const sourceToken = sourceTokenOverride ?? sourceTokenForActor(sourceActor);
  if (!sourceToken) {
    throw new Error("Token do Pokemon nao encontrado na cena.");
  }

  const effects = effectsForMove(sourceActor, move);
  const effect = effects[Number(effectIndex)];
  if (!effect) throw new Error("Efeito nao encontrado.");

  const targetKind = String(effect.target ?? "target").toLowerCase();
  if (targetKind === "scene") {
    ui.notifications.info(
      "Este efeito altera o campo. Use a Area como referencia visual e resolva a mudanca na cena."
    );
    return;
  }

  const targetIds = targetKind === "self"
    ? [sourceToken.id]
    : (Array.isArray(explicitTargetIds)
        ? explicitTargetIds
        : targetDocuments().map(token => token.id));

  if (!targetIds.length) {
    throw new Error("Marque pelo menos um alvo antes de aplicar o efeito.");
  }

  return requestAuthority("apply-effect", {
    sceneId: canvas.scene.id,
    sourceActorId: sourceActor.id,
    sourceTokenId: sourceToken.id,
    moveId: move.id,
    effectIndex: Number(effectIndex),
    targetTokenIds: targetIds
  });
}


async function applyChallengeEffect(
  sourceActor,
  move,
  effect
) {
  if (!game.user.isGM) return;

  const targetKind =
    String(
      effect?.target
      ?? "target"
    )
      .toLowerCase();

  if (
    targetKind === "scene"
  ) {
    ui.notifications.info(
      "Este efeito altera o campo. Use a Area como referencia visual e resolva o efeito na ficcao."
    );

    return;
  }

  if (
    targetKind === "self"
  ) {
    await applyEffectsToActor(
      sourceActor,
      [effect],
      1,
      3
    );

    return;
  }

  const targets =
    targetDocuments();

  if (!targets.length) {
    ui.notifications.warn(
      "Marque pelo menos um alvo antes de aplicar o efeito."
    );

    return;
  }

  for (
    const token
    of targets
  ) {
    if (!token.actor) continue;

    await applyEffectsToActor(
      token.actor,
      [effect],
      multiplierFor(
        token.actor,
        move?.type ?? "normal"
      ),
      3
    );
  }
}


async function applyChallengeMarkupStatus(
  name,
  level
) {
  if (!game.user.isGM) return;

  const targets =
    targetDocuments();

  if (!targets.length) {
    ui.notifications.warn(
      "Marque pelo menos um alvo antes de aplicar o Status."
    );

    return;
  }

  const effect = {
    target:
      "target",

    kind:
      "status",

    name,
    level,

    positive:
      false,

    source:
      "challenge-markup",

    trigger:
      "principal"
  };

  for (
    const token
    of targets
  ) {
    if (!token.actor) continue;

    await applyEffectsToActor(
      token.actor,
      [effect],
      1,
      3
    );
  }
}


function decorateStructuredStatusMarkup(
  root
) {
  if (
    !game.user.isGM
    ||
    !root
  ) {
    return;
  }

  const walker =
    document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT
    );

  const nodes = [];

  while (
    walker.nextNode()
  ) {
    const node =
      walker.currentNode;

    if (
      !node?.nodeValue?.includes(
        "[/s "
      )
      ||
      node.parentElement?.closest(
        "button,input,textarea,select,script,style"
      )
    ) {
      continue;
    }

    nodes.push(node);
  }

  const pattern =
    /\[\/s\s+([^\s\]]+)-([1-6])\]/g;

  for (
    const node
    of nodes
  ) {
    const source =
      node.nodeValue;

    const matches =
      Array.from(
        source.matchAll(
          pattern
        )
      );

    if (!matches.length) {
      continue;
    }

    const fragment =
      document.createDocumentFragment();

    let cursor = 0;

    for (
      const match
      of matches
    ) {
      fragment.append(
        document.createTextNode(
          source.slice(
            cursor,
            match.index
          )
        )
      );

      const name =
        match[1];

      const level =
        Number(
          match[2]
        );

      const button =
        document.createElement(
          "button"
        );

      button.type =
        "button";

      button.className =
        "pokemon-structured-status-button";

      button.innerHTML =
        '<i class="fa-solid fa-burst"></i> '
        + esc(
          name
          + "-"
          + level
        );

      button.addEventListener(
        "click",
        event => {
          event.preventDefault();
          event.stopPropagation();

          void applyChallengeMarkupStatus(
            name,
            level
          )
            .catch(error => {
              console.error(
                "Pokemon LITM Tools | Challenge Status:",
                error
              );

              ui.notifications.error(
                error?.message
                ??
                "Nao foi possivel aplicar o Status."
              );
            });
        }
      );

      fragment.append(button);

      cursor =
        match.index
        + match[0].length;
    }

    fragment.append(
      document.createTextNode(
        source.slice(cursor)
      )
    );

    node.replaceWith(
      fragment
    );
  }
}


async function playActorMoveVfx(
  actor,
  move,
  explicitTargetIds = null
) {
  if (!canvas?.scene) {
    throw new Error(
      "Abra uma cena antes de usar o VFX."
    );
  }

  const sourceToken =
    sourceTokenForActor(actor);

  if (!sourceToken) {
    throw new Error(
      "Token do Pokemon nao encontrado na cena."
    );
  }

  const selfTarget =
    [
      "self",
      "user",
      "users-field"
    ]
      .includes(
        String(
          move?.target
          ?? ""
        )
          .toLowerCase()
      );

  const targets =
    selfTarget
      ? [sourceToken]
      : targetDocuments(
          explicitTargetIds
        );

  if (!targets.length) {
    throw new Error(
      "Marque pelo menos um alvo antes de usar o VFX."
    );
  }

  await broadcastMoveVfx(
    canvas.scene.id,
    sourceToken.id,
    targets.map(
      token => token.id
    ),
    move?.type ?? "normal"
  );
}


function ensureBiographyMoveCardLayout(card) {
  let main =
    card.querySelector(
      ":scope > .pokemon-biography-effect-main"
    );

  if (!main) {
    main =
      document.createElement(
        "div"
      );

    main.className =
      "pokemon-biography-effect-main";

    const heading =
      card.querySelector(
        ":scope > h3"
      );

    const description =
      card.querySelector(
        ":scope > p"
      );

    if (heading) {
      main.append(heading);
    }

    if (description) {
      main.append(
        description
      );
    }

    card.prepend(
      main
    );
  }

  const actionNodes =
    Array.from(
      card.querySelectorAll(
        ":scope > .pokemon-biography-effect-actions"
      )
    );

  let controls =
    actionNodes[0]
    ?? null;

  for (
    const duplicate
    of actionNodes.slice(1)
  ) {
    duplicate.remove();
  }

  if (!controls) {
    controls =
      document.createElement(
        "div"
      );

    controls.className =
      "pokemon-biography-effect-actions";

    card.append(
      controls
    );
  }

  controls.dataset
    .pokemonBiographyActions =
      "true";

  controls.removeAttribute(
    "data-pokemon-effect-actions"
  );

  return {
    main,
    controls
  };
}


async function addChallengeBiographyActions(
  actor,
  root
) {
  if (
    !root
    ||
    !actor
  ) {
    return;
  }

  if (
    root.dataset
      .pokemonChallengeActionsHydrating
      === "true"
  ) {
    return;
  }

  root.dataset
    .pokemonChallengeActionsHydrating =
      "true";

  try {
    const moves =
      await resolvedPokemonMovesForActor(
        actor
      );

    if (!root.isConnected) {
      return;
    }

    const moveMap =
      new Map(
        moves
          .filter(
            move =>
              move?.id
          )
          .map(
            move => [
              move.id,
              move
            ]
          )
      );

    const effectsRoot =
      root.querySelector(
        "[data-pokemon-effect-actions='true']"
      );

    const pokedexUrl =
      actor.getFlag?.(
        MODULE_ID,
        "pokedexUrl"
      );

    if (
      effectsRoot
      &&
      pokedexUrl
      &&
      !root.querySelector(
        "[data-pokemon-challenge-pokedex]"
      )
    ) {
      const toolbar =
        document.createElement(
          "div"
        );

      toolbar.className =
        "pokemon-biography-toolbar";

      const button =
        document.createElement(
          "button"
        );

      button.type =
        "button";

      button.dataset
        .pokemonChallengePokedex =
          "true";

      button.innerHTML =
        '<i class="fa-solid fa-mobile-screen-button"></i> Pokédex';

      button.addEventListener(
        "click",
        event => {
          event.preventDefault();
          event.stopPropagation();

          window.open(
            pokedexUrl,
            "_blank",
            "noopener,noreferrer"
          );
        }
      );

      toolbar.append(
        button
      );

      effectsRoot.before(
        toolbar
      );
    }

    for (
      const card
      of root.querySelectorAll(
        ".pokemon-biography-effect[data-pokemon-effect-kind='move']"
      )
    ) {
      const {
        main,
        controls
      } =
        ensureBiographyMoveCardLayout(
          card
        );

      controls.replaceChildren();

      const moveId =
        card.dataset
          .pokemonEffectId;

      const move =
        moveMap.get(
          moveId
        )
        ?? null;

      if (!move) {
        continue;
      }

      main.querySelector(
        "[data-pokemon-move-mechanics]"
      )?.remove();

      const mechanics =
        pokemonMoveMechanicsElement(
          move
        );

      mechanics.dataset
        .pokemonMoveMechanics =
          "true";

      const description =
        main.querySelector(
          "p"
        );

      if (description) {
        description.before(
          mechanics
        );
      } else {
        main.append(
          mechanics
        );
      }

      if (
        description
        &&
        move.description
      ) {
        description.textContent =
          move.description;
      }

      if (!game.user.isGM) {
        continue;
      }

      const vfxRow =
        document.createElement(
          "div"
        );

      vfxRow.className =
        "pokemon-biography-vfx-actions";

      const tokenButton =
        document.createElement(
          "button"
        );

      tokenButton.type =
        "button";

      tokenButton.innerHTML =
        '<i class="fa-solid fa-wand-magic-sparkles"></i> Token';

      tokenButton.addEventListener(
        "click",
        event => {
          event.preventDefault();
          event.stopPropagation();

          void playActorMoveVfx(
            actor,
            move
          ).catch(
            error => {
              ui.notifications.error(
                error?.message
                ?? "Nao foi possivel executar o VFX."
              );
            }
          );
        }
      );

      const areaButton =
        document.createElement(
          "button"
        );

      areaButton.type =
        "button";

      areaButton.innerHTML =
        '<i class="fa-solid fa-circle-nodes"></i> Área';

      areaButton.addEventListener(
        "click",
        event => {
          event.preventDefault();
          event.stopPropagation();

          void placeMoveArea(
            actor,
            move,
            "challenge"
          ).catch(
            error => {
              ui.notifications.error(
                error?.message
                ?? "Nao foi possivel criar a Area."
              );
            }
          );
        }
      );

      vfxRow.append(
        tokenButton,
        areaButton
      );

      controls.append(
        vfxRow
      );

      const effects =
        effectsForMove(
          actor,
          move
        );

      if (
        effects.length
      ) {
        const mechanics =
          document.createElement(
            "div"
          );

        mechanics.className =
          "pokemon-biography-mechanical-actions";

        effects.forEach(
          (
            effect,
            index
          ) => {
            const button =
              document.createElement(
                "button"
              );

            button.type =
              "button";

            button.dataset
              .pokemonEffectIndex =
                String(index);

            const targetKind =
              String(
                effect?.target
                ?? "target"
              ).toLocaleLowerCase();

            const threat =
              targetKind === "target";

            const suffix =
              effect?.kind
                === "tag"
                ? ""
                : (
                    "-"
                    + Number(
                        effect?.level
                        ?? 1
                      )
                  );

            button.innerHTML =
              '<i class="fa-solid '
              + (
                  threat
                    ? "fa-shield-halved"
                    : "fa-burst"
                )
              + '"></i> '
              + esc(
                  (
                    threat
                      ? "Ameaçar "
                      : "Aplicar "
                  )
                  + String(
                      effect?.name
                      ?? "efeito"
                    )
                  + suffix
                );

            button.addEventListener(
              "click",
              event => {
                event.preventDefault();
                event.stopPropagation();

                const action =
                  threat
                    ? offerChallengeReaction(
                        actor,
                        move,
                        effect
                      )
                    : applyChallengeEffect(
                        actor,
                        move,
                        effect
                      );

                void Promise.resolve(
                  action
                ).catch(
                  error => {
                    console.error(
                      "Pokemon LITM Tools | Challenge effect:",
                      error
                    );

                    ui.notifications.error(
                      error?.message
                      ?? "Nao foi possivel resolver o efeito."
                    );
                  }
                );
              }
            );

            mechanics.append(
              button
            );
          }
        );

        controls.append(
          mechanics
        );
      }
    }

  } finally {
    delete root.dataset
      .pokemonChallengeActionsHydrating;
  }
}


function renamePokemonChallengeBiographyTab(
  root
) {
  if (!root) return;

  const candidates =
    root.querySelectorAll(
      "[data-tab='biography'], nav button, nav a, [role='tab'], .tabs .item"
    );

  for (
    const candidate
    of candidates
  ) {
    const label =
      String(
        candidate.textContent
        ?? ""
      ).trim();

    if (
      label.toLocaleLowerCase()
      !== "biography"
    ) {
      continue;
    }

    const walker =
      document.createTreeWalker(
        candidate,
        NodeFilter.SHOW_TEXT
      );

    while (
      walker.nextNode()
    ) {
      const node =
        walker.currentNode;

      if (
        /biography/i.test(
          node.nodeValue
          ?? ""
        )
      ) {
        node.nodeValue =
          String(
            node.nodeValue
          ).replace(
            /biography/gi,
            "Ações"
          );
      }
    }

    candidate.title =
      "Ações";
  }
}


function findOtherPanel(root) {
  const navItems =
    Array.from(
      root.querySelectorAll(
        "nav [data-tab], .tabs [data-tab], [role='tab'][data-tab]"
      )
    );

  const nav =
    navItems.find(
      element =>
        String(
          element.dataset?.tab
          ?? ""
        ).toLocaleLowerCase()
          === "other"

        ||

        String(
          element.textContent
          ?? ""
        )
          .trim()
          .toLocaleLowerCase()
          === "other"

        ||

        String(
          element.textContent
          ?? ""
        )
          .trim()
          .toLocaleLowerCase()
          === "ações"
    );

  const tabId =
    nav?.dataset?.tab
    || "other";

  const candidates =
    Array.from(
      root.querySelectorAll(
        "[data-tab='"
        + CSS.escape(tabId)
        + "']"
      )
    );

  return (
    candidates.find(
      element =>
        element !== nav
        &&
        !element.closest("nav")
        &&
        !element.matches(
          "button,a,[role='tab']"
        )
    )
    ?? null
  );
}


function renamePokemonCharacterOtherTab(
  root
) {
  if (!root) {
    return;
  }

  const navItems =
    Array.from(
      root.querySelectorAll(
        "nav [data-tab], .tabs [data-tab], [role='tab'][data-tab]"
      )
    );

  for (
    const item
    of navItems
  ) {
    const tabId =
      String(
        item.dataset?.tab
        ?? ""
      ).toLocaleLowerCase();

    const label =
      String(
        item.textContent
        ?? ""
      )
        .trim()
        .toLocaleLowerCase();

    if (
      tabId !== "other"
      &&
      label !== "other"
    ) {
      continue;
    }

    const walker =
      document.createTreeWalker(
        item,
        NodeFilter.SHOW_TEXT
      );

    let changed =
      false;

    while (
      walker.nextNode()
    ) {
      const node =
        walker.currentNode;

      if (
        /\bother\b/i
          .test(
            node.nodeValue
            ?? ""
          )
      ) {
        node.nodeValue =
          String(
            node.nodeValue
          ).replace(
            /\bother\b/gi,
            "Ações"
          );

        changed =
          true;
      }
    }

    if (
      !changed
      &&
      !item.children.length
    ) {
      item.textContent =
        "Ações";
    }

    item.title =
      "Ações";
  }
}


function isPokemonPlayerActor(actor) {
  if (actor?.type !== "litm-character") return false;

  if (actor.getFlag?.(MODULE_ID, "kind") === "pokemon") return true;

  return Array.from(actor.items ?? []).some(item =>
    item.getFlag?.(MODULE_ID, "themeRole") === "pokemon-moves"
  );
}


function pokemonSpeciesTagData(
  name
) {
  return {
    name:
      "Espécie: "
      + String(
          name
          ?? "Pokémon"
        ).trim(),

    question:
      "",

    burned:
      false,

    toBurn:
      false,

    planned:
      false,

    selected:
      false,

    expiring:
      false,

    expired:
      false
  };
}



async function resolvePokemonSpeciesLabelForActor(
  actor,
  item
) {
  const profile =
    actor.getFlag?.(
      MODULE_ID,
      "characterPokemonProfile"
    )
    ?? {};

  const current =
    String(
      profile?.species
      ?? ""
    ).trim();

  if (
    current
    &&
    !/^(pokémon|pokemon)$/i
      .test(current)
  ) {
    return current;
  }

  const pokemonId =
    Number(
      actor.getFlag?.(
        MODULE_ID,
        "pokemonId"
      )
      ??
      actor.getFlag?.(
        MODULE_ID,
        "dex"
      )
      ??
      item?.getFlag?.(
        MODULE_ID,
        "pokemonId"
      )
      ??
      item?.getFlag?.(
        MODULE_ID,
        "dex"
      )
      ??
      0
    );

  if (
    Number.isInteger(
      pokemonId
    )
    &&
    pokemonId > 0
  ) {
    try {
      const species =
        await fetchPokeJson(
          "https://pokeapi.co/api/v2/pokemon-species/"
          + pokemonId
          + "/"
        );

      const label =
        pokemonGenusLabel(
          species,
          "pt-BR"
        );

      if (
        label
        &&
        !/^(pokémon|pokemon)$/i
          .test(label)
      ) {
        await actor.setFlag(
          MODULE_ID,
          "characterPokemonProfile",
          {
            ...foundry.utils.deepClone(
              profile
            ),

            species:
              label
          }
        );

        return label;
      }

    } catch (error) {
      console.warn(
        "Pokemon LITM Tools | Species migration:",
        error
      );
    }
  }

  return "Pokémon";
}


async function ensurePokemonPlayerMoveSpeciesTag(
  actor
) {
  const item =
    Array.from(
      actor?.items
      ?? []
    ).find(
      candidate =>
        candidate.getFlag?.(
          MODULE_ID,
          "themeRole"
        )
        === "pokemon-moves"
    );

  if (!item) {
    return false;
  }

  const tags =
    foundry.utils.deepClone(
      Array.isArray(
        item.system?.powertags
      )
        ? item.system.powertags
        : []
    );

  const firstName =
    currentTagName(
      tags[0]
    );

  const alreadySpecies =
    /^(espécie|especie|species)\s*:/i
      .test(
        firstName
      );

  const generic =
    /^(espécie|especie|species)\s*:\s*(pokémon|pokemon)$/i
      .test(
        firstName
      );

  if (
    alreadySpecies
    &&
    !generic
  ) {
    return false;
  }

  const species =
    await resolvePokemonSpeciesLabelForActor(
      actor,
      item
    );

  if (
    !species
    ||
    /^(pokémon|pokemon)$/i
      .test(species)
  ) {
    return false;
  }

  const flags =
    item.flags?.[
      MODULE_ID
    ]
    ?? {};

  if (alreadySpecies) {
    tags[0] = {
      ...foundry.utils.deepClone(
        tags[0]
      ),

      name:
        "Espécie: "
        + species
    };

    await item.update({
      "system.powertags":
        tags,

      [
        "flags."
        + MODULE_ID
        + ".pokemonSpecies"
      ]:
        species
    });

    return true;
  }

  const bindings =
    foundry.utils.deepClone(
      Array.isArray(
        flags.pokemonMoveBindings
      )
        ? flags.pokemonMoveBindings
        : Array.isArray(
            flags.tagBindings
          )
          ? flags.tagBindings
          : []
    );

  const shifted =
    bindings.map(
      binding => {
        if (
          binding?.kind
            !== "pokemonMove"
        ) {
          return binding;
        }

        return {
          ...binding,

          tagIndex:
            Number(
              binding.tagIndex
            )
            + 1
        };
      }
    );

  await item.update({
    "system.powertags": [
      {
        name:
          "Espécie: "
          + species,

        selected:
          false,

        burned:
          false,

        toBurn:
          false,

        might:
          0,

        mightIcon:
          "adventure"
      },

      ...tags
    ],

    [
      "flags."
      + MODULE_ID
      + ".pokemonMoveBindings"
    ]:
      shifted,

    [
      "flags."
      + MODULE_ID
      + ".pokemonSpecies"
    ]:
      species
  });

  return true;
}


function actionButton(label, icon, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.innerHTML = '<i class="fa-solid ' + icon + '"></i> ' + esc(label);
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    void Promise.resolve(handler()).catch(error => {
      console.error("Pokemon LITM Tools | Acao Pokemon:", error);
      ui.notifications.error(error?.message ?? "Nao foi possivel executar a acao.");
    });
  });
  return button;
}


async function addPokemonCharacterOtherActions(actor, root) {
  const panel = findOtherPanel(root);
  if (!panel) return;

  if (
    panel.dataset
      .pokemonCharacterActionsHydrating
      === "true"
  ) {
    return;
  }

  panel.dataset
    .pokemonCharacterActionsHydrating =
      "true";

  try {
    await ensurePokemonPlayerMoveSpeciesTag(
      actor
    );

    if (!panel.isConnected) {
      return;
    }

    const old =
      panel.querySelector(
        "[data-pokemon-character-actions]"
      );

    if (old) {
      old.remove();
    }

  const section = document.createElement("section");
  section.className = "pokemon-character-other-actions";
  section.dataset.pokemonCharacterActions = "true";
  section.innerHTML =
    '<header><div><h2>Ações Pokémon</h2>'
    + '<p>VFX e efeitos acompanham as Tags atuais do Theme de Golpes.</p></div></header>';

  const list = document.createElement("div");
  list.className = "pokemon-character-action-list";
  section.append(list);
  panel.append(section);

  const moves = await resolvedPokemonMovesForActor(actor);
  if (!section.isConnected) return;

  if (!moves.length) {
    list.innerHTML = '<p class="hint">Nenhum golpe reconhecido. Para um golpe novo, use Nome em PT-BR (nome oficial em inglês).</p>';
    return;
  }

  for (const move of moves) {
    const card = document.createElement("article");
    card.className = "pokemon-character-action-card";

    const main = document.createElement("div");
    main.className = "pokemon-character-action-main";

    const heading = document.createElement("h3");
    heading.textContent = move.name || move.englishName || move.id || "Golpe";
    main.append(heading);

    main.append(
      pokemonMoveMechanicsElement(
        move
      )
    );

    const description =
      document.createElement(
        "p"
      );

    description.textContent =
      move.description
      || move.shortDescription
      || "";

    main.append(
      description
    );

    if (move.pokemonDbUrl) {
      const link = document.createElement("button");
      link.type = "button";
      link.className = "pokemon-pokedex-link";
      link.innerHTML = '<i class="fa-solid fa-mobile-screen-button"></i> PokémonDB';
      link.addEventListener("click", event => {
        event.preventDefault();
        window.open(move.pokemonDbUrl, "_blank", "noopener,noreferrer");
      });
      main.append(link);
    }

    const actions = document.createElement("div");
    actions.className = "pokemon-character-action-buttons";

    if (move.unresolved || !move.id) {
      const hint = document.createElement("small");
      hint.className = "pokemon-move-unresolved";
      hint.textContent =
        "Para reconhecer este golpe, use: Nome em PT-BR (nome oficial em inglês).";
      actions.append(hint);
      card.append(main, actions);
      list.append(card);
      continue;
    }

    actions.append(
      actionButton("Token", "fa-wand-magic-sparkles", () => playActorMoveVfx(actor, move)),
      actionButton("Área", "fa-circle-nodes", () => placeMoveArea(actor, move, "player"))
    );

    const effects =
      effectsForMove(
        actor,
        move
      ).filter(
        effect =>
          String(
            effect?.source
            ?? ""
          ) !== "damage"
      );

    if (effects.length) {
      const info =
        document.createElement(
          "div"
        );

      info.className =
        "pokemon-character-move-effects-info";

      const label =
        document.createElement(
          "small"
        );

      label.textContent =
        "Efeitos disponíveis após a rolagem:";

      info.append(
        label
      );

      const chips =
        document.createElement(
          "div"
        );

      chips.className =
        "pokemon-litm-mechanic-badges";

      for (
        const effect
        of effects
      ) {
        chips.append(
          createMechanicBadge(
            String(
              effect?.name
              ?? "efeito"
            )
            + (
                effect?.kind
                  === "tag"
                  ? ""
                  : "-"
                    + Number(
                        effect?.level
                        ?? 1
                      )
              )
          )
        );
      }

      info.append(
        chips
      );

      actions.append(
        info
      );
    }

    card.append(main, actions);
    list.append(card);
  }

  } finally {
    delete panel.dataset
      .pokemonCharacterActionsHydrating;
  }
}


function onRenderPokemonActorSheet(app, html) {
  const root =
    sheetRoot(
      app,
      html
    );

  if (!root) {
    return;
  }

  if (
    isLitmDiceRollApp(
      app
    )
  ) {
    decoratePokemonRollDialog(
      app,
      root
    );

    return;
  }

  const actor =
    sheetActor(
      app
    );

  if (!actor) {
    return;
  }

  const challenge =
    actor.type === "litm-npc"
    && actor.getFlag?.(MODULE_ID, "pokemonBuilder") === true;

  if (challenge) {
    renamePokemonChallengeBiographyTab(root);

    void addChallengeBiographyActions(
      actor,
      root
    ).catch(
      error => {
        console.error(
          "Pokemon LITM Tools | Challenge actions:",
          error
        );
      }
    );

    decorateStructuredStatusMarkup(
      root
    );

    return;
  }

  if (
    isPokemonPlayerActor(
      actor
    )
  ) {
    renamePokemonCharacterOtherTab(
      root
    );

    void addPokemonCharacterOtherActions(
      actor,
      root
    );
  }
}


async function pokemonMovesForMessageActor(
  actor
) {
  if (!actor) return [];
  return resolvedPokemonMovesForActor(actor);
}


function normalizeMoveSearch(
  value
) {
  return String(
    value ?? ""
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLocaleLowerCase();
}


function sourceTokenForMessageActor(
  actor,
  move
) {
  const ownMoves =
    actor?.getFlag?.(
      MODULE_ID,
      "characterPokemonMoves"
    );

  if (
    Array.isArray(ownMoves)
    &&
    ownMoves.length
  ) {
    return sourceTokenForActor(
      actor
    );
  }

  if (
    actor?.getFlag?.(
      MODULE_ID,
      "combatProjection"
    ) === true
  ) {
    return sourceTokenForActor(
      actor
    );
  }

  const combatPokemon =
    canvas?.scene?.tokens?.find(
      token => {
        const combatActor =
          token.actor;

        const sameTrainer =
          combatActor?.getFlag?.(
            MODULE_ID,
            "sourceTrainerActorId"
          ) === actor?.id;

        if (!sameTrainer) return false;

        if (moveForActor(combatActor, move?.id)) {
          return true;
        }

        const sourceThemeId =
          combatActor?.getFlag?.(
            MODULE_ID,
            "sourceThemeId"
          );

        const sourceTheme =
          sourceThemeId
            ? actor?.items?.get?.(sourceThemeId)
            : null;

        return !!sourceTheme
          && movesFromPokemonItem(sourceTheme)
            .some(row => row?.id === move?.id);
      }
    )
    ?? null;

  return combatPokemon;
}



function onPreCreateChatMessage(
  message,
  data,
  options,
  userId
) {
  if (
    userId !== game.user.id
  ) {
    return;
  }

  const actorId =
    message?.speaker?.actor
    ?? data?.speaker?.actor
    ?? null;

  const actor =
    actorId
      ? game.actors.get(
          actorId
        )
      : null;

  const targets =
    targetDocuments()
      .map(
        token =>
          token.id
      );

  const update = {
    [
      "flags."
      + MODULE_ID
      + ".rollTargetTokenIds"
    ]:
      targets,

    [
      "flags."
      + MODULE_ID
      + ".rollSceneId"
    ]:
      canvas?.scene?.id
      ?? null
  };

  const reaction =
    actor
      ? pendingPokemonReactions.get(
          actor.id
        )
      : null;

  if (
    reaction
    &&
    Date.now()
      - Number(
          reaction.createdAt
          ?? 0
        )
        < 180000
  ) {
    update[
      "flags."
      + MODULE_ID
      + ".pokemonReaction"
    ] =
      foundry.utils.deepClone(
        reaction
      );

    pendingPokemonReactions.delete(
      actor.id
    );

  } else if (actor) {
    const move =
      selectedMoveFromActorState(
        actor
      );

    if (move?.id) {
      update[
        "flags."
        + MODULE_ID
        + ".pokemonMoveId"
      ] =
        move.id;
    }
  }

  try {
    message.updateSource(
      update
    );
  } catch {}
}


async function moveFromChatMessage(
  message,
  actor
) {
  const flaggedId =
    String(
      message.getFlag?.(
        MODULE_ID,
        "pokemonMoveId"
      )
      ?? ""
    ).trim();

  if (flaggedId) {
    const move =
      await resolveMoveForActor(
        actor,
        flaggedId
      );

    if (move) {
      return move;
    }
  }

  const spend =
    message.getFlag?.(
      LITM_SYSTEM_ID,
      "detailedSpend"
    );

  const haystack =
    normalizeMoveSearch(
      JSON.stringify(
        spend
        ?? {}
      )
      + " "
      + String(
          message.content
          ?? ""
        )
    );

  const moves =
    await pokemonMovesForMessageActor(
      actor
    );

  const matches =
    moves.filter(
      move => {
        const candidates = [
          move?.name,
          move?.englishName,
          move?.id
        ]
          .map(
            normalizeMoveSearch
          )
          .filter(
            value =>
              value.length >= 3
          );

        return candidates.some(
          value =>
            haystack.includes(
              value
            )
        );
      }
    );

  return matches.length === 1
    ? matches[0]
    : null;
}


function detailedSpendRemaining(
  data
) {
  const spent =
    (
      data?.entries
      ?? []
    ).reduce(
      (
        sum,
        entry
      ) =>
        sum
        + Number(
            entry?.cost
            ?? 0
          ),
      0
    );

  return Math.max(
    0,
    Number(
      data?.total
      ?? 0
    )
    - spent
  );
}


async function updateDetailedSpendMessage(
  message,
  data
) {
  const module =
    await importLitmModule(
      "module/lib/detailed-spend.mjs"
    );

  if (
    typeof module.renderDetailedCard
      !== "function"
  ) {
    throw new Error(
      "Detailed Spend nativo do LitM não está disponível."
    );
  }

  const content =
    await module.renderDetailedCard(
      data
    );

  await message.update({
    content,

    [
      "flags."
      + LITM_SYSTEM_ID
      + ".detailedSpend"
    ]:
      data
  });
}


function pokemonEffectPowerCost(
  effect
) {
  return Math.max(
    1,
    Math.min(
      3,
      effectRank(
        effect?.trigger
      )
    )
  );
}


async function spendPokemonPower(
  message,
  entry
) {
  const data =
    foundry.utils.deepClone(
      message.getFlag?.(
        LITM_SYSTEM_ID,
        "detailedSpend"
      )
    );

  if (!data) {
    throw new Error(
      "A mensagem não possui Detailed Spend."
    );
  }

  const cost =
    Number(
      entry.cost
      ?? 1
    );

  if (
    detailedSpendRemaining(
      data
    )
      < cost
  ) {
    throw new Error(
      "Power insuficiente."
    );
  }

  data.entries ??=
    [];

  data.entries.push({
    ...entry,

    cost,

    pokemonApplied:
      false
  });

  await updateDetailedSpendMessage(
    message,
    data
  );
}



async function markPokemonSpendApplied(
  message,
  predicate,
  application
) {
  const data =
    foundry.utils.deepClone(
      message.getFlag?.(
        LITM_SYSTEM_ID,
        "detailedSpend"
      )
    );

  if (!data) {
    return;
  }

  for (
    const entry
    of data.entries
      ?? []
  ) {
    if (
      predicate(entry)
    ) {
      entry.pokemonApplied =
        true;

      entry.pokemonApplication =
        foundry.utils.deepClone(
          application
          ?? {
            sceneEffect:
              true
          }
        );
    }
  }

  await updateDetailedSpendMessage(
    message,
    data
  );
}


async function markPokemonSpendUnapplied(
  message,
  predicate
) {
  const data =
    foundry.utils.deepClone(
      message.getFlag?.(
        LITM_SYSTEM_ID,
        "detailedSpend"
      )
    );

  if (!data) {
    return;
  }

  for (
    const entry
    of data.entries
      ?? []
  ) {
    if (
      predicate(entry)
    ) {
      entry.pokemonApplied =
        false;

      delete entry.pokemonApplication;
    }
  }

  await updateDetailedSpendMessage(
    message,
    data
  );
}


async function nativeStatusMarkup(
  name,
  level
) {
  try {
    const module =
      await importLitmModule(
        "module/lib/tag-status-text-helper.mjs"
      );

    if (
      typeof module.textWithTags
        === "function"
    ) {
      return module.textWithTags(
        "[/s "
        + name
        + "-"
        + level
        + "]"
      );
    }

  } catch {}

  return esc(
    name
    + "-"
    + level
  );
}



async function applyPurchasedMoveEffect({
  message,
  actor,
  move,
  sourceToken,
  targetIds,
  effect,
  predicate
}) {
  const kind =
    String(
      effect?.target
      ?? "target"
    ).toLocaleLowerCase();

  if (
    kind === "scene"
  ) {
    ui.notifications.info(
      "Esse efeito altera o campo. Resolva pelo VFX Área e pela ficção."
    );

    await markPokemonSpendApplied(
      message,
      predicate,
      {
        sceneEffect:
          true
      }
    );

    return;
  }

  const ids =
    kind === "self"
      ? [
          sourceToken.id
        ]
      : targetIds;

  if (
    kind !== "self"
    &&
    !ids.length
  ) {
    throw new Error(
      "A rolagem não tinha alvo."
    );
  }

  const application =
    await requestAuthority(
      "apply-explicit",
      {
        sceneId:
          canvas.scene.id,

        sourceActorId:
          actor.id,

        sourceTokenId:
          sourceToken.id,

        moveId:
          move.id,

        targetTokenIds:
          ids,

        effect
      }
    );

  await markPokemonSpendApplied(
    message,
    predicate,
    application
  );
}


async function undoPurchasedMoveEffect({
  message,
  predicate,
  application
}) {
  if (!application) {
    throw new Error(
      "Esta aplicação não possui dados para desfazer."
    );
  }

  if (
    application.sceneEffect
      !== true
  ) {
    await requestAuthority(
      "undo-explicit",
      {
        sceneId:
          canvas.scene.id,

        application:
          foundry.utils.deepClone(
            application
          )
      }
    );
  }

  await markPokemonSpendUnapplied(
    message,
    predicate
  );
}


function appliedStateControl({
  message,
  editable,
  predicate,
  application
}) {
  const state =
    document.createElement(
      "span"
    );

  state.className =
    "pokemon-litm-applied-state";

  const done =
    document.createElement(
      "small"
    );

  done.textContent =
    "Aplicado";

  state.append(
    done
  );

  if (
    editable
    &&
    application
  ) {
    const undo =
      document.createElement(
        "button"
      );

    undo.type =
      "button";

    undo.className =
      "pokemon-litm-undo-applied";

    undo.title =
      "Desfazer aplicação";

    undo.setAttribute(
      "aria-label",
      "Desfazer aplicação"
    );

    undo.innerHTML =
      '<i class="fa-solid fa-rotate-left"></i>';

    undo.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopPropagation();

        void undoPurchasedMoveEffect({
          message,
          predicate,
          application
        }).catch(
          error => {
            console.error(
              "Pokemon LITM Tools | Undo application:",
              error
            );

            ui.notifications.error(
              error?.message
              ?? "Não foi possível desfazer a aplicação."
            );
          }
        );
      }
    );

    state.append(
      undo
    );
  }

  return state;
}


function appendMoveMechanicsToChat(
  panel,
  move,
  targetIds
) {
  panel.append(
    pokemonMoveMechanicsElement(
      move
    )
  );

  const targetBadges =
    document.createElement(
      "div"
    );

  targetBadges.className =
    "pokemon-litm-mechanic-badges";

  for (
    const token
    of targetDocuments(
      targetIds
    )
  ) {
    targetBadges.append(
      createMechanicBadge(
        (
          token.name
          ?? token.actor?.name
          ?? "Alvo"
        )
        + ": "
        + matchupLabel(
            multiplierFor(
              token.actor,
              move.type
            )
          )
      )
    );
  }

  if (
    targetBadges.children.length
  ) {
    panel.append(
      targetBadges
    );
  }
}


function addPokemonDetailedSpendControls(
  message,
  actor,
  move,
  panel,
  sourceToken,
  frozenTargetIds
) {
  const data =
    message.getFlag?.(
      LITM_SYSTEM_ID,
      "detailedSpend"
    );

  if (!data) {
    return;
  }

  const editable =
    message.isAuthor
    ||
    game.user.isGM;

  const canSpend =
    Number(
      data.consequenceResult
      ?? -1
    ) >= 0
    &&
    Number(
      data.total
      ?? 0
    ) > 0;

  if (!canSpend) {
    return;
  }

  const remaining =
    detailedSpendRemaining(
      data
    );

  const section =
    document.createElement(
      "div"
    );

  section.className =
    "pokemon-litm-spend-panel";

  const heading =
    document.createElement(
      "div"
    );

  heading.className =
    "pokemon-litm-spend-heading";

  heading.innerHTML =
    "<strong>Efeitos de "
    + esc(
        move.name
        ?? move.id
      )
    + "</strong><span>"
    + remaining
    + " Power restante</span>";

  section.append(
    heading
  );

  const choices =
    document.createElement(
      "div"
    );

  choices.className =
    "pokemon-litm-spend-options";

  const mechanics =
    moveLitmProfile(
      move
    );

  if (
    Number(
      move.power
      ?? 0
    ) > 0
    &&
    mechanics.damageClass
      !== "status"
  ) {
    const damageButton =
      actionButton(
        "Dano +1 · 1 Power",
        "fa-heart-crack",
        () =>
          spendPokemonPower(
            message,
            {
              type:
                "pokemon-damage",

              pokemonMoveId:
                move.id,

              cost:
                1,

              label:
                "Dano de "
                + (
                    move.name
                    ?? move.id
                  )
            }
          )
      );

    damageButton.disabled =
      !editable
      ||
      remaining < 1;

    choices.append(
      damageButton
    );
  }

  const effects =
    effectsForMove(
      actor,
      move
    );

  effects.forEach(
    (
      effect,
      index
    ) => {
      if (
        String(
          effect?.source
          ?? ""
        ) === "damage"
      ) {
        return;
      }

      const cost =
        pokemonEffectPowerCost(
          effect
        );

      const bought =
        (
          data.entries
          ?? []
        ).some(
          entry =>
            entry?.type
              === "pokemon-effect"
            &&
            entry?.pokemonMoveId
              === move.id
            &&
            Number(
              entry?.pokemonEffectIndex
            ) === index
        );

      const suffix =
        effect?.kind === "tag"
          ? ""
          : "-"
            + Number(
                effect?.level
                ?? 1
              );

      const button =
        actionButton(
          String(
            effect?.name
            ?? "efeito"
          )
          + suffix
          + " · "
          + cost
          + " Power",

          effect?.kind === "tag"
            ? "fa-tag"
            : "fa-burst",

          () =>
            spendPokemonPower(
              message,
              {
                type:
                  "pokemon-effect",

                pokemonMoveId:
                  move.id,

                pokemonEffectIndex:
                  index,

                cost,

                label:
                  String(
                    effect?.name
                    ?? "efeito"
                  )
                  + suffix
              }
            )
        );

      button.disabled =
        !editable
        ||
        bought
        ||
        remaining < cost;

      choices.append(
        button
      );
    }
  );

  section.append(
    choices
  );

  const purchased =
    document.createElement(
      "div"
    );

  purchased.className =
    "pokemon-litm-spend-purchased";

  const damageEntries =
    (
      data.entries
      ?? []
    ).filter(
      entry =>
        entry?.type
          === "pokemon-damage"
        &&
        entry?.pokemonMoveId
          === move.id
    );

  if (damageEntries.length) {
    const spent =
      damageEntries.reduce(
        (
          sum,
          entry
        ) =>
          sum
          + Number(
              entry.cost
              ?? 0
            ),
        0
      );

    const baseLevel =
      Math.max(
        1,
        Math.min(
          6,
          spent
        )
      );

    const row =
      document.createElement(
        "div"
      );

    row.className =
      "pokemon-litm-purchased-row";

    const text =
      document.createElement(
        "span"
      );

    const targetText =
      targetDocuments(
        frozenTargetIds
      )
        .map(
          token => {
            const multiplier =
              multiplierFor(
                token.actor,
                move.type
              );

            const delta =
              effectivenessTierDelta(
                multiplier
              );

            if (
              delta === null
            ) {
              return (
                (
                  token.name
                  ?? "Alvo"
                )
                + ": imune"
              );
            }

            const finalLevel =
              baseLevel
              + delta;

            if (finalLevel <= 0) {
              return (
                (
                  token.name
                  ?? "Alvo"
                )
                + ": resiste · sem Status de dano"
              );
            }

            return (
              (
                token.name
                ?? "Alvo"
              )
              + ": ferido-"
              + Math.min(
                  6,
                  finalLevel
                )
            );
          }
        )
        .join(" · ");

    text.textContent =
      "Dano: "
      + spent
      + " Power"
      + (
          targetText
            ? " · "
              + targetText
            : ""
        );

    row.append(
      text
    );

    const applied =
      damageEntries.every(
        entry =>
          entry.pokemonApplied
            === true
      );

    if (
      editable
      &&
      !applied
    ) {
      row.append(
        actionButton(
          "Aplicar dano",
          "fa-heart-crack",
          () =>
            applyPurchasedMoveEffect({
              message,
              actor,
              move,
              sourceToken,

              targetIds:
                frozenTargetIds,

              effect: {
                target:
                  "target",

                kind:
                  "status",

                name:
                  "ferido",

                level:
                  baseLevel,

                positive:
                  false,

                source:
                  "damage",

                trigger:
                  "principal"
              },

              predicate:
                entry =>
                  entry?.type
                    === "pokemon-damage"
                  &&
                  entry?.pokemonMoveId
                    === move.id
            })
        )
      );

    } else if (applied) {
      const application =
        damageEntries.find(
          entry =>
            entry?.pokemonApplication
        )?.pokemonApplication
        ?? null;

      row.append(
        appliedStateControl({
          message,
          editable,

          predicate:
            entry =>
              entry?.type
                === "pokemon-damage"
              &&
              entry?.pokemonMoveId
                === move.id,

          application
        })
      );
    }

    purchased.append(
      row
    );
  }

  (
    data.entries
    ?? []
  )
    .filter(
      entry =>
        entry?.type
          === "pokemon-effect"
        &&
        entry?.pokemonMoveId
          === move.id
    )
    .forEach(
      entry => {
        const index =
          Number(
            entry.pokemonEffectIndex
          );

        const effect =
          effects[index];

        if (!effect) {
          return;
        }

        const row =
          document.createElement(
            "div"
          );

        row.className =
          "pokemon-litm-purchased-row";

        const text =
          document.createElement(
            "span"
          );

        text.textContent =
          entry.label;

        row.append(
          text
        );

        if (
          editable
          &&
          entry.pokemonApplied
            !== true
        ) {
          row.append(
            actionButton(
              "Aplicar",
              "fa-check",
              () =>
                applyPurchasedMoveEffect({
                  message,
                  actor,
                  move,
                  sourceToken,

                  targetIds:
                    frozenTargetIds,

                  effect,

                  predicate:
                    candidate =>
                      candidate?.type
                        === "pokemon-effect"
                      &&
                      candidate?.pokemonMoveId
                        === move.id
                      &&
                      Number(
                        candidate
                          .pokemonEffectIndex
                      ) === index
                })
            )
          );

        } else if (
          entry.pokemonApplied
            === true
        ) {
          row.append(
            appliedStateControl({
              message,
              editable,

              predicate:
                candidate =>
                  candidate?.type
                    === "pokemon-effect"
                  &&
                  candidate?.pokemonMoveId
                    === move.id
                  &&
                  Number(
                    candidate
                      .pokemonEffectIndex
                  ) === index,

              application:
                entry.pokemonApplication
                ?? null
            })
          );
        }

        purchased.append(
          row
        );
      }
    );

  if (
    purchased.children.length
  ) {
    section.append(
      purchased
    );
  }

  panel.append(
    section
  );
}


function reactionResultKind(
  root
) {
  if (
    root.querySelector(
      ".consequence-result-positive"
    )
  ) {
    return 1;
  }

  if (
    root.querySelector(
      ".consequence-result-neutral"
    )
  ) {
    return 0;
  }

  return -1;
}


function reactionPower(
  root
) {
  const text =
    Array.from(
      root.querySelectorAll(
        ".power-counter"
      )
    )
      .map(
        element =>
          element.textContent
      )
      .join(" ");

  return Number(
    text.match(
      /Power:\s*(\d+)/i
    )?.[1]
    ?? 0
  );
}


async function addPokemonReactionResultPanel(
  message,
  root,
  reaction
) {
  if (
    root.querySelector(
      "[data-pokemon-reaction-result]"
    )
  ) {
    return;
  }

  const result =
    reactionResultKind(
      root
    );

  const power =
    reactionPower(
      root
    );

  /*
   * Regras nativas do LitM:
   * 6-  = consequência como está
   * 7-9 = Power só pode diminuir consequência
   * 10+ = Power +1 pode ser gasto em qualquer efeito
   *
   * Para este fluxo usamos a parte defensiva desse Power.
   */
  const budget =
    result < 0
      ? 0
      : power
        + (
            result > 0
              ? 1
              : 0
          );

  const requested =
    Number(
      message.getFlag?.(
        MODULE_ID,
        "reactionReduction"
      )
      ?? 0
    );

  const reduction =
    Math.max(
      0,
      Math.min(
        budget,
        reaction.proposedLevel,
        requested
      )
    );

  const finalLevel =
    Math.max(
      0,
      reaction.proposedLevel
      - reduction
    );

  const alreadyApplied =
    message.getFlag?.(
      MODULE_ID,
      "reactionApplied"
    ) === true;

  const panel =
    document.createElement(
      "div"
    );

  panel.className =
    "pokemon-litm-reaction-result";

  panel.dataset
    .pokemonReactionResult =
      "true";

  const title =
    document.createElement(
      "strong"
    );

  title.textContent =
    "Consequência de "
    + reaction.moveName;

  panel.append(
    title
  );

  const threat =
    document.createElement(
      "div"
    );

  threat.innerHTML =
    "Ameaça: "
    + await nativeStatusMarkup(
        reaction.effectName,
        reaction.proposedLevel
      );

  panel.append(
    threat
  );

  const explanation =
    document.createElement(
      "small"
    );

  explanation.textContent =
    result < 0
      ? "6-: sofra a consequência como está."
      : result === 0
        ? (
            "7–9: seus "
            + budget
            + " Power só podem diminuir a consequência."
          )
        : (
            "10+: "
            + budget
            + " Power disponíveis."
          );

  panel.append(
    explanation
  );

  const controls =
    document.createElement(
      "div"
    );

  controls.className =
    "pokemon-litm-reaction-controls";

  const editable =
    (
      message.isAuthor
      ||
      game.user.isGM
    )
    &&
    !alreadyApplied;

  if (
    editable
    &&
    budget > 0
  ) {
    const reduce =
      actionButton(
        "Gastar 1 Power para reduzir",
        "fa-shield",
        async () => {
          await message.setFlag(
            MODULE_ID,
            "reactionReduction",
            Math.min(
              budget,
              reaction.proposedLevel,
              reduction + 1
            )
          );
        }
      );

    reduce.disabled =
      reduction >= budget
      ||
      finalLevel <= 0;

    controls.append(
      reduce
    );

    const undo =
      actionButton(
        "Devolver 1 Power",
        "fa-rotate-left",
        async () => {
          await message.setFlag(
            MODULE_ID,
            "reactionReduction",
            Math.max(
              0,
              reduction - 1
            )
          );
        }
      );

    undo.disabled =
      reduction <= 0;

    controls.append(
      undo
    );
  }

  const final =
    document.createElement(
      "div"
    );

  final.className =
    "pokemon-litm-reaction-final";

  final.innerHTML =
    finalLevel > 0
      ? (
          "Final: "
          + await nativeStatusMarkup(
              reaction.effectName,
              finalLevel
            )
        )
      : "<strong>Consequência evitada.</strong>";

  controls.append(
    final
  );

  if (editable) {
    controls.append(
      actionButton(
        finalLevel > 0
          ? "Aplicar consequência"
          : "Confirmar consequência evitada",

        finalLevel > 0
          ? "fa-burst"
          : "fa-shield",

        async () => {
          if (
            finalLevel > 0
          ) {
            await requestAuthority(
              "apply-explicit",
              {
                sceneId:
                  reaction.sceneId,

                sourceActorId:
                  reaction.sourceActorId,

                sourceTokenId:
                  reaction.sourceTokenId,

                moveId:
                  reaction.moveId,

                targetTokenIds: [
                  reaction.targetTokenId
                ],

                effect: {
                  ...foundry.utils.deepClone(
                    reaction.effect
                  ),

                  target:
                    "target",

                  level:
                    finalLevel,

                  /*
                   * Tipo já alterou proposedLevel.
                   * Não pode alterar uma segunda vez.
                   */
                  source:
                    "reaction-final"
                }
              }
            );
          }

          await message.setFlag(
            MODULE_ID,
            "reactionApplied",
            true
          );
        }
      )
    );

  } else if (
    alreadyApplied
  ) {
    const done =
      document.createElement(
        "small"
      );

    done.textContent =
      finalLevel > 0
        ? "Consequência aplicada."
        : "Consequência evitada.";

    controls.append(
      done
    );
  }

  panel.append(
    controls
  );

  (
    root.querySelector(
      ".message-content"
    )
    ?? root
  ).append(
    panel
  );
}


async function onRenderPokemonChatMessage(
  message,
  html
) {
  const actor =
    game.actors.get(
      message?.speaker?.actor
    );

  if (!actor) {
    return;
  }

  if (
    !game.user.isGM
    &&
    !actor.isOwner
  ) {
    return;
  }

  const root =
    html instanceof HTMLElement
      ? html
      : html?.[0]
          instanceof HTMLElement
        ? html[0]
        : null;

  if (!root) {
    return;
  }

  const reaction =
    message.getFlag?.(
      MODULE_ID,
      "pokemonReaction"
    );

  if (reaction) {
    await addPokemonReactionResultPanel(
      message,
      root,
      reaction
    );

    return;
  }

  const move =
    await moveFromChatMessage(
      message,
      actor
    );

  if (!move) {
    return;
  }

  if (
    root.querySelector(
      "[data-pokemon-chat-actions]"
    )
  ) {
    return;
  }

  const sceneId =
    message.getFlag?.(
      MODULE_ID,
      "rollSceneId"
    );

  const frozenTargetIds =
    message.getFlag?.(
      MODULE_ID,
      "rollTargetTokenIds"
    )
    ?? [];

  const panel =
    document.createElement(
      "div"
    );

  panel.className =
    "pokemon-chat-move-actions";

  panel.dataset
    .pokemonChatActions =
      "true";

  const heading =
    document.createElement(
      "div"
    );

  heading.className =
    "pokemon-chat-move-header";

  heading.innerHTML =
    '<i class="fa-solid fa-bolt"></i><strong>'
    + esc(
        move.name
        ?? move.id
      )
    + "</strong>";

  panel.append(
    heading
  );

  appendMoveMechanicsToChat(
    panel,
    move,
    frozenTargetIds
  );

  const buttons =
    document.createElement(
      "div"
    );

  buttons.className =
    "pokemon-chat-move-buttons";

  panel.append(
    buttons
  );

  const sourceToken =
    () => {
      if (
        sceneId
        &&
        sceneId !== canvas?.scene?.id
      ) {
        throw new Error(
          "Abra a cena onde a rolagem foi feita."
        );
      }

      const token =
        sourceTokenForMessageActor(
          actor,
          move
        );

      if (!token) {
        throw new Error(
          "Token do Pokémon não encontrado."
        );
      }

      return (
        token.document
        ?? token
      );
    };

  buttons.append(
    actionButton(
      "VFX Token",
      "fa-wand-magic-sparkles",
      async () => {
        const source =
          sourceToken();

        const selfTarget =
          [
            "self",
            "user",
            "users-field"
          ].includes(
            String(
              move?.target
              ?? ""
            ).toLocaleLowerCase()
          );

        const ids =
          selfTarget
            ? [source.id]
            : targetDocuments()
                .map(
                  token =>
                    token.id
                );

        if (!ids.length) {
          throw new Error(
            "Marque pelo menos um alvo."
          );
        }

        await broadcastMoveVfx(
          canvas.scene.id,
          source.id,
          ids,
          move.type
            ?? "normal"
        );
      }
    ),

    actionButton(
      "VFX Área",
      "fa-circle-nodes",
      async () => {
        const source =
          sourceToken();

        await placeMoveArea(
          actor,
          move,
          "player",
          source
        );
      }
    )
  );

  /*
   * Como esta detecção é independente de detailedSpend,
   * Quick Roll também recebe VFX Token / Área.
   */
  const detailed =
    message.getFlag?.(
      LITM_SYSTEM_ID,
      "detailedSpend"
    );

  if (detailed) {
    addPokemonDetailedSpendControls(
      message,
      actor,
      move,
      panel,
      sourceToken(),
      frozenTargetIds
    );
  }

  (
    root.querySelector(
      ".message-content"
    )
    ?? root
  ).append(
    panel
  );
}


export async function startPokemonChallengeMoveArea(actor, moveId) {
  if (!actor || actor.type !== "litm-npc") {
    throw new Error("Challenge Pokémon inválido.");
  }

  const move = moveForActor(actor, moveId);
  if (!move) throw new Error("Golpe não encontrado no Challenge.");

  await placeMoveArea(actor, move, "challenge");
}

export async function cleanupPokemonInstance(
  trainerActorId,
  themeId,
  instanceId
) {
  if (!trainerActorId || !instanceId) return false;

  return requestAuthority(
    "cleanup-instance",
    {
      trainerActorId,
      themeId,
      instanceId
    }
  );
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

  Hooks.on(
    "targetToken",
    () => {
      if (
        activePokemonRollApp
          ?.rendered
      ) {
        try {
          activePokemonRollApp.render(
            true,
            {
              focus:
                false
            }
          );
        } catch {}
      }
    }
  );

  Hooks.on(
    "renderActorSheet",
    onRenderPokemonActorSheet
  );

  Hooks.on(
    "renderApplicationV2",
    onRenderPokemonActorSheet
  );

  Hooks.on(
    "preCreateChatMessage",
    onPreCreateChatMessage
  );

  Hooks.on(
    "renderChatMessageHTML",
    onRenderPokemonChatMessage
  );

  Hooks.on("updateItem", item => {
    const actor = item?.parent;
    if (!actor || actor.documentName !== "Actor") return;

    const flags = item.flags?.[MODULE_ID] ?? {};
    if (
      flags.themeRole === "pokemon-moves"
      || Array.isArray(flags.tagBindings)
      || Array.isArray(flags.pokemonMoveBindings)
    ) {
      actor.sheet?.render?.(false);
    }
  });
}
