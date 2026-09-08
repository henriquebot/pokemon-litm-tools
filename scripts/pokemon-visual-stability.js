const MODULE_ID = "pokemon-litm-tools";
const DYLAN_ID = "dylans-animated-tokens";

function isAuthority() {
  if (!game.user?.isGM) return false;
  const gm = game.users
    .filter(user => user.active && user.isGM)
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  return gm?.id === game.user.id;
}

function assetPath(value) {
  return typeof value === "string" ? value.trim() : value;
}

function actorFlags(actor) {
  return actor?.flags?.[MODULE_ID] ?? null;
}

function tokenFlags(token) {
  const own = token?.flags?.[MODULE_ID];
  if (own?.assets?.overworld) return own;
  return actorFlags(token?.actor);
}

function managedActor(actor) {
  const flags = actorFlags(actor);
  return Boolean(
    flags?.assets?.overworld
    && (flags.kind === "pokemon" || flags.kind === "person")
  );
}

function isPokemonVisual(flags) {
  return Boolean(
    flags?.kind === "pokemon"
    || flags?.pokemonBuilder === true
    || flags?.pokemonTheme === true
    || flags?.combatProjection === true
    || flags?.pokemonFollowerToken === true
    || flags?.pokemonInstanceId
  );
}

function visualData(flags) {
  const assets = flags?.assets ?? {};
  const overworld = assetPath(assets.overworld);
  if (!overworld) return null;

  const spritesheet = assetPath(assets.spritesheet ?? overworld);
  const portrait = assetPath(assets.portrait);
  const rawScale = Number(flags?.tokenScale ?? 1);
  const scale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;
  const animated = Boolean(flags?.animation && typeof flags.animation === "object");

  return { overworld, spritesheet, portrait, scale, animated };
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
    [`prototypeToken.flags.${MODULE_ID}.assets.overworld`]: visual.overworld,
    [`prototypeToken.flags.${MODULE_ID}.assets.spritesheet`]: visual.spritesheet
  };

  if (isPokemonVisual(flags)) {
    // A geometria do Token continua usando a âncora central nativa do Foundry.
    // O alinhamento "crescer da base para cima" é apenas visual e acontece
    // no mesh renderizado em alignPokemonTokenArt().
    update["prototypeToken.texture.anchorX"] = 0.5;
    update["prototypeToken.texture.anchorY"] = 0.5;
  }

  if (visual.portrait) {
    update.img = visual.portrait;
    update[`prototypeToken.flags.${MODULE_ID}.assets.portrait`] = visual.portrait;
  }

  await actor.update(update, { pokemonVisualRepair: true, diff: false });
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
    [`flags.${MODULE_ID}.assets.overworld`]: visual.overworld,
    [`flags.${MODULE_ID}.assets.spritesheet`]: visual.spritesheet
  };

  if (isPokemonVisual(flags)) {
    update["texture.anchorX"] = 0.5;
    update["texture.anchorY"] = 0.5;
  }

  if (visual.portrait) update[`flags.${MODULE_ID}.assets.portrait`] = visual.portrait;
  return update;
}

function tokenPixelSize(tokenObject) {
  const document = tokenObject?.document ?? tokenObject;
  const grid = Number(
    tokenObject?.scene?.grid?.size
    ?? document?.parent?.grid?.size
    ?? canvas?.grid?.size
    ?? canvas?.dimensions?.size
    ?? 100
  );

  const width = Number(tokenObject?.w)
    || Math.max(1, Number(document?.width ?? 1)) * grid;
  const height = Number(tokenObject?.h)
    || Math.max(1, Number(document?.height ?? 1)) * grid;

  return { width, height };
}

function alignPokemonTokenArt(tokenObject) {
  const document = tokenObject?.document ?? tokenObject;
  if (!document) return;

  const flags = tokenFlags(document);
  if (!isPokemonVisual(flags)) return;

  const mesh = tokenObject?.mesh ?? tokenObject?.icon ?? null;
  if (!mesh || mesh.destroyed) return;

  const { width, height } = tokenPixelSize(tokenObject);
  const visual = visualData(flags);
  const scaleY = Math.abs(Number(document?.texture?.scaleY ?? visual?.scale ?? 1)) || 1;

  let artHeight = Number(mesh.height);
  if (!Number.isFinite(artHeight) || artHeight <= 0) {
    artHeight = height * scaleY;
  }

  try {
    mesh.anchor?.set?.(0.5, 0.5);

    // mesh.position é local ao Token. O centro horizontal continua no centro
    // do footprint e a borda inferior da arte coincide com a base do Token.
    mesh.position?.set?.(
      width / 2,
      height - artHeight / 2
    );
  } catch (error) {
    console.warn("Pokemon LITM Tools | Alinhando arte do Token:", error);
  }
}

function schedulePokemonTokenArt(tokenObject) {
  if (!tokenObject) return;
  requestAnimationFrame(() => alignPokemonTokenArt(tokenObject));
  setTimeout(() => alignPokemonTokenArt(tokenObject), 50);
}

async function repairScene(scene) {
  if (!isAuthority() || !scene) return;
  const updates = scene.tokens.map(tokenRepairUpdate).filter(Boolean);

  if (updates.length) {
    await scene.updateEmbeddedDocuments("Token", updates, {
      pokemonVisualRepair: true,
      follower_updates: [],
      animate: false
    });
  }

  for (const token of canvas?.tokens?.placeables ?? []) {
    schedulePokemonTokenArt(token);
  }
}

async function repairOneToken(token) {
  if (!isAuthority() || !token?.parent) return;
  const update = tokenRepairUpdate(token);
  if (update) {
    await token.parent.updateEmbeddedDocuments("Token", [update], {
      pokemonVisualRepair: true,
      follower_updates: [],
      animate: false
    });
  }
  schedulePokemonTokenArt(token.object ?? canvas?.tokens?.get?.(token.id));
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
    for (const token of canvas?.tokens?.placeables ?? []) schedulePokemonTokenArt(token);
  });

  Hooks.on("drawToken", tokenObject => schedulePokemonTokenArt(tokenObject));
  Hooks.on("refreshToken", tokenObject => schedulePokemonTokenArt(tokenObject));

  Hooks.on("createToken", (token, options) => {
    if (!options?.pokemonVisualRepair) void repairOneToken(token);
    else schedulePokemonTokenArt(token.object ?? canvas?.tokens?.get?.(token.id));
  });

  Hooks.on("updateToken", (token, changes, options) => {
    if (!options?.pokemonVisualRepair && isAuthority()) {
      const moduleChanges = changes?.flags?.[MODULE_ID];
      if (
        moduleChanges?.assets !== undefined
        || moduleChanges?.animation !== undefined
        || moduleChanges?.tokenScale !== undefined
        || changes?.texture !== undefined
      ) {
        void repairOneToken(token);
        return;
      }
    }
    schedulePokemonTokenArt(token.object ?? canvas?.tokens?.get?.(token.id));
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
