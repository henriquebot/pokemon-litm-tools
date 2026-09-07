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


function validProfileDraft(draft) {
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


function normalizePokemonMoves(rows) {
  return (
    Array.isArray(rows)
      ? rows
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

        priority:
          Number(
            move.priority
            ?? 0
          ),

        target:
          cleanText(
            move.target
          ),

        description:
          cleanText(
            move.description
          ),

        pokemonDbUrl:
          cleanText(
            move.pokemonDbUrl
          ),

        vfx:
          cleanText(
            move.vfx
            ||
            (
              String(
                move.type
                || "normal"
              )
              + "-move"
            )
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
}


function pokemonMoveDisplayName(move) {
  const local = cleanText(move?.name || move?.id || "Golpe");
  const english = cleanText(move?.englishName);

  if (
    !english
    || local.localeCompare(
      english,
      undefined,
      { sensitivity: "base" }
    ) === 0
    || local.endsWith("(" + english + ")")
  ) {
    return local;
  }

  return local + " (" + english + ")";
}


function profileThemeData(
  draft,
  index,
  archetypeId
) {
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
      (
        "Tema "
        + (index + 1)
      ),

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
          "character-profile",

        pokemonMoveBindings:
          []
      }
    }
  };
}


function pokemonNatureTheme(
  profile,
  archetypeId
) {
  const nature =
    profile?.nature
    ?? {};

  const ability =
    profile?.ability
    ?? {};

  const natureLabel =
    cleanText(
      nature.label
    );

  const raisedLabel =
    cleanText(
      nature.raisedLabel
    );

  const loweredLabel =
    cleanText(
      nature.loweredLabel
    );

  const abilityName =
    cleanText(
      ability.name
    );

  const powerNames = [
    natureLabel
      ? "Natureza: " + natureLabel
      : "Natureza a definir",

    raisedLabel
      ? raisedLabel + " favorecido"
      : "Natureza equilibrada",

    abilityName
      ? "Habilidade: " + abilityName
      : "Habilidade a definir"
  ];

  const weakness =
    loweredLabel
      ? loweredLabel
        + " prejudicado pela Natureza"
      : (
          cleanText(
            profile?.weaknessTag
          )
          ||
          "Ponto fraco a descobrir"
        );

  const story =
    [
      cleanText(
        nature.effect
      ),
      cleanText(
        ability.description
      )
    ]
      .filter(Boolean)
      .join("\n");

  return {
    name:
      "Natureza & Habilidade",

    type:
      "themebook",

    system: {
      type:
        "litm-variable",

      color:
        "litm-variable",

      quest:
        "Como minha Natureza e Habilidade definem meu jeito de agir?",

      story,

      tabCategory:
        "main",

      powertags:
        powerNames.map(
          buildTag
        ),

      weaknesstags: [
        buildTag(
          weakness
        )
      ],

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
          2,

        archetypeId,

        themeRole:
          "pokemon-nature-ability",

        pokemonNature:
          foundry.utils.deepClone(
            nature
          ),

        pokemonAbility:
          foundry.utils.deepClone(
            ability
          ),

        pokemonMoveBindings:
          []
      }
    }
  };
}


function pokemonMovesTheme(
  moves,
  archetypeId,
  profile = {}
) {
  const speciesName =
    cleanText(
      profile?.species
      || "Pokémon"
    )
    || "Pokémon";

  const speciesTag =
    "Espécie: " + speciesName;

  const moveTagNames =
    moves.length
      ? moves.map(
          move =>
            pokemonMoveDisplayName(
              move
            )
        )
      : [
          "Golpes a definir"
        ];

  const powerTags =
    [
      speciesTag,
      ...moveTagNames
    ].map(buildTag);

  const uniqueTypes =
    new Set(
      moves
        .map(
          move =>
            cleanText(
              move.type
            )
        )
        .filter(Boolean)
    );

  const weakness =
    !moves.length
      ? "Golpes ainda não definidos"
      : (
          moves.length > 1
          && uniqueTypes.size === 1
        )
          ? "Cobertura de tipos limitada"
          : "Repertório limitado aos golpes conhecidos";

  const bindings =
    moves.map(
      (
        move,
        index
      ) => ({
        tagIndex:
          index + 1,

        tagName:
          pokemonMoveDisplayName(
            move
          ),

        englishName:
          move.englishName,

        pokemonDbUrl:
          move.pokemonDbUrl,

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
    );

  const story =
    moves
      .map(
        move =>
          move.name
          + (
              move.description
                ? ": "
                  + move.description
                : ""
            )
      )
      .join("\n");

  return {
    name:
      "Golpes",

    type:
      "themebook",

    system: {
      type:
        "litm-variable",

      color:
        "litm-variable",

      quest:
        "Que novas técnicas vou dominar?",

      story,

      tabCategory:
        "main",

      powertags:
        powerTags,

      weaknesstags: [
        buildTag(
          weakness
        )
      ],

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
          3,

        archetypeId,

        themeRole:
          "pokemon-moves",

        pokemonSpecies:
          speciesName,

        moves:
          foundry.utils.deepClone(
            moves
          ),

        pokemonMoveBindings:
          bindings
      }
    }
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
    !Array.isArray(
      drafts
    )
  ) {
    return [];
  }

  const pokemonMode =
    options?.pokemonMode
    === true;

  const expectedDrafts =
    pokemonMode
      ? 2
      : 4;

  const validDrafts =
    drafts.length
      === expectedDrafts
    &&
    drafts.every(
      validProfileDraft
    );

  if (!validDrafts) {
    throw new Error(
      pokemonMode
        ? "Os 2 Temas de Perfil precisam ter nome, 3 Tags de Poder, 1 Tag de Fraqueza e Quest."
        : "Os 4 Temas precisam ter nome, 3 Tags de Poder, 1 Tag de Fraqueza e Quest."
    );
  }

  const pokemonMoves =
    normalizePokemonMoves(
      options?.pokemonMoves
    );

  const data =
    drafts.map(
      (
        draft,
        index
      ) =>
        profileThemeData(
          draft,
          index,
          archetypeId
        )
    );

  if (pokemonMode) {
    data.push(
      pokemonNatureTheme(
        options?.pokemonProfile,
        archetypeId
      )
    );

    data.push(
      pokemonMovesTheme(
        pokemonMoves,
        archetypeId,
        options?.pokemonProfile
      )
    );
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

  if (pokemonMode) {
    await actor.setFlag(
      MODULE_ID,
      "characterPokemonProfile",
      foundry.utils.deepClone(
        options?.pokemonProfile
        ?? null
      )
    );

    await actor.setFlag(
      MODULE_ID,
      "characterPokemonMoves",
      pokemonMoves
    );
  }

  return created;
}
