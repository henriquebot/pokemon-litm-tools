const MODULE_ID = "pokemon-litm-tools";
const DYLAN_ID = "dylans-animated-tokens";

const PROVIDER = {
  id: "rhov-pokemon-assets",
  repository: "righthandofvecna/pokemon-assets",
  branch: "main",
  sheets: "img/trainers-overworld",
  portraits: "img/trainers-profile"
};

let catalogCache = null;

function stem(filename) {
  return filename.replace(/\.[^.]+$/, "");
}

function niceName(filename) {
  return stem(filename)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeFilename(prefix, filename) {
  const safe = filename
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");

  return `${prefix}-${safe}`;
}

async function fetchDirectory(path) {
  const url =
    `https://api.github.com/repos/${PROVIDER.repository}/contents/${path}` +
    `?ref=${PROVIDER.branch}`;

  const response = await fetch(url, {
    headers: {
      "Accept": "application/vnd.github+json"
    }
  });

  if (!response.ok) {
    const remaining = response.headers.get("x-ratelimit-remaining");

    throw new Error(
      `GitHub respondeu ${response.status}. ` +
      `Rate limit restante: ${remaining ?? "desconhecido"}`
    );
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Resposta inesperada do catálogo GitHub.");
  }

  return data.filter(
    file =>
      file.type === "file" &&
      /\.(png|webp|jpg|jpeg)$/i.test(file.name) &&
      file.download_url
  );
}

async function getTrainerCatalog() {
  if (catalogCache) return catalogCache;

  ui.notifications.info("Carregando catálogo de Trainers...");

  const [sheets, portraits] = await Promise.all([
    fetchDirectory(PROVIDER.sheets),
    fetchDirectory(PROVIDER.portraits)
  ]);

  const portraitsByStem = new Map(
    portraits.map(file => [
      stem(file.name).toLowerCase(),
      file
    ])
  );

  catalogCache = sheets
    .map(sheet => {
      const id = stem(sheet.name);
      const portrait =
        portraitsByStem.get(id.toLowerCase()) ?? null;

      return {
        id,
        name: niceName(sheet.name),
        sheet,
        portrait
      };
    })
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base"
      })
    );

  return catalogCache;
}

async function persistRemoteAsset(url, filename) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Download retornou ${response.status}`);
    }

    const blob = await response.blob();

    const file = new File(
      [blob],
      filename,
      {
        type: blob.type || "image/png"
      }
    );

    const uploaded =
      await foundry.applications.apps.FilePicker.uploadPersistent(
        MODULE_ID,
        "",
        file,
        {
          overwrite: true
        },
        {
          notify: false
        }
      );

    console.log(
      "Pokémon LITM Tools | Upload persistente:",
      uploaded
    );

    return (
      uploaded?.path ??
      uploaded?.url ??
      uploaded?.file ??
      url
    );

  } catch (error) {
    console.warn(
      `Pokémon LITM Tools | Não foi possível armazenar ${filename}. ` +
      "Usando URL remota.",
      error
    );

    return url;
  }
}

async function createTrainer(entry, customName) {
  const dylanActive =
    game.modules.get(DYLAN_ID)?.active === true;

  ui.notifications.info(
    `Importando ${entry.name}...`
  );

  const sheetFilename =
    safeFilename("sheet", entry.sheet.name);

  const portraitFilename =
    entry.portrait
      ? safeFilename("portrait", entry.portrait.name)
      : null;

  const sheetPromise =
    persistRemoteAsset(
      entry.sheet.download_url,
      sheetFilename
    );

  const portraitPromise =
    entry.portrait
      ? persistRemoteAsset(
          entry.portrait.download_url,
          portraitFilename
        )
      : Promise.resolve("icons/svg/mystery-man.svg");

  const [sheetPath, portraitPath] =
    await Promise.all([
      sheetPromise,
      portraitPromise
    ]);

  const actorName =
    String(customName ?? "").trim() ||
    entry.name;

  const pokemonFlags = {
    schemaVersion: 3,
    kind: "trainer",
    assetId: entry.id,

    source: {
      provider: PROVIDER.id,
      repository: PROVIDER.repository,
      sheet: entry.sheet.download_url,
      portrait: entry.portrait?.download_url ?? null
    },

    assets: {
      spritesheet: sheetPath,
      portrait: portraitPath
    },

    animation: {
      engine: "dylans-animated-tokens",
      preset: "durlReduced",
      frames: 3,
      directions: 4
    }
  };

  const prototypeFlags = {
    [MODULE_ID]: pokemonFlags,

    [DYLAN_ID]: {
      spritesheet: true,
      sheetstyle: "durlReduced",
      animationframes: 3,
      sheetsrc: sheetPath
    }
  };

  const actor =
    await Actor.implementation.create({
      name: actorName,

      type: "litm-npc",

      img: portraitPath,

      prototypeToken: {
        name: actorName,

        /*
         * Sem Dylan: aparece o retrato.
         * Com Dylan: ele usa sheetsrc para renderizar
         * a spritesheet animada.
         */
        texture: {
          src: portraitPath
        },

        lockRotation: true,

        disposition:
          CONST.TOKEN_DISPOSITIONS.NEUTRAL,

        flags: prototypeFlags
      },

      flags: {
        [MODULE_ID]: pokemonFlags
      }
    });

  if (!actor) {
    throw new Error("Actor não foi criado.");
  }

  if (!dylanActive) {
    ui.notifications.warn(
      `${actorName} importado, mas Dylan's Animated Tokens não está ativo.`
    );
  } else {
    ui.notifications.info(
      `${actorName} importado e configurado para animação.`
    );
  }

  console.log(
    "Pokémon LITM Tools | Trainer criado:",
    actor
  );

  return actor;
}

