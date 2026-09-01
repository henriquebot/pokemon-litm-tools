const MODULE_ID = "pokemon-litm-tools";
const DYLAN_ID = "dylans-animated-tokens";
const LITM_SYSTEM_ID = "mist-engine-fvtt";

const {
  ApplicationV2,
  HandlebarsApplicationMixin
} = foundry.applications.api;

let importerApp = null;
let catalogCache = null;

async function loadCatalog() {
  if (catalogCache) return catalogCache;

  const response = await fetch(
    `modules/${MODULE_ID}/data/catalog.json`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error(`Catálogo HTTP ${response.status}`);
  }

  catalogCache = await response.json();
  return catalogCache;
}

function safeFilename(prefix, entry, url) {
  let ext = ".png";

  try {
    ext =
      new URL(url).pathname.match(/\.[a-zA-Z0-9]+$/)?.[0]
      ?? ".png";
  } catch {}

  const clean = String(entry.id)
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");

  return `${prefix}-${clean}${ext}`;
}

async function persistRemoteAsset(url, filename) {
  if (!url) return null;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Falha baixando ${filename}: HTTP ${response.status}`
    );
  }

  const blob = await response.blob();
  const file = new File(
    [blob],
    filename,
    { type: blob.type || "image/png" }
  );

  const uploaded =
    await foundry.applications.apps.FilePicker.uploadPersistent(
      MODULE_ID,
      "",
      file,
      { overwrite: true },
      { notify: false }
    );

  return (
    uploaded?.path ??
    uploaded?.url ??
    uploaded?.file ??
    url
  );
}

function cleanAnimation(animation) {
  if (!animation || typeof animation !== "object") return null;

  const copy = foundry.utils.deepClone(animation);
  delete copy.images;

  return copy;
}

async function createActorFromEntry(entry, folderId = null) {
  const isPokemon = entry.category === "pokemon";

  const portraitUrl =
    entry.portrait ||
    entry.preview ||
    "icons/svg/mystery-man.svg";

  const [sheetPath, portraitPath] = await Promise.all([
    persistRemoteAsset(
      entry.sheet,
      safeFilename(
        isPokemon ? "pokemon-sheet" : "person-sheet",
        entry,
        entry.sheet
      )
    ),

    portraitUrl.startsWith("icons/")
      ? Promise.resolve(portraitUrl)
      : persistRemoteAsset(
          portraitUrl,
          safeFilename(
            isPokemon ? "pokemon-portrait" : "person-portrait",
            entry,
            portraitUrl
          )
        )
  ]);

  const animation = cleanAnimation(entry.animation);

  const visualScale =
    isPokemon
      ? Number(entry.tokenScale ?? 1)
      : 1;

  const moduleFlags = {
    schemaVersion: 6,
    kind: isPokemon ? "pokemon" : "person",
    assetId: entry.id,
    pokemonId: entry.pokemonId ?? null,
    species: entry.species ?? null,
    heightMeters: entry.heightMeters ?? null,
    tokenScale: visualScale,

    source: {
      provider: "righthandofvecna/pokemon-assets",
      sheet: entry.sheet,
      portrait: entry.portrait ?? null
    },

    assets: {
      spritesheet: sheetPath,
      portrait: portraitPath
    },

    animation
  };

  const prototypeFlags = {
    [MODULE_ID]: moduleFlags
  };

  if (animation) {
    prototypeFlags[DYLAN_ID] = {
      ...animation,
      spritesheet: true,
      sheetsrc: sheetPath
    };
  }

  const actor = await Actor.implementation.create({
    name: entry.name,
    type: "litm-npc",

    ...(folderId ? { folder: folderId } : {}),

    img: portraitPath,

    prototypeToken: {
      name: entry.name,

      width: 1,
      height: 1,

      texture: {
        src: portraitPath,
        scaleX: visualScale,
        scaleY: visualScale
      },

      lockRotation: true,
      disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL,

      flags: prototypeFlags
    },

    flags: {
      [MODULE_ID]: moduleFlags
    }
  });

  if (!actor) {
    throw new Error(`Não foi possível criar ${entry.name}`);
  }

  return actor;
}

async function placeProp(entry) {
  if (!canvas?.ready || !canvas.scene) {
    throw new Error("Abra uma Scene antes de colocar Props.");
  }

  const imagePath = await persistRemoteAsset(
    entry.image,
    safeFilename("prop", entry, entry.image)
  );

  const size =
    Number(canvas.grid?.size ?? canvas.scene.grid?.size ?? 100);

  const pivot = canvas.stage?.pivot;

  const centerX =
    Number(pivot?.x ?? canvas.scene.width / 2);

  const centerY =
    Number(pivot?.y ?? canvas.scene.height / 2);

  await canvas.scene.createEmbeddedDocuments(
    "Tile",
    [{
      x: centerX - size / 2,
      y: centerY - size / 2,
      width: size,
      height: size,
      texture: { src: imagePath }
    }]
  );
}

async function chooseActorFolder() {
  const folders = game.folders
    .filter(folder => folder.type === "Actor")
    .sort((a, b) => a.name.localeCompare(b.name));

  const options = folders
    .map(folder =>
      `<option value="${folder.id}">${folder.name}</option>`
    )
    .join("");

  const remembered =
    game.settings.get(MODULE_ID, "lastActorFolder") ?? "";

  const result = await foundry.applications.api.DialogV2.input({
    window: {
      title: "Destino da importação"
    },

    content: `
      <div style="display:flex;flex-direction:column;gap:12px;padding:8px">

        <div class="form-group">
          <label>Pasta existente</label>
          <div class="form-fields">
            <select name="folder">
              <option value="">Raiz de Actors</option>
              ${options}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>Ou criar nova pasta</label>
          <div class="form-fields">
            <input
              type="text"
              name="newFolder"
              placeholder="Ex.: Route 32 - Selvagens"
            >
          </div>
        </div>

      </div>
    `,

    ok: {
      label: "Continuar",
      icon: "fa-solid fa-folder"
    },

    modal: true
  });

  if (!result) return undefined;

  let folderId =
    String(result.folder ?? remembered ?? "").trim();

  const newFolder =
    String(result.newFolder ?? "").trim();

  if (newFolder) {
    const folder = await Folder.create({
      name: newFolder,
      type: "Actor"
    });

    folderId = folder?.id ?? "";
  }

  await game.settings.set(
    MODULE_ID,
    "lastActorFolder",
    folderId
  );

  return folderId || null;
}

class PokemonImporterApp
  extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "pokemon-litm-importer",

    classes: [
      "pokemon-litm-tools",
      "pokemon-importer"
    ],

    position: {
      width: 780,
      height: 760
    },

    window: {
      title: "Pokémon Importer",
      icon: "fa-solid fa-dragon",
      resizable: true
    }
  };

  static PARTS = {
    main: {
      template:
        `modules/${MODULE_ID}/templates/importer.hbs`,

      scrollable: [
        ".pokemon-importer-list"
      ]
    }
  };

  activeTab = "people";

  /*
   * A seleção mora na Application, não no DOM.
   * Portanto busca, rerender e troca de aba não apagam seleção.
   */
  selected = new Map();

  async _prepareContext(options) {
    const context =
      await super._prepareContext(options);

    try {
      const catalog = await loadCatalog();

      const items =
        (catalog[this.activeTab] ?? []).map(entry => ({
          ...entry,

          checked:
            this.selected.has(
              `${entry.category}:${entry.id}`
            ),

          meta:
            this.activeTab === "pokemon"
              ? (
                  `#${String(entry.dex).padStart(3, "0")}` +
                  (
                    entry.heightMeters
                      ? ` · ${entry.heightMeters} m`
                      : ""
                  )
                )
              : (entry.group || ""),

          isAnimated:
            !!entry.animation
        }));

      return {
        ...context,

        items,
        itemCount: items.length,

        selectedCount:
          this.selected.size,

        peopleCount:
          catalog.people.length,

        pokemonCount:
          catalog.pokemon.length,

        propsCount:
          catalog.props.length,

        isPeople:
          this.activeTab === "people",

        isPokemon:
          this.activeTab === "pokemon",

        isProps:
          this.activeTab === "props",

        dylanActive:
          game.modules.get(DYLAN_ID)?.active === true,

        catalogError: null
      };

    } catch (error) {
      console.error(error);

      return {
        ...context,
        items: [],
        itemCount: 0,
        selectedCount: this.selected.size,
        peopleCount: 0,
        pokemonCount: 0,
        propsCount: 0,
        catalogError: error.message
      };
    }
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    for (
      const button
      of this.element.querySelectorAll("[data-tab]")
    ) {
      button.addEventListener("click", async () => {
        const tab = button.dataset.tab;

        if (!tab || tab === this.activeTab) return;

        this.activeTab = tab;

        await this.render({
          force: true
        });
      });
    }

    const search =
      this.element.querySelector("[data-role='asset-search']");

    if (search) {
      search.addEventListener("input", () => {
        const query =
          search.value.trim().toLocaleLowerCase();

        let visible = 0;

        for (
          const card
          of this.element.querySelectorAll("[data-asset-card]")
        ) {
          const haystack =
            String(card.dataset.search ?? "")
              .toLocaleLowerCase();

          const show =
            !query || haystack.includes(query);

          card.hidden = !show;

          if (show) visible++;
        }

        const counter =
          this.element.querySelector(
            "[data-role='visible-count']"
          );

        if (counter) {
          counter.textContent = String(visible);
        }
      });
    }

    for (
      const checkbox
      of this.element.querySelectorAll("[data-select-entry]")
    ) {
      checkbox.addEventListener("change", () => {
        const key = checkbox.dataset.selectEntry;
        const category = checkbox.dataset.category;
        const id = checkbox.dataset.id;

        if (checkbox.checked) {
          this.selected.set(
            key,
            { category, id }
          );
        } else {
          this.selected.delete(key);
        }

        this.#updateSelectedCounter();
      });
    }

    this.element
      .querySelector("[data-action='selectVisible']")
      ?.addEventListener("click", () => {

        for (
          const checkbox
          of this.element.querySelectorAll("[data-select-entry]")
        ) {
          const card =
            checkbox.closest("[data-asset-card]");

          if (card?.hidden) continue;

          checkbox.checked = true;

          this.selected.set(
            checkbox.dataset.selectEntry,
            {
              category: checkbox.dataset.category,
              id: checkbox.dataset.id
            }
          );
        }

        this.#updateSelectedCounter();
      });

    this.element
      .querySelector("[data-action='clearSelection']")
      ?.addEventListener("click", () => {

        this.selected.clear();

        for (
          const checkbox
          of this.element.querySelectorAll("[data-select-entry]")
        ) {
          checkbox.checked = false;
        }

        this.#updateSelectedCounter();
      });

    this.element
      .querySelector("[data-action='importSelected']")
      ?.addEventListener("click", async event => {

        if (!this.selected.size) {
          ui.notifications.warn(
            "Selecione pelo menos um item."
          );
          return;
        }

        const button = event.currentTarget;
        const oldHTML = button.innerHTML;

        button.disabled = true;

        try {
          const catalog = await loadCatalog();

          const actorItems = [];
          const propItems = [];

          for (
            const { category, id }
            of this.selected.values()
          ) {
            const entry =
              (catalog[category] ?? [])
                .find(item => item.id === id);

            if (!entry) continue;

            if (category === "props") {
              propItems.push(entry);
            } else {
              actorItems.push(entry);
            }
          }

          let folderId = null;

          if (actorItems.length) {
            folderId =
              await chooseActorFolder();

            if (folderId === undefined) {
              return;
            }
          }

          let done = 0;
          const total =
            actorItems.length + propItems.length;

          for (const entry of actorItems) {
            button.innerHTML =
              `<i class="fa-solid fa-spinner fa-spin"></i> ${++done}/${total}`;

            await createActorFromEntry(
              entry,
              folderId
            );
          }

          for (const entry of propItems) {
            button.innerHTML =
              `<i class="fa-solid fa-spinner fa-spin"></i> ${++done}/${total}`;

            await placeProp(entry);
          }

          ui.notifications.info(
            `${total} item(ns) importado(s).`
          );

          this.selected.clear();

          await this.render({
            force: true
          });

        } catch (error) {
          console.error(
            "Pokémon LITM Tools | Batch import:",
            error
          );

          ui.notifications.error(
            "Erro durante importação em lote. Veja F12."
          );

        } finally {
          if (button?.isConnected) {
            button.disabled = false;
            button.innerHTML = oldHTML;
          }
        }
      });
  }

  #updateSelectedCounter() {
    const element =
      this.element.querySelector(
        "[data-role='selected-count']"
      );

    if (element) {
      element.textContent =
        String(this.selected.size);
    }
  }
}

export async function openPokemonImporter() {
  if (!game.user.isGM) return;

  if (game.system.id !== LITM_SYSTEM_ID) {
    ui.notifications.error(
      "Pokémon LITM Tools requer Legend in the Mist."
    );

    return;
  }

  if (importerApp?.rendered) {
    importerApp.bringToFront();
    return importerApp;
  }

  importerApp =
    new PokemonImporterApp();

  importerApp.addEventListener(
    "close",
    () => {
      importerApp = null;
    },
    { once: true }
  );

  await importerApp.render({
    force: true
  });

  return importerApp;
}
