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
  speed: "Velocidade",
  accuracy: "Precisão",
  evasion: "Evasão"
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


const NATURE_EFFECTS = {
  hardy: [null, null],
  lonely: ["attack", "defense"],
  adamant: ["attack", "special-attack"],
  naughty: ["attack", "special-defense"],
  brave: ["attack", "speed"],
  bold: ["defense", "attack"],
  docile: [null, null],
  impish: ["defense", "special-attack"],
  lax: ["defense", "special-defense"],
  relaxed: ["defense", "speed"],
  modest: ["special-attack", "attack"],
  mild: ["special-attack", "defense"],
  bashful: [null, null],
  rash: ["special-attack", "special-defense"],
  quiet: ["special-attack", "speed"],
  calm: ["special-defense", "attack"],
  gentle: ["special-defense", "defense"],
  careful: ["special-defense", "special-attack"],
  quirky: [null, null],
  sassy: ["special-defense", "speed"],
  timid: ["speed", "attack"],
  hasty: ["speed", "defense"],
  jolly: ["speed", "special-attack"],
  naive: ["speed", "special-defense"],
  serious: [null, null]
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
  roost: "Poleiro", "brave-bird": "Pássaro Bravo", "leaf-storm": "Tempestade de Folhas", "power-whip": "Chicote Poderoso",
  "worry-seed": "Semente da Preocupação",
  "grassy-terrain": "Campo de Grama",
  "grass-whistle": "Assobio de Grama",
  "acid-spray": "Spray Ácido",
  "bullet-seed": "Rajada de Sementes",
  "poison-fang": "Presa Venenosa",
  "toxic-spikes": "Espinhos Tóxicos",
  "gunk-shot": "Tiro de Lodo",
  belch: "Arroto",
  coil: "Enrolar",
  "gastro-acid": "Ácido Gástrico",
  dive: "Mergulho",
  "giga-impact": "Impacto Giga",
  brine: "Salmoura"
};

const MOVE_PTBR_EXTRA = {
  "fake-out": "Ataque Surpresa", uproar: "Alvoroço", stockpile: "Armazenar", "spit-up": "Cuspir",
  swallow: "Engolir", "heat-wave": "Onda de Calor", hail: "Granizo", torment: "Tormento", flatter: "Bajular",
  "will-o-wisp": "Fogo-Fátuo", memento: "Memento", facade: "Fachada", aeroblast: "Explosão Aérea",
  "focus-punch": "Soco Focado", "smelling-salts": "Sais Aromáticos", "follow-me": "Siga-me",
  "nature-power": "Poder da Natureza", charge: "Carga", taunt: "Provocação", "helping-hand": "Mão Amiga",
  trick: "Truque", "role-play": "Interpretação", wish: "Desejo", assist: "Assistência", ingrain: "Enraizar",
  superpower: "Superpoder", "magic-coat": "Manto Mágico", recycle: "Reciclar", revenge: "Vingança",
  "brick-break": "Quebra-Tijolo", yawn: "Bocejo", "knock-off": "Desarme", endeavor: "Esforço",
  eruption: "Erupção", "skill-swap": "Troca de Habilidade", imprison: "Aprisionar", refresh: "Renovar",
  grudge: "Rancor Profundo", snatch: "Roubo", "secret-power": "Poder Secreto", dive: "Mergulho",
  "arm-thrust": "Empurrão de Braço", camouflage: "Camuflagem", "tail-glow": "Brilho da Cauda",
  "luster-purge": "Purga Luminosa", "mist-ball": "Bola de Névoa", "feather-dance": "Dança das Penas",
  "teeter-dance": "Dança Cambaleante", "blaze-kick": "Chute Flamejante", "mud-sport": "Jogo de Lama",
  "ice-ball": "Bola de Gelo", "needle-arm": "Braço de Espinhos", "slack-off": "Relaxar",
  "hyper-voice": "Hiper Voz", "poison-fang": "Presa Venenosa", "crush-claw": "Garra Esmagadora",
  "blast-burn": "Explosão Incendiária", "hydro-cannon": "Canhão Hidráulico", "meteor-mash": "Soco Meteoro",
  astonish: "Assustar", "weather-ball": "Bola Climática", aromatherapy: "Aromaterapia",
  "fake-tears": "Lágrimas Falsas", "air-cutter": "Cortador de Ar", overheat: "Superaquecimento",
  "odor-sleuth": "Farejar", "rock-tomb": "Tumba de Pedra", "silver-wind": "Vento Prateado",
  "metal-sound": "Som Metálico", "grass-whistle": "Assobio de Grama", tickle: "Cócegas",
  "cosmic-power": "Poder Cósmico", "water-spout": "Jato d'Água", "signal-beam": "Raio Sinalizador",
  "shadow-punch": "Soco Sombrio", extrasensory: "Extrassensorial", "sky-uppercut": "Gancho Celeste",
  "sand-tomb": "Tumba de Areia", "sheer-cold": "Frio Absoluto", "muddy-water": "Água Barrenta",
  "bullet-seed": "Rajada de Sementes", "aerial-ace": "Ás Aéreo", "icicle-spear": "Lança de Gelo",
  "iron-defense": "Defesa de Ferro", block: "Bloqueio", howl: "Uivo", "dragon-claw": "Garra do Dragão",
  "frenzy-plant": "Planta Frenética", "bulk-up": "Fortalecimento", bounce: "Salto", "mud-shot": "Tiro de Lama",
  "poison-tail": "Cauda Venenosa", covet: "Cobiça", "volt-tackle": "Investida Elétrica",
  "magical-leaf": "Folha Mágica", "water-sport": "Jogo de Água", "calm-mind": "Mente Calma",
  "leaf-blade": "Lâmina de Folha", "dragon-dance": "Dança do Dragão", "rock-blast": "Rajada de Pedras",
  "shock-wave": "Onda de Choque", "water-pulse": "Pulso de Água", "doom-desire": "Desejo Fatal",
  "psycho-boost": "Impulso Psíquico", roost: "Poleiro", gravity: "Gravidade", "miracle-eye": "Olho Milagroso",
  "wake-up-slap": "Tapa Despertador", "hammer-arm": "Braço Martelo", "gyro-ball": "Bola Giroscópica",
  "healing-wish": "Desejo de Cura", brine: "Salmoura", "natural-gift": "Dom Natural", feint: "Finta",
  pluck: "Bicar", tailwind: "Vento de Cauda", acupressure: "Acupressão", "metal-burst": "Explosão Metálica",
  "u-turn": "Meia-Volta", "close-combat": "Combate Corpo a Corpo", payback: "Revide", assurance: "Garantia",
  embargo: "Embargo", fling: "Arremesso", "psycho-shift": "Troca Psíquica", "trump-card": "Carta na Manga",
  "heal-block": "Bloqueio de Cura", "wring-out": "Espremer", "power-trick": "Truque de Poder",
  "gastro-acid": "Ácido Gástrico", "lucky-chant": "Canto da Sorte", "me-first": "Eu Primeiro",
  copycat: "Imitação", "power-swap": "Troca de Poder", "guard-swap": "Troca de Defesa", punishment: "Punição",
  "last-resort": "Último Recurso", "worry-seed": "Semente da Preocupação", "sucker-punch": "Golpe Baixo",
  "toxic-spikes": "Espinhos Tóxicos", "heart-swap": "Troca de Coração", "aqua-ring": "Anel de Água",
  "magnet-rise": "Elevação Magnética", "flare-blitz": "Investida Flamejante", "force-palm": "Palma da Força",
  "aura-sphere": "Esfera de Aura", "rock-polish": "Polimento de Pedra", "poison-jab": "Golpe Venenoso",
  "dark-pulse": "Pulso Sombrio", "night-slash": "Corte Noturno", "aqua-tail": "Cauda d'Água",
  "seed-bomb": "Bomba de Sementes", "air-slash": "Corte de Ar", "x-scissor": "Tesoura X",
  "bug-buzz": "Zumbido de Inseto", "dragon-pulse": "Pulso do Dragão", "dragon-rush": "Investida do Dragão",
  "power-gem": "Joia de Poder", "drain-punch": "Soco Drenante", "vacuum-wave": "Onda de Vácuo",
  "focus-blast": "Explosão Focada", "energy-ball": "Bola de Energia", "brave-bird": "Pássaro Bravo",
  "earth-power": "Poder da Terra", switcheroo: "Troca-Troca", "giga-impact": "Impacto Giga",
  "nasty-plot": "Plano Ardiloso", "bullet-punch": "Soco Projétil", avalanche: "Avalanche",
  "ice-shard": "Estilhaço de Gelo", "shadow-claw": "Garra Sombria", "thunder-fang": "Presa Trovejante",
  "ice-fang": "Presa de Gelo", "fire-fang": "Presa de Fogo", "shadow-sneak": "Furtividade Sombria",
  "mud-bomb": "Bomba de Lama", "psycho-cut": "Corte Psíquico", "zen-headbutt": "Cabeçada Zen",
  "mirror-shot": "Tiro Espelhado", "flash-cannon": "Canhão de Luz", "rock-climb": "Escalada em Rocha",
  defog: "Desembaçar", "trick-room": "Sala de Truques", "draco-meteor": "Meteoro Draco", discharge: "Descarga",
  "lava-plume": "Pluma de Lava", "leaf-storm": "Tempestade de Folhas", "power-whip": "Chicote Poderoso",
  "rock-wrecker": "Demolidor de Rocha", "cross-poison": "Veneno Cruzado", "gunk-shot": "Tiro de Lodo",
  "iron-head": "Cabeça de Ferro", "magnet-bomb": "Bomba Magnética", "stone-edge": "Gume de Pedra",
  captivate: "Cativar", "stealth-rock": "Pedra Furtiva", "grass-knot": "Nó de Grama", chatter: "Tagarelice",
  judgment: "Julgamento", "bug-bite": "Mordida de Inseto", "charge-beam": "Raio de Carga",
  "wood-hammer": "Martelo de Madeira", "aqua-jet": "Jato de Água", "attack-order": "Ordem de Ataque",
  "defend-order": "Ordem de Defesa", "heal-order": "Ordem de Cura", "head-smash": "Cabeçada Esmagadora",
  "double-hit": "Golpe Duplo", "roar-of-time": "Rugido do Tempo", "spacial-rend": "Fenda Espacial",
  "lunar-dance": "Dança Lunar", "crush-grip": "Aperto Esmagador", "magma-storm": "Tempestade de Magma",
  "dark-void": "Vazio Sombrio", "seed-flare": "Clarão de Sementes", "ominous-wind": "Vento Sinistro",
  "shadow-force": "Força Sombria"
};

