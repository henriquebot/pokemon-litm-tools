const MODULE_ID = "pokemon-litm-tools";


function cleanText(value) {
  return String(
    value ?? ""
  ).trim();
}


function buildTag(name) {
  return {
    name:
      cleanText(name),

    question:
      "",

    burned:
      false,

    toBurn:
      false,

    planned:
      false,

    selected:
      false,

    expiring:
      false,

    expired:
      false
  };
}


export async function createCharacterThemes(
  actor,
  drafts,
  archetypeId = null
) {
  if (
    !actor
    ||
    !Array.isArray(drafts)
  ) {
    return [];
  }

  const validDrafts =
    drafts.length === 4
    &&
    drafts.every(
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
          !!cleanText(
            draft?.name
          )
          &&
          powerTags.length === 3
          &&
          powerTags.every(
            tag =>
              !!cleanText(tag)
          )
          &&
          weaknessTags.length === 1
          &&
          !!cleanText(
            weaknessTags[0]
          )
          &&
          !!cleanText(
            draft?.quest
          )
        );
      }
    );

  if (!validDrafts) {
    throw new Error(
      "Os 4 Temas precisam ter nome, 3 Tags de Poder, 1 Tag de Fraqueza e Quest."
    );
  }


  const data =
    drafts
      .map(
        (draft, index) => {
          const powerTags =
            (
              Array.isArray(
                draft?.powerTags
              )
                ? draft.powerTags
                : []
            )
              .map(cleanText)
              .filter(Boolean)
              .map(buildTag);

          const weaknessTags =
            (
              Array.isArray(
                draft?.weaknessTags
              )
                ? draft.weaknessTags
                : []
            )
              .map(cleanText)
              .filter(Boolean)
              .map(buildTag);

          return {
            name:
              cleanText(
                draft?.name
              )
              ||
              `Tema ${index + 1}`,

            type:
              "themebook",

            system: {
              type:
                "litm-variable",

              color:
                "litm-variable",

              quest:
                cleanText(
                  draft?.quest
                ),

              story:
                "",

              tabCategory:
                "main",

              powertags:
                powerTags,

              weaknesstags:
                weaknessTags,

              options: {
                isStoryTheme:
                  false
              }
            },

            flags: {
              [MODULE_ID]: {
                characterTheme:
                  true,

                characterThemeSlot:
                  index,

                archetypeId,

                themeRole:
                  "character"
              }
            }
          };
        }
      );

  if (!data.length) {
    return [];
  }

  const created =
    await actor.createEmbeddedDocuments(
      "Item",
      data
    );

  await actor.setFlag(
    MODULE_ID,
    "characterArchetypeId",
    archetypeId
  );

  return created;
}
