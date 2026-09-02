const MODULE_ID = "pokemon-litm-tools";
const DYLAN_ID = "dylans-animated-tokens";
const LITM_SYSTEM_ID = "mist-engine-fvtt";

const ORDER_FLAG = "followerPokemonOrder";
const FOLLOW_FLAG = "following";
const SUSPENDED_FLAG = "followingSuspended";

const reconcileQueues = new Map();
let warnedFollowUnavailable = false;


function isAuthority() {
  if (!game.user?.isGM) return false;

  const gm =
    game.users
      .filter(
        user =>
          user.active
          &&
          user.isGM
      )
      .sort(
        (a, b) =>
          a.id.localeCompare(b.id)
      )[0];

  return gm?.id === game.user.id;
}


function isFollower(token) {
  return (
    token?.getFlag(
      MODULE_ID,
      "pokemonFollower"
    ) === true
  );
}


function canUseDylanFollow() {
  if (
    !game.modules.get(DYLAN_ID)?.active
  ) {
    return false;
  }

  if (
    game.modules.get("FollowMe")?.active
  ) {
    return false;
  }

  try {
    return (
      game.settings.get(
        DYLAN_ID,
        "enableFollow"
      ) !== false
    );
  } catch {
    return true;
  }
}


function warnFollowUnavailable() {
  if (warnedFollowUnavailable) return;

  warnedFollowUnavailable = true;

  ui.notifications.warn(
    "Pokémon Followers: ative 'Enable Token Following' no Dylan's Animated Tokens."
  );
}


function gridSize() {
  return Number(
    canvas?.grid?.size
    ??
    canvas?.dimensions?.size
    ??
    canvas?.scene?.grid?.size
    ??
    100
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


function normalizeFollowerOrder(
  raw,
  themes
) {
  const result = {};
  const used = new Set();

  const source =
    raw
    &&
    typeof raw === "object"
    &&
    !Array.isArray(raw)
      ? raw
      : {};

  for (const theme of themes) {
    let position =
      Number(
        source[theme.id] ?? 0
      );

    if (
      !Number.isInteger(position)
      ||
      position < 1
      ||
      position > 6
    ) {
      continue;
    }

    while (
      position <= 6
      &&
      used.has(position)
    ) {
      position++;
    }

    if (position > 6) continue;

    used.add(position);
    result[theme.id] = position;
  }

  return result;
}


export function getPokemonFollowerOrder(
  actor
) {
  const themes =
    getPokemonThemes(actor);

  return normalizeFollowerOrder(
    actor?.getFlag(
      MODULE_ID,
      ORDER_FLAG
    ),
    themes
  );
}


export async function setPokemonFollowerOrder(
  actor,
  themeId,
  newPosition
) {
  const themes =
    getPokemonThemes(actor);

  if (
    !themes.some(
      theme =>
        theme.id === themeId
    )
  ) {
    throw new Error(
      "Pokémon da equipe não encontrado."
    );
  }

  const position =
    Math.max(
      0,
      Math.min(
        6,
        Number(newPosition) || 0
      )
    );

  const order = {
    ...getPokemonFollowerOrder(actor)
  };

  delete order[themeId];

  if (position > 0) {
    let movingId = themeId;
    let target = position;

    while (
      movingId
      &&
      target <= 6
    ) {
      const occupant =
        Object.keys(order)
          .find(
            id =>
              Number(order[id])
              === target
          )
        ??
        null;

      order[movingId] = target;
      movingId = occupant;
      target++;
    }

    if (
      movingId
      &&
      target > 6
    ) {
      delete order[movingId];
    }
  }

  await actor.setFlag(
    MODULE_ID,
    ORDER_FLAG,
    order
  );

  return order;
}


function orderedFollowerThemes(
  actor
) {
  const themes =
    getPokemonThemes(actor);

  const order =
    getPokemonFollowerOrder(actor);

  return themes
    .map(
      theme => ({
        theme,
        order:
          Number(
            order[theme.id] ?? 0
          )
      })
    )
    .filter(
      entry =>
        entry.order >= 1
        &&
        entry.order <= 6
    )
    .sort(
      (a, b) =>
        a.order - b.order
    );
}


function getVisual(theme) {
  const flags =
    theme?.flags?.[MODULE_ID]
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
    typeof flags.animation === "object"
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
            spritesheet: true,
            sheetsrc: spritesheet
          }
        : {
            spritesheet: false,
            sheetsrc: overworld
          }
  };
}


