import {
  preparePokemonActorDefinition
} from "./importer-app.js";

import {
  getPokemonDbUrl
} from "./pokemon-links.js";

const MODULE_ID = "pokemon-litm-tools";
const REFERENCE_FOLDER = "Pokemon - Referencias";

const DREAM_START =
  "<!-- pokemon-litm-dream-team:start -->";

const DREAM_END =
  "<!-- pokemon-litm-dream-team:end -->";


function buildThemeSystem() {
  return {
    type: "litm-variable",
    color: "litm-variable",
    quest: "",
    story: "",
    tabCategory: "main",
    powertags: [],
    weaknesstags: [],
    options: {
      isStoryTheme: false
    }
  };
}


async function getReferenceFolder() {
  let folder =
    game.folders.find(
      f =>
        f.type === "Item" &&
        f.name === REFERENCE_FOLDER
    );

  if (folder) return folder;

  return Folder.create({
    name: REFERENCE_FOLDER,
    type: "Item"
  });
}


export async function createPokemonTeamThemes(
  actor,
  entries
) {
  if (!actor) {
    throw new Error(
      "Trainer Actor nao informado."
    );
  }

  const prepared = [];

  for (const entry of entries) {
    const definition =
      await preparePokemonActorDefinition(entry);

    prepared.push({
      entry,
      definition
    });
  }

  if (!prepared.length) {
    return [];
  }

  const data =
    prepared.map(
      ({ entry, definition }, index) => ({
        name: entry.name,
        type: "themebook",
        img: definition.portraitPath,

        system:
          buildThemeSystem(),

        flags: {
          [MODULE_ID]: {
            ...definition.moduleFlags,

            pokemonTheme: true,
            pokemonTeamSlot: index,
            themeRole: "pokemon",
            pokemonInstanceId:
              foundry.utils.randomID(16),

            pokedexUrl:
              getPokemonDbUrl(entry)
          }
        }
      })
    );

  const created =
    await actor.createEmbeddedDocuments(
      "Item",
      data
    );

  return created;
}


export async function ensurePokemonReferenceTheme(
  entry,
  sourceTheme = null
) {
  const existing =
    game.items.find(
      item =>
        item.type === "themebook" &&
        item.getFlag(
          MODULE_ID,
          "pokemonReference"
        ) === true &&
        item.getFlag(
          MODULE_ID,
          "assetId"
        ) === entry.id
    );

  if (existing) {
    return existing;
  }

  let img =
    sourceTheme?.img ?? null;

  let moduleFlags =
    foundry.utils.deepClone(
      sourceTheme?.flags?.[MODULE_ID] ??
      {}
    );

  if (!img) {
    const definition =
      await preparePokemonActorDefinition(entry);

    img =
      definition.portraitPath;

    moduleFlags =
      definition.moduleFlags;
  }

  const folder =
    await getReferenceFolder();

  const item =
    await Item.create({
      name: entry.name,
      type: "themebook",
      img,

      folder:
        folder?.id ?? null,

      ownership: {
        default:
          CONST
            .DOCUMENT_OWNERSHIP_LEVELS
            .OBSERVER
      },

      system:
        buildThemeSystem(),

      flags: {
        [MODULE_ID]: {
          ...moduleFlags,

          assetId: entry.id,
          pokemonTheme: true,
          pokemonReference: true,
          themeRole: "pokemon-reference",

          pokedexUrl:
            getPokemonDbUrl(entry)
        }
      }
    });

  if (!item) {
    throw new Error(
      "Theme de referencia nao criado."
    );
  }

  return item;
}


export async function savePokemonDreamTeam(
  actor,
  entries
) {
  const clean =
    entries.filter(Boolean);

  const references = [];

  for (const entry of clean) {
    const ownedTheme =
      actor.items.find(
        item =>
          item.type === "themebook" &&
          item.getFlag(
            MODULE_ID,
            "pokemonTheme"
          ) === true &&
          item.getFlag(
            MODULE_ID,
            "assetId"
          ) === entry.id
      ) ?? null;

    const reference =
      await ensurePokemonReferenceTheme(
        entry,
        ownedTheme
      );

    references.push(reference);
  }

  await actor.setFlag(
    MODULE_ID,
    "dreamPokemonIds",
    clean.map(
      entry => entry.id
    )
  );

  let biography =
    String(
      actor.system.biography ?? ""
    );

  const start =
    biography.indexOf(DREAM_START);

  const end =
    biography.indexOf(DREAM_END);

  if (
    start >= 0 &&
    end >= start
  ) {
    biography =
      (
        biography.slice(0, start) +
        biography.slice(
          end + DREAM_END.length
        )
      ).trim();
  }

  if (references.length) {
    const links =
      references
        .map(
          item =>
            `@UUID[${item.uuid}]{${item.name}}`
        )
        .join(" &middot; ");

    const block =
      `${DREAM_START}
<h2>Time dos Sonhos</h2>
<p>${links}</p>
${DREAM_END}`;

    biography =
      biography
        ? `${biography}

${block}`
        : block;
  }

  await actor.update({
    "system.biography":
      biography
  });

  return references;
}
