const MODULE_ID =
  "pokemon-litm-tools";

const DYLAN_ID =
  "dylans-animated-tokens";

const LITM_SYSTEM_ID =
  "mist-engine-fvtt";


const {
  ApplicationV2,
  HandlebarsApplicationMixin
} =
  foundry.applications.api;


let importerApp =
  null;

let catalogCache =
  null;


/* --------------------------------------------------------- */
/* CATÁLOGO                                                  */
/* --------------------------------------------------------- */

async function loadCatalog() {
  if (catalogCache) {
    return catalogCache;
  }

  const response =
    await fetch(
      `modules/${MODULE_ID}/data/catalog.json`,
      {
        cache:
          "no-store"
      }
    );

  if (!response.ok) {
    throw new Error(
      `Falha carregando catálogo: HTTP ${response.status}`
    );
  }

  const data =
    await response.json();

  if (
    !Array.isArray(
      data.people
    )
    ||
    !Array.isArray(
      data.pokemon
    )
    ||
    !Array.isArray(
      data.props
    )
  ) {
    throw new Error(
      "Catálogo inválido."
    );
  }

  catalogCache =
    data;

  return data;
}


/* --------------------------------------------------------- */
/* ARQUIVOS                                                  */
/* --------------------------------------------------------- */

function safeFilename(
  prefix,
  entry,
  url
) {
  let extension =
    ".png";

  try {
    const match =
      new URL(url)
        .pathname
        .match(
          /\.[a-zA-Z0-9]+$/
        );

    if (match) {
      extension =
        match[0];
    }

  } catch {
    // .png
  }

  const clean =
    String(entry.id)
      .replace(
        /[^a-zA-Z0-9._-]/g,
        "-"
      )
      .replace(
        /-+/g,
        "-"
      );

  return (
    `${prefix}-${clean}${extension}`
  );
}


async function persistRemoteAsset(
  url,
  filename
) {
  if (!url) {
    return null;
  }

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
      [
        blob
      ],
      filename,
      {
        type:
          blob.type
          ||
          "image/png"
      }
    );

  const uploaded =
    await foundry
      .applications
      .apps
      .FilePicker
      .uploadPersistent(
        MODULE_ID,
        "",
        file,
        {
          overwrite:
            true
        },
        {
          notify:
            false
        }
      );

  return (
    uploaded?.path
    ??
    uploaded?.url
    ??
    uploaded?.file
    ??
    url
  );
}


function cleanAnimation(
  animation
) {
  if (
    !animation
    ||
    typeof animation
      !==
      "object"
  ) {
    return null;
  }

  const copy =
    foundry.utils.deepClone(
      animation
    );

  delete copy.images;

  return copy;
}


/* --------------------------------------------------------- */
/* ACTORS                                                    */
/* --------------------------------------------------------- */

async function createActorFromEntry(
  entry
) {
  const isPokemon =
    entry.category
    ===
    "pokemon";

  const portraitUrl =
    entry.portrait
    ||
    entry.preview
    ||
    "icons/svg/mystery-man.svg";


  ui.notifications.info(
    `Importando ${entry.name}...`
  );


  const [
    sheetPath,
    portraitPath
  ] =
    await Promise.all([
      persistRemoteAsset(
        entry.sheet,

        safeFilename(
          isPokemon
            ? "pokemon-sheet"
            : "person-sheet",

          entry,

          entry.sheet
        )
      ),

      portraitUrl.startsWith(
        "icons/"
      )
        ?
        Promise.resolve(
          portraitUrl
        )
        :
        persistRemoteAsset(
          portraitUrl,

          safeFilename(
            isPokemon
              ? "pokemon-portrait"
              : "person-portrait",

            entry,

            portraitUrl
          )
        )
    ]);


  const animation =
    cleanAnimation(
      entry.animation
    );


  const moduleFlags = {
    schemaVersion:
      5,

    kind:
      isPokemon
        ? "pokemon"
        : "person",

    assetId:
      entry.id,

    pokemonId:
      entry.pokemonId
      ??
      null,

    species:
      entry.species
      ??
      null,

    source: {
      provider:
        "righthandofvecna/pokemon-assets",

      sheet:
        entry.sheet,

      portrait:
        entry.portrait
        ??
        null
    },

    assets: {
      spritesheet:
        sheetPath,

      portrait:
        portraitPath
    },

    animation
  };


  const prototypeFlags = {
    [MODULE_ID]:
      moduleFlags
  };


  if (animation) {
    prototypeFlags[
      DYLAN_ID
    ] = {
      ...animation,

      spritesheet:
        true,

      sheetsrc:
        sheetPath
    };
  }


  const actor =
    await Actor
      .implementation
      .create({
        name:
          entry.name,

        type:
          "litm-npc",

        img:
          portraitPath,

        prototypeToken: {
          name:
            entry.name,

          texture: {
            src:
              portraitPath
          },

          lockRotation:
            true,

          disposition:
            CONST
              .TOKEN_DISPOSITIONS
              .NEUTRAL,

          flags:
            prototypeFlags
        },

        flags: {
          [MODULE_ID]:
            moduleFlags
        }
      });


  if (!actor) {
    throw new Error(
      "Actor não foi criado."
    );
  }


  if (!animation) {
    ui.notifications.warn(
      `${entry.name} importado como estático: ` +
      "layout de animação ainda não é conhecido."
    );
  }

  else if (
    !game.modules
      .get(DYLAN_ID)
      ?.active
  ) {
    ui.notifications.warn(
      `${entry.name} importado, mas ` +
      "Dylan's Animated Tokens não está ativo."
    );
  }

  else {
    ui.notifications.info(
      `${entry.name} importado e configurado para animação.`
    );
  }


  return actor;
}


