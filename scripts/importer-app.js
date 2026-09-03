import {
  getPokemonDbUrl,
  openPokemonDb
} from "./pokemon-links.js";

import {
  openPokemonBuilder
} from "./pokemon-builder.js";

const MODULE_ID = "pokemon-litm-tools";
const DYLAN_ID = "dylans-animated-tokens";
const LITM_SYSTEM_ID = "mist-engine-fvtt";

export const POKEMON_IMPORTER_DRAG_TYPE =
  "PokemonLITMAsset";

const {
  ApplicationV2,
  HandlebarsApplicationMixin
} = foundry.applications.api;

let importerApp = null;
let catalogCache = null;


/* --------------------------------------------------------- */
/* CATÁLOGO                                                  */
/* --------------------------------------------------------- */

async function loadCatalog() {
  if (catalogCache) return catalogCache;

  const response = await fetch(
    `modules/${MODULE_ID}/data/catalog.json`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error(
      `Catálogo HTTP ${response.status}`
    );
  }

  catalogCache =
    await response.json();

  return catalogCache;
}


/* --------------------------------------------------------- */
/* UPLOAD                                                    */
/* --------------------------------------------------------- */

function safeFilename(
  prefix,
  entry,
  url = ""
) {
  let ext = ".png";

  try {
    ext =
      new URL(url)
        .pathname
        .match(/\.[a-zA-Z0-9]+$/)
        ?.[0]
      ??
      ".png";
  } catch {}

  const clean =
    String(entry.id)
      .replace(
        /[^a-zA-Z0-9._-]/g,
        "-"
      )
      .replace(/-+/g, "-");

  return `${prefix}-${clean}${ext}`;
}


async function shortBlobHash(
  blob
) {
  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      await blob.arrayBuffer()
    );

  return Array
    .from(
      new Uint8Array(digest)
    )
    .map(
      value =>
        value
          .toString(16)
          .padStart(2, "0")
    )
    .join("")
    .slice(0, 12);
}

function immutableFilename(
  filename,
  hash
) {
  const dot =
    filename.lastIndexOf(".");

  if (dot <= 0) {
    return `${filename}-${hash}`;
  }

  return (
    filename.slice(0, dot)
    +
    "-"
    +
    hash
    +
    filename.slice(dot)
  );
}

async function uploadBlob(
  blob,
  filename
) {
  const hash =
    await shortBlobHash(blob);

  const immutableName =
    immutableFilename(
      filename,
      hash
    );

  const file =
    new File(
      [blob],
      immutableName,
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

  const storedPath =
    uploaded?.path
    ?? uploaded?.url
    ?? uploaded?.file
    ?? null;

  if (!storedPath) return null;

  const separator =
    storedPath.includes("?")
      ? "&"
      : "?";

  return (
    storedPath
    +
    separator
    +
    "v="
    +
    Date.now().toString(36)
  );
}


async function persistRemoteAsset(
  url,
  filename
) {
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

  return (
    await uploadBlob(
      blob,
      filename
    )
    ??
    url
  );
}


/* --------------------------------------------------------- */
/* CONVERTER GEN1 VERTICAL 6 -> DURL REDUCED                 */
/* --------------------------------------------------------- */

function canvasToBlob(
  canvas
) {
  return new Promise(
    (resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (blob) resolve(blob);
          else reject(
            new Error(
              "Falha convertendo spritesheet."
            )
          );
        },
        "image/png"
      );
    }
  );
}

