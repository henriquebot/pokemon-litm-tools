const MODULE_ID = "pokemon-litm-tools";
const DYLAN_ID = "dylans-animated-tokens";
const LITM_SYSTEM_ID = "mist-engine-fvtt";

const {
  ApplicationV2,
  HandlebarsApplicationMixin
} = foundry.applications.api;

let importerApp = null;
let catalogCache = null;


/* --------------------------------------------------------- */
/* Catálogo local                                             */
/* --------------------------------------------------------- */

async function loadTrainerCatalog() {
  if (catalogCache) return catalogCache;

  const url =
    `modules/${MODULE_ID}/data/trainers-catalog.json`;

  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `Falha carregando catálogo local: HTTP ${response.status}`
    );
  }

  const data = await response.json();

  if (
    !data ||
    !Array.isArray(data.trainers) ||
    data.trainers.length === 0
  ) {
    throw new Error(
      "O catálogo de Trainers está vazio ou inválido."
    );
  }

  catalogCache = data;

  console.log(
    `Pokémon LITM Tools | ${data.trainers.length} Trainers carregados.`,
    data.source
  );

  return catalogCache;
}


/* --------------------------------------------------------- */
/* Assets                                                     */
/* --------------------------------------------------------- */

function safeFilename(prefix, entry, url) {
  let extension = ".png";

  try {
    const pathname =
      new URL(url).pathname;

    const match =
      pathname.match(/\.[a-zA-Z0-9]+$/);

    if (match) extension = match[0];
  } catch {
    // Mantém .png.
  }

  const clean =
    String(entry.id)
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-");

  return `${prefix}-${clean}${extension}`;
}


async function persistRemoteAsset(url, filename) {
  if (!url) return null;

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Falha baixando ${filename}: HTTP ${response.status}`
    );
  }

  const blob =
    await response.blob();

  const file =
    new File(
      [blob],
      filename,
      {
        type: blob.type || "image/png"
      }
    );

  const uploaded =
    await foundry.applications.apps.FilePicker.uploadPersistent(
      MODULE_ID,
      "",
      file,
      {
        overwrite: true
      },
      {
        notify: false
      }
    );

  const path =
    uploaded?.path ??
    uploaded?.url ??
    uploaded?.file;

  if (!path) {
    console.warn(
      "Pokémon LITM Tools | Upload não retornou caminho. Usando URL remota.",
      uploaded
    );

    return url;
  }

  return path;
}


/* --------------------------------------------------------- */
/* Importação do Trainer                                      */
/* --------------------------------------------------------- */

async function createTrainer(entry) {
  const dylanActive =
    game.modules.get(DYLAN_ID)?.active === true;

  ui.notifications.info(
    `Importando ${entry.name}...`
  );

  const sheetFilename =
    safeFilename(
      "trainer-sheet",
      entry,
      entry.sheet
    );

  const portraitFilename =
    entry.portrait
      ? safeFilename(
          "trainer-portrait",
          entry,
          entry.portrait
        )
      : null;

  const sheetPromise =
    persistRemoteAsset(
      entry.sheet,
      sheetFilename
    );

  const portraitPromise =
    entry.portrait
      ? persistRemoteAsset(
          entry.portrait,
          portraitFilename
        )
      : Promise.resolve(
          "icons/svg/mystery-man.svg"
        );

  const [
    sheetPath,
    portraitPath
  ] =
    await Promise.all([
      sheetPromise,
      portraitPromise
    ]);

  const pokemonFlags = {
    schemaVersion: 4,

    kind: "trainer",

    assetId: entry.id,

    source: {
      provider: "righthandofvecna/pokemon-assets",
      sheet: entry.sheet,
      portrait: entry.portrait ?? null,
      group: entry.group ?? null
    },

    assets: {
      spritesheet: sheetPath,
      portrait: portraitPath
    },

    animation: {
      engine: DYLAN_ID,
      preset: "durlReduced",
      frames: 3,
      directions: 4
    }
  };

  const actor =
    await Actor.implementation.create({
      name: entry.name,

      type: "litm-npc",

      img: portraitPath,

      prototypeToken: {
        name: entry.name,

        texture: {
          src: portraitPath
        },

        lockRotation: true,

        disposition:
          CONST.TOKEN_DISPOSITIONS.NEUTRAL,

        flags: {
          [MODULE_ID]:
            pokemonFlags,

          [DYLAN_ID]: {
            spritesheet: true,
            sheetstyle: "durlReduced",
            animationframes: 3,
            sheetsrc: sheetPath
          }
        }
      },

      flags: {
        [MODULE_ID]:
          pokemonFlags
      }
    });

  if (!actor) {
    throw new Error(
      "O Foundry não retornou o Actor criado."
    );
  }

  if (dylanActive) {
    ui.notifications.info(
      `${entry.name} importado e configurado para animação.`
    );
  } else {
    ui.notifications.warn(
      `${entry.name} importado. Dylan's Animated Tokens não está ativo.`
    );
  }

  console.log(
    "Pokémon LITM Tools | Trainer criado:",
    actor
  );

  return actor;
}


