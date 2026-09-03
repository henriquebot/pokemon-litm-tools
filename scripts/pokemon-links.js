const MODULE_ID = "pokemon-litm-tools";

const TYPE_EFFECT_COLORS = {
  normal: 0xd8d8d0,
  fire: 0xff7043,
  water: 0x42a5f5,
  electric: 0xffd54f,
  grass: 0x66bb6a,
  ice: 0x80deea,
  fighting: 0xef5350,
  poison: 0xab47bc,
  ground: 0xbcaaa4,
  flying: 0x90caf9,
  psychic: 0xec407a,
  bug: 0x9ccc65,
  rock: 0xb0a06f,
  ghost: 0x7e57c2,
  dragon: 0x5c6bc0,
  dark: 0x616161,
  steel: 0xb0bec5,
  fairy: 0xf48fb1
};

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

function appDocument(app) {
  return (
    app?.document ??
    app?.item ??
    app?.actor ??
    app?.object ??
    null
  );
}

function appRoot(app, html) {
  return (
    app?.element ??
    (
      html instanceof HTMLElement
        ? html
        : html?.[0]
    ) ??
    null
  );
}

function isPokemonChallenge(doc) {
  return (
    doc?.documentName === "Actor"
    &&
    doc?.getFlag?.(
      MODULE_ID,
      "pokemonBuilder"
    ) === true
  );
}

function addPokemonDbButton(app, html) {
  const doc = appDocument(app);

  if (!isPokemonChallenge(doc)) return;

  const url =
    doc.getFlag?.(
      MODULE_ID,
      "pokedexUrl"
    );

  if (!url) return;

  const root = appRoot(app, html);
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
    globalThis.document.createElement(
      "button"
    );

  button.type = "button";
  button.dataset.pokemonPokedex = "true";
  button.className =
    "header-control pokemon-theme-pokedex-button";
  button.title = "Abrir no PokémonDB";
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

function sourceTokenForActor(actor) {
  const controlled =
    globalThis.canvas?.tokens?.controlled
      ?.find(token =>
        token.actor?.id === actor?.id
      );

  if (controlled) return controlled;

  const active =
    actor?.getActiveTokens?.(
      true,
      true
    ) ?? [];

  return active[0] ?? null;
}

function currentTargetToken() {
  return Array.from(
    game.user?.targets ?? []
  )[0] ?? null;
}

function isSelfTarget(target) {
  const value =
    String(target ?? "")
      .toLowerCase();

  return (
    value === "self"
    ||
    value === "user"
    ||
    value === "users-field"
    ||
    value === "user-or-ally"
  );
}

function pulseToken(token, type = "normal") {
  const mesh =
    token?.mesh ??
    token?.icon ??
    null;

  if (!mesh) return;

  const oldTint = mesh.tint;
  const oldAlpha = mesh.alpha;
  const tint =
    TYPE_EFFECT_COLORS[type]
    ??
    0xf5d76e;

  try {
    mesh.tint = tint;
    mesh.alpha = 0.62;

    setTimeout(() => {
      try {
        if (!mesh.destroyed) {
          mesh.tint = oldTint;
          mesh.alpha = oldAlpha;
        }
      } catch {}
    }, 380);
  } catch {}
}

function triggerPokemonEffect({ actor, article, button }) {
  const kind =
    article.dataset.pokemonEffectKind
    ??
    "move";

  const id =
    article.dataset.pokemonEffectId
    ??
    "";

  const type =
    article.dataset.pokemonEffectType
    ??
    "normal";

  const targetMode =
    article.dataset.pokemonEffectTarget
    ??
    "selected-pokemon";

  const sourceToken =
    sourceTokenForActor(actor);

  if (!sourceToken) {
    ui.notifications.warn(
      "Coloque ou selecione o token deste Pokémon na cena para disparar o efeito."
    );
    return;
  }

  const self =
    kind === "ability"
    ||
    isSelfTarget(targetMode);

  const targetToken =
    self
      ? sourceToken
      : currentTargetToken();

  if (!targetToken) {
    ui.notifications.warn(
      "Marque o alvo com T antes de disparar este efeito."
    );
    return;
  }

  button.disabled = true;

  pulseToken(sourceToken, type);

  if (targetToken !== sourceToken) {
    setTimeout(
      () => pulseToken(targetToken, type),
      120
    );
  }

  Hooks.callAll(
    "pokemonLitmEffect",
    {
      actor,
      sourceToken,
      targetToken,
      kind,
      id,
      type,
      targetMode
    }
  );

  setTimeout(() => {
    button.disabled = false;
  }, 450);
}

function wirePokemonEffectButtons(app, html) {
  const actor = appDocument(app);

  if (
    !isPokemonChallenge(actor)
    ||
    (!game.user.isGM && !actor.isOwner)
  ) return;

  const root = appRoot(app, html);
  if (!root) return;

  for (
    const article
    of root.querySelectorAll(
      ".pokemon-biography-effect[data-pokemon-effect-kind]"
    )
  ) {
    if (
      article.querySelector(
        "[data-pokemon-effect-trigger]"
      )
    ) continue;

    const button =
      globalThis.document.createElement(
        "button"
      );

    const self =
      article.dataset.pokemonEffectKind === "ability"
      ||
      isSelfTarget(
        article.dataset.pokemonEffectTarget
      );

    button.type = "button";
    button.dataset.pokemonEffectTrigger = "true";
    button.className =
      "pokemon-biography-effect-trigger";
    button.title =
      self
        ? "Disparar efeito no próprio Pokémon"
        : "Disparar efeito no alvo marcado";
    button.innerHTML =
      self
        ? '<i class="fa-solid fa-wand-magic-sparkles"></i> Efeito em si'
        : '<i class="fa-solid fa-bullseye"></i> Efeito no alvo';

    button.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopPropagation();
        triggerPokemonEffect({
          actor,
          article,
          button
        });
      }
    );

    article.append(button);
  }
}

