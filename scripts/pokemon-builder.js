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
  buildAbilityThreat,
  moveShortDescription,
  moveEnglishLabel,
  formatThemeDescription
} from "./pokemon-content.js";

const MODULE_ID = "pokemon-litm-tools";
const PC_FLAG = "pokemonPC";

const {
  ApplicationV2,
  HandlebarsApplicationMixin
} = foundry.applications.api;

let pokemonBuilderWizardApp = null;

const NATURE_IDS = [
  "hardy","lonely","adamant","naughty","brave",
  "bold","docile","impish","lax","relaxed",
  "modest","mild","bashful","rash","quiet",
  "calm","gentle","careful","quirky","sassy",
  "timid","hasty","jolly","naive","serious"
];

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

const HM_MOVES = new Set([
  "cut", "fly", "surf", "strength", "flash", "whirlpool", "waterfall"
]);

function wizardHeader(step, title, subtitle = "") {
  return `
    <div class="pokemon-builder-wizard-head">
      <div class="pokemon-builder-wizard-steps">Etapa ${step} de 5</div>
      <h2>${escapeHTML(title)}</h2>
      ${subtitle ? `<p>${escapeHTML(subtitle)}</p>` : ""}
    </div>
  `;
}

function rankForLevel(level) {
  const value = Number(level ?? 0);
  if (value <= 20) return "origin";
  if (value <= 45) return "adventure";
  return "greatness";
}

function learnMethodInfo(methods, level, language = "pt-BR") {
  if (Number(level) > 0) {
    return {
      id: "level-up",
      label: language === "en" ? `Level ${level}` : `Por nível · Nv. ${level}`
    };
  }
  if (methods.includes("machine")) {
    const hm = methods.includes("hm");
    return {
      id: hm ? "hm" : "tm",
      label: hm ? "HM" : "TM"
    };
  }
  if (methods.includes("tutor")) {
    return { id: "tutor", label: language === "en" ? "Tutor" : "Tutor" };
  }
  if (methods.includes("egg")) {
    return { id: "breeding", label: language === "en" ? "Breeding" : "Cruzamento" };
  }
  return { id: "other", label: language === "en" ? "Other method" : "Outra forma de aprendizado" };
}

function defeatedLimitFor(stats, might) {
  const base = Number({ origin: 3, adventure: 4, greatness: 5 }[might] ?? 4);
  const hp = Number(stats?.hp ?? 0);
  const modifier = hp <= 45 ? -1 : hp >= 90 ? 1 : 0;
  return Math.max(3, Math.min(6, base + modifier));
}

function captureLimitFor(catchRate) {
  const rate = Number(catchRate ?? 0);
  if (rate >= 200) return 3;
  if (rate >= 120) return 4;
  if (rate >= 45) return 5;
  return 6;
}

function escapeStatusLevel(speed, might) {
  const base = Number({ origin: 1, adventure: 2, greatness: 3 }[might] ?? 2);
  const value = Number(speed ?? 0);
  const speedMod = value >= 90 ? 2 : value >= 50 ? 1 : 0;
  return Math.max(1, Math.min(5, base + speedMod));
}

function genderOptionsForRate(rate, language = "pt-BR") {
  const value = Number(rate ?? -1);
  const labels = language === "en"
    ? { male: "Male", female: "Female", genderless: "Genderless" }
    : { male: "Macho", female: "Fêmea", genderless: "Sem gênero" };

  if (value < 0) {
    return [{
      id: "genderless",
      label: labels.genderless,
      chance: 100
    }];
  }

  const femaleChance = Math.max(0, Math.min(100, (value / 8) * 100));
  const maleChance = 100 - femaleChance;
  const rows = [];

  if (maleChance > 0) {
    rows.push({
      id: "male",
      label: labels.male,
      chance: maleChance
    });
  }

  if (femaleChance > 0) {
    rows.push({
      id: "female",
      label: labels.female,
      chance: femaleChance
    });
  }

  return rows;
}

function defaultGenderForRate(rate) {
  const options = genderOptionsForRate(rate, "pt-BR");
  if (options.length <= 1) return options[0]?.id ?? "genderless";

  const roll = Math.random() * 100;
  let cursor = 0;
  for (const option of options) {
    cursor += Number(option.chance ?? 0);
    if (roll <= cursor) return option.id;
  }

  return options[0].id;
}

function genderLabel(id, language = "pt-BR") {
  const labels = language === "en"
    ? { male: "Male", female: "Female", genderless: "Genderless" }
    : { male: "Macho", female: "Fêmea", genderless: "Sem gênero" };
  return labels[id] ?? labels.genderless;
}

function futureLevelUpMoves(data) {
  const selectedIds = new Set(
    (data.moves ?? [])
      .map(move => move?.id)
      .filter(Boolean)
  );

  const selectedLevel = Math.max(
    0,
    ...(data.moves ?? [])
      .map(move => Number(move.level ?? 0))
      .filter(level => level > 0)
  );

  const all = (data.biographyMoves ?? [])
    .filter(move =>
      move?.id
      && Number(move.level ?? 0) > 0
      && !selectedIds.has(move.id)
    );

  const after = all
    .filter(move => Number(move.level ?? 0) > selectedLevel)
    .sort((a, b) =>
      Number(a.level ?? 0) - Number(b.level ?? 0)
      || String(a.name ?? '').localeCompare(String(b.name ?? ''), 'pt-BR')
    );

  // Alguns Pokémon já chegam ao fim do learnset no Rank escolhido.
  // Nesse caso completamos os slots planejados com golpes por nível
  // ainda não usados, começando pelos mais avançados.
  const earlier = all
    .filter(move => Number(move.level ?? 0) <= selectedLevel)
    .sort((a, b) =>
      Number(b.level ?? 0) - Number(a.level ?? 0)
      || String(a.name ?? '').localeCompare(String(b.name ?? ''), 'pt-BR')
    );

  const seen = new Set();
  const result = [];
  for (const move of [...after, ...earlier]) {
    if (!move.id || seen.has(move.id)) continue;
    seen.add(move.id);
    result.push({
      id: move.id,
      name: move.name,
      englishName: move.englishName,
      learnedAt: Number(move.level ?? 0)
    });
    if (result.length >= 3) break;
  }
  return result;
}

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

