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
  statWeaknessText,
  moveSpeedRule
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

const POKEMON_CONTEXT_SPEND_REV =
  "2026-09-08-context-spend-v2";

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
  fire: ["jb2a.fire_bolt"],
  water: ["jb2a.water_bolt"],
  electric: ["jb2a.lightning_bolt", "jb2a.chain_lightning"],
  grass: ["jb2a.energy_beam", "jb2a.entangle"],
  ice: ["jb2a.ray_of_frost", "jb2a.ice_shard"],
  fighting: ["jb2a.unarmed_strike"],
  poison: ["jb2a.poison_spray", "jb2a.energy_beam"],
  ground: ["jb2a.boulder_toss", "jb2a.bullet.01"],
  flying: ["jb2a.gust_of_wind", "jb2a.bullet.01"],
  psychic: ["jb2a.energy_beam"],
  bug: ["jb2a.energy_beam", "jb2a.bullet.01"],
  rock: ["jb2a.boulder_toss", "jb2a.bullet.01"],
  ghost: ["jb2a.eldritch_blast", "jb2a.energy_beam"],
  dragon: ["jb2a.energy_beam"],
  dark: ["jb2a.eldritch_blast", "jb2a.energy_beam"],
  steel: ["jb2a.bullet.01"],
  fairy: ["jb2a.energy_beam"],
  normal: ["jb2a.bullet.01"]
};

const JB2A_TYPE_COLOR_KEYS = {
  fire: ["orange", "red", "fire"],
  water: ["blue", "water"],
  electric: ["yellow", "orange", "electric"],
  grass: ["green", "nature"],
  ice: ["blue", "cyan", "ice", "frost"],
  fighting: ["red", "orange", "physical"],
  poison: ["purple", "green", "poison"],
  ground: ["brown", "orange", "earth"],
  flying: ["white", "blue", "wind"],
  psychic: ["pink", "purple", "magenta"],
  bug: ["green", "yellow"],
  rock: ["brown", "orange", "stone"],
  ghost: ["purple", "dark", "ghost"],
  dragon: ["purple", "blue", "dragon"],
  dark: ["dark", "purple", "black"],
  steel: ["white", "silver", "blue"],
  fairy: ["pink", "purple", "rainbow"],
  normal: ["white", "physical"]
};

const JB2A_INHERENT_TYPE_PATHS = new Set([
  "jb2a.fire_bolt",
  "jb2a.water_bolt",
  "jb2a.ray_of_frost",
  "jb2a.ice_shard",
  "jb2a.poison_spray",
  "jb2a.gust_of_wind",
  "jb2a.boulder_toss"
]);

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

