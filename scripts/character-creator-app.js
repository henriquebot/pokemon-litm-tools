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

import {
  createCharacterThemes
} from "./character-theme-builder.js";

import {
  loadPokemonTrainerCustomization
} from "./pokemon-builder.js";

const MODULE_ID = "pokemon-litm-tools";
const LITM_SYSTEM_ID = "mist-engine-fvtt";

const {
  ApplicationV2,
  HandlebarsApplicationMixin
} = foundry.applications.api;

const DEFAULT_BACKGROUND =
  "systems/mist-engine-fvtt/assets/default_sheet_background.webp";

let creatorApp = null;

let archetypeCatalogPromise = null;


async function loadCharacterArchetypes() {
  if (!archetypeCatalogPromise) {
    archetypeCatalogPromise =
      fetch(
        `modules/${MODULE_ID}/data/character-archetypes.json`
      )
        .then(response => {
          if (!response.ok) {
            throw new Error(
              "Nao foi possivel carregar os arquetipos."
            );
          }

          return response.json();
        })
        .then(data =>
          Array.isArray(data?.archetypes)
            ? data.archetypes
            : []
        );
  }

  return archetypeCatalogPromise;
}


function makeThemeDraft(
  theme,
  presetIndex = null,
  presetSourceId = null
) {
  return {
    presetIndex,
    presetSourceId,

    name:
      String(
        theme?.name
        ?? ""
      ),

    powerTags:
      Array.from(
        {
          length: 3
        },
        (_, index) =>
          String(
            theme?.powerTags?.[index]
            ?? ""
          )
      ),

    weaknessTags: [
      String(
        theme?.weaknessTags?.[0]
        ?? ""
      )
    ],

    quest:
      String(
        theme?.quest
        ?? ""
      )
  };
}


/*
 * Retorna as sugestoes disponiveis
 * para um slot de Tema.
 *
 * Perfil normal:
 * apenas seus proprios Temas.
 *
 * Personalizado:
 * Temas de todos os perfis.
 */
function getThemePresetOptions(
  archetypes,
  selectedArchetype,
  draft
) {
  const sources =
    selectedArchetype?.allPresets
      ? archetypes.filter(
          archetype =>
            !archetype.allPresets
            &&
            Array.isArray(archetype.themes)
            &&
            archetype.themes.length
        )
      : [selectedArchetype];

  return sources.flatMap(
    archetype =>
      (archetype?.themes ?? []).map(
        (theme, index) => ({
          value:
            archetype.id + ":" + index,

          name:
            selectedArchetype?.allPresets
              ? archetype.name + " — " + theme.name
              : theme.name,

          selected:
            draft?.presetSourceId
              === archetype.id
            &&
            draft?.presetIndex
              === index
        })
      )
  );
}


