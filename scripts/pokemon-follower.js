const MODULE_ID = "pokemon-litm-tools";
const DYLAN_ID = "dylans-animated-tokens";
const LITM_SYSTEM_ID = "mist-engine-fvtt";

const trainerPositions = new Map();
const movementQueues = new Map();


function isAuthority() {
  if (!game.user?.isGM) return false;

  const gms = game.users
    .filter(
      user =>
        user.active
        &&
        user.isGM
    )
    .sort(
      (a, b) =>
        a.id.localeCompare(b.id)
    );

  return gms[0]?.id === game.user.id;
}


function isFollower(token) {
  return (
    token?.getFlag(
      MODULE_ID,
      "pokemonFollower"
    ) === true
  );
}


function getPokemonThemes(actor) {
  if (
    actor?.documentName !== "Actor"
    ||
    actor.type !== "litm-character"
  ) {
    return [];
  }

  return actor.items
    .filter(
      item =>
        item.type === "themebook"
        &&
        item.getFlag(
          MODULE_ID,
          "pokemonTheme"
        ) === true
        &&
        item.getFlag(
          MODULE_ID,
          "themeRole"
        ) === "pokemon"
    )
    .sort(
      (a, b) =>
        Number(
          a.getFlag(
            MODULE_ID,
            "pokemonTeamSlot"
          ) ?? 999
        )
        -
        Number(
          b.getFlag(
            MODULE_ID,
            "pokemonTeamSlot"
          ) ?? 999
        )
    );
}


function getActivePokemonTheme(actor) {
  const themes =
    getPokemonThemes(actor);

  if (!themes.length) {
    return null;
  }

  const activeId =
    actor.getFlag(
      MODULE_ID,
      "activePokemonThemeId"
    );

  return (
    themes.find(
      theme =>
        theme.id === activeId
    )
    ??
    themes[0]
  );
}


function getFollowers(
  scene,
  trainerId
) {
  return (
    scene?.tokens.filter(
      token =>
        isFollower(token)
        &&
        token.getFlag(
          MODULE_ID,
          "trainerTokenId"
        ) === trainerId
    )
    ??
    []
  );
}


function rememberTrainer(token) {
  trainerPositions.set(
    token.id,
    {
      x:
        Number(
          token.x ?? 0
        ),

      y:
        Number(
          token.y ?? 0
        ),

      elevation:
        Number(
          token.elevation ?? 0
        )
    }
  );
}


function gridSize() {
  return Number(
    canvas?.dimensions?.size
    ??
    canvas?.grid?.size
    ??
    canvas?.scene?.grid?.size
    ??
    100
  );
}


function initialPosition(trainer) {
  const size =
    gridSize();

  const angle =
    (
      (
        Number(
          trainer.rotation ?? 0
        )
        %
        360
      )
      +
      360
    )
    %
    360;

  let dx = 0;
  let dy = -size;

  if (
    angle >= 45
    &&
    angle < 135
  ) {
    dx = size;
    dy = 0;
  }

  else if (
    angle >= 135
    &&
    angle < 225
  ) {
    dx = 0;
    dy = size;
  }

  else if (
    angle >= 225
    &&
    angle < 315
  ) {
    dx = -size;
    dy = 0;
  }

  return {
    x:
      Number(
        trainer.x ?? 0
      )
      +
      dx,

    y:
      Number(
        trainer.y ?? 0
      )
      +
      dy,

    elevation:
      Number(
        trainer.elevation ?? 0
      )
  };
}


function getVisual(theme) {
  const flags =
    theme?.flags?.[
      MODULE_ID
    ]
    ??
    {};

  const assets =
    flags.assets
    ??
    {};

  const overworld =
    assets.overworld
    ??
    theme.img
    ??
    "icons/svg/mystery-man.svg";

  const spritesheet =
    assets.spritesheet
    ??
    overworld;

  const rawScale =
    Number(
      flags.tokenScale ?? 1
    );

  const scale =
    Number.isFinite(rawScale)
    &&
    rawScale > 0
      ? rawScale
      : 1;

  const animation =
    flags.animation
    &&
    typeof flags.animation
      === "object"
      ? foundry.utils.deepClone(
          flags.animation
        )
      : null;

  return {
    overworld,

    scale,

    dylan:
      animation
        ? {
            ...animation,

            spritesheet:
              true,

            sheetsrc:
              spritesheet
          }
        : {
            spritesheet:
              false,

            sheetsrc:
              overworld
          }
  };
}


function moduleFlags(
  trainer,
  theme
) {
  return {
    pokemonFollower:
      true,

    trainerTokenId:
      trainer.id,

    trainerActorId:
      trainer.actor?.id
      ??
      null,

    pokemonThemeId:
      theme.id,

    pokemonAssetId:
      theme.getFlag(
        MODULE_ID,
        "assetId"
      )
      ??
      null
  };
}


