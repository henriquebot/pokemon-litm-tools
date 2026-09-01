const MODULE_ID = "pokemon-litm-tools";
const LITM_SYSTEM_ID = "mist-engine-fvtt";

Hooks.once("init", () => {
  console.log("Pokémon LITM Tools | Inicializando");

  const module = game.modules.get(MODULE_ID);
  module.api = {
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
  console.log("Pokémon LITM Tools | Pronto");
});

async function openImporter() {
  if (!game.user.isGM) return;

  if (game.system.id !== LITM_SYSTEM_ID) {
    ui.notifications.error(
      "Pokémon LITM Tools: este importador precisa do Legend in the Mist."
    );
    return;
  }

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
          <label>Sprite / imagem</label>
          <div class="form-fields">
            <input
              type="text"
              name="image"
              placeholder="URL ou caminho no Foundry"
            >
          </div>
          <p class="hint">
            Pode deixar vazio neste primeiro teste.
          </p>
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

  if (!name) {
    ui.notifications.warn("Digite um nome.");
    return;
  }

  const image =
    String(result.image ?? "").trim() ||
    "icons/svg/mystery-man.svg";

  const kind =
    String(result.kind ?? "trainer");

  try {
    const actor = await Actor.implementation.create({
      name,
      type: "litm-npc",
      img: image,

      prototypeToken: {
        name,
        texture: {
          src: image
        },

        disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL
      },

      flags: {
        [MODULE_ID]: {
          schemaVersion: 1,
          kind,
          sourceImage: image
        }
      }
    });

    if (!actor) throw new Error("Actor não foi criado.");

    ui.notifications.info(
      `${name} importado para Actors.`
    );

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
