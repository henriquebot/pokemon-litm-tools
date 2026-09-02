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

const ABILITY_THREAT_RULES = {
  intimidate: {
    pt: "Sua presença intimidadora reduz a confiança ofensiva do adversário.",
    en: "Its intimidating presence weakens the opponent's offensive confidence.",
    statusPt: "intimidado", statusEn: "intimidated", level: 2
  },
  static: {
    pt: "O contato com seu corpo pode transmitir uma descarga paralisante.",
    en: "Contact with its body can transmit a paralyzing charge.",
    statusPt: "paralisado", statusEn: "paralyzed", level: 2
  },
  "poison-point": {
    pt: "O contato com seus espinhos pode inocular veneno.",
    en: "Contact with its spines can poison the attacker.",
    statusPt: "envenenado", statusEn: "poisoned", level: 2
  },
  "effect-spore": {
    pt: "O contato pode liberar esporos que causam uma condição debilitante.",
    en: "Contact can release spores that inflict a debilitating condition.",
    statusPt: "afetado-por-esporos", statusEn: "spore-affected", level: 2
  },
  "flame-body": {
    pt: "O calor do corpo pode queimar quem o toca.",
    en: "Its heated body can burn attackers that touch it.",
    statusPt: "queimado", statusEn: "burned", level: 2
  },
  "cute-charm": {
    pt: "O contato próximo pode deixar o adversário encantado e hesitante.",
    en: "Close contact can leave the opponent infatuated and hesitant.",
    statusPt: "encantado", statusEn: "infatuated", level: 2
  },
  "rough-skin": {
    pt: "Sua pele áspera machuca quem o atinge por contato.",
    en: "Its rough skin hurts attackers that make contact.",
    statusPt: "ferido-pelo-contato", statusEn: "hurt-by-contact", level: 1
  },
  pressure: {
    pt: "Sua presença opressiva força os adversários a gastar mais esforço.",
    en: "Its oppressive presence forces opponents to spend more effort.",
    statusPt: "pressionado", statusEn: "pressured", level: 2
  },
  "arena-trap": {
    pt: "Controla o terreno ao redor e dificulta que o adversário escape.",
    en: "It controls the surrounding ground and makes escape difficult.",
    statusPt: "preso", statusEn: "trapped", level: 3
  },
  "shadow-tag": {
    pt: "Prende a atenção do adversário à própria sombra e dificulta a fuga.",
    en: "It pins the foe through its shadow and makes escape difficult.",
    statusPt: "preso", statusEn: "trapped", level: 3
  },
  "run-away": {
    pt: "Encontra rapidamente uma rota segura para abandonar um confronto.",
    en: "It quickly finds a safe route out of a confrontation."
  },
  "keen-eye": {
    pt: "Sua visão aguçada impede que sua precisão seja facilmente prejudicada.",
    en: "Its keen sight prevents its accuracy from being easily impaired."
  },
  levitate: {
    pt: "Flutua acima do solo e evita efeitos baseados em contato com o terreno.",
    en: "It floats above the ground and avoids ground-based effects."
  },
  insomnia: {
    pt: "Permanece desperto mesmo diante de efeitos que normalmente causariam sono.",
    en: "It remains awake against effects that would normally cause sleep."
  },
  immunity: {
    pt: "Seu organismo neutraliza toxinas antes que elas possam envenená-lo.",
    en: "Its body neutralizes toxins before they can poison it."
  },
  limber: {
    pt: "Seu corpo flexível resiste a efeitos que tentam paralisá-lo.",
    en: "Its flexible body resists effects that would paralyze it."
  },
  "water-absorb": {
    pt: "Absorve ataques de Água e converte a energia recebida em recuperação.",
    en: "It absorbs Water attacks and converts their energy into recovery.",
    selfPt: "recuperado-pela-agua", selfEn: "restored-by-water", level: 2
  },
  "volt-absorb": {
    pt: "Absorve ataques Elétricos e converte a energia recebida em recuperação.",
    en: "It absorbs Electric attacks and converts their energy into recovery.",
    selfPt: "recuperado-pela-eletricidade", selfEn: "restored-by-electricity", level: 2
  },
  "flash-fire": {
    pt: "Absorve o calor de ataques de Fogo e fortalece suas próprias chamas.",
    en: "It absorbs Fire attacks and strengthens its own flames.",
    selfPt: "fogo-fortalecido", selfEn: "fire-empowered", level: 2
  },
  overgrow: {
    pt: "Quando está muito ferido, seus golpes de Planta se tornam mais perigosos.",
    en: "When badly hurt, its Grass moves become more dangerous.",
    selfPt: "planta-fortalecida", selfEn: "grass-empowered", level: 2
  },
  blaze: {
    pt: "Quando está muito ferido, seus golpes de Fogo se tornam mais perigosos.",
    en: "When badly hurt, its Fire moves become more dangerous.",
    selfPt: "fogo-fortalecido", selfEn: "fire-empowered", level: 2
  },
  torrent: {
    pt: "Quando está muito ferido, seus golpes de Água se tornam mais perigosos.",
    en: "When badly hurt, its Water moves become more dangerous.",
    selfPt: "agua-fortalecida", selfEn: "water-empowered", level: 2
  },
  swarm: {
    pt: "Quando está muito ferido, seus golpes de Inseto se tornam mais perigosos.",
    en: "When badly hurt, its Bug moves become more dangerous.",
    selfPt: "inseto-fortalecido", selfEn: "bug-empowered", level: 2
  }
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
  return {
    id: NATURES[id] ? id : "hardy",
    label: isEn ? source.en : source.pt,
    limits: []
  };
}