/* --------------------------------------------------------- */
/* PROPS                                                     */
/* --------------------------------------------------------- */

async function placeProp(
  entry
) {
  if (
    !canvas?.ready
    ||
    !canvas.scene
  ) {
    ui.notifications.error(
      "Abra uma Scene antes de colocar um Prop."
    );

    return;
  }


  ui.notifications.info(
    `Baixando ${entry.name}...`
  );


  const imagePath =
    await persistRemoteAsset(
      entry.image,

      safeFilename(
        "prop",
        entry,
        entry.image
      )
    );


  const size =
    Number(
      canvas.grid?.size
      ??
      canvas.scene.grid?.size
      ??
      100
    );


  const pivot =
    canvas.stage?.pivot;


  const centerX =
    Number(
      pivot?.x
      ??
      canvas.scene.width / 2
    );

  const centerY =
    Number(
      pivot?.y
      ??
      canvas.scene.height / 2
    );


  await canvas.scene
    .createEmbeddedDocuments(
      "Tile",
      [
        {
          x:
            centerX
            -
            size / 2,

          y:
            centerY
            -
            size / 2,

          width:
            size,

          height:
            size,

          texture: {
            src:
              imagePath
          }
        }
      ]
    );


  ui.notifications.info(
    `${entry.name} colocado no centro da tela.`
  );
}


/* --------------------------------------------------------- */
/* APP                                                       */
/* --------------------------------------------------------- */