async function prepareVertical6(
  entry
) {
  const response =
    await fetch(entry.sheet);

  if (!response.ok) {
    throw new Error(
      `Falha baixando ${entry.name}: HTTP ${response.status}`
    );
  }

  const originalBlob =
    await response.blob();

  const bitmap =
    await createImageBitmap(originalBlob);

  if (
    bitmap.height % 6 !== 0
  ) {
    bitmap.close();

    throw new Error(
      `${entry.name}: spritesheet vertical não possui 6 frames iguais.`
    );
  }

  const frameW =
    bitmap.width;

  const frameH =
    bitmap.height / 6;

  /*
   * Gen1Recomp:
   *
   * 0 stand down
   * 1 stand up
   * 2 stand left
   * 3 walk down
   * 4 walk up
   * 5 walk left
   *
   * Dylan DURL Reduced:
   *
   * row 0 down
   * row 1 up
   * row 2 right
   * row 3 left
   *
   * 3 colunas.
   */

  const canvas =
    document.createElement("canvas");

  canvas.width =
    frameW * 3;

  canvas.height =
    frameH * 4;

  const ctx =
    canvas.getContext(
      "2d",
      {
        alpha: true
      }
    );

  ctx.imageSmoothingEnabled =
    false;

  function drawFrame(
    sourceFrame,
    col,
    row,
    mirror = false
  ) {
    const sx = 0;
    const sy =
      sourceFrame * frameH;

    const dx =
      col * frameW;

    const dy =
      row * frameH;

    if (!mirror) {
      ctx.drawImage(
        bitmap,
        sx,
        sy,
        frameW,
        frameH,
        dx,
        dy,
        frameW,
        frameH
      );

      return;
    }

    ctx.save();

    ctx.translate(
      dx + frameW,
      dy
    );

    ctx.scale(-1, 1);

    ctx.drawImage(
      bitmap,
      sx,
      sy,
      frameW,
      frameH,
      0,
      0,
      frameW,
      frameH
    );

    ctx.restore();
  }

  /* DOWN */

  drawFrame(0, 0, 0);
  drawFrame(3, 1, 0);
  drawFrame(3, 2, 0, true);

  /* UP */

  drawFrame(1, 0, 1);
  drawFrame(4, 1, 1);
  drawFrame(4, 2, 1, true);

  /* RIGHT = LEFT ESPELHADO */

  drawFrame(2, 0, 2, true);
  drawFrame(5, 1, 2, true);
  drawFrame(5, 2, 2, true);

  /* LEFT */

  drawFrame(2, 0, 3);
  drawFrame(5, 1, 3);
  drawFrame(5, 2, 3);


  /* Portrait = primeiro frame */

  const portraitCanvas =
    document.createElement("canvas");

  portraitCanvas.width =
    frameW;

  portraitCanvas.height =
    frameH;

  const portraitCtx =
    portraitCanvas.getContext(
      "2d",
      {
        alpha: true
      }
    );

  portraitCtx.imageSmoothingEnabled =
    false;

  portraitCtx.drawImage(
    bitmap,
    0,
    0,
    frameW,
    frameH,
    0,
    0,
    frameW,
    frameH
  );

  bitmap.close();

  const [
    sheetBlob,
    portraitBlob
  ] =
    await Promise.all([
      canvasToBlob(canvas),
      canvasToBlob(portraitCanvas)
    ]);

  const [
    sheetPath,
    portraitPath
  ] =
    await Promise.all([
      uploadBlob(
        sheetBlob,
        safeFilename(
          "person-sheet",
          entry
        )
      ),

      uploadBlob(
        portraitBlob,
        safeFilename(
          "person-portrait",
          entry
        )
      )
    ]);

  return {
    sheetPath,
    portraitPath
  };
}


/* --------------------------------------------------------- */
/* ANIMAÇÃO                                                  */
/* --------------------------------------------------------- */

