import { openPokemonImporter } from "./importer-app.js";

const MODULE_ID = "pokemon-litm-tools";
const LITM_SYSTEM_ID = "mist-engine-fvtt";

Hooks.once("init", () => {
  console.log("Pokémon LITM Tools | Inicializando v0.4.1");

  game.modules.get(MODULE_ID).api = {
    openPokemonImporter
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
    onChange: () => openPokemonImporter()
  };
});

Hooks.once("ready", () => {
  if (game.system.id !== LITM_SYSTEM_ID) {
    console.warn(
      "Pokémon LITM Tools | Mundo atual não usa Legend in the Mist."
    );
  }

  console.log("Pokémon LITM Tools | Pronto v0.4.1");
});
