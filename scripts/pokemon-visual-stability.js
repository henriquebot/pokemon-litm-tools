const MODULE_ID = "pokemon-litm-tools";
const DYLAN_ID = "dylans-animated-tokens";
const VISUAL_SCHEMA = 9;

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

function cleanPart(value) {
  return String(value ?? "asset")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");
}

function extensionFor(path) {
  const clean = stablePath(path) ?? "";
  const match = clean.match(/(\.[a-zA-Z0-9]+)$/);
  return match?.[1] ?? ".png";
}

async function sha256Short(blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map(value => value.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12);
}

async function immutableCopy(path, prefix, assetId) {
  const clean = stablePath(path);
  if (!clean) return null;

  const separator = clean.includes("?") ? "&" : "?";
  const response = await fetch(`${clean}${separator}pokemonCacheBust=${Date.now()}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} lendo ${clean}`);
  }

  const blob = await response.blob();
  const hash = await sha256Short(blob);
  const filename = `${prefix}-${cleanPart(assetId)}-${hash}${extensionFor(clean)}`;
  const file = new File([blob], filename, {
    type: blob.type || "image/png"
  });

  const uploaded = await foundry.applications.apps.FilePicker.uploadPersistent(
    MODULE_ID,
    "",
    file,
    { overwrite: true },
    { notify: false }
  );

  const result = uploaded?.path ?? uploaded?.url ?? uploaded?.file ?? null;
  if (!result) {
    throw new Error(`Upload persistente falhou para ${filename}`);
  }

  return stablePath(result);
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
  return { overworld, spritesheet, portrait, scale, animated };
}

function actorFlags(actor) {
  return actor?.flags?.[MODULE_ID] ?? null;
}

function tokenFlags(token) {
  const own = token?.flags?.[MODULE_ID];
  const actor = actorFlags(token?.actor);

  const ownSchema = Number(own?.schemaVersion ?? 0);
  const actorSchema = Number(actor?.schemaVersion ?? 0);

  if (actor?.assets?.overworld && actorSchema > ownSchema) return actor;
  if (own?.assets?.overworld) return own;
  return actor;
}

function managedActor(actor) {
  const flags = actorFlags(actor);
  return Boolean(
    flags?.assets?.overworld
    && (flags.kind === "pokemon" || flags.kind === "person")
  );
}

async function migrateActorAssets(actor) {
  let flags = actorFlags(actor);
  if (!flags || Number(flags.schemaVersion ?? 0) >= VISUAL_SCHEMA) return flags;

  const kindPrefix = flags.kind === "pokemon" ? "pokemon" : "person";
  const assetId = flags.assetId ?? actor.id;
  const assets = flags.assets ?? {};

  const [overworld, spritesheet, portrait] = await Promise.all([
    immutableCopy(assets.overworld, `${kindPrefix}-overworld`, assetId),
    immutableCopy(assets.spritesheet ?? assets.overworld, `${kindPrefix}-sheet`, assetId),
    assets.portrait
      ? immutableCopy(assets.portrait, `${kindPrefix}-portrait`, assetId)
      : Promise.resolve(null)
  ]);

  const update = {
    [`flags.${MODULE_ID}.schemaVersion`]: VISUAL_SCHEMA,
    [`flags.${MODULE_ID}.assets.overworld`]: overworld,
    [`flags.${MODULE_ID}.assets.spritesheet`]: spritesheet
  };

  if (portrait) {
    update[`flags.${MODULE_ID}.assets.portrait`] = portrait;
  }

  await actor.update(update, {
    pokemonVisualRepair: true,
    diff: false
  });

  return actorFlags(actor);
}

async function repairActor(actor) {
  if (!managedActor(actor)) return;

  let flags = actorFlags(actor);
  if (Number(flags?.schemaVersion ?? 0) < VISUAL_SCHEMA) {
    flags = await migrateActorAssets(actor);
  }

  const visual = visualData(flags);
  if (!visual) return;

  const update = {
    "prototypeToken.texture.src": visual.overworld,
    "prototypeToken.texture.scaleX": visual.scale,
    "prototypeToken.texture.scaleY": visual.scale,
    [`prototypeToken.flags.${DYLAN_ID}.sheetsrc`]: visual.spritesheet,
    [`prototypeToken.flags.${DYLAN_ID}.spritesheet`]: visual.animated,
    [`prototypeToken.flags.${MODULE_ID}.schemaVersion`]: VISUAL_SCHEMA,
    [`prototypeToken.flags.${MODULE_ID}.assets.overworld`]: visual.overworld,
    [`prototypeToken.flags.${MODULE_ID}.assets.spritesheet`]: visual.spritesheet,
    [`flags.${MODULE_ID}.schemaVersion`]: VISUAL_SCHEMA,
    [`flags.${MODULE_ID}.assets.overworld`]: visual.overworld,
    [`flags.${MODULE_ID}.assets.spritesheet`]: visual.spritesheet
  };

  if (visual.portrait) {
    update.img = visual.portrait;
    update[`prototypeToken.flags.${MODULE_ID}.assets.portrait`] = visual.portrait;
    update[`flags.${MODULE_ID}.assets.portrait`] = visual.portrait;
  }

  await actor.update(update, {
    pokemonVisualRepair: true,
    diff: false
  });
}

function tokenRepairUpdate(token) {
  const flags = tokenFlags(token);
  const visual = visualData(flags);
  if (!visual) return null;

  const update = {
    _id: token.id,
    "texture.src": visual.overworld,
    "texture.scaleX": visual.scale,
    "texture.scaleY": visual.scale,
    [`flags.${DYLAN_ID}.sheetsrc`]: visual.spritesheet,
    [`flags.${DYLAN_ID}.spritesheet`]: visual.animated,
    [`flags.${MODULE_ID}.schemaVersion`]: Number(flags?.schemaVersion ?? VISUAL_SCHEMA),
    [`flags.${MODULE_ID}.assets.overworld`]: visual.overworld,
    [`flags.${MODULE_ID}.assets.spritesheet`]: visual.spritesheet
  };

  if (visual.portrait) {
    update[`flags.${MODULE_ID}.assets.portrait`] = visual.portrait;
  }

  return update;
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

    try {
      await repairActor(actor);
    } catch (error) {
      console.error("Pokemon LITM Tools | Reparando visual do Actor:", actor.name, error);
    }
  }

  if (canvas?.scene) {
    try {
      await repairScene(canvas.scene);
    } catch (error) {
      console.error("Pokemon LITM Tools | Reparando tokens da Scene:", error);
    }
  }
}

export function activatePokemonVisualStability() {
  Hooks.once("ready", () => void repairWorldActors());

  Hooks.on("canvasReady", canvasInstance => {
    void repairScene(canvasInstance?.scene ?? canvas?.scene);
  });

  Hooks.on("createToken", (token, options) => {
    if (!options?.pokemonVisualRepair) void repairOneToken(token);
  });

  Hooks.on("updateActor", (actor, changes, options) => {
    if (options?.pokemonVisualRepair || !isAuthority()) return;

    const moduleChanges = changes?.flags?.[MODULE_ID];
    if (
      moduleChanges?.assets !== undefined
      || moduleChanges?.animation !== undefined
      || moduleChanges?.tokenScale !== undefined
    ) {
      void repairActor(actor);
    }
  });
}
