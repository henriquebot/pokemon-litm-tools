const MODULE_ID = "pokemon-litm-tools";
const DYLAN_ID = "dylans-animated-tokens";
const LITM_SYSTEM_ID = "mist-engine-fvtt";
const FOLLOWER_FLAG = "followerPokemonThemeId";
const LEGACY_ORDER_FLAG = "followerPokemonOrder";
const TOKEN_FLAG = "pokemonFollowerToken";
const ACTIVE_FLAG = "pokemonFollowerActive";
const LEGACY_TOKEN_FLAG = "pokemonFollower";
const FOLLOWING_FLAG = "following";
const queues = new Map();
let warned = false;

function isAuthority() {
  if (!game.user?.isGM) return false;
  const gm = game.users.filter(u => u.active && u.isGM).sort((a, b) => a.id.localeCompare(b.id))[0];
  return gm?.id === game.user.id;
}

function canFollow() {
  if (!game.modules.get(DYLAN_ID)?.active) return false;
  if (game.modules.get("FollowMe")?.active) return false;
  try { return game.settings.get(DYLAN_ID, "enableFollow") !== false; }
  catch { return true; }
}

function warnFollow() {
  if (warned) return;
  warned = true;
  ui.notifications.warn("Pokémon Followers: ative 'Enable Token Following' no Dylan's Animated Tokens.");
}

function gridSize() {
  return Number(canvas?.grid?.size ?? canvas?.dimensions?.size ?? canvas?.scene?.grid?.size ?? 100);
}

export function getPokemonThemes(actor) {
  if (actor?.documentName !== 'Actor' || actor.type !== 'litm-character') return [];

  return actor.items
    .filter(item =>
      item.type === 'themebook'
      && item.getFlag(MODULE_ID, 'pokemonTheme') === true
      && item.getFlag(MODULE_ID, 'themeRole') !== 'pokemon-reference'
    )
    .sort((a, b) =>
      Number(a.getFlag(MODULE_ID, 'pokemonTeamSlot') ?? 999)
      - Number(b.getFlag(MODULE_ID, 'pokemonTeamSlot') ?? 999)
    );
}

function legacyFollowerThemeId(actor) {
  const valid = new Set(getPokemonThemes(actor).map(t => t.id));
  const raw = actor?.getFlag(MODULE_ID, LEGACY_ORDER_FLAG);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return Object.entries(raw).map(([themeId, position]) => ({themeId, position: Number(position)}))
    .filter(x => valid.has(x.themeId) && Number.isInteger(x.position) && x.position >= 1 && x.position <= 6)
    .sort((a, b) => a.position - b.position)[0]?.themeId ?? null;
}

export function getPokemonFollowerThemeId(actor) {
  const id = actor?.getFlag(MODULE_ID, FOLLOWER_FLAG);
  if (!id) return null;
  return getPokemonThemes(actor).some(theme => theme.id === id) ? id : null;
}

export async function migratePokemonFollowerState(actor) {
  if (!actor || actor.type !== "litm-character") return null;
  const raw = actor.getFlag(MODULE_ID, FOLLOWER_FLAG);
  let current = typeof raw === "string" ? raw : null;
  const valid = new Set(getPokemonThemes(actor).map(t => t.id));
  if (current && !valid.has(current)) current = "";
  if (raw === undefined) current = legacyFollowerThemeId(actor) ?? "";
  const update = {};
  if (raw === undefined || raw !== current) update[`flags.${MODULE_ID}.${FOLLOWER_FLAG}`] = current;
  if (actor.getFlag(MODULE_ID, LEGACY_ORDER_FLAG) !== undefined) update[`flags.${MODULE_ID}.-=${LEGACY_ORDER_FLAG}`] = null;
  if (Object.keys(update).length) await actor.update(update, {pokemonFollowerSync: true});
  return current || null;
}

