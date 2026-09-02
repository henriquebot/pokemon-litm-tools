import { getPokemonDbUrl } from "./pokemon-links.js";

import {
  getPokemonContentLanguage,
  typeLabel,
  statLabel,
  natureProfile,
  moveLabel,
  abilityLabel,
  fetchPokeJson,
  choosePrimaryAbility,
  buildDexText,
  statPowerText,
  statWeaknessText,
  typeDefenseGroups,
  buildMoveThreat,
  formatThemeDescription
} from "./pokemon-content.js";

const MODULE_ID = "pokemon-litm-tools";
const PC_FLAG = "pokemonPC";

const TYPE_PT = {
  normal: "Normal", fire: "Fogo", water: "Água", electric: "Elétrico",
  grass: "Planta", ice: "Gelo", fighting: "Lutador", poison: "Venenoso",
  ground: "Terrestre", flying: "Voador", psychic: "Psíquico", bug: "Inseto",
  rock: "Pedra", ghost: "Fantasma", dragon: "Dragão", dark: "Sombrio",
  steel: "Aço", fairy: "Fada"
};

const STAT_TEXT = {
  hp: { power: "Resistência impressionante", weakness: "Pouca resistência" },
  attack: { power: "Força física impressionante", weakness: "Pouca força física" },
  defense: { power: "Defesa resistente", weakness: "Frágil a impactos" },
  "special-attack": { power: "Poder especial excepcional", weakness: "Poder especial limitado" },
  "special-defense": { power: "Grande resistência especial", weakness: "Vulnerável a ataques especiais" },
  speed: { power: "Veloz como um raio", weakness: "Lento para reagir" }
};

const MIGHT = {
  origin: { label: "Origin", maxLevel: 20 },
  adventure: { label: "Adventure", maxLevel: 45 },
  greatness: { label: "Greatness", maxLevel: 100 }
};

const POKEMON_NATURES = [
  ["hardy","Resistente","Cansado","Determinado"],
  ["lonely","Solitário","Isolado","Apegado"],
  ["adamant","Adamante","Frustrado","Obstinado"],
  ["naughty","Travesso","Repreendido","Desafiador"],
  ["brave","Corajoso","Assustado","Destemido"],
  ["bold","Audacioso","Intimidado","Confiante"],
  ["docile","Dócil","Pressionado","Convencido"],
  ["impish","Travesso (Impish)","Repreendido","Brincalhão"],
  ["lax","Relaxado (Lax)","Distraído","Despreocupado"],
  ["relaxed","Relaxado","Apressado","Tranquilo"],
  ["modest","Modesto","Exposto","Confiante"],
  ["mild","Leve","Abalado","Gentil"],
  ["bashful","Tímido (Bashful)","Envergonhado","À vontade"],
  ["rash","Erupção cutânea","Cauteloso","Impetuoso"],
  ["quiet","Silencioso","Perturbado","Concentrado"],
  ["calm","Calma","Agitado","Sereno"],
  ["gentle","Gentil","Hostilizado","Amigável"],
  ["careful","Cuidado","Surpreendido","Cauteloso"],
  ["quirky","Peculiar","Confuso","Imprevisível"],
  ["sassy","Atrevido","Contrariado","Desafiador"],
  ["timid","Tímido","Assustado","Convencido"],
  ["hasty","Apressado","Preso","Impaciente"],
  ["jolly","Alegre","Desanimado","Animado"],
  ["naive","Ingênuo","Enganado","Confiante"],
  ["serious","Sério","Desconcertado","Determinado"]
].map(([id,label,low,high]) => ({id,label,low,high}));

const NATURE_BY_STATS = {
  attack: {
    attack:"hardy", defense:"lonely", "special-attack":"adamant", "special-defense":"naughty", speed:"brave"
  },
  defense: {
    attack:"bold", defense:"docile", "special-attack":"impish", "special-defense":"lax", speed:"relaxed"
  },
  "special-attack": {
    attack:"modest", defense:"mild", "special-attack":"bashful", "special-defense":"rash", speed:"quiet"
  },
  "special-defense": {
    attack:"calm", defense:"gentle", "special-attack":"careful", "special-defense":"quirky", speed:"sassy"
  },
  speed: {
    attack:"timid", defense:"hasty", "special-attack":"jolly", "special-defense":"naive", speed:"serious"
  }
};

