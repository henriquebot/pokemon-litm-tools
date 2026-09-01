import {
  openPokemonImporter,
  handlePokemonImporterCanvasDrop,
  POKEMON_IMPORTER_DRAG_TYPE
} from "./importer-app.js";

import {
  registerTokenOutlineSettings,
  activateTokenOutline
} from "./token-outline.js";

import {
  openPokemonCharacterCreator
} from "./character-creator-app.js";

const MODULE_ID = "pokemon-litm-tools";
const LITM_SYSTEM_ID = "mist-engine-fvtt";

Hooks.once("init", () => {

  registerTokenOutlineSettings();

  console.log(
    "Pok\u00e9mon LITM Tools | Inicializando v0.7.0"
  );

  game.settings.register(
    MODULE_ID,
    "lastActorFolder",
    {
      scope: "client",
      config: false,
      type: String,
      default: ""
    }
  );

  game.modules.get(MODULE_ID).api = {
    openPokemonImporter,
    openPokemonCharacterCreator
  };
});

Hooks.on(
  "getSceneControlButtons",
  controls => {

    if (!game.user.isGM) return;

    const tokenControls =
      controls.tokens;

    if (!tokenControls?.tools) {
      return;
    }

    tokenControls.tools.pokemonImporter = {
      name:
        "pokemonImporter",

      title:
        "Pok\u00e9mon Importer",

      icon:
        "fa-solid fa-dragon",

      order:
        90,

      button:
        true,

      visible:
        true,

      onChange:
        () => openPokemonImporter()
    };

    tokenControls.tools.pokemonCharacterCreator = {
      name:
        "pokemonCharacterCreator",

      title:
        "Criar Personagem Pok\u00e9mon",

      icon:
        "fa-solid fa-user-plus",

      order:
        91,

      button:
        true,

      visible:
        true,

      onChange:
        () => openPokemonCharacterCreator()
    };
  }
);

Hooks.on(
  "dropCanvasData",

  (
    canvasInstance,
    data,
    event
  ) => {
    if (
      data?.type
        !==
        POKEMON_IMPORTER_DRAG_TYPE ||
      data?.moduleId
        !==
        MODULE_ID
    ) {
      return;
    }

    event?.preventDefault();

    void handlePokemonImporterCanvasDrop(
      data
    )
      .catch(error => {
        console.error(
          "Pokemon LITM Tools | Canvas drop:",
          error
        );

        ui.notifications.error(
          "Nao foi possivel colocar o asset. Veja F12."
        );
      });

    return false;
  }
);


Hooks.once("ready", () => {

  activateTokenOutline();

  if (
    game.system.id
    !==
    LITM_SYSTEM_ID
  ) {
    console.warn(
      "Pok\u00e9mon LITM Tools | Mundo atual n?o usa Legend in the Mist."
    );
  }

  console.log(
    "Pok\u00e9mon LITM Tools | Pronto v0.7.0"
  );
});
