import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const pokemonRoot = path.resolve(process.argv[2] ?? "");
const hgssRoot = path.resolve(process.argv[3] ?? "");

if (!pokemonRoot || !hgssRoot) {
  throw new Error(
    "Usage: node tools/build-catalog.mjs <pokemon-assets-root> <gen1recomp-mods-root>"
  );
}

const IMG_EXT = new Set([
  ".png",
  ".webp",
  ".jpg",
  ".jpeg"
]);

const toPosix = value =>
  value.split(path.sep).join("/");

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const out = [];

  for (
    const entry
    of await fs.readdir(dir, { withFileTypes: true })
  ) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      out.push(...await walk(full));
    }

    else if (
      entry.isFile() &&
      IMG_EXT.has(
        path.extname(entry.name).toLowerCase()
      )
    ) {
      out.push(full);
    }
  }

  return out.sort((a, b) =>
    a.localeCompare(
      b,
      undefined,
      {
        numeric: true,
        sensitivity: "base"
      }
    )
  );
}

function niceName(value) {
  return value
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(
      /\b\w/g,
      c => c.toUpperCase()
    );
}

function rawUrl(
  root,
  file,
  repo,
  branch
) {
  const rel =
    toPosix(
      path.relative(root, file)
    );

  const encoded =
    rel
      .split("/")
      .map(encodeURIComponent)
      .join("/");

  return (
    `https://raw.githubusercontent.com/` +
    `${repo}/${branch}/${encoded}`
  );
}

function pokemonRaw(file) {
  return rawUrl(
    pokemonRoot,
    file,
    "righthandofvecna/pokemon-assets",
    "main"
  );
}

function hgssRaw(file) {
  return rawUrl(
    hgssRoot,
    file,
    "LucianoNeo/gen1recomp-mods",
    "master"
  );
}

function modulePath(file) {
  return (
    "modules/pokemon-assets/" +
    toPosix(
      path.relative(
        pokemonRoot,
        file
      )
    )
  );
}

async function pngDimensions(file) {
  if (
    path.extname(file).toLowerCase()
    !== ".png"
  ) {
    return null;
  }

  const handle =
    await fs.open(file, "r");

  try {
    const buffer =
      Buffer.alloc(24);

    const { bytesRead } =
      await handle.read(
        buffer,
        0,
        24,
        0
      );

    if (
      bytesRead < 24 ||
      buffer.toString("ascii", 1, 4)
        !== "PNG"
    ) {
      return null;
    }

    return {
      width:
        buffer.readUInt32BE(16),

      height:
        buffer.readUInt32BE(20)
    };

  } finally {
    await handle.close();
  }
}


/* --------------------------------------------------------- */
/* SPRITESHEET MAP DO POKEMON-ASSETS                         */
/* --------------------------------------------------------- */

const originalMap =
  path.join(
    pokemonRoot,
    "data",
    "spritesheetmap.js"
  );

const tempMap =
  path.join(
    os.tmpdir(),
    `pokemon-spritesheetmap-${Date.now()}.mjs`
  );

await fs.copyFile(
  originalMap,
  tempMap
);

const {
  default: sheetMap
} =
  await import(
    `${
      pathToFileURL(tempMap).href
    }?v=${Date.now()}`
  );

await fs.unlink(tempMap)
  .catch(() => {});

function resolveSettings(src) {
  const direct =
    sheetMap[src];

  if (direct) {
    return structuredClone(direct);
  }

  for (
    const [key, value]
    of Object.entries(sheetMap)
  ) {
    if (
      !src.startsWith(key) ||
      !value?.images
    ) {
      continue;
    }

    const {
      images,
      ...flags
    } = value;

    const subimage =
      images[
        src.substring(key.length)
      ];

    if (subimage) {
      return {
        ...structuredClone(subimage),
        ...structuredClone(flags)
      };
    }
  }

  return null;
}

async function trainerFallbackSettings(file) {
  const dim =
    await pngDimensions(file);

  if (
    !dim?.width ||
    !dim?.height
  ) {
    return null;
  }

  if (
    dim.width * 4
    ===
    dim.height * 3
  ) {
    return {
      sheetstyle:
        "durlReduced",

      animationframes:
        3
    };
  }

  return null;
}


