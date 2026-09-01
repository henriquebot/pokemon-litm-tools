const MODULE_ID =
  "pokemon-litm-tools";

const LITM_SYSTEM_ID =
  "mist-engine-fvtt";


function getActorFromApp(app) {
  const actor =
    app?.actor
    ?? app?.document
    ?? app?.object
    ?? null;

  if (
    actor?.documentName !== "Actor"
    ||
    actor?.type !== "litm-character"
  ) {
    return null;
  }

  return actor;
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
          )
          ?? 999
        )
        -
        Number(
          b.getFlag(
            MODULE_ID,
            "pokemonTeamSlot"
          )
          ?? 999
        )
    );
}


function resolveActiveThemeId(
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
    stored
    &&
    themes.some(
      theme =>
        theme.id === stored
    )
  ) {
    return stored;
  }

  return themes[0].id;
}


function sanitizeTags(tags) {
  if (!Array.isArray(tags)) {
    return tags;
  }

  return tags.map(
    tag => ({
      ...tag,
      selected:
        false,
      toBurn:
        false
    })
  );
}


function tagsNeedClear(tags) {
  return (
    Array.isArray(tags)
    &&
    tags.some(
      tag =>
        tag?.selected
        ||
        tag?.toBurn
    )
  );
}


async function clearThemeSelection(
  theme
) {
  const update = {};

  if (
    tagsNeedClear(
      theme.system.powertags
    )
  ) {
    update["system.powertags"] =
      sanitizeTags(
        theme.system.powertags
      );
  }

  if (
    tagsNeedClear(
      theme.system.weaknesstags
    )
  ) {
    update["system.weaknesstags"] =
      sanitizeTags(
        theme.system.weaknesstags
      );
  }

  if (
    Object.keys(update).length
  ) {
    await theme.update(update);
  }
}


async function clearInactiveSelections(
  actor,
  activeId
) {
  const themes =
    getPokemonThemes(actor);

  for (const theme of themes) {
    if (theme.id === activeId) {
      continue;
    }

    await clearThemeSelection(
      theme
    );
  }
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

  /*
   * Remove qualquer Tag que estivesse
   * selecionada no Pokemon anterior.
   */
  for (const theme of themes) {
    if (theme.id !== selected.id) {
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

  actor.sheet?.render?.(
    false
  );

  return selected;
}


function blockInactivePokemonActions(
  root
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
            ".pokemon-theme-inactive .pt-selectable",
            ".pokemon-theme-inactive .wt-selectable",
            ".pokemon-theme-inactive [data-action='toggleToBurn']"
          ].join(",")
        );

      if (!target) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    },
    true
  );
}


function decoratePokemonThemes(
  root,
  actor,
  themes,
  activeId
) {
  const editMode =
    actor.system.editMode === true;

  for (const theme of themes) {
    const card =
      root.querySelector(
        ".themebook-container[data-id='"
        + CSS.escape(theme.id)
        + "']"
      );

    if (!card) {
      continue;
    }

    const active =
      theme.id === activeId;

    card.classList.toggle(
      "pokemon-theme-active",
      active
    );

    card.classList.toggle(
      "pokemon-theme-inactive",
      !active && !editMode
    );

    card.classList.toggle(
      "pokemon-theme-inactive-edit",
      !active && editMode
    );

    const oldBadge =
      card.querySelector(
        "[data-pokemon-active-badge]"
      );

    oldBadge?.remove();

    if (active) {
      const heading =
        card.querySelector(
          ".theme-name"
        );

      if (heading) {
        const badge =
          document.createElement(
            "span"
          );

        badge.dataset
          .pokemonActiveBadge =
            "true";

        badge.className =
          "pokemon-active-theme-badge";

        badge.textContent =
          "Ativo";

        heading.append(badge);
      }
    }
  }
}


function createActivePokemonBar(
  actor,
  themes,
  activeId
) {
  const bar =
    document.createElement(
      "div"
    );

  bar.className =
    "pokemon-active-theme-bar";

  bar.dataset
    .pokemonActiveThemeBar =
      "true";

  const icon =
    document.createElement(
      "i"
    );

  icon.className =
    "fa-solid fa-bolt";

  const label =
    document.createElement(
      "label"
    );

  label.textContent =
    "Pokémon ativo";

  const select =
    document.createElement(
      "select"
    );

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
    themes.length <= 1
    ||
    !actor.isOwner;

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
          themes.length > 1
          &&
          actor.isOwner
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
    app?.element
    ??
    (
      html instanceof HTMLElement
        ? html
        : html?.[0]
    );

  if (!root) {
    return;
  }

  const activeId =
    resolveActiveThemeId(
      actor,
      themes
    );

  /*
   * Corrige automaticamente Actors
   * antigos que ainda nao tenham flag.
   */
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
    void actor.setFlag(
      MODULE_ID,
      "activePokemonThemeId",
      activeId
    );
  }

  const previousBar =
    root.querySelector(
      "[data-pokemon-active-theme-bar]"
    );

  previousBar?.remove();

  const container =
    root.querySelector(
      "#character .litm-character-themebooks-container"
    );

  if (!container) {
    return;
  }

  container.prepend(
    createActivePokemonBar(
      actor,
      themes,
      activeId
    )
  );

  decoratePokemonThemes(
    root,
    actor,
    themes,
    activeId
  );

  blockInactivePokemonActions(
    root
  );

  /*
   * Remove selecoes antigas de Pokemon
   * que nao seja mais o ativo.
   */
  void clearInactiveSelections(
    actor,
    activeId
  ).catch(
    error => {
      console.error(
        "Pokemon LITM Tools | Limpando Pokemon inativo:",
        error
      );
    }
  );
}


/*
 * Protecao mecanica:
 * mesmo que outra interface tente marcar
 * uma Tag de Pokemon inativo, ela fica
 * desmarcada antes da atualizacao.
 */
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
    ||
    item.getFlag(
      MODULE_ID,
      "themeRole"
    ) !== "pokemon"
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
    resolveActiveThemeId(
      actor,
      themes
    );

  if (
    item.id === activeId
  ) {
    return;
  }

  const directPower =
    changes["system.powertags"];

  if (
    Array.isArray(
      directPower
    )
  ) {
    changes["system.powertags"] =
      sanitizeTags(
        directPower
      );
  }

  const directWeakness =
    changes["system.weaknesstags"];

  if (
    Array.isArray(
      directWeakness
    )
  ) {
    changes["system.weaknesstags"] =
      sanitizeTags(
        directWeakness
      );
  }

  if (
    Array.isArray(
      changes.system?.powertags
    )
  ) {
    changes.system.powertags =
      sanitizeTags(
        changes.system.powertags
      );
  }

  if (
    Array.isArray(
      changes.system?.weaknesstags
    )
  ) {
    changes.system.weaknesstags =
      sanitizeTags(
        changes.system.weaknesstags
      );
  }
}


export function activatePokemonActiveThemeUI() {
  Hooks.on(
    "renderApplicationV2",
    renderActivePokemonUI
  );

  Hooks.on(
    "renderActorSheet",
    renderActivePokemonUI
  );

  Hooks.on(
    "preUpdateItem",
    protectInactivePokemonUpdate
  );
}