function pokemonNature(id) {
  return POKEMON_NATURES.find(n => n.id === id) ?? POKEMON_NATURES[0];
}

function defaultNatureForStats(stats) {
  const names = ["attack","defense","special-attack","special-defense","speed"];
  const rows = names.map(name => ({name, value:Number(stats?.[name] ?? 0)}));
  const best = rows.reduce((a,b) => b.value > a.value ? b : a, rows[0]);
  const worst = rows.reduce((a,b) => b.value < a.value ? b : a, rows[0]);
  return pokemonNature(NATURE_BY_STATS[best.name]?.[worst.name] ?? "hardy");
}

function flavorText(entries) {
  for (const code of ["pt-BR","pt","en"]) {
    const found = entries?.find(row => row.language?.name === code);
    if (found?.flavor_text) {
      return String(found.flavor_text).replace(/[\n\f]+/g," ").replace(/\s+/g," ").trim();
    }
  }
  return "";
}

function englishEffect(entries) {
  const found = entries?.find(row => row.language?.name === "en");
  return String(found?.short_effect ?? found?.effect ?? "")
    .replace(/\$effect_chance/g,"chance")
    .replace(/\s+/g," ")
    .trim();
}

const apiCache = new Map();

function randomId() {
  return foundry.utils.randomID(16);
}

