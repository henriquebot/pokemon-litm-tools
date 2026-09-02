const MODULE_ID = "pokemon-litm-tools";
const DYLAN_ID = "dylans-animated-tokens";

function isAuthority() {
  if (!game.user?.isGM) return false;
  const gm = game.users.filter(u => u.active && u.isGM).sort((a, b) => a.id.localeCompare(b.id))[0];
  return gm?.id === game.user.id;
}

function stablePath(value) {
  if (typeof value !== "string") return value;
  const path = value.trim();
  if (!path || /^(?:https?:|data:|blob:)/i.test(path)) return path;
  return path.split(/[?#]/, 1)[0];
}

function visualData(flags) {
  const assets = flags?.assets ?? {};
  const overworld = stablePath(assets.overworld);
  if (!overworld) return null;
  const spritesheet = stablePath(assets.spritesheet ?? overworld);
  const portrait = stablePath(assets.portrait);
  const rawScale = Number(flags?.tokenScale ?? 1);
  const scale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;
  const animated = Boolean(flags?.animation && typeof flags.animation === "object");
  return {overworld, spritesheet, portrait, scale, animated};
}

function actorFlags(actor) { return actor?.flags?.[MODULE_ID] ?? null; }
function tokenFlags(token) {
  const own = token?.flags?.[MODULE_ID];
  if (own?.assets?.overworld) return own;
  return actorFlags(token?.actor);
}

function managedActor(actor) {
  const flags = actorFlags(actor);
  return Boolean(flags?.assets?.overworld && (flags.kind === "pokemon" || flags.kind === "person"));
}

async function repairActor(actor) {
  if (!managedActor(actor)) return;
  const flags = actorFlags(actor);
  const visual = visualData(flags);
  if (!visual) return;
  const update = {
    "prototypeToken.texture.src": visual.overworld,
    "prototypeToken.texture.scaleX": visual.scale,
    "prototypeToken.texture.scaleY": visual.scale,
    [`prototypeToken.flags.${DYLAN_ID}.sheetsrc`]: visual.spritesheet,
    [`prototypeToken.flags.${DYLAN_ID}.spritesheet`]: visual.animated,
    [`flags.${MODULE_ID}.assets.overworld`]: visual.overworld,
    [`flags.${MODULE_ID}.assets.spritesheet`]: visual.spritesheet
  };
  if (visual.portrait) update[`flags.${MODULE_ID}.assets.portrait`] = visual.portrait;
  await actor.update(update, {pokemonVisualRepair: true, diff: false});
}

function tokenRepairUpdate(token) {
  const flags = tokenFlags(token);
  const visual = visualData(flags);
  if (!visual) return null;
  return {
    _id: token.id,
    "texture.src": visual.overworld,
    "texture.scaleX": visual.scale,
    "texture.scaleY": visual.scale,
    [`flags.${DYLAN_ID}.sheetsrc`]: visual.spritesheet,
    [`flags.${DYLAN_ID}.spritesheet`]: visual.animated
  };
}

async function repairScene(scene) {
  if (!isAuthority() || !scene) return;
  const updates = scene.tokens.map(tokenRepairUpdate).filter(Boolean);
  if (!updates.length) return;
  await scene.updateEmbeddedDocuments("Token", updates, {
    pokemonVisualRepair: true,
    follower_updates: [],
    animate: false
  });
}

async function repairOneToken(token) {
  if (!isAuthority() || !token?.parent) return;
  const update = tokenRepairUpdate(token);
  if (!update) return;
  await token.parent.updateEmbeddedDocuments("Token", [update], {
    pokemonVisualRepair: true,
    follower_updates: [],
    animate: false
  });
}

async function repairWorldActors() {
  if (!isAuthority()) return;
  for (const actor of game.actors) {
    if (!managedActor(actor)) continue;
    try { await repairActor(actor); }
    catch (error) { console.error("Pokemon LITM Tools | Reparando visual do Actor:", actor.name, error); }
  }
}

export function activatePokemonVisualStability() {
  Hooks.once("ready", () => void repairWorldActors());
  Hooks.on("canvasReady", canvasInstance => void repairScene(canvasInstance?.scene ?? canvas?.scene));
  Hooks.on("createToken", (token, options) => {
    if (!options?.pokemonVisualRepair) void repairOneToken(token);
  });
  Hooks.on("updateActor", (actor, changes, options) => {
    if (options?.pokemonVisualRepair || !isAuthority()) return;
    const moduleChanges = changes?.flags?.[MODULE_ID];
    if (moduleChanges?.assets !== undefined || moduleChanges?.animation !== undefined || moduleChanges?.tokenScale !== undefined) {
      void repairActor(actor);
    }
  });
}
