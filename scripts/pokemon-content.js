const MODULE_ID = "pokemon-litm-tools";

const TYPE_PTBR = {
  normal: "Normal",
  fire: "Fogo",
  water: "Água",
  electric: "Elétrico",
  grass: "Planta",
  ice: "Gelo",
  fighting: "Lutador",
  poison: "Venenoso",
  ground: "Terrestre",
  flying: "Voador",
  psychic: "Psíquico",
  bug: "Inseto",
  rock: "Pedra",
  ghost: "Fantasma",
  dragon: "Dragão",
  dark: "Sombrio",
  steel: "Aço",
  fairy: "Fada"
};

const STAT_PTBR = {
  hp: "HP",
  attack: "Ataque",
  defense: "Defesa",
  "special-attack": "Ataque Especial",
  "special-defense": "Defesa Especial",
  speed: "Velocidade"
};

const DAMAGE_CLASS_PTBR = {
  physical: "Físico",
  special: "Especial",
  status: "Efeito"
};

const NATURES = {
  hardy: { pt: "Resistente", en: "Hardy", limitsPt: ["Abalado", "Exausto"], limitsEn: ["Shaken", "Exhausted"] },
  lonely: { pt: "Solitário", en: "Lonely", limitsPt: ["Isolado", "Desamparado"], limitsEn: ["Isolated", "Forsaken"] },
  adamant: { pt: "Adamante", en: "Adamant", limitsPt: ["Frustrado", "Provocado"], limitsEn: ["Frustrated", "Provoked"] },
  naughty: { pt: "Travesso", en: "Naughty", limitsPt: ["Repreendido", "Encurralado"], limitsEn: ["Reprimanded", "Cornered"] },
  brave: { pt: "Corajoso", en: "Brave", limitsPt: ["Assustado", "Intimidado"], limitsEn: ["Frightened", "Intimidated"] },
  bold: { pt: "Audacioso", en: "Bold", limitsPt: ["Pressionado", "Intimidado"], limitsEn: ["Pressured", "Intimidated"] },
  docile: { pt: "Dócil", en: "Docile", limitsPt: ["Pressionado", "Subjugado"], limitsEn: ["Pressured", "Subdued"] },
  impish: { pt: "Travesso", en: "Impish", limitsPt: ["Repreendido", "Desconcertado"], limitsEn: ["Reprimanded", "Unsettled"] },
  lax: { pt: "Relaxado", en: "Lax", limitsPt: ["Distraído", "Desprevenido"], limitsEn: ["Distracted", "Off Guard"] },
  relaxed: { pt: "Relaxado", en: "Relaxed", limitsPt: ["Apressado", "Descompassado"], limitsEn: ["Rushed", "Off Balance"] },
  modest: { pt: "Modesto", en: "Modest", limitsPt: ["Exposto", "Constrangido"], limitsEn: ["Exposed", "Embarrassed"] },
  mild: { pt: "Gentil", en: "Mild", limitsPt: ["Abalado", "Hostilizado"], limitsEn: ["Shaken", "Harassed"] },
  bashful: { pt: "Tímido", en: "Bashful", limitsPt: ["Envergonhado", "Acuado"], limitsEn: ["Embarrassed", "Cornered"] },
  rash: { pt: "Impulsivo", en: "Rash", limitsPt: ["Frustrado", "Precipitado"], limitsEn: ["Frustrated", "Reckless"] },
  quiet: { pt: "Silencioso", en: "Quiet", limitsPt: ["Perturbado", "Desconcentrado"], limitsEn: ["Disturbed", "Distracted"] },
  calm: { pt: "Calmo", en: "Calm", limitsPt: ["Agitado", "Desestabilizado"], limitsEn: ["Agitated", "Unsettled"] },
  gentle: { pt: "Gentil", en: "Gentle", limitsPt: ["Hostilizado", "Abalado"], limitsEn: ["Harassed", "Shaken"] },
  careful: { pt: "Cuidadoso", en: "Careful", limitsPt: ["Surpreendido", "Desprevenido"], limitsEn: ["Surprised", "Off Guard"] },
  quirky: { pt: "Peculiar", en: "Quirky", limitsPt: ["Confuso", "Desorientado"], limitsEn: ["Confused", "Disoriented"] },
  sassy: { pt: "Atrevido", en: "Sassy", limitsPt: ["Contrariado", "Provocado"], limitsEn: ["Contradicted", "Provoked"] },
  timid: { pt: "Tímido", en: "Timid", limitsPt: ["Assustado", "Acuado"], limitsEn: ["Frightened", "Cornered"] },
  hasty: { pt: "Apressado", en: "Hasty", limitsPt: ["Preso", "Frustrado"], limitsEn: ["Restrained", "Frustrated"] },
  jolly: { pt: "Alegre", en: "Jolly", limitsPt: ["Desanimado", "Abalado"], limitsEn: ["Discouraged", "Shaken"] },
  naive: { pt: "Ingênuo", en: "Naive", limitsPt: ["Enganado", "Confuso"], limitsEn: ["Deceived", "Confused"] },
  serious: { pt: "Sério", en: "Serious", limitsPt: ["Desconcertado", "Frustrado"], limitsEn: ["Unsettled", "Frustrated"] }
};

