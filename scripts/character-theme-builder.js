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
  archetypeId = null,
  options = {}
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


  const pokemonMoves =
    (
      Array.isArray(
        options?.pokemonMoves
      )
        ? options.pokemonMoves
        : []
    )
      .filter(
        move =>
          move?.id
          &&
          move?.name
      )
      .slice(0, 4)
      .map(
        move => ({
          id:
            cleanText(move.id),

          name:
            cleanText(move.name),

          englishName:
            cleanText(
              move.englishName
            ),

          type:
            cleanText(
              move.type
              || "normal"
            ),

          damageClass:
            cleanText(
              move.damageClass
            ),

          power:
            Number(
              move.power ?? 0
            ),

          accuracy:
            move.accuracy
            ?? null,

          target:
            cleanText(
              move.target
            ),

          description:
            cleanText(
              move.description
            ),

          vfx:
            cleanText(
              move.vfx
              ||
              `${move.type || "normal"}-move`
            ),

          effects:
            foundry.utils.deepClone(
              Array.isArray(
                move.effects
              )
                ? move.effects
                : []
            )
        })
      );


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

          const movePowerTags =
            index === 0
              ? pokemonMoves.map(
                  move =>
                    buildTag(
                      move.name
                    )
                )
              : [];

          const pokemonMoveBindings =
            index === 0
              ? pokemonMoves.map(
                  (
                    move,
                    moveIndex
                  ) => ({
                    tagIndex:
                      powerTags.length
                      + moveIndex,

                    tagName:
                      move.name,

                    kind:
                      "pokemonMove",

                    moveId:
                      move.id,

                    type:
                      move.type,

                    vfx:
                      move.vfx,

                    effects:
                      foundry.utils.deepClone(
                        move.effects
                      )
                  })
                )
              : [];

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

              powertags: [
                ...powerTags,
                ...movePowerTags
              ],

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
                  "character",

                pokemonMoveBindings:
                  pokemonMoveBindings
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

  await actor.setFlag(
    MODULE_ID,
    "characterPokemonMoves",
    pokemonMoves
  );

  return created;
}