function linkedPokemonActor(theme) {
  const id =
    theme?.getFlag(
      MODULE_ID,
      "pokemonActorId"
    );

  return id
    ? game.actors.get(id) ?? null
    : null;
}


function moduleFlags(
  trainer,
  theme,
  order,
  suspended = false
) {
  return {
    pokemonFollower: true,

    trainerTokenId:
      trainer.id,

    trainerActorId:
      trainer.actor?.id
      ??
      null,

    pokemonThemeId:
      theme.id,

    pokemonActorId:
      theme.getFlag(
        MODULE_ID,
        "pokemonActorId"
      )
      ??
      null,

    pokemonAssetId:
      theme.getFlag(
        MODULE_ID,
        "assetId"
      )
      ??
      null,

    followerOrder:
      order,

    [SUSPENDED_FLAG]:
      suspended
  };
}


function behindVector(trainer) {
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

  if (
    angle >= 45
    &&
    angle < 135
  ) {
    return {
      x: size,
      y: 0
    };
  }

  if (
    angle >= 135
    &&
    angle < 225
  ) {
    return {
      x: 0,
      y: size
    };
  }

  if (
    angle >= 225
    &&
    angle < 315
  ) {
    return {
      x: -size,
      y: 0
    };
  }

  return {
    x: 0,
    y: -size
  };
}


