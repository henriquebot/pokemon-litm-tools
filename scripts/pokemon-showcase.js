const MODULE_ID = "pokemon-litm-tools";
const SOCKET_NAME = `module.${MODULE_ID}`;

const REACTIONS = Object.freeze({
  alert: { label: "!", title: "Surpresa / alerta" },
  question: { label: "?", title: "Dúvida / curiosidade" },
  speech: { label: "...", title: "Pensando / hesitando" },
  heart: { label: "♥", title: "Carinho / alegria" },
  anger: { label: "💢", title: "Raiva" },
  sweat: { label: "💧", title: "Tensão / medo" },
  sleep: { label: "Zzz", title: "Sono" }
});

const tokenStates = new WeakMap();

let activated = false;
let tickerBound = false;
let socketBound = false;


function readSetting(
  key,
  fallback = true
) {
  try {
    return game.settings.get(
      MODULE_ID,
      key
    );
  } catch {
    return fallback;
  }
}


function tokenFxEnabled() {
  return readSetting(
    "visualShowcaseTokenFx",
    true
  ) !== false;
}


function reactionsEnabled() {
  return readSetting(
    "visualShowcaseReactions",
    true
  ) !== false;
}


function moduleFlags(
  source
) {
  return (
    source?.flags?.[
      MODULE_ID
    ]
    ?? {}
  );
}


function pokemonFlags(
  token
) {
  const actorFlags =
    moduleFlags(
      token?.actor
    );

  const tokenFlags =
    moduleFlags(
      token?.document
      ?? token
    );

  return {
    ...actorFlags,
    ...tokenFlags,

    assets: {
      ...(
        actorFlags.assets
        ?? {}
      ),
      ...(
        tokenFlags.assets
        ?? {}
      )
    }
  };
}


function isPokemonToken(
  token
) {
  const flags =
    pokemonFlags(
      token
    );

  return Boolean(
    flags.kind === "pokemon"
    ||
    flags.kind === "pokemon-combat"
    ||
    flags.pokemonBuilder === true
    ||
    flags.pokemonTheme === true
    ||
    flags.pokemonCombatToken === true
    ||
    flags.pokemonFollowerToken === true
    ||
    flags.combatProjection === true
    ||
    flags.pokemonInstanceId
  );
}


function normalizedWords(
  values
) {
  return (
    Array.isArray(values)
      ? values
      : []
  )
    .map(value =>
      String(
        value?.id
        ?? value?.name
        ?? value
        ?? ""
      )
        .trim()
        .toLocaleLowerCase()
    )
    .filter(Boolean);
}


function tokenTypes(
  token
) {
  const flags =
    pokemonFlags(
      token
    );

  return normalizedWords(
    flags.types
  );
}


