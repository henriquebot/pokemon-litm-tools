import {
  openPokemonImporter,
  handlePokemonImporterCanvasDrop,
  POKEMON_IMPORTER_DRAG_TYPE
} from "./importer-app.js";

import {
  registerTokenOutlineSettings,
  activateTokenOutline
} from "./token-outline.js";

const MODULE_ID = "pokemon-litm-tools";
const LITM_SYSTEM_ID = "mist-engine-fvtt";

Hooks.once("init", () => {

  registerTokenOutlineSettings();

  console.log(
    "Pokémon LITM Tools | Inicializando v0.7.0"
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
    openPokemonImporter
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
        "Pokémon Importer",

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
      "Pokémon LITM Tools | Mundo atual não usa Legend in the Mist."
    );
  }

  console.log(
    "Pokémon LITM Tools | Pronto v0.7.0"
  );
});
