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
  activatePokemonTokenDrop
} from "./pokemon-token-drop.js";

import {
  activatePokemonVisualStability
} from "./pokemon-visual-stability.js";

import {
  registerPokemonShowcaseSettings,
  activatePokemonShowcase,
  showPokemonReaction,
  playPokemonShowcaseBurst
} from "./pokemon-showcase.js";

import {
  registerPokemonContentSettings
} from "./pokemon-content.js";

import {
  migratePokemonChallengesLitmFirst
} from "./pokemon-builder.js";

import {
  activatePokemonCombatLayer,
  deployPokemonTheme,
  recollectPokemonTheme,
  isPokemonThemeCanvasDrop,
  handlePokemonThemeCanvasDrop,
  playPokemonPokeballVfx
} from "./pokemon-combat.js";

import {
  activatePokemonCombatEffects,
  startPokemonChallengeMoveArea,
  cleanupPokemonInstance,
  deletePokemonCombatProjection,
  pokemonLitmCombatSelfTest
} from "./pokemon-combat-effects.js";

import {
  activatePokemonGuidedFlow,
  pokemonGuidedFlowSelfTest
} from "./pokemon-guided-flow.js";

const MODULE_ID = "pokemon-litm-tools";
const LITM_SYSTEM_ID = "mist-engine-fvtt";

function actorDirectoryRoot(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return null;
}

function decoratePokemonActorDirectoryKinds(_app, html) {
  const root =
    actorDirectoryRoot(html);

  if (!root) return;

  for (
    const row
    of root.querySelectorAll(
      "li.directory-item.document[data-entry-id]"
    )
  ) {
    if (
      row.querySelector(
        "[data-pokemon-actor-kind]"
      )
    ) {
      continue;
    }

    const actor =
      game.actors.get(
        row.dataset.entryId
      );

    if (!actor) {
      continue;
    }

    const kind =
      actor.type === "litm-character"
        ? {
            key:
              "character",
            label:
              "Personagem",
            icon:
              "fa-user"
          }
        : actor.type === "litm-npc"
          ? {
              key:
                "challenge",
              label:
                "Challenge",
              icon:
                "fa-triangle-exclamation"
            }
          : null;

    if (!kind) {
      continue;
    }

    const marker =
      document.createElement(
        "span"
      );

    marker.className =
      "pokemon-actor-kind-badge "
      + "pokemon-actor-kind-"
      + kind.key;

    marker.dataset
      .pokemonActorKind =
        kind.key;

    marker.title =
      kind.label;

    marker.setAttribute(
      "data-tooltip",
      kind.label
    );

    marker.innerHTML =
      '<i class="fa-solid '
      + kind.icon
      + '"></i>';

    const host =
      row.querySelector(
        ".entry-name, .document-name"
      )
      ?? row;

    host.prepend(
      marker
    );
  }
}

Hooks.on(
  "renderActorDirectory",
  decoratePokemonActorDirectoryKinds
);


Hooks.once("init", () => {

  registerPokemonContentSettings();

  registerTokenOutlineSettings();

  registerPokemonShowcaseSettings();

  activatePokemonThemePokedexButtons();

  activatePokemonVisualStability();

  activatePokemonShowcase();

  activatePokemonFollowers();

  activatePokemonTokenDrop();

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
    cleanupPokemonInstance,
    deletePokemonCombatProjection,
    migratePokemonChallengesLitmFirst,
    pokemonLitmCombatSelfTest,
    pokemonGuidedFlowSelfTest,
    playPokemonPokeballVfx,
    showPokemonReaction,
    playPokemonShowcaseBurst
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
  activatePokemonGuidedFlow();
  activatePokemonCombatEffects();

  if (
    game.user.isGM
  ) {
    void migratePokemonChallengesLitmFirst()
      .catch(
        error => {
          console.error(
            "Pokemon LITM Tools | Migração LitM-first dos Challenges:",
            error
          );
        }
      );
  }

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