function followerData(
  trainer,
  theme,
  position
) {
  const visual =
    getVisual(theme);

  return {
    name:
      theme.name,

    actorId:
      null,

    actorLink:
      false,

    x:
      position.x,

    y:
      position.y,

    elevation:
      position.elevation,

    width:
      1,

    height:
      1,

    locked:
      true,

    lockRotation:
      true,

    rotation:
      Number(
        trainer.rotation ?? 0
      ),

    hidden:
      Boolean(
        trainer.hidden
      ),

    disposition:
      Number(
        trainer.disposition
        ??
        CONST
          .TOKEN_DISPOSITIONS
          .FRIENDLY
      ),

    displayName:
      CONST
        .TOKEN_DISPLAY_MODES
        .NONE,

    displayBars:
      CONST
        .TOKEN_DISPLAY_MODES
        .NONE,

    sort:
      Math.floor(
        position.y
        /
        gridSize()
      ),

    texture: {
      src:
        visual.overworld,

      scaleX:
        visual.scale,

      scaleY:
        visual.scale
    },

    sight: {
      enabled:
        false
    },

    flags: {
      [MODULE_ID]:
        moduleFlags(
          trainer,
          theme
        ),

      [DYLAN_ID]:
        visual.dylan
    }
  };
}


async function deleteFollowers(
  scene,
  trainerId
) {
  const followers =
    getFollowers(
      scene,
      trainerId
    );

  if (!followers.length) {
    return;
  }

  await scene
    .deleteEmbeddedDocuments(
      "Token",

      followers.map(
        token =>
          token.id
      )
    );
}


async function ensureFollower(
  trainer
) {
  if (
    !isAuthority()
    ||
    !trainer?.parent
    ||
    isFollower(trainer)
  ) {
    return null;
  }

  const scene =
    trainer.parent;

  const theme =
    getActivePokemonTheme(
      trainer.actor
    );

  if (!theme) {
    await deleteFollowers(
      scene,
      trainer.id
    );

    return null;
  }

  const followers =
    getFollowers(
      scene,
      trainer.id
    );

  let follower =
    followers[0]
    ??
    null;

  if (
    followers.length > 1
  ) {
    await scene
      .deleteEmbeddedDocuments(
        "Token",

        followers
          .slice(1)
          .map(
            token =>
              token.id
          )
      );
  }

  if (!follower) {
    const created =
      await scene
        .createEmbeddedDocuments(
          "Token",

          [
            followerData(
              trainer,
              theme,
              initialPosition(
                trainer
              )
            )
          ]
        );

    follower =
      created?.[0]
      ??
      null;
  }

  return follower;
}


async function syncAppearance(
  trainer
) {
  const follower =
    await ensureFollower(
      trainer
    );

  const theme =
    getActivePokemonTheme(
      trainer.actor
    );

  if (
    !follower
    ||
    !theme
  ) {
    return;
  }

  const visual =
    getVisual(theme);

  await follower.update({
    name:
      theme.name,

    hidden:
      Boolean(
        trainer.hidden
      ),

    disposition:
      Number(
        trainer.disposition
        ??
        CONST
          .TOKEN_DISPOSITIONS
          .FRIENDLY
      ),

    texture: {
      src:
        visual.overworld,

      scaleX:
        visual.scale,

      scaleY:
        visual.scale
    },

    ["flags." + MODULE_ID]:
      moduleFlags(
        trainer,
        theme
      ),

    ["flags." + DYLAN_ID]:
      visual.dylan
  });
}


function queueMove(
  trainerId,
  task
) {
  const previous =
    movementQueues.get(
      trainerId
    )
    ??
    Promise.resolve();

  const next =
    previous
      .catch(
        () => {}
      )
      .then(task)
      .catch(
        error => {
          console.error(
            "Pokemon LITM Tools | Follower movement:",
            error
          );
        }
      );

  movementQueues.set(
    trainerId,
    next
  );

  void next.finally(
    () => {
      if (
        movementQueues.get(
          trainerId
        ) === next
      ) {
        movementQueues.delete(
          trainerId
        );
      }
    }
  );
}


async function moveFollower(
  trainer,
  previous
) {
  const follower =
    await ensureFollower(
      trainer
    );

  if (!follower) {
    return;
  }

  await follower.update(
    {
      x:
        previous.x,

      y:
        previous.y,

      elevation:
        previous.elevation
    },

    {
      animate:
        true,

      pan:
        false,

      showRuler:
        false,

      method:
        "api"
    }
  );
}


