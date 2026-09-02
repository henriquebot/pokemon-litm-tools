import { getPokemonDbUrl } from "./pokemon-links.js";

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
  const pokemonId = Number(entry.pokemonId ?? entry.dex);
  if (!Number.isInteger(pokemonId) || pokemonId < 1) {
    throw new Error("Pokémon sem número de Pokédex válido.");
  }

  const pokemon = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
  const types = (pokemon.types ?? [])
    .slice()
    .sort((a, b) => Number(a.slot) - Number(b.slot))
    .map(row => row.type?.name)
    .filter(Boolean);

  const stats = {};
  for (const row of pokemon.stats ?? []) {
    if (row.stat?.name) stats[row.stat.name] = Number(row.base_stat ?? 0);
  }

  const typeEffectiveness = {};
  for (const defendedType of types) {
    try {
      const detail = await fetchJson(`https://pokeapi.co/api/v2/type/${defendedType}`);
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

  const candidates = [];
  for (const move of pokemon.moves ?? []) {
    const level = levelForMove(move);
    if (level === null) continue;
    candidates.push({
      id: move.move.name,
      url: move.move.url,
      level
    });
  }

  const maxLevel = MIGHT[might]?.maxLevel ?? 45;
  let pool = candidates
    .filter(move => move.level <= maxLevel)
    .sort((a, b) => b.level - a.level || a.id.localeCompare(b.id));

  if (pool.length < 8) {
    const seen = new Set(pool.map(move => move.id));
    for (const move of candidates.sort((a, b) => a.level - b.level)) {
      if (seen.has(move.id)) continue;
      pool.push(move);
      seen.add(move.id);
      if (pool.length >= 12) break;
    }
  }

  if (!pool.length) {
    pool = (pokemon.moves ?? []).slice(0, 12).map(row => ({
      id: row.move.name,
      url: row.move.url,
      level: 1
    }));
  }

  const details = await Promise.all(
    pool.slice(0, 14).map(async move => {
      try {
        const detail = await fetchJson(move.url);
        return {
          id: detail.name,
          name: localizedName(detail.names, detail.name),
          type: detail.type?.name ?? "normal",
          damageClass: detail.damage_class?.name ?? "status",
          power: Number(detail.power ?? 0),
          accuracy: Number(detail.accuracy ?? 0),
          level: move.level
        };
      } catch (error) {
        console.warn("Pokemon LITM Tools | Move:", move.id, error);
        return null;
      }
    })
  );

  const ranked = details.filter(Boolean).sort((a, b) => {
    const score = move =>
      (types.includes(move.type) ? 60 : 0)
      + (move.power || 30)
      + Math.min(move.accuracy || 80, 100) / 10
      + move.level * 0.5;
    return score(b) - score(a) || a.name.localeCompare(b.name);
  });

  const moves = [];
  for (const move of ranked) {
    if (moves.some(existing => existing.id === move.id)) continue;
    moves.push(move);
    if (moves.length >= 4) break;
  }

  if (!moves.length) {
    throw new Error("Não encontrei golpes utilizáveis para este Pokémon.");
  }

  const statOrder = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];
  const statRows = statOrder.map(name => ({ name, value: Number(stats[name] ?? 0) }));
  const best = statRows.reduce((a, b) => b.value > a.value ? b : a, statRows[0]);
  const worst = statRows.reduce((a, b) => b.value < a.value ? b : a, statRows[0]);

  return {
    pokemonId,
    types,
    stats,
    typeEffectiveness,
    moves,
    best,
    worst,
    powerStatTag: STAT_TEXT[best.name]?.power ?? "Talento marcante",
    weaknessTag: STAT_TEXT[worst.name]?.weakness ?? "Ponto fraco evidente"
  };
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
  const trainers =
    trainerOptions();

  const trainerChoices =
    trainers
      .map(
        actor =>
          `<option value="${actor.id}">${escapeHTML(actor.name)}</option>`
      )
      .join("");

  const folderChoices =
    actorFolderOptions();

  const rememberedFolder =
    String(
      game.settings.get(
        MODULE_ID,
        "lastActorFolder"
      )
      ?? ""
    );

  const rootSelected =
    rememberedFolder
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
            `${entry.name} · Pokémon Builder`
        },

        content: `
          <div class="pokemon-builder-config">

            <div class="pokemon-builder-field">

              <label>
                Criar como
              </label>

              <select name="mode">

                <option value="challenge">
                  Challenge / NPC
                </option>

                <option value="trainer">
                  Adicionar a Treinador
                </option>

              </select>

            </div>


            <div class="pokemon-builder-field">

              <label>
                Might
              </label>

              <select name="might">

                <option value="origin">
                  Origin
                </option>

                <option
                  value="adventure"
                  selected
                >
                  Adventure
                </option>

                <option value="greatness">
                  Greatness
                </option>

              </select>

            </div>


            <div class="pokemon-builder-challenge-fields">

              <div class="pokemon-builder-section-title">
                Destino do Challenge
              </div>

              <div class="pokemon-builder-field">

                <label>
                  Pasta de Actors
                </label>

                <select name="folderId">

                  <option
                    value=""
                    ${rootSelected}
                  >
                    Raiz de Actors
                  </option>

                  ${folderChoices}

                </select>

              </div>


              <div class="pokemon-builder-field">

                <label>
                  Ou criar nova pasta
                </label>

                <input
                  type="text"
                  name="newFolder"
                  placeholder="Ex.: Pokémon Selvagens"
                >

              </div>

            </div>


            <div class="pokemon-builder-trainer-fields">

              <div class="pokemon-builder-section-title">
                Destino do Pokémon
              </div>

              <div class="pokemon-builder-field">

                <label>
                  Treinador
                </label>

                <select name="trainerId">

                  <option value="">
                    Escolha um treinador
                  </option>

                  ${trainerChoices}

                </select>

              </div>


              <div class="pokemon-builder-field">

                <label>
                  Destino
                </label>

                <select name="destination">

                  <option value="team">
                    Time
                  </option>

                  <option value="pc">
                    PC
                  </option>

                </select>

              </div>

            </div>

          </div>
        `,

        ok: {
          label:
            "Gerar prévia",

          icon:
            "fa-solid fa-wand-magic-sparkles"
        },

        modal:
          true
      });

  if (!result) {
    return null;
  }

  const config = {
    mode:
      String(
        result.mode
        ?? "challenge"
      ),

    might:
      String(
        result.might
        ?? "adventure"
      ),

    trainerId:
      String(
        result.trainerId
        ?? ""
      ),

    destination:
      String(
        result.destination
        ?? "team"
      ),

    folderId:
      String(
        result.folderId
        ?? ""
      ),

    newFolder:
      String(
        result.newFolder
        ?? ""
      ).trim()
  };

  if (
    config.mode === "trainer"
    &&
    !config.trainerId
  ) {
    throw new Error(
      "Escolha o treinador que receberá o Pokémon."
    );
  }

  return config;
}