function replayVfxTargetIds(frozenTargetIds) {
  const scene = canvas?.scene;

  const frozen = [...new Set(
    [...(frozenTargetIds ?? [])]
      .filter(id => !!scene?.tokens?.get(id))
  )];

  if (frozen.length) return frozen;

  return [...new Set(
    [...(game.user?.targets ?? [])]
      .map(target => target?.document?.id ?? target?.id)
      .filter(id => !!scene?.tokens?.get(id))
  )];
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

export function challengeConsequenceTierDelta(multiplier) {
  const value = Number(multiplier ?? 1);
  if (!Number.isFinite(value)) return 0;
  if (value === 0) return null;
  if (value > 1) return 1;
  if (value > 0 && value < 1) return -1;
  return 0;
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

function databasePath(candidates, type = "normal") {
  if (!sequenceAvailable()) return null;

  const database = globalThis.Sequencer?.Database;
  const entryExists = database?.entryExists;
  const getPathsUnder = database?.getPathsUnder;
  const colors = JB2A_TYPE_COLOR_KEYS[String(type ?? "normal")] ?? [];

  const exists = path => {
    try {
      if (typeof entryExists === "function") {
        return entryExists.call(database, path) === true;
      }
      return !!database?.getEntry?.(path, { softFail: true });
    } catch {
      return false;
    }
  };

  for (const root of candidates ?? []) {
    let discovered = [];
    try {
      if (typeof getPathsUnder === "function") {
        const found = getPathsUnder.call(database, root, true);
        if (Array.isArray(found)) discovered = found;
        else if (found && typeof found[Symbol.iterator] === "function") discovered = [...found];
      }
    } catch {}

    const typed = discovered.find(path => {
      const lower = String(path).toLowerCase();
      return colors.some(color => lower.includes(color));
    });
    if (typed && exists(typed)) return typed;

    for (const color of colors) {
      const explicit = root + "." + color;
      if (exists(explicit)) return explicit;
    }

    // Assets cujo próprio nome já representa claramente o tipo podem ser
    // usados sem recoloração. Para assets genéricos, se não existir variante
    // da cor correta, caímos no pulso nativo da cor do tipo.
    if (JB2A_INHERENT_TYPE_PATHS.has(root) && exists(root)) return root;
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
        ?? [],
        type
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
        ?? [],
        type
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




async function applyExplicitEffectToActor(
  actor,
  effect,
  multiplier,
  tokenId = null
) {
  const applied =
    await applyEffectsToActor(
      actor,
      [effect],
      multiplier,
      3
    );

  return {
    actorId:
      actor.id,

    tokenId,
    applied
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


async function removeFloatingStatusDirect(
  payload
) {
  if (!isAuthority()) {
    throw new Error(
      "Somente o GM ativo pode remover efeitos Pokémon."
    );
  }

  const scene =
    game.scenes.get(
      payload.sceneId
    );

  const token =
    scene?.tokens?.get(
      payload.targetTokenId
    )
    ?? null;

  const actor =
    token?.actor
    ?? (
      payload.actorId
        ? game.actors.get(
            payload.actorId
          )
        : null
    );

  if (!actor) {
    throw new Error(
      "O alvo do Status não foi encontrado."
    );
  }

  const statusId =
    moveIdentity(
      payload.statusName
    );

  if (!statusId) {
    throw new Error(
      "Status inválido."
    );
  }

  const current =
    foundry.utils.deepClone(
      actor.system
        ?.floatingTagsAndStatuses
      ?? []
    );

  const next =
    current.filter(
      entry => {
        const isStatus =
          entry?.isStatus === true
          ||
          Number(
            entry?.value
            ?? 0
          ) > 0;

        const same =
          isStatus
          &&
          entry?.positive === false
          &&
          moveIdentity(
            entry?.name
          ) === statusId;

        return !same;
      }
    );

  if (
    next.length
      === current.length
  ) {
    return {
      removed:
        false
    };
  }

  await actor.update({
    "system.floatingTagsAndStatuses":
      next
  });

  return {
    removed:
      true,

    actorId:
      actor.id,

    tokenId:
      token?.id
      ?? null,

    statusName:
      payload.statusName
  };
}




// POKEMON_CONTEXT_SPEND_V2
function floatingSpendState(entry) {
  if (!entry) return { present: false };
  const isStatus = entry?.isStatus === true || Number(entry?.value ?? 0) > 0;
  const markings = Array(6).fill(false);
  if (isStatus) {
    if (Array.isArray(entry?.markings)) {
      for (let i = 0; i < 6; i++) markings[i] = entry.markings[i] === true;
    } else {
      const tier = Math.max(1, Math.min(6, Number(entry?.value ?? 1) || 1));
      markings[tier - 1] = true;
    }
  }
  return {
    present: true,
    name: moveIdentity(entry?.name),
    isStatus,
    positive: entry?.positive !== false,
    burned: entry?.burned === true,
    value: isStatus ? Math.max(1, Math.min(6, Number(entry?.value ?? 1) || 1)) : 0,
    markings: isStatus ? markings : null
  };
}

function sameFloatingSpendIdentity(entry, state) {
  if (!entry || !state?.present) return false;
  const current = floatingSpendState(entry);
  return current.name === state.name
    && current.isStatus === state.isStatus
    && current.positive === state.positive;
}

function sameFloatingSpendState(a, b) {
  if (!!a?.present !== !!b?.present) return false;
  if (!a?.present) return true;
  return a.name === b.name
    && a.isStatus === b.isStatus
    && a.positive === b.positive
    && (a.burned === true) === (b.burned === true)
    && Number(a.value ?? 0) === Number(b.value ?? 0)
    && JSON.stringify(a.markings ?? null) === JSON.stringify(b.markings ?? null);
}

async function sceneDataItemForSpend(sceneId) {
  let item = game.items.find(candidate =>
    candidate.type === "scene-data"
    && candidate.system?.sceneKey === sceneId
  ) ?? null;
  if (item) return item;
  const scene = game.scenes.get(sceneId);
  if (!scene) throw new Error("Cena da consequência não encontrada.");
  item = await Item.create({
    name: "Scene Data: " + scene.name,
    type: "scene-data",
    flags: { mistmod: { hidden: true } }
  });
  await item.update({ "system.sceneKey": sceneId });
  return item;
}

async function applyFloatingSpendDelta(document, effect, multiplier = 1) {
  if (!document) throw new Error("Destino da consequência não encontrado.");
  if (multiplier === 0 && String(effect?.target ?? "target").toLowerCase() !== "self") {
    return { applied: false, immune: true };
  }
  const entry = statusEntry(effect, multiplier);
  if (!entry) return { applied: false };
  const current = foundry.utils.deepClone(document.system?.floatingTagsAndStatuses ?? []);
  const wanted = floatingSpendState(entry);
  const beforeIndex = current.findIndex(row => sameFloatingSpendIdentity(row, wanted));
  const beforeEntry = beforeIndex >= 0 ? foundry.utils.deepClone(current[beforeIndex]) : null;
  const before = floatingSpendState(beforeEntry);
  const next = stackFloating(current, entry);
  const afterIndex = next.findIndex(row => sameFloatingSpendIdentity(row, wanted));
  const afterEntry = afterIndex >= 0 ? foundry.utils.deepClone(next[afterIndex]) : null;
  const after = floatingSpendState(afterEntry);
  if (sameFloatingSpendState(before, after)) {
    return { applied: false, unchanged: true };
  }
  await document.update({ "system.floatingTagsAndStatuses": next });
  return {
    applied: true,
    documentId: document.id,
    documentName: document.documentName,
    before,
    beforeEntry,
    after,
    afterEntry
  };
}

function toggleFloatingTagSpendState(
  list,
  selector
) {
  const current =
    foundry.utils.deepClone(
      Array.isArray(list)
        ? list
        : []
    );

  const wanted = {
    present: true,
    name: moveIdentity(selector?.name),
    isStatus: false,
    positive: selector?.positive !== false
  };

  const index =
    current.findIndex(
      row =>
        sameFloatingSpendIdentity(
          row,
          wanted
        )
    );

  if (index < 0) {
    return {
      applied: false,
      unchanged: true
    };
  }

  const beforeEntry =
    foundry.utils.deepClone(
      current[index]
    );

  const before =
    floatingSpendState(
      beforeEntry
    );

  const afterEntry =
    foundry.utils.deepClone(
      beforeEntry
    );

  afterEntry.burned =
    beforeEntry?.burned !== true;

  afterEntry.toBurn = false;
  afterEntry.selected = false;

  current[index] =
    afterEntry;

  return {
    applied: true,
    next: current,
    before,
    beforeEntry,
    after:
      floatingSpendState(
        afterEntry
      ),
    afterEntry:
      foundry.utils.deepClone(
        afterEntry
      )
  };
}


async function toggleFloatingTagSpendDelta(
  document,
  selector
) {
  const change =
    toggleFloatingTagSpendState(
      document.system?.floatingTagsAndStatuses
        ?? [],
      selector
    );

  if (!change.applied) {
    return change;
  }

  await document.update({
    "system.floatingTagsAndStatuses":
      change.next
  });

  return {
    applied: true,
    documentId:
      document.id,
    documentName:
      document.documentName,
    before:
      change.before,
    beforeEntry:
      change.beforeEntry,
    after:
      change.after,
    afterEntry:
      change.afterEntry
  };
}

function themeTagSpendState(entry, field) {
  if (!entry) return { present: false };
  return floatingSpendState({
    ...entry,
    isStatus: false,
    value: 0,
    positive: field === "powertags"
  });
}

function themeTagSpendDocument(actor, selector) {
  if (!actor || selector?.storage !== "theme") return null;
  const item = actor.items?.get?.(selector.itemId) ?? null;
  const field = selector.field === "weaknesstags" ? "weaknesstags" : "powertags";
  const index = Number(selector.index);
  if (!item || !Number.isInteger(index) || index < 0) return null;
  return { item, field, index };
}

async function toggleThemeTagSpendDelta(actor, selector) {
  const resolved = themeTagSpendDocument(actor, selector);
  if (!resolved) return { applied: false, unchanged: true };
  const { item, field, index } = resolved;
  const current = foundry.utils.deepClone(item.system?.[field] ?? []);
  const beforeEntry = current[index] ? foundry.utils.deepClone(current[index]) : null;
  if (!beforeEntry) return { applied: false, unchanged: true };

  const expectedName = moveIdentity(selector?.name);
  if (expectedName && moveIdentity(beforeEntry?.name) !== expectedName) {
    return { applied: false, unchanged: true };
  }

  const before = themeTagSpendState(beforeEntry, field);
  const afterEntry = foundry.utils.deepClone(beforeEntry);
  afterEntry.burned = beforeEntry?.burned !== true;
  afterEntry.selected = false;
  afterEntry.toBurn = false;
  current[index] = afterEntry;
  await item.update({ ["system." + field]: current });

  return {
    applied: true,
    storage: "theme",
    documentId: item.id,
    documentName: "Item",
    themeItemId: item.id,
    themeField: field,
    themeIndex: index,
    before,
    beforeEntry,
    after: themeTagSpendState(afterEntry, field),
    afterEntry: foundry.utils.deepClone(afterEntry)
  };
}

function themeSpendOptionsForActor(label, destination, actor) {
  const rows = [];
  for (const item of actor?.items ?? []) {
    if (item.type !== "themebook") continue;
    for (const field of ["powertags", "weaknesstags"]) {
      const positive = field === "powertags";
      const tags = Array.isArray(item.system?.[field]) ? item.system[field] : [];
      tags.forEach((entry, index) => {
        if (!entry?.name || entry?.planned === true || entry?.expired === true) return;
        const state = themeTagSpendState(entry, field);
        rows.push({
          label: label + " · " + item.name + " · " + String(entry.name),
          action: state.burned ? "Recuperar" : "Riscar",
          destination,
          state,
          selector: {
            storage: "theme",
            itemId: item.id,
            field,
            index,
            name: state.name,
            positive
          }
        });
      });
    }
  }
  return rows;
}

async function reduceFloatingStatusSpendDelta(document, selector, amount) {
  const current = foundry.utils.deepClone(document.system?.floatingTagsAndStatuses ?? []);
  const wanted = {
    present: true,
    name: moveIdentity(selector?.name),
    isStatus: true,
    positive: selector?.positive !== false
  };
  const index = current.findIndex(row => sameFloatingSpendIdentity(row, wanted));
  if (index < 0) return { applied: false, unchanged: true };
  const beforeEntry = foundry.utils.deepClone(current[index]);
  const before = floatingSpendState(beforeEntry);
  const reduction = Math.max(1, Math.min(6, Number(amount ?? 1) || 1));
  const nextTier = Math.max(0, before.value - reduction);
  if (nextTier <= 0) {
    current.splice(index, 1);
  } else {
    const nextEntry = foundry.utils.deepClone(current[index]);
    const markings = Array(6).fill(false);
    markings[nextTier - 1] = true;
    nextEntry.value = nextTier;
    nextEntry.isStatus = true;
    nextEntry.markings = markings;
    current[index] = nextEntry;
  }
  await document.update({ "system.floatingTagsAndStatuses": current });
  const afterEntry = nextTier > 0 ? current[index] : null;
  return {
    applied: true,
    documentId: document.id,
    documentName: document.documentName,
    before,
    beforeEntry,
    after: floatingSpendState(afterEntry),
    afterEntry: afterEntry ? foundry.utils.deepClone(afterEntry) : null
  };
}

function spendTargetDocument(scene, row) {
  if (row?.targetKind === "scene") return game.items.get(row.documentId) ?? null;
  if (row?.tokenId) return scene?.tokens?.get(row.tokenId)?.actor ?? null;
  return row?.actorId ? game.actors.get(row.actorId) : null;
}

function spendRollbackPlan(scene, row) {
  const targetActor = row?.tokenId
    ? scene?.tokens?.get(row.tokenId)?.actor ?? null
    : row?.actorId
      ? game.actors.get(row.actorId) ?? null
      : null;

  if (row?.storage === "theme") {
    const item = targetActor?.items?.get?.(row.themeItemId) ?? null;
    const field = row.themeField === "weaknesstags" ? "weaknesstags" : "powertags";
    const index = Number(row.themeIndex);
    if (!item || !Number.isInteger(index) || index < 0) return null;
    const current = foundry.utils.deepClone(item.system?.[field] ?? []);
    const currentState = themeTagSpendState(current[index] ?? null, field);
    return { kind: "theme", document: item, field, index, current, currentState, row };
  }

  const document = row?.targetKind === "scene"
    ? game.items.get(row.documentId) ?? null
    : targetActor;
  if (!document) return null;
  const current = foundry.utils.deepClone(document.system?.floatingTagsAndStatuses ?? []);
  const identity = row.after?.present ? row.after : row.before;
  const index = current.findIndex(entry => sameFloatingSpendIdentity(entry, identity));
  const currentState = floatingSpendState(index >= 0 ? current[index] : null);
  return { kind: "floating", document, index, current, currentState, row };
}

async function writeSpendRollbackState(plan, stateName) {
  const row = plan.row;
  const wanted = row?.[stateName];
  const wantedEntry = row?.[stateName + "Entry"];

  if (plan.kind === "theme") {
    const current = foundry.utils.deepClone(plan.document.system?.[plan.field] ?? []);
    if (!wanted?.present || !wantedEntry) {
      throw new Error("Tag de Theme ausente durante rollback.");
    }
    current[plan.index] = foundry.utils.deepClone(wantedEntry);
    await plan.document.update({ ["system." + plan.field]: current });
    return;
  }

  const current = foundry.utils.deepClone(plan.document.system?.floatingTagsAndStatuses ?? []);
  const identity = row.after?.present ? row.after : row.before;
  const index = current.findIndex(entry => sameFloatingSpendIdentity(entry, identity));
  if (wanted?.present) {
    if (index >= 0) current[index] = foundry.utils.deepClone(wantedEntry);
    else current.push(foundry.utils.deepClone(wantedEntry));
  } else if (index >= 0) {
    current.splice(index, 1);
  }
  await plan.document.update({ "system.floatingTagsAndStatuses": current });
}



function contextSpendEffectForTarget(
  effect,
  document,
  targetKind
) {
  const prepared =
    foundry.utils.deepClone(
      effect
      ?? {}
    );

  if (
    typeof prepared.holderNegative
      === "boolean"
    &&
    targetKind === "actor"
  ) {
    prepared.positive =
      document?.type === "litm-npc"
        ? prepared.holderNegative
        : !prepared.holderNegative;
  }

  delete prepared.holderNegative;

  return prepared;
}
async function applyContextSpendDirect(payload) {
  if (!isAuthority()) throw new Error("Somente o GM ativo pode aplicar consequências de Power.");
  const scene = game.scenes.get(payload.sceneId);
  if (!scene) throw new Error("Cena da rolagem não encontrada.");
  const sourceActor = payload.sourceActorId ? game.actors.get(payload.sourceActorId) : null;
  const move = sourceActor && payload.moveId
    ? await resolveMoveForActor(sourceActor, payload.moveId)
    : null;
  const mode = String(payload.mode ?? "apply");
  const destination = payload.destination ?? {};
  const targets = [];

  if (destination.kind === "scene") {
    targets.push({ targetKind: "scene", document: await sceneDataItemForSpend(scene.id), tokenId: null, actorId: null });
  } else if (destination.kind === "self") {
    const token = scene.tokens.get(payload.sourceTokenId) ?? null;
    const actor = token?.actor ?? sourceActor;
    if (actor) targets.push({ targetKind: "actor", document: actor, tokenId: token?.id ?? null, actorId: actor.id });
  } else {
    for (const tokenId of destination.tokenIds ?? []) {
      const token = scene.tokens.get(tokenId);
      if (token?.actor) targets.push({ targetKind: "actor", document: token.actor, tokenId: token.id, actorId: token.actor.id });
    }
  }

  if (!targets.length) throw new Error("Nenhum destino válido para a consequência.");

  // Evita aplicar duas vezes no mesmo Actor quando dois tokens linked
  // apontam para o mesmo documento. Challenges unlinked continuam únicos
  // pelo tokenId, que é sua identidade real na cena.
  const uniqueTargets = [];
  const seenTargets = new Set();
  for (const target of targets) {
    const token = target.tokenId ? scene.tokens.get(target.tokenId) : null;
    const key = target.targetKind === "scene"
      ? "scene:" + target.document.id
      : token?.actorLink === false
        ? "token:" + target.tokenId
        : "actor:" + target.actorId;
    if (seenTargets.has(key)) continue;
    seenTargets.add(key);
    uniqueTargets.push(target);
  }

  const rows = [];
  const skippedImmune = [];

  try {
    for (const target of uniqueTargets) {
      let delta = null;
      if (mode === "apply") {
        let multiplier = 1;
        if (target.targetKind === "actor" && move && payload.pokemonSuggested === true) {
          multiplier = multiplierFor(target.document, move.type ?? "normal");
          if (multiplier === 0) {
            skippedImmune.push(target.tokenId ?? target.actorId);
            continue;
          }
        } else if (target.targetKind === "actor" && move && String(payload.effect?.source ?? "") === "damage") {
          multiplier = multiplierFor(target.document, move.type ?? "normal");
        }
        const targetEffect = contextSpendEffectForTarget(
          payload.effect,
          target.document,
          target.targetKind
        );
        delta = await applyFloatingSpendDelta(target.document, targetEffect, multiplier);
      } else if (mode === "toggle-tag" || mode === "remove-tag") {
        delta = payload.selector?.storage === "theme" && target.targetKind === "actor"
          ? await toggleThemeTagSpendDelta(target.document, payload.selector)
          : await toggleFloatingTagSpendDelta(target.document, payload.selector);
      } else if (mode === "reduce-status") {
        delta = await reduceFloatingStatusSpendDelta(target.document, payload.selector, payload.amount);
      }
      if (!delta?.applied) continue;
      rows.push({
        ...delta,
        targetKind: target.targetKind,
        tokenId: target.tokenId,
        actorId: target.actorId
      });
    }
  } catch (error) {
    if (rows.length) {
      try {
        await rollbackContextSpendDirect({ sceneId: scene.id, application: { rows } });
      } catch (rollbackError) {
        console.error("Pokemon LITM Tools | rollback de aplicação parcial:", rollbackError);
      }
    }
    throw error;
  }

  return { rows, skippedImmune };
}

async function rollbackContextSpendDirect(payload) {
  if (!isAuthority()) throw new Error("Somente o GM ativo pode reverter um gasto de Power.");
  const scene = game.scenes.get(payload.sceneId);
  if (!scene) throw new Error("Cena da rolagem não encontrada.");
  const conflicts = [];
  const plans = [];

  // Fase 1: valida todos os destinos antes de escrever qualquer coisa.
  for (const row of payload.application?.rows ?? []) {
    const plan = spendRollbackPlan(scene, row);
    if (!plan) {
      conflicts.push("destino ausente");
      continue;
    }
    if (!sameFloatingSpendState(plan.currentState, row.after)) {
      conflicts.push((row.before?.name || row.after?.name || "efeito") + " mudou desde o gasto");
      continue;
    }
    plans.push(plan);
  }

  if (conflicts.length) {
    throw new Error("Não foi possível reverter com segurança: " + conflicts.join("; ") + ".");
  }

  const completed = [];
  try {
    for (const plan of plans) {
      await writeSpendRollbackState(plan, "before");
      completed.push(plan);
    }
  } catch (error) {
    // Se uma escrita falhar, recoloca os destinos já restaurados no estado
    // pós-gasto. O ledger só é removido quando todo o rollback é seguro.
    for (const plan of completed.reverse()) {
      try {
        await writeSpendRollbackState(plan, "after");
      } catch (compensationError) {
        console.error("Pokemon LITM Tools | compensação de rollback:", compensationError);
      }
    }
    throw error;
  }

  return {
    restored: plans.map(plan => plan.row.documentId ?? plan.row.actorId ?? plan.row.tokenId)
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
    else if (message.action === "context-spend-apply") result = await applyContextSpendDirect(message.payload);
    else if (message.action === "context-spend-rollback") result = await rollbackContextSpendDirect(message.payload);
    else if (message.action === "remove-status") result = await removeFloatingStatusDirect(message.payload);
    else if (message.action === "delete-combat") result = await deleteCombatProjectionDirect(message.payload);
    else if (message.action === "cleanup-instance") result = await cleanupPokemonInstanceDirect(message.payload);
    else if (message.action === "guided-consequence") result = await applyGuidedChallengeConsequenceDirect(message.payload);
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
    if (action === "context-spend-apply") return applyContextSpendDirect(payload);
    if (action === "context-spend-rollback") return rollbackContextSpendDirect(payload);
    if (action === "remove-status") return removeFloatingStatusDirect(payload);
    if (action === "delete-combat") return deleteCombatProjectionDirect(payload);
    if (action === "cleanup-instance") return cleanupPokemonInstanceDirect(payload);
    if (action === "guided-consequence") return applyGuidedChallengeConsequenceDirect(payload);
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

  if (
    profile?.baseStats
    &&
    typeof profile.baseStats
      === "object"
  ) {
    return profile.baseStats;
  }

  const sourceTheme =
    sourceThemeForCombatActor(
      actor
    );

  const themeStats =
    sourceTheme?.getFlag?.(
      MODULE_ID,
      "baseStats"
    );

  if (
    themeStats
    &&
    typeof themeStats
      === "object"
  ) {
    return themeStats;
  }

  return null;
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



const POKEMON_ATTACK_HINDERING_STATUS_IDS =
  new Set([
    "paralisado",
    "paralyzed",
    "paralysis",
    "congelado",
    "frozen",
    "freeze",
    "adormecido",
    "asleep",
    "sleep",
    "preso",
    "trapped",
    "restrained",
    "imobilizado",
    "immobilized",
    "atordoado",
    "stunned",
    "sonolento",
    "drowsy"
  ]);


function attackHinderingStatusesForActor(
  actor
) {
  const rows = [];

  for (
    const entry
    of actor?.system
      ?.floatingTagsAndStatuses
      ?? []
  ) {
    const id =
      moveIdentity(
        entry?.name
      );

    const isStatus =
      entry?.isStatus === true
      ||
      Number(
        entry?.value
        ?? 0
      ) > 0;

    if (
      !isStatus
      ||
      entry?.positive !== false
      ||
      entry?.expired === true
      ||
      entry?.planned === true
      ||
      !POKEMON_ATTACK_HINDERING_STATUS_IDS.has(
        id
      )
    ) {
      continue;
    }

    rows.push({
      name:
        String(
          entry?.name
          ?? "Status desfavorável"
        ),

      value:
        Math.max(
          1,
          Math.min(
            6,
            Number(
              entry?.value
              ?? 1
            ) || 1
          )
        )
    });
  }

  return rows.sort(
    (
      a,
      b
    ) =>
      b.value
      - a.value
  );
}


function challengeStatusContextForTargets(
  targets
) {
  const rows =
    (
      targets
      ?? []
    )
      .filter(
        token =>
          !!token?.actor
      )
      .map(
        token => ({
          token,

          status:
            attackHinderingStatusesForActor(
              token.actor
            )[0]
            ?? null
        })
      );

  /*
   * Uma rolagem contra vários alvos só recebe esta
   * vantagem se TODOS estiverem prejudicados.
   * Usa-se o menor tier comum, preservando o alvo
   * mais difícil em vez de somar Status.
   */
  if (
    !rows.length
    ||
    rows.some(
      row =>
        !row.status
    )
  ) {
    return null;
  }

  const value =
    Math.min(
      ...rows.map(
        row =>
          row.status.value
      )
    );

  if (
    !Number.isFinite(
      value
    )
    ||
    value <= 0
  ) {
    return null;
  }

  const statusIds =
    new Set(
      rows.map(
        row =>
          moveIdentity(
            row.status.name
          )
      )
    );

  const statusName =
    statusIds.size === 1
      ? rows[0].status.name
      : "Status desfavorável";

  const targetName =
    rows[0].token?.name
    ?? rows[0].token?.actor?.name
    ?? "Alvo";

  return {
    value,
    positive:
      true,

    name:
      rows.length === 1
        ? (
            targetName
            + " · "
            + statusName
          )
        : (
            "Alvos prejudicados · "
            + statusName
          )
  };
}


function moveDealsTypedDamage(
  move
) {
  return (
    Number(
      move?.power
      ?? 0
    ) > 0
    &&
    String(
      move?.damageClass
      ?? "status"
    ).toLocaleLowerCase()
      !== "status"
  );
}


function immuneTargetsForMove(
  move,
  targets
) {
  if (
    !moveDealsTypedDamage(
      move
    )
  ) {
    return [];
  }

  return (
    targets
    ?? []
  ).filter(
    token =>
      multiplierForActorType(
        token?.actor,
        move?.type
          ?? "normal"
      ) === 0
  );
}

function allTargetsImmuneToMove(
  move,
  targets
) {
  const validTargets =
    (
      targets
      ?? []
    ).filter(
      token =>
        !!token?.actor
    );

  return (
    validTargets.length > 0
    &&
    moveDealsTypedDamage(
      move
    )
    &&
    immuneTargetsForMove(
      move,
      validTargets
    ).length
      === validTargets.length
  );
}


function pokemonMoveTypeLabel(
  move
) {
  const text =
    String(
      moveLitmProfile(
        move
        ?? {}
      )?.typeText
      ?? move?.type
      ?? "tipo"
    )
      .replace(
        /^Tipo:\s*/i,
        ""
      )
      .trim();

  return text
    || "deste tipo";
}


function createPokemonImmunityWarning(
  move,
  targets
) {
  const immune =
    immuneTargetsForMove(
      move,
      targets
    );

  if (!immune.length) {
    return null;
  }

  const allImmune =
    immune.length
      === (
        targets
        ?? []
      ).length;

  const names =
    immune
      .map(
        token =>
          token?.name
          ?? token?.actor?.name
          ?? "Alvo"
      )
      .join(", ");

  const warning =
    document.createElement(
      "div"
    );

  warning.className =
    "pokemon-litm-immunity-warning";

  warning.innerHTML =
    '<i class="fa-solid fa-triangle-exclamation"></i> <strong>'
    + esc(
        names
      )
    + "</strong> "
    + (
        immune.length === 1
          ? "é imune"
          : "são imunes"
      )
    + " ao dano "
    + esc(
        pokemonMoveTypeLabel(
          move
        )
      )
    + ". "
    + (
        allImmune
          ? "A rolagem continua válida para outras consequências ficcionais, mas dano não é uma consequência válida para "
            + (
                immune.length === 1
                  ? "esse alvo."
                  : "esses alvos."
              )
          : "A rolagem ainda pode causar dano nos demais alvos e gerar outras consequências ficcionais."
      );

  return warning;
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


function speedContextForMove(
  move,
  sourceActor,
  targets
) {
  const language =
    sourceActor?.getFlag?.(
      MODULE_ID,
      "contentLanguage"
    )
    ?? "pt-BR";

  const rule =
    move?.speedRule
    ??
    moveSpeedRule(
      move?.id,
      language
    );

  if (
    !rule
    ||
    !targets?.length
  ) {
    return null;
  }

  const sourceSpeed =
    Number(
      pokemonBaseStats(
        sourceActor
      )?.speed
    );

  if (
    !Number.isFinite(
      sourceSpeed
    )
  ) {
    return null;
  }

  const threshold =
    Math.max(
      1,
      Number(
        rule.threshold
        ?? 20
      )
    );

  const rows =
    targets.map(
      token => {
        const targetSpeed =
          Number(
            pokemonBaseStats(
              token?.actor
            )?.speed
          );

        if (
          !Number.isFinite(
            targetSpeed
          )
        ) {
          return {
            token,
            qualifies:
              false,
            difference:
              0
          };
        }

        const difference =
          rule.mode
            === "slower"
            ? (
                targetSpeed
                - sourceSpeed
              )
            : (
                sourceSpeed
                - targetSpeed
              );

        return {
          token,
          targetSpeed,
          difference,

          qualifies:
            difference
              >= threshold
        };
      }
    );

  /*
   * Uma única rolagem contra vários targets
   * só recebe a vantagem se a relação de Speed
   * fizer sentido contra todos eles.
   */
  if (
    !rows.length
    ||
    !rows.every(
      row =>
        row.qualifies
    )
  ) {
    return null;
  }

  const hardest =
    rows
      .slice()
      .sort(
        (
          a,
          b
        ) =>
          a.difference
          - b.difference
      )[0];

  return {
    value:
      1,

    positive:
      true,

    name:
      (
        move?.name
        ?? move?.id
        ?? "Golpe"
      )
      + " · "
      + (
          rule.rollLabel
          ?? (
            rule.mode
              === "slower"
              ? "Mais lento que o alvo"
              : "Mais rápido que o alvo"
          )
        ),

    targetId:
      hardest?.token?.id
      ?? null,

    rule
  };
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



function pokemonMoveBurnKey(
  row
) {
  if (
    !row?.item
    ||
    !Number.isInteger(
      Number(
        row?.binding
          ?.tagIndex
      )
    )
  ) {
    return "";
  }

  return (
    row.item.id
    + ":"
    + Number(
        row.binding.tagIndex
      )
  );
}


function pokemonPreparedMoveTag(
  app,
  row
) {
  if (
    !app
    ||
    !row?.item
  ) {
    return null;
  }

  const index =
    Number(
      row.binding
        ?.tagIndex
    );

  return (
    (
      app.selectedTags
      ?? []
    ).find(
      tag =>
        tag?.powerTag
          === true
        &&
        tag.themebookId
          === row.item.id
        &&
        Number(
          tag.index
        ) === index
    )
    ?? null
  );
}


function pokemonMoveBurnContext(
  app,
  actor,
  move
) {
  if (
    !app
    ||
    !actor
    ||
    !move?.id
    ||
    app.rollType
      === "reaction"
  ) {
    return null;
  }

  const rows =
    selectedMoveBindingsForActor(
      actor
    ).filter(
      row =>
        row?.move?.id
          === move.id
    );

  if (
    rows.length !== 1
  ) {
    return null;
  }

  const row =
    rows[0];

  const prepared =
    pokemonPreparedMoveTag(
      app,
      row
    );

  if (!prepared) {
    return null;
  }

  const mechanics =
    moveLitmProfile(
      move
    );

  const key =
    pokemonMoveBurnKey(
      row
    );

  return {
    row,
    prepared,
    key,

    effort:
      mechanics.effort
      ?? null,

    available:
      row.tag?.burned
        !== true
      &&
      row.tag?.planned
        !== true,

    active:
      prepared.toBurn
        === true,

    suggested:
      mechanics.effort
        ?.burnSuggested
        === true
  };
}


function restorePokemonMoveBurnIntent(
  app,
  actor,
  move
) {
  const context =
    pokemonMoveBurnContext(
      app,
      actor,
      move
    );

  if (
    !context
    ||
    !context.available
  ) {
    return context;
  }

  if (
    app._pokemonMoveBurnIntent
      !== context.key
  ) {
    return context;
  }

  /*
   * O LitM permite apenas um Burn
   * de Power Tag por rolagem.
   */
  for (
    const tag
    of app.selectedTags
      ?? []
  ) {
    if (
      tag !== context.prepared
      &&
      tag?.toBurn
        === true
    ) {
      tag.toBurn =
        false;
    }
  }

  context.prepared.toBurn =
    true;

  context.active =
    true;

  return context;
}


function togglePokemonMoveBurn(
  app,
  actor,
  move
) {
  const context =
    pokemonMoveBurnContext(
      app,
      actor,
      move
    );

  if (
    !context
    ||
    !context.available
  ) {
    return;
  }

  if (
    context.active
  ) {
    context.prepared.toBurn =
      false;

    app._pokemonMoveBurnIntent =
      null;

  } else {
    /*
     * Um único Burn por rolagem,
     * conforme a matemática nativa do LitM.
     */
    for (
      const tag
      of app.selectedTags
        ?? []
    ) {
      if (
        tag?.toBurn
          === true
      ) {
        tag.toBurn =
          false;
      }
    }

    context.prepared.toBurn =
      true;

    app._pokemonMoveBurnIntent =
      context.key;
  }

  try {
    app.render(
      true,
      {
        focus:
          false
      }
    );

  } catch (
    error
  ) {
    console.warn(
      "Pokemon LITM Tools | Atualizando preview de Burn:",
      error
    );
  }
}


function appendPokemonMoveBurnControl(
  app,
  actor,
  move,
  section
) {
  const context =
    pokemonMoveBurnContext(
      app,
      actor,
      move
    );

  if (
    !context
    ||
    !context.available
  ) {
    return;
  }

  const block =
    document.createElement(
      "div"
    );

  block.className =
    "pokemon-litm-move-burn";

  block.dataset
    .pokemonMoveBurn =
      "true";

  if (
    context.active
  ) {
    block.classList.add(
      "active"
    );
  }

  const text =
    document.createElement(
      "small"
    );

  const effortText =
    context.effort?.label
      ? (
          "Esforço: "
          + context.effort.label
          + ". "
        )
      : "";

  text.textContent =
    effortText
    +
    (
      context.suggested
        ? "Golpe exigente: forçar é uma opção narrativa apropriada. "
        : "Você pode forçar esta técnica. "
    )
    +
    "A Tag do golpe vale +3 em vez de +1 nesta rolagem e fica riscada depois.";

  block.append(
    text
  );

  const button =
    actionButton(
      context.active
        ? "Não forçar o golpe"
        : "Forçar golpe · Tag vale +3",

      context.active
        ? "fa-rotate-left"
        : "fa-fire-flame-curved",

      () =>
        togglePokemonMoveBurn(
          app,
          actor,
          move
        )
    );

  button.dataset
    .pokemonMoveBurnToggle =
      "true";

  block.append(
    button
  );

  section.append(
    block
  );
}



function stripPokemonSyntheticRollTags(
  app
) {
  for (
    const key
    of [
      "selectedTags",
      "challengeTags"
    ]
  ) {
    app[key] =
      (
        app[key]
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

  if (
    !Array.isArray(
      app.challengeTags
    )
  ) {
    app.challengeTags = [];
  }

  app.challengeTags.push({
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


function pushSyntheticRollTag(
  app,
  {
    name,
    positive,
    source
  }
) {
  if (
    !Array.isArray(
      app.challengeTags
    )
  ) {
    app.challengeTags = [];
  }

  app.challengeTags.push({
    name,

    positive:
      positive === true,

    source,

    value:
      0,

    isStatus:
      false,

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


function clearPokemonRollLayout(
  root
) {
  if (!root) return;

  const layout =
    root.querySelector(
      "[data-pokemon-roll-layout]"
    );

  if (layout) {
    const native =
      layout.querySelector(
        ":scope > [data-pokemon-roll-native]"
      );

    const host =
      layout.parentElement;

    if (
      native
      &&
      host
    ) {
      const fragment =
        document.createDocumentFragment();

      while (
        native.firstChild
      ) {
        fragment.append(
          native.firstChild
        );
      }

      host.insertBefore(
        fragment,
        layout
      );
    }

    layout.remove();
  }

  const windowRoot =
    root.closest(
      ".window-app, .application"
    );

  windowRoot?.classList.remove(
    "pokemon-litm-roll-window"
  );
}


function mountPokemonRollSidePanel(
  root,
  section
) {
  clearPokemonRollLayout(
    root
  );

  const host =
    root.matches?.(
      "form"
    )
      ? root
      : root.querySelector(
          "form"
        )
        ?? root;

  const layout =
    document.createElement(
      "div"
    );

  layout.className =
    "pokemon-litm-roll-layout";

  layout.dataset
    .pokemonRollLayout =
      "true";

  const native =
    document.createElement(
      "div"
    );

  native.className =
    "pokemon-litm-roll-native";

  native.dataset
    .pokemonRollNative =
      "true";

  const nodes =
    Array.from(
      host.childNodes
    );

  for (
    const node
    of nodes
  ) {
    native.append(
      node
    );
  }

  section.classList.add(
    "pokemon-litm-roll-side"
  );

  layout.append(
    native,
    section
  );

  host.append(
    layout
  );

  const windowRoot =
    root.closest(
      ".window-app, .application"
    );

  windowRoot?.classList.add(
    "pokemon-litm-roll-window"
  );
}



function renderPokemonAutomaticChallengeRows(
  root,
  automatic
) {
  if (!root) return;

  const container =
    Array.from(
      root.querySelectorAll(
        ".selected-tags-container"
      )
    ).find(
      element =>
        /Challenge Tags\s*\/\s*Status selected/i.test(
          element.querySelector(
            "label"
          )?.textContent
          ?? ""
        )
    );

  if (!container) {
    return;
  }

  container
    .querySelectorAll(
      "[data-pokemon-auto-challenge]"
    )
    .forEach(
      element =>
        element.remove()
    );

  for (
    const tag
    of automatic
      ?? []
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
        )
      + (
          tag.isStatus
            ? " status"
            : ""
        );

    row.dataset
      .pokemonAutoChallenge =
        "true";

    row.title =
      "Aplicado automaticamente pelo Pokémon LITM Tools";

    row.innerHTML =
      '<span class="tag-icon"><i class="fa-solid '
      + (
          tag.positive
            ? "fa-thumbs-up"
            : "fa-thumbs-down"
        )
      + '"></i></span>'
      + esc(
          tag.name
        )
      + (
          tag.isStatus
          &&
          Number(
            tag.value
            ?? 0
          ) > 0
            ? (
                "-"
                + Number(
                    tag.value
                  )
              )
            : ""
        );

    container.append(
      row
    );
  }
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

  if (
    !reaction
    &&
    move
  ) {
    const immunityWarning =
      createPokemonImmunityWarning(
        move,
        targets
      );

    if (immunityWarning) {
      section.append(
        immunityWarning
      );
    }

    appendPokemonMoveBurnControl(
      app,
      app.actor,
      move,
      section
    );
  }

  const automatic =
    [
      ...(
        app.challengeTags
        ?? []
      ),
      ...(
        app.selectedTags
        ?? []
      )
    ].filter(
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
        + (
            tag.isStatus
              ? Number(
                  tag.value
                  ?? 1
                )
              : 1
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

  mountPokemonRollSidePanel(
    root,
    section
  );

  renderPokemonAutomaticChallengeRows(
    root,
    automatic
  );

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
    !isLitmDiceRollApp(
      app
    )
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
      clearPokemonRollLayout(
        root
      );
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
    clearPokemonRollLayout(
      root
    );

    return;
  }

  restorePokemonMoveBurnIntent(
    app,
    actor,
    move
  );

  const targets =
    targetDocuments();

  const allImmune =
    allTargetsImmuneToMove(
      move,
      targets
    );

  const defense =
    allImmune
      ? null
      : defensiveContextForTargets(
          move,
          targets
        );

  if (
    defense?.modifier
  ) {
    /*
     * Defense/Sp. Defense vem de Tags LitM (ou do
     * fallback equivalente) e portanto entra como Tag,
     * não como Status. Assim ela pode coexistir com
     * um Status como paralisado-1 sem violar a regra
     * nativa de empilhamento de Status.
     */
    pushSyntheticRollTag(
      app,
      {
        name:
          defense.name,

        positive:
          defense.positive,

        source:
          POKEMON_MOVE_AUTO_SOURCE
      }
    );
  }

  const challengeStatus =
    challengeStatusContextForTargets(
      targets
    );

  if (
    challengeStatus?.value
  ) {
    pushSyntheticRollStatus(
      app,
      {
        name:
          challengeStatus.name,

        value:
          challengeStatus.value,

        positive:
          true,

        source:
          POKEMON_MOVE_AUTO_SOURCE
      }
    );
  }

  const speed =
    speedContextForMove(
      move,
      actor,
      targets
    );

  if (
    speed?.value
  ) {
    pushSyntheticRollTag(
      app,
      {
        name:
          speed.name,

        positive:
          speed.positive,

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
      challengeConsequenceTierDelta(
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

  const targetKind = String(effect?.target ?? "target").toLowerCase();
  if (targetKind === "scene") {
    ui.notifications.info(
      "Este efeito altera o campo. Use a Area como referencia visual e resolva o efeito na ficcao."
    );
    return;
  }

  if (targetKind === "self") {
    await applyEffectsToActor(sourceActor, [effect], 1, 3);
    return;
  }

  const targets = targetDocuments();
  if (!targets.length) {
    ui.notifications.warn("Marque pelo menos um alvo antes de aplicar o efeito.");
    return;
  }

  const sourceToken = sourceTokenForActor(sourceActor);
  await applyGuidedChallengeConsequence({
    sceneId: canvas.scene.id,
    sourceActorId: sourceActor.id,
    sourceTokenId: sourceToken?.id ?? null,
    moveId: move?.id ?? null,
    targetTokenIds: targets.map(token => token.id),
    effect: foundry.utils.deepClone(effect)
  });
}

async function applyGuidedChallengeConsequenceDirect(payload) {
  if (!isAuthority()) throw new Error("Somente o GM ativo pode aplicar consequências guiadas.");
  const scene = game.scenes.get(payload.sceneId);
  if (!scene) throw new Error("Cena da consequência não encontrada.");

  const sourceToken = payload.sourceTokenId ? scene.tokens.get(payload.sourceTokenId) ?? null : null;
  const sourceActor = sourceToken?.actor
    ?? (payload.sourceActorId ? game.actors.get(payload.sourceActorId) : null);
  const move = sourceActor && payload.moveId
    ? await resolveMoveForActor(sourceActor, payload.moveId)
    : null;
  const effect = foundry.utils.deepClone(payload.effect ?? {});
  if (!effect?.name) throw new Error("Consequência inválida.");

  const baseLevel = Math.max(1, Math.min(6, Number(effect.level ?? 1) || 1));
  const report = [];

  for (const tokenId of payload.targetTokenIds ?? []) {
    const token = scene.tokens.get(tokenId);
    const actor = token?.actor ?? null;
    if (!actor) continue;

    let multiplier = 1;
    let delta = 0;
    if (move) {
      multiplier = multiplierFor(actor, move.type ?? "normal");
      if (multiplier === 0) {
        report.push({
          actorId: actor.id,
          tokenId: token.id,
          targetName: token.name ?? actor.name,
          multiplier,
          multiplierLabel: matchupLabel(multiplier),
          immune: true,
          applied: []
        });
        continue;
      }
      if (String(effect.source ?? "") === "damage") {
        delta = challengeConsequenceTierDelta(multiplier) ?? 0;
      }
    }

    const finalLevel = baseLevel + delta;
    if (finalLevel <= 0) {
      report.push({
        actorId: actor.id,
        tokenId: token.id,
        targetName: token.name ?? actor.name,
        multiplier,
        multiplierLabel: matchupLabel(multiplier),
        resisted: true,
        applied: []
      });
      continue;
    }

    const finalEffect = {
      ...effect,
      level: Math.min(6, finalLevel),
      source: String(effect.source ?? "") === "damage"
        ? "guided-challenge-damage"
        : effect.source
    };
    const applied = await applyEffectsToActor(actor, [finalEffect], 1, 3);
    report.push({
      actorId: actor.id,
      tokenId: token.id,
      targetName: token.name ?? actor.name,
      multiplier,
      multiplierLabel: move ? matchupLabel(multiplier) : "",
      finalLevel: finalEffect.level,
      applied
    });
  }

  return { report };
}

export function applyGuidedChallengeConsequence(payload) {
  return requestAuthority("guided-consequence", payload);
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



function iconActionButton(title, icon, handler) {
  const button = actionButton("", icon, handler);
  button.classList.add("pokemon-chat-vfx-icon");
  button.title = title;
  button.setAttribute("aria-label", title);
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
  effect,
  availablePower = 6
) {
  if (
    effect?.intrinsic
      === true
  ) {
    return 0;
  }

  if (
    effect?.kind
      === "tag"
  ) {
    return 2;
  }

  const preferred =
    Math.max(
      1,
      Math.min(
        6,
        Number(
          effect?.level
          ?? 1
        )
        || 1
      )
    );

  const available =
    Math.max(
      1,
      Math.min(
        6,
        Number(
          availablePower
          ?? 1
        )
        || 1
      )
    );

  return Math.min(
    preferred,
    available
  );
}




function contextSpendDestinationRows(sourceToken, frozenTargetIds, eligibleIds = null, allowScene = true) {
  const rows = [];
  const allowed = eligibleIds ? new Set(eligibleIds) : null;
  const targets = targetDocuments(frozenTargetIds).filter(token => !allowed || allowed.has(token.id));
  if (targets.length > 1) {
    rows.push({ value: "all", label: "Todos os alvos válidos" });
  }
  for (const token of targets) {
    rows.push({ value: "token:" + token.id, label: token.name ?? token.actor?.name ?? "Alvo" });
  }
  if (sourceToken) rows.push({ value: "self", label: "Usuário do golpe" });
  if (allowScene) rows.push({ value: "scene", label: "Cena · Tags & Statuses" });
  return rows;
}

function contextSpendDestinationHtml(rows, selected = null) {
  return rows.map(row => '<option value="' + esc(row.value) + '"'
    + (selected === row.value ? ' selected' : '') + '>' + esc(row.label) + '</option>').join("");
}

function contextSpendDestination(value, frozenTargetIds) {
  if (value === "scene") return { kind: "scene" };
  if (value === "self") return { kind: "self" };
  if (value === "all") return { kind: "targets", tokenIds: [...frozenTargetIds] };
  if (String(value).startsWith("token:")) return { kind: "targets", tokenIds: [String(value).slice(6)] };
  return null;
}

function pokemonSuggestedEligibleIds(move, effect, frozenTargetIds) {
  const targetKind = String(effect?.target ?? "target").toLowerCase();
  if (targetKind !== "target") return [...frozenTargetIds];
  return targetDocuments(frozenTargetIds)
    .filter(token => multiplierFor(token.actor, move?.type ?? "normal") !== 0)
    .map(token => token.id);
}

function pokemonSuggestedEffectAllowed(move, effect, frozenTargetIds) {
  if (String(effect?.target ?? "target").toLowerCase() !== "target") return true;
  if (!frozenTargetIds.length) return false;
  return pokemonSuggestedEligibleIds(move, effect, frozenTargetIds).length > 0;
}

export async function commitContextSpend(message, entry, applyPayload) {
  const data = foundry.utils.deepClone(message.getFlag?.(LITM_SYSTEM_ID, "detailedSpend"));
  if (!data) throw new Error("A mensagem não possui Detailed Spend.");
  const cost = Math.max(1, Number(entry.cost ?? 1) || 1);
  if (detailedSpendRemaining(data) < cost) throw new Error("Power insuficiente.");

  const application = await requestAuthority("context-spend-apply", applyPayload);
  if (!(application?.rows?.length)) {
    if (application?.skippedImmune?.length) throw new Error("O alvo é imune a este efeito do golpe.");
    throw new Error("A consequência não alterou o destino selecionado.");
  }

  data.entries ??= [];
  data.entries.push({
    ...entry,
    type: "pokemon-context",
    cost,
    pokemonApplied: true,
    pokemonApplication: application
  });

  try {
    await updateDetailedSpendMessage(message, data);
  } catch (error) {
    try {
      await requestAuthority("context-spend-rollback", {
        sceneId: applyPayload.sceneId,
        application
      });
    } catch (rollbackError) {
      console.error("Pokemon LITM Tools | rollback após falha do chat:", rollbackError);
    }
    throw error;
  }
}

async function rollbackContextSpendEntry(message, index) {
  const original = foundry.utils.deepClone(message.getFlag?.(LITM_SYSTEM_ID, "detailedSpend"));
  const entry = original?.entries?.[index];
  if (!entry?.pokemonApplication) return false;
  const sceneId = message.getFlag?.(MODULE_ID, "rollSceneId") ?? canvas?.scene?.id;
  const next = foundry.utils.deepClone(original);
  next.entries.splice(index, 1);

  // Primeiro atualiza o ledger nativo. Se o rollback mecânico recusar
  // (por conflito externo), a entrada é restaurada no chat.
  await updateDetailedSpendMessage(message, next);
  try {
    await requestAuthority("context-spend-rollback", {
      sceneId,
      application: entry.pokemonApplication
    });
  } catch (error) {
    const rollbackMessage =
      String(error?.message ?? error ?? "");

    const externalConflict =
      rollbackMessage.includes(
        "Não foi possível reverter com segurança:"
      );

    if (externalConflict) {
      console.warn(
        "Pokemon LITM Tools | Refund-only: alvo mudou após o gasto.",
        error
      );

      ui.notifications.info(
        "Gasto devolvido. O alvo mudou desde a aplicação, então o efeito não foi revertido."
      );

      // O ledger já foi atualizado acima.
      // Mantemos o estado atual do alvo exatamente como está.
      return true;
    }

    // Erro inesperado: preserva a transação original e recoloca
    // a entrada no ledger para não perder Power indevidamente.
    try {
      await updateDetailedSpendMessage(message, original);
    } catch (restoreError) {
      console.error(
        "Pokemon LITM Tools | restaurando ledger após falha de rollback:",
        restoreError
      );
    }

    throw error;
  }

  return true;
}

async function chooseContextEffectSpend({ message, actor, move, sourceToken, frozenTargetIds, effect, label, pokemonSuggested = true }) {
  const data = message.getFlag?.(LITM_SYSTEM_ID, "detailedSpend");
  const remaining = detailedSpendRemaining(data);
  if (remaining <= 0) return;
  const kind = String(effect?.kind ?? "status");
  const targetKind = String(effect?.target ?? "target").toLowerCase();
  const eligibleIds = pokemonSuggested
    ? pokemonSuggestedEligibleIds(move, effect, frozenTargetIds)
    : [...frozenTargetIds];
  if (targetKind === "target" && !eligibleIds.length) return;

  const destinations = targetKind === "self"
    ? [{ value: "self", label: "Usuário do golpe" }]
    : targetKind === "scene"
      ? [{ value: "scene", label: "Cena · Tags & Statuses" }]
      : contextSpendDestinationRows(sourceToken, frozenTargetIds, eligibleIds, !pokemonSuggested);

  if (!destinations.length) throw new Error("Nenhum destino válido.");
  const isTag = kind === "tag";
  const maxLevel = isTag
    ? 2
    : String(effect?.source ?? "") === "damage"
      ? remaining
      : Math.min(remaining, Math.max(1, Number(effect?.level ?? 1) || 1));
  if (isTag && remaining < 2) throw new Error("São necessários 2 Power para uma Tag.");
  const levelOptions = isTag ? "" : Array.from({ length: maxLevel }, (_, i) => {
    const level = i + 1;
    return '<option value="' + level + '"' + (level === maxLevel ? ' selected' : '') + '>'
      + level + ' Power → ' + esc(label) + '-' + level + '</option>';
  }).join("");

  const choice = await foundry.applications.api.DialogV2.input({
    window: { title: label },
    content: '<div class="pokemon-context-spend-dialog">'
      + '<label>Destino<select name="destination">' + contextSpendDestinationHtml(destinations, destinations[0].value) + '</select></label>'
      + (isTag ? '<p>Esta Tag custa 2 Power.</p>' : '<label>Power / tier<select name="level">' + levelOptions + '</select></label>')
      + '</div>',
    ok: { label: "Gastar e aplicar", icon: "fa-solid fa-check" },
    modal: true
  });
  if (!choice) return;
  const cost = isTag ? 2 : Math.max(1, Math.min(maxLevel, Number(choice.level ?? maxLevel) || maxLevel));
  const appliedEffect = foundry.utils.deepClone(effect);
  if (!isTag) appliedEffect.level = cost;
  const destination = contextSpendDestination(choice.destination, eligibleIds);
  if (!destination) throw new Error("Destino inválido.");
  await commitContextSpend(message, {
    cost,
    label: label + (isTag ? "" : "-" + cost),
    pokemonMoveId: move?.id ?? null
  }, {
    sceneId: canvas.scene.id,
    sourceActorId: actor.id,
    sourceTokenId: sourceToken?.id ?? null,
    moveId: move?.id ?? null,
    mode: "apply",
    destination,
    effect: appliedEffect,
    pokemonSuggested
  });
}

async function promptCustomContextSpend({ message, actor, move, sourceToken, frozenTargetIds, kind }) {
  const data = message.getFlag?.(LITM_SYSTEM_ID, "detailedSpend");
  const remaining = detailedSpendRemaining(data);
  const isTag = kind === "tag";
  if (isTag && remaining < 2) throw new Error("São necessários 2 Power para uma Tag.");
  if (!isTag && remaining < 1) return;
  const destinations = contextSpendDestinationRows(sourceToken, frozenTargetIds, null, true);
  const levelOptions = Array.from({ length: Math.min(6, remaining) }, (_, i) => {
    const level = i + 1;
    return '<option value="' + level + '">' + level + ' Power → tier ' + level + '</option>';
  }).join("");
  const choice = await foundry.applications.api.DialogV2.input({
    window: { title: isTag ? "Criar Tag" : "Criar Status" },
    content: '<div class="pokemon-context-spend-dialog">'
      + '<label>Nome<input name="name" type="text" autofocus></label>'
      + '<label>Destino<select name="destination">' + contextSpendDestinationHtml(destinations, destinations[0]?.value) + '</select></label>'
      + (isTag ? '<p>Esta Tag custa 2 Power.</p>' : '<label>Power / tier<select name="level">' + levelOptions + '</select></label>')
      + '<label class="pokemon-context-checkbox"><input name="negative" type="checkbox" checked> Efeito negativo</label>'
      + '</div>',
    ok: { label: "Gastar e aplicar", icon: "fa-solid fa-check" },
    modal: true
  });
  if (!choice) return;
  const name = String(choice.name ?? "").trim();
  if (!name) throw new Error("Digite o nome da Tag ou Status.");
  const holderNegative =
    [true, "true", "on", "1", 1]
      .includes(
        choice.negative
      );
  const cost = isTag ? 2 : Math.max(1, Math.min(6, remaining, Number(choice.level ?? 1) || 1));
  const destination = contextSpendDestination(choice.destination, frozenTargetIds);
  await commitContextSpend(message, {
    cost,
    label: name + (isTag ? "" : "-" + cost),
    pokemonMoveId: move?.id ?? null
  }, {
    sceneId: canvas.scene.id,
    sourceActorId: actor.id,
    sourceTokenId: sourceToken?.id ?? null,
    moveId: move?.id ?? null,
    mode: "apply",
    destination,
    effect: {
      target: destination.kind === "self" ? "self" : destination.kind === "scene" ? "scene" : "target",
      kind: isTag ? "tag" : "status",
      name,
      level: isTag ? 1 : cost,
      positive: !holderNegative,
      holderNegative,
      source: "context-spend",
      trigger: "principal"
    },
    pokemonSuggested: false
  });
}

function currentFloatingSpendOptions(sourceToken, frozenTargetIds, wantStatus) {
  const rows = [];
  const addDocument = (label, destination, document) => {
    for (const entry of document?.system?.floatingTagsAndStatuses ?? []) {
      const state = floatingSpendState(entry);
      if (!state.present || state.isStatus !== wantStatus) continue;
      const action = state.isStatus ? "" : state.burned ? "Recuperar" : "Riscar";
      rows.push({
        label: label + " · " + String(entry.name ?? "efeito") + (state.isStatus ? "-" + state.value : ""),
        action,
        destination,
        state,
        selector: {
          storage: "floating",
          name: state.name,
          positive: state.positive
        }
      });
    }

    if (!wantStatus && document?.documentName === "Actor") {
      rows.push(...themeSpendOptionsForActor(label, destination, document));
    }
  };

  for (const token of targetDocuments(frozenTargetIds)) {
    addDocument(
      token.name ?? token.actor?.name ?? "Alvo",
      { kind: "targets", tokenIds: [token.id] },
      token.actor
    );
  }

  if (sourceToken) {
    addDocument(
      "Usuário do golpe",
      { kind: "self" },
      sourceToken.actor ?? sourceToken.document?.actor
    );
  }

  const sceneItem = game.items.find(item =>
    item.type === "scene-data"
    && item.system?.sceneKey === canvas?.scene?.id
  );
  if (sceneItem) addDocument("Cena", { kind: "scene" }, sceneItem);
  return rows;
}

async function promptReduceExistingStatus({ message, actor, move, sourceToken, frozenTargetIds }) {
  const remaining = detailedSpendRemaining(message.getFlag?.(LITM_SYSTEM_ID, "detailedSpend"));
  const rows = currentFloatingSpendOptions(sourceToken, frozenTargetIds, true).filter(row => row.state.value > 0);
  if (!rows.length) throw new Error("Não há Status disponível para reduzir.");
  const first = await foundry.applications.api.DialogV2.input({
    window: { title: "Reduzir Status" },
    content: '<div class="pokemon-context-spend-dialog"><label>Status<select name="index">'
      + rows.map((row, index) => '<option value="' + index + '">' + esc(row.label) + '</option>').join("")
      + '</select></label></div>',
    ok: { label: "Continuar", icon: "fa-solid fa-arrow-right" }, modal: true
  });
  if (!first) return;
  const row = rows[Number(first.index)];
  if (!row) return;
  const max = Math.min(remaining, row.state.value);
  const second = await foundry.applications.api.DialogV2.input({
    window: { title: "Quanto reduzir?" },
    content: '<div class="pokemon-context-spend-dialog"><label>Power<select name="amount">'
      + Array.from({ length: max }, (_, i) => '<option value="' + (i + 1) + '">' + (i + 1) + ' Power</option>').join("")
      + '</select></label></div>',
    ok: { label: "Gastar e reduzir", icon: "fa-solid fa-check" }, modal: true
  });
  if (!second) return;
  const amount = Math.max(1, Math.min(max, Number(second.amount ?? 1) || 1));
  await commitContextSpend(message, {
    cost: amount,
    label: "Reduzir " + row.label,
    pokemonMoveId: move?.id ?? null
  }, {
    sceneId: canvas.scene.id,
    sourceActorId: actor.id,
    sourceTokenId: sourceToken?.id ?? null,
    moveId: move?.id ?? null,
    mode: "reduce-status",
    destination: row.destination,
    selector: { name: row.state.name, positive: row.state.positive },
    amount,
    pokemonSuggested: false
  });
}

async function promptRemoveExistingTag({ message, actor, move, sourceToken, frozenTargetIds }) {
  const remaining = detailedSpendRemaining(
    message.getFlag?.(LITM_SYSTEM_ID, "detailedSpend")
  );

  if (remaining < 2) {
    throw new Error("São necessários 2 Power para riscar ou recuperar uma Tag.");
  }

  const rows = currentFloatingSpendOptions(sourceToken, frozenTargetIds, false);
  if (!rows.length) {
    throw new Error("Não há Tag disponível para riscar/recuperar.");
  }

  const choice = await foundry.applications.api.DialogV2.input({
    window: { title: "Riscar / recuperar Tag" },
    content:
      '<div class="pokemon-context-spend-dialog"><label>Tag<select name="index">'
      + rows.map((row, index) =>
          '<option value="' + index + '">' + esc(row.action + ": " + row.label) + '</option>'
        ).join("")
      + '</select></label></div>',
    ok: { label: "Gastar 2 Power", icon: "fa-solid fa-check" },
    modal: true
  });
  if (!choice) return;

  const row = rows[Number(choice.index)];
  if (!row) return;

  await commitContextSpend(
    message,
    {
      cost: 2,
      label: row.action + " " + row.label,
      pokemonMoveId: move?.id ?? null
    },
    {
      sceneId: canvas.scene.id,
      sourceActorId: actor.id,
      sourceTokenId: sourceToken?.id ?? null,
      moveId: move?.id ?? null,
      mode: "toggle-tag",
      destination: row.destination,
      selector: foundry.utils.deepClone(row.selector ?? {
        storage: "floating",
        name: row.state.name,
        positive: row.state.positive
      }),
      pokemonSuggested: false
    }
  );
}

function pokemonSpendSuggestions(actor, move, frozenTargetIds) {
  const suggestions = [];
  if (Number(move?.power ?? 0) > 0 && String(move?.damageClass ?? "status") !== "status") {
    const damage = { target: "target", kind: "status", name: "ferido", level: 1, positive: false, source: "damage", trigger: "principal" };
    if (pokemonSuggestedEffectAllowed(move, damage, frozenTargetIds)) suggestions.push({ effect: damage, label: "Dano", narrative: "" });
  }
  effectsForMove(actor, move).forEach((effect, index) => {
    if (effect?.intrinsic === true || String(effect?.source ?? "") === "damage") return;
    if (!pokemonSuggestedEffectAllowed(move, effect, frozenTargetIds)) return;
    suggestions.push({ effect, index, label: String(effect?.name ?? "efeito"), narrative: String(effect?.chanceNarrative ?? "").trim() });
  });
  return suggestions;
}

async function openNativePokemonStatusSpend(context) {
  const { message, actor, move, sourceToken, frozenTargetIds } = context;
  const suggestions = pokemonSpendSuggestions(actor, move, frozenTargetIds).filter(row => row.effect?.kind !== "tag");
  const options = suggestions.map((row, index) => '<option value="suggestion:' + index + '">Sugestão: ' + esc(row.label) + '</option>');
  options.push('<option value="custom">Criar Status personalizado…</option>');
  options.push('<option value="reduce">Reduzir Status existente…</option>');
  const choice = await foundry.applications.api.DialogV2.input({
    window: { title: "Give / reduce a status" },
    content: '<div class="pokemon-context-spend-dialog"><label>Consequência<select name="choice">' + options.join("") + '</select></label></div>',
    ok: { label: "Continuar", icon: "fa-solid fa-arrow-right" }, modal: true
  });
  if (!choice) return;
  if (choice.choice === "custom") return promptCustomContextSpend({ ...context, kind: "status" });
  if (choice.choice === "reduce") return promptReduceExistingStatus(context);
  const index = Number(String(choice.choice).split(":")[1]);
  const row = suggestions[index];
  if (row) return chooseContextEffectSpend({ ...context, effect: row.effect, label: row.label, pokemonSuggested: true });
}

async function openNativePokemonTagSpend(context) {
  const { actor, move, frozenTargetIds } = context;
  const suggestions = pokemonSpendSuggestions(actor, move, frozenTargetIds).filter(row => row.effect?.kind === "tag");
  const options = suggestions.map((row, index) => '<option value="suggestion:' + index + '">Sugestão: ' + esc(row.label) + '</option>');
  options.push('<option value="custom">Criar Tag personalizada…</option>');
  options.push('<option value="remove">Riscar / recuperar Tag existente…</option>');
  const choice = await foundry.applications.api.DialogV2.input({
    window: { title: "Add / scratch / recover a tag" },
    content: '<div class="pokemon-context-spend-dialog"><label>Consequência<select name="choice">' + options.join("") + '</select></label></div>',
    ok: { label: "Continuar", icon: "fa-solid fa-arrow-right" }, modal: true
  });
  if (!choice) return;
  if (choice.choice === "custom") return promptCustomContextSpend({ ...context, kind: "tag" });
  if (choice.choice === "remove") return promptRemoveExistingTag(context);
  const index = Number(String(choice.choice).split(":")[1]);
  const row = suggestions[index];
  if (row) return chooseContextEffectSpend({ ...context, effect: row.effect, label: row.label, pokemonSuggested: true });
}

function wirePokemonNativeSpendControls(context) {
  const { message, root } = context;
  if (!message.isAuthor && !game.user.isGM) return;
  if (!root || root.dataset.pokemonContextSpendWired === "true") return;
  root.dataset.pokemonContextSpendWired = "true";
  root.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    const undo = target?.closest?.("[data-spend-undo]");
    if (undo) {
      const index = Number(undo.dataset.spendUndo);
      const entry = message.getFlag?.(LITM_SYSTEM_ID, "detailedSpend")?.entries?.[index];
      if (entry?.pokemonApplication) {
        event.preventDefault();
        event.stopImmediatePropagation();
        void rollbackContextSpendEntry(message, index).catch(error => {
          console.error("Pokemon LITM Tools | reverter gasto:", error);
          ui.notifications.error(error?.message ?? "Não foi possível reverter o gasto.");
        });
      }
      return;
    }
    const button = target?.closest?.("[data-spend-option]");
    const option = button?.dataset?.spendOption;
    if (option !== "status" && option !== "tag") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const handler = option === "status" ? openNativePokemonStatusSpend : openNativePokemonTagSpend;
    void handler(context).catch(error => {
      console.error("Pokemon LITM Tools | gasto contextual:", error);
      ui.notifications.error(error?.message ?? "Não foi possível gastar Power.");
    });
  }, true);
}


export async function spendPokemonPower(
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
        true;

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
      predicate
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
    predicate
  );
}


function appliedStateControl() {
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

  return state;
}


function appendMoveMechanicsToChat(
  panel,
  move,
  targetIds
) {
  const targetBadges =
    document.createElement(
      "div"
    );

  targetBadges.className =
    "pokemon-litm-mechanic-badges pokemon-chat-matchup-badges";

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


function recoverableNegativeStatuses(
  targetIds
) {
  const ignored =
    new Set([
      "ferido",
      "wounded",
      "ferido-pelo-recuo",
      "hurt-by-recoil"
    ]);

  const rows = [];
  const seen = new Set();

  for (
    const token
    of targetDocuments(
      targetIds
    )
  ) {
    const list =
      token.actor?.system
        ?.floatingTagsAndStatuses
      ?? [];

    for (
      const entry
      of list
    ) {
      const isStatus =
        entry?.isStatus === true
        ||
        Number(
          entry?.value
          ?? 0
        ) > 0;

      const id =
        moveIdentity(
          entry?.name
        );

      if (
        !isStatus
        ||
        entry?.positive !== false
        ||
        entry?.expired === true
        ||
        entry?.planned === true
        ||
        !id
        ||
        ignored.has(id)
      ) {
        continue;
      }

      const level =
        Math.max(
          1,
          Math.min(
            6,
            Number(
              entry?.value
              ?? 1
            ) || 1
          )
        );

      const key =
        token.id
        + "|"
        + id;

      if (
        seen.has(
          key
        )
      ) {
        continue;
      }

      seen.add(
        key
      );

      rows.push({
        tokenId:
          token.id,

        actorId:
          token.actor?.id
          ?? null,

        targetName:
          token.name
          ?? token.actor?.name
          ?? "Alvo",

        statusName:
          String(
            entry?.name
            ?? "efeito"
          ),

        level
      });
    }
  }

  return rows;
}


function appendRecoverySuggestions({
  section,
  targetIds,
  editable
}) {
  const rows =
    recoverableNegativeStatuses(
      targetIds
    );

  if (!rows.length) {
    return;
  }

  const block =
    document.createElement(
      "div"
    );

  block.className =
    "pokemon-litm-recovery-suggestions";

  const title =
    document.createElement(
      "small"
    );

  title.innerHTML =
    "<strong>Recuperação possível</strong>";

  block.append(
    title
  );

  for (
    const row
    of rows
  ) {
    const line =
      document.createElement(
        "div"
      );

    line.className =
      "pokemon-litm-suggestion-row";

    const text =
      document.createElement(
        "span"
      );

    text.textContent =
      row.targetName
      + " pode ter se recuperado de "
      + row.statusName
      + "-"
      + row.level;

    line.append(
      text
    );

    const button =
      actionButton(
        "Remover "
        + row.statusName
        + "-"
        + row.level,

        "fa-heart-pulse",

        () =>
          requestAuthority(
            "remove-status",
            {
              sceneId:
                canvas.scene.id,

              targetTokenId:
                row.tokenId,

              actorId:
                row.actorId,

              statusName:
                row.statusName
            }
          )
      );

    button.disabled =
      !editable;

    line.append(
      button
    );

    block.append(
      line
    );
  }

  section.append(
    block
  );
}


async function choosePokemonEffectPurchase(
  effect,
  remaining
) {
  if (
    effect?.intrinsic
      === true
  ) {
    return null;
  }

  if (
    effect?.kind
      === "tag"
  ) {
    if (
      remaining < 2
    ) {
      return null;
    }

    return {
      level:
        null,

      cost:
        2
    };
  }

  const maxLevel =
    pokemonEffectPowerCost(
      effect,
      remaining
    );

  if (
    maxLevel <= 1
  ) {
    return {
      level:
        1,

      cost:
        1
    };
  }

  const options =
    Array.from(
      {
        length:
          maxLevel
      },
      (
        _,
        index
      ) => {
        const level =
          index + 1;

        return (
          '<option value="'
          + level
          + '"'
          + (
              level === maxLevel
                ? " selected"
                : ""
            )
          + ">"
          + level
          + " Power → "
          + String(
              effect?.name
              ?? "efeito"
            )
          + "-"
          + level
          + "</option>"
        );
      }
    ).join(
      ""
    );

  const choice =
    await foundry.applications.api.DialogV2.input({
      window: {
        title:
          "Intensidade do efeito"
      },

      content:
        '<div style="display:grid;gap:8px;padding:8px">'
        + "<p>Quanto Power deseja gastar neste efeito?</p>"
        + '<select name="level">'
        + options
        + "</select>"
        + "</div>",

      ok: {
        label:
          "Confirmar",

        icon:
          "fa-solid fa-check"
      },

      modal:
        true
    });

  if (!choice) {
    return null;
  }

  const level =
    Math.max(
      1,
      Math.min(
        maxLevel,
        Number(
          choice.level
          ?? maxLevel
        )
      )
    );

  return {
    level,

    cost:
      level
  };
}


function pokemonIntrinsicApplicationKey(
  move,
  index
) {
  return (
    String(
      move?.id
      ?? "move"
    )
    + ":"
    + Number(
        index
        ?? 0
      )
  );
}


function pokemonIntrinsicApplications(
  message
) {
  const raw =
    message?.getFlag?.(
      MODULE_ID,
      "pokemonIntrinsicApplications"
    );

  return (
    raw
    &&
    typeof raw
      === "object"
  )
    ? foundry.utils.deepClone(
        raw
      )
    : {};
}


async function writePokemonIntrinsicApplications(
  message,
  applications
) {
  if (
    Object.keys(
      applications
      ?? {}
    ).length
  ) {
    await message.setFlag(
      MODULE_ID,
      "pokemonIntrinsicApplications",
      applications
    );

  } else {
    await message.unsetFlag(
      MODULE_ID,
      "pokemonIntrinsicApplications"
    );
  }
}


async function applyPokemonIntrinsicEffect({
  message,
  actor,
  move,
  sourceToken,
  targetIds,
  effect,
  index
}) {
  const applications =
    pokemonIntrinsicApplications(
      message
    );

  const key =
    pokemonIntrinsicApplicationKey(
      move,
      index
    );

  if (
    applications[key]
  ) {
    return;
  }

  const sceneId =
    canvas?.scene?.id;

  if (!sceneId) {
    throw new Error(
      "Cena ativa não encontrada."
    );
  }

  await requestAuthority(
    "apply-explicit",
    {
      sceneId,

      sourceActorId:
        actor.id,

      sourceTokenId:
        sourceToken?.id
        ?? null,

      moveId:
        move.id,

      targetTokenIds:
        targetIds
        ?? [],

      effect:
        foundry.utils.deepClone(
          effect
        )
    }
  );

  applications[key] = {
    sceneId,
    applied:
      true
  };

  await writePokemonIntrinsicApplications(
    message,
    applications
  );
}


function appendPokemonIntrinsicEffects({
  message,
  actor,
  move,
  section,
  sourceToken,
  targetIds,
  effects,
  editable
}) {
  const intrinsic =
    (
      effects
      ?? []
    )
      .map(
        (
          effect,
          index
        ) => ({
          effect,
          index
        })
      )
      .filter(
        row =>
          row.effect?.intrinsic
            === true
      );

  if (
    !intrinsic.length
  ) {
    return;
  }

  const applications =
    pokemonIntrinsicApplications(
      message
    );

  const block =
    document.createElement(
      "div"
    );

  block.className =
    "pokemon-litm-spend-purchased pokemon-litm-intrinsic-costs";

  const hint =
    document.createElement(
      "small"
    );

  hint.innerHTML =
    "<strong>Custos intrínsecos do golpe</strong>"
    + " · não consomem Power";

  block.append(
    hint
  );

  for (
    const row
    of intrinsic
  ) {
    const effect =
      row.effect;

    const key =
      pokemonIntrinsicApplicationKey(
        move,
        row.index
      );

    const applied =
      !!applications[key];

    const line =
      document.createElement(
        "div"
      );

    line.className =
      "pokemon-litm-purchased-row";

    const label =
      document.createElement(
        "span"
      );

    label.textContent =
      "Custo: "
      + String(
          effect?.name
          ?? "efeito"
        )
      + (
          effect?.kind
            === "tag"
            ? ""
            : (
                "-"
                + Number(
                    effect?.level
                    ?? 1
                  )
              )
        );

    line.append(
      label
    );

    if (applied) {
      line.append(
        appliedStateControl()
      );

    } else {
      const button =
        actionButton(
          "Aplicar custo",
          "fa-check",
          () =>
            applyPokemonIntrinsicEffect({
              message,
              actor,
              move,
              sourceToken,
              targetIds,
              effect,
              index:
                row.index
            })
        );

      button.disabled =
        !editable;

      line.append(
        button
      );
    }

    block.append(
      line
    );
  }

  section.append(
    block
  );
}


function addPokemonDetailedSpendControls(
  message,
  actor,
  move,
  panel,
  sourceToken,
  frozenTargetIds
) {
  const data = message.getFlag?.(LITM_SYSTEM_ID, "detailedSpend");
  if (!data || Number(data.consequenceResult ?? -1) < 0 || Number(data.total ?? 0) <= 0) return;

  // As sugestões Pokémon agora vivem DENTRO dos botões nativos de Spend
  // Power. O painel extra não duplica mais opções no chat; aqui ficam apenas
  // custos intrínsecos que não consomem Power (ex.: recarga).
  const effects = effectsForMove(actor, move);
  const intrinsicSection = document.createElement("div");
  appendPokemonIntrinsicEffects({
    message,
    actor,
    move,
    section: intrinsicSection,
    sourceToken,
    targetIds: frozenTargetIds,
    effects,
    editable: message.isAuthor || game.user.isGM
  });
  if (intrinsicSection.children.length) panel.append(intrinsicSection);
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
  const actor = game.actors.get(message?.speaker?.actor);
  if (!actor) return;
  if (!game.user.isGM && !actor.isOwner) return;

  const root = html instanceof HTMLElement
    ? html
    : html?.[0] instanceof HTMLElement
      ? html[0]
      : null;
  if (!root) return;

  const reaction = message.getFlag?.(MODULE_ID, "pokemonReaction");
  if (reaction) {
    await addPokemonReactionResultPanel(message, root, reaction);
    return;
  }

  const move = await moveFromChatMessage(message, actor);
  if (!move) return;
  if (root.querySelector("[data-pokemon-chat-actions]")) return;

  const sceneId = message.getFlag?.(MODULE_ID, "rollSceneId");
  const frozenTargetIds = message.getFlag?.(MODULE_ID, "rollTargetTokenIds") ?? [];
  const panel = document.createElement("div");
  panel.className = "pokemon-chat-move-actions";
  panel.dataset.pokemonChatActions = "true";

  appendMoveMechanicsToChat(panel, move, frozenTargetIds);

  const immunityWarning = createPokemonImmunityWarning(move, targetDocuments(frozenTargetIds));
  if (immunityWarning) panel.append(immunityWarning);

  const buttons = document.createElement("div");
  buttons.className = "pokemon-chat-move-buttons pokemon-chat-vfx-buttons";
  panel.append(buttons);

  const sourceToken = () => {
    if (sceneId && sceneId !== canvas?.scene?.id) throw new Error("Abra a cena onde a rolagem foi feita.");
    const token = sourceTokenForMessageActor(actor, move);
    if (!token) throw new Error("Token do Pokémon não encontrado.");
    return token.document ?? token;
  };

  buttons.append(
    iconActionButton("VFX no Token", "fa-wand-magic-sparkles", async () => {
      const source = sourceToken();
      const selfTarget = ["self", "user", "users-field"].includes(String(move?.target ?? "").toLowerCase());
      const ids = selfTarget
        ? [source.id]
        : replayVfxTargetIds(frozenTargetIds);

      if (!ids.length) {
        throw new Error(
          "Selecione um alvo no Foundry para reproduzir o VFX."
        );
      }
      await broadcastMoveVfx(canvas.scene.id, source.id, ids, move.type ?? "normal");
    }),
    iconActionButton("VFX em Área", "fa-circle-nodes", async () => {
      const source = sourceToken();
      await placeMoveArea(actor, move, "player", source);
    })
  );

  const detailed = message.getFlag?.(LITM_SYSTEM_ID, "detailedSpend");
  if (detailed && (!sceneId || sceneId === canvas?.scene?.id)) {
    const contextSourceToken = sourceToken();
    const context = { message, root, actor, move, sourceToken: contextSourceToken, frozenTargetIds };
    wirePokemonNativeSpendControls(context);
    addPokemonDetailedSpendControls(message, actor, move, panel, contextSourceToken, frozenTargetIds);
  }

  (root.querySelector(".message-content") ?? root).append(panel);
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


export async function pokemonLitmCombatSelfTest() {
  const checks = {};

  try {
    const module =
      await importLitmModule(
        "module/apps/dice-roll-app.mjs"
      );

    const DiceRollApp =
      module?.DiceRollApp;

    const normal =
      DiceRollApp
        ?.calculatePowerTags?.([
          {
            name:
              "Move",

            positive:
              true,

            value:
              0,

            toBurn:
              false
          }
        ]);

    const forced =
      DiceRollApp
        ?.calculatePowerTags?.([
          {
            name:
              "Move",

            positive:
              true,

            value:
              0,

            toBurn:
              true
          }
        ]);

    const twoBurns =
      DiceRollApp
        ?.calculatePowerTags?.([
          {
            name:
              "Move A",

            positive:
              true,

            value:
              0,

            toBurn:
              true
          },

          {
            name:
              "Move B",

            positive:
              true,

            value:
              0,

            toBurn:
              true
          }
        ]);

    checks.nativeBurnNormal =
      Number(
        normal?.positive
        ?? 0
      ) === 1;

    checks.nativeBurnPlusThree =
      Number(
        forced?.positive
        ?? 0
      ) === 3;

    checks.nativeSingleBurnLimit =
      Number(
        twoBurns?.positive
        ?? 0
      ) === 4;

  } catch (
    error
  ) {
    checks.nativeBurnNormal =
      false;

    checks.nativeBurnPlusThree =
      false;

    checks.nativeSingleBurnLimit =
      false;

    checks.nativeBurnError =
      error?.message
      ?? String(
        error
      );
  }

  checks.applicationUndoRemoved =
    !requestAuthority
      .toString()
      .includes(
        "undo-"
        + "explicit"
      )
    &&
    !appliedStateControl
      .toString()
      .includes(
        "rotate-left"
      )
    &&
    !appendPokemonIntrinsicEffects
      .toString()
      .includes(
        "Desfazer"
      );

  checks.rollSidePanelInstalled =
    typeof mountPokemonRollSidePanel
      === "function"
    &&
    typeof clearPokemonRollLayout
      === "function";

  checks.recoverySuggestionInstalled =
    typeof recoverableNegativeStatuses
      === "function"
    &&
    typeof removeFloatingStatusDirect
      === "function";

  checks.challengeAutoModifiersInstalled =
    typeof pushSyntheticRollTag
      === "function"
    &&
    typeof challengeStatusContextForTargets
      === "function"
    &&
    pushSyntheticRollStatus
      .toString()
      .includes(
        "challengeTags"
      );

  checks.immunityUxInstalled =
    typeof createPokemonImmunityWarning === "function"
    && typeof pokemonSuggestedEffectAllowed === "function"
    && typeof pokemonSpendSuggestions === "function";

  checks.contextSpendInstalled =
    POKEMON_CONTEXT_SPEND_REV === "2026-09-08-context-spend-v2"
    && typeof wirePokemonNativeSpendControls === "function"
    && typeof commitContextSpend === "function";

  checks.contextSpendRollbackInstalled =
    typeof applyContextSpendDirect === "function"
    && typeof rollbackContextSpendDirect === "function"
    && requestAuthority.toString().includes("context-spend-rollback");

  checks.contextSpendConflictRefundOnly =
    rollbackContextSpendEntry.toString().includes("Gasto devolvido")
    && rollbackContextSpendEntry.toString().includes(
      "Não foi possível reverter com segurança:"
    );

  checks.vfxCurrentTargetFallback =
    typeof replayVfxTargetIds === "function"
    && replayVfxTargetIds.toString().includes("game.user?.targets");

  checks.nativeSpendContextMenusInstalled =
    typeof openNativePokemonStatusSpend === "function"
    && typeof openNativePokemonTagSpend === "function"
    && typeof wirePokemonNativeSpendControls === "function";

  checks.compactPokemonChatInstalled =
    typeof iconActionButton === "function"
    && !onRenderPokemonChatMessage.toString().includes("pokemon-chat-move-header");

  checks.typeTintedVfxInstalled =
    playMoveVfxLocal.toString().includes("databasePath")
    && playMoveVfxAtPointLocal.toString().includes("databasePath")
    && !playMoveVfxLocal.toString().includes("tint(typeColor(type))")
    && !playMoveVfxAtPointLocal.toString().includes("tint(typeColor(type))");

  checks.moveBurnControlInstalled =
    typeof appendPokemonMoveBurnControl
      === "function";

  const scratchedTag =
    toggleFloatingTagSpendState(
      [
        {
          name: "Veloz como um raio",
          isStatus: false,
          positive: false,
          burned: false,
          selected: true
        }
      ],
      {
        name: "Veloz como um raio",
        positive: false
      }
    );

  const recoveredTag =
    toggleFloatingTagSpendState(
      [
        {
          name: "Veloz como um raio",
          isStatus: false,
          positive: false,
          burned: true,
          selected: false
        }
      ],
      {
        name: "Veloz como um raio",
        positive: false
      }
    );

  checks.tagScratchRecoverInstalled =
    scratchedTag.after?.burned === true
    && scratchedTag.afterEntry?.selected === false
    && recoveredTag.after?.burned === false;

  const challengeCustom =
    contextSpendEffectForTarget(
      {
        holderNegative: true,
        positive: false
      },
      {
        type: "litm-npc"
      },
      "actor"
    );

  const actorCustom =
    contextSpendEffectForTarget(
      {
        holderNegative: true,
        positive: false
      },
      {
        type: "litm-character"
      },
      "actor"
    );

  checks.challengeHolderPolarityInstalled =
    challengeCustom.positive === true
    && actorCustom.positive === false;

  checks.allImmuneDefenseSuppressionInstalled =
    typeof allTargetsImmuneToMove
      === "function"
    && decoratePokemonRollDialog
      .toString()
      .includes(
        "allTargetsImmuneToMove"
      );

  checks.themeTagScratchInstalled =
    typeof toggleThemeTagSpendDelta === "function"
    && typeof themeSpendOptionsForActor === "function";

  checks.challengeConsequenceCapInstalled =
    challengeConsequenceTierDelta(4) === 1
    && challengeConsequenceTierDelta(2) === 1
    && challengeConsequenceTierDelta(1) === 0
    && challengeConsequenceTierDelta(0.5) === -1
    && challengeConsequenceTierDelta(0.25) === -1
    && challengeConsequenceTierDelta(0) === null;

  checks.guidedConsequenceInstalled =
    typeof applyGuidedChallengeConsequence === "function"
    && requestAuthority.toString().includes("guided-consequence");

  const ok =
    Object.entries(
      checks
    )
      .filter(
        (
          [key]
        ) =>
          key
            !== "nativeBurnError"
      )
      .every(
        (
          [, value]
        ) =>
          value === true
      );

  return {
    revision:
      "2026-09-08-guided-hotfix-v1",

    checks,
    ok
  };
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
