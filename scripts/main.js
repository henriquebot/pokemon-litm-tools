import {
  openPokemonImporter,
  openPokemonChallengeEditor,
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

import {
  openPokemonManager,
  capturePokemonChallenge
} from "./pokemon-manager-app.js";

import {
  activatePokemonThemePokedexButtons
} from "./pokemon-links.js";

import {
  activatePokemonFollowers
} from "./pokemon-follower.js";

import {
  activatePokemonVisualStability
} from "./pokemon-visual-stability.js";

import {
  registerPokemonContentSettings
} from "./pokemon-content.js";

import {
  activatePokemonCombatLayer,
  deployPokemonTheme,
  recollectPokemonTheme,
  isPokemonThemeCanvasDrop,
  handlePokemonThemeCanvasDrop
} from "./pokemon-combat.js";

import {
  activatePokemonCombatEffects,
  startPokemonChallengeMoveArea,
  deletePokemonCombatProjection
} from "./pokemon-combat-effects.js";

const MODULE_ID = "pokemon-litm-tools";
const LITM_SYSTEM_ID = "mist-engine-fvtt";

Hooks.once("init", () => {

  registerPokemonContentSettings();

  registerTokenOutlineSettings();

  activatePokemonThemePokedexButtons();

  activatePokemonVisualStability();

  activatePokemonFollowers();

  console.log(
    "Pok\u00e9mon LITM Tools | Inicializando v0.8.0-dev"
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
    openPokemonChallengeEditor,
    capturePokemonChallenge,
    openPokemonCharacterCreator,
    openPokemonManager,
    deployPokemonTheme,
    recollectPokemonTheme,
    startPokemonChallengeMoveArea,
    deletePokemonCombatProjection
  };
});

Hooks.on(
  "getSceneControlButtons",
  controls => {

    const tokenControls =
      controls.tokens;

    if (!tokenControls?.tools) {
      return;
    }

    if (game.user.isGM) {
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

      tokenControls.tools.pokemonCharacterCreator = {
        name:
          "pokemonCharacterCreator",

        title:
          "Criar Personagem Pokémon",

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

    tokenControls.tools.pokemonManager = {
      name:
        "pokemonManager",

      title:
        "Pokémon Manager",

      icon:
        "fa-solid fa-box",

      order:
        92,

      button:
        true,

      visible:
        true,

      onChange:
        () => openPokemonManager()
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
      data?.type === POKEMON_IMPORTER_DRAG_TYPE
      &&
      data?.moduleId === MODULE_ID
    ) {
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

    if (
      isPokemonThemeCanvasDrop(
        data
      )
    ) {
      event?.preventDefault();

      void handlePokemonThemeCanvasDrop(
        data
      )
        .catch(error => {
          console.error(
            "Pokemon LITM Tools | Pokemon Theme drop:",
            error
          );

          ui.notifications.error(
            error?.message
            ?? "Nao foi possivel colocar o Pokemon na cena."
          );
        });

      return false;
    }
  }
);


Hooks.once("ready", () => {

  activatePokemonCombatLayer();
  activatePokemonCombatEffects();

  activateTokenOutline();

  if (
    game.system.id
    !==
    LITM_SYSTEM_ID
  ) {
    console.warn(
      "Pok\u00e9mon LITM Tools | Mundo atual nao usa Legend in the Mist."
    );
  }

  console.log(
    "Pok\u00e9mon LITM Tools | Pronto v0.8.0-dev"
  );
});