class PokemonImporterApp
  extends
    HandlebarsApplicationMixin(
      ApplicationV2
    ) {

  static DEFAULT_OPTIONS = {
    id:
      "pokemon-litm-importer",

    classes: [
      "pokemon-litm-tools",
      "pokemon-importer"
    ],

    position: {
      width:
        720,

      height:
        760
    },

    window: {
      title:
        "Pokémon Importer",

      icon:
        "fa-solid fa-dragon",

      resizable:
        true
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


  activeTab =
    "people";


  async _prepareContext(
    options
  ) {
    const context =
      await super
        ._prepareContext(
          options
        );

    try {
      const catalog =
        await loadCatalog();


      const items =
        (
          catalog[
            this.activeTab
          ]
          ??
          []
        )
          .map(
            entry => ({
              ...entry,

              meta:
                this.activeTab
                ===
                "pokemon"
                  ?
                  `#${
                    String(
                      entry.dex
                    )
                      .padStart(
                        3,
                        "0"
                      )
                  }`
                  :
                  (
                    entry.group
                    ||
                    ""
                  ),

              isAnimated:
                !!entry.animation,

              buttonLabel:
                this.activeTab
                ===
                "props"
                  ?
                  "Colocar"
                  :
                  "Importar",

              buttonIcon:
                this.activeTab
                ===
                "props"
                  ?
                  "fa-solid fa-map-pin"
                  :
                  "fa-solid fa-download"
            })
          );


      return {
        ...context,

        items,

        itemCount:
          items.length,

        peopleCount:
          catalog.people.length,

        pokemonCount:
          catalog.pokemon.length,

        propsCount:
          catalog.props.length,

        isPeople:
          this.activeTab
          ===
          "people",

        isPokemon:
          this.activeTab
          ===
          "pokemon",

        isProps:
          this.activeTab
          ===
          "props",

        dylanActive:
          game.modules
            .get(DYLAN_ID)
            ?.active
          ===
          true,

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

        items: [],

        itemCount:
          0,

        peopleCount:
          0,

        pokemonCount:
          0,

        propsCount:
          0,

        isPeople:
          this.activeTab
          ===
          "people",

        isPokemon:
          this.activeTab
          ===
          "pokemon",

        isProps:
          this.activeTab
          ===
          "props",

        dylanActive:
          game.modules
            .get(DYLAN_ID)
            ?.active
          ===
          true,

        catalogError:
          error.message
      };
    }
  }


  async _onRender(
    context,
    options
  ) {
    await super
      ._onRender(
        context,
        options
      );


    /* Abas */

    for (
      const button
      of this.element
        .querySelectorAll(
          "[data-tab]"
        )
    ) {
      button.addEventListener(
        "click",

        async () => {
          const tab =
            button.dataset.tab;

          if (
            !tab
            ||
            tab
            ===
            this.activeTab
          ) {
            return;
          }

          this.activeTab =
            tab;

          await this.render({
            force:
              true
          });
        }
      );
    }


    /* Busca */

    const search =
      this.element
        .querySelector(
          "[data-role='asset-search']"
        );


    if (search) {
      search.addEventListener(
        "input",

        () => {
          const query =
            search.value
              .trim()
              .toLocaleLowerCase();

          let visible =
            0;


          for (
            const card
            of this.element
              .querySelectorAll(
                "[data-asset-card]"
              )
          ) {
            const searchable =
              String(
                card.dataset.search
                ??
                ""
              )
                .toLocaleLowerCase();

            const show =
              !query
              ||
              searchable.includes(
                query
              );

            card.hidden =
              !show;

            if (show) {
              visible++;
            }
          }


          const counter =
            this.element
              .querySelector(
                "[data-role='visible-count']"
              );

          if (counter) {
            counter.textContent =
              String(
                visible
              );
          }
        }
      );
    }


    /* Importar / colocar */

    for (
      const button
      of this.element
        .querySelectorAll(
          "[data-entry-id]"
        )
    ) {
      button.addEventListener(
        "click",

        async () => {
          const id =
            button.dataset.entryId;

          const category =
            button.dataset.category;


          if (
            !id
            ||
            !category
          ) {
            return;
          }


          const oldHTML =
            button.innerHTML;

          button.disabled =
            true;

          button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i>';


          try {
            const catalog =
              await loadCatalog();

            const entry =
              (
                catalog[
                  category
                ]
                ??
                []
              )
                .find(
                  item =>
                    item.id
                    ===
                    id
                );


            if (!entry) {
              throw new Error(
                "Asset não encontrado no catálogo."
              );
            }


            if (
              category
              ===
              "props"
            ) {
              await placeProp(
                entry
              );
            }

            else {
              await createActorFromEntry(
                entry
              );
            }

          } catch (error) {
            console.error(
              "Pokémon LITM Tools | Falha:",
              error
            );

            ui.notifications.error(
              "Falha ao importar/colocar asset. Veja o F12."
            );

          } finally {
            button.disabled =
              false;

            button.innerHTML =
              oldHTML;
          }
        }
      );
    }
  }
}


/* --------------------------------------------------------- */
/* ABRIR                                                     */
/* --------------------------------------------------------- */

export async function openPokemonImporter() {
  if (!game.user.isGM) {
    return;
  }


  if (
    game.system.id
    !==
    LITM_SYSTEM_ID
  ) {
    ui.notifications.error(
      "Pokémon LITM Tools requer Legend in the Mist."
    );

    return;
  }


  if (
    importerApp?.rendered
  ) {
    importerApp
      .bringToFront();

    return importerApp;
  }


  importerApp =
    new PokemonImporterApp();


  importerApp
    .addEventListener(
      "close",

      () => {
        importerApp =
          null;
      },

      {
        once:
          true
      }
    );


  await importerApp.render({
    force:
      true
  });


  return importerApp;
}
