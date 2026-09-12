import assert from "node:assert/strict";
import fs from "node:fs";

const read = file =>
  fs.readFileSync(file, "utf8");

const showcase =
  read("scripts/pokemon-showcase.js");

const main =
  read("scripts/main.js");

const combat =
  read("scripts/pokemon-combat.js");

const template =
  read("templates/pokemon-builder-wizard.hbs");

const styles =
  read("styles/importer.css");

function ok(name, value) {
  assert.equal(
    Boolean(value),
    true,
    name
  );

  console.log(
    "ok - " + name
  );
}

ok(
  "Visual Showcase Ã© ativado pelo main",
  main.includes(
    'from "./pokemon-showcase.js"'
  )
  &&
  main.includes(
    "registerPokemonShowcaseSettings();"
  )
  &&
  main.includes(
    "activatePokemonShowcase();"
  )
);

ok(
  "Token FX Ã© somente visual e nÃ£o move TokenDocument",
  showcase.includes(
    'Hooks.on(\n    "drawToken"'
  )
  &&
  showcase.includes(
    "pokemon-builder"
  ) === false
  &&
  !showcase.includes(
    "updateEmbeddedDocuments"
  )
  &&
  !showcase.includes(
    "token.document.update"
  )
);

ok(
  "Token FX possui sombra, voo, Ã¡gua e status",
  showcase.includes(
    "graphicsEllipse("
  )
  &&
  showcase.includes(
    "flyingPokemon("
  )
  &&
  showcase.includes(
    "waterPokemon("
  )
  &&
  showcase.includes(
    "statusProfile("
  )
  &&
  showcase.includes(
    "basePivotY"
  )
);

ok(
  "PokÃ©bola existente ganhou burst complementar",
  combat.includes(
    "playPokemonShowcaseBurst"
  )
);

for (
  const reaction
  of [
    "alert",
    "question",
    "speech",
    "heart",
    "anger",
    "sweat",
    "sleep"
  ]
) {
  assert.equal(
    showcase.includes(
      reaction + ":"
    ),
    true,
    "reaction: " + reaction
  );
}

ok(
  "Reactions aparecem no Token HUD e usam socket",
  showcase.includes(
    '"renderTokenHUD"'
  )
  &&
  showcase.includes(
    "showcase-reaction"
  )
  &&
  showcase.includes(
    "data-pokemon-reaction-hud"
  )
  &&
  showcase.includes(
    "pokemonReactionHud"
  )
);

ok(
  "Token FX e reactions podem ser desligados",
  showcase.includes(
    "visualShowcaseTokenFx"
  )
  &&
  showcase.includes(
    "visualShowcaseReactions"
  )
  &&
  showcase.includes(
    "game.settings.register"
  )
);

ok(
  "Criador de Challenge separa ConfiguraÃ§Ã£o e Destino",
  template.includes(
    "pokemon-builder-section-divider"
  )
  &&
  styles.includes(
    ".pokemon-builder-section-divider"
  )
);

for (
  const root
  of [
    ".pokemon-importer",
    ".pokemon-character-creator",
    ".pokemon-manager",
    ".pokemon-challenge-wizard"
  ]
) {
  assert.equal(
    styles.includes(root),
    true,
    "showcase root: " + root
  );
}

ok(
  "Showcase aplica acabamento pixel/GBA",
  styles.includes(
    "VISUAL SHOWCASE V1"
  )
  &&
  styles.includes(
    "image-rendering: pixelated"
  )
  &&
  styles.includes(
    ".pokemon-reaction-hud"
  )
);

console.log(
  "Pokemon LITM Tools | Visual Showcase v1 tests passed"
);
