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

console.log("Pokemon LITM Tools | v0.8.1 bundle tests passed");