function escapeHTML(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

function titleCase(value) {
  return String(value ?? "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function localizedName(names, fallback) {
  for (const code of ["pt-BR", "pt", "en"]) {
    const found = names?.find(row => row.language?.name === code);
    if (found?.name) return found.name;
  }
  return titleCase(fallback);
}

async function fetchJson(url) {
  if (!apiCache.has(url)) {
    apiCache.set(url, (async () => {
      const response = await fetch(url, { cache: "force-cache" });
      if (!response.ok) throw new Error(`PokéAPI HTTP ${response.status}`);
      return response.json();
    })());
  }
  return apiCache.get(url);
}

function levelForMove(move) {
  const levels = (move.version_group_details ?? [])
    .filter(row => row.move_learn_method?.name === "level-up")
    .map(row => Number(row.level_learned_at ?? 0))
    .filter(Number.isFinite);
  if (!levels.length) return null;
  const positive = levels.filter(level => level > 0);
  return positive.length ? Math.min(...positive) : 1;
}

function loadPokemonBuildData(entry, might) {
  const language = getPokemonContentLanguage();
  const pokemonId = Number(entry.pokemonId ?? entry.dex);

  if (!Number.isInteger(pokemonId) || pokemonId < 1) {
    throw new Error("Pokémon sem número de Pokédex válido.");
  }

  return Promise.all([
    fetchPokeJson(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`),
    fetchPokeJson(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId}`)
  ]).then(async ([pokemon, species]) => {
    const types = (pokemon.types ?? [])
      .slice()
      .sort((a, b) => Number(a.slot) - Number(b.slot))
      .map(row => row.type?.name)
      .filter(Boolean);

    const stats = {};
    for (const row of pokemon.stats ?? []) {
      if (row.stat?.name) stats[row.stat.name] = Number(row.base_stat ?? 0);
    }

    const abilityEntry = choosePrimaryAbility(pokemon);
    let ability = null;

    if (abilityEntry?.ability?.url) {
      try {
        const detail = await fetchPokeJson(abilityEntry.ability.url);
        ability = {
          id: detail.name,
          name: abilityLabel(detail.name, detail.names, language),
          hidden: !!abilityEntry.is_hidden
        };
      } catch (error) {
        console.warn("Pokemon LITM Tools | Ability:", abilityEntry.ability?.name, error);
        ability = {
          id: abilityEntry.ability?.name ?? "unknown",
          name: abilityLabel(abilityEntry.ability?.name ?? "unknown", [], language),
          hidden: !!abilityEntry.is_hidden
        };
      }
    }

    const dexText = buildDexText({ pokemon, species, types, ability }, language);

    const typeEffectiveness = {};
    for (const defendedType of types) {
      try {
        const detail = await fetchPokeJson(`https://pokeapi.co/api/v2/type/${defendedType}`);
        const relations = detail.damage_relations ?? {};

        for (const row of relations.double_damage_from ?? []) {
          typeEffectiveness[row.name] = Number(typeEffectiveness[row.name] ?? 1) * 2;
        }

        for (const row of relations.half_damage_from ?? []) {
          typeEffectiveness[row.name] = Number(typeEffectiveness[row.name] ?? 1) * 0.5;
        }

        for (const row of relations.no_damage_from ?? []) {
          typeEffectiveness[row.name] = 0;
        }
      } catch (error) {
        console.warn("Pokemon LITM Tools | Type effectiveness:", defendedType, error);
      }
    }

    function preferredLearnLevel(move) {
      const details = (move.version_group_details ?? [])
        .filter(row => row.move_learn_method?.name === "level-up");

      if (!details.length) return null;

      const preferredGroups = [
        "heartgold-soulsilver",
        "crystal",
        "gold-silver"
      ];

      for (const group of preferredGroups) {
        const rows = details.filter(row => row.version_group?.name === group);
        if (!rows.length) continue;
        const levels = rows.map(row => Number(row.level_learned_at ?? 0)).filter(Number.isFinite);
        const positive = levels.filter(level => level > 0);
        return positive.length ? Math.min(...positive) : 1;
      }

      const levels = details.map(row => Number(row.level_learned_at ?? 0)).filter(Number.isFinite);
      const positive = levels.filter(level => level > 0);
      return positive.length ? Math.min(...positive) : 1;
    }

    const candidates = [];
    for (const row of pokemon.moves ?? []) {
      const level = preferredLearnLevel(row);
      if (level === null) continue;
      candidates.push({
        id: row.move?.name,
        url: row.move?.url,
        level
      });
    }

    const maxLevel = MIGHT[might]?.maxLevel ?? 45;
    let pool = candidates
      .filter(move => move.level <= maxLevel)
      .sort((a, b) => b.level - a.level || String(a.id).localeCompare(String(b.id)));

    if (pool.length < 10) {
      const seen = new Set(pool.map(move => move.id));
      for (const move of candidates.slice().sort((a, b) => a.level - b.level)) {
        if (seen.has(move.id)) continue;
        pool.push(move);
        seen.add(move.id);
        if (pool.length >= 16) break;
      }
    }

    if (!pool.length) {
      pool = (pokemon.moves ?? []).slice(0, 16).map(row => ({
        id: row.move?.name,
        url: row.move?.url,
        level: 1
      }));
    }

    const details = await Promise.all(
      pool.slice(0, 18).map(async move => {
        if (!move.url) return null;

        try {
          const detail = await fetchPokeJson(move.url);
          const meta = detail.meta ?? {};

          return {
            id: detail.name,
            name: moveLabel(detail.name, detail.names, language),
            type: detail.type?.name ?? "normal",
            damageClass: detail.damage_class?.name ?? "status",
            power: Number(detail.power ?? 0),
            accuracy: Number(detail.accuracy ?? 0),
            level: move.level,
            target: detail.target?.name ?? "selected-pokemon",
            effectChance: Number(detail.effect_chance ?? 0),
            statChanges: (detail.stat_changes ?? []).map(change => ({
              change: Number(change.change ?? 0),
              stat: change.stat?.name ?? ""
            })).filter(change => !!change.stat),
            meta: {
              ailment: meta.ailment?.name ?? "none",
              ailmentChance: Number(meta.ailment_chance ?? 0),
              category: meta.category?.name ?? "",
              criticalRate: Number(meta.crit_rate ?? 0),
              drain: Number(meta.drain ?? 0),
              flinchChance: Number(meta.flinch_chance ?? 0),
              healing: Number(meta.healing ?? 0),
              minHits: Number(meta.min_hits ?? 0),
              maxHits: Number(meta.max_hits ?? 0),
              minTurns: Number(meta.min_turns ?? 0),
              maxTurns: Number(meta.max_turns ?? 0),
              statChance: Number(meta.stat_chance ?? 0)
            }
          };
        } catch (error) {
          console.warn("Pokemon LITM Tools | Move:", move.id, error);
          return null;
        }
      })
    );

    const ranked = details.filter(Boolean).sort((a, b) => {
      const score = move => {
        const stab = types.includes(move.type) ? 75 : 0;
        const usefulStatus = move.damageClass === "status" ? 45 : 0;
        const powerScore = Math.min(Number(move.power ?? 0), 150);
        const accuracyScore = Math.min(Number(move.accuracy || 80), 100) / 10;
        const levelScore = Number(move.level ?? 1) * (might === "origin" ? 0.15 : might === "greatness" ? 0.8 : 0.45);
        return stab + usefulStatus + powerScore + accuracyScore + levelScore;
      };

      return score(b) - score(a) || a.name.localeCompare(b.name, language);
    });

    const moves = [];
    const usedTypes = new Set();
    const usedClasses = new Set();

    for (const move of ranked) {
      if (moves.some(existing => existing.id === move.id)) continue;

      const diversity =
        !usedTypes.has(move.type)
        || !usedClasses.has(move.damageClass)
        || moves.length < 2;

      if (!diversity && moves.length < 3) continue;

      moves.push(move);
      usedTypes.add(move.type);
      usedClasses.add(move.damageClass);
      if (moves.length >= 4) break;
    }

    if (moves.length < 4) {
      for (const move of ranked) {
        if (moves.some(existing => existing.id === move.id)) continue;
        moves.push(move);
        if (moves.length >= 4) break;
      }
    }

    if (!moves.length) {
      throw new Error("Não encontrei golpes utilizáveis para este Pokémon.");
    }

    const statOrder = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];
    const statRows = statOrder.map(name => ({ name, value: Number(stats[name] ?? 0) }));
    const rankedStats = statRows.slice().sort((a, b) => b.value - a.value || statOrder.indexOf(a.name) - statOrder.indexOf(b.name));
    const best = rankedStats[0];

    /* HP pode ser força, mas nunca define a fraqueza de stat. */
    const weaknessRows = statRows.filter(row => row.name !== "hp");
    const weaknessOrder = statOrder.filter(name => name !== "hp");
    const worst = weaknessRows.reduce((a, b) => {
      if (b.value < a.value) return b;
      if (b.value === a.value && weaknessOrder.indexOf(b.name) > weaknessOrder.indexOf(a.name)) return b;
      return a;
    }, weaknessRows[0]);

    const completeMoves = (pokemon.moves ?? [])
      .map(row => {
        const methods = new Set((row.version_group_details ?? [])
          .map(detail => detail.move_learn_method?.name)
          .filter(Boolean));

        return {
          id: row.move?.name ?? "",
          name: moveLabel(row.move?.name ?? "", [], language),
          level: methods.has("level-up"),
          machine: methods.has("machine")
        };
      })
      .filter(move => !!move.id);

    return {
      pokemonId,
      contentLanguage: language,
      types,
      stats,
      typeEffectiveness,
      ability,
      moves,
      dexText,
      levelMoveNames: completeMoves.filter(move => move.level).map(move => move.name),
      machineMoveNames: completeMoves.filter(move => move.machine).map(move => move.name),
      best,
      worst,
      topStats: rankedStats.slice(0, 2),
      powerStatTag: statPowerText(best.name, language),
      weaknessTag: statWeaknessText(worst.name, language)
    };
  });
}

function trainerOptions() {
  return game.actors
    .filter(actor => actor.type === "litm-character" && (game.user.isGM || actor.isOwner))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function actorFolderOptions() {
  const remembered =
    String(
      game.settings.get(
        MODULE_ID,
        "lastActorFolder"
      )
      ?? ""
    );

  return game.folders
    .filter(
      folder =>
        folder.type === "Actor"
    )
    .sort(
      (a, b) =>
        a.name.localeCompare(
          b.name,
          "pt-BR"
        )
    )
    .map(folder => {
      const selected =
        folder.id === remembered
          ? "selected"
          : "";

      return (
        `<option value="${folder.id}" ${selected}>`
        +
        `${escapeHTML(folder.name)}</option>`
      );
    })
    .join("");
}


async function resolveChallengeFolder(
  config
) {
  let folderId =
    String(
      config.folderId
      ?? ""
    ).trim();

  const newFolder =
    String(
      config.newFolder
      ?? ""
    ).trim();

  if (newFolder) {
    const folder =
      await Folder.create({
        name:
          newFolder,

        type:
          "Actor"
      });

    if (!folder) {
      throw new Error(
        "Não foi possível criar a pasta."
      );
    }

    folderId =
      folder.id;
  }

  if (folderId) {
    const folder =
      game.folders.get(
        folderId
      );

    if (
      !folder ||
      folder.type !== "Actor"
    ) {
      throw new Error(
        "Pasta de Actors inválida."
      );
    }
  }

  await game.settings.set(
    MODULE_ID,
    "lastActorFolder",
    folderId
  );

  return folderId || null;
}


async function askBuildConfig(entry) {
  const modeResult = await foundry.applications.api.DialogV2.input({
    window: { title: `${entry.name} · Pokémon Builder` },
    content: `
      <div class="pokemon-builder-config">
        <div class="pokemon-builder-field">
          <label>Criar como</label>
          <select name="mode">
            <option value="challenge">Challenge / NPC</option>
            <option value="trainer">Adicionar a Treinador</option>
          </select>
        </div>
        <div class="pokemon-builder-field">
          <label>Might</label>
          <select name="might">
            <option value="origin">Origin</option>
            <option value="adventure" selected>Adventure</option>
            <option value="greatness">Greatness</option>
          </select>
        </div>
      </div>
    `,
    ok: { label:"Continuar", icon:"fa-solid fa-arrow-right" },
    modal:true
  });

  if (!modeResult) return null;

  const mode = String(modeResult.mode ?? "challenge");
  const might = String(modeResult.might ?? "adventure");

  if (mode === "challenge") {
    const folderChoices = actorFolderOptions();
    const remembered = String(game.settings.get(MODULE_ID,"lastActorFolder") ?? "");
    const rootSelected = remembered ? "" : "selected";

    const result = await foundry.applications.api.DialogV2.input({
      window: { title:`${entry.name} · Challenge` },
      content: `
        <div class="pokemon-builder-config">
          <div class="pokemon-builder-field">
            <label>Pasta de Actors</label>
            <select name="folderId">
              <option value="" ${rootSelected}>Raiz de Actors</option>
              ${folderChoices}
            </select>
          </div>
          <div class="pokemon-builder-field">
            <label>Ou criar nova pasta</label>
            <input type="text" name="newFolder" placeholder="Ex.: Pokémon Selvagens">
          </div>
        </div>
      `,
      ok: { label:"Gerar prévia", icon:"fa-solid fa-wand-magic-sparkles" },
      modal:true
    });

    if (!result) return null;

    return {
      mode,
      might,
      trainerId:"",
      destination:"",
      folderId:String(result.folderId ?? ""),
      newFolder:String(result.newFolder ?? "").trim()
    };
  }

  const options = trainerOptions()
    .map(actor => `<option value="${actor.id}">${escapeHTML(actor.name)}</option>`)
    .join("");

  const result = await foundry.applications.api.DialogV2.input({
    window: { title:`${entry.name} · Treinador` },
    content: `
      <div class="pokemon-builder-config">
        <div class="pokemon-builder-field">
          <label>Treinador</label>
          <select name="trainerId">
            <option value="">Escolha um treinador</option>
            ${options}
          </select>
        </div>
        <div class="pokemon-builder-field">
          <label>Destino</label>
          <select name="destination">
            <option value="team">Time</option>
            <option value="pc">PC</option>
          </select>
        </div>
      </div>
    `,
    ok: { label:"Gerar prévia", icon:"fa-solid fa-wand-magic-sparkles" },
    modal:true
  });

  if (!result) return null;
  const trainerId = String(result.trainerId ?? "");
  if (!trainerId) throw new Error("Escolha o treinador.");

  return {
    mode,
    might,
    trainerId,
    destination:String(result.destination ?? "team"),
    folderId:"",
    newFolder:""
  };
}


async function reviewBuild(entry, config, data) {
  const language = data.contentLanguage ?? getPokemonContentLanguage();
  const typeText = data.types.map(type => typeLabel(type, language)).join(" / ");
  const statText = Object.entries(data.stats)
    .map(([name, value]) => `${statLabel(name, language)} ${value}`)
    .join(" · ");

  const moveInputs = data.moves.map((move, index) => `
    <div class="pokemon-builder-review-move">
      <label>${escapeHTML(typeLabel(move.type, language))}</label>
      <input type="text" name="move${index}" value="${escapeHTML(move.name)}">
    </div>
  `).join("");

  const defaultNatureId = defaultNatureForStats(data.stats).id;
  const natureIds = [
    "hardy","lonely","adamant","naughty","brave",
    "bold","docile","impish","lax","relaxed",
    "modest","mild","bashful","rash","quiet",
    "calm","gentle","careful","quirky","sassy",
    "timid","hasty","jolly","naive","serious"
  ];

  const natureOptions = natureIds.map(id => {
    const nature = natureProfile(id, language);
    return `
      <option value="${id}" ${id === defaultNatureId ? "selected" : ""}>
        ${escapeHTML(nature.label)}
      </option>
    `;
  }).join("");

  const pokedexUrl = getPokemonDbUrl(entry);

  const result = await foundry.applications.api.DialogV2.input({
    window: { title: language === "en" ? `Review · ${entry.name}` : `Revisar · ${entry.name}` },
    content: `
      <div class="pokemon-builder-review">
        <div class="pokemon-builder-review-heading">
          <div>
            <strong>${escapeHTML(MIGHT[config.might]?.label ?? config.might)}</strong>
            · ${escapeHTML(typeText)}
          </div>
          <a class="pokemon-builder-pokedex-button"
             href="${escapeHTML(pokedexUrl)}"
             target="_blank"
             rel="noopener noreferrer">
            <i class="fa-solid fa-mobile-screen-button"></i>
            Pokédex
          </a>
        </div>

        <small>${escapeHTML(statText)}</small>
        <div class="pokemon-builder-divider"></div>
        ${moveInputs}

        <div class="pokemon-builder-review-move">
          <label>${language === "en" ? "Nature" : "Natureza"}</label>
          <select name="natureId">${natureOptions}</select>
        </div>

        <div class="pokemon-builder-review-move">
          <label>${language === "en" ? "Power Tag" : "Tag de Poder"}</label>
          <input type="text" name="powerStatTag" value="${escapeHTML(data.powerStatTag)}">
        </div>

        <div class="pokemon-builder-review-move">
          <label>${language === "en" ? "Weakness Tag" : "Tag de Fraqueza"}</label>
          <input type="text" name="weaknessTag" value="${escapeHTML(data.weaknessTag)}">
        </div>
      </div>
    `,
    ok: {
      label: language === "en" ? "Create Pokémon" : "Criar Pokémon",
      icon: "fa-solid fa-check"
    },
    modal: true
  });

  if (!result) return null;

  const nature = natureProfile(String(result.natureId ?? defaultNatureId), language);

  return {
    moveNames: data.moves.map((move, index) =>
      String(result[`move${index}`] ?? move.name).trim() || move.name
    ),
    powerStatTag: String(result.powerStatTag ?? data.powerStatTag).trim() || data.powerStatTag,
    weaknessTag: String(result.weaknessTag ?? data.weaknessTag).trim() || data.weaknessTag,
    natureId: nature.id,
    natureLabel: nature.label,
    natureLimits: nature.limits
  };
}

function powerTag(name) {
  return {
    name,
    question: "",
    burned: false,
    toBurn: false,
    planned: false,
    selected: false,
    expiring: false,
    expired: false
  };
}

function floatingTag(name, positive = true) {
  return {
    name,
    value: 0,
    isStatus: false,
    burned: false,
    toBurn: false,
    selected: false,
    positive,
    markings: [false, false, false, false, false, false],
    might: 0,
    mightIcon: ""
  };
}

function themeSystem(review, data) {
  const abilityTag = data.ability?.name ? [powerTag(data.ability.name)] : [];

  return {
    description: formatThemeDescription({ data, review }, data.contentLanguage),
    type: "litm-variable",
    color: "litm-variable",
    quest: "",
    story: "",
    tabCategory: "main",
    powertags: [
      ...review.moveNames.map(powerTag),
      powerTag(review.powerStatTag),
      powerTag(review.natureLabel),
      ...abilityTag
    ],
    weaknesstags: [powerTag(review.weaknessTag)],
    options: { isStoryTheme: false }
  };
}

function moduleMetadata(entry, definition, config, data, review, instanceId) {
  const defenses = typeDefenseGroups(data.typeEffectiveness, data.contentLanguage);

  return {
    ...foundry.utils.deepClone(definition.moduleFlags),
    pokemonBuilder: true,
    pokemonInstanceId: instanceId,
    contentLanguage: data.contentLanguage,
    nature: {
      id: review.natureId,
      label: review.natureLabel
    },
    ability: data.ability ? foundry.utils.deepClone(data.ability) : null,
    might: config.might,
    types: foundry.utils.deepClone(data.types),
    baseStats: foundry.utils.deepClone(data.stats),
    typeEffectiveness: foundry.utils.deepClone(data.typeEffectiveness),
    moves: data.moves.map((move, index) => ({
      id: move.id,
      name: review.moveNames[index],
      type: move.type,
      damageClass: move.damageClass,
      power: move.power,
      accuracy: move.accuracy,
      learnedAt: move.level,
      target: move.target,
      meta: foundry.utils.deepClone(move.meta ?? {}),
      statChanges: foundry.utils.deepClone(move.statChanges ?? [])
    })),
    tagBindings: data.moves.map((move, index) => ({
      tagIndex: index,
      tagName: review.moveNames[index],
      kind: "pokemonMove",
      moveId: move.id,
      type: move.type,
      vfx: `${move.type}-move`
    })),
    defenseBindings: defenses.map(defense => ({
      tagName: defense.name,
      kind: `pokemonTypeDefense:${defense.kind}`,
      positive: defense.positive,
      types: foundry.utils.deepClone(defense.types),
      multipliers: foundry.utils.deepClone(defense.multipliers)
    })),
    pokedexUrl: getPokemonDbUrl(entry)
  };
}

function prototypeToken(definition, flags) {
  const tokenFlags = foundry.utils.deepClone(definition.prototypeFlags ?? {});
  tokenFlags[MODULE_ID] = foundry.utils.deepClone(flags);
  return {
    name: flags.species ?? "Pokémon",
    width: 1,
    height: 1,
    texture: {
      src: definition.tokenPath,
      scaleX: definition.visualScale,
      scaleY: definition.visualScale
    },
    lockRotation: true,
    disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL,
    flags: tokenFlags
  };
}

function matchupText(effectiveness, predicate, language) {
  const values = Object.entries(effectiveness ?? {})
    .filter(([, value]) => predicate(Number(value)))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([type, value]) => `${typeLabel(type, language)} ×${Number(value)}`);

  return values.join(", ") || (language === "en" ? "None" : "Nenhuma");
}

function pokemonBiography(data, review) {
  const language = data.contentLanguage ?? getPokemonContentLanguage();
  const profile = formatThemeDescription({ data, review }, language);
  const levelMoves = (data.levelMoveNames ?? []).map(escapeHTML).join(", ") || (language === "en" ? "None listed." : "Nenhum listado.");
  const machines = (data.machineMoveNames ?? []).map(escapeHTML).join(", ") || (language === "en" ? "None listed." : "Nenhum listado.");

  return `
    ${profile}
    <h2>${language === "en" ? "Level-up moves" : "Golpes por nível"}</h2>
    <p>${levelMoves}</p>
    <h2>${language === "en" ? "TM / HM / Machines" : "TM / HM / Máquinas"}</h2>
    <p>${machines}</p>
  `;
}

function pokemonThreats(data, review, config) {
  return data.moves.map((move, index) => {
    const threat = buildMoveThreat(
      move,
      review.moveNames[index],
      config.might,
      data.contentLanguage
    );

    return {
      name: review.moveNames[index],
      description: threat.description,
      list: threat.list
    };
  });
}

async function createChallenge(entry, config, data, review, definition) {
  const language = data.contentLanguage ?? getPokemonContentLanguage();
  const instanceId = randomId();
  const flags = moduleMetadata(entry, definition, config, data, review, instanceId);
  const types = data.types.map(type => typeLabel(type, language));
  const defenses = typeDefenseGroups(data.typeEffectiveness, language);

  const mightyAspects = config.might === "origin" ? [] : [{
    level: config.might,
    aspect: language === "en" ? "Pokémon Power" : "Poder Pokémon",
    mightIcon: config.might
  }];

  const defeated = Number({ origin: 3, adventure: 4, greatness: 5 }[config.might] ?? 4);
  const natureLimits = Array.isArray(review.natureLimits) ? review.natureLimits : [];

  const limits = [
    {
      name: language === "en" ? "Defeated" : "Derrotado",
      value: String(defeated),
      consequence: language === "en" ? "Out of action" : "Fora de combate"
    },
    ...natureLimits.slice(0, 2).map((limit, index) => ({
      name: limit.name,
      value: String(index === 0 ? Math.max(2, defeated - 1) : Math.min(6, defeated + 1)),
      consequence: limit.consequence
    }))
  ];

  const resistances = matchupText(data.typeEffectiveness, value => value > 0 && value < 1, language);
  const weaknesses = matchupText(data.typeEffectiveness, value => value > 1, language);
  const immunities = matchupText(data.typeEffectiveness, value => value === 0, language);
  const folderId = await resolveChallengeFolder(config);

  const statTags = (data.topStats ?? [])
    .map(row => statPowerText(row.name, language))
    .filter(Boolean);

  const intrinsicTags = [
    ...statTags.map(name => floatingTag(name, true)),
    ...(data.ability?.name ? [floatingTag(data.ability.name, true)] : []),
    floatingTag(review.natureLabel, true),
    floatingTag(review.weaknessTag, false),
    ...defenses.map(defense => floatingTag(defense.name, defense.positive))
  ];

  const actor = await Actor.implementation.create({
    name: entry.name,
    type: "litm-npc",
    ...(folderId ? { folder: folderId } : {}),
    img: definition.portraitPath,
    system: {
      editMode: false,
      shortDescription: data.dexText || `Pokémon · ${types.join(" / ")}`,
      biography: pokemonBiography(data, review),
      difficulty: 1,
      roles: ["Pokémon", ...types, review.natureLabel],
      mightyAspects,
      limits,
      secrets: [],
      specialFeatures: [
        { name: language === "en" ? "TYPES" : "TIPOS", description: types.join(" / ") },
        { name: language === "en" ? "RESISTANCES" : "RESISTÊNCIAS", description: resistances },
        { name: language === "en" ? "WEAKNESSES" : "FRAQUEZAS", description: weaknesses },
        { name: language === "en" ? "IMMUNITIES" : "IMUNIDADES", description: immunities }
      ],
      threatsAndConsequences: pokemonThreats(data, review, config),
      floatingTagsAndStatusesEditable: false,
      floatingTagsAndStatuses: intrinsicTags
    },
    prototypeToken: prototypeToken(definition, flags),
    flags: { [MODULE_ID]: flags }
  });

  if (!actor) throw new Error("Não foi possível criar o Challenge.");
  void actor.sheet?.render?.({ force: true });
  return actor;
}

async function createTrainerPokemon(entry, config, data, review, definition) {
  const trainer = game.actors.get(config.trainerId);
  if (!trainer || trainer.type !== "litm-character" || (!game.user.isGM && !trainer.isOwner)) {
    throw new Error("Treinador não encontrado.");
  }

  const existingThemes = trainer.items.filter(item =>
    item.type === "themebook"
    && item.getFlag(MODULE_ID, "pokemonTheme") === true
    && item.getFlag(MODULE_ID, "themeRole") === "pokemon"
  );

  if (config.destination === "team" && existingThemes.length >= 6) {
    throw new Error("O time já tem 6 Pokémon.");
  }

  const instanceId = randomId();
  const flags = moduleMetadata(entry, definition, config, data, review, instanceId);
  Object.assign(flags, {
    pokemonTheme: true,
    themeRole: "pokemon",
    ...(config.destination === "team" ? { pokemonTeamSlot: existingThemes.length } : {})
  });

  const themeData = {
    name: entry.name,
    type: "themebook",
    img: definition.portraitPath,
    system: themeSystem(review, data),
    flags: { [MODULE_ID]: flags }
  };

  if (config.destination === "team") {
    const created = await trainer.createEmbeddedDocuments("Item", [themeData]);
    if (!created?.[0]) throw new Error("Não foi possível adicionar o Pokémon ao time.");
    void created[0].sheet?.render?.({ force: true });
    return created[0];
  }

  const current = trainer.getFlag(MODULE_ID, PC_FLAG);
  const records = Array.isArray(current) ? foundry.utils.deepClone(current) : [];
  records.push({ id: randomId(), data: themeData });
  await trainer.setFlag(MODULE_ID, PC_FLAG, records);
  ui.notifications.info(`${entry.name} foi enviado para o PC de ${trainer.name}.`);
  return null;
}

export async function openPokemonBuilder(entry, prepareDefinition) {
  if (!game.user.isGM) return null;
  if (!entry || entry.category !== "pokemon") throw new Error("O Builder aceita apenas Pokémon.");
  if (typeof prepareDefinition !== "function") throw new Error("Serviço visual do importador indisponível.");

  const config = await askBuildConfig(entry);
  if (!config) return null;

  ui.notifications.info(`Consultando dados de ${entry.name}...`);
  const data = await loadPokemonBuildData(entry, config.might);
  const review = await reviewBuild(entry, config, data);
  if (!review) return null;

  const definition = await prepareDefinition(entry);
  const result = config.mode === "trainer"
    ? await createTrainerPokemon(entry, config, data, review, definition)
    : await createChallenge(entry, config, data, review, definition);

  ui.notifications.info(`${entry.name} criado com sucesso.`);
  return result;
}
