const MODULE_ID =
  "pokemon-litm-tools";

const STATE_KEY =
  Symbol(
    "pokemonLitmSelectionOutline"
  );

let hooksInstalled =
  false;

let missingFilterWarning =
  false;


function setting(key) {
  return game.settings.get(
    MODULE_ID,
    key
  );
}


function refreshAll() {
  if (
    !canvas?.ready ||
    !canvas.tokens
  ) {
    return;
  }

  for (
    const token
    of canvas.tokens.placeables ?? []
  ) {
    refreshTokenOutline(token);
  }
}


function registerSetting(
  key,
  data
) {
  game.settings.register(
    MODULE_ID,
    key,
    {
      scope:
        "client",

      config:
        true,

      ...data,

      onChange:
        refreshAll
    }
  );
}


export function registerTokenOutlineSettings() {

  registerSetting(
    "selectionEnabled",
    {
      name:
        "Contorno de selecao",

      hint:
        "Substitui o destaque quadrado por um contorno seguindo a silhueta do token.",

      type:
        Boolean,

      default:
        true
    }
  );


  registerSetting(
    "selectionHideNative",
    {
      name:
        "Ocultar quadrado do Foundry",

      hint:
        "Esconde a borda retangular original de selecao e hover.",

      type:
        Boolean,

      default:
        true
    }
  );


  registerSetting(
    "selectionShowHover",
    {
      name:
        "Mostrar contorno no hover",

      hint:
        "Tambem destaca o token ao passar o mouse.",

      type:
        Boolean,

      default:
        true
    }
  );


  registerSetting(
    "selectionColorMode",
    {
      name:
        "Modo de cor",

      hint:
        "Usar uma cor unica ou cores baseadas na disposicao do token.",

      type:
        String,

      default:
        "disposition",

      choices: {
        disposition:
          "Por disposicao",

        custom:
          "Cor unica"
      }
    }
  );


  registerSetting(
    "selectionCustomColor",
    {
      name:
        "Cor unica do contorno",

      type:
        String,

      default:
        "#ffffff"
    }
  );


  registerSetting(
    "selectionFriendlyColor",
    {
      name:
        "Cor - amigavel",

      type:
        String,

      default:
        "#44c7d9"
    }
  );


  registerSetting(
    "selectionNeutralColor",
    {
      name:
        "Cor - neutro",

      type:
        String,

      default:
        "#f1c40f"
    }
  );


  registerSetting(
    "selectionHostileColor",
    {
      name:
        "Cor - hostil",

      type:
        String,

      default:
        "#ff3a3a"
    }
  );


  registerSetting(
    "selectionSecretColor",
    {
      name:
        "Cor - secreto",

      type:
        String,

      default:
        "#9b59b6"
    }
  );


  registerSetting(
    "selectionThickness",
    {
      name:
        "Grossura do contorno",

      type:
        Number,

      default:
        3,

      range: {
        min:
          1,

        max:
          10,

        step:
          1
      }
    }
  );


  registerSetting(
    "selectionOutlineAlpha",
    {
      name:
        "Opacidade do contorno",

      type:
        Number,

      default:
        1,

      range: {
        min:
          0.1,

        max:
          1,

        step:
          0.05
      }
    }
  );


  registerSetting(
    "selectionGlowEnabled",
    {
      name:
        "Ativar brilho",

      type:
        Boolean,

      default:
        true
    }
  );


  registerSetting(
    "selectionGlowUseOutline",
    {
      name:
        "Brilho usa a cor do contorno",

      type:
        Boolean,

      default:
        true
    }
  );


  registerSetting(
    "selectionGlowColor",
    {
      name:
        "Cor personalizada do brilho",

      type:
        String,

      default:
        "#ffffff"
    }
  );


  registerSetting(
    "selectionGlowDistance",
    {
      name:
        "Alcance do brilho",

      type:
        Number,

      default:
        6,

      range: {
        min:
          1,

        max:
          30,

        step:
          1
      }
    }
  );


  registerSetting(
    "selectionGlowStrength",
    {
      name:
        "Intensidade do brilho",

      type:
        Number,

      default:
        2,

      range: {
        min:
          0,

        max:
          10,

        step:
          0.5
      }
    }
  );


  registerSetting(
    "selectionGlowAlpha",
    {
      name:
        "Opacidade do brilho",

      type:
        Number,

      default:
        0.75,

      range: {
        min:
          0.1,

        max:
          1,

        step:
          0.05
      }
    }
  );
}


