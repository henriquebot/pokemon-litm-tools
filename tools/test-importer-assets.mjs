import assert from "node:assert/strict";
import fs from "node:fs";

const moduleJson = JSON.parse(
  fs.readFileSync("module.json", "utf8")
);

const importer = fs.readFileSync(
  "scripts/importer-app.js",
  "utf8"
);

function ok(name, value) {
  assert.equal(Boolean(value), true, name);
  console.log(`ok - ${name}`);
}

function extractFunction(name) {
  const patterns = [
    `function ${name}(`,
    `async function ${name}(`
  ];

  let start = -1;

  for (const pattern of patterns) {
    start = importer.indexOf(pattern);
    if (start >= 0) break;
  }

  assert.notEqual(start, -1, `função ${name} existe`);

  const open = importer.indexOf("{", start);
  assert.notEqual(open, -1, `função ${name} possui corpo`);

  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let i = open; i < importer.length; i++) {
    const char = importer[i];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") depth++;
    if (char === "}") depth--;

    if (depth === 0) {
      return importer.slice(start, i + 1);
    }
  }

  throw new Error(`não foi possível extrair ${name}`);
}

ok(
  "persistentStorage continua ativo",
  moduleJson.persistentStorage === true
);

ok(
  "flags.canUpload está ativo",
  moduleJson.flags?.canUpload === true
);

ok(
  "schema de assets subiu para 10",
  /schemaVersion:\s*\n\s*10,/.test(importer)
);

ok(
  "upload persistente possui fallback tratado",
  importer.includes('"persistent-upload-fallback"')
  && importer.includes("return null;")
  && importer.includes("warnImporterOnce(")
);

ok(
  "Actor animado não cai automaticamente no spritesheet bruto",
  importer.includes("const safeStatic =")
  && importer.includes("SAFE_STATIC_FALLBACK")
  && !importer.includes("let tokenPath = sheetPath;")
);

ok(
  "Dylan só é habilitado com sheet persistido e utilizável",
  importer.includes("const animationSheetPath =")
  && importer.includes("isUsableDylanSheetPath(")
  && importer.includes("sheetsrc:")
  && importer.includes("animationSheetPath")
);

ok(
  "reparo remove flags Dylan inválidas",
  importer.includes("prototypeToken.flags.-=${DYLAN_ID}")
  && importer.includes("flags.-=${DYLAN_ID}")
);

ok(
  "reparo de tokens colocados existe",
  importer.includes("async function repairPlacedActorTokens(")
  && importer.includes('updateEmbeddedDocuments(\n        "Token"')
);

ok(
  "canvas usa pasta com nome da Scene somente para Actor novo",
  importer.includes("async function getOrCreateSceneActorFolder(")
  && importer.includes("folder.name === sceneName")
  && importer.includes("resolveFolderForNew")
  && /getOrCreateSceneActorFolder\(\s*(?:canvas\.scene|scene)\s*\)/.test(importer)
);

ok(
  "fluxo manual continua usando última pasta quando não há resolver",
  importer.includes(": rememberedActorFolderId();")
);

const helperNames = [
  "normalizedImagePath",
  "isPlaceholderImagePath",
  "isUsableStaticImagePath",
  "isUsableDylanSheetPath",
  "sameImagePath",
  "dylanStateInvalid",
  "actorNeedsAssetRepair"
];

const helperSource = helperNames
  .map(extractFunction)
  .join("\n\n");

const helpers = Function(
  "DYLAN_ID",
  `${helperSource}\nreturn { ${helperNames.join(", ")} };`
)("dylans-animated-tokens");

assert.equal(
  helpers.isPlaceholderImagePath(
    "systems/mist-engine-fvtt/assets/icons/icon-challenge.svg"
  ),
  true,
  "icon-challenge é placeholder"
);

assert.equal(
  helpers.isUsableDylanSheetPath(
    "systems/mist-engine-fvtt/assets/icons/icon-challenge.svg"
  ),
  false,
  "placeholder não pode ser Dylan sheet"
);

assert.equal(
  helpers.isUsableDylanSheetPath(
    "modules/pokemon-litm-tools/storage/person-sheet-jessie.png?v=abc"
  ),
  true,
  "spritesheet real pode ser Dylan sheet"
);

assert.equal(
  helpers.dylanStateInvalid({
    spritesheet: true,
    sheetsrc: null
  }),
  true,
  "spritesheet=true + sheetsrc=null é inválido"
);

assert.equal(
  helpers.actorNeedsAssetRepair(
    {
      img: "portrait.png",
      prototypeToken: {
        texture: { src: "overworld.png" },
        flags: {}
      }
    },
    {
      schemaVersion: 9,
      assets: {
        portrait: "portrait.png",
        overworld: "overworld.png"
      }
    }
  ),
  true,
  "schema 9 exige reparo"
);

assert.equal(
  helpers.actorNeedsAssetRepair(
    {
      img: "portrait.png",
      prototypeToken: {
        texture: { src: "overworld.png" },
        flags: {
          "dylans-animated-tokens": {
            spritesheet: true,
            sheetsrc: null
          }
        }
      }
    },
    {
      schemaVersion: 10,
      assets: {
        portrait: "portrait.png",
        overworld: "overworld.png"
      }
    }
  ),
  true,
  "Dylan inválido exige reparo"
);

assert.equal(
  helpers.actorNeedsAssetRepair(
    {
      img: "portrait.png",
      prototypeToken: {
        texture: { src: "overworld.png" },
        flags: {
          "dylans-animated-tokens": {
            spritesheet: true,
            sheetsrc: "sheet.png"
          }
        }
      }
    },
    {
      schemaVersion: 10,
      assets: {
        portrait: "portrait.png",
        overworld: "overworld.png"
      }
    }
  ),
  false,
  "estado schema 10 válido não exige reparo"
);

ok(
  "Actors novos do Importer abrem em modo de jogo",
  (importer.includes("editMode:") && importer.includes("system: {"))
);

ok(
  "Trainer Class possui nome escolhido no drag e cria instância nova",
  importer.includes("const TRAINER_NAME_POOLS =")
  && importer.includes("nameOverride:")
  && importer.includes("forceNew:")
);

ok(
  "Actor novo confirma a pasta após create",
  importer.includes("bug observado no teste do v0.8.1")
  && importer.includes("actualFolderId")
);

console.log("Pokemon LITM Tools | importer asset tests passed");