function cleanAnimation(animation) {
  if (
    !animation ||
    typeof animation !== "object"
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
/* CRIAR ACTOR                                               */
/* --------------------------------------------------------- */

function getOverworldFrameGrid(entry) {
  const animation = cleanAnimation(entry.animation);

  if (!animation) return null;

  const frames = Number(animation.animationframes ?? 4);

  switch (animation.sheetstyle) {
    case "durlReduced":
      return { columns: 3, rows: 4 };

    case "dlru":
      return { columns: frames, rows: 4 };

    case "eight":
      return { columns: frames, rows: 8 };

    default:
      return null;
  }
}

function getImporterPreviewData(
  entry,
  activeTab
) {
  if (
    activeTab !== "people" ||
    entry.portrait
  ) {
    return {
      previewCropped: false,
      previewColumns: 1,
      previewRows: 1
    };
  }

  const grid =
    entry.previewMode === "vertical6"
      ? {
          columns: 1,
          rows: 6
        }
      : getOverworldFrameGrid(entry);

  if (!grid) {
    return {
      previewCropped: false,
      previewColumns: 1,
      previewRows: 1
    };
  }

  return {
    previewCropped: true,
    previewColumns: grid.columns,
    previewRows: grid.rows
  };
}


function sizePreviewElement(
  element,
  naturalWidth,
  naturalHeight,
  zoomed
) {
  if (
    !naturalWidth ||
    !naturalHeight
  ) {
    return;
  }

  const maxSize =
    zoomed
      ? 136
      : 64;

  const scale =
    Math.min(
      maxSize / naturalWidth,
      maxSize / naturalHeight
    );

  element.style.width =
    `${naturalWidth * scale}px`;

  element.style.height =
    `${naturalHeight * scale}px`;
}


function renderOverworldPreview(
  image,
  zoomed
) {
  const columns =
    Number(
      image.dataset.previewColumns
      ?? 1
    );

  const rows =
    Number(
      image.dataset.previewRows
      ?? 1
    );

  const naturalWidth =
    image.naturalWidth;

  const naturalHeight =
    image.naturalHeight;

  if (
    !naturalWidth ||
    !naturalHeight ||
    columns < 1 ||
    rows < 1
  ) {
    return;
  }

  const frameWidth =
    Math.round(
      naturalWidth / columns
    );

  const frameHeight =
    Math.round(
      naturalHeight / rows
    );

  const wrapper =
    image.closest(
      ".pokemon-overworld-preview"
    );

  if (!wrapper) return;

  let canvas =
    wrapper.querySelector(
      "[data-overworld-canvas]"
    );

  if (!canvas) {
    canvas =
      document.createElement(
        "canvas"
      );

    canvas.dataset.overworldCanvas =
      "";

    wrapper.append(canvas);
  }

  if (
    canvas.width !== frameWidth ||
    canvas.height !== frameHeight
  ) {
    canvas.width =
      frameWidth;

    canvas.height =
      frameHeight;

    const ctx =
      canvas.getContext(
        "2d",
        {
          alpha: true
        }
      );

    ctx.imageSmoothingEnabled =
      false;

    ctx.clearRect(
      0,
      0,
      frameWidth,
      frameHeight
    );

    ctx.drawImage(
      image,

      0,
      0,
      frameWidth,
      frameHeight,

      0,
      0,
      frameWidth,
      frameHeight
    );
  }

  image.hidden =
    true;

  sizePreviewElement(
    canvas,
    frameWidth,
    frameHeight,
    zoomed
  );

  wrapper.style.width =
    canvas.style.width;

  wrapper.style.height =
    canvas.style.height;
}


function refreshImporterPreviews(
  root,
  zoomed
) {
  for (
    const image
    of root.querySelectorAll(
      "[data-overworld-preview]"
    )
  ) {
    const update =
      () =>
        renderOverworldPreview(
          image,
          zoomed
        );

    if (
      image.complete &&
      image.naturalWidth
    ) {
      update();
    }

    else {
      image.addEventListener(
        "load",
        update,
        {
          once: true
        }
      );
    }
  }


  for (
    const image
    of root.querySelectorAll(
      ".pokemon-asset-preview > img:not([data-overworld-preview])"
    )
  ) {
    const update =
      () =>
        sizePreviewElement(
          image,
          image.naturalWidth,
          image.naturalHeight,
          zoomed
        );

    if (
      image.complete &&
      image.naturalWidth
    ) {
      update();
    }

    else {
      image.addEventListener(
        "load",
        update,
        {
          once: true
        }
      );
    }
  }
}


async function createOverworldFrameBlob(sheetBlob, entry) {
  const grid = getOverworldFrameGrid(entry);

  if (!grid) return null;

  const bitmap = await createImageBitmap(sheetBlob);

  try {
    const frameW = bitmap.width / grid.columns;
    const frameH = bitmap.height / grid.rows;

    if (
      !Number.isInteger(frameW) ||
      !Number.isInteger(frameH)
    ) {
      return null;
    }

    const canvas = document.createElement("canvas");

    canvas.width = frameW;
    canvas.height = frameH;

    const ctx = canvas.getContext("2d", { alpha: true });
    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(
      bitmap,
      0, 0,
      frameW, frameH,
      0, 0,
      frameW, frameH
    );

    return await canvasToBlob(canvas);
  } finally {
    bitmap.close();
  }
}

async function prepareActorAssets(entry) {
  if (entry.sheetLayout === "gen1Vertical6") {
    const prepared = await prepareVertical6(entry);

    return {
      ...prepared,
      tokenPath: prepared.portraitPath
    };
  }

  const isPokemon = entry.category === "pokemon";

  const response = await fetch(entry.sheet);

  if (!response.ok) {
    throw new Error(
      `Falha baixando ${entry.name}: HTTP ${response.status}`
    );
  }

  const sheetBlob = await response.blob();

  const sheetPath =
    await uploadBlob(
      sheetBlob,
      safeFilename(
        isPokemon ? "pokemon-sheet" : "person-sheet",
        entry,
        entry.sheet
      )
    )
    ?? entry.sheet;

  let tokenPath = sheetPath;

  const tokenBlob =
    await createOverworldFrameBlob(sheetBlob, entry);

  if (tokenBlob) {
    tokenPath =
      await uploadBlob(
        tokenBlob,
        safeFilename(
          isPokemon
            ? "pokemon-overworld"
            : "person-overworld",
          entry
        )
      )
      ?? tokenPath;
  }

  let portraitPath =
    tokenPath
    ?? sheetPath
    ?? "icons/svg/mystery-man.svg";

  if (entry.portrait) {
    portraitPath =
      await persistRemoteAsset(
        entry.portrait,
        safeFilename(
          isPokemon
            ? "pokemon-portrait"
            : "person-portrait",
          entry,
          entry.portrait
        )
      )
      ?? portraitPath;
  }

  return {
    sheetPath,
    portraitPath,
    tokenPath
  };
}

async function prepareActorDefinition(
  entry
) {
  const isPokemon =
    entry.category === "pokemon";

  const {
    sheetPath,
    portraitPath,
    tokenPath
  } =
    await prepareActorAssets(entry);

  const animation =
    cleanAnimation(
      entry.animation
    );

  const visualScale =
    isPokemon
      ? Number(
          entry.tokenScale ?? 1
        )
      : 1;

  const moduleFlags = {
    schemaVersion:
      9,

    kind:
      isPokemon
        ? "pokemon"
        : "person",

    assetId:
      entry.id,

    personType:
      entry.personType ?? null,

    provider:
      entry.provider ?? null,

    pokemonId:
      entry.pokemonId ?? null,

    species:
      entry.species ?? null,

    heightMeters:
      entry.heightMeters ?? null,

    tokenScale:
      visualScale,

    source: {
      provider:
        entry.provider
        ??
        "unknown",

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
        portraitPath,

      overworld:
        tokenPath
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

  return {
    portraitPath,
    tokenPath,
    visualScale,
    moduleFlags,
    prototypeFlags
  };
}


async function createActorFromEntry(
  entry,
  folderId = null
) {
  const definition =
    await prepareActorDefinition(
      entry
    );

  const actor =
    await Actor
      .implementation
      .create({
        name:
          entry.name,

        type:
          "litm-npc",

        ...(folderId
          ? { folder: folderId }
          : {}),

        img:
          definition.portraitPath,

        prototypeToken: {
          name:
            entry.name,

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
              .NEUTRAL,

          flags:
            definition.prototypeFlags
        },

        flags: {
          [MODULE_ID]:
            definition.moduleFlags
        }
      });

  if (!actor) {
    throw new Error(
      `Nao foi possivel criar ${entry.name}`
    );
  }

  return actor;
}


async function ensureActorCurrent(
  actor,
  entry
) {
  const current =
    actor.flags?.[
      MODULE_ID
    ]
    ??
    {};

  if (
    Number(
      current.schemaVersion
      ?? 0
    ) >= 9
    &&
    current.assets?.overworld
  ) {
    return actor;
  }

  const definition =
    await prepareActorDefinition(
      entry
    );

  await actor.update({
    img:
      definition.portraitPath,

    prototypeToken: {
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

      flags:
        definition.prototypeFlags
    },

    flags: {
      [MODULE_ID]:
        definition.moduleFlags
    }
  });

  return actor;
}


function rememberedActorFolderId() {
  const id =
    String(
      game.settings.get(
        MODULE_ID,
        "lastActorFolder"
      )
      ??
      ""
    );

  if (!id) {
    return null;
  }

  const folder =
    game.folders.get(id);

  return (
    folder?.type === "Actor"
      ? id
      : null
  );
}


async function getOrCreateActorForEntry(
  entry
) {
  const existing =
    game.actors.find(
      actor =>
        actor.getFlag(
          MODULE_ID,
          "assetId"
        )
        ===
        entry.id
    );

  if (existing) {
    return ensureActorCurrent(
      existing,
      entry
    );
  }

  return createActorFromEntry(
    entry,
    rememberedActorFolderId()
  );
}


async function placeActorToken(
  actor,
  position
) {
  if (
    !canvas?.ready ||
    !canvas.scene
  ) {
    throw new Error(
      "Abra uma Scene antes de colocar o token."
    );
  }

  const token =
    await actor.getTokenDocument();

  const gridSize =
    Number(
      canvas.dimensions?.size
      ??
      canvas.grid?.size
      ??
      canvas.scene.grid?.size
      ??
      100
    );

  const width =
    Number(
      token.width
      ??
      1
    );

  const height =
    Number(
      token.height
      ??
      1
    );

  const centerX =
    Number(position.x);

  const centerY =
    Number(position.y);

  token.updateSource({
    x:
      centerX
      -
      (
        width
        *
        gridSize
        /
        2
      ),

    y:
      centerY
      -
      (
        height
        *
        gridSize
        /
        2
      )
  });

  await canvas.scene
    .createEmbeddedDocuments(
      "Token",
      [
        token.toObject()
      ]
    );
}


/* --------------------------------------------------------- */
/* PROPS                                                     */
/* --------------------------------------------------------- */

async function placeProp(
  entry,
  position = null
) {
  if (
    !canvas?.ready ||
    !canvas.scene
  ) {
    throw new Error(
      "Abra uma Scene antes de colocar Props."
    );
  }

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
      position?.x
      ??
      pivot?.x
      ??
      canvas.scene.width / 2
    );

  const centerY =
    Number(
      position?.y
      ??
      pivot?.y
      ??
      canvas.scene.height / 2
    );

  await canvas.scene
    .createEmbeddedDocuments(
      "Tile",
      [{
        x:
          centerX - size / 2,

        y:
          centerY - size / 2,

        width:
          size,

        height:
          size,

        texture: {
          src:
            imagePath
        }
      }]
    );
}


/* --------------------------------------------------------- */
/* DRAG & DROP                                               */
/* --------------------------------------------------------- */

function findCatalogEntry(
  catalog,
  category,
  id
) {
  return (
    catalog?.[category]
      ?.find(
        entry =>
          entry.id === id
      )
    ??
    null
  );
}


export async function openPokemonChallengeEditor(actor) {
  if (!game.user.isGM || !actor) return null;
  if (actor.getFlag(MODULE_ID, "pokemonBuilder") !== true) {
    throw new Error("Este Challenge não foi criado pelo Pokémon Builder.");
  }

  const catalog = await loadCatalog();
  const assetId = actor.getFlag(MODULE_ID, "assetId");
  const pokemonId = Number(actor.getFlag(MODULE_ID, "pokemonId") ?? 0);
  const entry = (catalog.pokemon ?? []).find(item =>
    (assetId && item.id === assetId)
    || (pokemonId && Number(item.pokemonId ?? item.dex) === pokemonId)
  );

  if (!entry) throw new Error("Não encontrei este Pokémon no catálogo atual.");
  return openPokemonBuilder(entry, prepareActorDefinition, { existingActor: actor });
}

export async function handlePokemonImporterCanvasDrop(
  data
) {
  if (
    !game.user.isGM ||
    data?.type
      !==
      POKEMON_IMPORTER_DRAG_TYPE ||
    data?.moduleId
      !==
      MODULE_ID
  ) {
    return false;
  }

  if (
    !canvas?.ready ||
    !canvas.scene
  ) {
    ui.notifications.warn(
      "Abra uma Scene primeiro."
    );

    return true;
  }

  const category =
    String(
      data.category
      ??
      ""
    );

  const id =
    String(
      data.id
      ??
      ""
    );

  const catalog =
    await loadCatalog();

  const entry =
    findCatalogEntry(
      catalog,
      category,
      id
    );

  if (!entry) {
    throw new Error(
      `Asset nao encontrado: ${category}:${id}`
    );
  }

  const position = {
    x:
      Number(data.x),

    y:
      Number(data.y)
  };

  if (
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y)
  ) {
    throw new Error(
      "O Foundry nao forneceu coordenadas validas para o drop."
    );
  }

  if (
    category === "props"
  ) {
    await placeProp(
      entry,
      position
    );

    return true;
  }

  const actor =
    await getOrCreateActorForEntry(
      entry
    );

  await placeActorToken(
    actor,
    position
  );

  return true;
}


/* --------------------------------------------------------- */
/* PASTAS                                                    */
/* --------------------------------------------------------- */

async function chooseActorFolder() {
  const remembered =
    game.settings.get(
      MODULE_ID,
      "lastActorFolder"
    )
    ??
    "";

  const folders =
    game.folders
      .filter(
        folder =>
          folder.type === "Actor"
      )
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name)
      );

  const options =
    folders
      .map(folder => {
        const selected =
          folder.id === remembered
            ? "selected"
            : "";

        const name =
          foundry.utils.escapeHTML(
            folder.name
          );

        return (
          `<option value="${folder.id}" ${selected}>` +
          `${name}</option>`
        );
      })
      .join("");

  const rootSelected =
    remembered
      ? ""
      : "selected";

  const result =
    await foundry
      .applications
      .api
      .DialogV2
      .input({
        window: {
          title:
            "Destino da importação"
        },

        content: `
          <div style="
            display:flex;
            flex-direction:column;
            gap:12px;
            padding:8px
          ">

            <div class="form-group">

              <label>
                Pasta existente
              </label>

              <div class="form-fields">

                <select name="folder">

                  <option
                    value=""
                    ${rootSelected}
                  >
                    Raiz de Actors
                  </option>

                  ${options}

                </select>

              </div>

            </div>


            <div class="form-group">

              <label>
                Ou criar nova pasta
              </label>

              <div class="form-fields">

                <input
                  type="text"
                  name="newFolder"
                  placeholder="Ex.: NPCs de Goldenrod"
                >

              </div>

            </div>

          </div>
        `,

        ok: {
          label:
            "Continuar",

          icon:
            "fa-solid fa-folder"
        },

        modal:
          true
      });

  if (!result) {
    return undefined;
  }

  let folderId =
    String(
      result.folder ?? ""
    )
      .trim();

  const newFolder =
    String(
      result.newFolder ?? ""
    )
      .trim();

  if (newFolder) {
    const folder =
      await Folder.create({
        name:
          newFolder,

        type:
          "Actor"
      });

    folderId =
      folder?.id
      ??
      "";
  }

  await game.settings.set(
    MODULE_ID,
    "lastActorFolder",
    folderId
  );

  return folderId || null;
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
        820,

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

  selected =
    new Map();

  previewZoomed =
    true;

  async _prepareContext(options) {
    const context =
      await super._prepareContext(options);

    try {
      const catalog =
        await loadCatalog();

      const items =
        (catalog[this.activeTab] ?? [])
          .map(entry => ({
            ...entry,

            pokedexUrl:
              this.activeTab === "pokemon"
                ? getPokemonDbUrl(entry)
                : null,

            checked:
              this.selected.has(
                `${entry.category}:${entry.id}`
              ),

            meta:
              this.activeTab === "pokemon"
                ?
                (
                  `#${String(entry.dex).padStart(3, "0")}` +
                  (
                    entry.heightMeters
                      ? ` · ${entry.heightMeters} m`
                      : ""
                  )
                )
                :
                (
                  entry.personTypeLabel
                  ||
                  entry.group
                  ||
                  ""
                ),

            secondaryMeta:
              this.activeTab === "people"
                ?
                (
                  entry.providerLabel
                  ||
                  ""
                )
                :
                "",

            isAnimated:
              !!entry.animation,

            ...getImporterPreviewData(
              entry,
              this.activeTab
            )
          }));

      return {
        ...context,

        items,

        itemCount:
          items.length,

        selectedCount:
          this.selected.size,

        previewZoomed:
          this.previewZoomed,

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
        "Pokémon LITM Tools | Catálogo:",
        error
      );

      return {
        ...context,

        items: [],

        itemCount:
          0,

        selectedCount:
          this.selected.size,

        peopleCount:
          0,

        pokemonCount:
          0,

        propsCount:
          0,

        isPeople:
          this.activeTab === "people",

        isPokemon:
          this.activeTab === "pokemon",

        isProps:
          this.activeTab === "props",

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


    refreshImporterPreviews(
      this.element,
      this.previewZoomed
    );


    /* ABAS */

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
            !tab ||
            tab === this.activeTab
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


    /* ZOOM DAS PREVIEWS */

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
              ".pokemon-importer-shell"
            );

          shell?.classList.toggle(
            "preview-zoomed",
            this.previewZoomed
          );

          refreshImporterPreviews(
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


    /* BUSCA + FILTRO */

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

        let visible = 0;

        for (
          const card
          of this.element
            .querySelectorAll(
              "[data-asset-card]"
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
            haystack.includes(query);

          const typeOK =
            wantedType === "all"
            ||
            cardType === wantedType;

          const show =
            searchOK
            &&
            typeOK;

          card.hidden =
            !show;

          if (show) {
            visible++;
          }
        }

        const counter =
          this.element.querySelector(
            "[data-role='visible-count']"
          );

        if (counter) {
          counter.textContent =
            String(visible);
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


    /* POKEMON BUILDER */

    for (
      const button
      of this.element.querySelectorAll(
        "[data-pokemon-builder]"
      )
    ) {
      button.addEventListener(
        "click",

        async event => {
          event.preventDefault();
          event.stopPropagation();

          const id =
            button.dataset
              .pokemonBuilder;

          if (!id) return;

          const oldHTML =
            button.innerHTML;

          button.disabled =
            true;

          button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Challenge';

          try {
            const catalog =
              await loadCatalog();

            const entry =
              catalog.pokemon.find(
                item =>
                  item.id === id
              );

            if (!entry) {
              throw new Error(
                "Pokemon nao encontrado no catalogo."
              );
            }

            await openPokemonBuilder(
              entry,
              prepareActorDefinition
            );

          } catch (error) {
            console.error(
              "Pokemon LITM Tools | Builder:",
              error
            );

            ui.notifications.error(
              error?.message
              ??
              "Falha no Pokemon Builder."
            );

          } finally {
            if (
              button?.isConnected
            ) {
              button.disabled =
                false;

              button.innerHTML =
                oldHTML;
            }
          }
        }
      );
    }


    /* POKEMON CARD DRAG FIX */
    for (const card of this.element.querySelectorAll("[data-asset-card]")) {
      card.draggable = true;
      for (const image of card.querySelectorAll("img")) image.draggable = false;
      for (const button of card.querySelectorAll("button")) button.draggable = false;
    }

    /* ARRASTAR PARA A SCENE */

    for (
      const card
      of this.element
        .querySelectorAll(
          "[data-asset-card]"
        )
    ) {
      card.addEventListener(
        "dragstart",

        event => {
          const transfer =
            event.dataTransfer;

          const category =
            card.dataset.category;

          const id =
            card.dataset.assetId;

          if (
            !transfer ||
            !category ||
            !id
          ) {
            event.preventDefault();
            return;
          }

          transfer.effectAllowed =
            "copy";

          const dragPayload =
            JSON.stringify({
              type: POKEMON_IMPORTER_DRAG_TYPE,
              moduleId: MODULE_ID,
              category,
              id
            });

          transfer.setData("text/plain", dragPayload);
          transfer.setData("application/json", dragPayload);

          card.classList.add(
            "dragging"
          );
        }
      );

      card.addEventListener(
        "dragend",

        () => {
          card.classList.remove(
            "dragging"
          );
        }
      );
    }


    /* CHECKBOX */

    for (
      const checkbox
      of this.element
        .querySelectorAll(
          "[data-select-entry]"
        )
    ) {
      checkbox.addEventListener(
        "change",

        () => {
          const key =
            checkbox.dataset.selectEntry;

          const category =
            checkbox.dataset.category;

          const id =
            checkbox.dataset.id;

          if (checkbox.checked) {
            this.selected.set(
              key,
              {
                category,
                id
              }
            );
          }

          else {
            this.selected.delete(key);
          }

          this.#updateSelectedCounter();
        }
      );
    }


    /* SELECIONAR VISÍVEIS */

    this.element
      .querySelector(
        "[data-action='selectVisible']"
      )
      ?.addEventListener(
        "click",

        () => {
          for (
            const checkbox
            of this.element
              .querySelectorAll(
                "[data-select-entry]"
              )
          ) {
            const card =
              checkbox.closest(
                "[data-asset-card]"
              );

            if (
              card?.hidden
            ) {
              continue;
            }

            checkbox.checked =
              true;

            this.selected.set(
              checkbox.dataset.selectEntry,

              {
                category:
                  checkbox.dataset.category,

                id:
                  checkbox.dataset.id
              }
            );
          }

          this.#updateSelectedCounter();
        }
      );


    /* LIMPAR */

    this.element
      .querySelector(
        "[data-action='clearSelection']"
      )
      ?.addEventListener(
        "click",

        () => {
          this.selected.clear();

          for (
            const checkbox
            of this.element
              .querySelectorAll(
                "[data-select-entry]"
              )
          ) {
            checkbox.checked =
              false;
          }

          this.#updateSelectedCounter();
        }
      );


    /* IMPORTAR */

    this.element
      .querySelector(
        "[data-action='importSelected']"
      )
      ?.addEventListener(
        "click",

        async event => {
          if (
            !this.selected.size
          ) {
            ui.notifications.warn(
              "Selecione pelo menos um item."
            );

            return;
          }

          const button =
            event.currentTarget;

          const oldHTML =
            button.innerHTML;

          button.disabled =
            true;

          try {
            const catalog =
              await loadCatalog();

            const actorItems = [];
            const propItems = [];

            for (
              const {
                category,
                id
              }
              of this.selected.values()
            ) {
              const entry =
                (catalog[category] ?? [])
                  .find(
                    item =>
                      item.id === id
                  );

              if (!entry) {
                continue;
              }

              if (
                category === "props"
              ) {
                propItems.push(entry);
              }

              else {
                actorItems.push(entry);
              }
            }

            let folderId =
              null;

            if (
              actorItems.length
            ) {
              folderId =
                await chooseActorFolder();

              if (
                folderId === undefined
              ) {
                return;
              }
            }

            let done = 0;

            const total =
              actorItems.length
              +
              propItems.length;

            for (
              const entry
              of actorItems
            ) {
              button.innerHTML =
                `<i class="fa-solid fa-spinner fa-spin"></i> ${done + 1}/${total}`;

              await createActorFromEntry(
                entry,
                folderId
              );

              done++;
            }

            for (
              const entry
              of propItems
            ) {
              button.innerHTML =
                `<i class="fa-solid fa-spinner fa-spin"></i> ${done + 1}/${total}`;

              await placeProp(entry);

              done++;
            }

            ui.notifications.info(
              `${total} item(ns) importado(s).`
            );

            this.selected.clear();

            await this.render({
              force:
                true
            });

          } catch (error) {
            console.error(
              "Pokémon LITM Tools | Batch:",
              error
            );

            ui.notifications.error(
              "Erro durante importação. Veja F12."
            );

          } finally {
            if (
              button?.isConnected
            ) {
              button.disabled =
                false;

              button.innerHTML =
                oldHTML;
            }
          }
        }
      );
  }


  #updateSelectedCounter() {
    const element =
      this.element.querySelector(
        "[data-role='selected-count']"
      );

    if (element) {
      element.textContent =
        String(
          this.selected.size
        );
    }
  }
}


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
    importerApp.bringToFront();

    return importerApp;
  }

  importerApp =
    new PokemonImporterApp();

  importerApp.addEventListener(
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



/* --------------------------------------------------------- */
/* PUBLIC ASSET SERVICE                                      */
/* --------------------------------------------------------- */

export async function loadPokemonAssetCatalog() {
  return loadCatalog();
}

export function getPokemonAssetPreviewData(
  entry,
  activeTab
) {
  return getImporterPreviewData(
    entry,
    activeTab
  );
}

export function refreshPokemonAssetPreviews(
  root,
  zoomed = false
) {
  return refreshImporterPreviews(
    root,
    zoomed
  );
}

export async function preparePokemonActorDefinition(
  entry
) {
  return prepareActorDefinition(
    entry
  );
}
