import {
  loadPokemonAssetCatalog,
  getPokemonAssetPreviewData,
  refreshPokemonAssetPreviews,
  preparePokemonActorDefinition
} from "./importer-app.js";

const MODULE_ID = "pokemon-litm-tools";
const LITM_SYSTEM_ID = "mist-engine-fvtt";

const {
  ApplicationV2,
  HandlebarsApplicationMixin
} = foundry.applications.api;

const DEFAULT_BACKGROUND =
  "systems/mist-engine-fvtt/assets/default_sheet_background.webp";

let creatorApp = null;


function loadImage(src) {
  return new Promise(
    (resolve, reject) => {
      const img = new Image();

      img.crossOrigin =
        "anonymous";

      img.onload =
        () => resolve(img);

      img.onerror =
        () => reject(
          new Error(
            `Nao foi possivel carregar: ${src}`
          )
        );

      img.src = src;
    }
  );
}


function canvasToBlob(canvas) {
  return new Promise(
    (resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (blob) {
            resolve(blob);
          } else {
            reject(
              new Error(
                "Falha criando background."
              )
            );
          }
        },
        "image/png"
      );
    }
  );
}


function drawCover(
  ctx,
  image,
  x,
  y,
  width,
  height
) {
  const scale =
    Math.max(
      width / image.width,
      height / image.height
    );

  const sourceWidth =
    width / scale;

  const sourceHeight =
    height / scale;

  const sourceX =
    (image.width - sourceWidth) / 2;

  const sourceY =
    (image.height - sourceHeight) / 2;

  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height
  );
}