async function loadPokemonBuildData(entry, might) {
  const language = getPokemonContentLanguage();
  const pokemonId = Number(entry.pokemonId ?? entry.dex);

  if (!Number.isInteger(pokemonId) || pokemonId < 1) {
    throw new Error("Pokémon sem número de Pokédex válido.");
  }

  const [pokemon, species] = await Promise.all([
    fetchPokeJson(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`),
    fetchPokeJson(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId}`)
  ]);

  const types = (pokemon.types ?? [])
    .slice()
    .sort((a, b) => Number(a.slot) - Number(b.slot))
    .map(row => row.type?.name)
    .filter(Boolean);

  const stats = {};
  for (const row of pokemon.stats ?? []) {
    if (row.stat?.name) stats[row.stat.name] = Number(row.base_stat ?? 0);
  }

  const abilities = (await Promise.all(
    (pokemon.abilities ?? []).map(async row => {
      const id = row.ability?.name ?? "unknown";
      try {
        const detail = await fetchPokeJson(row.ability?.url);
        const effectEn = detail.effect_entries?.find(entry => entry.language?.name === "en");
        return {
          id,
          name: abilityLabel(id, detail.names, language),
          englishName: abilityLabel(id, detail.names, "en"),
          hidden: !!row.is_hidden,
          effectTextEn: String(effectEn?.short_effect ?? effectEn?.effect ?? "").replace(/\s+/g, " ").trim()
        };
      } catch (error) {
        console.warn("Pokemon LITM Tools | Ability:", id, error);
        return {
          id,
          name: abilityLabel(id, [], language),
          englishName: titleCase(id),
          hidden: !!row.is_hidden,
          effectTextEn: ""
        };
      }
    })
  )).filter(Boolean);

  const ability = abilities.find(row => !row.hidden) ?? abilities[0] ?? null;
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

  const preferredGroups = ["heartgold-soulsilver", "crystal", "gold-silver"];

  function preferredDetails(row) {
    const all = row.version_group_details ?? [];
    for (const group of preferredGroups) {
      const rows = all.filter(detail => detail.version_group?.name === group);
      if (rows.length) return rows;
    }
    return all;
  }

  const moveSources = (pokemon.moves ?? []).map(row => {
    const id = row.move?.name ?? "";
    const details = preferredDetails(row);
    const methods = [...new Set(details.map(detail => detail.move_learn_method?.name).filter(Boolean))];
    const levels = details
      .filter(detail => detail.move_learn_method?.name === "level-up")
      .map(detail => Number(detail.level_learned_at ?? 0))
      .filter(value => Number.isFinite(value) && value > 0);
    const level = levels.length ? Math.min(...levels) : null;
    if (methods.includes("machine") && HM_MOVES.has(id)) methods.push("hm");

    return {
      id,
      url: row.move?.url,
      methods,
      level,
      rank: level ? rankForLevel(level) : null
    };
  }).filter(row => row.id && row.url);

  const maxLevel = MIGHT[might]?.maxLevel ?? 45;
  const levelPool = moveSources
    .filter(row => Number(row.level ?? Infinity) <= maxLevel)
    .sort((a, b) => Number(a.level ?? 0) - Number(b.level ?? 0));

  const otherPool = moveSources
    .filter(row => !row.level && row.methods.some(method => ["machine", "tutor", "egg"].includes(method)))
    .sort((a, b) => a.id.localeCompare(b.id));

  const chosenSources = [];
  const seen = new Set();
  for (const row of [...levelPool, ...otherPool]) {
    if (seen.has(row.id)) continue;
    chosenSources.push(row);
    seen.add(row.id);
    if (chosenSources.length >= 36) break;
  }
  if (!chosenSources.length) chosenSources.push(...moveSources.slice(0, 24));

  const detailRows = (await Promise.all(chosenSources.map(async source => {
    try {
      const detail = await fetchPokeJson(source.url);
      const meta = detail.meta ?? {};
      const effectEn = detail.effect_entries?.find(entry => entry.language?.name === "en");
      const flavorEn = detail.flavor_text_entries?.find(entry => entry.language?.name === "en");
      const methodInfo = learnMethodInfo(source.methods, source.level, language);

      const move = {
        id: detail.name,
        name: moveLabel(detail.name, detail.names, language),
        englishName: moveEnglishLabel(detail.name, detail.names),
        type: detail.type?.name ?? "normal",
        damageClass: detail.damage_class?.name ?? "status",
        power: Number(detail.power ?? 0),
        accuracy: Number(detail.accuracy ?? 0),
        level: source.level,
        rank: source.rank,
        methods: source.methods,
        methodId: methodInfo.id,
        methodLabel: methodInfo.label,
        target: detail.target?.name ?? "selected-pokemon",
        effectChance: Number(detail.effect_chance ?? 0),
        shortEffectEn: String(effectEn?.short_effect ?? "").replace(/\s+/g, " ").trim(),
        flavorEn: String(flavorEn?.flavor_text ?? "").replace(/[\n\f]+/g, " ").replace(/\s+/g, " ").trim(),
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
      move.shortDescription = moveShortDescription(move, move.name, language);
      return move;
    } catch (error) {
      console.warn("Pokemon LITM Tools | Move:", source.id, error);
      return null;
    }
  }))).filter(Boolean);

  function score(move) {
    const stab = types.includes(move.type) ? 75 : 0;
    const usefulStatus = move.damageClass === "status" ? 45 : 0;
    const powerScore = Math.min(Number(move.power ?? 0), 150);
    const accuracyScore = Math.min(Number(move.accuracy || 80), 100) / 10;
    const levelScore = Number(move.level ?? 1) * (might === "origin" ? 0.15 : might === "greatness" ? 0.8 : 0.45);
    return stab + usefulStatus + powerScore + accuracyScore + levelScore;
  }

  const moveChoices = detailRows.slice().sort((a, b) =>
    score(b) - score(a) || a.name.localeCompare(b.name, language)
  );

  const moves = [];
  const usedTypes = new Set();
  const usedClasses = new Set();
  for (const move of moveChoices) {
    const diversity = !usedTypes.has(move.type) || !usedClasses.has(move.damageClass) || moves.length < 2;
    if (!diversity && moves.length < 3) continue;
    moves.push(move);
    usedTypes.add(move.type);
    usedClasses.add(move.damageClass);
    if (moves.length >= 4) break;
  }
  for (const move of moveChoices) {
    if (moves.length >= 4) break;
    if (!moves.some(existing => existing.id === move.id)) moves.push(move);
  }

  const statOrder = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];
  const statRows = statOrder.map(name => ({ name, value: Number(stats[name] ?? 0) }));
  const rankedStats = statRows.slice().sort((a, b) =>
    b.value - a.value || statOrder.indexOf(a.name) - statOrder.indexOf(b.name)
  );
  const best = rankedStats[0];

  const weaknessRows = statRows.filter(row => row.name !== "hp");
  const weaknessOrder = statOrder.filter(name => name !== "hp");
  const worst = weaknessRows.reduce((a, b) => {
    if (b.value < a.value) return b;
    if (b.value === a.value && weaknessOrder.indexOf(b.name) > weaknessOrder.indexOf(a.name)) return b;
    return a;
  }, weaknessRows[0]);

  const biographyMoves = moveSources.map(source => ({
    id: source.id,
    name: moveLabel(source.id, [], language),
    englishName: titleCase(source.id),
    level: source.level,
    rank: source.rank,
    methods: source.methods,
    method: learnMethodInfo(source.methods, source.level, language)
  }));

  return {
    pokemonId,
    contentLanguage: language,
    types,
    stats,
    typeEffectiveness,
    abilities,
    ability,
    moves,
    moveChoices,
    dexText,
    catchRate: Number(species.capture_rate ?? 0),
    genderRate: Number(species.gender_rate ?? -1),
    biographyMoves,
    best,
    worst,
    topStats: rankedStats.slice(0, 2),
    powerStatTag: statPowerText(best.name, language),
    weaknessTag: statWeaknessText(worst.name, language)
  };
}