function parseColor(
  value,
  fallback = 0xffffff
) {
  let hex =
    String(
      value ?? ""
    )
      .trim()
      .replace(
        /^#/,
        ""
      );

  if (
    /^[0-9a-f]{3}$/i
      .test(hex)
  ) {
    hex =
      hex
        .split("")
        .map(
          c =>
            c + c
        )
        .join("");
  }

  if (
    !/^[0-9a-f]{6}$/i
      .test(hex)
  ) {
    return fallback;
  }

  return parseInt(
    hex,
    16
  );
}


function outlineColor(token) {

  if (
    setting(
      "selectionColorMode"
    )
    ===
    "custom"
  ) {
    return parseColor(
      setting(
        "selectionCustomColor"
      )
    );
  }

  const disposition =
    Number(
      token.document
        ?.disposition
      ??
      0
    );

  switch (disposition) {

    case 1:
      return parseColor(
        setting(
          "selectionFriendlyColor"
        )
      );

    case -1:
      return parseColor(
        setting(
          "selectionHostileColor"
        )
      );

    case -2:
      return parseColor(
        setting(
          "selectionSecretColor"
        )
      );

    default:
      return parseColor(
        setting(
          "selectionNeutralColor"
        )
      );
  }
}


function getRenderable(token) {
  return (
    token?.mesh
    ??
    token?.icon
    ??
    null
  );
}


function detachFilter(
  mesh,
  filter
) {
  if (
    !mesh ||
    !filter ||
    !Array.isArray(
      mesh.filters
    )
  ) {
    return;
  }

  if (
    !mesh.filters.includes(
      filter
    )
  ) {
    return;
  }

  mesh.filters =
    mesh.filters.filter(
      current =>
        current !== filter
    );
}


function attachFilter(
  mesh,
  filter
) {
  if (
    !mesh ||
    !filter
  ) {
    return;
  }

  const filters =
    Array.isArray(
      mesh.filters
    )
      ? mesh.filters
      : [];

  if (
    filters.includes(
      filter
    )
  ) {
    return;
  }

  mesh.filters = [
    ...filters,
    filter
  ];
}


function stateFor(token) {

  const mesh =
    getRenderable(token);

  let state =
    token[STATE_KEY];

  if (!state) {
    state = {
      mesh:
        null,

      outline:
        null,

      glow:
        null
    };

    token[STATE_KEY] =
      state;
  }

  if (
    state.mesh &&
    state.mesh !== mesh
  ) {
    detachFilter(
      state.mesh,
      state.outline
    );

    detachFilter(
      state.mesh,
      state.glow
    );
  }

  state.mesh =
    mesh;

  return state;
}


function warnMissingFilters() {

  if (
    missingFilterWarning
  ) {
    return;
  }

  missingFilterWarning =
    true;

  console.warn(
    "Pokemon LITM Tools | Outline/Glow filters nao encontrados."
  );
}


function outlineConstructor() {
  return (
    PIXI?.filters
      ?.OutlineFilter
    ??
    globalThis
      .OutlineFilter
    ??
    null
  );
}


function glowConstructor() {
  return (
    PIXI?.filters
      ?.GlowFilter
    ??
    globalThis
      .GlowFilter
    ??
    null
  );
}


function applyOutline(
  token,
  color
) {
  const state =
    stateFor(token);

  if (!state.mesh) {
    return;
  }

  const OutlineFilter =
    outlineConstructor();

  if (!OutlineFilter) {
    warnMissingFilters();
    return;
  }

  const thickness =
    Number(
      setting(
        "selectionThickness"
      )
    );

  if (
    !state.outline ||
    !(
      state.outline
      instanceof
      OutlineFilter
    )
  ) {
    state.outline =
      new OutlineFilter(
        thickness,
        color,
        0.5
      );
  }

  state.outline.thickness =
    thickness;

  state.outline.color =
    color;

  state.outline.quality =
    0.5;

  state.outline.alpha =
    Number(
      setting(
        "selectionOutlineAlpha"
      )
    );

  state.outline.padding =
    0;

  attachFilter(
    state.mesh,
    state.outline
  );
}


