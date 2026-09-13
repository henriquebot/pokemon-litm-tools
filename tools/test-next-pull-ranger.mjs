import assert from "node:assert/strict";
import fs from "node:fs";

const read = file => fs.readFileSync(file, "utf8");
const creator = read("scripts/character-creator-app.js");
const creatorTemplate = read("templates/character-creator.hbs");
const themeBuilder = read("scripts/character-theme-builder.js");
const manager = read("scripts/pokemon-manager-app.js");
const outline = read("scripts/token-outline.js");
const showcase = read("scripts/pokemon-showcase.js");
const combat = read("scripts/pokemon-combat-effects.js");
const guided = read("scripts/pokemon-guided-flow.js");
const styles = read("styles/importer.css");
const ranger = JSON.parse(read("data/ranger-themes.json"));

const flat = value => value.replace(/\s+/g, " ").trim();
const creatorFlat = flat(creator);
const outlineFlat = flat(outline);

function ok(name, value) {
  assert.equal(Boolean(value), true, name);
  console.log("ok - " + name);
}

ok(
  "Themes normais usam Title Tag nativa + 2 Power Tags adicionais",
  creator.includes("powerTags.length === 2")
  && creator.includes("draft?.titleTag")
  && creatorTemplate.includes("data-theme-title-tag")
  && themeBuilder.includes("powerTags.length === 2")
  && themeBuilder.includes("draft?.titleTag")
  && themeBuilder.includes("...additionalPowerTags")
  && !themeBuilder.includes("3 Tags de Poder")
);

ok(
  "Ranger possui 8 presets estruturados",
  ranger.themes.length >= 8
  && ranger.themes.every(theme =>
    ["title", "power1", "power2", "weakness", "quest"].every(key =>
      theme.questions?.[key]?.prompt
      && Array.isArray(theme.questions?.[key]?.suggestions)
      && theme.questions[key].suggestions.length >= 3
    )
  )
);

ok(
  "Character Creator expõe Ranger como terceiro tipo",
  creatorTemplate.includes('data-character-type="ranger"')
  && creator.includes('this.mode === "ranger"')
  && creatorTemplate.includes("Pokémon Parceiro")
  && creatorTemplate.includes("Pokémon com quem gostaria de trabalhar um dia")
  && creatorTemplate.includes("CRIAR RANGER")
);

ok(
  "Ranger permite 0 ou 1 Parceiro e exige quatro Themes",
  creatorFlat.includes('this.mode === "ranger"')
  && creatorFlat.includes("this.teamSize === 0")
  && creatorFlat.includes("this.teamSize === 1")
  && creator.includes("_rangerStepMap")
  && creatorFlat.includes("this.rangerThemeSelections.length === 4")
);

ok(
  "Ranger usa Styler básico na Backpack e lista desejada narrativa",
  creator.includes('"Styler básico"')
  && creator.includes('"rangerDesiredPokemonIds"')
  && creator.includes("saveRangerDesiredPokemon")
  && !creator.match(/saveRangerDesiredPokemon[^]*ensurePokemonReferenceTheme/)
);

ok(
  "Ranger usa sugestões editáveis e resposta livre",
  creatorTemplate.includes("data-ranger-suggestion")
  && creatorTemplate.includes("data-ranger-answer")
  && creator.includes("setRangerDraftAnswer")
);

ok(
  "Pokemon Manager exige OWNER explicitamente",
  manager.includes("function canManageActor(")
  && manager.includes("DOCUMENT_OWNERSHIP_LEVELS")
  && manager.includes(".OWNER")
  && manager.includes("testUserPermission")
  && manager.includes("canManageActor(actor)")
);

ok(
  "Status tem outline maior, glow baixo e pulso lento",
  outlineFlat.includes("state.outline.thickness = 5")
  && outline.includes("state.glow")
  && outline.includes("new GlowFilter")
  && showcase.includes("statusWave")
  && /now\s*\*\s*1\.15/.test(showcase)
);

ok(
  "Cards de golpe forçam fundo transparente",
  /element\.style\.setProperty\(\s*"background",\s*"transparent",\s*"important"/s.test(combat)
  && styles.includes("POKEMON MOVE CARDS - BORDER ONLY")
  && styles.includes("background-image: none !important")
);

ok(
  "Resolver como possui Voltar e reabre escolha da ação",
  /action\s*:\s*"pokemon-back"/.test(guided)
  && /mode\s*===\s*"pokemon-back"/.test(guided)
  && /while\s*\(\s*true\s*\)/.test(guided)
);

ok(
  "Cards guiados de golpe são completos e compartilhados",
  guided.includes("function pokemonMoveRichBodyHtml(")
  && guided.includes("moveLitmProfile(")
  && guided.includes("pokemon-guided-move-badges")
  && guided.includes("pokemon-guided-move-effects")
  && guided.includes("bodyHtml:")
);

ok(
  "Ranger com Parceiro reutiliza personalização completa do Treinador",
  creator.includes("rangerHasPartner")
  && creator.includes("rangerSteps.customize")
  && creator.includes("loadPokemonTrainerCustomization")
  && creatorTemplate.includes("Personalize seu Pokémon Parceiro")
  && creatorTemplate.includes("data-pokemon-nature")
  && creatorTemplate.includes("data-pokemon-ability")
  && creatorTemplate.includes("data-pokemon-move")
);

ok(
  "Ranger pode finalizar com 0 ou 1 Parceiro",
  creator.includes('this.mode === "ranger"')
  && creator.includes("this.step === rangerSteps.review")
  && creator.includes("const canFinish")
  && creatorTemplate.includes("Nenhum")
);

ok(
  "Themes Ranger selecionados têm feedback visual explícito",
  creatorTemplate.includes("pokemon-ranger-theme-selected")
  && creatorTemplate.includes("fa-check")
  && styles.includes(".pokemon-ranger-theme-option.selected")
  && styles.includes("RANGER SMOKE FIXES 2026-09-12")
);

ok(
  "Cards de Ações e golpes não recebem preenchimento",
  styles.includes('.pokemon-biography-effect[data-pokemon-effect-kind="move"]')
  && styles.includes('.pokemon-biography-effect[data-pokemon-move-type]')
  && styles.includes(".pokemon-character-action-card")
  && styles.includes("background-color: transparent !important")
  && styles.includes("background-image: none !important")
);

console.log("Pokemon LITM Tools | next pull Ranger + UX tests passed");