function chainPosition(
  trainer,
  index
) {
  const vector =
    behindVector(trainer);

  return {
    x:
      Number(trainer.x ?? 0)
      +
      vector.x * index,

    y:
      Number(trainer.y ?? 0)
      +
      vector.y * index,

    elevation:
      Number(
        trainer.elevation ?? 0
      )
  };
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


async function deleteFollowers(
  scene,
  trainerId
) {
  const followers =
    getFollowers(
      scene,
      trainerId
    );

  if (!followers.length) return;

  await scene.deleteEmbeddedDocuments(
    "Token",
    followers.map(
      token =>
        token.id
    ),
    {
      pokemonFollowerSync: true
    }
  );
}


function followerCreateData(
  trainer,
  theme,
  order,
  position
) {
  const visual =
    getVisual(theme);

  const pokemonActor =
    linkedPokemonActor(theme);

  /*
   * Fallback no Actor do treinador para
   * que um jogador que possui o treinador
   * também possa controlar o follower.
   *
   * Assim que o Pokémon Manager for aberto,
   * cada Pokémon recebe seu Actor próprio.
   */
  const actorId =
    pokemonActor?.id
    ??
    trainer.actor?.id
    ??
    null;

  return {
    name:
      theme.name,

    actorId,

    actorLink:
      Boolean(actorId),

    x:
      position.x,

    y:
      position.y,

    elevation:
      position.elevation,

    width: 1,
    height: 1,

    locked: false,
    lockRotation: true,

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

    texture: {
      src:
        visual.overworld,

      scaleX:
        visual.scale,

      scaleY:
        visual.scale
    },

    sight: {
      enabled: false
    },

    flags: {
      [MODULE_ID]:
        moduleFlags(
          trainer,
          theme,
          order,
          false
        ),

      [DYLAN_ID]:
        visual.dylan
    }
  };
}


function followerIsSuspended(
  follower
) {
  return (
    follower?.getFlag(
      MODULE_ID,
      SUSPENDED_FLAG
    ) === true
  );
}


function followerThemeId(
  follower
) {
  return (
    follower?.getFlag(
      MODULE_ID,
      "pokemonThemeId"
    )
    ??
    null
  );
}


function followingData(
  leader,
  follower
) {
  return {
    who:
      leader.id,

    dist:
      gridSize(),

    positions: [
      {
        x:
          Number(
            follower.x ?? 0
          ),

        y:
          Number(
            follower.y ?? 0
          )
      },

      {
        x:
          Number(
            leader.x ?? 0
          ),

        y:
          Number(
            leader.y ?? 0
          )
      }
    ]
  };
}


async function reconcileTrainer(
  trainer,
  {
    placeAll = false,
    placeThemeIds = null,
    refreshAppearance = false
  } = {}
) {
  if (
    !isAuthority()
    ||
    !trainer?.parent
    ||
    isFollower(trainer)
    ||
    trainer.actor?.type
      !==
      "litm-character"
  ) {
    return;
  }

  const scene =
    trainer.parent;

  if (
    !scene.tokens.get(
      trainer.id
    )
  ) {
    return;
  }

  const desired =
    orderedFollowerThemes(
      trainer.actor
    );

  const desiredThemeIds =
    new Set(
      desired.map(
        entry =>
          entry.theme.id
      )
    );

  const followers =
    getFollowers(
      scene,
      trainer.id
    );

  const byTheme =
    new Map();

  const deleteIds = [];

  for (const follower of followers) {
    const themeId =
      followerThemeId(follower);

    if (
      !themeId
      ||
      !desiredThemeIds.has(themeId)
      ||
      byTheme.has(themeId)
    ) {
      deleteIds.push(
        follower.id
      );

      continue;
    }

    byTheme.set(
      themeId,
      follower
    );
  }

  if (deleteIds.length) {
    await scene.deleteEmbeddedDocuments(
      "Token",
      deleteIds,
      {
        pokemonFollowerSync: true
      }
    );
  }

  const createdThemeIds =
    new Set();

  const createData = [];

  for (
    let index = 0;
    index < desired.length;
    index++
  ) {
    const {
      theme,
      order
    } =
      desired[index];

    if (
      byTheme.has(
        theme.id
      )
    ) {
      continue;
    }

    createData.push(
      followerCreateData(
        trainer,
        theme,
        order,
        chainPosition(
          trainer,
          index + 1
        )
      )
    );

    createdThemeIds.add(
      theme.id
    );
  }

  if (createData.length) {
    const created =
      await scene
        .createEmbeddedDocuments(
          "Token",
          createData,
          {
            pokemonFollowerSync: true
          }
        );

    for (const follower of created) {
      const themeId =
        followerThemeId(follower);

      if (themeId) {
        byTheme.set(
          themeId,
          follower
        );
      }
    }
  }

  if (!desired.length) return;

  if (!canUseDylanFollow()) {
    warnFollowUnavailable();
    return;
  }

  const updates = [];

  let leader =
    trainer;

  let activeIndex = 0;

  for (const entry of desired) {
    const {
      theme,
      order
    } =
      entry;

    const follower =
      byTheme.get(
        theme.id
      );

    if (!follower) continue;

    const suspended =
      followerIsSuspended(
        follower
      );

    const moduleUpdate =
      moduleFlags(
        trainer,
        theme,
        order,
        suspended
      );

    if (suspended) {
      const update = {
        _id:
          follower.id,

        locked:
          false,

        ["flags." + MODULE_ID]:
          moduleUpdate,

        ["flags." + DYLAN_ID + "." + FOLLOW_FLAG]:
          null
      };

      if (
        follower.hidden
        !==
        Boolean(trainer.hidden)
      ) {
        update.hidden =
          Boolean(trainer.hidden);
      }

      if (
        Number(
          follower.disposition
        )
        !==
        Number(
          trainer.disposition
          ??
          CONST
            .TOKEN_DISPOSITIONS
            .FRIENDLY
        )
      ) {
        update.disposition =
          Number(
            trainer.disposition
            ??
            CONST
              .TOKEN_DISPOSITIONS
              .FRIENDLY
          );
      }

      updates.push(update);
      continue;
    }

    activeIndex++;

    const shouldPlace =
      placeAll
      ||
      createdThemeIds.has(
        theme.id
      )
      ||
      placeThemeIds?.has?.(
        theme.id
      );

    const update = {
      _id:
        follower.id,

      locked:
        false,

      ["flags." + MODULE_ID]:
        moduleUpdate
    };

    if (shouldPlace) {
      const position =
        chainPosition(
          trainer,
          activeIndex
        );

      update.x =
        position.x;

      update.y =
        position.y;

      update.elevation =
        position.elevation;
    }

    const visual =
      getVisual(theme);

    const pokemonActor =
      linkedPokemonActor(theme);

    const desiredActorId =
      pokemonActor?.id
      ??
      trainer.actor?.id
      ??
      null;

    if (
      desiredActorId
      &&
      follower.actorId
        !==
        desiredActorId
    ) {
      update.actorId =
        desiredActorId;

      update.actorLink =
        true;
    }

    if (refreshAppearance) {
      const currentTexture =
        follower.texture;

      if (
        currentTexture?.src
          !==
          visual.overworld
        ||
        Number(
          currentTexture?.scaleX ?? 1
        )
          !==
          visual.scale
        ||
        Number(
          currentTexture?.scaleY ?? 1
        )
          !==
          visual.scale
      ) {
        update.texture = {
          src:
            visual.overworld,

          scaleX:
            visual.scale,

          scaleY:
            visual.scale
        };
      }

      update[
        "flags."
        +
        DYLAN_ID
      ] = {
        ...visual.dylan,
        [FOLLOW_FLAG]:
          followingData(
            leader,
            follower
          )
      };
    } else {
      update[
        "flags."
        +
        DYLAN_ID
        +
        "."
        +
        FOLLOW_FLAG
      ] =
        followingData(
          leader,
          follower
        );
    }

    if (
      follower.hidden
      !==
      Boolean(trainer.hidden)
    ) {
      update.hidden =
        Boolean(trainer.hidden);
    }

    if (
      Number(
        follower.disposition
      )
      !==
      Number(
        trainer.disposition
        ??
        CONST
          .TOKEN_DISPOSITIONS
          .FRIENDLY
      )
    ) {
      update.disposition =
        Number(
          trainer.disposition
          ??
          CONST
            .TOKEN_DISPOSITIONS
            .FRIENDLY
        );
    }

    updates.push(update);

    leader =
      follower;
  }

  if (updates.length) {
    await scene.updateEmbeddedDocuments(
      "Token",
      updates,
      {
        follower_updates: [],
        forced: true,
        teleport:
          placeAll
          ||
          Boolean(
            placeThemeIds?.size
          ),
        animate: false,
        pokemonFollowerSync: true
      }
    );
  }
}


function queueReconcile(
  trainer,
  options = {}
) {
  const sceneId =
    trainer?.parent?.id;

  const trainerId =
    trainer?.id;

  if (
    !sceneId
    ||
    !trainerId
  ) {
    return Promise.resolve();
  }

  const key =
    sceneId
    +
    ":"
    +
    trainerId;

  const previous =
    reconcileQueues.get(key)
    ??
    Promise.resolve();

  const next =
    previous
      .catch(
        () => {}
      )
      .then(
        () =>
          reconcileTrainer(
            trainer,
            options
          )
      )
      .catch(
        error => {
          console.error(
            "Pokemon LITM Tools | Pokémon follower:",
            error
          );
        }
      );

  reconcileQueues.set(
    key,
    next
  );

  void next.finally(
    () => {
      if (
        reconcileQueues.get(key)
        === next
      ) {
        reconcileQueues.delete(
          key
        );
      }
    }
  );

  return next;
}


function reconcileActorTokens(
  actor,
  options = {}
) {
  if (
    !isAuthority()
    ||
    !canvas?.ready
    ||
    !canvas.scene
  ) {
    return;
  }

  const trainers =
    canvas.scene.tokens.filter(
      token =>
        !isFollower(token)
        &&
        token.actor?.id
          ===
          actor.id
    );

  for (const trainer of trainers) {
    void queueReconcile(
      trainer,
      options
    );
  }
}


export function refreshPokemonFollowersForActor(
  actor,
  options = {}
) {
  reconcileActorTokens(
    actor,
    options
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
    canvas.scene.tokens.filter(
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
    canvas.scene.tokens.filter(
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
        ),
        {
          pokemonFollowerSync: true
        }
      );
  }

  for (const trainer of trainers) {
    await queueReconcile(
      trainer,
      {
        refreshAppearance: true
      }
    );
  }
}


function changedActorFlag(
  changes,
  flagName
) {
  if (
    changes?.flags?.[
      MODULE_ID
    ]?.[flagName]
      !== undefined
  ) {
    return true;
  }

  return Object.prototype
    .hasOwnProperty.call(
      changes ?? {},
      "flags."
      +
      MODULE_ID
      +
      "."
      +
      flagName
    );
}


function changedTokenFlag(
  changes,
  flagName
) {
  if (
    changes?.flags?.[
      MODULE_ID
    ]?.[flagName]
      !== undefined
  ) {
    return true;
  }

  return Object.prototype
    .hasOwnProperty.call(
      changes ?? {},
      "flags."
      +
      MODULE_ID
      +
      "."
      +
      flagName
    );
}


function trainerForFollower(
  follower
) {
  const trainerId =
    follower?.getFlag(
      MODULE_ID,
      "trainerTokenId"
    );

  return trainerId
    ? follower.parent?.tokens?.get(
        trainerId
      )
      ??
      null
    : null;
}


async function markFollowerSuspended(
  follower,
  suspended
) {
  if (!follower) return;

  await follower.update(
    {
      [
        "flags."
        +
        MODULE_ID
        +
        "."
        +
        SUSPENDED_FLAG
      ]:
        suspended,

      [
        "flags."
        +
        DYLAN_ID
        +
        "."
        +
        FOLLOW_FLAG
      ]:
        suspended
          ? null
          : follower.getFlag(
              DYLAN_ID,
              FOLLOW_FLAG
            )
    },
    {
      pokemonFollowerSync: true,
      follower_updates: []
    }
  );
}


async function suspendFollower(
  follower
) {
  await markFollowerSuspended(
    follower,
    true
  );

  const trainer =
    trainerForFollower(
      follower
    );

  if (
    trainer
    &&
    isAuthority()
  ) {
    await queueReconcile(
      trainer
    );
  }
}


async function resumeFollower(
  follower
) {
  await markFollowerSuspended(
    follower,
    false
  );

  const trainer =
    trainerForFollower(
      follower
    );

  if (
    trainer
    &&
    isAuthority()
  ) {
    const themeId =
      followerThemeId(
        follower
      );

    await queueReconcile(
      trainer,
      {
        placeAll: true
      }
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

  void queueReconcile(
    token,
    {
      placeAll: true,
      refreshAppearance: true
    }
  );
}


function onUpdateToken(
  token,
  changes,
  options
) {
  if (isFollower(token)) {
    if (!isAuthority()) return;

    const moved =
      changes.x !== undefined
      ||
      changes.y !== undefined;

    const internalMove =
      options?.pokemonFollowerSync
      ||
      Array.isArray(
        options?.follower_updates
      );

    if (
      moved
      &&
      !internalMove
      &&
      !followerIsSuspended(
        token
      )
    ) {
      void suspendFollower(
        token
      ).catch(
        error => {
          console.error(
            "Pokemon LITM Tools | Soltando follower:",
            error
          );
        }
      );

      return;
    }

    if (
      changedTokenFlag(
        changes,
        SUSPENDED_FLAG
      )
    ) {
      const trainer =
        trainerForFollower(
          token
        );

      if (!trainer) return;

      void queueReconcile(
        trainer,
        followerIsSuspended(
          token
        )
          ? {}
          : {
              placeAll: true
            }
      );
    }

    return;
  }

  if (
    !isAuthority()
    ||
    token.actor?.type
      !==
      "litm-character"
  ) {
    return;
  }

  if (
    changes.hidden !== undefined
    ||
    changes.disposition !== undefined
  ) {
    void queueReconcile(token);
  }
}


function onDeleteToken(token) {
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
        "Pokemon LITM Tools | Removendo followers:",
        error
      );
    }
  );
}