function addChallengeActionButton(header, marker, title, icon, handler) {
  if (header.querySelector(`[data-${marker}]`)) return;
  const button = globalThis.document.createElement("button");
  button.type = "button";
  button.setAttribute(`data-${marker}`, "true");
  button.className = "header-control pokemon-theme-pokedex-button";
  button.title = title;
  button.innerHTML = `<i class="fa-solid ${icon}"></i>`;
  button.addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await handler();
    } catch (error) {
      console.error("Pokemon LITM Tools | Header action:", error);
      ui.notifications.error(error?.message ?? "Não foi possível executar a ação.");
    }
  });
  const close = header.querySelector('[data-action="close"]');
  close ? close.before(button) : header.append(button);
}

function addPokemonChallengeActions(app, html) {
  const actor = appDocument(app);
  if (!isPokemonChallenge(actor) || !game.user.isGM) return;
  const root = appRoot(app, html);
  const header = root?.querySelector(".window-header");
  if (!header) return;

  addChallengeActionButton(
    header,
    "pokemon-edit-challenge",
    "Editar no Criador de Challenge",
    "fa-wand-magic-sparkles",
    async () => {
      const api = game.modules.get(MODULE_ID)?.api;
      if (!api?.openPokemonChallengeEditor) throw new Error("Editor de Challenge indisponível.");
      await api.openPokemonChallengeEditor(actor);
    }
  );

  const trainerNpcId = actor.getFlag(MODULE_ID, "trainerNpcId");
  const trainerNpc = trainerNpcId ? game.actors.get(trainerNpcId) : null;
  if (trainerNpc?.type === "litm-npc") {
    addChallengeActionButton(
      header,
      "pokemon-open-trainer",
      `Abrir treinador: ${trainerNpc.name}`,
      "fa-user",
      async () => {
        void trainerNpc.sheet?.render?.({ force: true });
      }
    );
  }

  const encounter = actor.getFlag(MODULE_ID, "encounter") ?? {};
  const captured = actor.getFlag(MODULE_ID, "captured") === true;
  if (encounter.wild === true && !captured) {
    addChallengeActionButton(
      header,
      "pokemon-capture-challenge",
      "Converter Pokémon capturado em Tema",
      "fa-right-left",
      async () => {
        const api = game.modules.get(MODULE_ID)?.api;
        if (!api?.capturePokemonChallenge) throw new Error("Conversão de captura indisponível.");
        await api.capturePokemonChallenge(actor);
      }
    );
  }
}

function enhancePokemonSheet(app, html) {
  addPokemonDbButton(app, html);
  addPokemonChallengeActions(app, html);
  wirePokemonEffectButtons(app, html);
}

export function activatePokemonThemePokedexButtons() {
  Hooks.on(
    "renderItemSheet",
    enhancePokemonSheet
  );

  Hooks.on(
    "renderActorSheet",
    enhancePokemonSheet
  );

  Hooks.on(
    "renderApplicationV2",
    enhancePokemonSheet
  );
}