async function uploadBackground(
  actor,
  blob
) {
  const file =
    new File(
      [blob],
      `character-background-${actor.id}.png`,
      {
        type:
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
    null
  );
}


async function applyCharacterBackground(
  actor,
  artworkPath
) {
  if (!artworkPath) {
    return;
  }

  const [
    background,
    artwork
  ] =
    await Promise.all([
      loadImage(
        DEFAULT_BACKGROUND
      ),
      loadImage(
        artworkPath
      )
    ]);

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    1100;

  canvas.height =
    800;

  const ctx =
    canvas.getContext(
      "2d",
      {
        alpha:
          true
      }
    );

  drawCover(
    ctx,
    background,
    0,
    0,
    canvas.width,
    canvas.height
  );

  /*
   * LitM:
   * coluna de portrait = x 0..300.
   *
   * Mantemos uma margem e deixamos
   * espaco inferior para o nome.
   */

  const maxWidth =
    260;

  const maxHeight =
    430;

  const scale =
    Math.min(
      maxWidth / artwork.width,
      maxHeight / artwork.height
    );

  const x =
    150;

  const y =
    260;

  const width =
    artwork.width * scale;

  const height =
    artwork.height * scale;

  ctx.drawImage(
    artwork,
    x - width / 2,
    y - height / 2,
    width,
    height
  );

  const blob =
    await canvasToBlob(
      canvas
    );

  const path =
    await uploadBackground(
      actor,
      blob
    );

  if (!path) {
    throw new Error(
      "Upload do background falhou."
    );
  }

  /*
   * Mesmo formato usado pelo
   * Custom Background Editor nativo.
   *
   * Assim o usuario ainda pode abrir
   * o editor depois e reposicionar
   * o artwork normalmente.
   */

  await actor.setFlag(
    LITM_SYSTEM_ID,
    "customBackgroundEditorState",
    {
      backgroundSrc:
        DEFAULT_BACKGROUND,

      overlays: [
        {
          src:
            artworkPath,

          x,

          y,

          scale,

          flipped:
            false
        }
      ]
    }
  );

  await actor.update({
    "system.customBackground":
      `${path}?v=${Date.now()}`
  });
}


async function createCharacterFromEntry({
  entry,
  name,
  ownerId
}) {
  const definition =
    await preparePokemonActorDefinition(
      entry
    );

  const prototypeFlags =
    foundry.utils.deepClone(
      definition.prototypeFlags
    );

  prototypeFlags[
    MODULE_ID
  ] = {
    ...(
      prototypeFlags[
        MODULE_ID
      ]
      ??
      {}
    ),

    playerCharacter:
      true
  };

  const moduleFlags = {
    ...definition.moduleFlags,

    playerCharacter:
      true
  };

  let actor = null;

  try {
    const ownership =
      ownerId
        ? {
            [ownerId]:
              CONST
                .DOCUMENT_OWNERSHIP_LEVELS
                .OWNER
          }
        : {};

    actor =
      await Actor
        .implementation
        .create({
          name,

          type:
            "litm-character",

          img:
            definition.portraitPath,

          ownership,

          prototypeToken: {
            name,

            actorLink:
              true,

            width:
              1,

            height:
              1,

            texture: {
              src:
                definition.tokenPath,

              scaleX:
                definition.visualScale,

              scaleY:
                definition.visualScale
            },

            lockRotation:
              true,

            disposition:
              CONST
                .TOKEN_DISPOSITIONS
                .FRIENDLY,

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
        "O Actor nao foi criado."
      );
    }

    await applyCharacterBackground(
      actor,
      definition.portraitPath
    );

    return actor;

  } catch (error) {

    if (actor) {
      try {
        await actor.delete();
      } catch {}
    }

    throw error;
  }
}


class PokemonCharacterCreatorApp
  extends
    HandlebarsApplicationMixin(
      ApplicationV2
    ) {

  static DEFAULT_OPTIONS = {
    id:
      "pokemon-litm-character-creator",

    classes: [
      "pokemon-litm-tools",
      "pokemon-character-creator"
    ],

    position: {
      width:
        820,

      height:
        760
    },

    window: {
      title:
        "Criar Personagem Pokemon",

      icon:
        "fa-solid fa-user-plus",

      resizable:
        true
    }
  };


  static PARTS = {
    main: {
      template:
        `modules/${MODULE_ID}/templates/character-creator.hbs`,

      scrollable: [
        ".pokemon-importer-list"
      ]
    }
  };


  mode =
    "trainer";

  selectedId =
    null;

  characterName =
    "";

  ownerId =
    "";

  busy =
    false;

  previewZoomed =
    false;


  async _prepareContext(
    options
  ) {
    const context =
      await super._prepareContext(
        options
      );

    const catalog =
      await loadPokemonAssetCatalog();

    const source =
      this.mode === "pokemon"
        ? catalog.pokemon
        : catalog.people;

    const previewTab =
      this.mode === "pokemon"
        ? "pokemon"
        : "people";

    const items =
      source.map(
        entry => ({
          ...entry,

          selected:
            this.selectedId
            ===
            entry.id,

          meta:
            this.mode === "pokemon"
              ? (
                  `#${String(
                    entry.dex
                    ??
                    entry.pokemonId
                    ??
                    ""
                  ).padStart(3, "0")}`
                  +
                  (
                    entry.heightMeters
                      ? ` - ${entry.heightMeters} m`
                      : ""
                  )
                )
              : (
                  entry.personTypeLabel
                  ||
                  entry.group
                  ||
                  ""
                ),

          secondaryMeta:
            this.mode === "trainer"
              ? (
                  entry.providerLabel
                  ||
                  ""
                )
              : "",

          ...getPokemonAssetPreviewData(
            entry,
            previewTab
          )
        })
      );

    const users =
      game.users
        .filter(
          user =>
            !user.isGM
        )
        .map(
          user => ({
            id:
              user.id,

            name:
              user.name,

            selected:
              user.id
              ===
              this.ownerId
          })
        );

    return {
      ...context,

      items,

      users,

      characterName:
        this.characterName,

      isTrainer:
        this.mode
        ===
        "trainer",

      isPokemon:
        this.mode
        ===
        "pokemon",

      canCreate:
        !!this.selectedId
        &&
        !this.busy,

      busy:
        this.busy,

      previewZoomed:
        this.previewZoomed
    };
  }


  async _onRender(
    context,
    options
  ) {
    await super._onRender(
      context,
      options
    );

    refreshPokemonAssetPreviews(
      this.element,
      this.previewZoomed
    );


    this.element
      .querySelector(
        "[data-action='togglePreviewZoom']"
      )
      ?.addEventListener(
        "click",
        event => {
          this.previewZoomed =
            !this.previewZoomed;

          const shell =
            this.element.querySelector(
              ".pokemon-character-creator-shell"
            );

          shell?.classList.toggle(
            "preview-zoomed",
            this.previewZoomed
          );

          refreshPokemonAssetPreviews(
            this.element,
            this.previewZoomed
          );

          const button =
            event.currentTarget;

          button.classList.toggle(
            "active",
            this.previewZoomed
          );

          button.setAttribute(
            "aria-pressed",
            String(this.previewZoomed)
          );

          const icon =
            button.querySelector("i");

          icon?.classList.toggle(
            "fa-magnifying-glass-plus",
            !this.previewZoomed
          );

          icon?.classList.toggle(
            "fa-magnifying-glass-minus",
            this.previewZoomed
          );
        }
      );


    const nameInput =
      this.element.querySelector(
        "[data-role='character-name']"
      );

    nameInput?.addEventListener(
      "input",
      () => {
        this.characterName =
          nameInput.value;
      }
    );


    const ownerSelect =
      this.element.querySelector(
        "[data-role='character-owner']"
      );

    ownerSelect?.addEventListener(
      "change",
      () => {
        this.ownerId =
          ownerSelect.value;
      }
    );


    for (
      const button
      of this.element
        .querySelectorAll(
          "[data-character-mode]"
        )
    ) {
      button.addEventListener(
        "click",
        async () => {
          const mode =
            button.dataset
              .characterMode;

          if (
            !mode
            ||
            mode === this.mode
          ) {
            return;
          }

          this.mode =
            mode;

          this.selectedId =
            null;

          await this.render({
            force:
              true
          });
        }
      );
    }


    const search =
      this.element.querySelector(
        "[data-role='asset-search']"
      );

    const personType =
      this.element.querySelector(
        "[data-role='person-type']"
      );

    const applyFilter =
      () => {
        const query =
          search?.value
            ?.trim()
            ?.toLocaleLowerCase()
          ??
          "";

        const wantedType =
          personType?.value
          ??
          "all";

        for (
          const card
          of this.element
            .querySelectorAll(
              "[data-character-asset]"
            )
        ) {
          const haystack =
            String(
              card.dataset.search
              ??
              ""
            )
              .toLocaleLowerCase();

          const cardType =
            card.dataset.personType
            ??
            "";

          const searchOK =
            !query
            ||
            haystack.includes(
              query
            );

          const typeOK =
            wantedType === "all"
            ||
            cardType === wantedType;

          card.hidden =
            !(
              searchOK
              &&
              typeOK
            );
        }
      };

    search?.addEventListener(
      "input",
      applyFilter
    );

    personType?.addEventListener(
      "change",
      applyFilter
    );


    for (
      const card
      of this.element
        .querySelectorAll(
          "[data-character-asset]"
        )
    ) {
      card.addEventListener(
        "click",
        () => {
          this.selectedId =
            card.dataset.assetId
            ??
            null;

          for (
            const other
            of this.element
              .querySelectorAll(
                "[data-character-asset]"
              )
          ) {
            other.classList.toggle(
              "selected",
              other === card
            );
          }

          if (
            this.mode === "pokemon"
            &&
            !this.characterName.trim()
          ) {
            this.characterName =
              card.dataset.assetName
              ??
              "";

            if (nameInput) {
              nameInput.value =
                this.characterName;
            }
          }

          const createButton =
            this.element.querySelector(
              "[data-action='createCharacter']"
            );

          if (createButton) {
            createButton.disabled =
              false;
          }
        }
      );
    }


    this.element
      .querySelector(
        "[data-action='createCharacter']"
      )
      ?.addEventListener(
        "click",
        async event => {
          if (
            this.busy
            ||
            !this.selectedId
          ) {
            return;
          }

          const catalog =
            await loadPokemonAssetCatalog();

          const source =
            this.mode === "pokemon"
              ? catalog.pokemon
              : catalog.people;

          const entry =
            source.find(
              item =>
                item.id
                ===
                this.selectedId
            );

          if (!entry) {
            ui.notifications.error(
              "Visual nao encontrado."
            );

            return;
          }

          const name =
            this.characterName.trim()
            ||
            entry.name;

          this.busy =
            true;

          const button =
            event.currentTarget;

          button.disabled =
            true;

          button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Criando...';

          try {
            const actor =
              await createCharacterFromEntry({
                entry,
                name,
                ownerId:
                  this.ownerId
              });

            ui.notifications.info(
              `${name} criado com sucesso.`
            );

            await this.close();

            actor.sheet
              ?.render?.(
                true
              );

          } catch (error) {
            console.error(
              "Pokemon LITM Tools | Character Creator:",
              error
            );

            ui.notifications.error(
              "Nao foi possivel criar o personagem. Veja F12."
            );

            this.busy =
              false;

            button.disabled =
              false;

            button.innerHTML =
              '<i class="fa-solid fa-user-plus"></i> Criar personagem';
          }
        }
      );
  }
}


export function openPokemonCharacterCreator() {
  if (
    game.system.id
    !==
    LITM_SYSTEM_ID
  ) {
    ui.notifications.warn(
      "Este criador requer Legend in the Mist."
    );

    return;
  }

  if (
    creatorApp
    &&
    creatorApp.rendered
  ) {
    creatorApp.bringToFront();
    return;
  }

  creatorApp =
    new PokemonCharacterCreatorApp();

  creatorApp.render({
    force:
      true
  });
}
