import assert from "node:assert/strict";
import fs from "node:fs";

const read = file => fs.readFileSync(file, "utf8");

const importer = read("scripts/importer-app.js");
const template = read("templates/importer.hbs");
const guided = read("scripts/pokemon-guided-flow.js");
const combat = read("scripts/pokemon-combat-effects.js");
const follower = read("scripts/pokemon-follower.js");
const combatLayer = read("scripts/pokemon-combat.js");
const main = read("scripts/main.js");
const tokenDrop = read("scripts/pokemon-token-drop.js");
const styles = read("styles/importer.css");
const creatorTemplate = read("templates/character-creator.hbs");

function ok(name, value) {
  assert.equal(Boolean(value), true, name);
  console.log("ok - " + name);
}

ok(
  "Importer abre Actor novo em modo de jogo",
  (importer.includes("editMode:") && importer.includes("system: {"))
);

ok(
  "Trainer Class tem nome próprio e próximo nome",
  importer.includes("TRAINER_NAME_POOLS")
  && importer.includes("data-trainer-name")
  && template.includes("data-next-trainer-name")
  && importer.includes("forceNew:")
);

ok(
  "Scene folder possui segundo gate pós-create",
  importer.includes("actualFolderId")
  && importer.includes("await actor.update({\n        folder:")
);

ok(
  "mini-cards não usam speaker aleatório",
  !guided.includes("speaker: ChatMessage.getSpeaker()")
  && guided.includes('speakerAlias = "Pokémon LITM Tools"')
);

ok(
  "Challenge possui botões rápidos de Ameaça e Consequência",
  guided.includes("pokemonChallengeQuickActions")
  && guided.includes('"📣"')
  && guided.includes('"💥"')
);

ok(
  "Feito Extra permite somente narrar",
  guided.includes("Outro efeito — descreva em voz alta")
  && guided.includes("Não precisa escrever. Você pode simplesmente dizer ao grupo")
  && guided.includes("Efeito extra narrado em jogo")
);

ok(
  "Trainer Theme congela Theme e token do Pokémon",
  combat.includes("pokemonSourceThemeId")
  && combat.includes("pokemonSourceTokenId")
  && combat.includes("pokemonSourceInstanceId")
  && combat.includes("selectedMoveContextFromActorState")
  && combat.includes("associatedPokemonSourceToken")
);

ok(
  "Tag/Status pode ser solto diretamente no token",
  tokenDrop.includes('"dropCanvasData"')
  && tokenDrop.includes('data.type === "status"')
  && tokenDrop.includes('data.type === "tag"')
  && tokenDrop.includes("Synthetic Actor")
  && main.includes("activatePokemonTokenDrop")
);

ok(
  "Boss Wizard tem Voltar preservando draft",
  guided.includes('label: "← Voltar"')
  && guided.includes("priorCustom")
  && guided.includes("customResult.values")
);

ok(
  "JB2A evita roots sabidamente ausentes",
  combat.includes('water: ["jb2a.water_splash", "jb2a.energy_beam", "jb2a.bullet.01"]')
  && combat.includes('ice: ["jb2a.ray_of_frost", "jb2a.energy_beam"]')
  && combat.includes('poison: ["jb2a.energy_beam", "jb2a.bullet.01"]')
  && combat.includes('ground: ["jb2a.bullet.01"]')
  && combat.includes('rock: ["jb2a.bullet.01"]')
  && combat.includes('getPathsUnder === "function" && exists(root)')
);

ok(
  "troca de follower usa VFX de Pokébola",
  follower.includes("playPokemonFollowerSwapVfx")
  && follower.includes("vfx = true")
  && combatLayer.includes("playPokemonPokeballVfx")
  && main.includes("playPokemonPokeballVfx")
);

const preCreateStart =
  combat.indexOf(
    "function onPreCreateChatMessage("
  );

const preCreateEnd =
  combat.indexOf(
    "\n\nasync function moveFromChatMessage(",
    preCreateStart
  );

const preCreate =
  preCreateStart >= 0
  && preCreateEnd > preCreateStart
    ? combat.slice(
        preCreateStart,
        preCreateEnd
      )
    : "";

ok(
  "review fixes: flags são gravadas no preCreate",
  preCreate.includes(
    ".pokemonSourceThemeId"
  )
  && preCreate.includes(
    ".pokemonSourceInstanceId"
  )
  && preCreate.includes(
    ".pokemonSourceTokenId"
  )
  && preCreate.includes(
    "selectedMoveContextFromActorState("
  )
  && preCreate.includes(
    "message.updateSource("
  )
);

