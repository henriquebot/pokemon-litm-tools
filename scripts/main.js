Hooks.once("init", () => {
  console.log("Pokémon LITM Tools | Inicializando v0.1.0");
});

Hooks.once("ready", () => {
  console.log("Pokémon LITM Tools | Pronto");
  ui.notifications.info("Pokémon LITM Tools carregado!");
});