function onUpdateActor(
  actor,
  changes
) {
  if (
    !isAuthority()
    ||
    actor?.type !== "litm-character"
  ) {
    return;
  }

  if (
    changedActorFlag(
      changes,
      ORDER_FLAG
    )
  ) {
    reconcileActorTokens(
      actor,
      {
        placeAll: true
      }
    );
  }
}


function isPokemonThemeItem(item) {
  return (
    item?.type === "themebook"
    &&
    item.getFlag(
      MODULE_ID,
      "pokemonTheme"
    ) === true
    &&
    item.parent?.documentName
      ===
      "Actor"
  );
}


function onPokemonThemeCreatedOrDeleted(
  item
) {
  if (
    !isAuthority()
    ||
    !isPokemonThemeItem(item)
  ) {
    return;
  }

  reconcileActorTokens(
    item.parent,
    {
      refreshAppearance: true
    }
  );
}


function onPokemonThemeUpdated(
  item,
  changes
) {
  if (
    !isAuthority()
    ||
    !isPokemonThemeItem(item)
  ) {
    return;
  }

  const moduleChanges =
    changes?.flags?.[
      MODULE_ID
    ]
    ??
    {};

  const visualChanged =
    changes?.name !== undefined
    ||
    changes?.img !== undefined
    ||
    moduleChanges.assets !== undefined
    ||
    moduleChanges.animation !== undefined
    ||
    moduleChanges.tokenScale !== undefined
    ||
    moduleChanges.pokemonActorId !== undefined;

  if (!visualChanged) {
    return;
  }

  reconcileActorTokens(
    item.parent,
    {
      refreshAppearance: true
    }
  );
}

