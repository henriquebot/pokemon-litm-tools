const MODULE_ID = "pokemon-litm-tools";
const LITM_SYSTEM_ID = "mist-engine-fvtt";
const DYLAN_ID = "dylans-animated-tokens";

Hooks.once("init", () => {
  console.log("Pokémon LITM Tools | Inicializando v0.3.0");

  game.modules.get(MODULE_ID).api = {
    openImporter
  };
});

Hooks.on("getSceneControlButtons", controls => {
  if (!game.user.isGM) return;

  const tokenControls = controls.tokens;
  if (!tokenControls?.tools) return;

  tokenControls.tools.pokemonImporter = {
    name: "pokemonImporter",
    title: "Pokémon Importer",
    icon: "fa-solid fa-dragon",
    order: 90,
    button: true,
    visible: true,
    onChange: () => openImporter()
  };
});

Hooks.once("ready", () => {
  console.log("Pokémon LITM Tools | Pronto v0.3.0");
});

function getAnimationConfig(preset) {
  switch (preset) {
    case "trainer-gen4":
      return {
        enabled: true,
        sheetStyle: "durlReduced",
        frames: 3,
        directions: 4
      };

    default:
      return {
        enabled: false
      };
  }
}

async function openImporter() {
  if (!game.user.isGM) return;

  if (game.system.id !== LITM_SYSTEM_ID) {
    ui.notifications.error(
      "Pokémon LITM Tools requer Legend in the Mist."
    );
    return;
  }

  const dylanActive = game.modules.get(DYLAN_ID)?.active === true;

  const result = await foundry.applications.api.DialogV2.input({
    window: {
      title: "Pokémon Importer"
    },

    content: `
      <div style="display:flex; flex-direction:column; gap:12px; padding:8px;">

        <div class="form-group">
          <label>Nome</label>
          <div class="form-fields">
            <input
              type="text"
              name="name"
              placeholder="Ex.: Pokémon Ranger"
              required
              autofocus
            >
          </div>
        </div>

        <div class="form-group">
          <label>Retrato da ficha</label>
          <div class="form-fields">
            <input
              type="text"
              name="portrait"
              placeholder="URL ou caminho no Foundry"
            >
          </div>
          <p class="hint">
            Imagem usada no Challenge. Pode ficar vazio.
          </p>
        </div>

        <div class="form-group">
          <label>Spritesheet do token</label>
          <div class="form-fields">
            <input
              type="text"
              name="spritesheet"
              placeholder="URL ou caminho no Foundry"
            >
          </div>
        </div>

        <div class="form-group">
          <label>Tipo</label>
          <div class="form-fields">
            <select name="kind">
              <option value="trainer">Trainer / NPC</option>
              <option value="pokemon">Pokémon</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>Animação</label>
          <div class="form-fields">
            <select name="animationPreset">
              <option value="static">Estático</option>
              <option value="trainer-gen4">
                Trainer Gen4 / HGSS - 3x4
              </option>
            </select>
          </div>
          <p class="hint">
            Dylan's Animated Tokens:
            ${dylanActive ? "ATIVO" : "NÃO ATIVO"}
          </p>
        </div>

      </div>
    `,

    ok: {
      label: "Importar",
      icon: "fa-solid fa-download"
    },

    modal: true
  });

  if (!result) return;

  const name = String(result.name ?? "").trim();
  const portrait =
    String(result.portrait ?? "").trim() ||
    "icons/svg/mystery-man.svg";

  const spritesheet =
    String(result.spritesheet ?? "").trim();

  const kind =
    String(result.kind ?? "trainer");

  const animationPreset =
    String(result.animationPreset ?? "static");

  if (!name) {
    ui.notifications.warn("Digite um nome.");
    return;
  }

  const animation = getAnimationConfig(animationPreset);

  if (animation.enabled && !spritesheet) {
    ui.notifications.warn(
      "Para animação, informe uma spritesheet."
    );
    return;
  }

  const tokenImage = spritesheet || portrait;

  const pokemonFlags = {
    schemaVersion: 2,
    kind,
    portrait,
    spritesheet,
    animationPreset,
    animation
  };

  const prototypeFlags = {
    [MODULE_ID]: pokemonFlags
  };

  /*
   * Já gravamos os flags do Dylan mesmo que ele esteja
   * desativado. Assim não será necessário reimportar
   * o Actor depois.
   */
  if (animation.enabled) {
    prototypeFlags[DYLAN_ID] = {
      spritesheet: true,
      sheetstyle: animation.sheetStyle,
      animationframes: animation.frames,
      sheetsrc: spritesheet
    };
  }

  try {
    const actor = await Actor.implementation.create({
      name,
      type: "litm-npc",

      // Retrato da ficha, NÃO a spritesheet.
      img: portrait,

      prototypeToken: {
        name,

        texture: {
          src: tokenImage
        },

        lockRotation: true,
        disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL,

        flags: prototypeFlags
      },

      flags: {
        [MODULE_ID]: pokemonFlags
      }
    });

    if (!actor) {
      throw new Error("Actor não foi criado.");
    }

    if (animation.enabled && !dylanActive) {
      ui.notifications.warn(
        `${name} foi importado, mas Dylan's Animated Tokens não está ativo.`
      );
    } else {
      ui.notifications.info(
        `${name} importado com sucesso.`
      );
    }

    console.log(
      "Pokémon LITM Tools | Actor criado:",
      actor
    );

  } catch (error) {
    console.error(
      "Pokémon LITM Tools | Falha ao importar:",
      error
    );

    ui.notifications.error(
      "Falha ao criar o Actor. Veja o console F12."
    );
  }
}