function flyingPokemon(
  token
) {
  const flags =
    pokemonFlags(
      token
    );

  const types =
    tokenTypes(
      token
    );

  const ability =
    [
      flags.ability?.id,
      flags.ability?.name,
      flags.ability?.englishName
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();

  return (
    types.includes(
      "flying"
    )
    ||
    types.includes(
      "voador"
    )
    ||
    ability.includes(
      "levitate"
    )
    ||
    ability.includes(
      "levitação"
    )
  );
}


function waterPokemon(
  token
) {
  const types =
    tokenTypes(
      token
    );

  return (
    types.includes(
      "water"
    )
    ||
    types.includes(
      "água"
    )
    ||
    types.includes(
      "agua"
    )
  );
}


function statusText(
  token
) {
  const rows =
    token?.actor
      ?.system
      ?.floatingTagsAndStatuses;

  if (
    !Array.isArray(rows)
  ) {
    return "";
  }

  return rows
    .map(row => {
      if (
        typeof row
        === "string"
      ) {
        return row;
      }

      return [
        row?.name,
        row?.status,
        row?.tag,
        row?.value,
        row?.text
      ]
        .filter(Boolean)
        .join(" ");
    })
    .join(" ")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLocaleLowerCase();
}


function statusProfile(
  token
) {
  const text =
    statusText(
      token
    );

  const profiles = [
    {
      terms: [
        "paralis",
        "paraly"
      ],
      icon: "⚡",
      color: 0xf4d03f
    },
    {
      terms: [
        "queim",
        "burn"
      ],
      icon: "🔥",
      color: 0xff7043
    },
    {
      terms: [
        "enven",
        "poison",
        "toxic"
      ],
      icon: "☠",
      color: 0x9b59b6
    },
    {
      terms: [
        "congel",
        "freeze",
        "frozen"
      ],
      icon: "❄",
      color: 0x74d7ea
    },
    {
      terms: [
        "dorm",
        "sleep",
        "asleep"
      ],
      icon: "Z",
      color: 0x8e9aaf
    }
  ];

  return (
    profiles.find(
      profile =>
        profile.terms.some(
          term =>
            text.includes(
              term
            )
        )
    )
    ?? null
  );
}


function tokenPixels(
  token
) {
  const fallback =
    Number(
      canvas?.grid?.size
      ?? 100
    );

  const width =
    Number(
      token?.w
      ?? (
        Number(
          token?.document
            ?.width
          ?? 1
        )
        * fallback
      )
    );

  const height =
    Number(
      token?.h
      ?? (
        Number(
          token?.document
            ?.height
          ?? 1
        )
        * fallback
      )
    );

  return {
    width:
      Number.isFinite(width)
        && width > 0
        ? width
        : fallback,

    height:
      Number.isFinite(height)
        && height > 0
        ? height
        : fallback
  };
}


function graphicsEllipse(
  graphics,
  x,
  y,
  radiusX,
  radiusY,
  color,
  alpha
) {
  if (
    typeof graphics.ellipse
      === "function"
    &&
    typeof graphics.fill
      === "function"
  ) {
    graphics
      .ellipse(
        x,
        y,
        radiusX,
        radiusY
      )
      .fill({
        color,
        alpha
      });

    return;
  }

  graphics.beginFill(
    color,
    alpha
  );

  graphics.drawEllipse(
    x,
    y,
    radiusX,
    radiusY
  );

  graphics.endFill();
}


function graphicsEllipseStroke(
  graphics,
  x,
  y,
  radiusX,
  radiusY,
  color,
  alpha,
  width
) {
  if (
    typeof graphics.ellipse
      === "function"
    &&
    typeof graphics.stroke
      === "function"
  ) {
    graphics
      .ellipse(
        x,
        y,
        radiusX,
        radiusY
      )
      .stroke({
        color,
        alpha,
        width
      });

    return;
  }

  graphics.lineStyle(
    width,
    color,
    alpha
  );

  graphics.drawEllipse(
    x,
    y,
    radiusX,
    radiusY
  );
}


function graphicsRoundRect(
  graphics,
  x,
  y,
  width,
  height,
  radius,
  fill,
  fillAlpha,
  stroke,
  strokeAlpha = 1,
  strokeWidth = 2
) {
  if (
    typeof graphics.roundRect
      === "function"
    &&
    typeof graphics.fill
      === "function"
  ) {
    graphics
      .roundRect(
        x,
        y,
        width,
        height,
        radius
      )
      .fill({
        color:
          fill,
        alpha:
          fillAlpha
      })
      .stroke({
        color:
          stroke,
        alpha:
          strokeAlpha,
        width:
          strokeWidth
      });

    return;
  }

  graphics.lineStyle(
    strokeWidth,
    stroke,
    strokeAlpha
  );

  graphics.beginFill(
    fill,
    fillAlpha
  );

  graphics.drawRoundedRect(
    x,
    y,
    width,
    height,
    radius
  );

  graphics.endFill();
}


function makeText(
  text,
  style
) {
  try {
    return new PIXI.Text({
      text,
      style
    });
  } catch {
    return new PIXI.Text(
      text,
      style
    );
  }
}


function safeDestroy(
  displayObject
) {
  if (
    !displayObject
    ||
    displayObject.destroyed
  ) {
    return;
  }

  try {
    displayObject.destroy({
      children: true
    });
  } catch {
    try {
      displayObject.destroy();
    } catch {}
  }
}


function clearTokenShowcase(
  token
) {
  const state =
    tokenStates.get(
      token
    );

  if (!state) {
    return;
  }

  const mesh =
    token?.mesh
    ?? token?.icon
    ?? null;

  if (
    mesh?.pivot
    &&
    Number.isFinite(
      state.basePivotY
    )
  ) {
    try {
      mesh.pivot.y =
        state.basePivotY;
    } catch {}
  }

  safeDestroy(
    state.under
  );

  safeDestroy(
    state.over
  );

  tokenStates.delete(
    token
  );
}


function drawTokenShowcase(
  token
) {
  clearTokenShowcase(
    token
  );

  if (
    !tokenFxEnabled()
    ||
    !isPokemonToken(
      token
    )
    ||
    token?.destroyed
  ) {
    return;
  }

  const {
    width,
    height
  } =
    tokenPixels(
      token
    );

  const flying =
    flyingPokemon(
      token
    );

  const water =
    waterPokemon(
      token
    );

  const status =
    statusProfile(
      token
    );

  const under =
    new PIXI.Container();

  const over =
    new PIXI.Container();

  under.eventMode =
    "none";

  over.eventMode =
    "none";

  under.sortableChildren =
    true;

  over.sortableChildren =
    true;

  try {
    token.addChildAt(
      under,
      0
    );

    token.addChild(
      over
    );
  } catch {
    safeDestroy(under);
    safeDestroy(over);
    return;
  }

  const shadow =
    new PIXI.Graphics();

  graphicsEllipse(
    shadow,
    width / 2,
    height * (
      flying
        ? 0.86
        : 0.82
    ),
    width * (
      flying
        ? 0.24
        : 0.29
    ),
    height * (
      flying
        ? 0.07
        : 0.085
    ),
    0x05060a,
    flying
      ? 0.22
      : 0.38
  );

  shadow.zIndex =
    -30;

  under.addChild(
    shadow
  );

  let waterOuter =
    null;

  let waterInner =
    null;

  if (water) {
    waterOuter =
      new PIXI.Graphics();

    waterInner =
      new PIXI.Graphics();

    graphicsEllipseStroke(
      waterOuter,
      width / 2,
      height * 0.84,
      width * 0.33,
      height * 0.105,
      0x64d8ff,
      0.42,
      2
    );

    graphicsEllipseStroke(
      waterInner,
      width / 2,
      height * 0.84,
      width * 0.23,
      height * 0.072,
      0xd7f7ff,
      0.28,
      1.5
    );

    waterOuter.zIndex =
      -29;

    waterInner.zIndex =
      -28;

    under.addChild(
      waterOuter,
      waterInner
    );
  }

  let statusRing =
    null;

  let statusIcon =
    null;

  if (status) {
    statusRing =
      new PIXI.Graphics();

    graphicsEllipseStroke(
      statusRing,
      width / 2,
      height / 2,
      width * 0.38,
      height * 0.38,
      status.color,
      0.78,
      3
    );

    statusRing.zIndex =
      20;

    over.addChild(
      statusRing
    );

    statusIcon =
      makeText(
        status.icon,
        {
          fontFamily:
            "monospace",
          fontWeight:
            "900",
          fontSize:
            Math.max(
              15,
              Math.min(
                24,
                width * 0.22
              )
            ),
          fill:
            "#ffffff",
          stroke:
            "#14101a",
          strokeThickness:
            5,
          align:
            "center"
        }
      );

    statusIcon.anchor
      ?.set?.(
        0.5
      );

    statusIcon.position.set(
      width * 0.82,
      height * 0.12
    );

    statusIcon.zIndex =
      30;

    over.addChild(
      statusIcon
    );
  }

  const mesh =
    token?.mesh
    ?? token?.icon
    ?? null;

  const basePivotY =
    Number(
      mesh?.pivot?.y
      ?? 0
    );

  tokenStates.set(
    token,
    {
      under,
      over,
      shadow,
      waterOuter,
      waterInner,
      statusRing,
      statusIcon,
      flying,
      phase:
        Math.random()
        * Math.PI
        * 2,
      basePivotY:
        Number.isFinite(
          basePivotY
        )
          ? basePivotY
          : 0
    }
  );
}


function refreshShowcaseCanvas() {
  for (
    const token
    of (
      canvas?.tokens
        ?.placeables
      ?? []
    )
  ) {
    drawTokenShowcase(
      token
    );
  }
}


function showcaseTick() {
  const now =
    performance.now()
    / 1000;

  for (
    const token
    of (
      canvas?.tokens
        ?.placeables
      ?? []
    )
  ) {
    const state =
      tokenStates.get(
        token
      );

    if (
      !state
      ||
      token?.destroyed
    ) {
      continue;
    }

    const wave =
      Math.sin(
        now * 2.2
        + state.phase
      );

    if (
      state.flying
    ) {
      state.shadow.alpha =
        0.17
        + (
          wave + 1
        )
        * 0.035;

      state.shadow.scale.x =
        0.94
        + (
          wave + 1
        )
        * 0.03;

      const mesh =
        token?.mesh
        ?? token?.icon
        ?? null;

      if (
        mesh?.pivot
      ) {
        try {
          mesh.pivot.y =
            state.basePivotY
            + wave * 2.2;
        } catch {}
      }
    }

    if (
      state.waterOuter
    ) {
      state.waterOuter.alpha =
        0.42
        + (
          wave + 1
        )
        * 0.13;

      const scale =
        0.97
        + (
          wave + 1
        )
        * 0.035;

      state.waterOuter.scale.set(
        scale
      );
    }

    if (
      state.waterInner
    ) {
      const wave2 =
        Math.sin(
          now * 2.7
          + state.phase
          + 1.4
        );

      state.waterInner.alpha =
        0.25
        + (
          wave2 + 1
        )
        * 0.12;
    }

    if (
      state.statusRing
    ) {
      state.statusRing.alpha =
        0.56
        + (
          wave + 1
        )
        * 0.2;
    }
  }
}


function ensureTicker() {
  if (
    tickerBound
    ||
    !canvas?.app?.ticker
  ) {
    return;
  }

  tickerBound =
    true;

  canvas.app.ticker.add(
    showcaseTick
  );
}


function tokenObject(
  tokenLike
) {
  if (
    tokenLike?.document
    &&
    tokenLike?.actor
  ) {
    return tokenLike;
  }

  if (
    tokenLike?.object
  ) {
    return tokenLike.object;
  }

  const id =
    typeof tokenLike === "string"
      ? tokenLike
      : tokenLike?.id;

  if (!id) {
    return null;
  }

  return (
    canvas?.tokens?.get?.(
      id
    )
    ?? null
  );
}


function localReaction(
  token,
  reaction,
  duration = 1250
) {
  if (
    !reactionsEnabled()
    ||
    !token
    ||
    !isPokemonToken(
      token
    )
  ) {
    return false;
  }

  if (
    !tokenStates.has(
      token
    )
  ) {
    drawTokenShowcase(
      token
    );
  }

  const state =
    tokenStates.get(
      token
    );

  if (!state?.over) {
    return false;
  }

  const profile =
    REACTIONS[
      reaction
    ]
    ?? REACTIONS.alert;

  const {
    width
  } =
    tokenPixels(
      token
    );

  if (
    state.reaction
  ) {
    safeDestroy(
      state.reaction
    );

    state.reaction =
      null;
  }

  const bubble =
    new PIXI.Container();

  bubble.eventMode =
    "none";

  const label =
    profile.label;

  const bubbleWidth =
    label.length > 2
      ? 66
      : 46;

  const bubbleHeight =
    38;

  const background =
    new PIXI.Graphics();

  graphicsRoundRect(
    background,
    -bubbleWidth / 2,
    -bubbleHeight / 2,
    bubbleWidth,
    bubbleHeight,
    8,
    0xfff8e7,
    0.98,
    0x231b2b,
    1,
    3
  );

  const text =
    makeText(
      label,
      {
        fontFamily:
          "monospace",
        fontWeight:
          "900",
        fontSize:
          label === "Zzz"
            ? 18
            : 25,
        fill:
          "#2a2132",
        align:
          "center"
      }
    );

  text.anchor
    ?.set?.(
      0.5
    );

  bubble.addChild(
    background,
    text
  );

  bubble.position.set(
    width / 2,
    -16
  );

  bubble.zIndex =
    100;

  state.over.addChild(
    bubble
  );

  state.reaction =
    bubble;

  const started =
    performance.now();

  const total =
    Math.max(
      650,
      Number(
        duration
        ?? 1250
      )
    );

  const frame =
    now => {
      if (
        bubble.destroyed
      ) {
        return;
      }

      const progress =
        Math.max(
          0,
          Math.min(
            1,
            (
              now
              - started
            )
            / total
          )
        );

      const bounce =
        Math.sin(
          progress
          * Math.PI
        );

      bubble.y =
        -16
        - bounce * 12;

      bubble.scale.set(
        0.72
        + Math.min(
          1,
          progress * 5
        )
        * 0.28
      );

      bubble.alpha =
        progress < 0.72
          ? 1
          : (
              1
              - (
                  progress
                  - 0.72
                )
                / 0.28
            );

      if (
        progress < 1
      ) {
        requestAnimationFrame(
          frame
        );
        return;
      }

      safeDestroy(
        bubble
      );

      if (
        state.reaction ===
        bubble
      ) {
        state.reaction =
          null;
      }
    };

  requestAnimationFrame(
    frame
  );

  return true;
}


export function showPokemonReaction(
  tokenLike,
  reaction = "alert",
  duration = 1250,
  {
    broadcast = true
  } = {}
) {
  const token =
    tokenObject(
      tokenLike
    );

  if (!token) {
    return false;
  }

  const shown =
    localReaction(
      token,
      reaction,
      duration
    );

  if (
    shown
    &&
    broadcast
    &&
    canvas?.scene?.id
    &&
    game.socket
  ) {
    game.socket.emit(
      SOCKET_NAME,
      {
        kind:
          "showcase-reaction",
        sourceUserId:
          game.user?.id,
        sceneId:
          canvas.scene.id,
        tokenId:
          token.id,
        reaction,
        duration
      }
    );
  }

  return shown;
}


function localBurst(
  token,
  mode = "deploy"
) {
  if (
    !tokenFxEnabled()
    ||
    !token
    ||
    !isPokemonToken(
      token
    )
  ) {
    return false;
  }

  const {
    width,
    height
  } =
    tokenPixels(
      token
    );

  const burst =
    new PIXI.Container();

  burst.eventMode =
    "none";

  const ringWhite =
    new PIXI.Graphics();

  const ringRed =
    new PIXI.Graphics();

  graphicsEllipseStroke(
    ringWhite,
    width / 2,
    height / 2,
    width * 0.28,
    height * 0.28,
    0xffffff,
    0.95,
    4
  );

  graphicsEllipseStroke(
    ringRed,
    width / 2,
    height / 2,
    width * 0.39,
    height * 0.39,
    0xff4d57,
    0.78,
    3
  );

  burst.addChild(
    ringRed,
    ringWhite
  );

  const particles = [];

  for (
    let index = 0;
    index < 8;
    index++
  ) {
    const particle =
      new PIXI.Graphics();

    graphicsEllipse(
      particle,
      0,
      0,
      2.8,
      2.8,
      index % 2
        ? 0xffffff
        : 0xff4d57,
      0.95
    );

    const angle =
      (
        Math.PI
        * 2
        * index
      )
      / 8;

    particle.position.set(
      width / 2
      + Math.cos(angle)
        * width * 0.2,
      height / 2
      + Math.sin(angle)
        * height * 0.2
    );

    particle._pokemonAngle =
      angle;

    burst.addChild(
      particle
    );

    particles.push(
      particle
    );
  }

  token.addChild(
    burst
  );

  const started =
    performance.now();

  const total =
    520;

  const reverse =
    mode === "recollect";

  const frame =
    now => {
      if (
        burst.destroyed
      ) {
        return;
      }

      const progress =
        Math.max(
          0,
          Math.min(
            1,
            (
              now
              - started
            )
            / total
          )
        );

      const eased =
        1
        - Math.pow(
            1 - progress,
            3
          );

      const factor =
        reverse
          ? 1.15 - eased * 0.55
          : 0.55 + eased * 0.8;

      ringWhite.scale.set(
        factor
      );

      ringRed.scale.set(
        factor * 1.08
      );

      ringWhite.alpha =
        1 - eased;

      ringRed.alpha =
        0.85
        * (
          1 - eased
        );

      for (
        const particle
        of particles
      ) {
        const distance =
          width
          * (
              0.2
              + eased * 0.42
            );

        particle.position.set(
          width / 2
          + Math.cos(
              particle._pokemonAngle
            )
            * distance,
          height / 2
          + Math.sin(
              particle._pokemonAngle
            )
            * distance
        );

        particle.alpha =
          1 - eased;
      }

      if (
        progress < 1
      ) {
        requestAnimationFrame(
          frame
        );
        return;
      }

      safeDestroy(
        burst
      );
    };

  requestAnimationFrame(
    frame
  );

  return true;
}


export function playPokemonShowcaseBurst(
  tokenLike,
  mode = "deploy"
) {
  const token =
    tokenObject(
      tokenLike
    );

  if (!token) {
    return false;
  }

  return localBurst(
    token,
    mode === "recollect"
      ? "recollect"
      : "deploy"
  );
}


function hudRoot(
  app,
  html
) {
  return (
    app?.element
    ?? (
      html instanceof
        HTMLElement
        ? html
        : html?.[0]
    )
    ?? null
  );
}


function enhanceTokenHud(
  app,
  html
) {
  if (
    !reactionsEnabled()
  ) {
    return;
  }

  const token =
    app?.object
    ?? tokenObject(
      app?.document
    );

  if (
    !token
    ||
    !isPokemonToken(
      token
    )
    ||
    (
      !game.user?.isGM
      &&
      !token.actor?.isOwner
    )
  ) {
    return;
  }

  const root =
    hudRoot(
      app,
      html
    );

  if (
    !root
    ||
    root.querySelector(
      "[data-pokemon-reaction-hud]"
    )
  ) {
    return;
  }

  const strip =
    document.createElement(
      "div"
    );

  strip.className =
    "pokemon-reaction-hud";

  strip.dataset
    .pokemonReactionHud =
      "true";

  for (
    const [
      key,
      profile
    ]
    of Object.entries(
      REACTIONS
    )
  ) {
    const button =
      document.createElement(
        "button"
      );

    button.type =
      "button";

    button.dataset
      .pokemonReaction =
        key;

    button.title =
      profile.title;

    button.textContent =
      profile.label;

    button.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopPropagation();

        showPokemonReaction(
          token,
          key
        );
      }
    );

    strip.append(
      button
    );
  }

  root.append(
    strip
  );
}