/* --------------------------------------------------------- */
/* CLASSIFICAÇÃO                                             */
/* --------------------------------------------------------- */

const PERSON_LABELS = {
  "trainer-class":
    "Trainer Class",

  npc:
    "NPC",

  named:
    "Personagem",

  player:
    "Protagonista",

  rival:
    "Rival",

  professor:
    "Professor",

  "gym-leader":
    "Líder de Ginásio",

  "elite-four":
    "Elite Four",

  villain:
    "Vilão"
};

const NPC_HINT =
  /child|clerk|guard|nurse|girl|boy|man|woman|mom|mother|worker|waiter|cook|granny|gramps|receptionist|president|guide|captain|officer|police|merchant|shop|scientist|doctor|maid|old|little|gate|sailor npc/i;

function classifyPokemonPerson(
  stem,
  group
) {
  if (
    String(group)
      .toLowerCase()
      .includes("named")
  ) {
    return "named";
  }

  if (
    NPC_HINT.test(stem)
  ) {
    return "npc";
  }

  return "trainer-class";
}


/* --------------------------------------------------------- */
/* PASTAS                                                    */
/* --------------------------------------------------------- */

const trainerRoot =
  path.join(
    pokemonRoot,
    "img",
    "trainers-overworld"
  );

const portraitRoot =
  path.join(
    pokemonRoot,
    "img",
    "trainers-profile"
  );

const pokemonOverworldRoot =
  path.join(
    pokemonRoot,
    "img",
    "pmd-overworld"
  );

const propRoot =
  path.join(
    pokemonRoot,
    "img",
    "items-overworld"
  );

const hgssSpriteRoot =
  path.join(
    hgssRoot,
    "hgss_sprites",
    "overrides",
    "sprites"
  );

for (
  const required
  of [
    trainerRoot,
    portraitRoot,
    pokemonOverworldRoot,
    propRoot,
    originalMap,
    hgssSpriteRoot
  ]
) {
  if (
    !await exists(required)
  ) {
    throw new Error(
      `Missing source path: ${required}`
    );
  }
}


/* --------------------------------------------------------- */
/* PORTRAITS POKEMON-ASSETS                                  */
/* --------------------------------------------------------- */

const portraitFiles =
  await walk(portraitRoot);

const portraitsByRelative =
  new Map();

const portraitsByStem =
  new Map();

for (
  const file
  of portraitFiles
) {
  const rel =
    toPosix(
      path.relative(
        portraitRoot,
        file
      )
    )
      .replace(/\.[^.]+$/, "")
      .toLowerCase();

  const stem =
    path.basename(
      file,
      path.extname(file)
    )
      .toLowerCase();

  if (
    !portraitsByRelative.has(rel)
  ) {
    portraitsByRelative.set(
      rel,
      file
    );
  }

  if (
    !portraitsByStem.has(stem)
  ) {
    portraitsByStem.set(
      stem,
      file
    );
  }
}


/* --------------------------------------------------------- */
/* PESSOAS - POKEMON-ASSETS                                  */
/* --------------------------------------------------------- */

const people = [];

for (
  const file
  of await walk(trainerRoot)
) {
  const relative =
    toPosix(
      path.relative(
        trainerRoot,
        file
      )
    );

  const relativeNoExt =
    relative
      .replace(/\.[^.]+$/, "")
      .toLowerCase();

  const stem =
    path.basename(
      file,
      path.extname(file)
    );

  if (
    /^blank/i.test(stem)
  ) {
    continue;
  }

  const portrait =
    portraitsByRelative.get(
      relativeNoExt
    )
    ??
    portraitsByStem.get(
      stem.toLowerCase()
    )
    ??
    null;

  const dirname =
    toPosix(
      path.dirname(relative)
    );

  const group =
    dirname === "."
      ? ""
      : dirname;

  const animation =
    resolveSettings(
      modulePath(file)
    )
    ??
    await trainerFallbackSettings(file);

  const name =
    niceName(stem);

  const id =
    relative
      .replace(/\.[^.]+$/, "")
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        "-"
      )
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

  const personType =
    classifyPokemonPerson(
      stem,
      group
    );

  people.push({
    id:
      `pa-${id}`,

    category:
      "people",

    name,

    search:
      `${name} ${group} ${PERSON_LABELS[personType]} pokemon assets`
        .trim()
        .toLowerCase(),

    group,

    personType,

    personTypeLabel:
      PERSON_LABELS[personType],

    provider:
      "pokemon-assets",

    providerLabel:
      "Pokémon Assets",

    sheet:
      pokemonRaw(file),

    sheetLayout:
      null,

    portrait:
      portrait
        ? pokemonRaw(portrait)
        : null,

    preview:
      portrait
        ? pokemonRaw(portrait)
        : pokemonRaw(file),

    previewMode:
      "normal",

    animation,

    animationKnown:
      !!animation
  });
}