async function reviewBuild(entry, config, data) {
  const typeText = data.types.map(type => TYPE_PT[type] ?? titleCase(type)).join(" / ");
  const statText = Object.entries(data.stats)
    .map(([name, value]) => `${titleCase(name)} ${value}`)
    .join(" · ");

  const moveInputs = data.moves.map((move, index) => `
    <div class="form-group">
      <label>${escapeHTML(TYPE_PT[move.type] ?? titleCase(move.type))}</label>
      <div class="form-fields">
        <input type="text" name="move${index}" value="${escapeHTML(move.name)}">
      </div>
    </div>
  `).join("");

  const result = await foundry.applications.api.DialogV2.input({
    window: { title: `Revisar · ${entry.name}` },
    content: `
      <div style="display:flex;flex-direction:column;gap:10px;padding:8px">
        <p><strong>${escapeHTML(MIGHT[config.might]?.label ?? config.might)}</strong> · ${escapeHTML(typeText)}</p>
        <small>${escapeHTML(statText)}</small>
        <hr>
        ${moveInputs}
        <div class="form-group">
          <label>Tag de Poder (stat)</label>
          <div class="form-fields">
            <input type="text" name="powerStatTag" value="${escapeHTML(data.powerStatTag)}">
          </div>
        </div>
        <div class="form-group">
          <label>Tag de Fraqueza</label>
          <div class="form-fields">
            <input type="text" name="weaknessTag" value="${escapeHTML(data.weaknessTag)}">
          </div>
        </div>
      </div>
    `,
    ok: { label: "Criar Pokémon", icon: "fa-solid fa-check" },
    modal: true
  });

  if (!result) return null;
  return {
    moveNames: data.moves.map((move, index) => String(result[`move${index}`] ?? move.name).trim() || move.name),
    powerStatTag: String(result.powerStatTag ?? data.powerStatTag).trim() || data.powerStatTag,
    weaknessTag: String(result.weaknessTag ?? data.weaknessTag).trim() || data.weaknessTag
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

function themeSystem(review) {
  return {
    type: "litm-variable",
    color: "litm-variable",
    quest: "",
    story: "",
    tabCategory: "main",
    powertags: [...review.moveNames.map(powerTag), powerTag(review.powerStatTag)],
    weaknesstags: [powerTag(review.weaknessTag)],
    options: { isStoryTheme: false }
  };
}

function moduleMetadata(entry, definition, config, data, review, instanceId) {
  return {
    ...foundry.utils.deepClone(definition.moduleFlags),
    pokemonBuilder: true,
    pokemonInstanceId: instanceId,
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
      learnedAt: move.level
    })),
    tagBindings: data.moves.map((move, index) => ({
      tagIndex: index,
      tagName: review.moveNames[index],
      kind: "pokemonMove",
      moveId: move.id,
      type: move.type,
      vfx: `${move.type}-move`
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

async function createChallenge(entry, config, data, review, definition) {
  const instanceId = randomId();
  const flags = moduleMetadata(entry, definition, config, data, review, instanceId);
  const types = data.types.map(type => TYPE_PT[type] ?? titleCase(type));
  const mightyAspects = config.might === "origin" ? [] : [{
    level: config.might,
    aspect: "Poder Pokémon",
    mightIcon: config.might
  }];
  const limitTier = { origin: "3", adventure: "4", greatness: "5" }[config.might] ?? "4";
  const folderId =
    await resolveChallengeFolder(
      config
    );

  const actor = await Actor.implementation.create({
    name: entry.name,
    type: "litm-npc",
    ...(folderId ? { folder: folderId } : {}),
    img: definition.portraitPath,
    system: {
      editMode: false,
      shortDescription: `Pokémon · ${types.join(" / ")}`,
      biography: "",
      difficulty: 1,
      roles: ["Pokémon", ...types],
      mightyAspects,
      limits: [{ name: "Derrotado", value: limitTier, consequence: "Fora de combate" }],
      secrets: [],
      specialFeatures: [{ name: "Tipos", description: types.join(" / ") }],
      threatsAndConsequences: [],
      floatingTagsAndStatusesEditable: false,
      floatingTagsAndStatuses: [
        ...review.moveNames.map(name => floatingTag(name, true)),
        floatingTag(review.powerStatTag, true),
        floatingTag(review.weaknessTag, false)
      ]
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
    system: themeSystem(review),
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
