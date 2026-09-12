import assert from "node:assert/strict";
import fs from "node:fs";

const read = file => fs.readFileSync(file, "utf8");
const outline = read("scripts/token-outline.js");
const showcase = read("scripts/pokemon-showcase.js");
const combat = read("scripts/pokemon-combat-effects.js");
const styles = read("styles/importer.css");

function ok(name, value) {
  assert.equal(Boolean(value), true, name);
  console.log("ok - " + name);
}

ok(
  "status usa OutlineFilter real",
  outline.includes("export function setPokemonStatusOutline(")
  && outline.includes("export function clearPokemonStatusOutline(")
  && showcase.includes('from "./token-outline.js"')
  && showcase.includes("setPokemonStatusOutline(")
  && showcase.includes("setPokemonStatusOutlineAlpha(")
);

ok(
  "status reconhece strings e objetos do LitM",
  showcase.includes('typeof row === "string"')
  && showcase.includes("return profile;")
);

ok(
  "showcase nÃ£o altera sampling do token",
  !showcase.includes("applyPokemonPixelSampling")
);

ok(
  "status nÃ£o usa Ã­cone cÃ­rculo nem sprites duplicados",
  !showcase.includes("statusOutlineSprites")
  && !showcase.includes("syncStatusOutlineSprites")
  && !showcase.includes("let statusIcon =")
  && !showcase.includes("let statusRing =")
);

const cardAccentCalls =
  combat.match(/applyPokemonMoveTypeAccent\(\s*card,\s*move\s*\)/g) ?? [];

ok(
  "move cards recebem cor do tipo na borda",
  cardAccentCalls.length >= 2
  && styles.includes('.pokemon-biography-effect[data-pokemon-effect-kind="move"][data-pokemon-move-type]')
  && styles.includes("background: transparent !important;")
);

ok(
  "Criar Status e Criar Tag possuem Voltar",
  combat.includes('window: { title: isTag ? "Criar Tag" : "Criar Status" }')
  && combat.includes('action: "pokemon-back"')
  && combat.includes("openNativePokemonStatusSpend(")
  && combat.includes("openNativePokemonTagSpend(")
);

ok(
  "prosa padrÃ£o LitM possui traduÃ§Ã£o PT-BR",
  combat.includes("O Narrador decide um desenvolvimento narrativo prejudicial ao HerÃ³i")
  && combat.includes("Sucesso (como em 10+) e ConsequÃªncias")
  && combat.includes("A aÃ§Ã£o acontece como esperado, ou melhor")
  && combat.includes("VocÃª pode gastar Power:")
);

console.log("Pokemon LITM Tools | post-smoke round 3 v4 safe tests passed");