const MOVE_PTBR = {
  pound: "Golpe", "karate-chop": "Golpe de Caratê", "double-slap": "Tapa Duplo", "comet-punch": "Soco Cometa",
  "mega-punch": "Mega Soco", "pay-day": "Dia de Pagamento", "fire-punch": "Soco de Fogo", "ice-punch": "Soco de Gelo",
  "thunder-punch": "Soco Trovoada", scratch: "Arranhão", "vice-grip": "Aperto de Garra", guillotine: "Guilhotina",
  "razor-wind": "Vento Cortante", "swords-dance": "Dança das Espadas", cut: "Corte", gust: "Ventania",
  "wing-attack": "Ataque de Asa", whirlwind: "Redemoinho", fly: "Voar", bind: "Ligação", slam: "Pancada",
  "vine-whip": "Chicote de Vinha", stomp: "Pisotear", "double-kick": "Chute Duplo", "mega-kick": "Mega Chute",
  "jump-kick": "Chute Salto", "rolling-kick": "Chute Giratório", "sand-attack": "Ataque de Areia", headbutt: "Cabeçada",
  "horn-attack": "Ataque de Chifre", "fury-attack": "Ataque de Fúria", "horn-drill": "Broca de Chifre", tackle: "Investida",
  "body-slam": "Jogo de Corpo", wrap: "Envolver", "take-down": "Derrubada", thrash: "Agitação",
  "double-edge": "Faca de Dois Gumes", "tail-whip": "Chicote de Cauda", "poison-sting": "Picada Venenosa",
  twineedle: "Agulha Dupla", "pin-missile": "Míssil de Espinhos", leer: "Encarar", bite: "Mordida", growl: "Rosnado",
  roar: "Rugido", sing: "Cantar", supersonic: "Supersônico", "sonic-boom": "Explosão Sônica", disable: "Inabilitar",
  acid: "Ácido", ember: "Brasa", flamethrower: "Lança-Chamas", mist: "Névoa", "water-gun": "Jato de Água",
  "hydro-pump": "Hidrobomba", surf: "Surfar", "ice-beam": "Raio de Gelo", blizzard: "Nevasca", psybeam: "Raio Psíquico",
  "bubble-beam": "Raio de Bolhas", "aurora-beam": "Raio Aurora", "hyper-beam": "Hiper-raio", peck: "Bicada",
  "drill-peck": "Bicada Broca", submission: "Submissão", "low-kick": "Chute Baixo", counter: "Contra-Ataque",
  "seismic-toss": "Arremesso Sísmico", strength: "Força", absorb: "Absorção", "mega-drain": "Mega Dreno",
  "leech-seed": "Semente Sanguessuga", growth: "Crescimento", "razor-leaf": "Folha Navalha", "solar-beam": "Raio Solar",
  "poison-powder": "Pó Venenoso", "stun-spore": "Esporos Paralisantes", "sleep-powder": "Pó do Sono",
  "petal-dance": "Dança das Pétalas", "string-shot": "Tiro de Seda", "dragon-rage": "Fúria do Dragão",
  "fire-spin": "Giro de Fogo", "thunder-shock": "Choque do Trovão", thunderbolt: "Relâmpago",
  "thunder-wave": "Onda de Trovão", thunder: "Trovão", "rock-throw": "Arremesso de Pedra", earthquake: "Terremoto",
  fissure: "Fissura", dig: "Cavar", toxic: "Tóxico", confusion: "Confusão", psychic: "Psíquico", hypnosis: "Hipnose",
  meditate: "Meditação", agility: "Agilidade", "quick-attack": "Ataque Rápido", rage: "Ira", teleport: "Teleporte",
  "night-shade": "Sombra Noturna", mimic: "Mímica", screech: "Guincho", "double-team": "Duplicar", recover: "Recuperação",
  harden: "Endurecer", minimize: "Minimizar", smokescreen: "Cortina de Fumaça", "confuse-ray": "Raio Confuso",
  withdraw: "Recolher", "defense-curl": "Espiral de Defesa", barrier: "Barreira", "light-screen": "Tela de Luz",
  haze: "Neblina", reflect: "Refletir", "focus-energy": "Focalizar Energia", bide: "Paciência", metronome: "Metrônomo",
  "mirror-move": "Movimento Espelho", "self-destruct": "Autodestruição", "egg-bomb": "Bomba de Ovo", lick: "Lambida",
  smog: "Fumaça", sludge: "Lodo", "bone-club": "Clava de Osso", "fire-blast": "Explosão de Fogo", waterfall: "Cachoeira",
  clamp: "Prender", swift: "Estrela Cadente", "skull-bash": "Cabeçada de Crânio", "spike-cannon": "Canhão de Espinhos",
  constrict: "Constrição", amnesia: "Amnésia", kinesis: "Cinese", "soft-boiled": "Ovos Moles",
  "high-jump-kick": "Chute Salto Alto", glare: "Olhar Paralisante", "dream-eater": "Comedor de Sonhos",
  "poison-gas": "Gás Venenoso", barrage: "Barragem", "leech-life": "Sangue-Suga", "lovely-kiss": "Beijo Amoroso",
  "sky-attack": "Ataque Aéreo", transform: "Transformação", bubble: "Bolha", "dizzy-punch": "Soco Tonto", spore: "Esporo",
  flash: "Clarão", psywave: "Onda Psíquica", splash: "Borrifo", "acid-armor": "Armadura Ácida",
  crabhammer: "Martelo Caranguejo", explosion: "Explosão", "fury-swipes": "Golpes de Fúria", bonemerang: "Bumerangue de Osso",
  rest: "Descanso", "rock-slide": "Deslizamento de Pedra", "hyper-fang": "Hiperpresa", sharpen: "Afiar", conversion: "Conversão",
  "tri-attack": "Triataque", "super-fang": "Superpresa", slash: "Talho", substitute: "Substituto", struggle: "Insistência",
  sketch: "Esboço", "triple-kick": "Chute Triplo", thief: "Ladrão", "spider-web": "Teia de Aranha",
  "mind-reader": "Leitura Mental", nightmare: "Pesadelo", "flame-wheel": "Roda de Fogo", snore: "Ronco", curse: "Maldição",
  flail: "Debater", "conversion-2": "Conversão 2", aeroblast: "Aeroblast", "cotton-spore": "Esporo de Algodão",
  reversal: "Reversão", spite: "Rancor", "powder-snow": "Neve em Pó", protect: "Proteção", "mach-punch": "Soco Mach",
  "scary-face": "Face Assustadora", "feint-attack": "Ataque Fingido", "sweet-kiss": "Beijo Doce",
  "belly-drum": "Tambor Barrigudo", "sludge-bomb": "Bomba de Lodo", "mud-slap": "Tapa de Lama", octazooka: "Octazooka",
  spikes: "Espinhos", "zap-cannon": "Canhão Zap", foresight: "Antecipação", "destiny-bond": "Laço do Destino",
  "perish-song": "Canção da Morte", "icy-wind": "Vento Gelado", detect: "Detectar", "bone-rush": "Rajada de Ossos",
  "lock-on": "Travar Mira", outrage: "Ultraje", sandstorm: "Tempestade de Areia", "giga-drain": "Giga Dreno",
  endure: "Suportar", charm: "Encanto", rollout: "Rolamento", "false-swipe": "Falso Golpe", swagger: "Arrogância",
  "milk-drink": "Leite de Cura", spark: "Faísca", "fury-cutter": "Cortador de Fúria", "steel-wing": "Asa de Aço",
  "mean-look": "Olhar Malvado", attract: "Atração", "sleep-talk": "Falar Dormindo", "heal-bell": "Sino de Cura",
  return: "Retorno", present: "Presente", frustration: "Frustração", safeguard: "Salvaguarda", "pain-split": "Divisão de Dor",
  "sacred-fire": "Fogo Sagrado", magnitude: "Magnitude", "dynamic-punch": "Soco Dinâmico", megahorn: "Megachifre",
  "dragon-breath": "Sopro do Dragão", "baton-pass": "Passagem de Bastão", encore: "Bis", pursuit: "Perseguição",
  "rapid-spin": "Giro Rápido", "sweet-scent": "Aroma Doce", "iron-tail": "Cauda de Ferro", "metal-claw": "Garra de Metal",
  "vital-throw": "Arremesso Vital", "morning-sun": "Sol da Manhã", synthesis: "Síntese", moonlight: "Luar",
  "hidden-power": "Poder Oculto", "cross-chop": "Golpe Cruzado", twister: "Tornado", "rain-dance": "Dança da Chuva",
  "sunny-day": "Dia Ensolarado", crunch: "Mastigada", "mirror-coat": "Revestimento Espelho", "psych-up": "Autoestimular",
  "extreme-speed": "Velocidade Extrema", "ancient-power": "Poder Ancestral", "shadow-ball": "Bola Sombria",
  "future-sight": "Visão do Futuro", "rock-smash": "Quebra-Rocha", whirlpool: "Redemoinho", "beat-up": "Espancamento",
  "seed-bomb": "Bomba de Sementes", "energy-ball": "Bola de Energia", "aqua-tail": "Cauda d'Água", "air-slash": "Corte de Ar",
  roost: "Poleiro", "brave-bird": "Pássaro Bravo", "leaf-storm": "Tempestade de Folhas", "power-whip": "Chicote Poderoso"
};