function refreshActorTokens(
  actor
) {
  if (!actor) {
    return;
  }

  for (
    const token
    of (
      canvas?.tokens
        ?.placeables
      ?? []
    )
  ) {
    if (
      token.actor?.id
      === actor.id
    ) {
      drawTokenShowcase(
        token
      );
    }
  }
}


function bindSocket() {
  if (
    socketBound
    ||
    !game.socket
  ) {
    return;
  }

  socketBound =
    true;

  game.socket.on(
    SOCKET_NAME,
    message => {
      if (
        message?.kind
          !==
          "showcase-reaction"
        ||
        message.sourceUserId
          === game.user?.id
        ||
        message.sceneId
          !== canvas?.scene?.id
      ) {
        return;
      }

      const token =
        canvas?.tokens?.get?.(
          message.tokenId
        );

      if (!token) {
        return;
      }

      localReaction(
        token,
        message.reaction,
        message.duration
      );
    }
  );
}


export function registerPokemonShowcaseSettings() {
  game.settings.register(
    MODULE_ID,
    "visualShowcaseTokenFx",
    {
      name:
        "Pokémon · Token FX",
      hint:
        "Adiciona sombra, hover de Pokémon voadores, ripple de água, indicadores visuais de status e efeitos de entrada/saída. Não altera a posição do TokenDocument.",
      scope:
        "client",
      config:
        true,
      type:
        Boolean,
      default:
        true,
      onChange:
        refreshShowcaseCanvas
    }
  );

  game.settings.register(
    MODULE_ID,
    "visualShowcaseReactions",
    {
      name:
        "Pokémon · Reactions no Token HUD",
      hint:
        "Mostra atalhos de reação (!, ?, ..., coração, raiva, suor e sono) ao abrir o HUD de um Pokémon.",
      scope:
        "client",
      config:
        true,
      type:
        Boolean,
      default:
        true
    }
  );
}