const MOVE_WORD_PTBR = {
  acid: "Ácido", air: "Ar", aqua: "Água", attack: "Ataque", aura: "Aura", ball: "Bola", beam: "Raio",
  blast: "Explosão", body: "Corpo", bomb: "Bomba", bone: "Osso", brave: "Bravo", bubble: "Bolha", bullet: "Projétil",
  charge: "Carga", claw: "Garra", combat: "Combate", crunch: "Mastigada", dance: "Dança", double: "Duplo", dragon: "Dragão", dive: "Mergulho",
  drain: "Dreno", drill: "Broca", edge: "Gume", energy: "Energia", fang: "Presa", fire: "Fogo", flame: "Chama",
  flash: "Clarão", fury: "Fúria", giga: "Giga", grass: "Planta", gust: "Ventania", head: "Cabeça", horn: "Chifre", impact: "Impacto",
  hydro: "Hidro", hyper: "Hiper", ice: "Gelo", iron: "Ferro", kick: "Chute", leaf: "Folha", light: "Luz", brine: "Salmoura",
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

const ABILITY_PTBR_EXTRA = {
  download: "Análise de Dados", "sand-stream": "Tempestade de Areia", truant: "Preguiça", stall: "Atraso",
  stench: "Fedor", drizzle: "Garoa", "speed-boost": "Impulso de Velocidade", "battle-armor": "Armadura de Batalha",
  "shadow-tag": "Marca Sombria", "wonder-guard": "Guarda Maravilhosa", "color-change": "Mudança de Cor",
  "white-smoke": "Fumaça Branca", "motor-drive": "Motor Elétrico", illuminate: "Iluminação",
  "huge-power": "Poder Imenso", plus: "Mais", minus: "Menos", forecast: "Previsão",
  "magma-armor": "Armadura de Magma", "water-veil": "Véu de Água", "air-lock": "Bloqueio de Ar",
  drought: "Seca", "pure-power": "Poder Puro", "tangled-feet": "Pés Emaranhados",
  steadfast: "Firmeza", "snow-cloak": "Manto de Neve", unburden: "Desimpedido", heatproof: "À Prova de Calor",
  simple: "Simples", "poison-heal": "Cura Venenosa", normalize: "Normalizar", "iron-fist": "Punho de Ferro",
  klutz: "Desajeitado", "mold-breaker": "Quebra-Molde", "super-luck": "Super Sorte", aftermath: "Consequência",
  forewarn: "Pressentir", unaware: "Desatento", filter: "Filtro", "slow-start": "Partida Lenta",
  scrappy: "Valentão", "storm-drain": "Dreno de Tempestade", "ice-body": "Corpo de Gelo", "solid-rock": "Rocha Sólida",
  "snow-warning": "Alerta de Neve", "honey-gather": "Coleta de Mel", frisk: "Inspeção", reckless: "Imprudente",
  multitype: "Multitipo", "flower-gift": "Presente Floral", "bad-dreams": "Pesadelos", competitive: "Competitivo", "friend-guard": "Guarda Amiga", infiltrator: "Infiltrador"
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


const MOVE_EFFECT_RULES = {
  "worry-seed": {
    descriptionPt: "Substitui a Habilidade do alvo por Insônia, impedindo que ele adormeça enquanto o efeito permanecer.",
    descriptionEn: "Changes the target's Ability to Insomnia.",
    target: "target", kind: "status",
    statusPt: "habilidade-substituida-por-insonia",
    statusEn: "ability-changed-to-insomnia",
    level: 2
  },
  "gastro-acid": {
    descriptionPt: "Suprime temporariamente a Habilidade do alvo, impedindo que seus efeitos funcionem.",
    descriptionEn: "Suppresses the target's Ability.",
    target: "target", kind: "status",
    statusPt: "habilidade-anulada",
    statusEn: "ability-suppressed",
    level: 2
  },
  "skill-swap": {
    descriptionPt: "Troca a Habilidade do usuário com a Habilidade do alvo.",
    descriptionEn: "Swaps the user's Ability with the target's Ability.",
    target: "target", kind: "status",
    statusPt: "habilidades-trocadas",
    statusEn: "abilities-swapped",
    level: 2
  },
  "role-play": {
    descriptionPt: "Copia a Habilidade do alvo e passa a utilizá-la temporariamente.",
    descriptionEn: "Copies the target's Ability.",
    target: "self", kind: "status",
    statusPt: "habilidade-copiada",
    statusEn: "ability-copied",
    level: 2
  },
  "simple-beam": {
    descriptionPt: "Substitui a Habilidade do alvo por Simples, alterando a forma como mudanças de atributos o afetam.",
    descriptionEn: "Changes the target's Ability to Simple.",
    target: "target", kind: "status",
    statusPt: "habilidade-substituida-por-simples",
    statusEn: "ability-changed-to-simple",
    level: 2
  },
  entrainment: {
    descriptionPt: "Faz o alvo copiar a Habilidade do usuário.",
    descriptionEn: "Makes the target copy the user's Ability.",
    target: "target", kind: "status",
    statusPt: "habilidade-copiada",
    statusEn: "ability-copied",
    level: 2
  },
  soak: {
    descriptionPt: "Altera temporariamente o tipo do alvo para Água.",
    descriptionEn: "Changes the target's type to Water.",
    target: "target", kind: "status",
    statusPt: "tipo-alterado-para-agua",
    statusEn: "type-changed-to-water",
    level: 2
  },
  "forests-curse": {
    descriptionPt: "Adiciona temporariamente o tipo Planta ao alvo.",
    descriptionEn: "Adds the Grass type to the target.",
    target: "target", kind: "status",
    statusPt: "tipo-planta-adicionado",
    statusEn: "grass-type-added",
    level: 2
  },
  "trick-or-treat": {
    descriptionPt: "Adiciona temporariamente o tipo Fantasma ao alvo.",
    descriptionEn: "Adds the Ghost type to the target.",
    target: "target", kind: "status",
    statusPt: "tipo-fantasma-adicionado",
    statusEn: "ghost-type-added",
    level: 2
  },
  encore: {
    descriptionPt: "Força o alvo a repetir por algum tempo o último movimento que utilizou.",
    descriptionEn: "Forces the target to repeat its last move.",
    target: "target", kind: "status",
    statusPt: "preso-ao-ultimo-movimento",
    statusEn: "locked-into-last-move",
    level: 2
  },
  disable: {
    descriptionPt: "Impede temporariamente que o alvo utilize o último movimento que executou.",
    descriptionEn: "Temporarily prevents the target from using its last move.",
    target: "target", kind: "status",
    statusPt: "movimento-inabilitado",
    statusEn: "move-disabled",
    level: 2
  },
  taunt: {
    descriptionPt: "Provoca o alvo e o impede temporariamente de utilizar movimentos que não causam dano direto.",
    descriptionEn: "Prevents the target from using status moves.",
    target: "target", kind: "status",
    statusPt: "provocado",
    statusEn: "taunted",
    level: 2
  },
  torment: {
    descriptionPt: "Impede o alvo de repetir o mesmo movimento em ações consecutivas.",
    descriptionEn: "Prevents the target from using the same move twice in a row.",
    target: "target", kind: "status",
    statusPt: "impedido-de-repetir-movimento",
    statusEn: "cannot-repeat-move",
    level: 2
  },
  yawn: {
    descriptionPt: "Deixa o alvo sonolento; se a ameaça não for resolvida, ele pode adormecer em seguida.",
    descriptionEn: "Makes the target drowsy and may put it to sleep shortly afterward.",
    target: "target", kind: "status",
    statusPt: "sonolento",
    statusEn: "drowsy",
    level: 2
  },
  "grassy-terrain": {
    descriptionPt: "Cobre o terreno com vegetação energética, favorecendo Pokémon no chão e fortalecendo efeitos ligados a Planta.",
    descriptionEn: "Turns the battlefield into Grassy Terrain.",
    target: "scene", kind: "status",
    statusPt: "campo-de-grama",
    statusEn: "grassy-terrain",
    level: 2
  },
  "rain-dance": {
    descriptionPt: "Invoca chuva e muda as condições do campo de batalha.",
    descriptionEn: "Changes the weather to rain.",
    target: "scene", kind: "status",
    statusPt: "chuva",
    statusEn: "rain",
    level: 2
  },
  "sunny-day": {
    descriptionPt: "Intensifica a luz solar e muda as condições do campo de batalha.",
    descriptionEn: "Intensifies sunlight.",
    target: "scene", kind: "status",
    statusPt: "sol-forte",
    statusEn: "harsh-sunlight",
    level: 2
  },
  sandstorm: {
    descriptionPt: "Levanta uma tempestade de areia que altera as condições do campo.",
    descriptionEn: "Creates a sandstorm.",
    target: "scene", kind: "status",
    statusPt: "tempestade-de-areia",
    statusEn: "sandstorm",
    level: 2
  },
  hail: {
    descriptionPt: "Invoca granizo e altera as condições do campo.",
    descriptionEn: "Creates hail.",
    target: "scene", kind: "status",
    statusPt: "granizo",
    statusEn: "hail",
    level: 2
  },
  spikes: {
    descriptionPt: "Espalha espinhos no lado adversário do campo, ameaçando Pokémon que entrarem em contato com o terreno.",
    descriptionEn: "Scatters damaging spikes on the opposing side.",
    target: "scene", kind: "status",
    statusPt: "campo-com-espinhos",
    statusEn: "spikes-on-field",
    level: 2
  },
  "toxic-spikes": {
    descriptionPt: "Espalha espinhos tóxicos no campo adversário, capazes de envenenar quem entrar em contato com eles.",
    descriptionEn: "Scatters poisonous spikes on the opposing side.",
    target: "scene", kind: "status",
    statusPt: "campo-com-espinhos-toxicos",
    statusEn: "toxic-spikes-on-field",
    level: 2
  },
  "stealth-rock": {
    descriptionPt: "Mantém pedras afiadas suspensas ao redor do campo adversário, ferindo quem entrar.",
    descriptionEn: "Sets floating rocks around the opposing field.",
    target: "scene", kind: "status",
    statusPt: "campo-com-pedras-flutuantes",
    statusEn: "stealth-rock-on-field",
    level: 2
  },
  tailwind: {
    descriptionPt: "Cria um vento favorável que acelera o próprio lado do confronto.",
    descriptionEn: "Creates a tailwind that boosts the user's side.",
    target: "self", kind: "status",
    statusPt: "vento-a-favor",
    statusEn: "tailwind",
    level: 2
  },
  "trick-room": {
    descriptionPt: "Distorce o espaço ao redor e altera a ordem natural de quem consegue agir mais rápido.",
    descriptionEn: "Twists the dimensions and reverses normal speed order.",
    target: "scene", kind: "status",
    statusPt: "espaco-distorcido",
    statusEn: "trick-room",
    level: 3
  },
  gravity: {
    descriptionPt: "Intensifica a gravidade no campo, dificultando voo e evasão.",
    descriptionEn: "Intensifies gravity across the battlefield.",
    target: "scene", kind: "status",
    statusPt: "gravidade-intensificada",
    statusEn: "gravity-intensified",
    level: 2
  }
};

function cleanDatabaseEffect(value, effectChance = 0) {
  return String(value ?? "")
    .replace(
      /\$effect_chance/g,
      Number(effectChance) > 0
        ? String(Number(effectChance)) + "%"
        : "uma chance"
    )
    .replace(/\[([^\]]+)\]\{[^}]+\}/g, "$1")
    .replace(/\{[^}]+\}/g, "")
    .replace(/[\n\f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function databaseMoveEffectPt(
  move,
  displayName
) {
  const directPt =
    cleanDatabaseEffect(
      move?.effectTextPt
      || move?.shortEffectPt
      || "",
      move?.effectChance
    );

  if (directPt) {
    return directPt;
  }

  const shortEnglish =
    cleanDatabaseEffect(
      move?.shortEffectEn
      || "",
      move?.effectChance
    );

  const fullEnglish =
    cleanDatabaseEffect(
      move?.effectTextEn
      || move?.flavorEn
      || "",
      move?.effectChance
    );

  const english =
    shortEnglish
    || fullEnglish;

  const text =
    english
      .toLocaleLowerCase();

  const id =
    String(
      move?.id
      ?? ""
    ).toLocaleLowerCase();

  const type =
    typeLabel(
      move?.type
      ?? "normal",
      "pt-BR"
    );

  const meta =
    move?.meta
    ?? {};

  const knownDescriptions = {
    return:
      "Quanto maior a amizade e o vínculo com seu treinador ou companheiros, maior é a força deste golpe.",

    frustration:
      "Quanto menor a amizade e o vínculo com seu treinador, maior é a força deste golpe.",

    "natural-gift":
      "Consome a Berry segurada pelo Pokémon. O tipo e o poder do golpe dependem da Berry utilizada.",

    synthesis:
      "Recupera as próprias forças. A quantidade recuperada muda conforme as condições climáticas.",

    moonlight:
      "Recupera as próprias forças. A quantidade recuperada muda conforme as condições climáticas.",

    "morning-sun":
      "Recupera as próprias forças. A quantidade recuperada muda conforme as condições climáticas.",

    "hidden-power":
      "Libera um poder oculto cujo tipo depende das características internas do Pokémon.",

    flail:
      "Fica mais poderoso quanto mais ferido e próximo de cair estiver o usuário.",

    reversal:
      "Fica mais poderoso quanto mais ferido e próximo de cair estiver o usuário.",

    facade:
      "Fica muito mais poderoso quando o usuário está queimado, paralisado ou envenenado.",

    "gyro-ball":
      "Fica mais poderoso quanto mais lento o usuário for em comparação ao alvo.",

    "electro-ball":
      "Fica mais poderoso quanto mais rápido o usuário for em comparação ao alvo.",

    "focus-punch":
      "O usuário se concentra antes de atacar. Se sofrer dano antes de executar o golpe, a concentração é quebrada e o golpe falha.",

    "magic-coat":
      "Cria uma barreira que devolve ao responsável vários movimentos de efeito que seriam usados contra o usuário.",

    "light-screen":
      "Cria uma tela de luz no lado do usuário que reduz o dano causado por ataques especiais durante alguns turnos.",

    teleport:
      "Permite abandonar um confronto contra Pokémon selvagens; em batalhas entre treinadores, pode retirar o usuário e substituí-lo por outro Pokémon.",

    "guard-swap":
      "Troca com o alvo as alterações acumuladas de Defesa e Defesa Especial.",

    reflect:
      "Cria uma barreira no lado do usuário que reduz o dano causado por ataques físicos durante alguns turnos.",

    protect:
      "Protege o usuário da maioria dos golpes naquele momento; usar repetidamente torna a proteção menos confiável.",

    detect:
      "Protege o usuário da maioria dos golpes naquele momento; usar repetidamente torna a proteção menos confiável.",

    "power-swap":
      "Troca com o alvo as alterações acumuladas de Ataque e Ataque Especial.",

    "heart-swap":
      "Troca com o alvo todas as alterações acumuladas de atributos.",

    haze:
      "Remove as alterações de atributos de todos os Pokémon envolvidos no confronto.",

    "psych-up":
      "Copia para o usuário as alterações de atributos acumuladas pelo alvo.",

    "baton-pass":
      "Retira o usuário do confronto e transfere ao substituto várias alterações e efeitos que estavam ativos sobre ele.",

    "u-turn":
      "Causa dano e, em seguida, permite retirar o usuário do confronto e substituí-lo por outro Pokémon.",

    "volt-switch":
      "Causa dano e, em seguida, permite retirar o usuário do confronto e substituí-lo por outro Pokémon.",

    "parting-shot":
      "Reduz o Ataque e o Ataque Especial do alvo e, em seguida, permite retirar o usuário do confronto.",

    substitute:
      "Consome parte da vitalidade do usuário para criar um substituto que recebe ataques e vários efeitos em seu lugar.",

    rest:
      "O usuário adormece, recupera completamente suas forças e remove outras condições negativas.",

    "belly-drum":
      "Sacrifica grande parte da vitalidade do usuário para elevar seu Ataque ao máximo.",

    "pain-split":
      "Soma a vitalidade atual do usuário e do alvo e divide o total igualmente entre os dois.",

    "perish-song":
      "Marca os Pokémon que ouvirem a canção; se permanecerem em batalha até a contagem terminar, são derrotados.",

    "destiny-bond":
      "Se o usuário for derrotado por um ataque antes de agir novamente, o responsável por derrotá-lo também cai.",

    encore:
      "Força o alvo a repetir por algum tempo o último movimento que utilizou.",

    disable:
      "Impede temporariamente que o alvo utilize o último movimento que executou.",

    taunt:
      "Provoca o alvo e o impede temporariamente de utilizar movimentos que não causam dano direto.",

    torment:
      "Impede o alvo de repetir o mesmo movimento em ações consecutivas.",

    "giga-impact":
      "Causa dano. Depois de usar, o usuário precisa se recuperar e não pode atacar nem ser trocado na próxima ação.",

    "hyper-beam":
      "Causa dano. Depois de usar, o usuário precisa se recuperar e não pode atacar nem ser trocado na próxima ação.",

    "last-resort":
      "Só pode ser usado depois que o usuário tiver utilizado pelo menos uma vez cada um de seus outros golpes desde que entrou em campo. Falha se for seu único golpe.",

    stomp:
      "Causa dano e pode fazer o alvo hesitar. O poder é dobrado contra um Pokémon que tenha usado Minimizar desde que entrou em campo.",

    headbutt:
      "Causa dano e pode fazer o alvo hesitar.",

    "false-swipe":
      "Causa dano, mas nunca reduz o alvo abaixo do mínimo necessário para continuar de pé.",

    endeavor:
      "Reduz a vitalidade do alvo até ela se igualar à vitalidade atual do usuário; falha se o alvo já estiver igual ou abaixo.",

    "super-fang":
      "Reduz pela metade a vitalidade atual do alvo.",

    "seismic-toss":
      "Causa uma quantidade fixa de dano baseada no nível do usuário.",

    "night-shade":
      "Causa uma quantidade fixa de dano baseada no nível do usuário.",

    "dragon-rage":
      "Causa uma quantidade fixa de dano, independentemente dos atributos ofensivos e defensivos.",

    "sonic-boom":
      "Causa uma quantidade fixa de dano, independentemente dos atributos ofensivos e defensivos.",

    "low-kick":
      "Fica mais poderoso quanto mais pesado for o alvo.",

    "grass-knot":
      "Fica mais poderoso quanto mais pesado for o alvo.",

    "heavy-slam":
      "Fica mais poderoso quanto mais pesado o usuário for em comparação ao alvo.",

    "heat-crash":
      "Fica mais poderoso quanto mais pesado o usuário for em comparação ao alvo.",

    eruption:
      "Fica mais poderoso quanto maior estiver a vitalidade atual do usuário.",

    "water-spout":
      "Fica mais poderoso quanto maior estiver a vitalidade atual do usuário.",

    brine:
      "Causa mais dano quando o alvo já está muito ferido.",

    venoshock:
      "Causa mais dano se o alvo estiver envenenado.",

    hex:
      "Causa mais dano se o alvo estiver sob uma condição negativa importante.",

    avalanche:
      "Causa mais dano se o usuário já tiver sido atingido pelo alvo naquela ação.",

    revenge:
      "Causa mais dano se o usuário já tiver sido atingido pelo alvo naquela ação.",

    payback:
      "Causa mais dano quando o usuário age depois do alvo.",

    assurance:
      "Causa mais dano se o alvo já tiver sofrido dano naquela ação.",

    "stored-power":
      "Fica mais poderoso conforme aumentam os atributos do usuário.",

    punishment:
      "Fica mais poderoso conforme aumentam os atributos do alvo.",

    "solar-beam":
      "Concentra energia antes de atacar. Sob sol forte, pode ser disparado sem a etapa de preparação.",

    "solar-blade":
      "Concentra energia antes de atacar. Sob sol forte, pode ser executado sem a etapa de preparação.",

    fly:
      "O usuário sobe para fora de alcance e ataca depois. Enquanto está no ar, evita a maioria dos golpes comuns.",

    dig:
      "O usuário se esconde sob o solo e ataca depois. Enquanto está subterrâneo, evita a maioria dos golpes comuns.",

    dive:
      "O usuário mergulha e ataca depois. Enquanto está submerso, evita a maioria dos golpes comuns.",

    bounce:
      "O usuário salta para fora de alcance e ataca depois, podendo também paralisar o alvo.",

    bide:
      "Suporta ataques por um período e depois devolve ao adversário uma quantidade de dano baseada no que sofreu.",

    counter:
      "Revida um ataque físico recebido, devolvendo dano ampliado ao responsável.",

    "mirror-coat":
      "Revida um ataque especial recebido, devolvendo dano ampliado ao responsável.",

    metronome:
      "Executa aleatoriamente outro golpe disponível no conjunto de movimentos do jogo.",

    "mirror-move":
      "Tenta copiar e executar o último golpe usado pelo alvo contra o usuário.",

    copycat:
      "Executa novamente o último golpe usado no campo, quando esse golpe puder ser copiado.",

    "sleep-talk":
      "Enquanto dorme, escolhe e executa aleatoriamente um dos outros golpes conhecidos pelo usuário.",

    snore:
      "Só pode ser usado enquanto o usuário está dormindo; causa dano e pode fazer o alvo hesitar.",

    "dream-eater":
      "Só funciona contra um alvo adormecido; causa dano e recupera parte da vitalidade do usuário.",

    "future-sight":
      "Prepara um ataque que atinge o alvo depois de um intervalo, mesmo que o usuário já tenha agido novamente.",

    "doom-desire":
      "Prepara um ataque que atinge o alvo depois de um intervalo, mesmo que o usuário já tenha agido novamente.",

    "rapid-spin":
      "Causa dano e remove do lado do usuário vários efeitos que prendem o Pokémon ou permanecem espalhados pelo campo.",

    defog:
      "Reduz a Evasão do alvo e remove vários efeitos de campo, barreiras e perigos de entrada.",

    whirlwind:
      "Força o alvo a deixar o confronto; contra Pokémon selvagens, pode encerrar o encontro.",

    roar:
      "Força o alvo a deixar o confronto; contra Pokémon selvagens, pode encerrar o encontro.",

    "dragon-tail":
      "Causa dano e força o alvo a deixar o confronto quando isso for possível.",

    "circle-throw":
      "Causa dano e força o alvo a deixar o confronto quando isso for possível.",

    "trick-room":
      "Distorce a ordem de velocidade no campo, fazendo os mais lentos agirem antes dos mais rápidos enquanto durar.",

    gravity:
      "Intensifica a gravidade no campo, impedindo voo livre e tornando evasões mais difíceis.",

    tailwind:
      "Cria um vento favorável que aumenta a velocidade do lado do usuário por algum tempo.",

    spikes:
      "Espalha espinhos no lado adversário do campo, ferindo Pokémon que entrarem em contato com o chão.",

    "toxic-spikes":
      "Espalha espinhos tóxicos no lado adversário, capazes de envenenar Pokémon que entrarem em contato com o chão.",

    "stealth-rock":
      "Espalha pedras afiadas ao redor do lado adversário, ferindo Pokémon que entrarem no campo conforme sua relação com o tipo Pedra.",

    "sticky-web":
      "Espalha uma teia no lado adversário que reduz a Velocidade de Pokémon que entrarem em contato com o chão.",

    "rain-dance":
      "Invoca chuva e altera as condições do campo por algum tempo.",

    "sunny-day":
      "Intensifica a luz solar e altera as condições do campo por algum tempo.",

    sandstorm:
      "Invoca uma tempestade de areia e altera as condições do campo por algum tempo.",

    hail:
      "Invoca granizo e altera as condições do campo por algum tempo.",

    "electric-terrain":
      "Eletrifica o terreno, fortalecendo interações Elétricas e impedindo que Pokémon em contato com o chão adormeçam.",

    "grassy-terrain":
      "Transforma o terreno em Campo de Grama, fortalecendo interações de Planta e ajudando Pokémon em contato com o chão a se recuperar.",

    "misty-terrain":
      "Cobre o terreno com névoa, protegendo Pokémon em contato com o chão de várias condições negativas.",

    "psychic-terrain":
      "Transforma o terreno em Campo Psíquico, fortalecendo interações Psíquicas e interferindo em golpes de prioridade contra alvos no chão."
  };

  if (
    knownDescriptions[id]
  ) {
    return knownDescriptions[id];
  }

  if (!text) {
    return "";
  }

  const statPt =
    value => ({
      attack:
        "Ataque",

      defense:
        "Defesa",

      "special attack":
        "Ataque Especial",

      "special defense":
        "Defesa Especial",

      speed:
        "Velocidade",

      accuracy:
        "Precisão",

      evasion:
        "Evasão"
    }[
      String(
        value
        ?? ""
      ).toLocaleLowerCase()
    ]
    ?? String(
      value
      ?? "atributo"
    ));

  let match =
    null;

  if (
    /^inflicts (regular |normal )?damage with no additional effect\.?$/
      .test(text)
  ) {
    return "Causa dano sem efeito adicional.";
  }

  if (
    /^(inflicts|deals) (regular |normal )?damage\.?$/
      .test(text)
  ) {
    return "Causa dano.";
  }

  if (
    /^puts? the target to sleep\.?$/
      .test(text)
  ) {
    return "Faz o alvo dormir.";
  }

  if (
    /^never misses\.?$/
      .test(text)
  ) {
    return "Ignora as alterações normais de Precisão e Evasão e não erra em condições comuns.";
  }

  match =
    text.match(
      /^(raises|lowers) the (user|target)'s (attack|defense|special attack|special defense|speed|accuracy|evasion) by (one|two|three) stages?\.?$/
    );

  if (match) {
    const verb =
      match[1] === "raises"
        ? "Aumenta"
        : "Reduz";

    const who =
      match[2] === "user"
        ? "do usuário"
        : "do alvo";

    const amount =
      ({
        one:
          "um nível",

        two:
          "dois níveis",

        three:
          "três níveis"
      })[
        match[4]
      ]
      || "um nível";

    return (
      verb
      + " "
      + statPt(match[3])
      + " "
      + who
      + " em "
      + amount
      + "."
    );
  }

  match =
    text.match(
      /^has a ([0-9]+)% chance to (poison|burn|paralyze|freeze|confuse) the target\.?$/
    );

  if (match) {
    const status =
      ({
        poison:
          "envenenar",

        burn:
          "queimar",

        paralyze:
          "paralisar",

        freeze:
          "congelar",

        confuse:
          "confundir"
      })[
        match[2]
      ];

    return (
      "Tem "
      + match[1]
      + "% de chance de "
      + status
      + " o alvo."
    );
  }

  match =
    text.match(
      /^has a ([0-9]+)% chance to make the target flinch\.?$/
    );

  if (match) {
    return (
      "Tem "
      + match[1]
      + "% de chance de fazer o alvo hesitar."
    );
  }

  if (
    /drains? half the damage inflicted to heal the user/
      .test(text)
  ) {
    return "Causa dano e recupera para o usuário uma parte da vitalidade com base no dano causado.";
  }

  if (
    /user receives?.*damage inflicted.*recoil|user takes?.*damage.*recoil/
      .test(text)
  ) {
    return "Causa dano, mas o usuário também sofre parte do impacto como recuo.";
  }

  if (
    /hits? (two|twice)/
      .test(text)
  ) {
    return "Atinge o alvo duas vezes na mesma execução.";
  }

  if (
    /hits? (2.?5|two to five).*times/
      .test(text)
  ) {
    return "Atinge o alvo várias vezes na mesma execução, normalmente entre duas e cinco vezes.";
  }

  if (
    /forces? the target to switch|switches? the target out/
      .test(text)
  ) {
    return "Força o alvo a deixar o confronto e ser substituído quando isso for possível.";
  }

  if (
    /switches the user out|user switches out/
      .test(text)
  ) {
    return (
      String(displayName)
      + " produz seu efeito e então permite retirar o usuário do confronto."
    );
  }

  if (
    /changes? the weather to rain|summons? rain/
      .test(text)
  ) {
    return "Invoca chuva e altera as condições do campo de batalha.";
  }

  if (
    /sunlight|sunny|sunshine/
      .test(text)
    &&
    /weather|intensif|summon|changes/
      .test(text)
  ) {
    return "Intensifica a luz solar e altera as condições do campo de batalha.";
  }

  if (
    /terrain/
      .test(text)
    &&
    /grass/
      .test(text)
  ) {
    return "Transforma o terreno em um Campo de Grama e modifica como certas técnicas interagem com o campo.";
  }

  if (
    /changes? the target'?s ability to insomnia/
      .test(text)
  ) {
    return "Substitui a Habilidade do alvo por Insônia, impedindo que ele adormeça enquanto o efeito permanecer.";
  }

  if (
    /suppresses? the target'?s ability/
      .test(text)
  ) {
    return "Suprime temporariamente a Habilidade do alvo e impede que seus efeitos funcionem.";
  }

  if (
    /swaps?.*abilit/
      .test(text)
  ) {
    return "Troca as Habilidades do usuário e do alvo enquanto o efeito permanecer.";
  }

  if (
    /copies?.*target'?s ability/
      .test(text)
  ) {
    return "Copia temporariamente a Habilidade do alvo.";
  }

  if (
    /prevents?.*status moves/
      .test(text)
  ) {
    return "Impede temporariamente o alvo de utilizar movimentos que não causam dano direto.";
  }

  if (
    /same move twice in a row/
      .test(text)
  ) {
    return "Impede o alvo de repetir o mesmo movimento em ações consecutivas.";
  }

  if (
    /repeat.*last move/
      .test(text)
  ) {
    return "Força o alvo a continuar repetindo o último movimento utilizado.";
  }

  if (
    /protects? the user|prevents? attacks? from hitting the user/
      .test(text)
  ) {
    return "Protege o usuário de ataques enquanto o efeito permanecer, sujeito às limitações do próprio golpe.";
  }

  if (
    /critical hit/
      .test(text)
    &&
    /more likely|increased|higher/
      .test(text)
  ) {
    return "Causa dano com chance aumentada de acertar um ponto crítico.";
  }

  if (
    /ignores?.*accuracy|ignores?.*evasion/
      .test(text)
  ) {
    return "Ignora alterações comuns de Precisão e Evasão ao tentar acertar o alvo.";
  }

  const parts = [];

  const add =
    value => {
      const clean =
        String(
          value
          ?? ""
        ).trim();

      if (
        clean
        &&
        !parts.includes(clean)
      ) {
        parts.push(clean);
      }
    };

  if (
    Number(
      move?.power
      ?? 0
    ) > 0
    &&
    move?.damageClass
      !== "status"
  ) {
    add(
      "Causa dano do tipo "
      + type
      + "."
    );
  }

  const ailment =
    String(
      meta.ailment
      ?? ""
    );

  if (
    ailment
    &&
    ailment !== "none"
    &&
    ailment !== "unknown"
  ) {
    const status =
      AILMENT_PTBR[ailment]
      ?? ailment;

    const chance =
      Number(
        meta.ailmentChance
        ?? move?.effectChance
        ?? 0
      );

    add(
      chance > 0
      && chance < 100
        ? (
            "Tem "
            + chance
            + "% de chance de deixar o alvo "
            + status
            + "."
          )
        : (
            "Pode deixar o alvo "
            + status
            + "."
          )
    );
  }

  const flinch =
    Number(
      meta.flinchChance
      ?? 0
    );

  if (flinch > 0) {
    add(
      "Tem "
      + flinch
      + "% de chance de fazer o alvo hesitar."
    );
  }

  const drain =
    Number(
      meta.drain
      ?? 0
    );

  if (drain > 0) {
    add(
      "Recupera parte da vitalidade do usuário com base no dano causado."
    );
  }

  if (drain < 0) {
    add(
      "O usuário sofre parte do dano causado como recuo."
    );
  }

  const healing =
    Number(
      meta.healing
      ?? 0
    );

  if (healing > 0) {
    add(
      "Recupera parte da vitalidade do usuário."
    );
  }

  for (
    const change
    of move?.statChanges
      ?? []
  ) {
    const amount =
      Number(
        change?.change
        ?? 0
      );

    if (!amount) {
      continue;
    }

    const targetSelf =
      String(
        move?.target
        ?? ""
      ).includes("user");

    add(
      (
        amount > 0
          ? "Aumenta "
          : "Reduz "
      )
      + statLabel(
          change.stat,
          "pt-BR"
        )
      + (
          targetSelf
            ? " do usuário."
            : " do alvo."
        )
    );
  }

  const minHits =
    Number(
      meta.minHits
      ?? 0
    );

  const maxHits =
    Number(
      meta.maxHits
      ?? 0
    );

  if (maxHits > 1) {
    add(
      minHits > 0
      && minHits !== maxHits
        ? (
            "Pode atingir de "
            + minHits
            + " a "
            + maxHits
            + " vezes na mesma execução."
          )
        : (
            "Atinge "
            + maxHits
            + " vezes na mesma execução."
          )
    );
  }

  if (
    /recharge|loses its next turn/
      .test(text)
  ) {
    add(
      "Depois de usar, o usuário precisa se recuperar antes de agir normalmente de novo."
    );
  }

  if (
    /charge turn|charges? for one turn|first turn/
      .test(text)
    &&
    /second turn|next turn|then attacks/
      .test(text)
  ) {
    add(
      "Exige uma etapa de preparação antes de executar o efeito principal."
    );
  }

  if (
    /held item|holding an item|berry/
      .test(text)
  ) {
    add(
      "Interage com o item segurado pelo Pokémon; o resultado depende do item e das condições descritas pelo golpe."
    );
  }

  if (
    /power.*higher|power.*increases|power doubles|double power|more damage/
      .test(text)
  ) {
    add(
      "Seu poder varia de acordo com uma condição específica do usuário, do alvo ou do confronto."
    );
  }

  if (
    /fails? if|only works? if|can only be used/
      .test(text)
  ) {
    add(
      "Só funciona quando as condições específicas deste golpe são atendidas."
    );
  }

  if (
    /changes? the user'?s type|changes? type|becomes? .*type/
      .test(text)
  ) {
    add(
      "Pode alterar a tipagem envolvida no confronto conforme as regras próprias do golpe."
    );
  }

  if (
    /copies?|mimics?|uses? the target'?s move/
      .test(text)
  ) {
    add(
      "Copia ou reutiliza outro golpe quando as condições próprias desta técnica permitem."
    );
  }

  if (parts.length) {
    return parts.join(" ");
  }

  console.warn(
    "Pokemon LITM Tools | Efeito de golpe ainda sem adaptacao especifica PT-BR:",
    id,
    english
  );

  return (
    move?.damageClass
      === "status"
  )
    ? (
        "Altera as condições do confronto de acordo com a mecânica própria de "
        + String(
            displayName
            || "este golpe"
          )
        + "."
      )
    : (
        "Causa dano do tipo "
        + type
        + "."
      );
}


const ABILITY_EFFECT_PTBR = {
  hustle: "Aumenta bastante a força dos golpes físicos, mas sacrifica parte da precisão desses ataques.",
  guts: "Quando sofre uma condição negativa, transforma a adversidade em força e aumenta o poder de seus ataques físicos.",
  "sand-veil": "Durante uma tempestade de areia, fica mais difícil de acertar e atravessa a areia sem sofrer seus efeitos normais.",
  "run-away": "Encontra rapidamente uma rota de fuga, tornando mais difícil impedir que abandone o confronto.",
  "keen-eye": "Sua visão aguçada impede que efeitos adversários reduzam sua precisão.",
  intimidate: "Ao entrar em confronto, sua presença intimidadora reduz a capacidade ofensiva dos adversários próximos.",
  static: "O contato direto com seu corpo pode transmitir uma descarga e paralisar quem o atinge.",
  "poison-point": "O contato com seus espinhos pode inocular veneno em quem o atinge.",
  "effect-spore": "O contato pode liberar esporos capazes de causar sono, paralisia ou envenenamento.",
  "flame-body": "O calor intenso de seu corpo pode queimar quem fizer contato direto com ele.",
  "cute-charm": "O contato próximo pode encantar o adversário e fazê-lo hesitar ao agir contra este Pokémon.",
  "rough-skin": "Sua pele áspera machuca adversários que o atingem com ataques de contato.",
  pressure: "Sua presença opressiva força os adversários a gastar mais esforço para enfrentá-lo.",
  "arena-trap": "Controla o terreno ao redor e dificulta que adversários em contato com o chão escapem.",
  "shadow-tag": "Prende o adversário à própria presença e dificulta sua retirada do confronto.",
  levitate: "Flutua acima do solo, ficando imune a golpes e efeitos que dependem de contato com o terreno.",
  insomnia: "Não consegue adormecer por efeitos externos e permanece desperto mesmo diante de técnicas de sono.",
  immunity: "Seu organismo neutraliza toxinas, impedindo que seja envenenado.",
  limber: "Seu corpo extremamente flexível impede que seja paralisado.",
  "water-absorb": "Ao receber um golpe de Água, absorve a energia em vez de sofrer o efeito e pode recuperar suas forças.",
  "volt-absorb": "Ao receber um golpe Elétrico, absorve a energia em vez de sofrer o efeito e pode recuperar suas forças.",
  "flash-fire": "Ao receber um golpe de Fogo, absorve o calor e fortalece seus próprios golpes de Fogo.",
  overgrow: "Quando está muito ferido, seus golpes de Planta se tornam mais poderosos.",
  blaze: "Quando está muito ferido, seus golpes de Fogo se tornam mais poderosos.",
  torrent: "Quando está muito ferido, seus golpes de Água se tornam mais poderosos.",
  swarm: "Quando está muito ferido, seus golpes de Inseto se tornam mais poderosos.",
  sturdy: "Sua estrutura resistente impede que seja derrubado facilmente por um único golpe devastador.",
  "battle-armor": "Sua armadura natural protege pontos vulneráveis e impede golpes críticos.",
  "shell-armor": "Sua carapaça protege pontos vulneráveis e impede golpes críticos.",
  damp: "Sua presença impede técnicas explosivas de serem executadas normalmente ao redor dele.",
  "inner-focus": "Mantém a concentração sob pressão e não hesita por efeitos que normalmente causariam recuo ou interrupção.",
  "clear-body": "Seu corpo impede que efeitos adversários reduzam seus atributos.",
  "white-smoke": "A proteção ao redor de seu corpo impede que efeitos adversários reduzam seus atributos.",
  "hyper-cutter": "Suas garras ou mandíbulas não perdem força por efeitos que tentem reduzir seu Ataque.",
  "own-tempo": "Mantém seu próprio ritmo e não pode ser confundido por efeitos externos.",
  "natural-cure": "Ao deixar o confronto, seu organismo elimina condições negativas persistentes.",
  synchronize: "Quando recebe certas condições negativas, pode transmiti-las de volta ao responsável.",
  "lightning-rod": "Atrai golpes Elétricos para si, anulando seu dano e convertendo a energia em poder especial.",
  "motor-drive": "Absorve golpes Elétricos sem sofrer dano e transforma a energia recebida em velocidade.",
  "swift-swim": "Move-se muito mais rápido enquanto estiver chovendo.",
  chlorophyll: "A luz solar intensa aumenta muito sua velocidade.",
  "rain-dish": "Recupera gradualmente suas forças enquanto estiver chovendo.",
  "ice-body": "Recupera gradualmente suas forças durante granizo ou condições de gelo intenso.",
  "snow-cloak": "Durante granizo ou neve intensa, fica mais difícil de acertar.",
  "thick-fat": "Sua camada corporal reduz significativamente o impacto de golpes de Fogo e Gelo.",
  "rock-head": "Pode executar golpes de grande impacto sem sofrer dano de recuo.",
  "magma-armor": "O calor constante de seu corpo impede que seja congelado.",
  "water-veil": "A película de água que o envolve impede que seja queimado.",
  soundproof: "Bloqueia técnicas baseadas em som, impedindo que seus efeitos o atinjam.",
  "compound-eyes": "Sua visão composta aumenta a precisão de seus golpes.",
  "shield-dust": "O pó que cobre seu corpo bloqueia efeitos adicionais provocados por golpes inimigos.",
  "serene-grace": "Sua presença incomum aumenta a chance de efeitos adicionais de seus golpes acontecerem.",
  "huge-power": "Possui força física muito acima do esperado, aumentando drasticamente seu poder de Ataque.",
  "pure-power": "Concentra energia de forma extraordinária, aumentando drasticamente seu poder de Ataque.",
  technician: "Golpes de menor potência são executados com precisão técnica e causam impacto maior.",
  sniper: "Quando acerta um ponto crítico, aproveita a abertura para causar um impacto muito maior.",
  "quick-feet": "Quando sofre uma condição negativa, reage acelerando seus movimentos.",
  "marvel-scale": "Quando sofre uma condição negativa, suas escamas endurecem e aumentam sua resistência física.",
  adaptability: "A afinidade com seus próprios tipos é excepcional, tornando golpes desses tipos mais poderosos.",
  "magic-guard": "Só sofre dano direto de ataques; perigos indiretos e efeitos ambientais não o ferem normalmente.",
  "no-guard": "Luta sem se preocupar em esquivar: seus golpes e os golpes direcionados a ele tendem a acertar.",
  "mold-breaker": "Seus golpes ignoram Habilidades defensivas que normalmente impediriam ou alterariam seus efeitos.",
  "super-luck": "Tem uma facilidade incomum para encontrar pontos críticos do adversário.",
  "poison-heal": "Em vez de ser enfraquecido por veneno, usa a toxina para recuperar gradualmente suas forças.",
  "dry-skin": "Absorve Água para se recuperar, mas sofre mais com calor intenso e golpes de Fogo.",
  download: "Analisa as defesas do adversário ao entrar em confronto e fortalece o atributo ofensivo mais vantajoso.",
  "iron-fist": "Golpes executados com os punhos recebem força adicional.",
  "leaf-guard": "Sob luz solar intensa, sua proteção natural impede novas condições negativas.",
  scrappy: "Consegue atingir normalmente até adversários que, por sua natureza, seriam imunes a golpes Normais ou Lutadores.",
  competitive: "Quando seus atributos são reduzidos por um adversário, reage fortalecendo bastante seu poder especial.",
  "friend-guard": "Protege aliados próximos e reduz o impacto de ataques direcionados a eles.",
  infiltrator: "Consegue atravessar ou ignorar barreiras e proteções que normalmente bloqueariam seus golpes."
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
  const resolvedId = NATURES[id] ? id : "hardy";
  const isEn = language === "en";
  const [raised, lowered] = NATURE_EFFECTS[resolvedId] ?? [null, null];
  const effect = !raised || !lowered
    ? (isEn ? "Neutral nature: no stat is raised or lowered." : "Natureza neutra: não aumenta nem reduz nenhum atributo.")
    : (
        isEn
          ? `Raises ${statLabel(raised, "en")} and lowers ${statLabel(lowered, "en")}.`
          : `Aumenta ${statLabel(raised, "pt-BR")} e reduz ${statLabel(lowered, "pt-BR")}.`
      );

  return {
    id: resolvedId,
    label: isEn ? source.en : source.pt,
    raised,
    lowered,
    effect,
    limits: []
  };
}

export function pokemonSpecialImprovements(language = getPokemonContentLanguage()) {
  const pt = language !== "en";
  const rows = pt
    ? [
        ["Mega Evolução", "Transformação temporária ativada quando a espécie e os itens necessários permitirem."],
        ["Z-Move", "Libera um golpe especial ligado a um Cristal Z quando os requisitos ficcionais forem atendidos."],
        ["Dynamax", "Aumenta temporariamente a escala e libera movimentos Max quando a situação permitir."],
        ["Gigantamax", "Forma especial de Dynamax disponível apenas para espécies compatíveis, com movimento G-Max próprio."],
        ["Terastalização", "Ativa o Tipo Tera do Pokémon e altera como sua tipagem influencia a ficção e os confrontos."],
        ["Reversão Primal", "Transformação especial reservada a Pokémon compatíveis, como Groudon e Kyogre."],
        ["Ultra Burst", "Transformação especial reservada a formas compatíveis de Necrozma."]
      ]
    : [
        ["Mega Evolution", "Temporary transformation when the species and required items allow it."],
        ["Z-Move", "Unlocks a special move tied to a Z-Crystal when its fictional requirements are met."],
        ["Dynamax", "Temporarily increases scale and enables Max Moves when the situation allows it."],
        ["Gigantamax", "Special Dynamax form for compatible species, including its unique G-Max Move."],
        ["Terastallization", "Activates the Pokémon's Tera Type and changes how typing matters in the fiction."],
        ["Primal Reversion", "Special transformation reserved for compatible Pokémon such as Groudon and Kyogre."],
        ["Ultra Burst", "Special transformation reserved for compatible Necrozma forms."]
      ];

  return rows.map(([name, description]) => ({
    name,
    description,
    active: false
  }));
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
  const mapped = MOVE_PTBR_EXTRA[id] ?? MOVE_PTBR[id];
  if (mapped) return mapped;

  // Nunca deixa um nome inglês puro escapar no conteúdo PT-BR.
  const words = String(id ?? "").split("-").filter(Boolean);
  const translated = words.map(word => MOVE_WORD_PTBR[word] ?? null);
  if (translated.length && translated.every(Boolean)) return translated.join(" ");

  const english = exactLocalizedName(names, "en") || titleCase(id);
  console.warn("Pokemon LITM Tools | Golpe sem tradução PT-BR:", id);
  return english ? `Técnica (${english})` : "Técnica";
}

export function abilityLabel(id, names = [], language = getPokemonContentLanguage()) {
  if (language === "en") {
    return exactLocalizedName(names, "en") || titleCase(id);
  }
  const exact = exactLocalizedName(names, "pt-BR");
  const mapped = ABILITY_PTBR_EXTRA[id] ?? ABILITY_PTBR[id];
  if (exact || mapped) return exact || mapped;
  const english = exactLocalizedName(names, "en") || titleCase(id);
  console.warn("Pokemon LITM Tools | Habilidade sem tradução PT-BR:", id);
  return english ? `Efeito (${english})` : "Habilidade desconhecida";
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


const POKEMON_GENUS_PTBR = {
  farfetchd:
    "Pato Selvagem",

  bulbasaur:
    "Semente",

  ivysaur:
    "Semente",

  venusaur:
    "Semente",

  charmander:
    "Lagarto",

  charmeleon:
    "Chama",

  charizard:
    "Chama",

  squirtle:
    "Tartaruga",

  wartortle:
    "Tartaruga",

  blastoise:
    "Marisco",

  caterpie:
    "Lagarta",

  metapod:
    "Casulo",

  butterfree:
    "Borboleta",

  weedle:
    "Larva",

  kakuna:
    "Casulo",

  beedrill:
    "Abelha Venenosa",

  pidgey:
    "Pássaro Pequeno",

  rattata:
    "Rato",

  spearow:
    "Pássaro Pequeno",

  ekans:
    "Serpente",

  arbok:
    "Cobra",

  pikachu:
    "Rato",

  raichu:
    "Rato",

  sandshrew:
    "Rato",

  clefairy:
    "Fada",

  clefable:
    "Fada",

  vulpix:
    "Raposa",

  ninetales:
    "Raposa",

  jigglypuff:
    "Balão",

  wigglytuff:
    "Balão",

  zubat:
    "Morcego",

  golbat:
    "Morcego",

  oddish:
    "Erva",

  gloom:
    "Erva",

  vileplume:
    "Flor",

  paras:
    "Cogumelo",

  parasect:
    "Cogumelo",

  venonat:
    "Inseto",

  venomoth:
    "Mariposa Venenosa",

  diglett:
    "Toupeira",

  dugtrio:
    "Toupeira",

  meowth:
    "Gato Arranhador",

  persian:
    "Gato Elegante",

  psyduck:
    "Pato",

  golduck:
    "Pato",

  growlithe:
    "Cachorro",

  arcanine:
    "Lendário",

  poliwag:
    "Girino",

  poliwhirl:
    "Girino",

  abra:
    "Psíquico",

  kadabra:
    "Psíquico",

  alakazam:
    "Psíquico",

  machop:
    "Superpoder",

  machoke:
    "Superpoder",

  machamp:
    "Superpoder",

  bellsprout:
    "Flor",

  tentacool:
    "Água-viva",

  tentacruel:
    "Água-viva",

  geodude:
    "Pedra",

  graveler:
    "Pedra",

  golem:
    "Megaton",

  ponyta:
    "Cavalo de Fogo",

  rapidash:
    "Cavalo de Fogo",

  slowpoke:
    "Tonto",

  magnemite:
    "Ímã",

  magneton:
    "Ímã",

  doduo:
    "Pássaro Gêmeo",

  dodrio:
    "Pássaro Triplo",

  seel:
    "Leão-marinho",

  dewgong:
    "Leão-marinho",

  grimer:
    "Lodo",

  muk:
    "Lodo",

  shellder:
    "Bivalve",

  cloyster:
    "Bivalve",

  gastly:
    "Gás",

  haunter:
    "Gás",

  gengar:
    "Sombra",

  onix:
    "Serpente de Pedra",

  drowzee:
    "Hipnose",

  hypno:
    "Hipnose",

  krabby:
    "Caranguejo de Rio",

  kingler:
    "Pinça",

  voltorb:
    "Pokébola",

  electrode:
    "Pokébola",

  exeggcute:
    "Ovo",

  exeggutor:
    "Coco",

  cubone:
    "Solitário",

  marowak:
    "Guardião de Ossos",

  hitmonlee:
    "Chute",

  hitmonchan:
    "Soco",

  lickitung:
    "Lambida",

  koffing:
    "Gás Venenoso",

  weezing:
    "Gás Venenoso",

  rhyhorn:
    "Espinhos",

  rhydon:
    "Broca",

  chansey:
    "Ovo",

  tangela:
    "Vinha",

  kangaskhan:
    "Parental",

  horsea:
    "Dragão",

  seadra:
    "Dragão",

  goldeen:
    "Peixe Dourado",

  seaking:
    "Peixe Dourado",

  staryu:
    "Forma de Estrela",

  starmie:
    "Misterioso",

  mrmime:
    "Barreira",

  scyther:
    "Louva-a-deus",

  jynx:
    "Forma Humana",

  electabuzz:
    "Elétrico",

  magmar:
    "Cuspidor de Fogo",

  pinsir:
    "Besouro",

  tauros:
    "Touro Selvagem",

  magikarp:
    "Peixe",

  gyarados:
    "Atroz",

  lapras:
    "Transporte",

  ditto:
    "Transformação",

  eevee:
    "Evolução",

  vaporeon:
    "Jato de Bolhas",

  jolteon:
    "Relâmpago",

  flareon:
    "Chama",

  porygon:
    "Virtual",

  omanyte:
    "Espiral",

  omastar:
    "Espiral",

  kabuto:
    "Marisco",

  kabutops:
    "Marisco",

  aerodactyl:
    "Fóssil",

  snorlax:
    "Dorminhoco",

  articuno:
    "Congelamento",

  zapdos:
    "Elétrico",

  moltres:
    "Chama",

  dratini:
    "Dragão",

  dragonair:
    "Dragão",

  dragonite:
    "Dragão",

  mewtwo:
    "Genético",

  mew:
    "Nova Espécie",

  raikou:
    "Trovão",

  entei:
    "Vulcão",

  suicune:
    "Aurora",

  lugia:
    "Mergulho",

  hooh:
    "Arco-íris",

  celebi:
    "Viagem no Tempo"
};


const GENUS_WORD_PTBR = {
  wild:
    "Selvagem",

  duck:
    "Pato",

  mouse:
    "Rato",

  seed:
    "Semente",

  lizard:
    "Lagarto",

  flame:
    "Chama",

  turtle:
    "Tartaruga",

  tiny:
    "Pequeno",

  bird:
    "Pássaro",

  butterfly:
    "Borboleta",

  worm:
    "Lagarta",

  cocoon:
    "Casulo",

  poison:
    "Venenoso",

  bee:
    "Abelha",

  snake:
    "Serpente",

  cobra:
    "Cobra",

  dragon:
    "Dragão",

  fairy:
    "Fada",

  bat:
    "Morcego",

  flower:
    "Flor",

  mushroom:
    "Cogumelo",

  insect:
    "Inseto",

  mole:
    "Toupeira",

  cat:
    "Gato",

  balloon:
    "Balão",

  fish:
    "Peixe",

  star:
    "Estrela",

  crab:
    "Caranguejo",

  horse:
    "Cavalo",

  sea:
    "Mar",

  jellyfish:
    "Água-viva",

  rock:
    "Pedra",

  psychic:
    "Psíquico",

  electric:
    "Elétrico",

  magnet:
    "Ímã",

  gas:
    "Gás",

  shadow:
    "Sombra",

  egg:
    "Ovo",

  fox:
    "Raposa",

  rabbit:
    "Coelho",

  frog:
    "Rã",

  monkey:
    "Macaco",

  pig:
    "Porco",

  horn:
    "Chifre",

  drill:
    "Broca",

  fossil:
    "Fóssil",

  spiral:
    "Espiral",

  water:
    "Água",

  fire:
    "Fogo",

  grass:
    "Planta",

  armor:
    "Armadura",

  shell:
    "Concha",

  bone:
    "Osso",

  dream:
    "Sonho",

  virtual:
    "Virtual",

  barrier:
    "Barreira",

  transport:
    "Transporte",

  time:
    "Tempo",

  baby:
    "Bebê",

  dark:
    "Sombrio",

  light:
    "Luz",

  moon:
    "Lua",

  sun:
    "Sol",

  snow:
    "Neve",

  ice:
    "Gelo",

  volcano:
    "Vulcão",

  legendary:
    "Lendário",

  rainbow:
    "Arco-íris",

  evolution:
    "Evolução",

  mysterious:
    "Misterioso",

  genetic:
    "Genético",

  human:
    "Humano"
};


function normalizeGenusKey(
  value
) {
  return String(
    value
    ?? ""
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLocaleLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      ""
    );
}


function stripPokemonGenusSuffix(
  value
) {
  return String(
    value
    ?? ""
  )
    .replace(
      /\s+pok[eé]mon\s*$/i,
      ""
    )
    .replace(
      /^\s*pok[eé]mon\s+/i,
      ""
    )
    .trim();
}


export function pokemonGenusLabel(
  species,
  language =
    getPokemonContentLanguage()
) {
  const speciesId =
    normalizeGenusKey(
      species?.name
    );

  if (
    language !== "en"
    &&
    POKEMON_GENUS_PTBR[
      speciesId
    ]
  ) {
    return POKEMON_GENUS_PTBR[
      speciesId
    ];
  }

  const rows =
    Array.isArray(
      species?.genera
    )
      ? species.genera
      : [];

  const english =
    stripPokemonGenusSuffix(
      rows.find(
        row =>
          row.language?.name
            === "en"
      )?.genus
    );

  if (
    language === "en"
  ) {
    return (
      english
      || "Pokémon"
    );
  }

  if (!english) {
    return "Pokémon";
  }

  const translated =
    english
      .split(/\s+/)
      .map(
        word => {
          const key =
            normalizeGenusKey(
              word
            );

          return (
            GENUS_WORD_PTBR[
              key
            ]
            ?? word
          );
        }
      )
      .join(" ")
      .trim();

  return (
    translated
    || "Pokémon"
  );
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
        ["immune", "Immune to", false, "immunity"],
        ["strongResist", "Strongly resists", false, "resistance"],
        ["resist", "Resists", false, "resistance"],
        ["weak", "Vulnerable to", true, "weakness"],
        ["strongWeak", "Extremely vulnerable to", true, "weakness"]
      ]
    : [
        ["immune", "Imune a", false, "immunity"],
        ["strongResist", "Resiste muito a", false, "resistance"],
        ["resist", "Resiste a", false, "resistance"],
        ["weak", "Vulnerável a", true, "weakness"],
        ["strongWeak", "Muito vulnerável a", true, "weakness"]
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


export function moveImpact(
  power
) {
  const value =
    Number(
      power
      ?? 0
    );

  if (value <= 0) {
    return 0;
  }

  if (value <= 60) {
    return 0;
  }

  if (value <= 90) {
    return 1;
  }

  if (value <= 120) {
    return 2;
  }

  return 3;
}


function moveTargetSkipsAccuracy(
  target
) {
  return [
    "self",
    "user",
    "users-field",
    "opponents-field",
    "entire-field",
    "all-pokemon"
  ].includes(
    String(
      target
      ?? ""
    ).toLocaleLowerCase()
  );
}


export function moveAccuracyPenalty(
  move
) {
  if (
    moveTargetSkipsAccuracy(
      move?.target
    )
  ) {
    return 0;
  }

  if (
    move?.accuracy === null
    ||
    move?.accuracy === undefined
  ) {
    return 0;
  }

  const value =
    Number(
      move.accuracy
    );

  if (
    !Number.isFinite(value)
  ) {
    return 0;
  }

  if (value >= 90) {
    return 0;
  }

  if (value >= 80) {
    return 1;
  }

  if (value >= 60) {
    return 2;
  }

  return 3;
}


export function effectivenessTierDelta(
  multiplier
) {
  const value =
    Number(
      multiplier
      ?? 1
    );

  if (value === 0) {
    return null;
  }

  if (value >= 4) {
    return 2;
  }

  if (value > 1) {
    return 1;
  }

  if (
    value > 0
    &&
    value <= 0.25
  ) {
    return -2;
  }

  if (
    value > 0
    &&
    value < 1
  ) {
    return -1;
  }

  return 0;
}


function moveTargetLitmLabel(
  target,
  language
) {
  const pt = {
    "selected-pokemon":
      "1 alvo",

    "random-opponent":
      "Oponente aleatório",

    "all-opponents":
      "Todos os oponentes",

    "all-other-pokemon":
      "Todos ao redor",

    "user":
      "Usuário",

    "self":
      "Usuário",

    "user-or-ally":
      "Usuário ou aliado",

    "users-field":
      "Seu lado do campo",

    "opponents-field":
      "Lado adversário",

    "entire-field":
      "Campo",

    "all-pokemon":
      "Todos"
  };

  const en = {
    "selected-pokemon":
      "1 target",

    "random-opponent":
      "Random opponent",

    "all-opponents":
      "All opponents",

    "all-other-pokemon":
      "Everyone nearby",

    "user":
      "Self",

    "self":
      "Self",

    "user-or-ally":
      "Self or ally",

    "users-field":
      "Own side",

    "opponents-field":
      "Opposing side",

    "entire-field":
      "Field",

    "all-pokemon":
      "Everyone"
  };

  const map =
    language === "en"
      ? en
      : pt;

  return (
    map[
      String(
        target
        ?? ""
      ).toLocaleLowerCase()
    ]
    ??
    (
      language === "en"
        ? "Target"
        : "Alvo"
    )
  );
}



export function moveLitmProfile(
  move,
  language =
    getPokemonContentLanguage()
) {
  const impact =
    moveImpact(
      move?.power
    );

  const accuracyPenalty =
    moveAccuracyPenalty(
      move
    );

  const accuracyApplies =
    !moveTargetSkipsAccuracy(
      move?.target
    );

  const neverMisses =
    accuracyApplies
    &&
    (
      move?.accuracy === null
      ||
      move?.accuracy === undefined
    );

  const priority =
    Number(
      move?.priority
      ?? 0
    );

  const typeText =
    typeLabel(
      move?.type
      ?? "normal",
      language
    );

  const classText =
    damageClassLabel(
      move?.damageClass
      ?? "status",
      language
    );

  const targetText =
    moveTargetLitmLabel(
      move?.target,
      language
    );

  const typeBadge =
    (
      language === "en"
        ? "Type: "
        : "Tipo: "
    )
    + typeText;

  const classBadge =
    (
      language === "en"
        ? "Category: "
        : "Categoria: "
    )
    + classText;

  const targetBadge =
    (
      language === "en"
        ? "Target: "
        : "Alvo: "
    )
    + targetText;

  const accuracyName =
    accuracyPenalty === 1
      ? (
          language === "en"
            ? "Accuracy: Demanding"
            : "Acerto: Exigente"
        )
      : accuracyPenalty === 2
        ? (
            language === "en"
              ? "Accuracy: Difficult"
              : "Acerto: Difícil"
          )
        : accuracyPenalty >= 3
          ? (
              language === "en"
                ? "Accuracy: Very difficult"
                : "Acerto: Muito difícil"
            )
          : "";

  const accuracyText =
    accuracyPenalty > 0
      ? (
          accuracyName
          + " (-"
          + accuracyPenalty
          + ")"
        )
      : "";

  const impactName =
    impact === 1
      ? (
          language === "en"
            ? "Strong"
            : "Forte"
        )
      : impact === 2
        ? (
            language === "en"
              ? "Powerful"
              : "Poderosa"
          )
        : impact >= 3
          ? (
              language === "en"
                ? "Devastating"
                : "Devastadora"
            )
          : "";

  const impactText =
    impact > 0
      ? (
          (
            language === "en"
              ? "Potency: "
              : "Potência: "
          )
          + impactName
          + " (+"
          + impact
          + ")"
        )
      : "";

  const priorityText =
    priority > 0
      ? (
          language === "en"
            ? "Priority: Fast"
            : "Prioridade: Rápido"
        )
      : priority < 0
        ? (
            language === "en"
              ? "Priority: Slow"
              : "Prioridade: Lento"
          )
        : "";

  return {
    type:
      move?.type
      ?? "normal",

    typeText,
    typeBadge,

    damageClass:
      move?.damageClass
      ?? "status",

    classText,
    classBadge,

    impact,
    impactName,
    impactText,

    accuracy:
      move?.accuracy
      ?? null,

    accuracyPenalty,

    accuracyModifier:
      -accuracyPenalty,

    accuracyName,
    accuracyText,

    neverMisses,

    target:
      move?.target
      ?? "selected-pokemon",

    targetText,
    targetBadge,

    priority,
    priorityText,

    // Base Power e Accuracy continuam como metadados de referência.
    badges: [
      typeBadge,
      classBadge,
      targetBadge,
      priorityText
    ].filter(Boolean)
  };
}


function moveDescriptionPt(move, displayName) {
  const meta = move.meta ?? {};
  const rule = SPECIAL_MOVE_RULES[move.id] ?? {};
  const effectRule = MOVE_EFFECT_RULES[move.id] ?? null;
  const specific =
    effectRule?.descriptionPt
    || databaseMoveEffectPt(move, displayName);

  if (specific) return specific;

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
    const text = cleanDatabaseEffect(
      move.effectTextEn
      || move.shortEffectEn
      || move.flavorEn
      || "",
      move.effectChance
    );
    if (text) return text;
  }
  return moveDescriptionPt(move, displayName);
}


export async function loadPokemonMoveProfile(
  moveId,
  {
    url = null,
    language = getPokemonContentLanguage(),
    might = "adventure"
  } = {}
) {
  const id = String(moveId ?? "").trim().toLocaleLowerCase();
  if (!id) throw new Error("Golpe sem ID canonico.");

  const detail = await fetchPokeJson(
    url || "https://pokeapi.co/api/v2/move/" + encodeURIComponent(id) + "/"
  );

  const effectPt = (detail.effect_entries ?? []).find(entry =>
    ["pt-BR", "pt"].includes(entry.language?.name)
  ) ?? null;
  const effectEn = (detail.effect_entries ?? []).find(entry =>
    entry.language?.name === "en"
  ) ?? null;
  const flavorEn = (detail.flavor_text_entries ?? []).find(entry =>
    entry.language?.name === "en"
  ) ?? null;
  const meta = detail.meta ?? {};

  const move = {
    id: detail.name,
    name: moveLabel(detail.name, detail.names, language),
    englishName: moveEnglishLabel(detail.name, detail.names),
    type: detail.type?.name ?? "normal",
    damageClass: detail.damage_class?.name ?? "status",
    power: Number(detail.power ?? 0),
    accuracy: detail.accuracy == null ? null : Number(detail.accuracy),
    pp: Number(detail.pp ?? 0),
    target: detail.target?.name ?? "selected-pokemon",
    priority: Number(detail.priority ?? 0),
    effectChance: Number(detail.effect_chance ?? 0),
    effectTextPt: String(effectPt?.effect ?? "").trim(),
    shortEffectPt: String(effectPt?.short_effect ?? "").trim(),
    effectTextEn: String(effectEn?.effect ?? "").trim(),
    shortEffectEn: String(effectEn?.short_effect ?? "").trim(),
    flavorEn: String(flavorEn?.flavor_text ?? "")
      .replace(/[\n\f]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
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
    },
    pokemonDbUrl:
      "https://pokemondb.net/move/" + encodeURIComponent(detail.name)
  };

  move.shortDescription = moveShortDescription(move, move.name, language);
  move.description = move.shortDescription;
  move.effects = buildMoveEffects(move, might, language);
  move.vfx = String(move.type ?? "normal") + "-move";
  return move;
}


function statStatusName(stat, direction, language) {
  const label = statLabel(stat, language).toLocaleLowerCase().replace(/\s+/g, "-");
  if (language === "en") return `${label}-${direction > 0 ? "raised" : "lowered"}`;
  return `${label}-${direction > 0 ? "aumentado" : "reduzido"}`;
}

function consequenceTier(chance, guaranteed = false) {
  const value = Number(chance ?? 0);
  if (guaranteed || value >= 100 || value <= 0) return "principal";
  if (value >= 30) return "forte";
  return "extrema";
}

function tierText(tier, language) {
  if (language === "en") {
    return {
      principal: "Main consequence",
      forte: "Strong consequence",
      extrema: "Extreme consequence"
    }[tier] ?? "Consequence";
  }
  return {
    principal: "Consequência principal",
    forte: "Consequência forte",
    extrema: "Consequência extrema"
  }[tier] ?? "Consequência";
}

export function buildMoveThreat(move, displayName, might, language = getPokemonContentLanguage()) {
  const power = Number(move.power ?? 0);
  const meta = move.meta ?? {};
  const rule = SPECIAL_MOVE_RULES[move.id] ?? {};
  const effectRule = MOVE_EFFECT_RULES[move.id] ?? null;
  const description = moveShortDescription(move, displayName, language);
  const consequences = [];

  const add = (text, tier = "principal") => {
    if (!text) return;
    consequences.push(`${tierText(tier, language)} — ${text}`);
  };

  if (power > 0 && move.damageClass !== "status") {
    const level = damageStatusLevel(power);
    if (level > 0) {
      add(language === "en"
        ? `A solid hit can leave the target ${statusMarkup("wounded", level)}.`
        : `Um acerto sólido pode deixar o alvo ${statusMarkup("ferido", level)}.`);
    }
  }

  const ailment = meta.ailment;
  if (ailment && ailment !== "none" && ailment !== "unknown") {
    const status = language === "en" ? ailment : (AILMENT_PTBR[ailment] ?? ailment);
    const chance = Number(meta.ailmentChance ?? move.effectChance ?? 0);
    const guaranteed = move.damageClass === "status" || chance >= 100;
    const level = guaranteed ? 3 : 2;
    add(
      language === "en"
        ? `Can leave the target ${statusMarkup(status, level)}.`
        : `Pode deixar o alvo ${statusMarkup(status, level)}.`,
      consequenceTier(chance, guaranteed)
    );
  }

  if (Number(meta.flinchChance) > 0) {
    add(
      language === "en"
        ? `Can leave the target ${statusMarkup("hesitation-on-next-move", 2)}. The Status expires after the next relevant action.`
        : `Pode deixar o alvo ${statusMarkup("hesitacao-no-proximo-movimento", 2)}. O Status expira após a próxima ação relevante.`,
      consequenceTier(meta.flinchChance)
    );
  }

  if (Number(meta.drain) < 0) {
    const recoilLevel = Number(meta.drain) <= -50 ? 2 : 1;
    add(language === "en"
      ? `The user suffers ${statusMarkup("hurt-by-recoil", recoilLevel)}.`
      : `O próprio Pokémon recebe ${statusMarkup("ferido-pelo-recuo", recoilLevel)}.`);
  }

  if (Number(meta.healing) > 0 || Number(meta.drain) > 0) {
    add(language === "en"
      ? `The user can become ${statusMarkup("recovered", 2)}.`
      : `O Pokémon pode receber ${statusMarkup("recuperado", 2)}.`);
  }

  for (const change of move.statChanges ?? []) {
    const amount = Number(change.change ?? 0);
    if (!amount) continue;
    const selfTarget = String(move.target ?? "").includes("user");
    const level = Math.min(4, Math.max(1, Math.abs(amount) + 1));
    const status = statStatusName(change.stat, amount, language);
    const chance = Number(meta.statChance ?? move.effectChance ?? 0);
    const text = selfTarget
      ? (language === "en"
          ? `The Pokémon can become ${statusMarkup(status, level)}.`
          : `O Pokémon pode ficar ${statusMarkup(status, level)}.`)
      : (language === "en"
          ? `Can leave the target ${statusMarkup(status, level)}.`
          : `Pode deixar o alvo ${statusMarkup(status, level)}.`);
    add(text, consequenceTier(chance, chance <= 0));
  }

  if (rule.trap) {
    add(language === "en"
      ? `Can leave the target ${statusMarkup("trapped", 2)}.`
      : `Pode deixar o alvo ${statusMarkup("preso", 2)}.`);
  }
  if (rule.recharge) {
    add(language === "en"
      ? `After using it, the Pokémon becomes ${statusMarkup("recovering", 2)}.`
      : `Depois de usar o golpe, o Pokémon fica ${statusMarkup("recuperando-se", 2)}.`);
  }
  if (rule.statusPt || rule.statusEn) {
    add(language === "en"
      ? `Can leave the target ${statusMarkup(rule.statusEn ?? rule.statusPt, rule.statusLevel ?? 2)}.`
      : `Pode deixar o alvo ${statusMarkup(rule.statusPt ?? rule.statusEn, rule.statusLevel ?? 2)}.`);
  }
  if (rule.selfPt || rule.selfEn) {
    add(language === "en"
      ? `The Pokémon can become ${statusMarkup(rule.selfEn ?? rule.selfPt, rule.selfLevel ?? 2)}.`
      : `O Pokémon pode ficar ${statusMarkup(rule.selfPt ?? rule.selfEn, rule.selfLevel ?? 2)}.`);
  }

  if (effectRule?.statusPt || effectRule?.statusEn) {
    const status =
      language === "en"
        ? (effectRule.statusEn ?? effectRule.statusPt)
        : (effectRule.statusPt ?? effectRule.statusEn);
    const level = Number(effectRule.level ?? 2);
    const target = effectRule.target ?? "target";

    if (target === "self") {
      add(
        language === "en"
          ? `The Pokémon can become ${statusMarkup(status, level)}.`
          : `O Pokémon pode ficar ${statusMarkup(status, level)}.`
      );
    } else if (target === "scene") {
      add(
        language === "en"
          ? `Changes the battlefield: ${statusMarkup(status, level)}.`
          : `Altera o campo: ${statusMarkup(status, level)}.`
      );
    } else {
      add(
        language === "en"
          ? `Can leave the target ${statusMarkup(status, level)}.`
          : `Pode deixar o alvo ${statusMarkup(status, level)}.`
      );
    }
  }

  if (!consequences.length) {
    add(language === "en"
      ? `Creates an opening or complication appropriate to ${displayName}.`
      : `Cria uma abertura ou complicação coerente com ${displayName}.`);
  }

  return { description, list: [...new Set(consequences)] };
}


export function buildMoveEffects(move, might, language = getPokemonContentLanguage()) {
  const effects = [];
  const meta = move?.meta ?? {};
  const rule = SPECIAL_MOVE_RULES[move?.id] ?? {};
  const effectRule = MOVE_EFFECT_RULES[move?.id] ?? null;

  const push = effect => {
    if (!effect?.name) return;
    const key = [
      effect.target,
      effect.kind,
      effect.name,
      effect.level,
      effect.trigger
    ].join("|");

    if (effects.some(existing => existing._key === key)) return;
    effects.push({
      ...effect,
      _key: key
    });
  };

  const power = Number(move?.power ?? 0);
  if (power > 0 && move?.damageClass !== "status") {
    const level = damageStatusLevel(power);
    if (level > 0) {
      push({
        target: "target",
        kind: "status",
        name: language === "en" ? "wounded" : "ferido",
        level,
        trigger: "principal",
        source: "damage"
      });
    }
  }

  const ailment = meta.ailment;
  if (ailment && ailment !== "none" && ailment !== "unknown") {
    const chance = Number(meta.ailmentChance ?? move.effectChance ?? 0);
    const guaranteed = move.damageClass === "status" || chance >= 100;
    push({
      target: "target",
      kind: "status",
      name:
        language === "en"
          ? ailment
          : (AILMENT_PTBR[ailment] ?? ailment),
      level: guaranteed ? 3 : 2,
      trigger: consequenceTier(chance, guaranteed),
      source: "ailment"
    });
  }

  if (Number(meta.flinchChance) > 0) {
    push({
      target: "target",
      kind: "status",
      name:
        language === "en"
          ? "hesitation-on-next-move"
          : "hesitacao-no-proximo-movimento",
      level: 2,
      trigger: consequenceTier(meta.flinchChance),
      expires: "next-action",
      source: "flinch"
    });
  }

  if (Number(meta.drain) < 0) {
    push({
      target: "self",
      kind: "status",
      name:
        language === "en"
          ? "hurt-by-recoil"
          : "ferido-pelo-recuo",
      level: Number(meta.drain) <= -50 ? 2 : 1,
      trigger: "principal",
      source: "recoil"
    });
  }

  if (Number(meta.healing) > 0 || Number(meta.drain) > 0) {
    push({
      target: "self",
      kind: "status",
      name:
        language === "en"
          ? "recovered"
          : "recuperado",
      level: 2,
      trigger: "principal",
      source: Number(meta.drain) > 0 ? "drain" : "healing"
    });
  }

  for (const change of move?.statChanges ?? []) {
    const amount = Number(change.change ?? 0);
    if (!amount) continue;

    const selfTarget =
      String(move?.target ?? "").includes("user");

    const chance =
      Number(meta.statChance ?? move?.effectChance ?? 0);

    push({
      target: selfTarget ? "self" : "target",
      kind: "status",
      name: statStatusName(
        change.stat,
        amount,
        language
      ),
      level: Math.min(
        4,
        Math.max(1, Math.abs(amount) + 1)
      ),
      trigger: consequenceTier(
        chance,
        chance <= 0
      ),
      source: "stat-change"
    });
  }

  if (rule.trap) {
    push({
      target: "target",
      kind: "status",
      name: language === "en" ? "trapped" : "preso",
      level: 2,
      trigger: "principal",
      source: "trap"
    });
  }

  if (rule.recharge) {
    push({
      target: "self",
      kind: "status",
      name:
        language === "en"
          ? "recovering"
          : "recuperando-se",
      level: 2,
      trigger: "principal",
      source: "recharge"
    });
  }

  if (rule.statusPt || rule.statusEn) {
    push({
      target: "target",
      kind: "status",
      name:
        language === "en"
          ? (rule.statusEn ?? rule.statusPt)
          : (rule.statusPt ?? rule.statusEn),
      level: Number(rule.statusLevel ?? 2),
      trigger: "principal",
      source: "move-rule"
    });
  }

  if (rule.selfPt || rule.selfEn) {
    push({
      target: "self",
      kind: "status",
      name:
        language === "en"
          ? (rule.selfEn ?? rule.selfPt)
          : (rule.selfPt ?? rule.selfEn),
      level: Number(rule.selfLevel ?? 2),
      trigger: "principal",
      source: "move-rule"
    });
  }

  if (effectRule?.statusPt || effectRule?.statusEn) {
    push({
      target: effectRule.target ?? "target",
      kind: effectRule.kind ?? "status",
      name:
        language === "en"
          ? (effectRule.statusEn ?? effectRule.statusPt)
          : (effectRule.statusPt ?? effectRule.statusEn),
      level: Number(effectRule.level ?? 2),
      trigger: "principal",
      source: "database-effect"
    });
  }

  return effects.map(({ _key, ...effect }) => effect);
}

export function buildAbilityThreat(ability, language = getPokemonContentLanguage()) {
  if (!ability?.id) return null;
  const rule = ABILITY_THREAT_RULES[ability.id] ?? null;
  const description = rule
    ? (language === "en" ? rule.en : rule.pt)
    : (
        language === "en"
          ? (ability.effectTextEn || `The Ability ${ability.name} changes how this Pokémon behaves in the confrontation.`)
          : (
              ABILITY_EFFECT_PTBR[ability.id]
              || `A Habilidade ${ability.name} possui um efeito passivo próprio desta espécie. Use-a quando sua condição de ativação for relevante na ficção.`
            )
      );

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