export function moveEnglishLabel(id, names = []) {
  return exactLocalizedName(names, "en") || titleCase(id);
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

function damageStatusLevel(power) {
  const value = Number(power ?? 0);
  if (value >= 150) return 5;
  if (value >= 110) return 4;
  if (value >= 80) return 3;
  if (value >= 40) return 2;
  return value > 0 ? 1 : 0;
}

function moveDescriptionPt(move, displayName) {
  const meta = move.meta ?? {};
  const rule = SPECIAL_MOVE_RULES[move.id] ?? {};
  const type = typeLabel(move.type, "pt-BR");
  const ailment = meta.ailment && meta.ailment !== "none" && meta.ailment !== "unknown"
    ? (AILMENT_PTBR[meta.ailment] ?? meta.ailment)
    : null;

  if (ailment) return `Tenta deixar o alvo ${ailment} usando uma técnica do tipo ${type}.`;
  if (Number(meta.flinchChance) > 0) return `Ataca de modo a fazer o alvo hesitar no próximo movimento.`;
  if (rule.trap) return `Prende o alvo com uma técnica do tipo ${type}, dificultando sua movimentação e fuga.`;
  if (rule.charge) return `Concentra energia antes de desferir ${displayName}, um ataque poderoso do tipo ${type}.`;
  if (Number(meta.drain) < 0) return `Ataca com grande impacto e sofre parte da força do golpe de volta.`;
  if (Number(meta.drain) > 0) return `Drena energia do alvo enquanto causa dano do tipo ${type}.`;
  if (Number(meta.healing) > 0) return `Usa ${displayName} para recuperar suas próprias forças.`;

  const changes = move.statChanges ?? [];
  if (changes.length) {
    const first = changes[0];
    const direction = Number(first.change ?? 0) > 0 ? "aumenta" : "reduz";
    return `${displayName} ${direction} ${statLabel(first.stat, "pt-BR").toLocaleLowerCase()} durante o confronto.`;
  }

  if (move.damageClass === "physical") return `Atinge o alvo com um ataque físico do tipo ${type}.`;
  if (move.damageClass === "special") return `Dispara energia do tipo ${type} contra o alvo.`;
  return `Usa uma técnica do tipo ${type} para alterar as condições do confronto.`;
}

export function moveShortDescription(move, displayName, language = getPokemonContentLanguage()) {
  if (language === "en") {
    const text = String(move.shortEffectEn ?? move.flavorEn ?? "").replace(/\$effect_chance/g, String(move.effectChance || "its")).replace(/\s+/g, " ").trim();
    if (text) return text;
  }
  return moveDescriptionPt(move, displayName);
}


function statStatusName(stat, direction, language) {
  const label = statLabel(stat, language).toLocaleLowerCase().replace(/\s+/g, "-");
  if (language === "en") return `${label}-${direction > 0 ? "raised" : "lowered"}`;
  return `${label}-${direction > 0 ? "aumentado" : "reduzido"}`;
}

export function buildMoveThreat(move, displayName, might, language = getPokemonContentLanguage()) {
  const power = Number(move.power ?? 0);
  const meta = move.meta ?? {};
  const rule = SPECIAL_MOVE_RULES[move.id] ?? {};
  const description = moveShortDescription(move, displayName, language);
  const consequences = [];

  if (power > 0 && move.damageClass !== "status") {
    const level = damageStatusLevel(power);
    if (level > 0) {
      consequences.push(language === "en"
        ? `A solid hit can leave the target ${statusMarkup("wounded", level)}.`
        : `Um acerto sólido pode deixar o alvo ${statusMarkup("ferido", level)}.`);
    }
  }

  const ailment = meta.ailment;
  if (ailment && ailment !== "none" && ailment !== "unknown") {
    const status = language === "en" ? ailment : (AILMENT_PTBR[ailment] ?? ailment);
    const chance = Number(meta.ailmentChance ?? move.effectChance ?? 0);
    const level = chance >= 100 || move.damageClass === "status" ? 3 : 2;
    consequences.push(language === "en"
      ? `Can leave the target ${statusMarkup(status, level)}${chance > 0 && chance < 100 ? ` (${chance}% chance)` : ""}.`
      : `Pode deixar o alvo ${statusMarkup(status, level)}${chance > 0 && chance < 100 ? ` (${chance}% de chance)` : ""}.`);
  }

  if (Number(meta.flinchChance) > 0) {
    consequences.push(language === "en"
      ? `Can leave the target ${statusMarkup("hesitation-on-next-move", 2)} (${meta.flinchChance}% chance).`
      : `Pode deixar o alvo ${statusMarkup("hesitacao-no-proximo-movimento", 2)} (${meta.flinchChance}% de chance). O Status expira após a próxima ação relevante.`);
  }

  if (Number(meta.drain) < 0) {
    const recoilLevel = Number(meta.drain) <= -50 ? 2 : 1;
    consequences.push(language === "en"
      ? `The user suffers ${statusMarkup("hurt-by-recoil", recoilLevel)}.`
      : `O próprio Pokémon recebe ${statusMarkup("ferido-pelo-recuo", recoilLevel)}.`);
  }

  if (Number(meta.healing) > 0 || Number(meta.drain) > 0) {
    consequences.push(language === "en"
      ? `The user can become ${statusMarkup("recovered", 2)}.`
      : `O Pokémon pode receber ${statusMarkup("recuperado", 2)}.`);
  }

  for (const change of move.statChanges ?? []) {
    const amount = Number(change.change ?? 0);
    if (!amount) continue;
    const selfTarget = String(move.target ?? "").includes("user");
    const level = Math.min(4, Math.max(1, Math.abs(amount) + 1));
    const status = statStatusName(change.stat, amount, language);
    consequences.push(
      selfTarget
        ? (language === "en"
            ? `The Pokémon can become ${statusMarkup(status, level)}.`
            : `O Pokémon pode ficar ${statusMarkup(status, level)}.`)
        : (language === "en"
            ? `Can leave the target ${statusMarkup(status, level)}.`
            : `Pode deixar o alvo ${statusMarkup(status, level)}.`)
    );
  }

  if (rule.trap) {
    consequences.push(language === "en"
      ? `Can leave the target ${statusMarkup("trapped", 2)}.`
      : `Pode deixar o alvo ${statusMarkup("preso", 2)}.`);
  }
  if (rule.recharge) {
    consequences.push(language === "en"
      ? `After using it, the Pokémon becomes ${statusMarkup("recovering", 2)}.`
      : `Depois de usar o golpe, o Pokémon fica ${statusMarkup("recuperando-se", 2)}.`);
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

  return { description, list: uniqueConsequences };
}

export function buildAbilityThreat(ability, language = getPokemonContentLanguage()) {
  if (!ability?.id) return null;
  const rule = ABILITY_THREAT_RULES[ability.id] ?? null;
  const description = rule
    ? (language === "en" ? rule.en : rule.pt)
    : (language === "en"
        ? (ability.effectTextEn || `The Ability ${ability.name} changes how this Pokémon behaves in the confrontation.`)
        : `A Habilidade ${ability.name} altera como este Pokémon reage durante o confronto.`);

  const list = [];
  if (rule?.statusPt || rule?.statusEn) {
    list.push(language === "en"
      ? `Can cause ${statusMarkup(rule.statusEn ?? rule.statusPt, rule.level ?? 2)}.`
      : `Pode causar ${statusMarkup(rule.statusPt ?? rule.statusEn, rule.level ?? 2)}.`);
  }
  if (rule?.selfPt || rule?.selfEn) {
    list.push(language === "en"
      ? `Can grant the Pokémon ${statusMarkup(rule.selfEn ?? rule.selfPt, rule.level ?? 2)}.`
      : `Pode conceder ao Pokémon ${statusMarkup(rule.selfPt ?? rule.selfEn, rule.level ?? 2)}.`);
  }
  if (!list.length) {
    list.push(language === "en"
      ? "Apply this passive effect whenever the fiction makes it relevant."
      : "Aplique este efeito passivo sempre que ele for relevante na ficção.");
  }

  return {
    name: ability.name,
    description,
    list
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
