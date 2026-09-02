const MODULE_ID = "pokemon-litm-tools";
const DYLAN_ID = "dylans-animated-tokens";
const LITM_SYSTEM_ID = "mist-engine-fvtt";

const ORDER_FLAG = "followerPokemonOrder";
const FOLLOW_FLAG = "following";

const reconcileQueues = new Map();

let warnedFollowUnavailable = false;


/* --------------------------------------------------------- */
/* BASICO                                                    */
/* --------------------------------------------------------- */

function isAuthority() {
  return (
    game.users.find(
      user =>
        user.active &&
        user.isGM
    )?.id
    ===
    game.user.id
  );
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
  const module =
    game.modules.get(DYLAN_ID);

  if (!module?.active) {
    return false;
  }

  /*
   * O Dylan desativa seu Follow interno
   * quando o FollowMe externo esta ativo.
   */
  if (
    game.modules
      .get("FollowMe")
      ?.active
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
  if (warnedFollowUnavailable) {
    return;
  }

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


/* --------------------------------------------------------- */
/* POKEMON THEMES                                            */
/* --------------------------------------------------------- */

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


function defaultFollowerOrder() {
  return {};
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

    /*
     * Corrige silenciosamente duplicatas
     * antigas, empurrando para a proxima
     * posicao disponivel.
     */
    while (
      position <= 6
      &&
      used.has(position)
    ) {
      position++;
    }

    if (position > 6) {
      continue;
    }

    used.add(position);

    result[theme.id] =
      position;
  }

  return result;
}


function getFollowerOrder(
  actor,
  themes
) {
  const raw =
    actor.getFlag(
      MODULE_ID,
      ORDER_FLAG
    );

  if (raw === undefined) {
    return defaultFollowerOrder(
      actor,
      themes
    );
  }

  return normalizeFollowerOrder(
    raw,
    themes
  );
}


async function ensureFollowerOrder(
  actor,
  themes
) {
  const raw =
    actor.getFlag(
      MODULE_ID,
      ORDER_FLAG
    );

  if (raw !== undefined) {
    return normalizeFollowerOrder(
      raw,
      themes
    );
  }

  const order =
    defaultFollowerOrder(
      actor,
      themes
    );

  /*
   * Migracao do follower antigo:
   * o Pokemon que ja seguia vira #1.
   */
  if (
    isAuthority()
    &&
    actor.isOwner
  ) {
    await actor.setFlag(
      MODULE_ID,
      ORDER_FLAG,
      order
    );
  }

  return order;
}


function orderedFollowerThemes(
  themes,
  order
) {
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


/* --------------------------------------------------------- */
/* ALTERAR ORDEM                                             */
/* --------------------------------------------------------- */

async function setFollowerOrder(
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
      "Pokemon da equipe nao encontrado."
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
    ...getFollowerOrder(
      actor,
      themes
    )
  };

  /*
   * Libera a posicao antiga primeiro.
   */
  delete order[themeId];

  if (position > 0) {
    let movingId =
      themeId;

    let target =
      position;

    /*
     * Se a posicao escolhida estiver
     * ocupada, empurra os demais.
     *
     * Ex.:
     * Pikachu 1
     * Eevee   2
     *
     * Togepi escolhe 1:
     * Togepi  1
     * Pikachu 2
     * Eevee   3
     */
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

      order[movingId] =
        target;

      movingId =
        occupant;

      target++;
    }

    /*
     * Se havia 6 seguidores e outro
     * entrou antes deles, o ultimo sai.
     */
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


/* --------------------------------------------------------- */
/* VISUAL DO FOLLOWER                                        */
/* --------------------------------------------------------- */

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
            spritesheet: true,
            sheetsrc: spritesheet
          }
        : {
            spritesheet: false,
            sheetsrc: overworld
          }
  };
}


function moduleFlags(
  trainer,
  theme,
  order
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

    pokemonAssetId:
      theme.getFlag(
        MODULE_ID,
        "assetId"
      )
      ??
      null,

    followerOrder:
      order
  };
}