function isManagedToken(token) {
  return token?.getFlag(MODULE_ID, TOKEN_FLAG) === true || token?.getFlag(MODULE_ID, LEGACY_TOKEN_FLAG) === true;
}
function isLegacyToken(token) {
  return token?.getFlag(MODULE_ID, LEGACY_TOKEN_FLAG) === true && token?.getFlag(MODULE_ID, TOKEN_FLAG) !== true;
}
function isActiveToken(token) { return token?.getFlag(MODULE_ID, ACTIVE_FLAG) === true; }
function tokenThemeId(token) { return token?.getFlag(MODULE_ID, "pokemonThemeId") ?? null; }
function trainerForToken(token) {
  const id = token?.getFlag(MODULE_ID, "trainerTokenId");
  return id ? token.parent?.tokens?.get(id) ?? null : null;
}
function getPokemonTokens(scene, trainerId) {
  return scene?.tokens.filter(t => isManagedToken(t) && t.getFlag(MODULE_ID, "trainerTokenId") === trainerId) ?? [];
}

function stablePath(value) {
  return (
    typeof value === "string"
      ? value.trim()
      : value
  );
}

function visualFor(theme) {
  const flags = theme?.flags?.[MODULE_ID] ?? {};
  const assets = flags.assets ?? {};
  const overworld = stablePath(assets.overworld ?? theme.img ?? "icons/svg/mystery-man.svg");
  const spritesheet = stablePath(assets.spritesheet ?? overworld);
  const n = Number(flags.tokenScale ?? 1);
  return {
    overworld,
    spritesheet,
    scale: Number.isFinite(n) && n > 0 ? n : 1,
    animation: flags.animation && typeof flags.animation === "object" ? foundry.utils.deepClone(flags.animation) : null
  };
}

function behindPosition(trainer) {
  const s = gridSize();
  const a = ((Number(trainer.rotation ?? 0) % 360) + 360) % 360;
  let dx = 0, dy = -s;
  if (a >= 45 && a < 135) { dx = s; dy = 0; }
  else if (a >= 135 && a < 225) { dx = 0; dy = s; }
  else if (a >= 225 && a < 315) { dx = -s; dy = 0; }
  return {x: Number(trainer.x ?? 0) + dx, y: Number(trainer.y ?? 0) + dy, elevation: Number(trainer.elevation ?? 0)};
}

function followingData(trainer, follower) {
  return {who: trainer.id, dist: gridSize(), positions: [
    {x: Number(follower.x ?? 0), y: Number(follower.y ?? 0)},
    {x: Number(trainer.x ?? 0), y: Number(trainer.y ?? 0)}
  ]};
}

function tokenFlags(trainer, theme, active) {
  const tf = theme.flags?.[MODULE_ID] ?? {};
  return {
    pokemonFollowerToken: true,
    pokemonFollowerActive: active,
    trainerTokenId: trainer.id,
    trainerActorId: trainer.actor?.id ?? null,
    pokemonThemeId: theme.id,
    pokemonInstanceId: theme.getFlag(MODULE_ID, "pokemonInstanceId") ?? null,
    pokemonActorId: theme.getFlag(MODULE_ID, "pokemonActorId") ?? null,
    pokemonAssetId: theme.getFlag(MODULE_ID, "assetId") ?? null,
    assets: foundry.utils.deepClone(tf.assets ?? {}),
    animation: tf.animation && typeof tf.animation === "object" ? foundry.utils.deepClone(tf.animation) : null,
    tokenScale: Number(tf.tokenScale ?? 1)
  };
}

function createData(trainer, theme) {
  const visual = visualFor(theme);
  const linkedId = theme.getFlag(MODULE_ID, "pokemonActorId");
  const pokemonActor = linkedId ? game.actors.get(linkedId) : null;
  const actorId = pokemonActor?.id ?? trainer.actor?.id ?? null;
  const pos = behindPosition(trainer);
  const dylan = visual.animation ? {...visual.animation, spritesheet: true, sheetsrc: visual.spritesheet}
    : {spritesheet: false, sheetsrc: visual.spritesheet};
  return {
    name: theme.name, actorId, actorLink: false,
    x: pos.x, y: pos.y, elevation: pos.elevation,
    width: 1, height: 1, locked: false, lockRotation: true,
    rotation: Number(trainer.rotation ?? 0), hidden: Boolean(trainer.hidden),
    disposition: Number(trainer.disposition ?? CONST.TOKEN_DISPOSITIONS.FRIENDLY),
    displayName: CONST.TOKEN_DISPLAY_MODES.NONE, displayBars: CONST.TOKEN_DISPLAY_MODES.NONE,
    texture: {src: visual.overworld, scaleX: visual.scale, scaleY: visual.scale},
    sight: {enabled: false},
    flags: {
      [MODULE_ID]: tokenFlags(trainer, theme, true),
      [DYLAN_ID]: {...dylan, [FOLLOWING_FLAG]: {who: trainer.id, dist: gridSize(), positions: [
        {x: pos.x, y: pos.y}, {x: Number(trainer.x ?? 0), y: Number(trainer.y ?? 0)}
      ]}}
    }
  };
}

