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

const guided =
  read("scripts/pokemon-guided-flow.js");

const template =
  read("templates/pokemon-builder-wizard.hbs");

const styles =
  read("styles/importer.css");

const roadmap =
  read("ROADMAP.md");

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
  "showcase wired in main",
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
  "token visuals never move TokenDocument",
  showcase.includes(
    '"drawToken"'
  )
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
  "fake oval shadow removed",
  showcase.includes(
    "const shadow =\n    null;"
  )
  &&
  !showcase.includes(
    "state.shadow.alpha"
  )
  &&
  !showcase.includes(
    "state.shadow.scale"
  )
);

ok(
  "ambient flying and water effects default off",
  showcase.includes(
    "visualShowcaseAmbientFx"
  )
  &&
  showcase.includes(
    "function ambientFxEnabled()"
  )
  &&
  showcase.includes(
    "const ambientFx =\n    ambientFxEnabled();"
  )
  &&
  showcase.includes(
    "default:\n        false"
  )
);

ok(
  "status and reaction text handles PIXI version",
  showcase.includes(
    "PIXI.VERSION"
  )
  &&
  showcase.includes(
    "new PIXI.Text(\n    value,\n    style"
  )
);

ok(
  "reactions use native token HUD column",
  showcase.includes(
    '"renderTokenHUD"'
  )
  &&
  showcase.includes(
    '".col.right"'
  )
  &&
  showcase.includes(
    "pokemonReactionToggle"
  )
  &&
  showcase.includes(
    "control-icon pokemon-reaction-choice"
  )
  &&
  showcase.includes(
    "showcase-reaction"
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
  "pokeball keeps showcase burst",
  combat.includes(
    "playPokemonShowcaseBurst"
  )
);

ok(
  "challenge config destination divider remains",
  template.includes(
    "pokemon-builder-section-divider"
  )
  &&
  styles.includes(
    ".pokemon-builder-section-divider"
  )
);

ok(
  "consequence dialog is two columns with search",
  guided.includes(
    "pokemon-guided-consequence-dialog"
  )
  &&
  guided.includes(
    'name="targetSearch"'
  )
  &&
  guided.includes(
    "data-consequence-target-row"
  )
  &&
  styles.includes(
    ".pokemon-guided-consequence-target-list"
  )
  &&
  styles.includes(
    "overflow-y: auto"
  )
);

ok(
  "move cards avoid colored background",
  styles.includes(
    ".pokemon-guided-mini-card {\n  background: transparent !important;"
  )
  &&
  styles.includes(
    ".pokemon-litm-roll-package[data-pokemon-move-type]"
  )
);

ok(
  "roadmap records maintenance, transformations and real shadow",
  roadmap.includes(
    "Editor de manutenção no header"
  )
  &&
  roadmap.includes(
    "Fluxo unificado de evolução e transformações"
  )
  &&
  roadmap.includes(
    "Drop Shadow real"
  )
);

console.log(
  "Pokemon LITM Tools | Visual Showcase smoke fixes passed"
);