const MOVE_WORD_PTBR = {
  acid: "Ácido", air: "Ar", aqua: "Água", attack: "Ataque", aura: "Aura", ball: "Bola", beam: "Raio",
  blast: "Explosão", body: "Corpo", bomb: "Bomba", bone: "Osso", brave: "Bravo", bubble: "Bolha", bullet: "Projétil",
  charge: "Carga", claw: "Garra", combat: "Combate", crunch: "Mastigada", dance: "Dança", double: "Duplo", dragon: "Dragão",
  drain: "Dreno", drill: "Broca", edge: "Gume", energy: "Energia", fang: "Presa", fire: "Fogo", flame: "Chama",
  flash: "Clarão", fury: "Fúria", giga: "Giga", grass: "Planta", gust: "Ventania", head: "Cabeça", horn: "Chifre",
  hydro: "Hidro", hyper: "Hiper", ice: "Gelo", iron: "Ferro", kick: "Chute", leaf: "Folha", light: "Luz",
  mega: "Mega", metal: "Metal", moon: "Lua", mud: "Lama", night: "Noite", poison: "Veneno", powder: "Pó",
  power: "Poder", punch: "Soco", quick: "Rápido", rain: "Chuva", razor: "Navalha", rock: "Pedra", sand: "Areia",
  seed: "Semente", shadow: "Sombra", shock: "Choque", skull: "Crânio", sleep: "Sono", sludge: "Lodo", solar: "Solar",
  sonic: "Sônico", spike: "Espinho", steel: "Aço", storm: "Tempestade", tail: "Cauda", thunder: "Trovão",
  toxic: "Tóxico", vine: "Vinha", water: "Água", wave: "Onda", whip: "Chicote", wing: "Asa", wind: "Vento"
};