ok(
  "review fixes: consequence rápida preserva Move Pokémon",
  guided.includes(
    "function challengeMoveForSheetAction("
  )
  && guided.includes(
    "moveId:\n        pokemonMove?.id"
  )
  && guided.includes(
    'kind:\n      pokemonMove\n        ? "pokemon"'
  )
);

ok(
  "review fixes: drops são serializados",
  tokenDrop.includes(
    "const dropQueues ="
  )
  && tokenDrop.includes(
    "function queueDropToToken("
  )
  && tokenDrop.includes(
    "void queueDropToToken("
  )
);

ok(
  "review fixes: Combat Token é restaurado após recollect de follower",
  follower.includes(
    "restoreAfter = false"
  )
  && follower.includes(
    "isCombatToken(\n          previousToken"
  )
  && combatLayer.includes(
    "restoreAfter === true"
  )
  && combatLayer.includes(
    "message.restoreAfter === true"
  )
);

ok(
  "review fixes: Importar Selecionados usa nome escolhido",
  importer.includes(
    "selectedTrainerName"
  )
  && importer.includes(
    "this.trainerNames.get("
  )
);

ok(
  "review fixes: Sequencer usa objeto de opções",
  combat.includes(
    "getPathsUnder.call(database, root, { fullyQualified: true })"
  )
  && !combat.includes(
    "getPathsUnder.call(database, root, true)"
  )
);

ok(
  "runtime UX: pessoas genéricas recebem nomes variados por gênero",
  importer.includes("function isGenericPersonEntry(")
  && importer.includes("function inferPersonGender(")
  && importer.includes("stableTrainerNameOffset")
  && importer.includes("TRAINER_MALE_FALLBACK_NAMES")
  && importer.includes("TRAINER_FEMALE_FALLBACK_NAMES")
  && template.includes('data-gender="{{gender}}"')
);

ok(
  "runtime UX: biblioteca de Challenges usa Actors existentes e subpastas",
  importer.includes("function challengeLibraryData(")
  && importer.includes('"li.directory-item.document"') === false
  && importer.includes('type:\n                "Actor"')
  && template.includes('data-tab="challenges"')
  && template.includes('data-role="challenge-folder"')
  && template.includes("data-challenge-uuid")
  && template.includes("Abrir ficha")
);

ok(
  "runtime UX: Character Creator mostra seleção e personalização em duas colunas",
  creatorTemplate.includes("pokemon-character-type-card")
  && creatorTemplate.includes("pokemon-team-customization-tabs")
  && styles.includes(".pokemon-character-type-card.selected::after")
  && styles.includes("grid-template-columns:\n    minmax(210px, 280px)")
);

ok(
  "runtime UX: mini-cards escondem speaker e formatam Status",
  guided.includes("hideSpeaker:\n          true")
  && guided.includes("function miniCardBodyHtml(")
  && guided.includes('class="draggable status')
  && guided.includes('".message-sender, .message-author"')
);

ok(
  "runtime UX: descoberta tem perguntas sugeridas, voz alta e assunto",
  guided.includes("Pergunta sugerida")
  && guided.includes("Vou fazer a pergunta em voz alta")
  && guided.includes("subjectLabel")
  && guided.includes('subtitle:\n      "Sobre " + subjectLabel')
);

ok(
  "runtime UX: Ameaça rápida leva VFX ilustrativo",
  guided.includes("announceChallengeThreatFromSheet(\n  actor,\n  action,\n  actionIndex = -1")
  && guided.includes("targetTokenIds")
  && combat.includes(".pokemon-guided-mini-card.threat > div")
);

ok(
  "runtime UX: neutralidade não aparece no report de consequência",
  combat.includes("multiplierLabel: compactPokemonMatchupLabel(multiplier)")
  && combat.includes("move ? compactPokemonMatchupLabel(multiplier) :")
);

ok(
  "runtime UX: sidebar diferencia Personagem e Challenge",
  main.includes('"renderActorDirectory"')
  && main.includes("decoratePokemonActorDirectoryKinds")
  && main.includes("pokemon-actor-kind-badge")
  && styles.includes(".pokemon-actor-kind-challenge")
);

console.log("Pokemon LITM Tools | v0.8.1 bundle tests passed");
