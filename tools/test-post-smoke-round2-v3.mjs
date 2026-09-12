import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = file =>
  fs.readFileSync(
    file,
    "utf8"
  );

const showcase =
  read(
    "scripts/pokemon-showcase.js"
  );

const combat =
  read(
    "scripts/pokemon-combat-effects.js"
  );

const main =
  read(
    "scripts/main.js"
  );

function ok(
  name,
  value
) {
  assert.equal(
    Boolean(
      value
    ),
    true,
    name
  );

  console.log(
    "ok - "
    + name
  );
}


function jsFiles(
  dir
) {
  const result = [];

  for (
    const entry
    of fs.readdirSync(
      dir,
      {
        withFileTypes:
          true
      }
    )
  ) {
    const full =
      path.join(
        dir,
        entry.name
      );

    if (
      entry.isDirectory()
    ) {
      result.push(
        ...jsFiles(
          full
        )
      );

    } else if (
      entry.isFile()
      &&
      entry.name.endsWith(
        ".js"
      )
    ) {
      result.push(
        full
      );
    }
  }

  return result;
}


ok(
  "Showcase nÃ£o altera sampling da imagem do token",
  !showcase.includes(
    "applyPokemonPixelSampling"
  )
  &&
  !showcase.includes(
    'scaleMode =\n          "nearest"'
  )
);


ok(
  "Status usa somente o primeiro efeito reconhecido e contorno pulsante",
  showcase.includes(
    "for (\n    const row\n    of rows"
  )
  &&
  showcase.includes(
    "return profile;"
  )
  &&
  showcase.includes(
    "setPokemonStatusOutline("
  )
  &&
  showcase.includes(
    "setPokemonStatusOutlineAlpha("
  )
  &&
  !showcase.includes(
    "statusOutlineSprites"
  )
  &&
  !showcase.includes(
    "let statusIcon ="
  )
  &&
  !showcase.includes(
    "let statusRing ="
  )
);


ok(
  "Combat Actor do Theme recebe Ações Pokemon",
  combat.includes(
    '"combatProjection"\n    ) === true'
  )
  &&
  combat.includes(
    '"pokemon-combat"'
  )
  &&
  combat.includes(
    "addPokemonCharacterOtherActions("
  )
);


ok(
  "Spend Power mantém sugestões dentro de Status e Tag",
  combat.includes(
    "openNativePokemonStatusSpend"
  )
  &&
  combat.includes(
    "openNativePokemonTagSpend"
  )
  &&
  !combat.includes(
    "appendPokemonMoveSpendSuggestions"
  )
);


ok(
  "Subdialog de efeito tem Voltar",
  combat.includes(
    'action: "pokemon-back"'
  )
  &&
  combat.includes(
    'label: "Voltar"'
  )
  &&
  combat.includes(
    "openNativePokemonStatusSpend("
  )
);


ok(
  "Idioma dos cards possui auto pt-BR e native",
  main.includes(
    '"litmCardLanguage"'
  )
  &&
  main.includes(
    '"Automático (seguir idioma do Foundry)"'
  )
  &&
  main.includes(
    '"Padrão do sistema"'
  )
  &&
  combat.includes(
    "function usePokemonPtBrLitmCards()"
  )
);


ok(
  "Cards LitM traduzem Spend Power e labels nativas",
  combat.includes(
    "GASTAR POWER EM EFEITOS:"
  )
  &&
  combat.includes(
    "Status: efeito do golpe / criar / reduzir"
  )
  &&
  combat.includes(
    "Tag: efeito do golpe / criar / riscar / recuperar"
  )
  &&
  combat.includes(
    "Sem consequências."
  )
);


const modalTrueFiles =
  jsFiles(
    "scripts"
  ).filter(
    file =>
      /\bmodal\s*:\s*true\b/i
        .test(
          read(
            file
          )
        )
  );


ok(
  "Nenhum Dialog explicito do modulo bloqueia o Foundry",
  modalTrueFiles.length
    === 0
);


console.log(
  "Pokemon LITM Tools | post-smoke round 2 v3 tests passed"
);