function resolveThemePreset(
  archetypes,
  value,
  fallbackArchetypeId
) {
  if (
    !value
    ||
    value === "custom"
  ) {
    return null;
  }

  let sourceId =
    fallbackArchetypeId;

  let indexText =
    value;

  if (value.includes(":")) {
    const parts =
      value.split(":");

    sourceId =
      parts[0];

    indexText =
      parts[1];
  }

  const index =
    Number(indexText);

  if (
    !sourceId
    ||
    !Number.isInteger(index)
  ) {
    return null;
  }

  const archetype =
    archetypes.find(
      item =>
        item.id === sourceId
    );

  const theme =
    archetype?.themes?.[index];

  if (!theme) {
    return null;
  }

  return {
    sourceId,
    index,
    theme
  };
}


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

  previewZoomed =
    true;

  teamSize = null;

  teamSelections = [];

  teamSlot = 0;

  pokemonCustomizations = [];

  dreamSelections = [];

  archetypeId = null;

  archetypeVariantId = null;

  themeDrafts = [];

  busy = false;


  get totalSteps() {
    return this.mode === "pokemon" ? 4 : 7;
  }


  _visualReady() {
    if (
      this.visualSource === "catalog"
    ) {
      return !!this.selectedId;
    }

    return !!this.customFile;
  }


  _themesReady() {
    if (
      !Array.isArray(
        this.themeDrafts
      )
      ||
      this.themeDrafts.length !== 4
    ) {
      return false;
    }

    return this.themeDrafts.every(
      draft => {
        const powerTags =
          Array.isArray(
            draft?.powerTags
          )
            ? draft.powerTags
            : [];

        const weaknessTags =
          Array.isArray(
            draft?.weaknessTags
          )
            ? draft.weaknessTags
            : [];

        return (
          !!String(
            draft?.name
            ?? ""
          ).trim()
          &&
          powerTags.length === 3
          &&
          powerTags.every(
            tag =>
              !!String(
                tag
                ?? ""
              ).trim()
          )
          &&
          weaknessTags.length === 1
          &&
          !!String(
            weaknessTags[0]
            ?? ""
          ).trim()
          &&
          !!String(
            draft?.quest
            ?? ""
          ).trim()
        );
      }
    );
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


  _pokemonReady() {
    if (this.mode !== "trainer") return true;
    if (Number(this.teamSize ?? 0) === 0) return true;
    if (!this._teamReady()) return false;

    return this.teamSelections.every((assetId, index) => {
      const row = this.pokemonCustomizations[index];
      const moves = Array.isArray(row?.moveIds)
        ? row.moveIds.filter(Boolean)
        : [];

      return row?.assetId === assetId
        && moves.length >= 1
        && moves.length <= 4;
    });
  }


  async _prepareContext(options) {
    const context =
      await super._prepareContext(
        options
      );

    let catalog = null;

    if (
      (
        this.step === 2
        && this.visualSource === "catalog"
      )
      ||
      (
        this.mode === "trainer"
        && [3, 4, 5].includes(this.step)
      )
    ) {
      catalog =
        await loadPokemonAssetCatalog();
    }


    let items = [];

    if (
      this.step === 2
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
      this.step === 3
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


    let pokemonProfiles = [];

    if (
      this.step === 4
      && this.mode === "trainer"
      && Number(this.teamSize ?? 0) > 0
    ) {
      const byId = new Map(
        catalog.pokemon.map(entry => [entry.id, entry])
      );

      pokemonProfiles = (
        await Promise.all(
          this.teamSelections.map(async (assetId, index) => {
            const entry = byId.get(assetId);
            if (!entry) return null;

            const options = await loadPokemonTrainerCustomization(entry, "origin");
            let current = this.pokemonCustomizations[index];

            if (!current || current.assetId !== assetId) {
              current = foundry.utils.deepClone(options.defaults);
              this.pokemonCustomizations[index] = current;
            }

            const nature = options.natureOptions.find(row => row.id === current.natureId)
              ?? options.natureOptions[0]
              ?? null;

            const ability = options.abilityOptions.find(row => row.id === current.abilityId)
              ?? options.abilityOptions[0]
              ?? null;

            const selectedMoves = new Set(
              Array.isArray(current.moveIds) ? current.moveIds : []
            );

            return {
              slot: index,
              number: index + 1,
              name: entry.name,
              preview: entry.preview ?? entry.portrait ?? entry.sheet,
              natureEffect: nature?.effect ?? "",
              abilityDescription: ability?.description ?? "",
              moveCount: selectedMoves.size,
              customWeakness: current.customWeakness ?? "",
              natureOptions: options.natureOptions.map(row => ({
                ...row,
                selected: row.id === current.natureId
              })),
              abilityOptions: options.abilityOptions.map(row => ({
                ...row,
                selected: row.id === current.abilityId
              })),
              genderOptions: options.genderOptions.map(row => ({
                ...row,
                selected: row.id === current.genderId
              })),
              weaknessOptions: options.weaknessOptions.map(row => ({
                ...row,
                selected: row.id === current.weaknessStat
              })),
              moveOptions: options.moveOptions.map(row => ({
                ...row,
                selected: selectedMoves.has(row.id)
              }))
            };
          })
        )
      ).filter(Boolean);
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


    let archetypes = [];

    let selectedArchetype = null;

    if (
      (
        this.mode === "trainer"
        && [6, 7].includes(this.step)
      )
      ||
      (
        this.mode === "pokemon"
        && [3, 4].includes(this.step)
      )
    ) {
      const loadedArchetypes =
        await loadCharacterArchetypes();

      archetypes =
        loadedArchetypes.map(
          archetype => {
            const variants =
              Array.isArray(
                archetype.variants
              )
                ? archetype.variants.map(
                    variant => ({
                      ...variant,

                      selected:
                        archetype.id
                          === this.archetypeId
                        &&
                        variant.id
                          === this.archetypeVariantId
                    })
                  )
                : [];

            return {
              ...archetype,

              variants,

              hasVariants:
                variants.length > 0,

              selected:
                archetype.id
                  === this.archetypeId
            };
          }
        );

      selectedArchetype =
        archetypes.find(
          archetype =>
            archetype.id
              === this.archetypeId
        )
        ?? null;

      if (selectedArchetype) {
        selectedArchetype = {
          ...selectedArchetype,

          selectedVariant:
            selectedArchetype
              .variants
              ?.find(
                variant =>
                  variant.selected
              )
            ?? null
        };
      }
    }


    let themeEditorSlots = [];

    if (
      (
        (this.mode === "trainer" && this.step === 7)
        || (this.mode === "pokemon" && this.step === 4)
      )
      && selectedArchetype
    ) {
      if (
        !Array.isArray(
          this.themeDrafts
        )
        ||
        this.themeDrafts.length !== 4
      ) {
        if (
          selectedArchetype.allPresets
        ) {
          this.themeDrafts =
            Array.from(
              { length: 4 },
              () =>
                makeThemeDraft(
                  {},
                  "custom",
                  null
                )
            );
        } else {
          this.themeDrafts =
            selectedArchetype.themes
              .slice(0, 4)
              .map(
                (theme, index) =>
                  makeThemeDraft(
                    theme,
                    index,
                    selectedArchetype.id
                  )
              );
        }
      }

      themeEditorSlots =
        this.themeDrafts.map(
          (draft, slotIndex) => ({
            index:
              slotIndex,

            number:
              slotIndex + 1,

            name:
              draft.name,

            powerTags:
              draft.powerTags.map(
                (name, tagIndex) => ({
                  index:
                    tagIndex,

                  name
                })
              ),

            weakness:
              draft.weaknessTags?.[0]
              ?? "",

            quest:
              draft.quest,

            presetOptions: [
              ...getThemePresetOptions(
                archetypes,
                selectedArchetype,
                draft
              ),

              {
                value:
                  "custom",

                name:
                  "Personalizado",

                selected:
                  draft.presetIndex
                    === "custom"
              }
            ]
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


    const profileReady =
      !!selectedArchetype
      &&
      (
        !selectedArchetype.hasVariants
        ||
        !!this.archetypeVariantId
      );


    const canNext =
      (
        this.step === 1
        && !!this.mode
      )
      ||
      (
        this.step === 2
        && !!this.characterName.trim()
        && visualReady
      )
      ||
      (
        this.mode === "trainer"
        && this.step === 3
        && this._teamReady()
      )
      ||
      (
        this.mode === "trainer"
        && this.step === 4
        && this._pokemonReady()
      )
      ||
      (
        this.mode === "trainer"
        && this.step === 5
      )
      ||
      (
        this.mode === "trainer"
        && this.step === 6
        && profileReady
      )
      ||
      (
        this.mode === "pokemon"
        && this.step === 3
        && profileReady
      );


    const canFinish =
      (
        this.mode === "pokemon"
        && this.step === 4
        && visualReady
        && profileReady
        && this._themesReady()
      )
      ||
      (
        this.mode === "trainer"
        && this.step === 7
        && this._teamReady()
        && this._pokemonReady()
        && profileReady
        && this._themesReady()
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
        this.step === 2,

      stepIsTeam:
        this.mode === "trainer"
        && this.step === 3,

      stepIsPokemonTeam:
        this.mode === "trainer"
        && this.step === 4,

      stepIsDream:
        this.mode === "trainer"
        && this.step === 5,

      stepIsArchetype:
        (
          this.mode === "trainer"
          && this.step === 6
        )
        || (
          this.mode === "pokemon"
          && this.step === 3
        ),

      stepIsThemes:
        (
          this.mode === "trainer"
          && this.step === 7
        )
        || (
          this.mode === "pokemon"
          && this.step === 4
        ),

      isTrainer:
        this.mode === "trainer",

      isPokemon:
        this.mode === "pokemon",

      showTrainerProgress:
        this.mode === "trainer",

      characterName:
        this.characterName,

      users,

      items,

      teamItems,

      teamSlots,

      pokemonProfiles,

      pokemonReady:
        this._pokemonReady(),

      dreamItems,

      dreamCount:
        this.dreamSelections.length,

      archetypes,

      selectedArchetype,

      themeEditorSlots,

      themesReady:
        this._themesReady(),

      archetypeChosen:
        !!this.archetypeId,

      profileReady,

      archetypeVariantId:
        this.archetypeVariantId,

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
        this.step === 2
        && this.visualSource === "catalog"
      )
      ||
      this.step === 3
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
        async () => {
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

            this.pokemonCustomizations =
              [];

            this.dreamSelections =
              [];

            this.archetypeId =
              null;

            this.archetypeVariantId =
              null;

            this.themeDrafts =
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

          await this.render({
            force: true
          });
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
            !(this.characterName.trim() && this._visualReady());
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
              "[data-action='wizardNext']"
            );

          if (action) {
            action.disabled =
              !this.characterName.trim();
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

          this.pokemonCustomizations =
            this.pokemonCustomizations.slice(
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

          this.pokemonCustomizations[
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

          if (
            this.teamSelections[
              this.teamSlot
            ] !== id
          ) {
            this.pokemonCustomizations[
              this.teamSlot
            ] = null;
          }

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


    /* PERSONALIZAR POKEMON */

    const pokemonState = slot =>
      this.pokemonCustomizations[Number(slot)];

    for (const select of this.element.querySelectorAll("[data-pokemon-nature]")) {
      select.addEventListener("change", async () => {
        const row = pokemonState(select.dataset.pokemonNature);
        if (!row) return;
        row.natureId = select.value;
        await this.render({ force: true });
      });
    }

    for (const select of this.element.querySelectorAll("[data-pokemon-ability]")) {
      select.addEventListener("change", async () => {
        const row = pokemonState(select.dataset.pokemonAbility);
        if (!row) return;
        row.abilityId = select.value;
        await this.render({ force: true });
      });
    }

    for (const select of this.element.querySelectorAll("[data-pokemon-gender]")) {
      select.addEventListener("change", () => {
        const row = pokemonState(select.dataset.pokemonGender);
        if (row) row.genderId = select.value;
      });
    }

    for (const select of this.element.querySelectorAll("[data-pokemon-weakness]")) {
      select.addEventListener("change", () => {
        const row = pokemonState(select.dataset.pokemonWeakness);
        if (row) row.weaknessStat = select.value;
      });
    }

    for (const input of this.element.querySelectorAll("[data-pokemon-custom-weakness]")) {
      input.addEventListener("input", () => {
        const row = pokemonState(input.dataset.pokemonCustomWeakness);
        if (row) row.customWeakness = input.value;
      });
    }

    for (const input of this.element.querySelectorAll("[data-pokemon-move]")) {
      input.addEventListener("change", async () => {
        const row = pokemonState(input.dataset.pokemonMove);
        if (!row) return;

        const ids = new Set(Array.isArray(row.moveIds) ? row.moveIds : []);
        const id = input.dataset.moveId;

        if (input.checked) ids.add(id);
        else ids.delete(id);

        if (ids.size < 1) {
          input.checked = true;
          ui.notifications.warn("Cada Pokémon precisa ter pelo menos 1 golpe.");
          return;
        }

        if (ids.size > 4) {
          input.checked = false;
          ui.notifications.warn("Cada Pokémon pode ter no máximo 4 golpes.");
          return;
        }

        row.moveIds = Array.from(ids);
        await this.render({ force: true });
      });
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


    /* PERFIL */

    for (
      const card
      of this.element.querySelectorAll(
        "[data-archetype-id]"
      )
    ) {
      card.addEventListener(
        "click",
        async () => {
          const id =
            card.dataset.archetypeId;

          if (!id) return;

          if (
            this.archetypeId !== id
          ) {
            this.archetypeId =
              id;

            this.archetypeVariantId =
              null;

            this.themeDrafts =
              [];
          }

          await this.render({
            force: true
          });
        }
      );
    }


    /*
     * Classe de Treinador ou
     * Especialidade.
     */
    for (
      const select
      of this.element.querySelectorAll(
        "[data-archetype-variant]"
      )
    ) {
      select.addEventListener(
        "change",
        async () => {
          const archetypeId =
            select.dataset
              .archetypeVariant;

          if (
            !archetypeId
            ||
            archetypeId
              !== this.archetypeId
          ) {
            return;
          }

          this.archetypeVariantId =
            select.value
            || null;

          this.themeDrafts =
            [];

          await this.render({
            force: true
          });
        }
      );
    }


    /* EDITOR DE TEMAS */

    const refreshThemeFinish =
      () => {
        const finish =
          this.element.querySelector(
            "[data-action='wizardFinish']"
          );

        if (finish) {
          finish.disabled =
            !this._themesReady();
        }
      };


    for (
      const select
      of this.element.querySelectorAll(
        "[data-theme-preset-slot]"
      )
    ) {
      select.addEventListener(
        "change",
        async () => {
          const slot =
            Number(
              select.dataset
                .themePresetSlot
            );

          if (
            !Number.isInteger(slot)
          ) {
            return;
          }

          const archetypes =
            await loadCharacterArchetypes();

          if (
            select.value === "custom"
          ) {
            this.themeDrafts[slot] =
              makeThemeDraft(
                {},
                "custom",
                null
              );
          } else {
            const resolved =
              resolveThemePreset(
                archetypes,
                select.value,
                this.archetypeId
              );

            if (!resolved) {
              return;
            }

            this.themeDrafts[slot] =
              makeThemeDraft(
                resolved.theme,
                resolved.index,
                resolved.sourceId
              );
          }

          await this.render({
            force: true
          });
        }
      );
    }


    for (
      const input
      of this.element.querySelectorAll(
        "[data-theme-name]"
      )
    ) {
      input.addEventListener(
        "input",
        () => {
          const slot =
            Number(
              input.dataset.themeName
            );

          if (!this.themeDrafts[slot]) {
            return;
          }

          this.themeDrafts[slot].name =
            input.value;

          this.themeDrafts[slot].presetIndex =
            "custom";

          this.themeDrafts[slot].presetSourceId =
            null;

          refreshThemeFinish();
        }
      );
    }


    for (
      const input
      of this.element.querySelectorAll(
        "[data-theme-power]"
      )
    ) {
      input.addEventListener(
        "input",
        () => {
          const [
            slotText,
            tagText
          ] =
            input.dataset.themePower
              .split(":");

          const slot =
            Number(slotText);

          const tag =
            Number(tagText);

          if (
            !this.themeDrafts[slot]
          ) return;

          this.themeDrafts[slot]
            .powerTags[tag] =
              input.value;

          this.themeDrafts[slot]
            .presetIndex =
              "custom";

          this.themeDrafts[slot]
            .presetSourceId =
              null;

          refreshThemeFinish();
        }
      );
    }


    for (
      const input
      of this.element.querySelectorAll(
        "[data-theme-weakness]"
      )
    ) {
      input.addEventListener(
        "input",
        () => {
          const slot =
            Number(
              input.dataset
                .themeWeakness
            );

          if (
            !this.themeDrafts[slot]
          ) return;

          this.themeDrafts[slot]
            .weaknessTags[0] =
              input.value;

          this.themeDrafts[slot]
            .presetIndex =
              "custom";

          this.themeDrafts[slot]
            .presetSourceId =
              null;

          refreshThemeFinish();
        }
      );
    }


    for (
      const input
      of this.element.querySelectorAll(
        "[data-theme-quest]"
      )
    ) {
      input.addEventListener(
        "input",
        () => {
          const slot =
            Number(
              input.dataset
                .themeQuest
            );

          if (
            !this.themeDrafts[slot]
          ) return;

          this.themeDrafts[slot].quest =
            input.value;

          this.themeDrafts[slot].presetIndex =
            "custom";

          this.themeDrafts[slot].presetSourceId =
            null;

          refreshThemeFinish();
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
            && (
              !this.characterName.trim()
              || !this._visualReady()
            )
          ) {
            return;
          }

          if (
            this.mode === "trainer"
            && this.step === 3
            && !this._teamReady()
          ) {
            return;
          }

          if (
            this.mode === "trainer"
            && this.step === 4
            && !this._pokemonReady()
          ) {
            return;
          }

          if (
            (
              this.mode === "trainer"
              && this.step === 6
            )
            || (
              this.mode === "pokemon"
              && this.step === 3
            )
          ) {
            const archetypes =
              await loadCharacterArchetypes();

            const archetype =
              archetypes.find(
                item =>
                  item.id
                    === this.archetypeId
              );

            const needsVariant =
              Array.isArray(
                archetype?.variants
              )
              &&
              archetype.variants.length > 0;

            if (
              !archetype
              ||
              (
                needsVariant
                &&
                !this.archetypeVariantId
              )
            ) {
              return;
            }
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
            ||
            !this._pokemonReady()
            ||
            !this._themesReady()
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
                teamEntries,
                {
                  customizations:
                    this.pokemonCustomizations
                }
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


            await createCharacterThemes(
              actor,
              this.themeDrafts,
              this.archetypeId
            );

            await actor.setFlag(
              MODULE_ID,
              "characterArchetypeVariantId",
              this.archetypeVariantId
            );


            /*
             * O LitM cria personagens em
             * editMode por padrao.
             * O personagem pronto deve abrir
             * diretamente no modo de jogo.
             */
            await actor.update({
              "system.editMode":
                false
            });


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