/* --------------------------------------------------------- */
/* PERSONAGENS HGSS                                          */
/* --------------------------------------------------------- */

const HGSS_PEOPLE = [

  ["red", "Red", "player"],
  ["ash", "Ash", "player"],
  ["ethan", "Ethan", "player"],
  ["lyra", "Lyra", "player"],
  ["leaf", "Leaf", "player"],
  ["brendan", "Brendan", "player"],

  ["blue", "Blue", "rival"],

  ["oak", "Professor Oak", "professor"],

  ["bill", "Bill", "named"],
  ["daisy", "Daisy Oak", "named"],
  ["mr_fuji", "Mr. Fuji", "named"],
  ["mom", "Mom", "named"],

  ["gym_brock", "Brock", "gym-leader"],
  ["gym_misty", "Misty", "gym-leader"],
  ["gym_lt_surge", "Lt. Surge", "gym-leader"],
  ["gym_erika", "Erika", "gym-leader"],
  ["gym_koga", "Koga", "gym-leader"],
  ["gym_sabrina", "Sabrina", "gym-leader"],
  ["gym_blaine", "Blaine", "gym-leader"],
  ["gym_giovanni", "Giovanni", "gym-leader"],

  ["lorelei", "Lorelei", "elite-four"],
  ["bruno", "Bruno", "elite-four"],
  ["agatha", "Agatha", "elite-four"],
  ["lance", "Lance", "elite-four"],

  ["jessie", "Jessie", "villain"],
  ["james", "James", "villain"],
  ["giovanni", "Giovanni - Team Rocket", "villain"],

  ["officer_jenny", "Officer Jenny", "npc"]
];

let hgssCount = 0;

for (
  const [
    stem,
    name,
    personType
  ]
  of HGSS_PEOPLE
) {
  const file =
    path.join(
      hgssSpriteRoot,
      `${stem}.png`
    );

  if (
    !await exists(file)
  ) {
    console.warn(
      `HGSS person not found: ${stem}`
    );

    continue;
  }

  const sheet =
    hgssRaw(file);

  people.push({
    id:
      `hgss-${stem}`,

    category:
      "people",

    name,

    search:
      `${name} ${PERSON_LABELS[personType]} hgss heartgold soulsilver`
        .toLowerCase(),

    group:
      "HGSS",

    personType,

    personTypeLabel:
      PERSON_LABELS[personType],

    provider:
      "hgss-sprites",

    providerLabel:
      "HGSS Sprites",

    sheet,

    /*
     * Gen1Recomp:
     * 0 stand down
     * 1 stand up
     * 2 stand left
     * 3 walk down
     * 4 walk up
     * 5 walk left
     *
     * O importador converte isso para
     * DURL Reduced em runtime.
     */
    sheetLayout:
      "gen1Vertical6",

    portrait:
      null,

    preview:
      sheet,

    previewMode:
      "vertical6",

    animation: {
      sheetstyle:
        "durlReduced",

      animationframes:
        3
    },

    animationKnown:
      true
  });

  hgssCount++;
}


/* --------------------------------------------------------- */
/* NOMES DOS POKEMON                                         */
/* --------------------------------------------------------- */

