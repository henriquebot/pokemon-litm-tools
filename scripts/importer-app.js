import {
  getPokemonDbUrl,
  openPokemonDb
} from "./pokemon-links.js";

import {
  openPokemonBuilder,
  openPokemonTrainerThemeBuilder
} from "./pokemon-builder.js";

const MODULE_ID = "pokemon-litm-tools";
const DYLAN_ID = "dylans-animated-tokens";
const LITM_SYSTEM_ID = "mist-engine-fvtt";

export const POKEMON_IMPORTER_DRAG_TYPE =
  "PokemonLITMAsset";

export function formatPokemonAssetLabel(name) {
  const label = String(name ?? "");
  const gender = /(?:^|\s)[FM](?=\s|$)/i.exec(label);

  return gender
    ? label.slice(
        0,
        gender.index + gender[0].length
      ).trimEnd()
    : label;
}

const {
  ApplicationV2,
  HandlebarsApplicationMixin
} = foundry.applications.api;

let importerApp = null;
let catalogCache = null;
const importerWarnings = new Set();

const SAFE_STATIC_FALLBACK =
  "icons/svg/mystery-man.svg";


/*
 * Trainer Classes representam um arquétipo visual, não uma pessoa única.
 * Ao arrastar para a Scene, o Importer oferece um nome de treinador e cria
 * uma instância nova. Isso evita que "Youngster Joey" em uma rota vire o
 * mesmo Actor que outro Youngster em outra rota.
 */
const TRAINER_NAME_POOLS = [
  { id: "youngster", match: /youngster|jovem|garoto/ },
  { id: "lass", match: /\blass\b|garota/ },
  { id: "bugCatcher", match: /bug catcher|bug maniac|apanhador.*inseto|cacador.*inseto/ },
  { id: "hiker", match: /hiker|montanhista/ },
  { id: "camper", match: /camper|campista/ },
  { id: "picnicker", match: /picnicker|piquenique/ },
  { id: "swimmer", match: /swimmer|nadador/ },
  { id: "fisherman", match: /fisherman|pescador/ },
  { id: "sailor", match: /sailor|marinheiro/ },
  { id: "birdKeeper", match: /bird keeper|criador.*ave/ },
  { id: "biker", match: /biker|cue ball|motoqueiro/ },
  { id: "blackBelt", match: /black belt|faixa.*preta/ },
  { id: "psychic", match: /psychic|psiquic|medium/ },
  { id: "scientist", match: /scientist|cientista|super nerd|engineer/ },
  { id: "ranger", match: /ranger/ },
  { id: "aceTrainer", match: /ace trainer|cooltrainer|treinador.*ace/ },
  { id: "beauty", match: /beauty|bela|modelo/ },
  { id: "gentleman", match: /gentleman|cavalheiro/ },
  { id: "pokefan", match: /pokefan|pokemon fan/ },
  { id: "grunt", match: /rocket|grunt|recruta/ }
];

// Emergency pools keep the picker usable if the bundled JSON cannot be read.
const TRAINER_FALLBACK_NAMES = [
  "Alex", "Alexis", "Angel", "Ariel", "Ash", "Aspen", "Aubrey", "Avery",
  "Bailey", "Blair", "Blake", "Brett", "Briar", "Brook", "Brooklyn", "Cameron",
  "Carey", "Casey", "Cedar", "Charlie", "Chris", "Cody", "Corey", "Dakota",
  "Dallas", "Dana", "Darcy", "Devin", "Dorian", "Drew", "Dylan", "Eden",
  "Ellery", "Ellis", "Emerson", "Emery", "Finley", "Florian", "Frankie", "Glenn",
  "Gray", "Harley", "Harper", "Hayden", "Hollis", "Indigo", "Jamie", "Jay",
  "Jesse", "Jordan", "Jules", "Kai", "Kendall", "Kennedy", "Kim", "Lane",
  "Lee", "Lennox", "Linden", "Logan", "Marion", "Marley", "Micah", "Morgan",
  "Oakley", "Parker", "Pat", "Peyton", "Phoenix", "Quinn", "Reese", "Remy",
  "Riley", "River", "Robin", "Rory", "Rowan", "Sage", "Sam", "Sasha",
  "Sawyer", "Shannon", "Shawn", "Shiloh", "Sky", "Skyler", "Spencer", "Sterling",
  "Sydney", "Taylor", "Terry", "Toby", "Tracy", "Val"
];
const TRAINER_MALE_FALLBACK_NAMES = [
  "Aaron", "Alex", "Angelo", "Atsushi", "Barny", "Benjamin", "Blake", "Brenden",
  "Bryant", "Cameron", "Charlie", "Chris", "Coby", "Conner", "Corey", "Dalton",
  "Darrin", "Dawson", "Demetrius", "Dirk", "Drew", "Dylan", "Edmond", "Elijah",
  "Ethan", "Fernando", "Fredrick", "Gerald", "Greg", "Hayden", "Hideo", "Hugo",
  "Jace", "Jamal", "Jasper", "Jeremy", "John", "Jose", "Jovan", "Kayden",
  "Kent", "Koji", "Lawson", "Leonel", "Logan", "Lukas", "Marc", "Mason",
  "Milo", "Nash", "Nicolas", "Norton", "Paul", "Phillip", "Ramiro", "Reed",
  "Rick", "Rodney", "Ruben", "Sawyer", "Simon", "Takao", "Timmy", "Travis"
];
const TRAINER_FEMALE_FALLBACK_NAMES = [
  "Abigail", "Alexia", "Alice", "Alize", "Alyssa", "Amira", "Angelina", "Anya",
  "Athena", "Becky", "Beverly", "Brenda", "Brooke", "Carlee", "Carolina", "Celia",
  "Charlie", "Claire", "Cora", "Cyndy", "Dana", "Darcy", "Denise", "Donny",
  "Gabrielle", "Grace", "Haley", "Heidi", "Imani", "Isabel", "Isobel", "Janae",
  "Jasmine", "Jennifer", "Joana", "Johanna", "Kara", "Katelyn", "Katie", "Kaylee",
  "Kelsey", "Kyra", "Lauren", "Linda", "Lori", "Madeline", "Maria", "Marley",
  "Maura", "Melissa", "Miriam", "Nancy", "Nikki", "Paige", "Paula", "Reli",
  "Robin", "Ruth", "Sarah", "Sharon", "Shelby", "Simon", "Sophie", "Sylvia"
];

