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



async function uploadCustomCharacterImage(
  file,
  mode
) {
  const original =
    String(
      file?.name
      ??
      "custom.png"
    );

  const ext =
    original
      .match(/\.[a-zA-Z0-9]+$/)
      ?.[0]
    ??
    ".png";

  const prefix =
    mode === "pokemon"
      ? "custom-pokemon"
      : "custom-trainer";

  const filename =
    `${prefix}-${Date.now()}${ext}`;

  const uploadFile =
    new File(
      [file],
      filename,
      {
        type:
          file.type
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
        uploadFile,
        {
          overwrite:
            false
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


async function createCharacterFromCustom({
  mode,
  name,
  ownerId,
  imagePath
}) {
  const ownership =
    ownerId
      ? {
          [ownerId]:
            CONST
              .DOCUMENT_OWNERSHIP_LEVELS
              .OWNER
        }
      : {};

  const moduleFlags = {
    schemaVersion:
      8,

    kind:
      mode === "pokemon"
        ? "pokemon"
        : "person",

    playerCharacter:
      true,

    customAsset:
      true,

    assetId:
      null,

    source: {
      provider:
        "custom-upload"
    },

    assets: {
      portrait:
        imagePath,

      overworld:
        imagePath
    }
  };

  let actor = null;

  try {
    actor =
      await Actor
        .implementation
        .create({
          name,

          type:
            "litm-character",

          img:
            imagePath,

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
                imagePath
            },

            lockRotation:
              true,

            disposition:
              CONST
                .TOKEN_DISPOSITIONS
                .FRIENDLY
          },

          flags: {
            [MODULE_ID]:
              moduleFlags
          }
        });

    if (!actor) {
      throw new Error(
        "Actor nao criado."
      );
    }

    await applyCharacterBackground(
      actor,
      imagePath
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
        840,

      height:
        760
    },

    window: {
      title:
        "Criar Personagem Pok\u00e9mon",

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


  step =
    1;

  mode =
    null;

  characterName =
    "";

  ownerId =
    "";

  visualSource =
    "catalog";

  selectedId =
    null;

  customFile =
    null;

  customPreviewUrl =
    null;

  previewZoomed =
    false;

  busy =
    false;


  async _prepareContext(
    options
  ) {
    const context =
      await super._prepareContext(
        options
      );

    let items = [];

    if (
      this.step === 3
      &&
      this.visualSource === "catalog"
      &&
      this.mode
    ) {
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

      items =
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
    }

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

    const canNext =
      (
        this.step === 1
        &&
        !!this.mode
      )
      ||
      (
        this.step === 2
        &&
        !!this.characterName.trim()
      );

    const canFinish =
      this.step === 3
      &&
      (
        (
          this.visualSource
          ===
          "catalog"
          &&
          !!this.selectedId
        )
        ||
        (
          this.visualSource
          ===
          "upload"
          &&
          !!this.customFile
        )
      )
      &&
      !this.busy;

    return {
      ...context,

      step:
        this.step,

      stepIsType:
        this.step === 1,

      stepIsIdentity:
        this.step === 2,

      stepIsVisual:
        this.step === 3,

      isTrainer:
        this.mode === "trainer",

      isPokemon:
        this.mode === "pokemon",

      characterName:
        this.characterName,

      users,

      items,

      visualCatalog:
        this.visualSource
        ===
        "catalog",

      visualUpload:
        this.visualSource
        ===
        "upload",

      customPreviewUrl:
        this.customPreviewUrl,

      customFileName:
        this.customFile?.name
        ??
        "",

      previewZoomed:
        this.previewZoomed,

      canBack:
        this.step > 1,

      canNext,

      canFinish,

      busy:
        this.busy
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


    if (
      this.step === 3
      &&
      this.visualSource
      ===
      "catalog"
    ) {
      refreshPokemonAssetPreviews(
        this.element,
        this.previewZoomed
      );
    }


    /* TIPO */

    for (
      const button
      of this.element
        .querySelectorAll(
          "[data-character-type]"
        )
    ) {
      button.addEventListener(
        "click",
        () => {
          const newMode =
            button.dataset.characterType;

          if (
            !newMode
            ||
            newMode === this.mode
          ) {
            return;
          }

          this.mode =
            newMode;

          this.selectedId =
            null;

          this.visualSource =
            "catalog";

          this.customFile =
            null;

          if (
            this.customPreviewUrl
          ) {
            URL.revokeObjectURL(
              this.customPreviewUrl
            );
          }

          this.customPreviewUrl =
            null;

          for (
            const other
            of this.element
              .querySelectorAll(
                "[data-character-type]"
              )
          ) {
            other.classList.toggle(
              "selected",
              other === button
            );
          }

          const next =
            this.element.querySelector(
              "[data-action='wizardNext']"
            );

          if (next) {
            next.disabled =
              false;
          }
        }
      );
    }


    /* IDENTIDADE */

    const nameInput =
      this.element.querySelector(
        "[data-role='character-name']"
      );

    nameInput?.addEventListener(
      "input",
      () => {
        this.characterName =
          nameInput.value;

        const next =
          this.element.querySelector(
            "[data-action='wizardNext']"
          );

        if (next) {
          next.disabled =
            !this.characterName.trim();
        }
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


    /* ORIGEM DO VISUAL */

    for (
      const button
      of this.element
        .querySelectorAll(
          "[data-visual-source]"
        )
    ) {
      button.addEventListener(
        "click",
        async () => {
          const source =
            button.dataset.visualSource;

          if (
            !source
            ||
            source
            ===
            this.visualSource
          ) {
            return;
          }

          this.visualSource =
            source;

          await this.render({
            force:
              true
          });
        }
      );
    }


    /* ZOOM */

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


    /* FILTROS */

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

          card.hidden =
            !(
              (
                !query
                ||
                haystack.includes(
                  query
                )
              )
              &&
              (
                wantedType === "all"
                ||
                cardType === wantedType
              )
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


    /* SELECIONAR ASSET */

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

          const finish =
            this.element.querySelector(
              "[data-action='wizardFinish']"
            );

          if (finish) {
            finish.disabled =
              false;
          }
        }
      );
    }


    /* UPLOAD */

    const fileInput =
      this.element.querySelector(
        "[data-role='custom-image']"
      );

    fileInput?.addEventListener(
      "change",
      async () => {
        const file =
          fileInput.files?.[0];

        if (!file) return;

        if (
          !file.type.startsWith(
            "image/"
          )
        ) {
          ui.notifications.warn(
            "Escolha um arquivo de imagem."
          );

          return;
        }

        if (
          this.customPreviewUrl
        ) {
          URL.revokeObjectURL(
            this.customPreviewUrl
          );
        }

        this.customFile =
          file;

        this.customPreviewUrl =
          URL.createObjectURL(
            file
          );

        await this.render({
          force:
            true
        });
      }
    );


    /* NAVEGACAO */

    this.element
      .querySelector(
        "[data-action='wizardBack']"
      )
      ?.addEventListener(
        "click",
        async () => {
          if (
            this.step <= 1
          ) {
            return;
          }

          this.step--;

          await this.render({
            force:
              true
          });
        }
      );


    this.element
      .querySelector(
        "[data-action='wizardNext']"
      )
      ?.addEventListener(
        "click",
        async () => {
          if (
            this.step === 1
            &&
            !this.mode
          ) {
            return;
          }

          if (
            this.step === 2
            &&
            !this.characterName.trim()
          ) {
            return;
          }

          if (
            this.step < 3
          ) {
            this.step++;
          }

          await this.render({
            force:
              true
          });
        }
      );


    /* FINALIZAR */

    this.element
      .querySelector(
        "[data-action='wizardFinish']"
      )
      ?.addEventListener(
        "click",
        async event => {
          if (
            this.busy
            ||
            !this.mode
            ||
            !this.characterName.trim()
          ) {
            return;
          }

          this.busy =
            true;

          const button =
            event.currentTarget;

          button.disabled =
            true;

          button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Criando...';

          try {
            let actor;

            if (
              this.visualSource
              ===
              "catalog"
            ) {
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
                throw new Error(
                  "Visual nao encontrado."
                );
              }

              actor =
                await createCharacterFromEntry({
                  entry,

                  name:
                    this.characterName.trim(),

                  ownerId:
                    this.ownerId
                });

            } else {
              if (!this.customFile) {
                throw new Error(
                  "Imagem personalizada nao selecionada."
                );
              }

              const imagePath =
                await uploadCustomCharacterImage(
                  this.customFile,
                  this.mode
                );

              if (!imagePath) {
                throw new Error(
                  "Upload da imagem falhou."
                );
              }

              actor =
                await createCharacterFromCustom({
                  mode:
                    this.mode,

                  name:
                    this.characterName.trim(),

                  ownerId:
                    this.ownerId,

                  imagePath
                });
            }

            ui.notifications.info(
              `${this.characterName.trim()} criado com sucesso.`
            );

            await this.close();

            actor.sheet
              ?.render?.(
                true
              );

          } catch (error) {
            console.error(
              "Pokemon LITM Tools | Character Wizard:",
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
              '<i class="fa-solid fa-check"></i> Finalizar';
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