function trainerOptions() {
  return game.actors
    .filter(actor => {
      if (actor.type !== "litm-npc") return false;
      if (!game.user.isGM && !actor.isOwner) return false;

      const moduleFlags = actor.flags?.[MODULE_ID] ?? {};
      const roles = Array.isArray(actor.system?.roles) ? actor.system.roles : [];
      const pokemonChallenge = (
        moduleFlags.kind === "pokemon"
        || Number(moduleFlags.pokemonId ?? 0) > 0
        || (
          moduleFlags.pokemonBuilder === true
          && roles.some(role => String(role).toLocaleLowerCase() === "pokémon")
        )
      );

      return !pokemonChallenge;
    })
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
    window: { title: `${entry.name} · Challenge · Etapa 2` },
    position: { width: 620 },
    content: `
      <div class="pokemon-builder-wizard">
        ${wizardHeader(2, "Configurar Challenge", "O arraste rápido continua disponível; este fluxo cria uma ficha elaborada.")}
        <div class="pokemon-builder-config">
          <div class="pokemon-builder-field">
            <label>Criar como</label>
            <select name="mode">
              <option value="challenge">Pokémon selvagem / Challenge</option>
              <option value="trainer">Adicionar a um treinador jogador</option>
            </select>
          </div>
          <div class="pokemon-builder-field">
            <label>Rank / Might</label>
            <select name="might">
              <option value="origin">Origin</option>
              <option value="adventure" selected>Adventure</option>
              <option value="greatness">Greatness</option>
            </select>
          </div>
        </div>
      </div>
    `,
    ok: { label: "Continuar", icon: "fa-solid fa-arrow-right" },
    modal: true
  });

  if (!modeResult) return null;
  const mode = String(modeResult.mode ?? "challenge");
  const might = String(modeResult.might ?? "adventure");

  if (mode === "challenge") {
    const folderChoices = actorFolderOptions();
    const remembered = String(game.settings.get(MODULE_ID, "lastActorFolder") ?? "");
    const rootSelected = remembered ? "" : "selected";

    const result = await foundry.applications.api.DialogV2.input({
      window: { title: `${entry.name} · Destino` },
      position: { width: 620 },
      content: `
        <div class="pokemon-builder-wizard">
          ${wizardHeader(2, "Destino do Challenge")}
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
        </div>
      `,
      ok: { label: "Continuar", icon: "fa-solid fa-arrow-right" },
      modal: true
    });

    if (!result) return null;
    return {
      mode, might,
      trainerId: "", destination: "",
      folderId: String(result.folderId ?? ""),
      newFolder: String(result.newFolder ?? "").trim()
    };
  }

  const options = trainerOptions()
    .map(actor => `<option value="${actor.id}">${escapeHTML(actor.name)}</option>`)
    .join("");

  const result = await foundry.applications.api.DialogV2.input({
    window: { title: `${entry.name} · Treinador` },
    position: { width: 620 },
    content: `
      <div class="pokemon-builder-wizard">
        ${wizardHeader(2, "Destino do Pokémon")}
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
      </div>
    `,
    ok: { label: "Continuar", icon: "fa-solid fa-arrow-right" },
    modal: true
  });

  if (!result) return null;
  const trainerId = String(result.trainerId ?? "");
  if (!trainerId) throw new Error("Escolha o treinador.");

  return {
    mode, might, trainerId,
    destination: String(result.destination ?? "team"),
    folderId: "", newFolder: ""
  };
}


async function reviewBuild(entry, config, data) {
  const language = data.contentLanguage ?? getPokemonContentLanguage();
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
    return `<option value="${id}" ${id === defaultNatureId ? "selected" : ""}>${escapeHTML(nature.label)}</option>`;
  }).join("");

  const abilityOptions = (data.abilities ?? []).map(ability => `
    <option value="${escapeHTML(ability.id)}" ${ability.id === data.ability?.id ? "selected" : ""}>
      ${escapeHTML(ability.name)}${ability.hidden ? " · Hidden Ability" : ""}
    </option>
  `).join("");

  const weaknessStats = ["attack","defense","special-attack","special-defense","speed"];
  const weaknessOptions = weaknessStats.map(stat => {
    const text = statWeaknessText(stat, language);
    return `<option value="${stat}" ${stat === data.worst?.name ? "selected" : ""}>${escapeHTML(text)} · ${escapeHTML(statLabel(stat, language))} ${Number(data.stats?.[stat] ?? 0)}</option>`;
  }).join("");

  const profile = await foundry.applications.api.DialogV2.input({
    window: { title: `${entry.name} · Perfil · Etapa 3` },
    position: { width: 720 },
    content: `
      <div class="pokemon-builder-wizard">
        ${wizardHeader(3, "Perfil do Pokémon", "Natureza e Habilidade são propriedades do indivíduo. HP nunca é usado para sugerir a fraqueza.")}
        <div class="pokemon-builder-profile-grid">
          <label>
            <span>Natureza</span>
            <select name="natureId">${natureOptions}</select>
          </label>
          <label>
            <span>Habilidade</span>
            <select name="abilityId">${abilityOptions}</select>
          </label>
          <label class="wide">
            <span>Fraqueza sugerida</span>
            <select name="weaknessStat">${weaknessOptions}<option value="custom">Personalizada</option></select>
          </label>
          <label class="wide">
            <span>Fraqueza personalizada (opcional)</span>
            <input name="customWeakness" type="text" placeholder="Se preencher, substitui a sugestão acima">
          </label>
        </div>
      </div>
    `,
    ok: { label: "Escolher golpes", icon: "fa-solid fa-arrow-right" },
    modal: true
  });

  if (!profile) return null;

  const nature = natureProfile(String(profile.natureId ?? defaultNatureId), language);
  const selectedAbility = (data.abilities ?? []).find(row => row.id === String(profile.abilityId ?? "")) ?? data.ability ?? null;
  data.ability = selectedAbility;

  const customWeakness = String(profile.customWeakness ?? "").trim();
  const weaknessStat = String(profile.weaknessStat ?? data.worst?.name ?? "speed");
  const weaknessTag = customWeakness || (
    weaknessStat === "custom"
      ? data.weaknessTag
      : statWeaknessText(weaknessStat, language)
  );

  let selectedMoves = null;

  while (!selectedMoves) {
    const defaults = new Set((data.moves ?? []).map(move => move.id));
    const cards = (data.moveChoices ?? []).map((move, index) => {
      const threat = buildMoveThreat(move, move.name, config.might, language);
      const consequenceText = threat.list.map(item => `<li>${item}</li>`).join("");
      return `
        <label class="pokemon-builder-move-card">
          <input type="checkbox" name="move_${index}" ${defaults.has(move.id) ? "checked" : ""}>
          <div class="pokemon-builder-move-main">
            <div class="pokemon-builder-move-title">
              <strong>${escapeHTML(move.name)} <span>(${escapeHTML(move.englishName)})</span></strong>
              <a href="https://pokemondb.net/move/${encodeURIComponent(move.id)}" target="_blank" rel="noopener noreferrer" title="PokémonDB">
                <i class="fa-solid fa-up-right-from-square"></i>
              </a>
            </div>
            <small>${escapeHTML(typeLabel(move.type, language))} · ${escapeHTML(move.methodLabel)} · ${move.power ? `Power ${move.power}` : "Sem dano direto"}</small>
            <p>${escapeHTML(move.shortDescription)}</p>
            <ul>${consequenceText}</ul>
          </div>
        </label>
      `;
    }).join("");

    const result = await foundry.applications.api.DialogV2.input({
      window: { title: `${entry.name} · Golpes · Etapa 4` },
      position: { width: 860, height: 760 },
      content: `
        <div class="pokemon-builder-wizard pokemon-builder-moves-step">
          ${wizardHeader(4, "Escolher golpes", "Marque até 4. As sugestões respeitam o Rank, mas você pode trocar livremente.")}
          <div class="pokemon-builder-move-list">${cards}</div>
        </div>
      `,
      ok: { label: "Revisar", icon: "fa-solid fa-arrow-right" },
      modal: true
    });

    if (!result) return null;

    const picked = (data.moveChoices ?? []).filter((move, index) => result[`move_${index}`] === true || result[`move_${index}`] === "true" || result[`move_${index}`] === "on");
    if (picked.length < 1 || picked.length > 4) {
      ui.notifications.warn("Escolha entre 1 e 4 golpes.");
      continue;
    }
    selectedMoves = picked;
  }

  data.moves = selectedMoves;

  const review = {
    moveNames: selectedMoves.map(move => move.name),
    powerStatTag: data.powerStatTag,
    weaknessTag,
    natureId: nature.id,
    natureLabel: nature.label,
    natureLimits: [],
    abilityId: selectedAbility?.id ?? null
  };

  const threatPreview = selectedMoves.map(move => {
    const threat = buildMoveThreat(move, move.name, config.might, language);
    return `<li><strong>${escapeHTML(move.name)} (${escapeHTML(move.englishName)})</strong> — ${escapeHTML(threat.description)}</li>`;
  }).join("");

  const confirm = await foundry.applications.api.DialogV2.input({
    window: { title: `${entry.name} · Revisão · Etapa 5` },
    position: { width: 720 },
    content: `
      <div class="pokemon-builder-wizard">
        ${wizardHeader(5, "Revisar Pokémon")}
        <div class="pokemon-builder-final-review">
          <p><strong>Rank:</strong> ${escapeHTML(MIGHT[config.might]?.label ?? config.might)}</p>
          <p><strong>Natureza:</strong> ${escapeHTML(review.natureLabel)}</p>
          <p><strong>Habilidade:</strong> ${escapeHTML(selectedAbility?.name ?? "—")}${selectedAbility?.hidden ? " · Hidden Ability" : ""}</p>
          <p><strong>Tag de Poder sugerida:</strong> ${escapeHTML(review.powerStatTag)}</p>
          <p><strong>Tag de Fraqueza:</strong> ${escapeHTML(review.weaknessTag)}</p>
          <p><strong>Golpes:</strong></p>
          <ul>${threatPreview}</ul>
        </div>
        <input type="hidden" name="confirmed" value="yes">
      </div>
    `,
    ok: { label: "Criar Pokémon", icon: "fa-solid fa-check" },
    modal: true
  });

  return confirm ? review : null;
}