async function englishSpeciesNames() {
  const result =
    new Map();

  try {
    const response =
      await fetch(
        "https://raw.githubusercontent.com/" +
        "PokeAPI/pokeapi/master/" +
        "data/v2/csv/pokemon_species.csv"
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const text =
      await response.text();

    for (
      const line
      of text
        .split(/\r?\n/)
        .slice(1)
    ) {
      if (!line) continue;

      const [
        id,
        identifier
      ] =
        line.split(",");

      const dex =
        Number(id);

      if (
        !Number.isInteger(dex) ||
        !identifier
      ) {
        continue;
      }

      result.set(
        dex,
        niceName(identifier)
      );
    }

  } catch (error) {
    console.warn(
      "PokeAPI names unavailable:",
      error.message
    );
  }

  return result;
}


/* --------------------------------------------------------- */
/* POKEMON                                                   */
/* --------------------------------------------------------- */

const names =
  await englishSpeciesNames();

const pokemon = [];

for (
  let dex = 1;
  dex <= 251;
  dex++
) {
  const dexString =
    String(dex).padStart(4, "0");

  const f1 =
    `${Math.trunc(dex / 100)}`
      .padStart(2, "0")
    +
    "XX";

  const f2 =
    `${Math.trunc(dex / 10)}`
      .padStart(3, "0")
    +
    "X";

  const file =
    path.join(
      pokemonOverworldRoot,
      f1,
      f2,
      `${dexString}.png`
    );

  if (
    !await exists(file)
  ) {
    continue;
  }

  const animation =
    resolveSettings(
      modulePath(file)
    );

  const name =
    names.get(dex)
    ??
    `Pokémon #${String(dex).padStart(3, "0")}`;

  const portrait =
    "https://raw.githubusercontent.com/" +
    "PokeAPI/sprites/master/" +
    `sprites/pokemon/${dex}.png`;

  pokemon.push({
    id:
      `pokemon-${dexString}`,

    category:
      "pokemon",

    pokemonId:
      dex,

    dex,

    species:
      name,

    name,

    search:
      `${name} ${dex} ${dexString}`
        .toLowerCase(),

    provider:
      "pokemon-assets",

    providerLabel:
      "Pokémon Assets",

    sheet:
      pokemonRaw(file),

    portrait,

    preview:
      portrait,

    animation,

    animationKnown:
      !!animation
  });
}


/* --------------------------------------------------------- */
/* PROPS                                                     */
/* --------------------------------------------------------- */

const props = [];

for (
  const file
  of await walk(propRoot)
) {
  const relative =
    toPosix(
      path.relative(
        propRoot,
        file
      )
    );

  const stem =
    path.basename(
      file,
      path.extname(file)
    );

  const dirname =
    toPosix(
      path.dirname(relative)
    );

  const group =
    dirname === "."
      ? ""
      : dirname;

  const name =
    niceName(stem);

  const cleanId =
    relative
      .replace(/\.[^.]+$/, "")
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        "-"
      )
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

  props.push({
    id:
      `prop-${cleanId}`,

    category:
      "props",

    name,

    search:
      `${name} ${group}`
        .trim()
        .toLowerCase(),

    group,

    provider:
      "pokemon-assets",

    providerLabel:
      "Pokémon Assets",

    image:
      pokemonRaw(file),

    preview:
      pokemonRaw(file)
  });
}


/* --------------------------------------------------------- */
/* VALIDAÇÃO                                                 */
/* --------------------------------------------------------- */

if (
  people.length < 100
) {
  throw new Error(
    `Only ${people.length} people.`
  );
}

if (
  hgssCount < 15
) {
  throw new Error(
    `Only ${hgssCount} HGSS named people found.`
  );
}

if (
  pokemon.length < 200
) {
  throw new Error(
    `Only ${pokemon.length} Pokémon.`
  );
}

if (
  props.length < 1
) {
  throw new Error(
    "No props."
  );
}

const output = {
  schemaVersion:
    3,

  generatedAt:
    new Date().toISOString(),

  sources: [
    {
      id:
        "pokemon-assets",

      repository:
        "righthandofvecna/pokemon-assets"
    },

    {
      id:
        "hgss-sprites",

      repository:
        "LucianoNeo/gen1recomp-mods"
    }
  ],

  people,
  pokemon,
  props
};

await fs.mkdir(
  "data",
  { recursive: true }
);

await fs.writeFile(
  "data/catalog.json",

  JSON.stringify(
    output,
    null,
    2
  )
  +
  "\n",

  "utf8"
);

console.log(
  `Catalog: ` +
  `${people.length} people ` +
  `(${hgssCount} HGSS named), ` +
  `${pokemon.length} Pokémon, ` +
  `${props.length} props.`
);