const ABILITY_PTBR = {
  overgrow: "Supercrescimento", chlorophyll: "Clorofila", blaze: "Chama", "solar-power": "Poder Solar",
  torrent: "Torrente", "rain-dish": "Prato de Chuva", "shield-dust": "Pó Escudo", "run-away": "Fuga",
  "shed-skin": "Troca de Pele", "compound-eyes": "Olhos Compostos", swarm: "Enxame", "keen-eye": "Olho Aguçado",
  "tangled-feet": "Pés Emaranhados", guts: "Coragem", hustle: "Ímpeto", intimidate: "Intimidação", static: "Estática",
  "sand-veil": "Véu de Areia", "poison-point": "Ponto Venenoso", rivalry: "Rivalidade", "cute-charm": "Charme Fofo",
  "flash-fire": "Fogo Relâmpago", "inner-focus": "Foco Interno", "effect-spore": "Esporo de Efeito", "dry-skin": "Pele Seca",
  "tinted-lens": "Lente Colorida", "arena-trap": "Armadilha de Arena", pickup: "Coleta", technician: "Técnico",
  limber: "Flexível", damp: "Umidade", "cloud-nine": "Nuvem Nove", "vital-spirit": "Espírito Vital",
  "anger-point": "Ponto de Fúria", "water-absorb": "Absorção de Água", synchronize: "Sincronizar", "no-guard": "Sem Guarda",
  sturdy: "Robustez", "rock-head": "Cabeça de Pedra", "magnet-pull": "Atração Magnética", "early-bird": "Madrugador",
  "thick-fat": "Gordura Grossa", hydration: "Hidratação", "shell-armor": "Armadura de Casco", "skill-link": "Ligação de Habilidade",
  levitate: "Levitação", "cursed-body": "Corpo Amaldiçoado", insomnia: "Insônia", "hyper-cutter": "Hipercortador",
  soundproof: "À Prova de Som", "lightning-rod": "Para-Raios", "serene-grace": "Graça Serena", "swift-swim": "Nado Rápido",
  sniper: "Atirador", "sticky-hold": "Aderência", "suction-cups": "Ventosas", "flame-body": "Corpo em Chamas",
  "own-tempo": "Ritmo Próprio", oblivious: "Distraído", trace: "Rastrear", download: "Download",
  "battle-armor": "Armadura de Batalha", pressure: "Pressão", immunity: "Imunidade", gluttony: "Gula",
  "marvel-scale": "Escama Maravilhosa", adaptability: "Adaptabilidade", anticipation: "Antecipação", "volt-absorb": "Absorção de Voltagem",
  "quick-feet": "Pés Rápidos", "natural-cure": "Cura Natural", "leaf-guard": "Guarda Folha", "magic-guard": "Guarda Mágica",
  "sturdy": "Robustez", "rough-skin": "Pele Áspera", "clear-body": "Corpo Puro", "liquid-ooze": "Lodo Líquido"
};

const AILMENT_PTBR = {
  paralysis: "paralisado", burn: "queimado", freeze: "congelado", poison: "envenenado",
  "bad-poison": "gravemente-envenenado", sleep: "adormecido", confusion: "confuso", infatuation: "encantado",
  trap: "preso", nightmare: "atormentado", torment: "atormentado", disable: "inabilitado", yawn: "sonolento"
};