/* --------------------------------------------------------- */
/* POSICOES INICIAIS                                         */
/* --------------------------------------------------------- */

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

  /*
   * Dylan:
   * 0   = down
   * 90  = left
   * 180 = up
   * 270 = right
   *
   * Queremos o vetor contrario.
   */
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


/* --------------------------------------------------------- */
/* TOKEN FOLLOWERS                                           */
/* --------------------------------------------------------- */

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

  if (!followers.length) {
    return;
  }

  await scene.deleteEmbeddedDocuments(
    "Token",
    followers.map(
      token =>
        token.id
    )
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
          order
        ),

      [DYLAN_ID]:
        visual.dylan
    }
  };
}


/* --------------------------------------------------------- */
/* RECONCILIAR FILA                                          */
/* --------------------------------------------------------- */

async function reconcileTrainer(
  trainer
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

  const themes =
    getPokemonThemes(
      trainer.actor
    );

  const order =
    await ensureFollowerOrder(
      trainer.actor,
      themes
    );

  const desired =
    orderedFollowerThemes(
      themes,
      order
    );

  const desiredThemeIds =
    new Set(
      desired.map(
        entry =>
          entry.theme.id
      )
    );

  let followers =
    getFollowers(
      scene,
      trainer.id
    );

  /*
   * Remove Pokemon que viraram 0,
   * sairam da equipe ou duplicatas
   * deixadas por versoes anteriores.
   */
  const byTheme =
    new Map();

  const deleteIds = [];

  for (const follower of followers) {
    const themeId =
      follower.getFlag(
        MODULE_ID,
        "pokemonThemeId"
      );

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
      deleteIds
    );
  }

  /*
   * Cria somente os que faltam.
   * Followers existentes sao reaproveitados.
   */
  const createData = [];

  for (
    let index = 0;
    index < desired.length;
    index++
  ) {
    const {
      theme,
      order:
        followerOrder
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
        followerOrder,
        chainPosition(
          trainer,
          index + 1
        )
      )
    );
  }

  if (createData.length) {
    const created =
      await scene
        .createEmbeddedDocuments(
          "Token",
          createData
        );

    for (
      const follower
      of created
    ) {
      const themeId =
        follower.getFlag(
          MODULE_ID,
          "pokemonThemeId"
        );

      if (themeId) {
        byTheme.set(
          themeId,
          follower
        );
      }
    }
  }

  /*
   * Nada seguindo.
   */
  if (!desired.length) {
    return;
  }

  if (!canUseDylanFollow()) {
    warnFollowUnavailable();
    return;
  }

  /*
   * Configura:
   *
   * Treinador
   *    ↓
   * Pokemon 1
   *    ↓
   * Pokemon 2
   *    ↓
   * Pokemon 3...
   *
   * A partir daqui NAO movemos mais
   * followers manualmente.
   *
   * Dylan cuida de:
   * - waypoints
   * - curvas
   * - distancia
   * - velocidade
   * - animacao
   */
  const updates = [];

  let leader =
    trainer;

  let leaderPosition = {
    x:
      Number(trainer.x ?? 0),

    y:
      Number(trainer.y ?? 0)
  };

  for (
    let index = 0;
    index < desired.length;
    index++
  ) {
    const {
      theme,
      order:
        followerOrder
    } =
      desired[index];

    const follower =
      byTheme.get(
        theme.id
      );

    if (!follower) {
      continue;
    }

    const position =
      chainPosition(
        trainer,
        index + 1
      );

    const visual =
      getVisual(theme);

    const following = {
      who:
        leader.id,

      dist:
        gridSize(),

      positions: [
        {
          x:
            position.x,

          y:
            position.y
        },

        {
          x:
            leaderPosition.x,

          y:
            leaderPosition.y
        }
      ]
    };

    updates.push({
      _id:
        follower.id,

      name:
        theme.name,

      x:
        position.x,

      y:
        position.y,

      elevation:
        position.elevation,

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
          theme,
          followerOrder
        ),

      ["flags." + DYLAN_ID]: {
        ...visual.dylan,

        [FOLLOW_FLAG]:
          following
      }
    });

    leader =
      follower;

    leaderPosition = {
      x:
        position.x,

      y:
        position.y
    };
  }

  if (updates.length) {
    /*
     * follower_updates: [] faz o proprio
     * wrapper do Dylan ignorar esta
     * reorganizacao administrativa.
     *
     * Ou seja: nao dispara a fila enquanto
     * estamos apenas configurando a fila.
     */
    await scene.updateEmbeddedDocuments(
      "Token",
      updates,
      {
        follower_updates: [],
        teleport: true,
        animate: false
      }
    );
  }
}