async function deleteIds(scene, ids) {
  const clean = [...new Set(ids.filter(Boolean))];
  if (clean.length) await scene.deleteEmbeddedDocuments("Token", clean, {pokemonFollowerSync: true});
}

async function reconcileTrainer(trainer, {place = false} = {}) {
  if (!isAuthority() || !trainer?.parent || isManagedToken(trainer) || trainer.actor?.type !== "litm-character") return;
  const scene = trainer.parent;
  if (!scene.tokens.get(trainer.id)) return;
  await migratePokemonFollowerState(trainer.actor);

  const themes = getPokemonThemes(trainer.actor);
  const themeById = new Map(themes.map(t => [t.id, t]));
  const desired = getPokemonFollowerThemeId(trainer.actor);
  const all = getPokemonTokens(scene, trainer.id);
  const byTheme = new Map();
  const remove = [];

  for (const token of all) {
    const tid = tokenThemeId(token);
    if (!tid || !themeById.has(tid) || (isLegacyToken(token) && tid !== desired)) { remove.push(token.id); continue; }
    if (byTheme.has(tid)) {
      const old = byTheme.get(tid);
      if (isActiveToken(token) && !isActiveToken(old)) { remove.push(old.id); byTheme.set(tid, token); }
      else remove.push(token.id);
      continue;
    }
    byTheme.set(tid, token);
  }
  await deleteIds(scene, remove);

  for (const [tid, token] of [...byTheme]) {
    if (tid !== desired && isActiveToken(token)) {
      await deleteIds(scene, [token.id]);
      byTheme.delete(tid);
    }
  }

  if (!desired) {
    await deleteIds(scene, getPokemonTokens(scene, trainer.id).filter(isActiveToken).map(t => t.id));
    return;
  }

  const theme = themeById.get(desired);
  if (!theme) {
    await trainer.actor.update({[`flags.${MODULE_ID}.${FOLLOWER_FLAG}`]: ""}, {pokemonFollowerSync: true});
    return;
  }
  if (!canFollow()) warnFollow();

  let follower = getPokemonTokens(scene, trainer.id).find(t => tokenThemeId(t) === desired) ?? null;
  if (!follower) {
    const made = await scene.createEmbeddedDocuments("Token", [createData(trainer, theme)], {pokemonFollowerSync: true});
    follower = made?.[0] ?? null;
    place = false;
  }
  if (!follower) return;

  const update = {
    _id: follower.id,
    locked: false,
    [`flags.${MODULE_ID}`]: {...(follower.flags?.[MODULE_ID] ?? {}), ...tokenFlags(trainer, theme, true)},
    [`flags.${DYLAN_ID}.${FOLLOWING_FLAG}`]: followingData(trainer, follower)
  };
  if (place) {
    const p = behindPosition(trainer);
    update.x = p.x; update.y = p.y; update.elevation = p.elevation;
  }
  if (follower.hidden !== Boolean(trainer.hidden)) update.hidden = Boolean(trainer.hidden);
  const disposition = Number(trainer.disposition ?? CONST.TOKEN_DISPOSITIONS.FRIENDLY);
  if (Number(follower.disposition) !== disposition) update.disposition = disposition;

  await scene.updateEmbeddedDocuments("Token", [update], {
    follower_updates: [], forced: true, teleport: place, animate: false, pokemonFollowerSync: true
  });
}

