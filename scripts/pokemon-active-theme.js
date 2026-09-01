const MODULE_ID =
  "pokemon-litm-tools";

const LITM_SYSTEM_ID =
  "mist-engine-fvtt";


function getActorFromApp(app) {
  const candidates = [
    app?.actor,
    app?.document,
    app?.object,
    app?.options?.document
  ];

  return candidates.find(
    actor =>
      actor?.documentName === "Actor"
      &&
      actor?.type === "litm-character"
  ) ?? null;
}


function getRootElement(app, html) {
  const candidates = [
    html,
    html?.[0],
    app?.element,
    app?.element?.[0],
    app?._element,
    app?._element?.[0]
  ];

  return candidates.find(
    candidate =>
      candidate instanceof HTMLElement
  ) ?? null;
}


function getPokemonThemes(actor) {
  return actor.items
    .filter(
      item =>
        item.type === "themebook"
        &&
        item.getFlag(
          MODULE_ID,
          "pokemonTheme"
        ) === true
        &&
        item.getFlag(
          MODULE_ID,
          "themeRole"
        ) === "pokemon"
    )
    .sort(
      (a, b) =>
        Number(
          a.getFlag(
            MODULE_ID,
            "pokemonTeamSlot"
          ) ?? 999
        )
        -
        Number(
          b.getFlag(
            MODULE_ID,
            "pokemonTeamSlot"
          ) ?? 999
        )
    );
}


function getActiveId(
  actor,
  themes
) {
  if (!themes.length) {
    return null;
  }

  const stored =
    actor.getFlag(
      MODULE_ID,
      "activePokemonThemeId"
    );

  if (
    themes.some(
      theme =>
        theme.id === stored
    )
  ) {
    return stored;
  }

  return themes[0].id;
}


function clearSelectedTags(tags) {
  if (!Array.isArray(tags)) {
    return tags;
  }

  return tags.map(
    tag => ({
      ...tag,
      selected: false,
      toBurn: false
    })
  );
}


async function clearThemeSelection(
  theme
) {
  const power =
    theme.system.powertags ?? [];

  const weakness =
    theme.system.weaknesstags ?? [];

  const needsPower =
    power.some(
      tag =>
        tag?.selected
        ||
        tag?.toBurn
    );

  const needsWeakness =
    weakness.some(
      tag =>
        tag?.selected
        ||
        tag?.toBurn
    );

  if (
    !needsPower
    &&
    !needsWeakness
  ) {
    return;
  }

  const update = {};

  if (needsPower) {
    update["system.powertags"] =
      clearSelectedTags(power);
  }

  if (needsWeakness) {
    update["system.weaknesstags"] =
      clearSelectedTags(weakness);
  }

  await theme.update(update);
}


export async function setActivePokemonTheme(
  actor,
  themeId
) {
  const themes =
    getPokemonThemes(actor);

  const selected =
    themes.find(
      theme =>
        theme.id === themeId
    );

  if (!selected) {
    throw new Error(
      "Pokemon da equipe nao encontrado."
    );
  }

  for (const theme of themes) {
    if (
      theme.id !== selected.id
    ) {
      await clearThemeSelection(
        theme
      );
    }
  }

  await actor.setFlag(
    MODULE_ID,
    "activePokemonThemeId",
    selected.id
  );

  return selected;
}