/* --------------------------------------------------------- */
/* FILA DE RECONCILIACAO                                     */
/* --------------------------------------------------------- */

function queueReconcile(
  trainer
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
            trainer
          )
      )
      .catch(
        error => {
          console.error(
            "Pokemon LITM Tools | Pokemon follower:",
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
        ===
        next
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
  actor
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
      trainer
    );
  }
}


/* --------------------------------------------------------- */
/* SCENE                                                     */
/* --------------------------------------------------------- */

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

  /*
   * Remove followers cujo treinador
   * nem existe mais na Scene.
   */
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
        )
      );
  }

  for (const trainer of trainers) {
    await queueReconcile(
      trainer
    );
  }
}


/* --------------------------------------------------------- */
/* UI                                                        */
/* --------------------------------------------------------- */

function getActorFromApp(app) {
  const candidates = [
    app?.actor,
    app?.document,
    app?.object,
    app?.options?.document
  ];

  return candidates.find(
    actor =>
      actor?.documentName
        ===
        "Actor"
      &&
      actor?.type
        ===
        "litm-character"
  )
  ??
  null;
}


function getRootElement(
  app,
  html
) {
  const candidates = [
    html,
    html?.[0],
    app?.element,
    app?.element?.[0],
    app?._element,
    app?._element?.[0]
  ];

  return candidates.find(
    candidate =>
      candidate
      instanceof
      HTMLElement
  )
  ??
  null;
}


function createFollowerBar(
  actor,
  themes
) {
  const order =
    getFollowerOrder(
      actor,
      themes
    );

  const bar =
    document.createElement(
      "div"
    );

  bar.className =
    "pokemon-follower-order-bar";

  bar.dataset
    .pokemonFollowerOrderBar =
      "true";

  const header =
    document.createElement(
      "div"
    );

  header.className =
    "pokemon-follower-order-header";

  const icon =
    document.createElement(
      "i"
    );

  icon.className =
    "fa-solid fa-people-arrows";

  const title =
    document.createElement(
      "strong"
    );

  title.textContent =
    "Seguidores";

  const hint =
    document.createElement(
      "span"
    );

  hint.textContent =
    "0 = não segue · 1–6 = ordem";

  header.append(
    icon,
    title,
    hint
  );

  const list =
    document.createElement(
      "div"
    );

  list.className =
    "pokemon-follower-order-list";

  for (const theme of themes) {
    const row =
      document.createElement(
        "label"
      );

    row.className =
      "pokemon-follower-order-item";

    const name =
      document.createElement(
        "span"
      );

    name.textContent =
      theme.name;

    const select =
      document.createElement(
        "select"
      );

    select.dataset
      .pokemonFollowerThemeId =
        theme.id;

    select.title =
      "0 = não segue; 1 a 6 = posição na fila";

    for (
      let value = 0;
      value <= 6;
      value++
    ) {
      const option =
        document.createElement(
          "option"
        );

      option.value =
        String(value);

      option.textContent =
        String(value);

      option.selected =
        Number(
          order[theme.id] ?? 0
        )
        ===
        value;

      select.append(option);
    }

    select.disabled =
      !actor.isOwner;

    select.addEventListener(
      "change",
      async () => {
        const previous =
          Number(
            order[theme.id] ?? 0
          );

        select.disabled =
          true;

        try {
          await setFollowerOrder(
            actor,
            theme.id,
            Number(select.value)
          );
        } catch (error) {
          console.error(
            "Pokemon LITM Tools | Ordem de seguidores:",
            error
          );

          select.value =
            String(previous);

          ui.notifications.error(
            "Não foi possível alterar a fila de Pokémon."
          );
        } finally {
          if (
            select.isConnected
            &&
            actor.isOwner
          ) {
            select.disabled =
              false;
          }
        }
      }
    );

    row.append(
      name,
      select
    );

    list.append(row);
  }

  bar.append(
    header,
    list
  );

  return bar;
}