const SPECIAL_MOVE_RULES = {
  "solar-beam": { charge: true }, "razor-wind": { charge: true }, "sky-attack": { charge: true }, "skull-bash": { charge: true },
  fly: { charge: true, evasive: true }, dig: { charge: true, evasive: true }, "hyper-beam": { recharge: true },
  bind: { trap: true }, wrap: { trap: true }, "fire-spin": { trap: true }, clamp: { trap: true }, whirlpool: { trap: true },
  "leech-seed": { statusPt: "drenado", statusEn: "seeded", statusLevel: 2 }, toxic: { statusPt: "gravemente-envenenado", statusEn: "badly-poisoned", statusLevel: 3 },
  protect: { selfPt: "protegido", selfEn: "protected", selfLevel: 3 }, detect: { selfPt: "protegido", selfEn: "protected", selfLevel: 3 },
  reflect: { selfPt: "protegido-contra-golpes", selfEn: "guarded-against-physical-attacks", selfLevel: 2 },
  "light-screen": { selfPt: "protegido-contra-ataques-especiais", selfEn: "guarded-against-special-attacks", selfLevel: 2 },
  substitute: { selfPt: "protegido-por-substituto", selfEn: "protected-by-substitute", selfLevel: 3 },
  rest: { selfPt: "adormecido", selfEn: "asleep", selfLevel: 3 }
};

const apiCache = new Map();