async function syncScene() {
  if (
    !isAuthority()
    ||
    game.system.id
      !==
      LITM_SYSTEM_ID
    ||
    !canvas?.ready
    ||
    !canvas.scene
  ) {
    return;
  }

  const trainers =
    canvas.scene.tokens
      .filter(
        token =>
          !isFollower(token)
          &&
          token.actor?.type
            ===
            "litm-character"
      );

  const trainerIds =
    new Set(
      trainers.map(
        token =>
          token.id
      )
    );

  const orphans =
    canvas.scene.tokens
      .filter(
        token =>
          isFollower(token)
          &&
          !trainerIds.has(
            token.getFlag(
              MODULE_ID,
              "trainerTokenId"
            )
          )
      );

  if (orphans.length) {
    await canvas.scene
      .deleteEmbeddedDocuments(
        "Token",

        orphans.map(
          token =>
            token.id
        )
      );
  }

  for (
    const trainer
    of trainers
  ) {
    rememberTrainer(
      trainer
    );

    await syncAppearance(
      trainer
    );
  }
}


function onCreateToken(token) {
  if (
    !isAuthority()
    ||
    isFollower(token)
    ||
    token.actor?.type
      !==
      "litm-character"
  ) {
    return;
  }

  rememberTrainer(
    token
  );

  void syncAppearance(
    token
  ).catch(
    error => {
      console.error(
        "Pokemon LITM Tools | Creating follower:",
        error
      );
    }
  );
}


function onUpdateToken(
  token,
  changes
) {
  if (
    !isAuthority()
    ||
    isFollower(token)
    ||
    token.actor?.type
      !==
      "litm-character"
  ) {
    return;
  }

  const previous =
    trainerPositions.get(
      token.id
    )
    ??
    {
      x:
        Number(
          token.x ?? 0
        ),

      y:
        Number(
          token.y ?? 0
        ),

      elevation:
        Number(
          token.elevation ?? 0
        )
    };

  rememberTrainer(
    token
  );

  const moved =
    changes.x !== undefined
    ||
    changes.y !== undefined
    ||
    changes.elevation
      !== undefined;

  if (moved) {
    queueMove(
      token.id,

      () =>
        moveFollower(
          token,
          previous
        )
    );
  }

  if (
    changes.hidden
      !== undefined
    ||
    changes.disposition
      !== undefined
  ) {
    void syncAppearance(
      token
    ).catch(
      error => {
        console.error(
          "Pokemon LITM Tools | Syncing follower:",
          error
        );
      }
    );
  }
}


function onDeleteToken(token) {
  trainerPositions.delete(
    token.id
  );

  movementQueues.delete(
    token.id
  );

  if (
    !isAuthority()
    ||
    isFollower(token)
  ) {
    return;
  }

  void deleteFollowers(
    token.parent,
    token.id
  ).catch(
    error => {
      console.error(
        "Pokemon LITM Tools | Deleting follower:",
        error
      );
    }
  );
}


function onUpdateActor(
  actor,
  changes
) {
  const nestedChange =
    changes?.flags?.[
      MODULE_ID
    ]?.activePokemonThemeId
      !== undefined;

  const flatKey =
    "flags."
    +
    MODULE_ID
    +
    ".activePokemonThemeId";

  const flatChange =
    Object.prototype
      .hasOwnProperty.call(
        changes ?? {},
        flatKey
      );

  if (
    !isAuthority()
    ||
    actor?.type
      !==
      "litm-character"
    ||
    (
      !nestedChange
      &&
      !flatChange
    )
    ||
    !canvas?.ready
    ||
    !canvas.scene
  ) {
    return;
  }

  const trainers =
    canvas.scene.tokens
      .filter(
        token =>
          !isFollower(token)
          &&
          token.actor?.id
            ===
            actor.id
      );

  for (
    const trainer
    of trainers
  ) {
    void syncAppearance(
      trainer
    ).catch(
      error => {
        console.error(
          "Pokemon LITM Tools | Switching follower:",
          error
        );
      }
    );
  }
}


export function activatePokemonFollowers() {
  Hooks.on(
    "canvasReady",

    () => {
      void syncScene()
        .catch(
          error => {
            console.error(
              "Pokemon LITM Tools | Follower setup:",
              error
            );
          }
        );
    }
  );

  Hooks.on(
    "createToken",
    onCreateToken
  );

  Hooks.on(
    "updateToken",
    onUpdateToken
  );

  Hooks.on(
    "deleteToken",
    onDeleteToken
  );

  Hooks.on(
    "updateActor",
    onUpdateActor
  );

  Hooks.on(
    "updateUser",

    () => {
      if (!isAuthority()) {
        return;
      }

      void syncScene()
        .catch(
          error => {
            console.error(
              "Pokemon LITM Tools | Follower authority:",
              error
            );
          }
        );
    }
  );
}
