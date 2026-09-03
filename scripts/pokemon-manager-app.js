import { getPokemonDbUrl, openPokemonDb } from "./pokemon-links.js";
import { pokemonSpecialImprovements } from "./pokemon-content.js";
import {
  getPokemonThemes,
  getPokemonFollowerThemeId,
  migratePokemonFollowerState,
  setPokemonFollowerTheme,
  removePokemonThemeTokens
} from "./pokemon-follower.js";

const MODULE_ID = "pokemon-litm-tools";
const LITM_SYSTEM_ID = "mist-engine-fvtt";
const PC_FLAG = "pokemonPC";
const RELEASED_FLAG = "pokemonReleased";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
let managerApp = null;

function pokemonThemeSystem(language = null) {
  return {
    type: "litm-variable",
    color: "litm-variable",
    quest: "",
    story: "",
    tabCategory: "main",
    powertags: [],
    weaknesstags: [],
    specialImprovements: pokemonSpecialImprovements(language ?? undefined),
    options: {isStoryTheme: false}
  };
}

function newInstanceId() { return foundry.utils.randomID(16); }

function getManagedActors() {
  return game.actors
    .filter(actor =>
      actor.type === "litm-character"
      && actor.getFlag(MODULE_ID, "combatProjection") !== true
      && actor.getFlag(MODULE_ID, "kind") !== "pokemon-combat"
      && (game.user.isGM || actor.isOwner)
    )
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function trainerOwnerIds(trainer) {
  const level = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  return Object.entries(trainer?.ownership ?? {})
    .filter(([id, value]) => id !== "default" && Number(value) >= level)
    .map(([id]) => id);
}

function pokemonBelongsToTrainer(pokemon, trainer) {
  if (!pokemon || !trainer) return false;
  if (!game.user.isGM) return pokemon.isOwner;
  if (pokemon.getFlag(MODULE_ID, "ownerTrainerId") === trainer.id) return true;
  const ids = trainerOwnerIds(trainer);
  const level = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  return ids.length > 0 && ids.some(id => Number(pokemon.ownership?.[id] ?? 0) >= level);
}

function pokemonActorsForTrainer(trainer, teamActorIds) {
  if (!trainer) return [];
  return game.actors.filter(actor => actor.id !== trainer.id
    && actor.getFlag(MODULE_ID, "kind") === "pokemon"
    && pokemonBelongsToTrainer(actor, trainer)
    && !teamActorIds.has(actor.id))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function getPcRecords(trainer) {
  const raw = trainer?.getFlag(MODULE_ID, PC_FLAG);
  return Array.isArray(raw) ? foundry.utils.deepClone(raw) : [];
}
async function setPcRecords(trainer, records) {
  await trainer.setFlag(MODULE_ID, PC_FLAG, records);
}

function getReleasedRecords(trainer) {
  const raw = trainer?.getFlag(MODULE_ID, RELEASED_FLAG);
  return Array.isArray(raw) ? foundry.utils.deepClone(raw) : [];
}
async function setReleasedRecords(trainer, records) {
  await trainer.setFlag(MODULE_ID, RELEASED_FLAG, records);
}

function ensureDataInstanceId(data) {
  data.flags ??= {};
  data.flags[MODULE_ID] ??= {};
  data.flags[MODULE_ID].pokemonInstanceId ??= newInstanceId();
  return data.flags[MODULE_ID].pokemonInstanceId;
}

async function ensurePokemonFoundation(trainer) {
  if (!trainer) return;
  await migratePokemonFollowerState(trainer);

  const themes = getPokemonThemes(trainer);
  const updates = [];

  for (const theme of themes) {
    const update = { _id: theme.id };
    let changed = false;

    if (!theme.getFlag(MODULE_ID, "pokemonInstanceId")) {
      update[`flags.${MODULE_ID}.pokemonInstanceId`] = newInstanceId();
      changed = true;
    }

    for (const key of ["pokemonActorId", "combatActorId"]) {
      const actorId = theme.getFlag(MODULE_ID, key);
      if (actorId && !game.actors.get(actorId)) {
        update[`flags.${MODULE_ID}.-=${key}`] = null;
        changed = true;
      }
    }

    if (changed) updates.push(update);
  }

  if (updates.length) {
    await trainer.updateEmbeddedDocuments("Item", updates);
  }

  async function normalizeRecords(flagName, records) {
    let changed = false;

    for (const record of records) {
      record.data ??= {};
      const before = record.data?.flags?.[MODULE_ID]?.pokemonInstanceId;
      ensureDataInstanceId(record.data);
      if (!before) changed = true;

      const flags = record.data?.flags?.[MODULE_ID] ?? {};
      for (const key of ["pokemonActorId", "combatActorId"]) {
        const actorId = flags[key];
        if (actorId && !game.actors.get(actorId)) {
          delete flags[key];
          changed = true;
        }
      }
    }

    if (changed) {
      await trainer.setFlag(MODULE_ID, flagName, records);
    }
  }

  await normalizeRecords(PC_FLAG, getPcRecords(trainer));
  await normalizeRecords(RELEASED_FLAG, getReleasedRecords(trainer));
}

function themeSnapshot(theme) {
  const data = theme.toObject();
  delete data._id;
  ensureDataInstanceId(data);
  return data;
}

async function reindexTeam(trainer) {
  const themes = getPokemonThemes(trainer);
  const updates = themes.map((theme, index) => ({_id: theme.id, [`flags.${MODULE_ID}.pokemonTeamSlot`]: index}))
    .filter((_, index) => Number(themes[index].getFlag(MODULE_ID, "pokemonTeamSlot")) !== index);
  if (updates.length) await trainer.updateEmbeddedDocuments("Item", updates);
}

function nextTeamSlot(trainer) {
  const count = getPokemonThemes(trainer).length;
  return count < 6 ? count : null;
}

export async function sendPokemonThemeToPc(trainer, themeId) {
  const theme = trainer.items.get(themeId);
  if (!theme || theme.getFlag(MODULE_ID, "pokemonTheme") !== true) {
    throw new Error("Pokémon do time não encontrado.");
  }

  const combatApi = game.modules.get(MODULE_ID)?.api;
  if (combatApi?.recollectPokemonTheme) {
    try {
      await combatApi.recollectPokemonTheme(theme);
    } catch (error) {
      console.warn("Pokemon LITM Tools | Recolher antes do PC:", error);
    }
  }

  if (getPokemonFollowerThemeId(trainer) === theme.id) {
    await setPokemonFollowerTheme(trainer, null);
  }
  await removePokemonThemeTokens(trainer, theme.id);

  const snapshot = themeSnapshot(theme);
  const records = getPcRecords(trainer);
  records.push({
    id: newInstanceId(),
    data: snapshot
  });
  await setPcRecords(trainer, records);

  await trainer.deleteEmbeddedDocuments("Item", [theme.id]);
  await reindexTeam(trainer);
}

async function ensureActorInstanceId(pokemon) {
  let id = pokemon.getFlag(MODULE_ID, "pokemonInstanceId");
  if (!id) {
    id = newInstanceId();
    if (game.user.isGM || pokemon.isOwner) await pokemon.setFlag(MODULE_ID, "pokemonInstanceId", id);
  }
  return id;
}

function buildThemeFromActor(pokemon, slot, instanceId) {
  const stored = pokemon.getFlag(MODULE_ID, "storedThemeData");
  const actorFlags = foundry.utils.deepClone(pokemon.flags?.[MODULE_ID] ?? {});
  let data = stored && typeof stored === "object" ? foundry.utils.deepClone(stored) : {
    name: pokemon.name, type: "themebook", img: pokemon.img, system: pokemonThemeSystem(), flags: {[MODULE_ID]: actorFlags}
  };
  delete data._id;
  data.name = pokemon.name;
  data.type = "themebook";
  data.img ??= pokemon.img;
  data.system ??= pokemonThemeSystem();
  data.flags ??= {};
  data.flags[MODULE_ID] = {
    ...(data.flags[MODULE_ID] ?? {}), ...actorFlags,
    pokemonTheme: true, themeRole: "pokemon", pokemonTeamSlot: slot,
    pokemonActorId: pokemon.id, pokemonInstanceId: instanceId,
    pokedexUrl: data.flags[MODULE_ID]?.pokedexUrl ?? actorFlags.pokedexUrl ?? getPokemonDbUrl(pokemon.name)
  };
  delete data.flags[MODULE_ID].storedThemeData;
  delete data.flags[MODULE_ID].ownerTrainerId;
  return data;
}

function buildThemeFromPcRecord(record, slot) {
  const data = foundry.utils.deepClone(record.data);
  delete data._id;
  data.type = "themebook";
  data.system ??= pokemonThemeSystem();
  data.flags ??= {};
  const instanceId = ensureDataInstanceId(data);
  data.flags[MODULE_ID] = {
    ...(data.flags[MODULE_ID] ?? {}), pokemonTheme: true, themeRole: "pokemon", pokemonTeamSlot: slot,
    pokemonInstanceId: instanceId,
    pokedexUrl: data.flags[MODULE_ID]?.pokedexUrl ?? getPokemonDbUrl(data.name)
  };
  return data;
}

async function addPcPokemonToTeam(trainer, source, id) {
  const slot = nextTeamSlot(trainer);
  if (slot === null) {
    throw new Error("O time já tem 6 Pokémon.");
  }

  if (source !== "stored") {
    throw new Error("O PC aceita somente Pokémon armazenados como Tema.");
  }

  const records = getPcRecords(trainer);
  const index = records.findIndex(record => record.id === id);
  if (index < 0) {
    throw new Error("Pokémon armazenado não encontrado.");
  }

  const [record] = records.splice(index, 1);
  const created =
    await trainer.createEmbeddedDocuments(
      "Item",
      [buildThemeFromPcRecord(record, slot)]
    );

  if (!created?.[0]) {
    throw new Error("Não foi possível adicionar o Pokémon ao time.");
  }

  await setPcRecords(trainer, records);
}

function snapshotCombatStateIntoData(data) {
  const instanceId = data?.flags?.[MODULE_ID]?.pokemonInstanceId;
  if (!instanceId) return data;

  const actor = game.actors.find(candidate =>
    candidate.getFlag(MODULE_ID, "combatProjection") === true
    && candidate.getFlag(MODULE_ID, "pokemonInstanceId") === instanceId
  );

  if (!actor) return data;

  data.flags ??= {};
  data.flags[MODULE_ID] ??= {};
  data.flags[MODULE_ID].combatState = {
    floatingTagsAndStatuses: foundry.utils.deepClone(
      actor.system?.floatingTagsAndStatuses ?? []
    ),
    updatedAt: Date.now()
  };

  return data;
}

async function removeCombatProjectionForData(data) {
  const instanceId = data?.flags?.[MODULE_ID]?.pokemonInstanceId;
  if (!instanceId) return;

  const api = game.modules.get(MODULE_ID)?.api;
  if (api?.deletePokemonCombatProjection) {
    await api.deletePokemonCombatProjection(instanceId);
  }
}

async function releaseTeamPokemon(trainer, themeId) {
  const theme = trainer.items.get(themeId);
  if (!theme || theme.getFlag(MODULE_ID, "pokemonTheme") !== true) {
    throw new Error("Pokémon do Time não encontrado.");
  }

  const api = game.modules.get(MODULE_ID)?.api;
  if (api?.recollectPokemonTheme) {
    try {
      await api.recollectPokemonTheme(theme);
    } catch {}
  }

  if (getPokemonFollowerThemeId(trainer) === theme.id) {
    await setPokemonFollowerTheme(trainer, null);
  }

  let data = themeSnapshot(theme);
  data = snapshotCombatStateIntoData(data);
  delete data.flags?.[MODULE_ID]?.pokemonTeamSlot;

  const released = getReleasedRecords(trainer);
  released.push({
    id: newInstanceId(),
    releasedAt: Date.now(),
    data
  });

  await setReleasedRecords(trainer, released);
  await removeCombatProjectionForData(data);
  await trainer.deleteEmbeddedDocuments("Item", [theme.id]);
  await reindexTeam(trainer);
}

async function releasePcPokemon(trainer, recordId) {
  const pc = getPcRecords(trainer);
  const index = pc.findIndex(record => record.id === recordId);
  if (index < 0) throw new Error("Pokémon do PC não encontrado.");

  const [record] = pc.splice(index, 1);
  record.data = snapshotCombatStateIntoData(record.data);
  record.releasedAt = Date.now();

  const released = getReleasedRecords(trainer);
  released.push(record);

  await setPcRecords(trainer, pc);
  await setReleasedRecords(trainer, released);
  await removeCombatProjectionForData(record.data);
}

async function releasedPokemonToPc(trainer, recordId) {
  const released = getReleasedRecords(trainer);
  const index = released.findIndex(record => record.id === recordId);
  if (index < 0) throw new Error("Pokémon liberado não encontrado.");

  const [record] = released.splice(index, 1);
  delete record.releasedAt;

  const pc = getPcRecords(trainer);
  pc.push(record);

  await setReleasedRecords(trainer, released);
  await setPcRecords(trainer, pc);
}

async function releasedPokemonToTeam(trainer, recordId) {
  const slot = nextTeamSlot(trainer);
  if (slot === null) throw new Error("O Time já tem 6 Pokémon.");

  const released = getReleasedRecords(trainer);
  const index = released.findIndex(record => record.id === recordId);
  if (index < 0) throw new Error("Pokémon liberado não encontrado.");

  const [record] = released.splice(index, 1);
  const created = await trainer.createEmbeddedDocuments(
    "Item",
    [buildThemeFromPcRecord(record, slot)]
  );

  if (!created?.[0]) {
    throw new Error("Não foi possível trazer o Pokémon de volta ao Time.");
  }

  await setReleasedRecords(trainer, released);
}

async function deleteReleasedPokemon(trainer, recordId) {
  const released = getReleasedRecords(trainer);
  const index = released.findIndex(record => record.id === recordId);
  if (index < 0) throw new Error("Pokémon liberado não encontrado.");

  const [record] = released.splice(index, 1);
  await removeCombatProjectionForData(record.data);
  await setReleasedRecords(trainer, released);
}

function pokemonActorPreview(pokemon) {
  const assets = pokemon.getFlag(MODULE_ID, "assets") ?? {};
  return assets.portrait ?? pokemon.img ?? "icons/svg/mystery-man.svg";
}
function themePreview(theme) {
  const assets = theme.getFlag(MODULE_ID, "assets") ?? {};
  return assets.portrait ?? theme.img ?? "icons/svg/mystery-man.svg";
}
function storedPreview(record) {
  return record.data?.flags?.[MODULE_ID]?.assets?.portrait ?? record.data?.img ?? "icons/svg/mystery-man.svg";
}

function openTheme(theme) {
  if (!theme) return;
  const sheet = theme.sheet;
  if (!sheet?.render) return;
  void sheet.render({force: true});
}

function openPcThemeRecord(trainer, recordId, source = "pc") {
  if (!trainer || !recordId) return;

  const records = source === "released"
    ? getReleasedRecords(trainer)
    : getPcRecords(trainer);

  const record =
    records.find(row => row.id === recordId);

  if (!record?.data) return;

  const data =
    foundry.utils.deepClone(record.data);

  data._id =
    data._id ?? newInstanceId();
  data.type = "themebook";
  data.system ??= pokemonThemeSystem();
  data.system.editMode = false;

  const ItemClass =
    CONFIG.Item?.documentClass
    ?? globalThis.Item;

  if (!ItemClass) {
    throw new Error("Classe de Item indisponível.");
  }

  const theme =
    new ItemClass(
      data,
      { parent: trainer }
    );

  const sheet = theme.sheet;
  if (!sheet?.render) {
    throw new Error("Ficha de Tema indisponível.");
  }

  void sheet.render({ force: true });
}

function challengePowerTag(name, planned = false, question = '') {
  return {
    name: String(name ?? ''), question: String(question ?? ''), burned: false, toBurn: false,
    planned: !!planned, selected: false, expiring: false, expired: false
  };
}

function pokemonThemeTitleTag(species, natureLabel, gender, language = 'pt-BR') {
  const name = String(species ?? 'Pokémon').trim() || 'Pokémon';
  const nature = String(natureLabel ?? '').trim();
  const suffix = nature ? ' ' + nature : '';

  if (language === 'en') return name + suffix;
  if (gender === 'male') return 'O ' + name + suffix;
  if (gender === 'female') return 'A ' + name + suffix;
  return nature ? name + ' · ' + nature : name;
}

function futureMovesFromFlags(flags) {
  const direct = Array.isArray(flags.futureMoves)
    ? flags.futureMoves.filter(Boolean)
    : [];
  if (direct.length >= 3) return direct.slice(0, 3);

  const selectedIds = new Set(
    (flags.moves ?? []).map(move => move?.id).filter(Boolean)
  );
  const selectedLevel = Math.max(
    0,
    ...(flags.moves ?? [])
      .map(move => Number(move.learnedAt ?? move.level ?? 0))
      .filter(level => level > 0)
  );

  const rows = (flags.levelUpMoves ?? [])
    .filter(move =>
      move?.id
      && Number(move.learnedAt ?? move.level ?? 0) > 0
      && !selectedIds.has(move.id)
    );

  const after = rows
    .filter(move => Number(move.learnedAt ?? move.level ?? 0) > selectedLevel)
    .sort((a, b) =>
      Number(a.learnedAt ?? a.level ?? 0) - Number(b.learnedAt ?? b.level ?? 0)
    );
  const earlier = rows
    .filter(move => Number(move.learnedAt ?? move.level ?? 0) <= selectedLevel)
    .sort((a, b) =>
      Number(b.learnedAt ?? b.level ?? 0) - Number(a.learnedAt ?? a.level ?? 0)
    );

  const result = [...direct];
  const seen = new Set(result.map(move => move?.id).filter(Boolean));
  for (const move of [...after, ...earlier]) {
    if (!move.id || seen.has(move.id)) continue;
    seen.add(move.id);
    result.push(move);
    if (result.length >= 3) break;
  }
  return result.slice(0, 3);
}

function capturedThemeData(pokemon, slot = null) {
  const flags = foundry.utils.deepClone(pokemon.flags?.[MODULE_ID] ?? {});
  const speciesName = String(flags.speciesName ?? pokemon.name ?? 'Pokémon').trim() || 'Pokémon';
  const moveNames = (flags.moves ?? []).map(move => move.name).filter(Boolean);
  const natureLabel = flags.nature?.label ?? '';
  const gender = flags.gender ?? 'genderless';
  const language = flags.contentLanguage ?? 'pt-BR';
  const pt = language !== 'en';
  const titleTag = pokemonThemeTitleTag(speciesName, natureLabel, gender, language);

  const moveTags = moveNames.map((name, index) =>
    challengePowerTag(name, false, pt ? `Movimento ${index + 1}` : `Move ${index + 1}`)
  );

  const futureMoves = futureMovesFromFlags(flags);
  const futureTags = futureMoves.map((move, index) =>
    challengePowerTag(
      move.name,
      true,
      pt ? `Próximo movimento ${index + 1}` : `Next move ${index + 1}`
    )
  );

  const powerTags = [
    challengePowerTag(
      titleTag,
      false,
      pt
        ? 'O Pokémon, sua natureza e personalidade'
        : 'The Pokémon, its nature and personality'
    ),
    ...moveTags
  ];

  if (flags.powerStatTag) {
    powerTags.push(challengePowerTag(
      flags.powerStatTag,
      false,
      pt ? 'Stat de destaque' : 'Standout Stat'
    ));
  }

  if (flags.ability?.name) {
    powerTags.push(challengePowerTag(
      `Habilidade: ${flags.ability.name}`,
      false,
      pt ? 'Habilidade nata' : 'Innate Ability'
    ));
  }

  powerTags.push(...futureTags);

  return {
    name: speciesName,
    type: 'themebook',
    img: pokemon.img,
    system: {
      ...pokemonThemeSystem(language),
      description: String(
        pokemon.system?.biography
        ?? pokemon.system?.shortDescription
        ?? ''
      ),
      powertags: powerTags,
      weaknesstags: flags.weaknessTag
        ? [challengePowerTag(
            flags.weaknessTag,
            false,
            pt ? 'Stat mais fraco' : 'Weakest Stat'
          )]
        : [],
      specialImprovements: pokemonSpecialImprovements(language)
    },
    flags: {
      [MODULE_ID]: {
        ...flags,
        speciesName,
        themeTitleTag: titleTag,
        futureMoves,
        pokemonTheme: true,
        themeRole: 'pokemon',
        pokemonActorId: pokemon.id,
        pokemonInstanceId: flags.pokemonInstanceId ?? newInstanceId(),
        ...(slot === null ? {} : { pokemonTeamSlot: slot }),
        capturedFromChallenge: true,
        capturedChallengeId: pokemon.id
      }
    }
  };
}

async function removeChallengeTokens(pokemon) {
  if (!game.user.isGM) return;
  for (const scene of game.scenes) {
    const ids = scene.tokens.filter(token => token.actorId === pokemon.id).map(token => token.id);
    if (ids.length) await scene.deleteEmbeddedDocuments("Token", ids);
  }
}

export async function capturePokemonChallenge(pokemon) {
  if (!game.user.isGM || !pokemon) return null;
  const flags = pokemon.flags?.[MODULE_ID] ?? {};
  if (flags.pokemonBuilder !== true || flags.encounter?.wild !== true || flags.captured === true) {
    throw new Error("Somente um Challenge de Pokémon selvagem pode ser convertido.");
  }

  const trainers = getManagedActors();
  if (!trainers.length) throw new Error("Nenhum Actor treinador jogador disponível.");
  const options = trainers.map(actor => `<option value="${actor.id}">${foundry.utils.escapeHTML(actor.name)}</option>`).join("");

  const choice = await foundry.applications.api.DialogV2.input({
    window: { title: `Capturar ${pokemon.name}` },
    content: `
      <div style="display:grid;gap:12px;padding:8px">
        <label><span>Treinador jogador</span><select name="trainerId">${options}</select></label>
        <label><span>Destino</span><select name="destination"><option value="team">Time</option><option value="pc">PC</option></select></label>
      </div>`,
    ok: { label: "Converter em Tema", icon: "fa-solid fa-right-left" },
    modal: true
  });
  if (!choice) return null;

  const trainer = game.actors.get(String(choice.trainerId ?? ""));
  if (!trainer || trainer.type !== "litm-character") throw new Error("Treinador jogador inválido.");
  let destination = String(choice.destination ?? "team");

  if (destination === 'team') {
    // First normalize legacy parties that somehow contain more than 6.
    while (getPokemonThemes(trainer).length > 6) {
      const current = getPokemonThemes(trainer);
      const options = current
        .map(theme => `<option value="${theme.id}">${foundry.utils.escapeHTML(theme.name)} → PC</option>`)
        .join('');

      const fix = await foundry.applications.api.DialogV2.input({
        window: { title: 'Corrigir Time' },
        content: `<div style="display:grid;gap:10px;padding:8px">
          <p>O Time tem ${current.length} Pokémon. Escolha um para enviar ao PC antes de continuar.</p>
          <select name="themeId">${options}</select>
        </div>`,
        ok: { label: 'Enviar para o PC', icon: 'fa-solid fa-box-archive' },
        modal: true
      });
      if (!fix) return null;
      await sendPokemonThemeToPc(trainer, String(fix.themeId ?? ''));
    }

    if (getPokemonThemes(trainer).length === 6) {
      const current = getPokemonThemes(trainer);
      const options = [
        `<option value="__captured__">${foundry.utils.escapeHTML(pokemon.name)} → PC · manter o Time atual</option>`,
        ...current.map(theme =>
          `<option value="${theme.id}">${foundry.utils.escapeHTML(theme.name)} → PC · ${foundry.utils.escapeHTML(pokemon.name)} entra no Time</option>`
        )
      ].join('');

      const swap = await foundry.applications.api.DialogV2.input({
        window: { title: 'Time cheio' },
        content: `<div style="display:grid;gap:10px;padding:8px">
          <p>O Time tem 6 Pokémon. Você pode mandar o próprio ${foundry.utils.escapeHTML(pokemon.name)} para o PC ou abrir uma vaga no Time.</p>
          <select name="choice">${options}</select>
        </div>`,
        ok: { label: 'Confirmar', icon: 'fa-solid fa-check' },
        modal: true
      });

      if (!swap) return null;
      const selected = String(swap.choice ?? '__captured__');
      if (selected === '__captured__') {
        destination = 'pc';
      } else {
        await sendPokemonThemeToPc(trainer, selected);
      }
    }
  }

  const instanceId = flags.pokemonInstanceId ?? newInstanceId();
  await pokemon.setFlag(MODULE_ID, "pokemonInstanceId", instanceId);

  if (destination === "team") {
    const slot = nextTeamSlot(trainer);
    if (slot === null) throw new Error("O time continua cheio.");
    const data = capturedThemeData(pokemon, slot);
    data.flags[MODULE_ID].pokemonInstanceId = instanceId;
    const created = await trainer.createEmbeddedDocuments("Item", [data]);
    if (!created?.[0]) throw new Error("Não foi possível criar o Tema do Pokémon capturado.");
  } else {
    const records = getPcRecords(trainer);
    const data = capturedThemeData(pokemon, null);
    data.flags[MODULE_ID].pokemonInstanceId = instanceId;
    records.push({ id: newInstanceId(), data });
    await setPcRecords(trainer, records);
  }

  await pokemon.update({
    [`flags.${MODULE_ID}.captured`]: true,
    [`flags.${MODULE_ID}.capturedByTrainerId`]: trainer.id,
    [`flags.${MODULE_ID}.ownerTrainerId`]: trainer.id,
    [`flags.${MODULE_ID}.encounter.wild`]: false
  });
  await removeChallengeTokens(pokemon);
  ui.notifications.info(`${pokemon.name} agora pertence a ${trainer.name}.`);
  return trainer;
}

class PokemonManagerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "pokemon-litm-manager", classes: ["pokemon-litm-tools", "pokemon-manager"],
    position: {width: 920, height: 720},
    window: {title: "Pokémon Manager", icon: "fa-solid fa-box", resizable: true}
  };
  static PARTS = {main: {template: `modules/${MODULE_ID}/templates/pokemon-manager.hbs`}};

  actorId = null;
  tab = "team";
  busy = false;

  constructor(options = {}) { super(options); this.actorId = options.actorId ?? null; }
  get actor() { return this.actorId ? game.actors.get(this.actorId) : null; }

  _ensureActor() {
    const actors = getManagedActors();
    if (!this.actor && actors.length) this.actorId = actors[0].id;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    this._ensureActor();
    const actors = getManagedActors();
    const trainer = this.actor;
    if (trainer) await ensurePokemonFoundation(trainer);

    const themes = getPokemonThemes(trainer);
    const followerThemeId = trainer ? getPokemonFollowerThemeId(trainer) : null;
    const storedRecords = getPcRecords(trainer);
    const releasedRecords = getReleasedRecords(trainer);

    const team = themes.map((theme, index) => ({
      id: theme.id, number: index + 1, name: theme.name, img: themePreview(theme),
      following: followerThemeId === theme.id,
      instanceId: theme.getFlag(MODULE_ID, "pokemonInstanceId") ?? "",
      pokedexUrl: theme.getFlag(MODULE_ID, "pokedexUrl") ?? getPokemonDbUrl(theme.name)
    }));

    const emptySlots = Array.from({length: Math.max(0, 6 - team.length)}, (_, index) => ({number: team.length + index + 1}));
    const pcItems = storedRecords
      .map(record => ({
        id: record.id,
        source: "stored",
        name: record.data?.name ?? "Pokémon",
        img: storedPreview(record),
        instanceId:
          record.data?.flags?.[MODULE_ID]?.pokemonInstanceId
          ?? "",
        pokedexUrl:
          record.data?.flags?.[MODULE_ID]?.pokedexUrl
          ?? getPokemonDbUrl(record.data?.name)
      }))
      .sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR")
      );

    const releasedItems = releasedRecords
      .map(record => ({
        id: record.id,
        name: record.data?.name ?? "Pokémon",
        img: storedPreview(record),
        instanceId:
          record.data?.flags?.[MODULE_ID]?.pokemonInstanceId
          ?? "",
        pokedexUrl:
          record.data?.flags?.[MODULE_ID]?.pokedexUrl
          ?? getPokemonDbUrl(record.data?.name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    return {...context,
      hasActors: actors.length > 0,
      actors: actors.map(actor => ({id: actor.id, name: actor.name, selected: actor.id === this.actorId})),
      tabTeam: this.tab === "team",
      tabPc: this.tab === "pc",
      tabReleased: this.tab === "released",
      tabItems: this.tab === "items",
      tabTrade: this.tab === "trade",
      team,
      emptySlots,
      pcItems,
      releasedItems,
      teamCount: team.length,
      pcCount: pcItems.length,
      releasedCount: releasedItems.length,
      teamFull: team.length >= 6,
      busy: this.busy,
      isGM: game.user.isGM
    };
  }

  async _rerender() { await this.render({force: true}); }
  async _run(task) {
    if (this.busy) return;
    this.busy = true;
    try { await task(); }
    catch (error) {
      console.error("Pokemon LITM Tools | Pokémon Manager:", error);
      ui.notifications.error(error?.message ?? "Falha no Pokémon Manager.");
    } finally { this.busy = false; await this._rerender(); }
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const root = this.element;

    root.querySelector("[data-role='manager-actor']")?.addEventListener("change", async event => {
      this.actorId = event.currentTarget.value || null;
      await this._rerender();
    });

    for (const button of root.querySelectorAll("[data-manager-tab]")) button.addEventListener("click", async () => {
      this.tab = button.dataset.managerTab ?? "team";
      await this._rerender();
    });

    for (const card of root.querySelectorAll("[data-open-theme]")) card.addEventListener("click", event => {
      if (event.target.closest("button,input,select,a")) return;
      const theme = this.actor?.items.get(card.dataset.openTheme);
      openTheme(theme);
    });

    for (
      const card
      of root.querySelectorAll("[data-open-pc-theme]")
    ) {
      card.addEventListener("click", event => {
        if (event.target.closest("button,input,select,a")) return;
        const actor = this.actor;
        const recordId = card.dataset.openPcTheme;
        if (!actor || !recordId) return;

        try {
          openPcThemeRecord(actor, recordId);
        } catch (error) {
          console.error(
            "Pokemon LITM Tools | Abrir Theme do PC:",
            error
          );
          ui.notifications.error(
            error?.message
            ?? "Não foi possível abrir o Tema."
          );
        }
      });
    }

    for (const card of root.querySelectorAll("[data-open-released-theme]")) {
      card.addEventListener("click", event => {
        if (event.target.closest("button,input,select,a")) return;
        const actor = this.actor;
        const recordId = card.dataset.openReleasedTheme;
        if (!actor || !recordId) return;

        try {
          openPcThemeRecord(actor, recordId, "released");
        } catch (error) {
          console.error("Pokemon LITM Tools | Abrir Theme liberado:", error);
          ui.notifications.error(error?.message ?? "Não foi possível abrir o Tema.");
        }
      });
    }

    for (const input of root.querySelectorAll("[data-follower-theme-id]")) input.addEventListener("change", () => {
      const actor = this.actor;
      const themeId = input.dataset.followerThemeId;
      if (!actor || !themeId) return;
      void this._run(() => setPokemonFollowerTheme(actor, input.checked ? themeId : null));
    });

    for (const button of root.querySelectorAll("[data-send-to-pc]")) button.addEventListener("click", event => {
      event.stopPropagation();
      const actor = this.actor;
      const themeId = button.dataset.sendToPc;
      if (actor && themeId) void this._run(() => sendPokemonThemeToPc(actor, themeId));
    });

    for (const button of root.querySelectorAll("[data-add-to-team]")) button.addEventListener("click", () => {
      const actor = this.actor, source = button.dataset.pcSource, id = button.dataset.addToTeam;
      if (actor && source && id) void this._run(() => addPcPokemonToTeam(actor, source, id));
    });

    for (const button of root.querySelectorAll("[data-release-team]")) {
      button.addEventListener("click", async event => {
        event.stopPropagation();
        const actor = this.actor;
        const themeId = button.dataset.releaseTeam;
        const theme = actor?.items?.get(themeId);
        if (!actor || !theme) return;

        const ok = await foundry.applications.api.DialogV2.confirm({
          window: { title: "Libertar " + theme.name + "?" },
          content: "<p>O Pokémon sairá do Time e irá para <strong>Liberados</strong>. O indivíduo e seu histórico serão preservados.</p>",
          yes: { label: "Libertar", icon: "fa-solid fa-dove" },
          no: { label: "Cancelar" },
          rejectClose: false,
          modal: true
        });

        if (ok) void this._run(() => releaseTeamPokemon(actor, themeId));
      });
    }

    for (const button of root.querySelectorAll("[data-release-pc]")) {
      button.addEventListener("click", async event => {
        event.stopPropagation();
        const actor = this.actor;
        const recordId = button.dataset.releasePc;
        const record = actor ? getPcRecords(actor).find(row => row.id === recordId) : null;
        if (!actor || !record) return;

        const name = record.data?.name ?? "Pokémon";
        const ok = await foundry.applications.api.DialogV2.confirm({
          window: { title: "Libertar " + name + "?" },
          content: "<p>O Pokémon sairá do PC e irá para <strong>Liberados</strong>. O registro continuará disponível caso ele retorne.</p>",
          yes: { label: "Libertar", icon: "fa-solid fa-dove" },
          no: { label: "Cancelar" },
          rejectClose: false,
          modal: true
        });

        if (ok) void this._run(() => releasePcPokemon(actor, recordId));
      });
    }

    for (const button of root.querySelectorAll("[data-released-to-pc]")) {
      button.addEventListener("click", event => {
        event.stopPropagation();
        const actor = this.actor;
        const recordId = button.dataset.releasedToPc;
        if (actor && recordId) void this._run(() => releasedPokemonToPc(actor, recordId));
      });
    }

    for (const button of root.querySelectorAll("[data-released-to-team]")) {
      button.addEventListener("click", event => {
        event.stopPropagation();
        const actor = this.actor;
        const recordId = button.dataset.releasedToTeam;
        if (actor && recordId) void this._run(() => releasedPokemonToTeam(actor, recordId));
      });
    }

    for (const button of root.querySelectorAll("[data-delete-released]")) {
      button.addEventListener("click", async event => {
        event.stopPropagation();
        const actor = this.actor;
        const recordId = button.dataset.deleteReleased;
        const record = actor ? getReleasedRecords(actor).find(row => row.id === recordId) : null;
        if (!actor || !record || !game.user.isGM) return;

        const name = record.data?.name ?? "Pokémon";
        const ok = await foundry.applications.api.DialogV2.confirm({
          window: { title: "Excluir permanentemente?" },
          content: "<p><strong>" + foundry.utils.escapeHTML(name) + "</strong> será removido de Liberados e seu Combat Actor será apagado. Esta ação não poderá ser desfeita.</p>",
          yes: { label: "Excluir permanentemente", icon: "fa-solid fa-trash" },
          no: { label: "Cancelar" },
          rejectClose: false,
          modal: true
        });

        if (ok) void this._run(() => deleteReleasedPokemon(actor, recordId));
      });
    }

    for (const button of root.querySelectorAll("[data-pokedex-url]")) button.addEventListener("click", event => {
      event.stopPropagation();
      openPokemonDb(button.dataset.pokedexUrl);
    });
  }
}

export function openPokemonManager(actor = null) {
  if (game.system.id !== LITM_SYSTEM_ID) {
    ui.notifications.warn("O Pokémon Manager requer Legend in the Mist.");
    return null;
  }
  const preferred = actor?.documentName === "Actor" ? actor
    : canvas.tokens.controlled?.find(token => token.actor?.type === "litm-character" && (game.user.isGM || token.actor.isOwner))?.actor ?? null;

  if (managerApp && managerApp.rendered) {
    if (preferred) managerApp.actorId = preferred.id;
    void managerApp.render({force: true});
    return managerApp;
  }
  managerApp = new PokemonManagerApp({actorId: preferred?.id ?? null});
  void managerApp.render({force: true});
  return managerApp;
}