function installInactiveGuard(
  root,
  actor
) {
  if (
    root.dataset
      .pokemonActiveThemeGuard
  ) {
    return;
  }

  root.dataset
    .pokemonActiveThemeGuard =
      "true";

  root.addEventListener(
    "click",
    event => {
      const target =
        event.target.closest(
          [
            ".pt-selectable[data-item-id]",
            ".wt-selectable[data-item-id]",
            "[data-action='toggleToBurn'][data-item-id]"
          ].join(",")
        );

      if (!target) {
        return;
      }

      const item =
        actor.items.get(
          target.dataset.itemId
        );

      if (
        !item
        ||
        item.getFlag(
          MODULE_ID,
          "pokemonTheme"
        ) !== true
      ) {
        return;
      }

      const themes =
        getPokemonThemes(actor);

      const activeId =
        getActiveId(
          actor,
          themes
        );

      if (
        item.id === activeId
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    },
    true
  );
}


function createSelector(
  actor,
  themes,
  activeId
) {
  const bar =
    document.createElement("div");

  bar.className =
    "pokemon-active-theme-bar";

  bar.dataset
    .pokemonActiveThemeBar =
      "true";

  const icon =
    document.createElement("i");

  icon.className =
    "fa-solid fa-bolt";

  const label =
    document.createElement("label");

  label.textContent =
    "Pokémon ativo";

  const select =
    document.createElement("select");

  select.dataset
    .pokemonActiveThemeSelect =
      "true";

  for (const theme of themes) {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      theme.id;

    option.textContent =
      theme.name;

    option.selected =
      theme.id === activeId;

    select.append(option);
  }

  select.disabled =
    !actor.isOwner
    ||
    themes.length <= 1;

  select.addEventListener(
    "change",
    async () => {
      const previous =
        activeId;

      select.disabled =
        true;

      try {
        await setActivePokemonTheme(
          actor,
          select.value
        );
      } catch (error) {
        console.error(
          "Pokemon LITM Tools | Pokemon ativo:",
          error
        );

        select.value =
          previous;

        ui.notifications.error(
          "Nao foi possivel trocar o Pokemon ativo."
        );
      } finally {
        if (
          actor.isOwner
          &&
          themes.length > 1
        ) {
          select.disabled =
            false;
        }
      }
    }
  );

  bar.append(
    icon,
    label,
    select
  );

  return bar;
}


async function renderActivePokemonUI(
  app,
  html
) {
  if (
    game.system.id
    !==
    LITM_SYSTEM_ID
  ) {
    return;
  }

  const actor =
    getActorFromApp(app);

  if (!actor) {
    return;
  }

  const themes =
    getPokemonThemes(actor);

  if (!themes.length) {
    return;
  }

  const root =
    getRootElement(
      app,
      html
    );

  if (!root) {
    return;
  }

  const activeId =
    getActiveId(
      actor,
      themes
    );

  const stored =
    actor.getFlag(
      MODULE_ID,
      "activePokemonThemeId"
    );

  if (
    stored !== activeId
    &&
    actor.isOwner
  ) {
    await actor.setFlag(
      MODULE_ID,
      "activePokemonThemeId",
      activeId
    );

    return;
  }

  root
    .querySelector(
      "[data-pokemon-active-theme-bar]"
    )
    ?.remove();

  const container =
    root.querySelector(
      ".litm-character-themebooks-container"
    );

  if (!container) {
    return;
  }

  container.prepend(
    createSelector(
      actor,
      themes,
      activeId
    )
  );

  /*
   * Nao alteramos classes, estilos,
   * opacity ou filtros dos cards LitM.
   */
  installInactiveGuard(
    root,
    actor
  );
}


function protectInactivePokemonUpdate(
  item,
  changes
) {
  if (
    item?.documentName !== "Item"
    ||
    item.type !== "themebook"
    ||
    item.getFlag(
      MODULE_ID,
      "pokemonTheme"
    ) !== true
  ) {
    return;
  }

  const actor =
    item.parent;

  if (
    actor?.documentName !== "Actor"
  ) {
    return;
  }

  const themes =
    getPokemonThemes(actor);

  const activeId =
    getActiveId(
      actor,
      themes
    );

  if (
    item.id === activeId
  ) {
    return;
  }

  if (
    Array.isArray(
      changes["system.powertags"]
    )
  ) {
    changes["system.powertags"] =
      clearSelectedTags(
        changes["system.powertags"]
      );
  }

  if (
    Array.isArray(
      changes["system.weaknesstags"]
    )
  ) {
    changes["system.weaknesstags"] =
      clearSelectedTags(
        changes["system.weaknesstags"]
      );
  }
}


function queueUI(
  app,
  html
) {
  requestAnimationFrame(
    () => {
      void renderActivePokemonUI(
        app,
        html
      ).catch(
        error =>
          console.error(
            "Pokemon LITM Tools | Seletor:",
            error
          )
      );
    }
  );
}


export function activatePokemonActiveThemeUI() {
  Hooks.on(
    "renderMistEngineLegendInTheMistCharacterSheet",
    queueUI
  );

  Hooks.on(
    "renderApplicationV2",
    queueUI
  );

  Hooks.on(
    "renderActorSheet",
    queueUI
  );

  Hooks.on(
    "preUpdateItem",
    protectInactivePokemonUpdate
  );
}