function titleCase(value) {
  return String(value ?? "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function escapeHTML(value) {
  const text = String(value ?? "");
  if (globalThis.foundry?.utils?.escapeHTML) {
    return foundry.utils.escapeHTML(text);
  }
  return text.replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}

function normalizeLanguage(value) {
  return value === "en" ? "en" : "pt-BR";
}

export function registerPokemonContentSettings() {
  game.settings.register(MODULE_ID, "pokemonContentLanguage", {
    name: "Idioma do conteúdo Pokémon",
    hint: "Idioma usado ao criar novos Pokémon. Alterar esta opção não modifica Pokémon já existentes.",
    scope: "world",
    config: true,
    type: String,
    choices: {
      "pt-BR": "Português (Brasil)",
      en: "English"
    },
    default: "pt-BR"
  });
}

export function getPokemonContentLanguage() {
  try {
    return normalizeLanguage(game.settings.get(MODULE_ID, "pokemonContentLanguage"));
  } catch {
    return "pt-BR";
  }
}

function exactLocalizedName(names, language) {
  const codes = language === "en" ? ["en"] : ["pt-BR", "pt"];
  for (const code of codes) {
    const found = names?.find(row => row.language?.name === code);
    if (found?.name) return String(found.name).trim();
  }
  return "";
}

export function typeLabel(id, language = getPokemonContentLanguage()) {
  return language === "en" ? titleCase(id) : (TYPE_PTBR[id] ?? titleCase(id));
}

export function statLabel(id, language = getPokemonContentLanguage()) {
  return language === "en" ? titleCase(id) : (STAT_PTBR[id] ?? titleCase(id));
}

export function damageClassLabel(id, language = getPokemonContentLanguage()) {
  return language === "en" ? titleCase(id) : (DAMAGE_CLASS_PTBR[id] ?? titleCase(id));
}

export function natureProfile(id, language = getPokemonContentLanguage()) {
  const source = NATURES[id] ?? NATURES.hardy;
  const isEn = language === "en";
  const limits = isEn ? source.limitsEn : source.limitsPt;
  return {
    id: NATURES[id] ? id : "hardy",
    label: isEn ? source.en : source.pt,
    limits: limits.map((name, index) => ({
      name,
      consequence: isEn
        ? (index === 0 ? "The Pokémon is put under pressure." : "The Pokémon loses control of the situation.")
        : (index === 0 ? "O Pokémon fica sob pressão." : "O Pokémon perde o controle da situação.")
    }))
  };
}

export function moveLabel(id, names = [], language = getPokemonContentLanguage()) {
  if (language === "en") {
    return exactLocalizedName(names, "en") || titleCase(id);
  }

  const exact = exactLocalizedName(names, "pt-BR");
  if (exact) return exact;
  if (MOVE_PTBR[id]) return MOVE_PTBR[id];

  const words = String(id ?? "").split("-").filter(Boolean);
  if (!words.length) return "Golpe";
  const translated = words.map(word => MOVE_WORD_PTBR[word] ?? titleCase(word));
  return translated.join(" ");
}

export function abilityLabel(id, names = [], language = getPokemonContentLanguage()) {
  if (language === "en") {
    return exactLocalizedName(names, "en") || titleCase(id);
  }
  const exact = exactLocalizedName(names, "pt-BR");
  return exact || ABILITY_PTBR[id] || titleCase(id);
}

export async function fetchPokeJson(url) {
  if (!apiCache.has(url)) {
    apiCache.set(url, (async () => {
      const response = await fetch(url, { cache: "force-cache" });
      if (!response.ok) throw new Error(`PokéAPI HTTP ${response.status}`);
      return response.json();
    })());
  }
  return apiCache.get(url);
}

function localizedFlavor(entries, language) {
  const codes = language === "en" ? ["en"] : ["pt-BR", "pt"];
  for (const code of codes) {
    const found = entries?.find(row => row.language?.name === code);
    if (found?.flavor_text) {
      return String(found.flavor_text).replace(/[\n\f]+/g, " ").replace(/\s+/g, " ").trim();
    }
  }
  return "";
}

export function choosePrimaryAbility(pokemon) {
  const entries = (pokemon?.abilities ?? []).slice().sort((a, b) => Number(a.slot ?? 99) - Number(b.slot ?? 99));
  return entries.find(row => !row.is_hidden) ?? entries[0] ?? null;
}

export function buildDexText({ pokemon, species, types, ability }, language = getPokemonContentLanguage()) {
  const flavor = localizedFlavor(species?.flavor_text_entries, language);
  if (flavor) return flavor;

  const typeText = types.map(type => typeLabel(type, language)).join(" / ");
  const abilityText = ability?.name || (language === "en" ? "Unknown" : "Desconhecida");
  const height = Number(pokemon?.height ?? 0) / 10;
  const weight = Number(pokemon?.weight ?? 0) / 10;

  if (language === "en") {
    const fallbackEnglish = localizedFlavor(species?.flavor_text_entries, "en");
    if (fallbackEnglish) return fallbackEnglish;
    return `A ${typeText || "Pokémon"} Pokémon. Height ${height.toFixed(1)} m, weight ${weight.toFixed(1)} kg. Main Ability: ${abilityText}.`;
  }

  return `Pokémon do tipo ${typeText || "desconhecido"}. Mede ${height.toFixed(1).replace(".", ",")} m e pesa ${weight.toFixed(1).replace(".", ",")} kg. Habilidade principal: ${abilityText}.`;
}

export function statPowerText(statId, language = getPokemonContentLanguage()) {
  const pt = {
    hp: "Resistência impressionante",
    attack: "Força física impressionante",
    defense: "Defesa resistente",
    "special-attack": "Poder especial excepcional",
    "special-defense": "Grande resistência especial",
    speed: "Veloz como um raio"
  };
  const en = {
    hp: "Impressive endurance",
    attack: "Impressive physical strength",
    defense: "Sturdy defense",
    "special-attack": "Exceptional special power",
    "special-defense": "Exceptional special resistance",
    speed: "Lightning fast"
  };
  return (language === "en" ? en : pt)[statId] ?? (language === "en" ? "Remarkable talent" : "Talento marcante");
}

export function statWeaknessText(statId, language = getPokemonContentLanguage()) {
  const pt = {
    attack: "Pouca força física",
    defense: "Frágil a impactos",
    "special-attack": "Poder especial limitado",
    "special-defense": "Vulnerável a ataques especiais",
    speed: "Lento para reagir"
  };
  const en = {
    attack: "Low physical strength",
    defense: "Fragile against impacts",
    "special-attack": "Limited special power",
    "special-defense": "Vulnerable to special attacks",
    speed: "Slow to react"
  };
  return (language === "en" ? en : pt)[statId] ?? (language === "en" ? "Visible weak point" : "Ponto fraco evidente");
}

export function typeDefenseGroups(effectiveness, language = getPokemonContentLanguage()) {
  const buckets = {
    immune: [], strongResist: [], resist: [], weak: [], strongWeak: []
  };

  for (const [type, raw] of Object.entries(effectiveness ?? {})) {
    const value = Number(raw);
    if (value === 0) buckets.immune.push({ type, value });
    else if (value > 0 && value <= 0.25) buckets.strongResist.push({ type, value });
    else if (value > 0 && value < 1) buckets.resist.push({ type, value });
    else if (value >= 4) buckets.strongWeak.push({ type, value });
    else if (value > 1) buckets.weak.push({ type, value });
  }

  const definitions = language === "en"
    ? [
        ["immune", "Immune to", true, "immunity"],
        ["strongResist", "Strongly resists", true, "resistance"],
        ["resist", "Resists", true, "resistance"],
        ["weak", "Vulnerable to", false, "weakness"],
        ["strongWeak", "Extremely vulnerable to", false, "weakness"]
      ]
    : [
        ["immune", "Imune a", true, "immunity"],
        ["strongResist", "Resiste muito a", true, "resistance"],
        ["resist", "Resiste a", true, "resistance"],
        ["weak", "Vulnerável a", false, "weakness"],
        ["strongWeak", "Muito vulnerável a", false, "weakness"]
      ];

  return definitions.flatMap(([key, label, positive, kind]) => {
    const rows = buckets[key];
    if (!rows.length) return [];
    const typeNames = rows.map(row => typeLabel(row.type, language));
    return [{
      name: `${label}: ${typeNames.join(", ")}`,
      positive,
      kind,
      types: rows.map(row => row.type),
      multipliers: Object.fromEntries(rows.map(row => [row.type, row.value]))
    }];
  });
}

function statusMarkup(name, level) {
  return `[/s ${String(name).trim().toLocaleLowerCase().replace(/\s+/g, "-")}-${level}]`;
}

function damageStatusLevel(power, might) {
  const base = might === "greatness" ? 3 : might === "adventure" ? 2 : 1;
  if (Number(power) >= 120) return Math.min(5, base + 1);
  if (Number(power) > 0 && Number(power) < 50) return Math.max(1, base - 1);
  return base;
}

function statStatusName(stat, direction, language) {
  const label = statLabel(stat, language).toLocaleLowerCase().replace(/\s+/g, "-");
  if (language === "en") return `${label}-${direction > 0 ? "raised" : "lowered"}`;
  return `${label}-${direction > 0 ? "aumentado" : "reduzido"}`;
}

export function buildMoveThreat(move, displayName, might, language = getPokemonContentLanguage()) {
  const type = typeLabel(move.type, language);
  const damageClass = damageClassLabel(move.damageClass, language);
  const accuracy = Number(move.accuracy ?? 0);
  const power = Number(move.power ?? 0);
  const meta = move.meta ?? {};
  const rule = SPECIAL_MOVE_RULES[move.id] ?? {};

  const descriptionParts = [];
  if (move.damageClass === "status" || power <= 0) {
    descriptionParts.push(language === "en"
      ? `Uses a ${type} technique (${damageClass}).`
      : `Usa uma técnica do tipo ${type} (${damageClass}).`);
  } else {
    descriptionParts.push(language === "en"
      ? `Attacks with a ${type} ${damageClass.toLocaleLowerCase()} move (Power ${power}${accuracy ? `, Accuracy ${accuracy}%` : ""}).`
      : `Ataca com um golpe ${damageClass.toLocaleLowerCase()} do tipo ${type} (Poder ${power}${accuracy ? `, Precisão ${accuracy}%` : ""}).`);
  }

  if (rule.charge) descriptionParts.push(language === "en" ? "Requires preparation before striking." : "Exige preparação antes de atacar.");
  if (rule.evasive) descriptionParts.push(language === "en" ? "The Pokémon becomes difficult to reach while preparing it." : "Durante a preparação, o Pokémon fica difícil de alcançar.");
  if (rule.recharge) descriptionParts.push(language === "en" ? "The Pokémon must recover after using it." : "Depois de usar o golpe, o Pokémon precisa se recuperar.");
  if (Number(meta.drain) > 0) descriptionParts.push(language === "en" ? "Recovers energy from the damage caused." : "Recupera energia com parte do dano causado.");
  if (Number(meta.drain) < 0) descriptionParts.push(language === "en" ? "The user suffers recoil." : "O usuário sofre dano de recuo.");
  if (Number(meta.healing) > 0) descriptionParts.push(language === "en" ? "Restores the user's vitality." : "Restaura a vitalidade do usuário.");
  if (Number(meta.criticalRate) > 0) descriptionParts.push(language === "en" ? "Has an increased chance of a critical hit." : "Tem chance aumentada de acerto crítico.");
  if (Number(meta.minHits) > 1 || Number(meta.maxHits) > 1) descriptionParts.push(language === "en" ? "Can hit several times in succession." : "Pode atingir várias vezes em sequência.");

  const consequences = [];
  if (power > 0 && move.damageClass !== "status") {
    const level = damageStatusLevel(power, might);
    consequences.push(language === "en"
      ? `A solid hit can leave the target ${statusMarkup("wounded", level)}.`
      : `Um acerto sólido pode deixar o alvo ${statusMarkup("ferido", level)}.`);
  }

  const ailment = meta.ailment;
  if (ailment && ailment !== "none" && ailment !== "unknown") {
    const status = language === "en" ? ailment.replace(/-/g, "-") : (AILMENT_PTBR[ailment] ?? ailment);
    const chance = Number(meta.ailmentChance ?? 0);
    const level = chance >= 100 || move.damageClass === "status" ? 3 : 2;
    consequences.push(language === "en"
      ? `Can leave the target ${statusMarkup(status, level)}${chance > 0 && chance < 100 ? ` (${chance}% chance)` : ""}.`
      : `Pode deixar o alvo ${statusMarkup(status, level)}${chance > 0 && chance < 100 ? ` (${chance}% de chance)` : ""}.`);
  }

  if (Number(meta.flinchChance) > 0) {
    consequences.push(language === "en"
      ? `Can leave the target ${statusMarkup("staggered", 2)} (${meta.flinchChance}% chance).`
      : `Pode deixar o alvo ${statusMarkup("atordoado", 2)} (${meta.flinchChance}% de chance).`);
  }

  for (const change of move.statChanges ?? []) {
    const amount = Number(change.change ?? 0);
    if (!amount) continue;
    const selfTarget = String(move.target ?? "").includes("user");
    const level = Math.min(4, Math.max(1, Math.abs(amount) + 1));
    const status = statStatusName(change.stat, amount, language);
    if (selfTarget) {
      consequences.push(language === "en"
        ? `The Pokémon can become ${statusMarkup(status, level)}.`
        : `O Pokémon pode ficar ${statusMarkup(status, level)}.`);
    } else {
      consequences.push(language === "en"
        ? `Can leave the target ${statusMarkup(status, level)}.`
        : `Pode deixar o alvo ${statusMarkup(status, level)}.`);
    }
  }

  if (rule.trap) {
    consequences.push(language === "en" ? `Can leave the target ${statusMarkup("trapped", 2)}.` : `Pode deixar o alvo ${statusMarkup("preso", 2)}.`);
  }
  if (rule.statusPt || rule.statusEn) {
    consequences.push(language === "en"
      ? `Can leave the target ${statusMarkup(rule.statusEn ?? rule.statusPt, rule.statusLevel ?? 2)}.`
      : `Pode deixar o alvo ${statusMarkup(rule.statusPt ?? rule.statusEn, rule.statusLevel ?? 2)}.`);
  }
  if (rule.selfPt || rule.selfEn) {
    consequences.push(language === "en"
      ? `The Pokémon can become ${statusMarkup(rule.selfEn ?? rule.selfPt, rule.selfLevel ?? 2)}.`
      : `O Pokémon pode ficar ${statusMarkup(rule.selfPt ?? rule.selfEn, rule.selfLevel ?? 2)}.`);
  }

  const uniqueConsequences = [...new Set(consequences)];
  if (!uniqueConsequences.length) {
    uniqueConsequences.push(language === "en"
      ? `Creates an opening or complication appropriate to ${displayName}.`
      : `Cria uma abertura ou complicação coerente com ${displayName}.`);
  }

  return {
    description: descriptionParts.join(" "),
    list: uniqueConsequences
  };
}

export function formatThemeDescription({ data, review }, language = getPokemonContentLanguage()) {
  const types = (data.types ?? []).map(type => typeLabel(type, language)).join(" / ");
  const moves = (data.moves ?? []).map((move, index) => review?.moveNames?.[index] ?? move.name).filter(Boolean);
  const stats = Object.entries(data.stats ?? {})
    .map(([id, value]) => `${statLabel(id, language)} ${Number(value)}`)
    .join(" · ");
  const ability = data.ability?.name ?? (language === "en" ? "Unknown" : "Desconhecida");
  const nature = review?.natureLabel ?? "—";
  const dex = data.dexText ?? "";

  return `
    <h2>${language === "en" ? "Pokédex" : "Pokédex"}</h2>
    <p>${escapeHTML(dex)}</p>
    <h2>${language === "en" ? "Profile" : "Perfil"}</h2>
    <p><strong>${language === "en" ? "Type" : "Tipo"}:</strong> ${escapeHTML(types)}</p>
    <p><strong>${language === "en" ? "Ability" : "Habilidade"}:</strong> ${escapeHTML(ability)}</p>
    <p><strong>${language === "en" ? "Nature" : "Natureza"}:</strong> ${escapeHTML(nature)}</p>
    <p><strong>Stats:</strong> ${escapeHTML(stats)}</p>
    <h2>${language === "en" ? "Moves" : "Golpes"}</h2>
    <p>${escapeHTML(moves.join(" · "))}</p>
  `;
}

export async function loadPokemonThemeProfile(entry) {
  const language = getPokemonContentLanguage();
  const pokemonId = Number(entry?.pokemonId ?? entry?.dex);
  if (!Number.isInteger(pokemonId) || pokemonId < 1) {
    return { description: "", contentLanguage: language };
  }

  try {
    const [pokemon, species] = await Promise.all([
      fetchPokeJson(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`),
      fetchPokeJson(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId}`)
    ]);
    const types = (pokemon.types ?? []).slice().sort((a, b) => Number(a.slot) - Number(b.slot)).map(row => row.type?.name).filter(Boolean);
    const abilityEntry = choosePrimaryAbility(pokemon);
    let ability = null;
    if (abilityEntry?.ability?.url) {
      const detail = await fetchPokeJson(abilityEntry.ability.url);
      ability = {
        id: detail.name,
        name: abilityLabel(detail.name, detail.names, language)
      };
    }
    const dexText = buildDexText({ pokemon, species, types, ability }, language);
    const stats = Object.fromEntries((pokemon.stats ?? []).map(row => [row.stat?.name, Number(row.base_stat ?? 0)]).filter(([id]) => !!id));
    const description = `
      <h2>Pokédex</h2>
      <p>${escapeHTML(dexText)}</p>
      <h2>${language === "en" ? "Profile" : "Perfil"}</h2>
      <p><strong>${language === "en" ? "Type" : "Tipo"}:</strong> ${escapeHTML(types.map(type => typeLabel(type, language)).join(" / "))}</p>
      <p><strong>${language === "en" ? "Ability" : "Habilidade"}:</strong> ${escapeHTML(ability?.name ?? (language === "en" ? "Unknown" : "Desconhecida"))}</p>
      <p><strong>Stats:</strong> ${escapeHTML(Object.entries(stats).map(([id, value]) => `${statLabel(id, language)} ${value}`).join(" · "))}</p>
    `;
    return {
      contentLanguage: language,
      description,
      dexText,
      types,
      stats,
      ability
    };
  } catch (error) {
    console.warn("Pokemon LITM Tools | Perfil Pokemon:", error);
    return { description: "", contentLanguage: language };
  }
}