async function renderFollowerUI(
  app,
  html
) {
  if (
    game.system.id
    !==
    LITM_SYSTEM_ID
  ) {
    return;
  }

  const actor =
    getActorFromApp(app);

  if (!actor) {
    return;
  }

  const themes =
    getPokemonThemes(actor);

  if (!themes.length) {
    return;
  }

  const root =
    getRootElement(
      app,
      html
    );

  if (!root) {
    return;
  }

  root.querySelector(
    "[data-pokemon-follower-order-bar]"
  )?.remove();

  const container =
    root.querySelector(
      ".litm-character-themebooks-container"
    );

  if (!container) {
    return;
  }

  const bar =
    createFollowerBar(
      actor,
      themes
    );

  const activeBar =
    root.querySelector(
      "[data-pokemon-active-theme-bar]"
    );

  if (
    activeBar
    &&
    activeBar.parentElement
      ===
      container
  ) {
    activeBar.insertAdjacentElement(
      "afterend",
      bar
    );
  } else {
    container.prepend(bar);
  }
}


function queueFollowerUI(
  app,
  html
) {
  requestAnimationFrame(
    () => {
      void renderFollowerUI(
        app,
        html
      ).catch(
        error => {
          console.error(
            "Pokemon LITM Tools | UI de seguidores:",
            error
          );
        }
      );
    }
  );
}


/* --------------------------------------------------------- */
/* HOOKS                                                     */
/* --------------------------------------------------------- */

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
    token
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

  /*
   * IMPORTANTE:
   * x/y NAO sao tratados aqui.
   * Movimento pertence 100% ao Dylan.
   */
  if (
    changes.hidden
      !== undefined
    ||
    changes.disposition
      !== undefined
  ) {
    void queueReconcile(
      token
    );
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
    actor?.type
      !==
      "litm-character"
  ) {
    return;
  }

  /*
   * Pokemon ativo e fila de followers
   * agora sao coisas independentes.
   *
   * Trocar Pokemon ativo NAO reorganiza
   * os tokens seguidores.
   */
  if (
    changedActorFlag(
      changes,
      ORDER_FLAG
    )
  ) {
    reconcileActorTokens(
      actor
    );
  }
}


function onPokemonThemeChanged(
  item
) {
  if (
    !isAuthority()
    ||
    item?.type
      !==
      "themebook"
    ||
    item.getFlag(
      MODULE_ID,
      "pokemonTheme"
    ) !== true
  ) {
    return;
  }

  const actor =
    item.parent;

  if (
    actor?.documentName
      ===
      "Actor"
  ) {
    reconcileActorTokens(
      actor
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
    onPokemonThemeChanged
  );

  Hooks.on(
    "updateItem",
    onPokemonThemeChanged
  );

  Hooks.on(
    "deleteItem",
    onPokemonThemeChanged
  );

  Hooks.on(
    "renderMistEngineLegendInTheMistCharacterSheet",
    queueFollowerUI
  );

  Hooks.on(
    "renderApplicationV2",
    queueFollowerUI
  );

  Hooks.on(
    "renderActorSheet",
    queueFollowerUI
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
              "Pokemon LITM Tools | Autoridade de followers:",
              error
            );
          }
        );
    }
  );
}