function queueReconcile(trainer, options = {}) {
  const key = trainer?.parent?.id && trainer?.id ? `${trainer.parent.id}:${trainer.id}` : null;
  if (!key) return Promise.resolve();
  const prev = queues.get(key) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(() => reconcileTrainer(trainer, options)).catch(error => {
    console.error("Pokemon LITM Tools | Pokémon follower:", error);
  });
  queues.set(key, next);
  void next.finally(() => { if (queues.get(key) === next) queues.delete(key); });
  return next;
}

function reconcileActorTokens(actor, options = {}) {
  if (!isAuthority() || !canvas?.ready || !canvas.scene) return;
  for (const trainer of canvas.scene.tokens.filter(t => !isManagedToken(t) && t.actor?.id === actor.id)) {
    void queueReconcile(trainer, options);
  }
}

export function refreshPokemonFollowersForActor(actor, options = {}) { reconcileActorTokens(actor, options); }

export async function setPokemonFollowerTheme(actor, themeId) {
  if (!actor || actor.type !== "litm-character") throw new Error("Treinador não encontrado.");
  const id = themeId ? String(themeId) : "";
  if (id && !getPokemonThemes(actor).some(t => t.id === id)) throw new Error("Pokémon da equipe não encontrado.");
  await actor.update({
    [`flags.${MODULE_ID}.${FOLLOWER_FLAG}`]: id,
    [`flags.${MODULE_ID}.-=${LEGACY_ORDER_FLAG}`]: null
  }, {pokemonFollowerSync: true});
  if (isAuthority()) reconcileActorTokens(actor, {place: Boolean(id)});
  return id || null;
}

export async function removePokemonThemeTokens(actor, themeId) {
  if (!isAuthority() || !canvas?.ready || !canvas.scene || !actor || !themeId) return;
  const ids = canvas.scene.tokens.filter(t => isManagedToken(t)
    && t.getFlag(MODULE_ID, "trainerActorId") === actor.id && tokenThemeId(t) === themeId).map(t => t.id);
  await deleteIds(canvas.scene, ids);
}

async function detachToken(token) {
  if (!token || !isManagedToken(token)) return;
  const trainer = trainerForToken(token);
  const actor = trainer?.actor ?? (token.getFlag(MODULE_ID, "trainerActorId") ? game.actors.get(token.getFlag(MODULE_ID, "trainerActorId")) : null);
  await token.update({
    [`flags.${MODULE_ID}.${TOKEN_FLAG}`]: true,
    [`flags.${MODULE_ID}.${ACTIVE_FLAG}`]: false,
    [`flags.${DYLAN_ID}.${FOLLOWING_FLAG}.who`]: null
  }, {pokemonFollowerSync: true, follower_updates: []});
  if (actor && getPokemonFollowerThemeId(actor) === tokenThemeId(token)) {
    await actor.update({[`flags.${MODULE_ID}.${FOLLOWER_FLAG}`]: ""}, {pokemonFollowerSync: true});
  }
}

async function resumeToken(token) {
  const trainer = trainerForToken(token);
  const themeId = tokenThemeId(token);
  if (!trainer?.actor || !themeId) throw new Error("Treinador ou Pokémon não encontrado.");
  await setPokemonFollowerTheme(trainer.actor, themeId);
  if (isAuthority()) await queueReconcile(trainer, {place: true});
}

function onCreateToken(token) {
  if (isAuthority() && !isManagedToken(token) && token.actor?.type === "litm-character") void queueReconcile(token, {place: true});
}

function onUpdateToken(token, changes, options) {
  if (isManagedToken(token)) {
    if (!isAuthority()) return;
    const moved = changes.x !== undefined || changes.y !== undefined;
    // Dylan itself clears following.who only when this follower is moved manually.
    if (moved && !options?.pokemonFollowerSync && isActiveToken(token)
      && !token.getFlag(DYLAN_ID, FOLLOWING_FLAG)?.who) {
      void detachToken(token).catch(error => console.error("Pokemon LITM Tools | Soltando follower:", error));
    }
    return;
  }
  if (!isAuthority() || token.actor?.type !== "litm-character") return;
  if (changes.hidden !== undefined || changes.disposition !== undefined) void queueReconcile(token);
}