function hudRoot(
  app,
  html
) {
  const candidates = [
    html,
    html?.[0],
    app?.element,
    app?.element?.[0]
  ];

  return candidates.find(
    candidate =>
      candidate instanceof HTMLElement
  )
  ??
  null;
}


function hudTokenDocument(
  app
) {
  const object =
    app?.object;

  if (
    object?.documentName === "Token"
  ) {
    return object;
  }

  if (
    object?.document?.documentName
      ===
      "Token"
  ) {
    return object.document;
  }

  return null;
}


function addFollowerHudButton(
  app,
  html
) {
  const token =
    hudTokenDocument(app);

  if (
    !token
    ||
    !isFollower(token)
    ||
    (
      !game.user.isGM
      &&
      !token.isOwner
    )
  ) {
    return;
  }

  const root =
    hudRoot(
      app,
      html
    );

  if (!root) return;

  if (
    root.querySelector(
      "[data-pokemon-follow-toggle]"
    )
  ) {
    return;
  }

  const column =
    root.querySelector(
      ".col.right"
    )
    ??
    root.querySelector(
      ".right"
    )
    ??
    root;

  const suspended =
    followerIsSuspended(
      token
    );

  const button =
    document.createElement(
      "div"
    );

  button.className =
    "control-icon";

  button.dataset
    .pokemonFollowToggle =
      "true";

  button.title =
    suspended
      ? "Seguir treinador"
      : "Parar de seguir";

  button.innerHTML =
    suspended
      ? '<i class="fa-solid fa-link"></i>'
      : '<i class="fa-solid fa-link-slash"></i>';

  button.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopPropagation();

      const action =
        followerIsSuspended(
          token
        )
          ? resumeFollower(token)
          : suspendFollower(token);

      void action.catch(
        error => {
          console.error(
            "Pokemon LITM Tools | HUD follower:",
            error
          );

          ui.notifications.error(
            "Não foi possível alterar o estado do seguidor."
          );
        }
      );
    }
  );

  column.append(button);
}


export function activatePokemonFollowers() {
  Hooks.on(
    "canvasReady",
    () => {
      void syncScene()
        .catch(
          error => {
            console.error(
              "Pokemon LITM Tools | Preparando followers:",
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
    "createItem",
    onPokemonThemeCreatedOrDeleted
  );

  Hooks.on(
    "updateItem",
    onPokemonThemeUpdated
  );

  Hooks.on(
    "deleteItem",
    onPokemonThemeCreatedOrDeleted
  );

  Hooks.on(
    "renderTokenHUD",
    addFollowerHudButton
  );

  Hooks.on(
    "updateUser",
    () => {
      if (!isAuthority()) return;

      void syncScene()
        .catch(
          error => {
            console.error(
              "Pokemon LITM Tools | Autoridade de followers:",
              error
            );
          }
        );
    }
  );
}
