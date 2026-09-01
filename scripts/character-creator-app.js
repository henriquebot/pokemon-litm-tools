import {
  loadPokemonAssetCatalog,
  getPokemonAssetPreviewData,
  refreshPokemonAssetPreviews,
  preparePokemonActorDefinition
} from "./importer-app.js";

import {
  createPokemonTeamThemes,
  savePokemonDreamTeam
} from "./pokemon-theme-builder.js";

import {
  getPokemonDbUrl,
  openPokemonDb
} from "./pokemon-links.js";

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
  extends HandlebarsApplicationMixin(
    ApplicationV2
  ) {

  static DEFAULT_OPTIONS = {
    id: "pokemon-litm-character-creator",

    classes: [
      "pokemon-litm-tools",
      "pokemon-character-creator"
    ],

    position: {
      width: 880,
      height: 780
    },

    window: {
      title: "Criar Personagem Pok\u00e9mon",
      icon: "fa-solid fa-user-plus",
      resizable: true
    }
  };


  static PARTS = {
    main: {
      template:
        "modules/" +
        MODULE_ID +
        "/templates/character-creator.hbs",

      scrollable: [
        ".pokemon-importer-list"
      ]
    }
  };


  step = 1;

  mode = null;

  characterName = "";

  ownerId = "";

  visualSource = "catalog";

  selectedId = null;

  customFile = null;

  customPreviewUrl = null;

  previewZoomed = false;

  teamSize = null;

  teamSelections = [];

  teamSlot = 0;

  dreamSelections = [];

  busy = false;


  get totalSteps() {
    return (
      this.mode === "trainer"
        ? 5
        : 3
    );
  }


  _visualReady() {
    if (
      this.visualSource === "catalog"
    ) {
      return !!this.selectedId;
    }

    return !!this.customFile;
  }


  _teamReady() {
    if (
      this.mode !== "trainer"
    ) {
      return true;
    }

    if (
      this.teamSize === null
    ) {
      return false;
    }

    if (
      this.teamSize === 0
    ) {
      return true;
    }

    return (
      this.teamSelections.length
        ===
        this.teamSize
      &&
      this.teamSelections.every(
        Boolean
      )
    );
  }


  async _prepareContext(options) {
    const context =
      await super._prepareContext(
        options
      );

    let catalog = null;

    if (
      (
        this.step === 3
        &&
        this.visualSource === "catalog"
      )
      ||
      (
        (
          this.step === 4
          ||
          this.step === 5
        )
        &&
        this.mode === "trainer"
      )
    ) {
      catalog =
        await loadPokemonAssetCatalog();
    }


    let items = [];

    if (
      this.step === 3
      &&
      this.visualSource === "catalog"
      &&
      this.mode
    ) {
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

            preview:
              entry.preview
              ??
              entry.portrait
              ??
              entry.sheet,

            pokedexUrl:
              this.mode === "pokemon"
                ? getPokemonDbUrl(entry)
                : null,

            selected:
              this.selectedId
              ===
              entry.id,

            meta:
              this.mode === "pokemon"
                ? (
                    "#" +
                    String(
                      entry.dex
                      ??
                      entry.pokemonId
                      ??
                      ""
                    ).padStart(
                      3,
                      "0"
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


    let teamItems = [];

    let teamSlots = [];

    if (
      this.step === 4
      &&
      this.mode === "trainer"
    ) {
      teamItems =
        catalog.pokemon.map(
          entry => ({
            ...entry,

            preview:
              entry.preview
              ??
              entry.portrait
              ??
              entry.sheet,

            pokedexUrl:
              getPokemonDbUrl(entry),

            selected:
              this.teamSelections[
                this.teamSlot
              ]
              ===
              entry.id,

            inTeam:
              this.teamSelections
                .includes(
                  entry.id
                ),

            meta:
              "#" +
              String(
                entry.dex
                ??
                entry.pokemonId
                ??
                ""
              ).padStart(
                3,
                "0"
              ),

            ...getPokemonAssetPreviewData(
              entry,
              "pokemon"
            )
          })
        );


      const byId =
        new Map(
          catalog.pokemon.map(
            entry => [
              entry.id,
              entry
            ]
          )
        );


      teamSlots =
        Array.from(
          {
            length:
              this.teamSize
              ??
              0
          },

          (_, index) => {
            const id =
              this.teamSelections[
                index
              ];

            const entry =
              id
                ? byId.get(id)
                : null;

            return {
              index,

              number:
                index + 1,

              active:
                index
                ===
                this.teamSlot,

              filled:
                !!entry,

              name:
                entry?.name
                ??
                "Escolher Pokemon",

              preview:
                entry?.preview
                ??
                entry?.portrait
                ??
                entry?.sheet
                ??
                null
            };
          }
        );
    }


    let dreamItems = [];

    if (
      this.step === 5
      &&
      this.mode === "trainer"
    ) {
      dreamItems =
        catalog.pokemon.map(
          entry => ({
            ...entry,

            preview:
              entry.preview
              ??
              entry.portrait
              ??
              entry.sheet,

            pokedexUrl:
              getPokemonDbUrl(entry),

            inDream:
              this.dreamSelections.includes(
                entry.id
              ),

            meta:
              "#"
              +
              String(
                entry.dex
                ??
                entry.pokemonId
                ??
                ""
              ).padStart(3, "0"),

            ...getPokemonAssetPreviewData(
              entry,
              "pokemon"
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


    const visualReady =
      this._visualReady();


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
      )
      ||
      (
        this.step === 3
        &&
        this.mode === "trainer"
        &&
        visualReady
      )
      ||
      (
        this.step === 4
        &&
        this.mode === "trainer"
        &&
        this._teamReady()
      );


    const canFinish =
      (
        this.mode === "pokemon"
        &&
        this.step === 3
        &&
        visualReady
      )
      ||
      (
        this.mode === "trainer"
        &&
        this.step === 5
        &&
        this._teamReady()
      );


    return {
      ...context,

      step:
        this.step,

      totalSteps:
        this.totalSteps,

      stepIsType:
        this.step === 1,

      stepIsIdentity:
        this.step === 2,

      stepIsVisual:
        this.step === 3,

      stepIsTeam:
        this.step === 4,

      stepIsDream:
        this.step === 5,

      isTrainer:
        this.mode === "trainer",

      isPokemon:
        this.mode === "pokemon",

      characterName:
        this.characterName,

      users,

      items,

      teamItems,

      teamSlots,

      dreamItems,

      dreamCount:
        this.dreamSelections.length,

      teamSize:
        this.teamSize,

      teamSizeChosen:
        this.teamSize !== null,

      teamHasSlots:
        Number(
          this.teamSize
        ) > 0,

      teamSizeOptions:
        Array.from(
          {
            length: 7
          },

          (_, value) => ({
            value,

            selected:
              this.teamSize
              ===
              value
          })
        ),

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

      canFinish:
        canFinish
        &&
        !this.busy,

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
      (
        this.step === 3
        &&
        this.visualSource === "catalog"
      )
      ||
      this.step === 4
      ||
      this.step === 5
    ) {
      refreshPokemonAssetPreviews(
        this.element,
        this.previewZoomed
      );
    }


    /* TIPO */

    for (
      const button
      of this.element.querySelectorAll(
        "[data-character-type]"
      )
    ) {
      button.addEventListener(
        "click",
        () => {
          const mode =
            button.dataset
              .characterType;

          if (!mode) return;

          if (
            this.mode !== mode
          ) {
            this.mode =
              mode;

            this.selectedId =
              null;

            this.teamSize =
              null;

            this.teamSelections =
              [];

            this.teamSlot =
              0;

            this.dreamSelections =
              [];
          }

          for (
            const other
            of this.element.querySelectorAll(
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


    /* VISUAL: CATALOGO OU UPLOAD */

    for (
      const button
      of this.element.querySelectorAll(
        "[data-visual-source]"
      )
    ) {
      button.addEventListener(
        "click",
        async () => {
          const source =
            button.dataset
              .visualSource;

          if (!source) return;

          this.visualSource =
            source;

          await this.render({
            force: true
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
        async () => {
          this.previewZoomed =
            !this.previewZoomed;

          await this.render({
            force: true
          });
        }
      );


    /* BUSCA */

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
          of this.element.querySelectorAll(
            "[data-search-card]"
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
            !personType
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


    /* POKEDEX */

    for (
      const button
      of this.element.querySelectorAll(
        "[data-pokedex-url]"
      )
    ) {
      button.addEventListener(
        "click",
        event => {
          event.preventDefault();
          event.stopPropagation();

          openPokemonDb(
            button.dataset.pokedexUrl
          );
        }
      );
    }


    /* VISUAL DO PERSONAGEM */

    for (
      const card
      of this.element.querySelectorAll(
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
            of this.element.querySelectorAll(
              "[data-character-asset]"
            )
          ) {
            other.classList.toggle(
              "selected",
              other === card
            );
          }

          const action =
            this.element.querySelector(
              this.mode === "trainer"
                ?
                "[data-action='wizardNext']"
                :
                "[data-action='wizardFinish']"
            );

          if (action) {
            action.disabled =
              false;
          }
        }
      );
    }


    /* UPLOAD PERSONALIZADO */

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
          force: true
        });
      }
    );


    /* TAMANHO DA EQUIPE */

    for (
      const button
      of this.element.querySelectorAll(
        "[data-team-size]"
      )
    ) {
      button.addEventListener(
        "click",
        async () => {
          const size =
            Number(
              button.dataset.teamSize
            );

          if (
            !Number.isInteger(size)
            ||
            size < 0
            ||
            size > 6
          ) {
            return;
          }

          this.teamSize =
            size;

          this.teamSelections =
            this.teamSelections.slice(
              0,
              size
            );

          while (
            this.teamSelections.length
            <
            size
          ) {
            this.teamSelections.push(
              null
            );
          }

          const empty =
            this.teamSelections
              .findIndex(
                value =>
                  !value
              );

          this.teamSlot =
            empty >= 0
              ? empty
              : 0;

          await this.render({
            force: true
          });
        }
      );
    }


    /* SLOT DA EQUIPE */

    for (
      const slot
      of this.element.querySelectorAll(
        "[data-team-slot]"
      )
    ) {
      slot.addEventListener(
        "click",
        async event => {
          if (
            event.target.closest(
              "[data-team-remove]"
            )
          ) {
            return;
          }

          const index =
            Number(
              slot.dataset.teamSlot
            );

          if (
            !Number.isInteger(index)
          ) {
            return;
          }

          this.teamSlot =
            index;

          await this.render({
            force: true
          });
        }
      );
    }


    /* REMOVER POKEMON */

    for (
      const button
      of this.element.querySelectorAll(
        "[data-team-remove]"
      )
    ) {
      button.addEventListener(
        "click",
        async event => {
          event.stopPropagation();

          const index =
            Number(
              button.dataset.teamRemove
            );

          if (
            !Number.isInteger(index)
          ) {
            return;
          }

          this.teamSelections[
            index
          ] = null;

          this.teamSlot =
            index;

          await this.render({
            force: true
          });
        }
      );
    }


    /* ESCOLHER POKEMON */

    for (
      const card
      of this.element.querySelectorAll(
        "[data-team-asset]"
      )
    ) {
      card.addEventListener(
        "click",
        async () => {
          if (
            !this.teamSize
          ) {
            return;
          }

          const id =
            card.dataset.assetId;

          if (!id) return;

          this.teamSelections[
            this.teamSlot
          ] = id;

          let next =
            this.teamSelections
              .findIndex(
                (
                  value,
                  index
                ) =>
                  index
                  >
                  this.teamSlot
                  &&
                  !value
              );

          if (next < 0) {
            next =
              this.teamSelections
                .findIndex(
                  value =>
                    !value
                );
          }

          if (next >= 0) {
            this.teamSlot =
              next;
          }

          await this.render({
            force: true
          });
        }
      );
    }


    /* TIME DOS SONHOS */

    for (
      const card
      of this.element.querySelectorAll(
        "[data-dream-asset]"
      )
    ) {
      card.addEventListener(
        "click",
        async event => {
          if (
            event.target.closest(
              "[data-pokedex-url]"
            )
          ) return;

          const id =
            card.dataset.assetId;

          if (!id) return;

          const index =
            this.dreamSelections.indexOf(id);

          if (index >= 0) {
            this.dreamSelections.splice(
              index,
              1
            );
          } else {
            if (
              this.dreamSelections.length
              >= 6
            ) {
              ui.notifications.warn(
                "Escolha no maximo 6 Pokemon."
              );
              return;
            }

            this.dreamSelections.push(id);
          }

          await this.render({
            force: true
          });
        }
      );
    }


    /* VOLTAR */

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
            force: true
          });
        }
      );


    /* PROXIMO */

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
            this.step === 3
            &&
            this.mode === "trainer"
            &&
            !this._visualReady()
          ) {
            return;
          }

          if (
            this.step === 4
            &&
            this.mode === "trainer"
            &&
            !this._teamReady()
          ) {
            return;
          }

          if (
            this.step
            <
            this.totalSteps
          ) {
            this.step++;
          }

          await this.render({
            force: true
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
            !this.characterName.trim()
            ||
            !this._visualReady()
            ||
            !this._teamReady()
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

          let actor =
            null;

          try {
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


            if (
              this.mode === "trainer"
              &&
              Number(
                this.teamSize
              ) > 0
            ) {
              const catalog =
                await loadPokemonAssetCatalog();

              const byId =
                new Map(
                  catalog.pokemon.map(
                    entry => [
                      entry.id,
                      entry
                    ]
                  )
                );

              const teamEntries =
                this.teamSelections.map(
                  id =>
                    byId.get(id)
                );

              if (
                teamEntries.some(
                  entry =>
                    !entry
                )
              ) {
                throw new Error(
                  "Equipe inicial incompleta."
                );
              }

              await createPokemonTeamThemes(
                actor,
                teamEntries
              );
            }


            if (
              this.mode === "trainer"
            ) {
              const catalog =
                await loadPokemonAssetCatalog();

              const byId =
                new Map(
                  catalog.pokemon.map(
                    entry => [
                      entry.id,
                      entry
                    ]
                  )
                );

              const dreamEntries =
                this.dreamSelections
                  .map(
                    id => byId.get(id)
                  )
                  .filter(Boolean);

              await savePokemonDreamTeam(
                actor,
                dreamEntries
              );
            }


            ui.notifications.info(
              this.characterName.trim()
              +
              " criado com sucesso."
            );

            await this.close();

            actor.sheet?.render?.(
              true
            );

          } catch (error) {
            console.error(
              "Pokemon LITM Tools | Character Wizard:",
              error
            );

            if (actor) {
              try {
                await actor.delete();
              } catch {}
            }

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
    force: true
  });
}
