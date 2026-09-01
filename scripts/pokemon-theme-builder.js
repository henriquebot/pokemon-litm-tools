import {
  preparePokemonActorDefinition
} from "./importer-app.js";

const MODULE_ID = "pokemon-litm-tools";


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
      await preparePokemonActorDefinition(
        entry
      );

    prepared.push({
      entry,
      definition
    });
  }

  if (!prepared.length) {
    await actor.unsetFlag(
      MODULE_ID,
      "activePokemonThemeId"
    );

    return [];
  }

  const data =
    prepared.map(
      (
        {
          entry,
          definition
        },
        index
      ) => ({
        name:
          entry.name,

        type:
          "themebook",

        img:
          definition.portraitPath,

        system: {
          type:
            "litm-variable",

          color:
            "litm-variable",

          quest:
            "",

          story:
            "",

          tabCategory:
            "main",

          powertags:
            [],

          weaknesstags:
            [],

          options: {
            isStoryTheme:
              false
          }
        },

        flags: {
          [MODULE_ID]: {
            ...definition.moduleFlags,

            pokemonTheme:
              true,

            pokemonTeamSlot:
              index,

            themeRole:
              "pokemon"
          }
        }
      })
    );

  const created =
    await actor.createEmbeddedDocuments(
      "Item",
      data
    );

  if (created?.[0]) {
    await actor.setFlag(
      MODULE_ID,
      "activePokemonThemeId",
      created[0].id
    );
  }

  return created;
}
