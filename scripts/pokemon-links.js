const MODULE_ID = "pokemon-litm-tools";

export function getPokemonDbSlug(entryOrName) {
  const raw =
    typeof entryOrName === "string"
      ? entryOrName
      : (
          entryOrName?.pokemonDbSlug ??
          entryOrName?.species ??
          entryOrName?.name ??
          ""
        );

  return String(raw)
    .trim()
    .replace(/♀/g, "-f")
    .replace(/♂/g, "-m")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getPokemonDbUrl(entryOrName) {
  const slug = getPokemonDbSlug(entryOrName);
  return slug
    ? `https://pokemondb.net/pokedex/${slug}`
    : null;
}

export function openPokemonDb(url) {
  if (!url) return;

  const opened = window.open(
    url,
    "_blank",
    "noopener,noreferrer"
  );

  if (opened) opened.opener = null;
}

function addPokemonDbButton(app, html) {
  const document =
    app?.document ??
    app?.item ??
    app?.actor ??
    app?.object;

  const isTheme =
    document?.documentName === "Item"
    &&
    document?.type === "themebook";

  const isPokemonChallenge =
    document?.documentName === "Actor"
    &&
    document?.getFlag?.(
      MODULE_ID,
      "pokemonBuilder"
    ) === true;

  if (
    !isTheme
    &&
    !isPokemonChallenge
  ) return;

  const url =
    document.getFlag?.(
      MODULE_ID,
      "pokedexUrl"
    );

  if (!url) return;

  const root =
    app?.element ??
    (
      html instanceof HTMLElement
        ? html
        : html?.[0]
    );

  if (!root) return;

  const header =
    root.querySelector(
      ".window-header"
    );

  if (
    !header
    ||
    header.querySelector(
      "[data-pokemon-pokedex]"
    )
  ) return;

  const button =
    document.createElement(
      "button"
    );

  button.type = "button";
  button.dataset.pokemonPokedex =
    "true";
  button.className =
    "header-control pokemon-theme-pokedex-button";
  button.title =
    "Abrir no PokémonDB";
  button.innerHTML =
    '<i class="fa-solid fa-mobile-screen-button"></i>';

  button.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopPropagation();
      openPokemonDb(url);
    }
  );

  const close =
    header.querySelector(
      '[data-action="close"]'
    );

  close
    ? close.before(button)
    : header.append(button);
}

export function activatePokemonThemePokedexButtons() {
  Hooks.on(
    "renderItemSheet",
    addPokemonDbButton
  );

  Hooks.on(
    "renderActorSheet",
    addPokemonDbButton
  );

  Hooks.on(
    "renderApplicationV2",
    addPokemonDbButton
  );
}
