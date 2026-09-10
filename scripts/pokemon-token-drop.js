const MODULE_ID = "pokemon-litm-tools";
const LITM_SYSTEM_ID = "mist-engine-fvtt";

let activated = false;
let adapterPromise = null;

/*
 * Serializa drops por Actor/Synthetic Actor.
 * Assim dois drops quase simultâneos sempre leem o
 * estado produzido pelo drop anterior.
 */
const dropQueues =
  new Map();

function dropToken(data) {
  const x =
    Number(data?.x);

  const y =
    Number(data?.y);

  if (
    !Number.isFinite(x)
    ||
    !Number.isFinite(y)
  ) {
    return null;
  }

  const placeables =
    Array.from(
      canvas?.tokens?.placeables
      ?? []
    )
      .slice()
      .reverse();

  const object =
    placeables.find(
      token =>
        token?.bounds?.contains?.(
          x,
          y
        )
    )
    ?? null;

  return (
    object?.document
    ?? object
    ?? null
  );
}

async function floatingAdapter() {
  if (!adapterPromise) {
    const relative =
      "systems/"
      + LITM_SYSTEM_ID
      + "/module/lib/floating-tag-and-status-adapter.mjs";

    const route =
      foundry.utils.getRoute?.(
        relative
      )
      ?? relative;

    adapterPromise =
      import(route)
        .then(
          module =>
            module.FloatingTagAndStatusAdapter
            ?? null
        )
        .catch(error => {
          console.warn(
            "Pokemon LITM Tools | Adapter de Tag/Status indisponível; usando fallback local.",
            error
          );

          return null;
        });
  }

  return adapterPromise;
}

function fallbackStack(
  list,
  entry
) {
  const current =
    foundry.utils.deepClone(
      Array.isArray(list)
        ? list
        : []
    );

  if (!entry.isStatus) {
    current.push(entry);
    return current;
  }

  const norm =
    value =>
      String(value ?? "")
        .trim()
        .toLocaleLowerCase();

  const index =
    current.findIndex(
      row =>
        row?.isStatus === true
        &&
        norm(row.name) === norm(entry.name)
        &&
        (row.positive !== false)
          ===
          (entry.positive !== false)
    );

  if (index < 0) {
    current.push(entry);
    return current;
  }

  const existing =
    foundry.utils.deepClone(
      current[index]
    );

  const markings =
    Array.isArray(existing.markings)
      ? [...existing.markings]
      : Array(6).fill(false);

  while (markings.length < 6) {
    markings.push(false);
  }

  let tier =
    Math.max(
      1,
      Math.min(
        6,
        Number(entry.value ?? 1)
        || 1
      )
    )
    - 1;

  if (markings[tier]) {
    const next =
      markings.findIndex(
        (marked, index) =>
          index > tier
          &&
          !marked
      );

    if (next >= 0) {
      tier =
        next;
    }
  }

  markings[tier] =
    true;

  existing.markings =
    markings.slice(0, 6);

  existing.value =
    existing.markings.lastIndexOf(true)
    + 1;

  current[index] =
    existing;

  return current;
}

async function applyDropToToken(
  token,
  data
) {
  const actor =
    token?.actor;

  if (!actor) {
    return false;
  }

  if (
    !game.user?.isGM
    &&
    actor.isOwner !== true
  ) {
    ui.notifications.warn(
      "Você não tem permissão para alterar esse token."
    );

    return true;
  }

  const name =
    String(
      data?.name
      ?? ""
    )
      .trim();

  if (!name) {
    return false;
  }

  const current =
    foundry.utils.deepClone(
      actor.system
        ?.floatingTagsAndStatuses
      ?? []
    );

  const positive =
    data?.positive !== false
    &&
    data?.positive !== "false";

  let next =
    current;

  let label =
    name;

  if (data.type === "status") {
    const value =
      Math.max(
        1,
        Math.min(
          6,
          parseInt(
            data.value,
            10
          )
          || 1
        )
      );

    const markings =
      Array(6).fill(false);

    markings[value - 1] =
      true;

    const entry = {
      name,
      isStatus:
        true,
      value,
      positive,
      description:
        "",
      markings
    };

    const Adapter =
      await floatingAdapter();

    next =
      Adapter?.withStatusStacked
        ? Adapter.withStatusStacked(
            current,
            entry
          )
        : fallbackStack(
            current,
            entry
          );

    label =
      name
      + "-"
      + value;

  } else if (data.type === "tag") {
    next = [
      ...current,
      {
        name,
        description:
          "",
        isStatus:
          false,
        positive,
        value:
          0,
        markings:
          Array(6).fill(false)
      }
    ];

  } else {
    return false;
  }

  /*
   * token.actor é intencional:
   * - token não vinculado -> Synthetic Actor (estado só daquele token)
   * - token vinculado -> Actor-base
   */
  await actor.update({
    "system.floatingTagsAndStatuses":
      next
  });

  ui.notifications.info(
    (
      data.type === "status"
        ? "Status "
        : "Tag "
    )
    + "“"
    + label
    + "” aplicado em "
    + (
        token.name
        ?? actor.name
        ?? "token"
      )
    + "."
  );

  return true;
}

function dropQueueKey(
  token
) {
  const actor =
    token?.actor;

  return String(
    actor?.uuid
    ?? (
        token?.parent?.id
        && token?.id
          ? (
              token.parent.id
              + ":"
              + token.id
            )
          : actor?.id
      )
    ?? ""
  );
}

function queueDropToToken(
  token,
  data
) {
  const key =
    dropQueueKey(
      token
    );

  if (!key) {
    return applyDropToToken(
      token,
      data
    );
  }

  const previous =
    dropQueues.get(key)
    ?? Promise.resolve();

  const queued =
    previous
      .catch(
        () => undefined
      )
      .then(
        () =>
          applyDropToToken(
            token,
            data
          )
      );

  dropQueues.set(
    key,
    queued
  );

  return queued.finally(
    () => {
      if (
        dropQueues.get(key)
          === queued
      ) {
        dropQueues.delete(
          key
        );
      }
    }
  );
}


function onDropCanvasData(
  _canvas,
  data,
  event
) {
  if (
    game.system.id !== LITM_SYSTEM_ID
    ||
    !["tag", "status"].includes(
      data?.type
    )
  ) {
    return;
  }

  const token =
    dropToken(
      data
    );

  if (!token?.actor) {
    return;
  }

  event?.preventDefault?.();

  void queueDropToToken(
    token,
    data
  ).catch(error => {
    console.error(
      "Pokemon LITM Tools | Drop Tag/Status no token:",
      error
    );

    ui.notifications.error(
      error?.message
      ?? "Não foi possível aplicar a Tag/Status."
    );
  });

  return false;
}

export function activatePokemonTokenDrop() {
  if (activated) {
    return;
  }

  activated =
    true;

  Hooks.on(
    "dropCanvasData",
    onDropCanvasData
  );
}