function removeOutline(token) {
  const state =
    token?.[STATE_KEY];

  if (!state) {
    return;
  }

  detachFilter(
    state.mesh,
    state.outline
  );
}


function applyGlow(
  token,
  color
) {
  const state =
    stateFor(token);

  if (!state.mesh) {
    return;
  }

  const GlowFilter =
    glowConstructor();

  if (!GlowFilter) {
    warnMissingFilters();
    return;
  }

  const distance =
    Number(
      setting(
        "selectionGlowDistance"
      )
    );

  const strength =
    Number(
      setting(
        "selectionGlowStrength"
      )
    );

  if (
    !state.glow ||
    !(
      state.glow
      instanceof
      GlowFilter
    )
  ) {
    state.glow =
      new GlowFilter({
        distance,
        outerStrength:
          strength,

        innerStrength:
          0,

        color,

        quality:
          0.15,

        alpha:
          1,

        knockout:
          false
      });
  }

  state.glow.distance =
    distance;

  state.glow.outerStrength =
    strength;

  state.glow.innerStrength =
    0;

  state.glow.color =
    color;

  state.glow.alpha =
    Number(
      setting(
        "selectionGlowAlpha"
      )
    );

  attachFilter(
    state.mesh,
    state.glow
  );
}


function removeGlow(token) {
  const state =
    token?.[STATE_KEY];

  if (!state) {
    return;
  }

  detachFilter(
    state.mesh,
    state.glow
  );
}


function removeEffects(token) {
  removeOutline(token);
  removeGlow(token);
}


function hideNativeBorder(token) {

  const border =
    token?.border;

  if (!border) {
    return;
  }

  border.renderable =
    false;

  border.visible =
    false;

  border.alpha =
    0;
}


function restoreNativeBorder(token) {

  const border =
    token?.border;

  if (!border) {
    return;
  }

  border.renderable =
    true;

  border.alpha =
    1;

  border.visible =
    !!(
      token.controlled
      ||
      token.hover
    );
}


function shouldShow(token) {
  return (
    !!token.controlled
    ||
    (
      !!setting(
        "selectionShowHover"
      )
      &&
      !!token.hover
    )
  );
}


function refreshTokenOutline(token) {

  if (
    !token ||
    token.destroyed
  ) {
    return;
  }

  if (
    !setting(
      "selectionEnabled"
    )
  ) {
    removeEffects(token);
    restoreNativeBorder(token);
    return;
  }

  if (
    setting(
      "selectionHideNative"
    )
  ) {
    hideNativeBorder(token);
  }

  else {
    restoreNativeBorder(token);
  }

  if (
    !shouldShow(token)
  ) {
    removeEffects(token);
    return;
  }

  const color =
    outlineColor(token);

  applyOutline(
    token,
    color
  );

  if (
    setting(
      "selectionGlowEnabled"
    )
  ) {
    const glowColor =
      setting(
        "selectionGlowUseOutline"
      )
        ? color
        : parseColor(
            setting(
              "selectionGlowColor"
            )
          );

    applyGlow(
      token,
      glowColor
    );
  }

  else {
    removeGlow(token);
  }
}


export function activateTokenOutline() {

  if (hooksInstalled) {
    return;
  }

  hooksInstalled =
    true;


  Hooks.on(
    "canvasReady",
    refreshAll
  );


  Hooks.on(
    "hoverToken",

    token => {
      refreshTokenOutline(
        token
      );
    }
  );


  Hooks.on(
    "controlToken",

    token => {
      refreshTokenOutline(
        token
      );
    }
  );


  Hooks.on(
    "refreshToken",

    token => {
      refreshTokenOutline(
        token
      );
    }
  );


  Hooks.on(
    "updateToken",

    document => {
      const token =
        canvas?.tokens
          ?.get(
            document.id
          );

      if (token) {
        refreshTokenOutline(
          token
        );
      }
    }
  );


  refreshAll();
}