/* --------------------------------------------------------- */
/* ApplicationV2                                             */
/* --------------------------------------------------------- */

class PokemonImporterApp
  extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "pokemon-litm-importer",

    classes: [
      "pokemon-litm-tools",
      "pokemon-importer"
    ],

    position: {
      width: 600,
      height: 700
    },

    window: {
      title: "Pokémon Importer",
      icon: "fa-solid fa-dragon",
      resizable: true
    },

    actions: {
      importTrainer:
        this.#onImportTrainer
    }
  };


  static PARTS = {
    main: {
      template:
        `modules/${MODULE_ID}/templates/importer.hbs`,

      scrollable: [
        ".pokemon-importer-list"
      ]
    }
  };


  async _prepareContext(options) {
    const context =
      await super._prepareContext(options);

    try {
      const catalog =
        await loadTrainerCatalog();

      return {
        ...context,

        trainers:
          catalog.trainers,

        trainerCount:
          catalog.trainers.length,

        dylanActive:
          game.modules.get(DYLAN_ID)?.active === true,

        catalogError:
          null
      };

    } catch (error) {
      console.error(
        "Pokémon LITM Tools | Erro no catálogo:",
        error
      );

      return {
        ...context,

        trainers: [],

        trainerCount: 0,

        dylanActive:
          game.modules.get(DYLAN_ID)?.active === true,

        catalogError:
          error.message
      };
    }
  }


  async _onRender(context, options) {
    await super._onRender(context, options);

    const search =
      this.element.querySelector(
        "[data-role='trainer-search']"
      );

    if (!search) return;

    search.addEventListener(
      "input",
      () => {
        const query =
          search.value
            .trim()
            .toLocaleLowerCase();

        const cards =
          this.element.querySelectorAll(
            "[data-trainer-card]"
          );

        let visible = 0;

        for (const card of cards) {
          const searchable =
            String(
              card.dataset.search ?? ""
            ).toLocaleLowerCase();

          const show =
            !query ||
            searchable.includes(query);

          card.hidden =
            !show;

          if (show) visible++;
        }

        const counter =
          this.element.querySelector(
            "[data-role='visible-count']"
          );

        if (counter) {
          counter.textContent =
            String(visible);
        }
      }
    );
  }


  static async #onImportTrainer(
    event,
    target
  ) {
    const id =
      target.dataset.id;

    if (!id) return;

    let catalog;

    try {
      catalog =
        await loadTrainerCatalog();
    } catch (error) {
      console.error(error);

      ui.notifications.error(
        "Não foi possível carregar o catálogo."
      );

      return;
    }

    const entry =
      catalog.trainers.find(
        trainer =>
          trainer.id === id
      );

    if (!entry) {
      ui.notifications.error(
        "Trainer não encontrado no catálogo."
      );

      return;
    }

    const oldHTML =
      target.innerHTML;

    target.disabled =
      true;

    target.innerHTML =
      `<i class="fa-solid fa-spinner fa-spin"></i> Importando`;

    try {
      await createTrainer(entry);

    } catch (error) {
      console.error(
        "Pokémon LITM Tools | Falha na importação:",
        error
      );

      ui.notifications.error(
        `Erro importando ${entry.name}. Veja o F12.`
      );

    } finally {
      target.disabled =
        false;

      target.innerHTML =
        oldHTML;
    }
  }
}


/* --------------------------------------------------------- */
/* Abertura                                                   */
/* --------------------------------------------------------- */

export async function openPokemonImporter() {
  if (!game.user.isGM) return;

  if (game.system.id !== LITM_SYSTEM_ID) {
    ui.notifications.error(
      "Pokémon LITM Tools requer Legend in the Mist."
    );

    return;
  }

  if (importerApp?.rendered) {
    importerApp.bringToFront();
    return importerApp;
  }

  importerApp =
    new PokemonImporterApp();

  importerApp.addEventListener(
    "close",
    () => {
      importerApp = null;
    },
    {
      once: true
    }
  );

  await importerApp.render({
    force: true
  });

  return importerApp;
}