let trainerNameData = null;
let trainerNameDataPromise = null;

async function loadTrainerNamePools() {
  if (!trainerNameDataPromise) {
    trainerNameDataPromise = (async () => {
      try {
        const response = await fetch(
          `modules/${MODULE_ID}/data/trainer-name-pools.json`
        );
        if (!response.ok) throw new Error(`Nomes HTTP ${response.status}`);
        const data = await response.json();
        if (
          !data?.classes
          || !["male", "female", "neutral"].every(
            gender => uniqueTrainerNames(data.fallbacks?.[gender]).length
          )
        ) {
          throw new Error("Pools de nomes inválidos");
        }
        trainerNameData = data;
      } catch (error) {
        warnImporterOnce(
          "trainer-name-pools",
          "Não foi possível ler os nomes locais; usando os nomes de reserva.",
          error
        );
      }
      return trainerNameData;
    })();
  }
  return trainerNameDataPromise;
}

function uniqueTrainerNames(names) {
  const seen = new Set();
  return (Array.isArray(names) ? names : []).filter(name => {
    if (typeof name !== "string" || !name.trim()) return false;
    const key = name.trim().toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(name => name.trim());
}

function normalizedTrainerClass(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\bbugcatcher\b/g, "bug catcher")
    .replace(/\bblackbelt\b/g, "black belt")
    .replace(/\bacetrainer\b/g, "ace trainer")
    .replace(/\bbirdkeeper\b/g, "bird keeper")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericPersonEntry(entry) {
  if (entry?.category !== "people") return false;
  if (entry?.personType === "trainer-class") return true;

  /*
   * NPCs do pokemon-assets são sprites genéricos (Child M, Guard, Nurse...).
   * HGSS contém personagens canônicos como Officer Jenny; esses mantêm o
   * próprio nome e não recebem uma identidade aleatória.
   */
  return entry?.personType === "npc"
    && entry?.provider !== "hgss-sprites";
}

export function inferPersonGender(entry) {
  const explicit = normalizedTrainerClass(entry?.gender);
  if (["female", "feminino", "f"].includes(explicit)) return "female";
  if (["male", "masculino", "m"].includes(explicit)) return "male";

  const key = normalizedTrainerClass(
    [entry?.name, entry?.id, entry?.group].filter(Boolean).join(" ")
  );

  // An explicit asset marker wins even over a traditionally gendered class.
  if (/(?:^|\s)(?:f|female)(?:\s|$)/.test(key)) return "female";
  if (/(?:^|\s)(?:m|male)(?:\s|$)/.test(key)) return "male";

  if (
    /(?:^|\s)(?:f|female|girl|woman|lass|beauty|picnicker|maid|nurse|mother|mom|granny)(?:\s|$)/.test(key)
    || /lady\b|aromanlady\b/.test(key)
  ) {
    return "female";
  }

  if (
    /(?:^|\s)(?:m|male|boy|man|youngster|gentleman|hiker|fisherman|sailor|camper|father|dad|gramps)(?:\s|$)/.test(key)
    || /black ?belt\b|bug ?catcher\b|bird keeper\b|biker\b|scientist\b/.test(key)
  ) {
    return "male";
  }

  return "unknown";
}

function stableTrainerNameOffset(entry, length) {
  if (!length) return 0;

  const key = normalizedTrainerClass(
    [entry?.id, entry?.name].filter(Boolean).join(" ")
  );

  let hash = 0;
  for (let index = 0; index < key.length; index++) {
    hash = ((hash * 31) + key.charCodeAt(index)) >>> 0;
  }

  return hash % length;
}

export function trainerNamePool(entry, data = trainerNameData) {
  const key = normalizedTrainerClass(entry?.name);
  const gender = inferPersonGender(entry);
  const fallbackKey = gender === "unknown" ? "neutral" : gender;
  const emergency = gender === "female"
    ? TRAINER_FEMALE_FALLBACK_NAMES
    : gender === "male"
      ? TRAINER_MALE_FALLBACK_NAMES
      : TRAINER_FALLBACK_NAMES;
  const localFallback = uniqueTrainerNames(data?.fallbacks?.[fallbackKey]);
  const fallback = localFallback.length ? localFallback : emergency;
  const classId = TRAINER_NAME_POOLS.find(row => row.match.test(key))?.id;
  const classData = data?.classes?.[classId];
  const classNames = uniqueTrainerNames(
    gender === "unknown"
      ? [...(classData?.male ?? []), ...(classData?.female ?? [])]
      : classData?.[gender]
  );

  if (!classNames.length) return fallback;

  // Use the class AND its gender, then widen short pools without duplicates.
  // Sequential selection exhausts at least 48 names before repeating.
  const minimumSize = Math.max(48, classNames.length);
  return uniqueTrainerNames([...classNames, ...fallback])
    .slice(0, minimumSize);
}

export function trainerNameAt(entry, index = 0, data = trainerNameData) {
  const pool = trainerNamePool(entry, data);
  const baseIndex = stableTrainerNameOffset(entry, pool.length);
  const offset = Number.isFinite(Number(index)) ? Math.trunc(Number(index)) : 0;
  const safeIndex =
    ((baseIndex + offset) % pool.length + pool.length) % pool.length;

  return pool[safeIndex];
}

export function nextTrainerNameChoice(
  entry,
  index = 0,
  currentName = "",
  data = trainerNameData
) {
  let nextIndex = (Number(index) || 0) + 1;
  let name = trainerNameAt(entry, nextIndex, data);
  // A manually entered name can coincide with the next suggestion.
  if (
    name.toLocaleLowerCase()
    === String(currentName).trim().toLocaleLowerCase()
  ) {
    nextIndex += 1;
    name = trainerNameAt(entry, nextIndex, data);
  }
  return { index: nextIndex, name };
}


function warnImporterOnce(
  key,
  message,
  error = null
) {
  if (error) {
    console.warn(
      `Pokemon LITM Tools | ${message}`,
      error
    );
  }
  else {
    console.warn(
      `Pokemon LITM Tools | ${message}`
    );
  }

  if (importerWarnings.has(key)) {
    return;
  }

  importerWarnings.add(key);

  globalThis.ui
    ?.notifications
    ?.warn?.(message);
}


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

  let uploaded = null;

  try {
    uploaded =
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
  }
  catch (error) {
    warnImporterOnce(
      "persistent-upload-fallback",
      "Não foi possível salvar alguns assets no armazenamento persistente. O Importer usará um fallback seguro.",
      error
    );

    return null;
  }

  const storedPath =
    uploaded?.path
    ?? uploaded?.url
    ?? uploaded?.file
    ?? null;

  if (!storedPath) {
    warnImporterOnce(
      "persistent-upload-fallback",
      "O armazenamento persistente não retornou um caminho de arquivo. O Importer usará um fallback seguro."
    );

    return null;
  }

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

  try {
    const response =
      await fetch(url);

    if (!response.ok) {
      warnImporterOnce(
        "remote-asset-fetch-failed",
        "Alguns assets remotos não puderam ser copiados. O Importer usará a URL original quando isso for seguro.",
        new Error(
          `Falha baixando ${filename}: HTTP ${response.status}`
        )
      );

      return url;
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
  catch (error) {
    warnImporterOnce(
      "remote-asset-fetch-failed",
      "Alguns assets remotos não puderam ser copiados. O Importer usará a URL original quando isso for seguro.",
      error
    );

    return url;
  }
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

function normalizedImagePath(
  value
) {
  return String(value ?? "")
    .trim()
    .split(/[?#]/, 1)[0];
}

function isPlaceholderImagePath(
  value
) {
  const normalized =
    normalizedImagePath(value)
      .toLowerCase();

  if (!normalized) {
    return false;
  }

  return (
    normalized.endsWith(
      "/icon-challenge.svg"
    )
    ||
    normalized.endsWith(
      "/mystery-man.svg"
    )
    ||
    normalized ===
      "icons/svg/mystery-man.svg"
  );
}

function isUsableStaticImagePath(
  value
) {
  return Boolean(
    normalizedImagePath(value)
  );
}

function isUsableDylanSheetPath(
  value
) {
  return (
    isUsableStaticImagePath(value)
    &&
    !isPlaceholderImagePath(value)
  );
}

function sameImagePath(
  left,
  right
) {
  const a =
    normalizedImagePath(left);

  const b =
    normalizedImagePath(right);

  return Boolean(
    a &&
    b &&
    a === b
  );
}

function dylanStateInvalid(
  flags
) {
  return Boolean(
    flags?.spritesheet === true
    &&
    !isUsableDylanSheetPath(
      flags?.sheetsrc
    )
  );
}

function actorNeedsAssetRepair(
  actor,
  current
) {
  if (
    Number(
      current?.schemaVersion
      ?? 0
    ) < 10
  ) {
    return true;
  }

  const portrait =
    current?.assets?.portrait;

  const overworld =
    current?.assets?.overworld;

  if (
    !isUsableStaticImagePath(portrait)
    ||
    !isUsableStaticImagePath(overworld)
  ) {
    return true;
  }

  const actorImg =
    actor?.img;

  const tokenImg =
    actor?.prototypeToken
      ?.texture
      ?.src;

  if (
    isPlaceholderImagePath(actorImg)
    &&
    !isPlaceholderImagePath(portrait)
  ) {
    return true;
  }

  if (
    isPlaceholderImagePath(tokenImg)
    &&
    !isPlaceholderImagePath(overworld)
  ) {
    return true;
  }

  const sheet =
    current?.assets?.spritesheet;

  if (
    current?.animation
    &&
    sheet
    &&
    sameImagePath(
      actorImg,
      sheet
    )
    &&
    !sameImagePath(
      portrait,
      sheet
    )
  ) {
    return true;
  }

  if (
    current?.animation
    &&
    sheet
    &&
    sameImagePath(
      tokenImg,
      sheet
    )
    &&
    !sameImagePath(
      overworld,
      sheet
    )
  ) {
    return true;
  }

  return dylanStateInvalid(
    actor?.prototypeToken
      ?.flags?.[DYLAN_ID]
  );
}

function tokenNeedsAssetRepair(
  token,
  current,
  entry,
  definition
) {
  const tokenImg =
    token?.texture?.src;

  if (
    !isUsableStaticImagePath(tokenImg)
    ||
    isPlaceholderImagePath(tokenImg)
  ) {
    return true;
  }

  if (
    dylanStateInvalid(
      token?.flags?.[DYLAN_ID]
    )
  ) {
    return true;
  }

  const oldSheet =
    current?.assets?.spritesheet
    ??
    entry?.sheet
    ??
    null;

  const hadAnimation =
    Boolean(
      current?.animation
      ??
      entry?.animation
    );

  return Boolean(
    hadAnimation
    &&
    oldSheet
    &&
    sameImagePath(
      tokenImg,
      oldSheet
    )
    &&
    !sameImagePath(
      definition?.tokenPath,
      oldSheet
    )
  );
}

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
  const isPokemon =
    entry.category === "pokemon";

  if (entry.sheetLayout === "gen1Vertical6") {
    const prepared =
      await prepareVertical6(entry);

    let portraitPath =
      prepared.portraitPath
      ??
      null;

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
        ??
        portraitPath;
    }

    const safeStatic =
      portraitPath
      ??
      SAFE_STATIC_FALLBACK;

    return {
      sheetPath:
        prepared.sheetPath
        ??
        null,

      animationSheetPath:
        prepared.sheetPath
        ??
        null,

      portraitPath:
        safeStatic,

      tokenPath:
        prepared.portraitPath
        ??
        safeStatic
    };
  }

  const response =
    await fetch(entry.sheet);

  if (!response.ok) {
    throw new Error(
      `Falha baixando ${entry.name}: HTTP ${response.status}`
    );
  }

  const sheetBlob =
    await response.blob();

  const animation =
    cleanAnimation(
      entry.animation
    );

  const uploadedSheetPath =
    await uploadBlob(
      sheetBlob,
      safeFilename(
        isPokemon
          ? "pokemon-sheet"
          : "person-sheet",
        entry,
        entry.sheet
      )
    );

  const sheetPath =
    uploadedSheetPath
    ??
    entry.sheet
    ??
    null;

  const animationSheetPath =
    animation
      ? uploadedSheetPath
      : null;

  let tokenPath =
    animation
      ? null
      : sheetPath;

  if (animation) {
    const tokenBlob =
      await createOverworldFrameBlob(
        sheetBlob,
        entry
      );

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
        );
    }
  }

  let portraitPath =
    null;

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
      );
  }

  if (!animation) {
    tokenPath =
      tokenPath
      ??
      portraitPath
      ??
      SAFE_STATIC_FALLBACK;

    portraitPath =
      portraitPath
      ??
      tokenPath
      ??
      SAFE_STATIC_FALLBACK;
  }
  else {
    const safeStatic =
      tokenPath
      ??
      portraitPath
      ??
      SAFE_STATIC_FALLBACK;

    tokenPath =
      safeStatic;

    portraitPath =
      portraitPath
      ??
      safeStatic;
  }

  return {
    sheetPath,
    animationSheetPath,
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
    animationSheetPath,
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
      10,

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

  if (
    animation
    &&
    isUsableDylanSheetPath(
      animationSheetPath
    )
  ) {
    prototypeFlags[
      DYLAN_ID
    ] = {
      ...animation,

      spritesheet:
        true,

      sheetsrc:
        animationSheetPath
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

        system: {
          editMode:
            false
        },

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

  /*
   * Foundry normalmente honra folder no create. O update é um segundo gate
   * deliberado para instalações em que o create chegou a devolver o Actor na
   * raiz (bug observado no teste do v0.8.1).
   */
  if (folderId) {
    const actualFolderId =
      actor.folder?.id
      ?? actor.folder
      ?? null;

    if (actualFolderId !== folderId) {
      await actor.update({
        folder:
          folderId
      });
    }
  }

  return actor;
}


async function repairPlacedActorTokens(
  actor,
  entry,
  current,
  definition
) {
  const dylanFlags =
    definition.prototypeFlags?.[
      DYLAN_ID
    ]
    ??
    null;

  for (
    const scene
    of game.scenes ?? []
  ) {
    const updates = [];

    for (
      const token
      of scene.tokens ?? []
    ) {
      if (
        token.actorId
          !== actor.id
      ) {
        continue;
      }

      if (
        !tokenNeedsAssetRepair(
          token,
          current,
          entry,
          definition
        )
      ) {
        continue;
      }

      const update = {
        _id:
          token.id,

        "texture.src":
          definition.tokenPath,

        [`flags.${MODULE_ID}`]:
          definition.moduleFlags
      };

      if (dylanFlags) {
        update[
          `flags.${DYLAN_ID}`
        ] =
          dylanFlags;
      }
      else {
        update[
          `flags.-=${DYLAN_ID}`
        ] =
          null;
      }

      updates.push(update);
    }

    if (!updates.length) {
      continue;
    }

    try {
      await scene.updateEmbeddedDocuments(
        "Token",
        updates
      );
    }
    catch (error) {
      console.warn(
        `Pokemon LITM Tools | Não foi possível reparar tokens antigos de ${actor.name} em ${scene.name}.`,
        error
      );
    }
  }
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
    !actorNeedsAssetRepair(
      actor,
      current
    )
  ) {
    return actor;
  }

  const definition =
    await prepareActorDefinition(
      entry
    );

  const dylanFlags =
    definition.prototypeFlags?.[
      DYLAN_ID
    ]
    ??
    null;

  const update = {
    img:
      definition.portraitPath,

    "prototypeToken.texture.src":
      definition.tokenPath,

    "prototypeToken.texture.scaleX":
      definition.visualScale,

    "prototypeToken.texture.scaleY":
      definition.visualScale,

    "prototypeToken.lockRotation":
      true,

    [`prototypeToken.flags.${MODULE_ID}`]:
      definition.moduleFlags,

    [`flags.${MODULE_ID}`]:
      definition.moduleFlags
  };

  if (dylanFlags) {
    update[
      `prototypeToken.flags.${DYLAN_ID}`
    ] =
      dylanFlags;
  }
  else {
    update[
      `prototypeToken.flags.-=${DYLAN_ID}`
    ] =
      null;
  }

  await actor.update(update);

  await repairPlacedActorTokens(
    actor,
    entry,
    current,
    definition
  );

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
  entry,
  resolveFolderForNew = null,
  {
    forceNew = false
  } = {}
) {
  const existing =
    forceNew
      ? null
      : game.actors.find(
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

  const folderId =
    resolveFolderForNew
      ? await resolveFolderForNew()
      : rememberedActorFolderId();

  return createActorFromEntry(
    entry,
    folderId
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

async function getOrCreateSceneActorFolder(
  scene
) {
  const sceneName =
    String(
      scene?.name
      ??
      ""
    )
      .trim();

  if (!sceneName) {
    return null;
  }

  const existing =
    game.folders.find(
      folder =>
        folder.type === "Actor"
        &&
        folder.name === sceneName
    );

  if (existing) {
    return existing.id;
  }

  try {
    const folder =
      await Folder.create({
        name:
          sceneName,

        type:
          "Actor"
      });

    return (
      folder?.id
      ??
      null
    );
  }
  catch (error) {
    warnImporterOnce(
      `scene-folder-failed:${scene?.id ?? sceneName}`,
      `Não foi possível criar a pasta de Actors da Scene “${sceneName}”. O Actor será importado na raiz.`,
      error
    );

    return null;
  }
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

  const catalogEntry =
    findCatalogEntry(
      catalog,
      category,
      id
    );

  if (!catalogEntry) {
    throw new Error(
      `Asset nao encontrado: ${category}:${id}`
    );
  }

  const requestedName =
    String(
      data.nameOverride
      ??
      ""
    )
      .trim();

  const entry =
    requestedName
      ? {
          ...catalogEntry,
          name:
            requestedName
        }
      : catalogEntry;

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

  const forceNew =
    isGenericPersonEntry(
      catalogEntry
    )
    &&
    (
      data.forceNew === true
      ||
      data.forceNew === "true"
      ||
      !!requestedName
    );

  const scene =
    canvas.scene;

  const actor =
    await getOrCreateActorForEntry(
      entry,
      () =>
        getOrCreateSceneActorFolder(
          scene
        ),
      {
        forceNew
      }
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
/* BIBLIOTECA DE CHALLENGES                                  */
/* --------------------------------------------------------- */

function actorFolderId(document) {
  const folder = document?.folder ?? null;
  return typeof folder === "string"
    ? folder
    : folder?.id ?? null;
}

function folderParentId(folder) {
  const parent =
    folder?.folder
    ?? folder?.parent
    ?? null;

  return typeof parent === "string"
    ? parent
    : parent?.id ?? null;
}

/*
 * mist-engine-fvtt/module/data/actor-npc.mjs defines roles: string[] and
 * limits: { name: string, value: string, consequence: string }[].
 * Keep textual values (including "-" or infinity) exactly as on the sheet.
 * https://github.com/MrTheBino/mist-engine-fvtt/blob/main/module/data/actor-npc.mjs
 */
export function challengeLibraryDetails(actor) {
  const system = actor?.system ?? {};
  const roles = Array.isArray(system.roles)
    ? system.roles
    : typeof system.roles === "string"
      ? system.roles.split(",")
      : [];
  const rolesLabel = roles
    .filter(role => typeof role === "string")
    .map(role => role.trim())
    .filter(Boolean)
    .join(" · ");
  const limitsLabel = (Array.isArray(system.limits) ? system.limits : [])
    .map(limit => {
      const name = String(limit?.name ?? "").trim();
      const value = String(limit?.value ?? "").trim();
      return name ? [name, value].filter(Boolean).join(" ") : "";
    })
    .filter(Boolean)
    .join(" · ");

  return { rolesLabel, limitsLabel };
}

export function challengeLibraryData() {
  const folders =
    Array.from(game.folders ?? [])
      .filter(folder => folder?.type === "Actor");

  const candidates =
    folders.filter(
      folder =>
        ["challenge", "challenges"].includes(
          String(folder?.name ?? "")
            .trim()
            .toLocaleLowerCase()
        )
    );

  const topLevelRoots =
    candidates.filter(
      folder =>
        !folderParentId(folder)
    );

  const activeRoots =
    topLevelRoots.length
      ? topLevelRoots
      : candidates;

  if (!activeRoots.length) {
    return {
      rootMissing: true,
      items: [],
      folders: []
    };
  }

  const root =
    activeRoots[0];

  const rootIds =
    new Set(
      activeRoots.map(
        folder => folder.id
      )
    );

  const allowed =
    new Set(rootIds);

  /*
   * Resolve subpastas sem depender de profundidade fixa.
   * O limite evita loop caso exista uma referência de pasta corrompida.
   */
  for (let pass = 0; pass <= folders.length; pass++) {
    let changed = false;

    for (const folder of folders) {
      if (
        allowed.has(folder.id)
        || !allowed.has(folderParentId(folder))
      ) {
        continue;
      }

      allowed.add(folder.id);
      changed = true;
    }

    if (!changed) break;
  }

  const byId =
    new Map(
      folders.map(folder => [folder.id, folder])
    );

  function pathFor(folderId) {
    const names = [];
    let current = byId.get(folderId) ?? null;
    const seen = new Set();

    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      names.unshift(String(current.name ?? ""));
      if (rootIds.has(current.id)) break;
      current = byId.get(folderParentId(current)) ?? null;
    }

    return names.filter(Boolean).join(" / ");
  }

  const folderRows =
    folders
      .filter(folder => allowed.has(folder.id))
      .map(folder => ({
        id: folder.id,
        name: folder.name,
        path: pathFor(folder.id)
      }))
      .sort((a, b) =>
        a.path.localeCompare(
          b.path,
          undefined,
          { numeric: true, sensitivity: "base" }
        )
      );

  const items =
    Array.from(game.actors ?? [])
      .filter(actor =>
        actor?.type === "litm-npc"
        && allowed.has(actorFolderId(actor))
      )
      .map(actor => {
        const folderId = actorFolderId(actor);
        const folderPath = pathFor(folderId);
        const details = challengeLibraryDetails(actor);

        return {
          actorId: actor.id,
          uuid: actor.uuid,
          name: actor.name,
          img: actor.img,
          folderId,
          folderPath,
          ...details,
          search:
            [actor.name, details.rolesLabel, details.limitsLabel, folderPath]
              .filter(Boolean)
              .join(" ")
              .toLocaleLowerCase()
        };
      })
      .sort((a, b) =>
        a.name.localeCompare(
          b.name,
          undefined,
          { numeric: true, sensitivity: "base" }
        )
      );

  return {
    rootMissing: false,
    rootId: root.id,
    items,
    folders: folderRows
  };
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
        1100,

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


  trainerNames =
    new Map();

  trainerNameIndexes =
    new Map();

  previewZoomed =
    true;

  async _prepareContext(options) {
    const context =
      await super._prepareContext(options);

    const challengeLibrary =
      challengeLibraryData();

    if (
      this.activeTab
      ===
      "challenges"
    ) {
      const items =
        challengeLibrary.items;

      return {
        ...context,

        items,

        itemCount:
          items.length,

        selectedCount:
          0,

        previewZoomed:
          this.previewZoomed,

        peopleCount:
          catalogCache?.people?.length
          ?? 0,

        pokemonCount:
          catalogCache?.pokemon?.length
          ?? 0,

        propsCount:
          catalogCache?.props?.length
          ?? 0,

        challengeCount:
          items.length,

        challengeFolders:
          challengeLibrary.folders,

        challengeRootMissing:
          challengeLibrary.rootMissing,

        isPeople:
          false,

        isPokemon:
          false,

        isProps:
          false,

        isChallenges:
          true,

        dylanActive:
          false,

        catalogError:
          null
      };
    }

    try {
      const [catalog] = await Promise.all([
        loadCatalog(),
        this.activeTab === "people" ? loadTrainerNamePools() : null
      ]);

      const items =
        (catalog[this.activeTab] ?? [])
          .map(entry => ({
            ...entry,

            displayName:
              this.activeTab === "people"
                ? formatPokemonAssetLabel(entry.name)
                : entry.name,

            pokedexUrl:
              this.activeTab === "pokemon"
                ? getPokemonDbUrl(entry)
                : null,

            checked:
              this.selected.has(
                `${entry.category}:${entry.id}`
              ),

            gender:
              this.activeTab === "people"
                ? inferPersonGender(entry)
                : "unknown",

            canChooseTrainerName:
              this.activeTab === "people"
              &&
              isGenericPersonEntry(
                entry
              ),

            trainerName:
              this.activeTab === "people"
              &&
              isGenericPersonEntry(
                entry
              )
                ? (
                    this.trainerNames.get(
                      entry.id
                    )
                    ??
                    trainerNameAt(
                      entry,
                      this.trainerNameIndexes.get(entry.id)
                      ?? 0
                    )
                  )
                : entry.name,

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

        challengeCount:
          challengeLibrary.items.length,

        challengeFolders:
          [],

        challengeRootMissing:
          false,

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

        isChallenges:
          false,

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

        challengeCount:
          challengeLibrary.items.length,

        challengeFolders:
          [],

        challengeRootMissing:
          false,

        isPeople:
          this.activeTab === "people",

        isPokemon:
          this.activeTab === "pokemon",

        isProps:
          this.activeTab === "props",

        isChallenges:
          false,

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

    const challengeFolder =
      this.element.querySelector(
        "[data-role='challenge-folder']"
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

        const wantedFolder =
          challengeFolder?.value
          ??
          "all";

        let visible = 0;

        for (
          const card
          of this.element
            .querySelectorAll(
              "[data-asset-card], [data-challenge-card]"
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

          const cardFolder =
            card.dataset.folderId
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

          const folderOK =
            wantedFolder === "all"
            ||
            cardFolder === wantedFolder;

          const show =
            searchOK
            &&
            typeOK
            &&
            folderOK;

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

    challengeFolder?.addEventListener(
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
              prepareActorDefinition,
              { autoSceneFolder: true }
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


    /* POKEMON THEME BUILDER */

    for (
      const button
      of this.element.querySelectorAll(
        "[data-pokemon-theme-builder]"
      )
    ) {
      button.addEventListener(
        "click",
        async event => {
          event.preventDefault();
          event.stopPropagation();

          const id = button.dataset.pokemonThemeBuilder;
          if (!id) return;

          const oldHTML = button.innerHTML;
          button.disabled = true;
          button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Tema';

          try {
            const catalog = await loadCatalog();
            const entry = catalog.pokemon.find(item => item.id === id);
            if (!entry) throw new Error("Pokemon nao encontrado no catalogo.");

            await openPokemonTrainerThemeBuilder(
              entry,
              prepareActorDefinition
            );
          } catch (error) {
            console.error("Pokemon LITM Tools | Theme Builder:", error);
            ui.notifications.error(error?.message ?? "Falha ao criar Tema Pokémon.");
          } finally {
            if (button?.isConnected) {
              button.disabled = false;
              button.innerHTML = oldHTML;
            }
          }
        }
      );
    }


    /* NOMES DE TRAINER CLASS */

    for (
      const input
      of this.element.querySelectorAll(
        "[data-trainer-name]"
      )
    ) {
      input.addEventListener(
        "pointerdown",
        event =>
          event.stopPropagation()
      );

      input.addEventListener(
        "input",
        () => {
          const id =
            input.dataset.trainerName;

          if (!id) return;

          this.trainerNames.set(
            id,
            input.value
          );
        }
      );
    }

    for (
      const button
      of this.element.querySelectorAll(
        "[data-next-trainer-name]"
      )
    ) {
      button.addEventListener(
        "click",
        event => {
          event.preventDefault();
          event.stopPropagation();

          const card =
            button.closest(
              "[data-asset-card]"
            );

          const id =
            button.dataset.nextTrainerName;

          const input =
            card?.querySelector(
              "[data-trainer-name]"
            );

          if (
            !card
            ||
            !id
            ||
            !input
          ) {
            return;
          }

          const entry = {
            id,
            category:
              "people",
            personType:
              card.dataset.personType
              ?? "trainer-class",
            gender:
              card.dataset.gender
              ?? "unknown",
            name:
              card.dataset.entryName
              ?? ""
          };

          const { index: nextIndex, name } = nextTrainerNameChoice(
            entry,
            this.trainerNameIndexes.get(id) ?? 0,
            input.value
          );

          this.trainerNameIndexes.set(
            id,
            nextIndex
          );

          this.trainerNames.set(
            id,
            name
          );

          input.value =
            name;
        }
      );
    }


    /* BIBLIOTECA DE CHALLENGES */

    for (
      const button
      of this.element.querySelectorAll(
        "[data-open-challenge]"
      )
    ) {
      button.addEventListener(
        "click",
        event => {
          event.preventDefault();
          event.stopPropagation();

          const actor =
            game.actors.get(
              button.dataset.openChallenge
            );

          actor?.sheet?.render?.(
            true
          );
        }
      );
    }

    for (
      const card
      of this.element.querySelectorAll(
        "[data-challenge-card]"
      )
    ) {
      card.draggable =
        true;

      for (
        const image
        of card.querySelectorAll("img")
      ) {
        image.draggable =
          false;
      }

      card.addEventListener(
        "dragstart",
        event => {
          const transfer =
            event.dataTransfer;

          const uuid =
            card.dataset.challengeUuid;

          if (!transfer || !uuid) {
            event.preventDefault();
            return;
          }

          transfer.effectAllowed =
            "copy";

          const payload =
            JSON.stringify({
              type:
                "Actor",

              uuid
            });

          transfer.setData(
            "text/plain",
            payload
          );

          transfer.setData(
            "application/json",
            payload
          );

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

          const nameInput =
            card.querySelector(
              "[data-trainer-name]"
            );

          const nameOverride =
            String(
              nameInput?.value
              ??
              ""
            )
              .trim();

          const dragPayload =
            JSON.stringify({
              type: POKEMON_IMPORTER_DRAG_TYPE,
              moduleId: MODULE_ID,
              category,
              id,

              nameOverride:
                nameOverride
                || null,

              forceNew:
                !!nameInput
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

              const selectedTrainerName =
                isGenericPersonEntry(
                  entry
                )
                  ? String(
                      this.trainerNames.get(
                        entry.id
                      )
                      ??
                      trainerNameAt(
                        entry,
                        this.trainerNameIndexes.get(
                          entry.id
                        )
                        ?? 0
                      )
                    ).trim()
                  : "";

              await createActorFromEntry(
                selectedTrainerName
                  ? {
                      ...entry,
                      name:
                        selectedTrainerName
                    }
                  : entry,
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