function powerTag(name, planned = false, question = '') {
  return {
    name,
    question,
    burned: false,
    toBurn: false,
    planned: !!planned,
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
    mightIcon: ''
  };
}

function pokemonThemeTitleTag(entry, review, language = 'pt-BR') {
  const species = String(entry?.name ?? 'Pokémon').trim() || 'Pokémon';
  const nature = String(review?.natureLabel ?? '').trim();
  const suffix = nature ? ' ' + nature : '';

  if (language === 'en') return species + suffix;
  if (review?.genderId === 'male') return 'O ' + species + suffix;
  if (review?.genderId === 'female') return 'A ' + species + suffix;
  return nature ? species + ' · ' + nature : species;
}

function themeSystem(review, data, entry) {
  const language = data.contentLanguage ?? getPokemonContentLanguage();
  const abilityTag = data.ability?.name
    ? [powerTag(`Habilidade: ${data.ability.name}`)]
    : [];

  const futureTags = futureLevelUpMoves(data)
    .map(move => powerTag(
      move.name,
      true,
      move.learnedAt
        ? (language === 'en'
            ? `Learns by level at Lv. ${move.learnedAt}.`
            : `Aprende por nível no Nv. ${move.learnedAt}.`)
        : ''
    ));

  return {
    description: formatThemeDescription({ data, review }, language),
    type: 'litm-variable',
    color: 'litm-variable',
    quest: '',
    story: '',
    tabCategory: 'main',
    powertags: [
      powerTag(pokemonThemeTitleTag(entry, review, language)),
      ...review.moveNames.map(powerTag),
      ...(review.powerStatTag ? [powerTag(review.powerStatTag)] : []),
      ...abilityTag,
      ...futureTags
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
    speciesName: entry.name,
    contentLanguage: data.contentLanguage,
    nature: {
      id: review.natureId,
      label: review.natureLabel
    },
    gender: review.genderId ?? "genderless",
    genderLabel: review.genderLabel ?? genderLabel(review.genderId, data.contentLanguage),
    ability: data.ability ? foundry.utils.deepClone(data.ability) : null,
    might: config.might,
    trainerNpcId: config.mode === "trainer" ? (config.trainerId || null) : null,
    weaknessTag: review.weaknessTag,
    powerStatTag: review.powerStatTag,
    types: foundry.utils.deepClone(data.types),
    baseStats: foundry.utils.deepClone(data.stats),
    typeEffectiveness: foundry.utils.deepClone(data.typeEffectiveness),
    futureMoves: futureLevelUpMoves(data),
    levelUpMoves: (data.biographyMoves ?? [])
      .filter(move => Number(move.level ?? 0) > 0)
      .map(move => ({
        id: move.id,
        name: move.name,
        englishName: move.englishName,
        learnedAt: Number(move.level ?? 0)
      })),
    themeTitleTag: pokemonThemeTitleTag(entry, review, data.contentLanguage),
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
      tagIndex: index + 1,
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
  const rows = data.biographyMoves ?? [];

  const nameText = move => `${escapeHTML(move.name)} (${escapeHTML(move.englishName)})`;
  const rankSections = [
    ["origin", language === "en" ? "Origin · up to Lv. 20" : "Origin · até Nv. 20"],
    ["adventure", language === "en" ? "Adventure · Lv. 21–45" : "Adventure · Nv. 21–45"],
    ["greatness", language === "en" ? "Greatness · Lv. 46+" : "Greatness · Nv. 46+"]
  ].map(([rank, title]) => {
    const moves = rows.filter(move => move.rank === rank).sort((a, b) => Number(a.level ?? 0) - Number(b.level ?? 0));
    const text = moves.length
      ? moves.map(move => `${nameText(move)} · Nv. ${move.level}`).join("<br>")
      : (language === "en" ? "None listed." : "Nenhum listado.");
    return `<h3>${title}</h3><p>${text}</p>`;
  }).join("");

  function otherGroup(method, title) {
    const moves = rows.filter(move => move.method?.id === method);
    if (!moves.length) return "";
    return `<h3>${title}</h3><p>${moves.map(nameText).join(", ")}</p>`;
  }

  const actionRows = (data.moves ?? []).map((move, index) => {
    const displayName = review.moveNames[index] ?? move.name;
    const threat = buildMoveThreat(move, displayName, review.might ?? "adventure", language);
    return `
      <article class="pokemon-biography-effect"
        data-pokemon-effect-kind="move"
        data-pokemon-effect-id="${escapeHTML(move.id)}"
        data-pokemon-effect-type="${escapeHTML(move.type)}"
        data-pokemon-effect-target="${escapeHTML(move.target ?? "selected-pokemon")}">
        <h3><i class="fa-solid fa-bolt"></i> ${escapeHTML(displayName)} (${escapeHTML(move.englishName ?? titleCase(move.id))})</h3>
        <p>${escapeHTML(threat.description)}</p>
      </article>
    `;
  }).join("");

  const abilityThreat = buildAbilityThreat(data.ability, language);
  const abilityRow = abilityThreat ? `
    <article class="pokemon-biography-effect"
      data-pokemon-effect-kind="ability"
      data-pokemon-effect-id="${escapeHTML(data.ability?.id ?? "")}"
      data-pokemon-effect-target="self">
      <h3><i class="fa-solid fa-star"></i> ${escapeHTML(abilityThreat.name)}${data.ability?.englishName && data.ability.englishName !== abilityThreat.name ? ` (${escapeHTML(data.ability.englishName)})` : ""}</h3>
      <p>${escapeHTML(abilityThreat.description)}</p>
    </article>
  ` : "";

  return `
    <h2>${language === "en" ? "Actions / Effects" : "Ações / Efeitos"}</h2>
    <p><em>${language === "en" ? "Prepared for future visual-effect buttons." : "Área preparada para os futuros botões de efeitos visuais."}</em></p>
    <div class="pokemon-biography-effects" data-pokemon-effect-actions="true">
      ${actionRows}
      ${abilityRow}
    </div>

    <h2>${language === "en" ? "Moves by Rank" : "Golpes por Rank"}</h2>
    ${rankSections}

    <h2>${language === "en" ? "Other learning methods" : "Outras formas de aprendizado"}</h2>
    ${otherGroup("tm", "TM")}
    ${otherGroup("hm", "HM")}
    ${otherGroup("tutor", "Tutor")}
    ${otherGroup("breeding", language === "en" ? "Breeding" : "Cruzamento")}

    <hr>
    ${profile}
  `;
}


function pokemonThreats(data, review, config) {
  const language = data.contentLanguage ?? getPokemonContentLanguage();
  const threats = data.moves.map((move, index) => {
    const threat = buildMoveThreat(
      move,
      review.moveNames[index] ?? move.name,
      config.might,
      language
    );
    return {
      name: `${review.moveNames[index] ?? move.name} (${move.englishName ?? titleCase(move.id)})`,
      description: threat.description,
      list: threat.list
    };
  });

  const abilityThreat = buildAbilityThreat(data.ability, language);
  if (abilityThreat) {
    threats.push({
      name: `${abilityThreat.name}${data.ability?.englishName && data.ability.englishName !== abilityThreat.name ? ` (${data.ability.englishName})` : ""}`,
      description: abilityThreat.description,
      list: abilityThreat.list
    });
  }

  if (config.mode === "challenge") {
    const fuga = escapeStatusLevel(data.stats?.speed, config.might);
    threats.unshift({
      name: language === "en" ? "ESCAPE" : "FUGIR",
      description: language === "en"
        ? "The wild Pokémon looks for an opening to leave the confrontation."
        : "O Pokémon selvagem procura uma abertura para abandonar o confronto.",
      list: [
        language === "en"
          ? `When it threatens to flee, apply [/s escape-${fuga}] against attempts to stop it.`
          : `Quando ameaçar fugir, aplique [/s fuga-${fuga}] contra tentativas de impedir a fuga.`
      ]
    });
  }

  return threats;
}


function stripLinkedPokemonSection(html) {
  return String(html ?? "")
    .replace(/<section data-pokemon-litm-team="true">[\s\S]*?<\/section>/g, "")
    .trim();
}

async function refreshNpcTrainerPokemonSection(trainer) {
  if (!trainer) return;
  const recordsRaw = trainer.getFlag(MODULE_ID, "linkedPokemonChallenges");
  const records = Array.isArray(recordsRaw) ? recordsRaw : [];
  let base = trainer.getFlag(MODULE_ID, "trainerBiographyBase");
  if (typeof base !== "string") {
    base = stripLinkedPokemonSection(trainer.system?.biography ?? "");
    await trainer.setFlag(MODULE_ID, "trainerBiographyBase", base);
  }

  const rows = records
    .map(record => {
      const pokemon = game.actors.get(record.actorId);
      if (!pokemon) return "";
      const rank = pokemon.getFlag(MODULE_ID, "might") ?? record.might ?? "origin";
      return `<li>@UUID[Actor.${pokemon.id}]{${escapeHTML(pokemon.name)}} · ${escapeHTML(MIGHT[rank]?.label ?? rank)}</li>`;
    })
    .filter(Boolean)
    .join("");

  const section = rows
    ? `<section data-pokemon-litm-team="true"><h2>Pokémon</h2><ul>${rows}</ul></section>`
    : "";

  await trainer.update({
    "system.biography": `${base}${base && section ? "\n" : ""}${section}`
  });
}

async function linkPokemonChallengeToNpcTrainer(trainerId, pokemon) {
  if (!trainerId || !pokemon) return;
  const trainer = game.actors.get(trainerId);
  if (!trainer || trainer.type !== "litm-npc") {
    throw new Error("Challenge do treinador NPC não encontrado.");
  }
  const raw = trainer.getFlag(MODULE_ID, "linkedPokemonChallenges");
  const records = Array.isArray(raw) ? foundry.utils.deepClone(raw) : [];
  if (!records.some(record => record.actorId === pokemon.id)) {
    records.push({
      actorId: pokemon.id,
      pokemonInstanceId: pokemon.getFlag(MODULE_ID, "pokemonInstanceId") ?? null,
      might: pokemon.getFlag(MODULE_ID, "might") ?? "origin"
    });
    await trainer.setFlag(MODULE_ID, "linkedPokemonChallenges", records);
  }
  await pokemon.setFlag(MODULE_ID, "trainerNpcId", trainer.id);
  await refreshNpcTrainerPokemonSection(trainer);
}

async function createChallenge(entry, config, data, review, definition, existingActor = null) {
  const language = data.contentLanguage ?? getPokemonContentLanguage();
  const instanceId = existingActor?.getFlag(MODULE_ID, "pokemonInstanceId") || randomId();
  const flags = moduleMetadata(entry, definition, config, data, review, instanceId);
  flags.encounter = {
    wild: config.mode === "challenge",
    defeatedLimit: defeatedLimitFor(data.stats, config.might),
    catchRate: Number(data.catchRate ?? 0),
    captureBase: captureLimitFor(data.catchRate),
    dynamicCaptureReady: true,
    escapeStatusLevel: escapeStatusLevel(data.stats?.speed, config.might)
  };
  const types = data.types.map(type => typeLabel(type, language));
  const defenses = typeDefenseGroups(data.typeEffectiveness, language);

  const mightyAspects = config.might === "origin" ? [] : [{
    level: config.might,
    aspect: language === "en" ? "Pokémon Power" : "Poder Pokémon",
    mightIcon: config.might
  }];

  const defeated = defeatedLimitFor(data.stats, config.might);
  const captureBase = captureLimitFor(data.catchRate);

  const limits = [
    {
      name: language === "en" ? "Defeated" : "Derrotado",
      value: String(defeated),
      consequence: language === "en" ? "Out of action" : "Fora de combate"
    }
  ];

  if (config.mode === "challenge") {
    limits.push({
      name: language === "en" ? "Captured" : "Capturado",
      value: String(captureBase),
      consequence: language === "en" ? "Captured by a Trainer" : "Capturado por um Treinador"
    });
  }


  const resistances = matchupText(data.typeEffectiveness, value => value > 0 && value < 1, language);
  const weaknesses = matchupText(data.typeEffectiveness, value => value > 1, language);
  const immunities = matchupText(data.typeEffectiveness, value => value === 0, language);
  const folderId = await resolveChallengeFolder(config);

  const statTags = (data.topStats ?? [])
    .map(row => statPowerText(row.name, language))
    .filter(Boolean);

  const intrinsicTags = [
    ...statTags.map(name => floatingTag(name, false)),
    ...(data.ability?.name ? [floatingTag(`Habilidade: ${data.ability.name}`, false)] : []),
    floatingTag(`Natureza: ${review.natureLabel}`, false),
    floatingTag(review.weaknessTag, true),
    ...defenses.map(defense => floatingTag(defense.name, defense.positive))
  ];

  const actorData = {
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
  };

  let actor = existingActor;
  if (actor) {
    const updateData = foundry.utils.deepClone(actorData);
    delete updateData.type;
    actor = await actor.update(updateData);
  } else {
    actor = await Actor.implementation.create(actorData);
  }

  if (!actor) throw new Error("Não foi possível criar o Challenge.");

  if (config.mode === "trainer" && config.trainerId) {
    await linkPokemonChallengeToNpcTrainer(config.trainerId, actor);
  }

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
    system: themeSystem(review, data, entry),
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

class PokemonChallengeWizardApp
  extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "pokemon-litm-challenge-wizard",
    classes: [
      "pokemon-litm-tools",
      "pokemon-challenge-wizard"
    ],
    position: {
      width: 900,
      height: 780
    },
    window: {
      title: "Criar Challenge Pokémon",
      icon: "fa-solid fa-dragon",
      resizable: true
    }
  };

  static PARTS = {
    main: {
      template:
        "modules/" +
        MODULE_ID +
        "/templates/pokemon-builder-wizard.hbs",
      scrollable: [
        ".pokemon-challenge-wizard-body",
        ".pokemon-builder-move-list"
      ]
    }
  };

  step = 1;
  busy = false;
  data = null;
  loadedMight = null;
  natureId = "hardy";
  abilityId = "";
  genderId = "";
  weaknessStat = "speed";
  customWeakness = "";
  selectedMoveIds = new Set();
  existingActor = null;
  hydratedFromActor = false;

  config = {
    mode: "challenge",
    might: "adventure",
    trainerId: "",
    destination: "team",
    folderId: "",
    newFolder: ""
  };

  constructor(entry, prepareDefinition, options = {}) {
    super(options);
    this.entry = entry;
    this.prepareDefinition = prepareDefinition;
    this.existingActor = options.existingActor ?? null;

    if (this.existingActor) {
      const flags = this.existingActor.flags?.[MODULE_ID] ?? {};
      this.config.mode = flags.trainerNpcId ? "trainer" : "challenge";
      this.config.might = flags.might ?? "adventure";
      this.config.trainerId = flags.trainerNpcId ?? "";
      this.config.folderId = this.existingActor.folder?.id ?? "";
      this.config.newFolder = "";
    }
  }

  async _ensureData() {
    if (
      this.data &&
      this.loadedMight === this.config.might
    ) return;

    ui.notifications.info(
      `Consultando dados de ${this.entry.name}...`
    );

    this.data = await loadPokemonBuildData(
      this.entry,
      this.config.might
    );

    this.loadedMight = this.config.might;

    const defaultNature = defaultNatureForStats(this.data.stats);

    if (this.existingActor && !this.hydratedFromActor) {
      const flags = this.existingActor.flags?.[MODULE_ID] ?? {};
      this.natureId = flags.nature?.id ?? defaultNature.id;
      this.abilityId = flags.ability?.id ?? this.data.ability?.id ?? this.data.abilities?.[0]?.id ?? "";
      this.genderId = flags.gender ?? defaultGenderForRate(this.data.genderRate);
      this.weaknessStat = this.data.worst?.name ?? "speed";
      this.customWeakness = flags.weaknessTag ?? "";
      this.selectedMoveIds = new Set((flags.moves ?? []).map(move => move.id).filter(Boolean).slice(0, 4));
      if (!this.selectedMoveIds.size) {
        this.selectedMoveIds = new Set((this.data.moves ?? []).slice(0, 4).map(move => move.id));
      }
      this.hydratedFromActor = true;
    } else if (!this.hydratedFromActor) {
      this.natureId = defaultNature.id;
      this.abilityId = this.data.ability?.id ?? this.data.abilities?.[0]?.id ?? "";
      this.genderId = this.genderId || defaultGenderForRate(this.data.genderRate);
      this.weaknessStat = this.data.worst?.name ?? "speed";
      this.customWeakness = "";
      this.selectedMoveIds = new Set((this.data.moves ?? []).slice(0, 4).map(move => move.id));
      this.hydratedFromActor = true;
    }
  }

  _selectedAbility() {
    return (
      (this.data?.abilities ?? [])
        .find(row => row.id === this.abilityId)
      ??
      this.data?.ability
      ??
      null
    );
  }

  _selectedMoves() {
    return (this.data?.moveChoices ?? [])
      .filter(move =>
        this.selectedMoveIds.has(move.id)
      )
      .slice(0, 4);
  }

  _buildReview() {
    const language =
      this.data?.contentLanguage ??
      getPokemonContentLanguage();

    const nature =
      natureProfile(
        this.natureId,
        language
      );

    const ability =
      this._selectedAbility();

    const weaknessTag =
      this.customWeakness.trim()
      ||
      statWeaknessText(
        this.weaknessStat,
        language
      );

    const moves =
      this._selectedMoves();

    return {
      nature,
      ability,
      moves,
      review: {
        moveNames:
          moves.map(move => move.name),
        powerStatTag:
          this.data?.powerStatTag ?? "",
        weaknessTag,
        natureId:
          nature.id,
        natureLabel:
          nature.label,
        genderId:
          this.genderId || "genderless",
        genderLabel:
          genderLabel(
            this.genderId || "genderless",
            language
          ),
        natureLimits: [],
        abilityId:
          ability?.id ?? null,
        might:
          this.config.might
      }
    };
  }

  async _prepareContext(options) {
    const context =
      await super._prepareContext(options);

    if (this.step >= 3) {
      await this._ensureData();
    }

    const language =
      this.data?.contentLanguage ??
      getPokemonContentLanguage();

    const progressNames = [
      "Configuração",
      "Destino",
      "Perfil",
      "Golpes",
      "Revisão"
    ];

    const progress =
      progressNames.map((name, index) => {
        const number = index + 1;
        return {
          number,
          name,
          active: number === this.step,
          done: number < this.step
        };
      });

    const folders =
      game.folders
        .filter(folder => folder.type === "Actor")
        .sort((a, b) =>
          a.name.localeCompare(b.name, "pt-BR")
        )
        .map(folder => ({
          id: folder.id,
          name: folder.name,
          selected:
            folder.id === this.config.folderId
        }));

    const trainerActors =
      trainerOptions();

    const trainers =
      trainerActors.map(actor => ({
        id: actor.id,
        name: actor.name,
        img: actor.img || 'icons/svg/mystery-man.svg',
        folderId: actor.folder?.id ?? "",
        folderName: actor.folder?.name ?? "Raiz de Actors",
        search: [
          actor.name,
          actor.folder?.name ?? ""
        ].join(" ").toLocaleLowerCase(),
        selected:
          actor.id === this.config.trainerId
      }));

    const trainerFolders =
      [...new Map(
        trainerActors
          .filter(actor => actor.folder)
          .map(actor => [
            actor.folder.id,
            {
              id: actor.folder.id,
              name: actor.folder.name
            }
          ])
      ).values()]
        .sort((a, b) =>
          a.name.localeCompare(b.name, "pt-BR")
        );

    let natureOptions = [];
    let abilityOptions = [];
    let selectedNature = null;
    let selectedAbility = null;
    let genderOptions = [];
    let selectedGender = null;
    let weaknessOptions = [];
    let moveChoices = [];
    let finalReview = null;

    if (this.data) {
      natureOptions =
        NATURE_IDS.map(id => {
          const nature =
            natureProfile(id, language);
          return {
            ...nature,
            selected:
              id === this.natureId
          };
        });

      selectedNature =
        natureProfile(
          this.natureId,
          language
        );

      abilityOptions =
        (this.data.abilities ?? [])
          .map(ability => {
            const threat =
              buildAbilityThreat(
                ability,
                language
              );
            return {
              ...ability,
              selected:
                ability.id === this.abilityId,
              description:
                threat?.description ??
                ""
            };
          });

      selectedAbility =
        abilityOptions.find(
          ability => ability.selected
        )
        ??
        abilityOptions[0]
        ??
        null;

      genderOptions =
        genderOptionsForRate(
          this.data.genderRate,
          language
        ).map(option => ({
          ...option,
          chanceText:
            Number(option.chance ?? 0) === 100
              ? "100%"
              : `${Number(option.chance ?? 0).toLocaleString("pt-BR", {maximumFractionDigits: 1})}%`,
          selected:
            option.id === this.genderId
        }));

      if (
        !genderOptions.some(option => option.selected)
        && genderOptions.length
      ) {
        this.genderId = genderOptions[0].id;
        genderOptions[0].selected = true;
      }

      selectedGender =
        genderOptions.find(option => option.selected)
        ?? genderOptions[0]
        ?? null;

      weaknessOptions =
        [
          "attack",
          "defense",
          "special-attack",
          "special-defense",
          "speed"
        ].map(stat => ({
          id: stat,
          label:
            statWeaknessText(
              stat,
              language
            ),
          statLabel:
            statLabel(
              stat,
              language
            ),
          value:
            Number(
              this.data.stats?.[stat] ??
              0
            ),
          selected:
            stat === this.weaknessStat
        }));

      moveChoices =
        (this.data.moveChoices ?? [])
          .map(move => {
            const threat =
              buildMoveThreat(
                move,
                move.name,
                this.config.might,
                language
              );

            return {
              ...move,
              checked:
                this.selectedMoveIds.has(
                  move.id
                ),
              typeText:
                typeLabel(
                  move.type,
                  language
                ),
              damageText:
                move.power
                  ? (
                      language === "en"
                        ? `Power ${move.power}`
                        : `Poder ${move.power}`
                    )
                  : (
                      language === "en"
                        ? "No direct damage"
                        : "Sem dano direto"
                    ),
              consequences:
                threat.list
            };
          });

      if (this.step === 5) {
        const built =
          this._buildReview();

        finalReview = {
          nature:
            built.nature,
          ability:
            built.ability,
          gender: {
            id: built.review.genderId,
            label: built.review.genderLabel
          },
          weaknessTag:
            built.review.weaknessTag,
          powerStatTag:
            built.review.powerStatTag,
          moves:
            built.moves.map(move => ({
              ...move,
              threat:
                buildMoveThreat(
                  move,
                  move.name,
                  this.config.might,
                  language
                )
            }))
        };
      }
    }

    const selectedCount =
      this.selectedMoveIds.size;

    const canNext =
      (
        this.step === 1
      )
      ||
      (
        this.step === 2
        &&
        (
          this.config.mode === "challenge"
          ||
          !!this.config.trainerId
        )
      )
      ||
      (
        this.step === 3
      )
      ||
      (
        this.step === 4
        &&
        selectedCount >= 1
        &&
        selectedCount <= 4
      );

    return {
      ...context,

      entry:
        this.entry,

      pokedexUrl:
        getPokemonDbUrl(
          this.entry
        ),

      step:
        this.step,

      progress,

      stepIsConfig:
        this.step === 1,

      stepIsDestination:
        this.step === 2,

      stepIsProfile:
        this.step === 3,

      stepIsMoves:
        this.step === 4,

      stepIsReview:
        this.step === 5,

      isChallenge:
        this.config.mode ===
        "challenge",

      isTrainer:
        this.config.mode ===
        "trainer",

      mode:
        this.config.mode,

      might:
        this.config.might,

      mightOrigin:
        this.config.might === "origin",

      mightAdventure:
        this.config.might === "adventure",

      mightGreatness:
        this.config.might === "greatness",

      destination:
        this.config.destination,

      destinationTeam:
        this.config.destination === "team",

      destinationPc:
        this.config.destination === "pc",

      folders,
      trainers,
      trainerFolders,
      selectedTrainerId: this.config.trainerId,

      rootFolderSelected:
        !this.config.folderId,

      newFolder:
        this.config.newFolder,

      natureOptions,
      selectedNature,

      abilityOptions,
      selectedAbility,

      genderOptions,
      selectedGender,

      weaknessOptions,

      customWeakness:
        this.customWeakness,

      moveChoices,

      selectedCount,

      finalReview,

      canBack:
        !this.busy,

      canNext:
        canNext
        &&
        this.step < 5
        &&
        !this.busy,

      canCreate:
        this.step === 5
        &&
        !this.busy,

      busy:
        this.busy
    };
  }

  async _onRender(context, options) {
    await super._onRender(
      context,
      options
    );

    const field =
      name =>
        this.element.querySelector(
          `[data-builder-field="${name}"]`
        );

    field("mode")
      ?.addEventListener(
        "change",
        event => {
          this.config.mode =
            event.currentTarget.value;
        }
      );

    field("might")
      ?.addEventListener(
        "change",
        event => {
          const next =
            event.currentTarget.value;
          if (
            next !==
            this.config.might
          ) {
            this.config.might =
              next;
            this.data = null;
            this.loadedMight = null;
            if (!this.existingActor) this.hydratedFromActor = false;
          }
        }
      );

    field("folderId")
      ?.addEventListener(
        "change",
        event => {
          this.config.folderId =
            event.currentTarget.value;
        }
      );

    field("newFolder")
      ?.addEventListener(
        "input",
        event => {
          this.config.newFolder =
            event.currentTarget.value;
        }
      );

    const trainerSearch =
      field("trainerSearch");

    const trainerFolder =
      field("trainerFolder");

    const trainerSelect =
      field("trainerId");

    const filterTrainers =
      () => {
        if (!trainerSelect) return;

        const query =
          String(trainerSearch?.value ?? "")
            .trim()
            .toLocaleLowerCase();

        const folderId =
          String(trainerFolder?.value ?? "");

        for (
          const option
          of trainerSelect.querySelectorAll(
            "option[data-trainer-option]"
          )
        ) {
          const search =
            String(option.dataset.search ?? "");
          const optionFolder =
            String(option.dataset.folderId ?? "");

          const visible =
            (!query || search.includes(query))
            &&
            (!folderId || optionFolder === folderId);

          option.hidden = !visible;
        }
      };

    trainerSearch
      ?.addEventListener(
        "input",
        filterTrainers
      );

    trainerFolder
      ?.addEventListener(
        "change",
        filterTrainers
      );

    const trainerCards = () =>
      Array.from(
        this.element.querySelectorAll(
          "[data-trainer-card]"
        )
      );

    const filterTrainerCards = () => {
      const query = String(trainerSearch?.value ?? '')
        .trim()
        .toLocaleLowerCase();
      const folderId = String(trainerFolder?.value ?? '');
      let visible = 0;

      for (const card of trainerCards()) {
        const searchText = String(card.dataset.search ?? '').toLocaleLowerCase();
        const cardFolder = String(card.dataset.folderId ?? '');
        const show = (!query || searchText.includes(query))
          && (!folderId || cardFolder === folderId);
        card.hidden = !show;
        if (show) visible++;
      }

      const empty = this.element.querySelector('[data-trainer-empty]');
      if (empty) empty.hidden = visible > 0;
    };

    trainerSearch?.addEventListener('input', filterTrainerCards);
    trainerFolder?.addEventListener('change', filterTrainerCards);

    for (const card of trainerCards()) {
      card.addEventListener('click', () => {
        const id = card.dataset.trainerCard;
        if (!id) return;

        this.config.trainerId = id;
        if (trainerSelect) trainerSelect.value = id;

        for (const other of trainerCards()) {
          other.classList.toggle('selected', other === card);
        }

        const next = this.element.querySelector("[data-action='builderNext']");
        if (next && this.step === 2) next.disabled = false;
      });
    }

    filterTrainerCards();

    trainerSelect
      ?.addEventListener(
        "change",
        async event => {
          this.config.trainerId = event.currentTarget.value;
          await this.render({ force: true });
        }
      );

    field("genderId")
      ?.addEventListener(
        "change",
        async event => {
          this.genderId =
            event.currentTarget.value;
          await this.render({
            force: true
          });
        }
      );

    field("destination")
      ?.addEventListener(
        "change",
        event => {
          this.config.destination =
            event.currentTarget.value;
        }
      );

    field("natureId")
      ?.addEventListener(
        "change",
        async event => {
          this.natureId =
            event.currentTarget.value;
          await this.render({
            force: true
          });
        }
      );

    field("abilityId")
      ?.addEventListener(
        "change",
        async event => {
          this.abilityId =
            event.currentTarget.value;
          await this.render({
            force: true
          });
        }
      );

    field("weaknessStat")
      ?.addEventListener(
        "change",
        event => {
          this.weaknessStat =
            event.currentTarget.value;
        }
      );

    field("customWeakness")
      ?.addEventListener(
        "input",
        event => {
          this.customWeakness =
            event.currentTarget.value;
        }
      );

    for (
      const checkbox
      of this.element.querySelectorAll(
        "[data-builder-move]"
      )
    ) {
      checkbox.addEventListener(
        "change",
        event => {
          const id =
            event.currentTarget
              .dataset.builderMove;

          if (!id) return;

          if (
            event.currentTarget.checked
          ) {
            if (
              this.selectedMoveIds.size
              >=
              4
            ) {
              event.currentTarget.checked =
                false;

              ui.notifications.warn(
                "Escolha no máximo 4 golpes."
              );

              return;
            }

            this.selectedMoveIds.add(
              id
            );
          } else {
            this.selectedMoveIds.delete(
              id
            );
          }

          const counter =
            this.element.querySelector(
              "[data-builder-move-count]"
            );

          if (counter) {
            counter.textContent =
              String(
                this.selectedMoveIds.size
              );
          }
        }
      );
    }

    this.element
      .querySelector(
        "[data-action='builderBack']"
      )
      ?.addEventListener(
        "click",
        async () => {
          if (this.busy) return;

          if (this.step <= 1) {
            await this.close();
            return;
          }

          this.step--;

          await this.render({
            force: true
          });
        }
      );

    this.element
      .querySelector(
        "[data-action='builderNext']"
      )
      ?.addEventListener(
        "click",
        async () => {
          if (this.busy) return;

          if (
            this.step === 2
            &&
            this.config.mode ===
              "trainer"
            &&
            !this.config.trainerId
          ) {
            ui.notifications.warn(
              "Escolha o treinador."
            );
            return;
          }

          if (
            this.step === 2
          ) {
            await this._ensureData();
          }

          if (
            this.step === 4
            &&
            (
              this.selectedMoveIds.size
                < 1
              ||
              this.selectedMoveIds.size
                > 4
            )
          ) {
            ui.notifications.warn(
              "Escolha entre 1 e 4 golpes."
            );
            return;
          }

          if (this.step < 5) {
            this.step++;
          }

          await this.render({
            force: true
          });
        }
      );

    this.element
      .querySelector(
        "[data-action='builderCreate']"
      )
      ?.addEventListener(
        "click",
        async event => {
          if (this.busy) return;

          this.busy = true;

          const button =
            event.currentTarget;

          button.disabled = true;
          button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Criando...';

          try {
            await this._ensureData();

            const built =
              this._buildReview();

            this.data.ability =
              built.ability;

            this.data.moves =
              built.moves;

            const definition =
              await this.prepareDefinition(
                this.entry
              );

            const result = await createChallenge(
              this.entry,
              this.config,
              this.data,
              built.review,
              definition,
              this.existingActor
            );

            ui.notifications.info(
              `${this.entry.name} criado com sucesso.`
            );

            await this.close();

            return result;

          } catch (error) {
            console.error(
              "Pokemon LITM Tools | Challenge Wizard:",
              error
            );

            ui.notifications.error(
              "Não foi possível criar o Pokémon. Veja F12."
            );

            this.busy = false;
            button.disabled = false;
            button.innerHTML =
              '<i class="fa-solid fa-check"></i> Criar Pokémon';
          }
        }
      );
  }

  async close(options = {}) {
    const result =
      await super.close(options);

    if (
      pokemonBuilderWizardApp ===
      this
    ) {
      pokemonBuilderWizardApp =
        null;
    }

    return result;
  }
}


export async function openPokemonBuilder(entry, prepareDefinition, options = {}) {
  if (!game.user.isGM) return null;

  if (
    !entry
    ||
    entry.category !== "pokemon"
  ) {
    throw new Error(
      "O Builder aceita apenas Pokémon."
    );
  }

  if (
    typeof prepareDefinition
    !==
    "function"
  ) {
    throw new Error(
      "Serviço visual do importador indisponível."
    );
  }

  if (
    pokemonBuilderWizardApp
    &&
    pokemonBuilderWizardApp.rendered
  ) {
    await pokemonBuilderWizardApp.close();
  }

  pokemonBuilderWizardApp =
    new PokemonChallengeWizardApp(
      entry,
      prepareDefinition,
      options
    );

  pokemonBuilderWizardApp.render({
    force: true
  });

  return pokemonBuilderWizardApp;
}
