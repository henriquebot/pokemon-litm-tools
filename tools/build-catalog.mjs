import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2] ?? "");

if (!root) {
  throw new Error(
    "Usage: node tools/build-catalog.mjs <pokemon-assets-root>"
  );
}

const IMG_EXT =
  new Set([
    ".png",
    ".webp",
    ".jpg",
    ".jpeg"
  ]);

const toPosix =
  value =>
    value
      .split(path.sep)
      .join("/");


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
    of await fs.readdir(
      dir,
      {
        withFileTypes: true
      }
    )
  ) {
    const full =
      path.join(
        dir,
        entry.name
      );

    if (entry.isDirectory()) {
      out.push(
        ...await walk(full)
      );
    }

    else if (
      entry.isFile()
      &&
      IMG_EXT.has(
        path
          .extname(entry.name)
          .toLowerCase()
      )
    ) {
      out.push(full);
    }
  }

  return out.sort(
    (a, b) =>
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
    .replace(
      /\.[^.]+$/,
      ""
    )
    .replace(
      /[_-]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .replace(
      /\b\w/g,
      c =>
        c.toUpperCase()
    );
}


function rawUrl(file) {
  const rel =
    toPosix(
      path.relative(
        root,
        file
      )
    );

  const encoded =
    rel
      .split("/")
      .map(encodeURIComponent)
      .join("/");

  return (
    "https://raw.githubusercontent.com/" +
    "righthandofvecna/pokemon-assets/" +
    "main/" +
    encoded
  );
}


function modulePath(file) {
  return (
    "modules/pokemon-assets/" +
    toPosix(
      path.relative(
        root,
        file
      )
    )
  );
}


async function pngDimensions(file) {
  if (
    path
      .extname(file)
      .toLowerCase()
    !== ".png"
  ) {
    return null;
  }

  const handle =
    await fs.open(
      file,
      "r"
    );

  try {
    const buffer =
      Buffer.alloc(24);

    const {
      bytesRead
    } =
      await handle.read(
        buffer,
        0,
        24,
        0
      );

    if (
      bytesRead < 24
      ||
      buffer.toString(
        "ascii",
        1,
        4
      ) !== "PNG"
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


/*
 * Importamos diretamente o mapa de configurações
 * utilizado pelo Pokémon Assets.
 */

const originalMap =
  path.join(
    root,
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
      pathToFileURL(
        tempMap
      ).href
    }?v=${Date.now()}`
  );

await fs.unlink(
  tempMap
).catch(
  () => {}
);


function resolveSettings(src) {
  const direct =
    sheetMap[src];

  if (direct) {
    return structuredClone(
      direct
    );
  }

  for (
    const [
      key,
      value
    ]
    of Object.entries(
      sheetMap
    )
  ) {
    if (
      !src.startsWith(key)
      ||
      !value?.images
    ) {
      continue;
    }

    const {
      images,
      ...flags
    } =
      value;

    const subimage =
      images[
        src.substring(
          key.length
        )
      ];

    if (subimage) {
      return {
        ...structuredClone(
          subimage
        ),

        ...structuredClone(
          flags
        )
      };
    }
  }

  return null;
}


/*
 * Único fallback que consideramos seguro:
 * 3 colunas x 4 linhas com células quadradas.
 *
 * É exatamente o layout reduzido Gen4.
 *
 * Qualquer outra coisa fica estática até
 * termos metadados confiáveis.
 */

async function trainerFallbackSettings(
  file
) {
  const dim =
    await pngDimensions(
      file
    );

  if (
    !dim?.width
    ||
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
        !Number.isInteger(dex)
        ||
        !identifier
      ) {
        continue;
      }

      result.set(
        dex,
        niceName(
          identifier
        )
      );
    }

  } catch (error) {
    console.warn(
      "PokeAPI names unavailable; " +
      "using dex labels.",
      error.message
    );
  }

  return result;
}


const trainerRoot =
  path.join(
    root,
    "img",
    "trainers-overworld"
  );

const portraitRoot =
  path.join(
    root,
    "img",
    "trainers-profile"
  );

const pokemonRoot =
  path.join(
    root,
    "img",
    "pmd-overworld"
  );

const propRoot =
  path.join(
    root,
    "img",
    "items-overworld"
  );


for (
  const required
  of [
    trainerRoot,
    portraitRoot,
    pokemonRoot,
    propRoot,
    originalMap
  ]
) {
  if (
    !await exists(
      required
    )
  ) {
    throw new Error(
      `Missing source path: ${required}`
    );
  }
}


/* --------------------------------------------------------- */
/* PESSOAS                                                   */
/* --------------------------------------------------------- */

const portraitFiles =
  await walk(
    portraitRoot
  );

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
      .replace(
        /\.[^.]+$/,
        ""
      )
      .toLowerCase();

  const stem =
    path.basename(
      file,
      path.extname(file)
    )
      .toLowerCase();

  if (
    !portraitsByRelative.has(
      rel
    )
  ) {
    portraitsByRelative.set(
      rel,
      file
    );
  }

  if (
    !portraitsByStem.has(
      stem
    )
  ) {
    portraitsByStem.set(
      stem,
      file
    );
  }
}


const people = [];


for (
  const file
  of await walk(
    trainerRoot
  )
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
      .replace(
        /\.[^.]+$/,
        ""
      )
      .toLowerCase();

  const stem =
    path.basename(
      file,
      path.extname(file)
    );

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
      path.dirname(
        relative
      )
    );

  const group =
    dirname === "."
      ? ""
      : dirname;

  const src =
    modulePath(file);

  const animation =
    resolveSettings(src)
    ??
    await trainerFallbackSettings(
      file
    );

  const name =
    niceName(stem);

  const id =
    relative
      .replace(
        /\.[^.]+$/,
        ""
      )
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        "-"
      )
      .replace(
        /-+/g,
        "-"
      )
      .replace(
        /^-|-$/g,
        ""
      )
      .toLowerCase();


  people.push({
    id,

    category:
      "people",

    name,

    search:
      `${name} ${group}`
        .trim()
        .toLowerCase(),

    group,

    sheet:
      rawUrl(file),

    portrait:
      portrait
        ? rawUrl(portrait)
        : null,

    preview:
      portrait
        ? rawUrl(portrait)
        : rawUrl(file),

    animation,

    animationKnown:
      !!animation
  });
}


/* --------------------------------------------------------- */
/* POKÉMON — KANTO + JOHTO                                  */
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
    String(dex)
      .padStart(
        4,
        "0"
      );

  const f1 =
    `${Math.trunc(dex / 100)}`
      .padStart(
        2,
        "0"
      )
    +
    "XX";

  const f2 =
    `${Math.trunc(dex / 10)}`
      .padStart(
        3,
        "0"
      )
    +
    "X";

  const file =
    path.join(
      pokemonRoot,
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
    `Pokémon #${
      String(dex)
        .padStart(
          3,
          "0"
        )
    }`;

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

    sheet:
      rawUrl(file),

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
  of await walk(
    propRoot
  )
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
      path.dirname(
        relative
      )
    );

  const group =
    dirname === "."
      ? ""
      : dirname;

  const name =
    niceName(stem);

  const cleanId =
    relative
      .replace(
        /\.[^.]+$/,
        ""
      )
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        "-"
      )
      .replace(
        /-+/g,
        "-"
      )
      .replace(
        /^-|-$/g,
        ""
      )
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

    image:
      rawUrl(file),

    preview:
      rawUrl(file)
  });
}


/* --------------------------------------------------------- */
/* VALIDAÇÃO                                                 */
/* --------------------------------------------------------- */

if (
  people.length < 100
) {
  throw new Error(
    `Catalog validation: only ${people.length} people.`
  );
}

if (
  pokemon.length < 200
) {
  throw new Error(
    `Catalog validation: only ${pokemon.length} Pokémon.`
  );
}

if (
  props.length < 1
) {
  throw new Error(
    "Catalog validation: no props."
  );
}


const output = {
  schemaVersion:
    2,

  generatedAt:
    new Date()
      .toISOString(),

  source: {
    repository:
      "righthandofvecna/pokemon-assets"
  },

  people,

  pokemon,

  props
};


await fs.mkdir(
  "data",
  {
    recursive: true
  }
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
  `Catalog: ${people.length} people, ` +
  `${pokemon.length} Pokémon, ` +
  `${props.length} props.`
);

console.log(
  "Animated metadata: " +
  `people ${
    people.filter(
      x => x.animationKnown
    ).length
  }/${people.length}, ` +
  `Pokémon ${
    pokemon.filter(
      x => x.animationKnown
    ).length
  }/${pokemon.length}.`
);
