import { getPokemonDbUrl, openPokemonDb } from "./pokemon-links.js";
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
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
let managerApp = null;

function pokemonThemeSystem() {
  return {type: "litm-variable", color: "litm-variable", quest: "", story: "", tabCategory: "main",
    powertags: [], weaknesstags: [], options: {isStoryTheme: false}};
}

function newInstanceId() { return foundry.utils.randomID(16); }

function getManagedActors() {
  return game.actors.filter(actor => actor.type === "litm-character" && (game.user.isGM || actor.isOwner))
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
async function setPcRecords(trainer, records) { await trainer.setFlag(MODULE_ID, PC_FLAG, records); }

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
    if (!theme.getFlag(MODULE_ID, "pokemonInstanceId")) {
      updates.push({_id: theme.id, [`flags.${MODULE_ID}.pokemonInstanceId`]: newInstanceId()});
    }
  }
  if (updates.length) await trainer.updateEmbeddedDocuments("Item", updates);

  const records = getPcRecords(trainer);
  let changed = false;
  for (const record of records) {
    record.data ??= {};
    const before = record.data?.flags?.[MODULE_ID]?.pokemonInstanceId;
    ensureDataInstanceId(record.data);
    if (!before) changed = true;
  }
  if (changed) await setPcRecords(trainer, records);

  const teamActorIds = new Set(themes.map(t => t.getFlag(MODULE_ID, "pokemonActorId")).filter(Boolean));
  for (const pokemon of pokemonActorsForTrainer(trainer, teamActorIds)) {
    if (!pokemon.getFlag(MODULE_ID, "pokemonInstanceId") && (game.user.isGM || pokemon.isOwner)) {
      await pokemon.setFlag(MODULE_ID, "pokemonInstanceId", newInstanceId());
    }
  }
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

async function sendThemeToPc(trainer, themeId) {
  const theme = trainer.items.get(themeId);
  if (!theme || theme.getFlag(MODULE_ID, "pokemonTheme") !== true) throw new Error("Pokémon do time não encontrado.");

  if (getPokemonFollowerThemeId(trainer) === theme.id) await setPokemonFollowerTheme(trainer, null);
  await removePokemonThemeTokens(trainer, theme.id);

  const linkedActorId = theme.getFlag(MODULE_ID, "pokemonActorId");
  const linkedActor = linkedActorId ? game.actors.get(linkedActorId) : null;
  const snapshot = themeSnapshot(theme);
  const instanceId = snapshot.flags?.[MODULE_ID]?.pokemonInstanceId;

  if (linkedActor && (game.user.isGM || linkedActor.isOwner)) {
    await linkedActor.update({
      name: theme.name,
      [`flags.${MODULE_ID}.storedThemeData`]: snapshot,
      [`flags.${MODULE_ID}.pokemonInstanceId`]: instanceId
    });
  } else {
    const records = getPcRecords(trainer);
    records.push({id: newInstanceId(), data: snapshot});
    await setPcRecords(trainer, records);
  }

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
  if (slot === null) throw new Error("O time já tem 6 Pokémon.");

  if (source === "actor") {
    const pokemon = game.actors.get(id);
    if (!pokemon || pokemon.getFlag(MODULE_ID, "kind") !== "pokemon" || (!game.user.isGM && !pokemon.isOwner)) {
      throw new Error("Pokémon do PC não encontrado.");
    }
    const instanceId = await ensureActorInstanceId(pokemon);
    await trainer.createEmbeddedDocuments("Item", [buildThemeFromActor(pokemon, slot, instanceId)]);
    return;
  }

  if (source === "stored") {
    const records = getPcRecords(trainer);
    const index = records.findIndex(record => record.id === id);
    if (index < 0) throw new Error("Pokémon armazenado não encontrado.");
    const [record] = records.splice(index, 1);
    const created = await trainer.createEmbeddedDocuments("Item", [buildThemeFromPcRecord(record, slot)]);
    if (!created?.[0]) throw new Error("Não foi possível adicionar o Pokémon ao time.");
    await setPcRecords(trainer, records);
    return;
  }

  throw new Error("Origem de Pokémon desconhecida.");
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
    const teamActorIds = new Set(themes.map(t => t.getFlag(MODULE_ID, "pokemonActorId")).filter(Boolean));
    const storedRecords = getPcRecords(trainer);
    const ownedPokemonActors = pokemonActorsForTrainer(trainer, teamActorIds);

    const team = themes.map((theme, index) => ({
      id: theme.id, number: index + 1, name: theme.name, img: themePreview(theme),
      following: followerThemeId === theme.id,
      instanceId: theme.getFlag(MODULE_ID, "pokemonInstanceId") ?? "",
      pokedexUrl: theme.getFlag(MODULE_ID, "pokedexUrl") ?? getPokemonDbUrl(theme.name)
    }));

    const emptySlots = Array.from({length: Math.max(0, 6 - team.length)}, (_, index) => ({number: team.length + index + 1}));
    const pcItems = [
      ...storedRecords.map(record => ({
        id: record.id, source: "stored", name: record.data?.name ?? "Pokémon", img: storedPreview(record),
        instanceId: record.data?.flags?.[MODULE_ID]?.pokemonInstanceId ?? "",
        pokedexUrl: record.data?.flags?.[MODULE_ID]?.pokedexUrl ?? getPokemonDbUrl(record.data?.name)
      })),
      ...ownedPokemonActors.map(pokemon => ({
        id: pokemon.id, source: "actor", name: pokemon.name, img: pokemonActorPreview(pokemon),
        instanceId: pokemon.getFlag(MODULE_ID, "pokemonInstanceId") ?? "",
        pokedexUrl: pokemon.getFlag(MODULE_ID, "pokedexUrl") ?? getPokemonDbUrl(pokemon.name)
      }))
    ].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    return {...context,
      hasActors: actors.length > 0,
      actors: actors.map(actor => ({id: actor.id, name: actor.name, selected: actor.id === this.actorId})),
      tabTeam: this.tab === "team", tabPc: this.tab === "pc", tabItems: this.tab === "items", tabTrade: this.tab === "trade",
      team, emptySlots, pcItems, teamCount: team.length, pcCount: pcItems.length, teamFull: team.length >= 6, busy: this.busy
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
      if (actor && themeId) void this._run(() => sendThemeToPc(actor, themeId));
    });

    for (const button of root.querySelectorAll("[data-add-to-team]")) button.addEventListener("click", () => {
      const actor = this.actor, source = button.dataset.pcSource, id = button.dataset.addToTeam;
      if (actor && source && id) void this._run(() => addPcPokemonToTeam(actor, source, id));
    });

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