export function activatePokemonShowcase() {
  if (activated) {
    return;
  }

  activated =
    true;

  Hooks.on(
    "drawToken",
    token => {
      drawTokenShowcase(
        token
      );
    }
  );

  Hooks.on(
    "destroyToken",
    token => {
      clearTokenShowcase(
        token
      );
    }
  );

  Hooks.on(
    "canvasReady",
    () => {
      ensureTicker();
      refreshShowcaseCanvas();
    }
  );

  Hooks.on(
    "updateActor",
    (
      actor,
      changes
    ) => {
      if (
        changes?.system
          ?.floatingTagsAndStatuses
          !== undefined
        ||
        changes?.flags?.[
          MODULE_ID
        ] !== undefined
      ) {
        refreshActorTokens(
          actor
        );
      }
    }
  );

  Hooks.on(
    "updateToken",
    (
      tokenDocument,
      changes
    ) => {
      if (
        changes?.flags?.[
          MODULE_ID
        ] !== undefined
        ||
        changes?.width
          !== undefined
        ||
        changes?.height
          !== undefined
      ) {
        const token =
          tokenObject(
            tokenDocument
          );

        if (token) {
          drawTokenShowcase(
            token
          );
        }
      }
    }
  );

  Hooks.on(
    "createToken",
    tokenDocument => {
      setTimeout(
        () => {
          const token =
            tokenObject(
              tokenDocument
            );

          if (
            !token
            ||
            !isPokemonToken(
              token
            )
          ) {
            return;
          }

          drawTokenShowcase(
            token
          );

          localBurst(
            token,
            "deploy"
          );
        },
        80
      );
    }
  );

  Hooks.on(
    "renderTokenHUD",
    enhanceTokenHud
  );

  Hooks.once(
    "ready",
    () => {
      bindSocket();
      ensureTicker();
      refreshShowcaseCanvas();
    }
  );
}