export async function openTrainerCatalog() {
  if (!game.user.isGM) return;

  if (game.system.id !== "mist-engine-fvtt") {
    ui.notifications.error(
      "Pokémon LITM Tools requer Legend in the Mist."
    );

    return;
  }

  let catalog;

  try {
    catalog = await getTrainerCatalog();
  } catch (error) {
    console.error(
      "Pokémon LITM Tools | Falha no catálogo:",
      error
    );

    ui.notifications.error(
      "Não foi possível carregar o catálogo de Trainers. Veja o F12."
    );

    return;
  }

  if (!catalog.length) {
    ui.notifications.warn(
      "Nenhum Trainer encontrado no catálogo."
    );

    return;
  }

  const options = catalog
    .map(
      (entry, index) =>
        `<option value="${index}">${escapeHTML(entry.name)}</option>`
    )
    .join("");

  const result =
    await foundry.applications.api.DialogV2.input({
      window: {
        title: "Pokémon Importer — Trainers"
      },

      content: `
        <div style="
          display:flex;
          flex-direction:column;
          gap:12px;
          padding:8px;
        ">

          <div class="form-group">
            <label>Trainer</label>

            <div class="form-fields">
              <select name="catalogIndex">
                ${options}
              </select>
            </div>

            <p class="hint">
              Catálogo carregado diretamente do repositório de assets.
              ${catalog.length} sprites encontrados.
            </p>
          </div>

          <div class="form-group">
            <label>Nome do Actor</label>

            <div class="form-fields">
              <input
                type="text"
                name="customName"
                placeholder="Deixe vazio para usar o nome do sprite"
              >
            </div>
          </div>

        </div>
      `,

      ok: {
        label: "Importar Trainer",
        icon: "fa-solid fa-download"
      },

      modal: true
    });

  if (!result) return;

  const index =
    Number(result.catalogIndex);

  const entry =
    catalog[index];

  if (!entry) {
    ui.notifications.error(
      "Trainer selecionado não existe."
    );

    return;
  }

  try {
    await createTrainer(
      entry,
      result.customName
    );
  } catch (error) {
    console.error(
      "Pokémon LITM Tools | Erro ao importar Trainer:",
      error
    );

    ui.notifications.error(
      "Erro ao importar Trainer. Veja o console F12."
    );
  }
}