function onDeleteToken(token) {
  if (!isAuthority() || isManagedToken(token)) return;
  void deleteIds(token.parent, getPokemonTokens(token.parent, token.id).map(t => t.id))
    .catch(error => console.error("Pokemon LITM Tools | Removendo Pokémon do mapa:", error));
}

function changedFlag(changes, name) {
  return changes?.flags?.[MODULE_ID]?.[name] !== undefined
    || Object.prototype.hasOwnProperty.call(changes ?? {}, `flags.${MODULE_ID}.${name}`);
}

function onUpdateActor(actor, changes, options) {
  if (!isAuthority() || actor?.type !== "litm-character") return;
  if (changedFlag(changes, FOLLOWER_FLAG) || changedFlag(changes, LEGACY_ORDER_FLAG)) reconcileActorTokens(actor, {place: true});
}

function isPokemonTheme(item) {
  return item?.type === "themebook" && item.getFlag(MODULE_ID, "pokemonTheme") === true && item.parent?.documentName === "Actor";
}
function onThemeChanged(item) { if (isAuthority() && isPokemonTheme(item)) reconcileActorTokens(item.parent); }

function hudRoot(app, html) {
  return [html, html?.[0], app?.element, app?.element?.[0]].find(x => x instanceof HTMLElement) ?? null;
}
function hudToken(app) {
  const o = app?.object;
  if (o?.documentName === "Token") return o;
  if (o?.document?.documentName === "Token") return o.document;
  return null;
}

function renderHud(app, html) {
  const token = hudToken(app);
  if (!token || !isManagedToken(token) || (!game.user.isGM && !token.isOwner)) return;
  const root = hudRoot(app, html);
  if (!root || root.querySelector("[data-pokemon-follow-toggle]")) return;
  const column = root.querySelector(".col.right") ?? root.querySelector(".right") ?? root;
  const active = isActiveToken(token) && Boolean(token.getFlag(DYLAN_ID, FOLLOWING_FLAG)?.who);
  const button = document.createElement("div");
  button.className = "control-icon";
  button.dataset.pokemonFollowToggle = "true";
  button.title = active ? "Parar de seguir" : "Seguir treinador";
  button.innerHTML = active ? '<i class="fa-solid fa-link-slash"></i>' : '<i class="fa-solid fa-person-walking-arrow-right"></i>';
  button.addEventListener("click", event => {
    event.preventDefault(); event.stopPropagation();
    void (active ? detachToken(token) : resumeToken(token)).catch(error => {
      console.error("Pokemon LITM Tools | HUD follower:", error);
      ui.notifications.error("Não foi possível alterar o seguidor.");
    });
  });
  column.append(button);
}

async function syncScene() {
  if (!isAuthority() || game.system.id !== LITM_SYSTEM_ID || !canvas?.ready || !canvas.scene) return;
  const trainers = canvas.scene.tokens.filter(t => !isManagedToken(t) && t.actor?.type === "litm-character");
  const trainerIds = new Set(trainers.map(t => t.id));
  await deleteIds(canvas.scene, canvas.scene.tokens.filter(t => isManagedToken(t)
    && !trainerIds.has(t.getFlag(MODULE_ID, "trainerTokenId"))).map(t => t.id));
  for (const trainer of trainers) await queueReconcile(trainer, {place: true});
}

export function activatePokemonFollowers() {
  Hooks.on("canvasReady", () => void syncScene().catch(e => console.error("Pokemon LITM Tools | Preparando follower:", e)));
  Hooks.on("createToken", onCreateToken);
  Hooks.on("updateToken", onUpdateToken);
  Hooks.on("deleteToken", onDeleteToken);
  Hooks.on("updateActor", onUpdateActor);
  Hooks.on("createItem", onThemeChanged);
  Hooks.on("updateItem", onThemeChanged);
  Hooks.on("deleteItem", onThemeChanged);
  Hooks.on("renderTokenHUD", renderHud);
  Hooks.on("updateUser", () => { if (isAuthority()) void syncScene(); });
}
