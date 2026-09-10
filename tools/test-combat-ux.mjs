// Run locally: node --experimental-vm-modules tools/test-combat-ux.mjs
// No Foundry startup, network, assets or runtime storage required.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const moduleId = "pokemon-litm-tools";
const systemId = "mist-engine-fvtt";
const gm = { id: "gm", active: true, isGM: true, targets: new Set() };
const notifications = [];
const context = vm.createContext({
  console: { ...console, warn() {} },
  setTimeout,
  clearTimeout,
  game: {
    user: gm, users: [gm], actors: new Map(), scenes: new Map(), items: new Map(),
    settings: { get: () => "pt-BR" }
  },
  canvas: { scene: null },
  foundry: { utils: {
    deepClone: structuredClone,
    escapeHTML: text => String(text).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char])
  } },
  ui: { notifications: { info: text => notifications.push(text) } }
});

const modules = new Map();
async function load(url) {
  if (modules.has(url.href)) return modules.get(url.href);
  let source = await readFile(url, "utf8");
  if (url.pathname.endsWith("/pokemon-combat-effects.js")) {
    // Expose private helpers only inside this isolated test VM.
    source += "\nexport { replayVfxTargetIds, moveReplayVfxTargetIds, consequenceVfxActions, floatingSpendState, rollbackContextSpendEntry, litmModulePromises, applyFloatingSpendDelta, applyEffectsToActor };\n";
  }
  if (url.pathname.endsWith("/pokemon-guided-flow.js")) {
    source += "\nexport { consequenceSourcesForScene, activeConsequenceSources, retainPhaseOneSources, recordPhaseOneSources, decorateGmConsequencePanel, onTargetGuidedToken };\n";
  }
  const module = new vm.SourceTextModule(source, {
    context,
    identifier: url.href,
    importModuleDynamically() {
      throw new Error("Native Foundry/mist-engine module unavailable in local tests");
    }
  });
  modules.set(url.href, module);
  return module;
}
async function evaluate(url) {
  const module = await load(url);
  await module.link((specifier, parent) => load(new URL(specifier, parent.identifier)));
  await module.evaluate();
  return module.namespace;
}

const combat = await evaluate(new URL("../scripts/pokemon-combat-effects.js", import.meta.url));
const guided = await evaluate(new URL("../scripts/pokemon-guided-flow.js", import.meta.url));
const unavailable = new Set(["nativeBurnNormal", "nativeBurnPlusThree", "nativeSingleBurnLimit", "nativeBurnError"]);
const result = await combat.pokemonLitmCombatSelfTest();
for (const [name, value] of Object.entries(result.checks)) {
  if (!unavailable.has(name)) assert.equal(value, true, name);
}
const guidedResult = guided.pokemonGuidedFlowSelfTest();
assert.equal(guidedResult.ok, true, "guided self-tests: " + JSON.stringify(guidedResult.checks));
console.log("PASS " + Object.keys(result.checks).filter(name => !unavailable.has(name)).length
  + " combat checks and " + Object.keys(guidedResult.checks).length + " guided checks");
console.log("UNAVAILABLE nativeBurnNormal, nativeBurnPlusThree, nativeSingleBurnLimit: require Foundry/mist-engine");

const actor = {
  id: "actor", type: "litm-character", system: { floatingTagsAndStatuses: [] },
  async update(change) {
    this.system.floatingTagsAndStatuses = structuredClone(change["system.floatingTagsAndStatuses"]);
  }
};
const target = { id: "target", actor };
const scene = { id: "scene", tokens: new Map([[target.id, target]]) };
context.canvas.scene = scene;
context.game.scenes.set(scene.id, scene);
context.game.actors.set(actor.id, actor);

assert.equal(combat.replayVfxTargetIds([]).length, 0);
gm.targets.add({ document: target });
assert.deepEqual(Array.from(combat.replayVfxTargetIds([])), ["target"], "late target fallback");
assert.deepEqual(Array.from(combat.replayVfxTargetIds(["stale"])), ["target"], "stale frozen fallback");
const frozen = { id: "frozen", actor };
scene.tokens.set(frozen.id, frozen);
assert.deepEqual(Array.from(combat.replayVfxTargetIds(["frozen"])), ["target"], "CURRENT TARGET > FROZEN TARGET");
gm.targets.add({ document: target });
assert.deepEqual(Array.from(combat.replayVfxTargetIds(["frozen"])), ["target"], "current target IDs deduplicated");
gm.targets.clear();
gm.targets.add({ document: { id: "target", parent: { id: "other-scene" } } });
assert.deepEqual(Array.from(combat.replayVfxTargetIds(["frozen"])), ["frozen"], "target from another Scene ignored even if ID collides");
gm.targets.clear();
gm.targets.add({ id: "stale" });
assert.equal(combat.replayVfxTargetIds([]).length, 0, "stale current target ignored");
assert.deepEqual(Array.from(combat.replayVfxTargetIds(["target"])), ["target"], "frozen valid target retained");
console.log("PASS VFX CURRENT TARGET > FROZEN TARGET, late/stale/cross-scene targets");

const source = { id: "source", actor: { id: "source-actor" } };
scene.tokens.set(source.id, source);
const vfx = { sceneId: scene.id, sourceTokenId: source.id, targetTokenIds: [target.id] };
assert.equal(combat.consequenceVfxActions(vfx, scene).length, 2);
gm.targets.clear();
gm.targets.add({ document: frozen });
for (const action of combat.consequenceVfxActions(vfx, scene, gm.targets)) {
  assert.deepEqual(Array.from(action.targetTokenIds), ["frozen"], "consequence/threat replay uses the current target");
}
for (const selfTarget of ["self", "user", "users-field"]) {
  assert.deepEqual(Array.from(combat.moveReplayVfxTargetIds({ target: selfTarget }, source, [target.id])), [source.id], "self move keeps source");
  const actions = combat.consequenceVfxActions({ ...vfx, moveTarget: selfTarget }, scene, gm.targets);
  assert.equal(actions.length, 1, "self consequence only has target VFX");
  assert.deepEqual(Array.from(actions[0].targetTokenIds), [source.id], "self consequence keeps source");
}
assert.equal(combat.consequenceVfxActions(vfx, { ...scene, id: "other-scene" }, gm.targets).length, 0, "card from another Scene ignored");
gm.targets.clear();
scene.tokens.delete(source.id);
assert.equal(combat.consequenceVfxActions(vfx, scene).length, 1, "removed source keeps target VFX only");
scene.tokens.delete(target.id);
assert.equal(combat.consequenceVfxActions(vfx, scene).length, 0, "removed affected token disables VFX");
scene.tokens.set(target.id, target);
console.log("PASS consequence VFX source/target lifecycle");

const damage = { name: "ferido", source: "damage", target: "target", kind: "status", level: 2 };
const ailment = { name: "paralisado", source: "ailment", target: "target", kind: "status", level: 2 };
const tag = { name: "revelado", source: "database-effect", target: "target", kind: "tag" };
assert.equal((await combat.applyFloatingSpendDelta(actor, damage, 0)).immune, true);
assert.equal(actor.system.floatingTagsAndStatuses.length, 0, "immune damage changes nothing");
assert.equal((await combat.applyFloatingSpendDelta(actor, ailment, 0)).applied, true);
assert.equal((await combat.applyFloatingSpendDelta(actor, tag, 0)).applied, true);
assert.equal(actor.system.floatingTagsAndStatuses.length, 2, "independent status and tag remain applicable");
actor.system.floatingTagsAndStatuses = [];
const appliedEffects = await combat.applyEffectsToActor(actor, [damage, ailment, tag], 0, 3);
assert.equal(appliedEffects.length, 2, "legacy effect application also preserves independent effects");
assert.equal(actor.system.floatingTagsAndStatuses.some(entry => entry.name === "ferido"), false);
console.log("PASS immunity application guards and independent Status/Tag effects");

// The native renderer is outside this test; use an inert HTML response to test
// the real ledger update, authority dispatch and rollback of Actor state.
combat.litmModulePromises.set("module/lib/detailed-spend.mjs", Promise.resolve({ renderDetailedCard: () => "<div></div>" }));
const applied = { name: "ferido", isStatus: true, positive: false, burned: false, value: 2 };
function messageForRollback() {
  const row = {
    tokenId: target.id, actorId: actor.id, targetKind: "actor",
    before: { present: false }, beforeEntry: null,
    after: combat.floatingSpendState(applied), afterEntry: structuredClone(applied)
  };
  return {
    ledger: { total: 3, entries: [{ cost: 2, pokemonApplication: { rows: [row] } }] },
    getFlag(scope, key) {
      if (scope === systemId && key === "detailedSpend") return this.ledger;
      if (scope === moduleId && key === "rollSceneId") return scene.id;
    },
    async update(change) {
      this.ledger = change["flags." + systemId + ".detailedSpend"];
    }
  };
}
actor.system.floatingTagsAndStatuses = [structuredClone(applied)];
const intact = messageForRollback();
assert.equal(await combat.rollbackContextSpendEntry(intact, 0), true);
assert.equal(intact.ledger.entries.length, 0, "refund intact target");
assert.equal(actor.system.floatingTagsAndStatuses.length, 0, "restore intact target");

const changed = { ...applied, value: 3 };
actor.system.floatingTagsAndStatuses = [changed];
const external = messageForRollback();
assert.equal(await combat.rollbackContextSpendEntry(external, 0), true);
assert.equal(external.ledger.entries.length, 0, "refund externally changed target");
assert.deepEqual(actor.system.floatingTagsAndStatuses, [changed], "preserve external target state");
assert.equal(notifications.at(-1), "Gasto devolvido. O alvo mudou desde a aplicação, então o efeito não foi revertido.");
console.log("PASS complete rollback and refund-only conflict regression");

// Test Boss Phase 1 source retention across transition and re-render
const phaseOneToken = {
  id: "phase-one-token",
  name: "Boss Fase 1",
  actor: {
    id: "boss-phase-one",
    type: "litm-npc",
    system: { isOvercome: true },
    getFlag: (_mod, key) => key === "bossPhaseRole" ? "phase1"
      : key === "bossFinalActorId" ? "boss-final"
      : key === "pokemonBuilder" ? true
      : key === "moves" ? [{ id: "slam", name: "Slam" }] : null
  }
};
scene.tokens.set(phaseOneToken.id, phaseOneToken);
const initialSources = guided.activeConsequenceSources(scene.id);
assert.equal(initialSources.some(s => s.tokenId === phaseOneToken.id && s.bossPhaseOne), true, "Phase 1 in active sources");

// Simulate transition: Phase 1 token removed from scene
scene.tokens.delete(phaseOneToken.id);
scene.tokens.set("boss-final-token", {
  id: "boss-final-token",
  actorId: "boss-final",
  actor: { id: "boss-final", type: "litm-npc", flags: {}, system: { threatsAndConsequences: [] }, getFlag: () => null }
});
// Re-render / fresh query of sources for the scene
const sourcesAfterTransition = guided.activeConsequenceSources(scene.id);
assert.equal(sourcesAfterTransition.some(s => s.tokenId === phaseOneToken.id && s.bossPhaseOne), true, "Phase 1 retained after transition/re-render");
assert.equal(sourcesAfterTransition.find(s => s.tokenId === phaseOneToken.id)?.actions[0]?.name, "Slam");
scene.tokens.delete("boss-final-token");
const sourcesAfterBossLeaves = guided.activeConsequenceSources(scene.id);
assert.equal(sourcesAfterBossLeaves.some(s => s.tokenId === phaseOneToken.id), false, "stale Phase 1 source removed after final phase leaves");
console.log("PASS Boss Phase 1 source retained only while final phase remains");

// Minimal DOM semantics: rebuilding a select defaults to its first option,
// while assigning value explicitly selects the corresponding source.
class ConsequenceTestElement {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.listeners = new Map();
    this.options = [];
    this.selectedValue = "";
  }
  set innerHTML(html) {
    this.children = [];
    if (this.tag === "select") {
      this.options = [...html.matchAll(/<option value="([^"]*)"/g)].map(match => match[1]);
      this.selectedValue = this.options[0] ?? "";
    }
  }
  get value() { return this.selectedValue; }
  set value(value) { this.selectedValue = this.options.includes(value) ? value : ""; }
  setAttribute() {}
  append(...children) { this.children.push(...children); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  dispatch(type) { this.listeners.get(type)?.({ preventDefault() {} }); }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [
      ...(selector === "[data-pokemon-guided-consequence]" && child.dataset.pokemonGuidedConsequence ? [child] : []),
      ...child.querySelectorAll(selector)
    ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}

const previousDocument = context.document;
let mountedConsequenceRoots = [];
context.document = {
  createElement: tag => new ConsequenceTestElement(tag),
  querySelectorAll: selector => mountedConsequenceRoots.flatMap(root => root.querySelectorAll(selector))
};
const panelScene = {
  id: "consequence-panel-scene",
  tokens: new Map(["first", "second", "third"].map(id => [id, {
    id,
    name: id,
    actor: { id: "actor-" + id, type: "litm-npc", system: { threatsAndConsequences: [{ name: "Ameaça" }] }, getFlag: () => null }
  }]))
};
context.game.scenes.set(panelScene.id, panelScene);
const consequenceMessage = {
  id: "consequence-panel-message",
  getFlag(scope, key) {
    if (scope === systemId && key === "detailedSpend") return { consequenceResult: 0 };
    if (scope === moduleId && key === "rollSceneId") return panelScene.id;
  }
};
function panelTargets(...ids) {
  gm.targets.clear();
  for (const id of ids) gm.targets.add({ document: { id, parent: { id: panelScene.id } } });
}
function renderConsequencePanel() {
  const root = new ConsequenceTestElement("div");
  mountedConsequenceRoots = [root];
  guided.decorateGmConsequencePanel(consequenceMessage, root);
  const panel = root.querySelector("[data-pokemon-guided-consequence]");
  assert.ok(panel, "consequence panel rendered");
  return panel.children.find(child => child.tag === "select");
}

panelTargets("second");
let sourceSelect = renderConsequencePanel();
assert.equal(sourceSelect.value, "token:second", "exact current Challenge explicitly selected on render");
sourceSelect.value = "token:first";
sourceSelect.dispatch("change");
sourceSelect.dispatch("focus");
sourceSelect.dispatch("pointerdown");
guided.onTargetGuidedToken(gm);
assert.equal(sourceSelect.value, "token:first", "manual choice survives refresh with unchanged targets");
sourceSelect = renderConsequencePanel();
assert.equal(sourceSelect.value, "token:first", "manual choice survives card re-render with unchanged targets");

panelTargets("third");
guided.onTargetGuidedToken({ id: "another-user" });
assert.equal(sourceSelect.value, "token:first", "other user's targeting hook leaves GM choice alone");
guided.onTargetGuidedToken(gm);
assert.equal(sourceSelect.value, "token:third", "GM target change updates the visible dropdown");
panelTargets("second", "third");
guided.onTargetGuidedToken(gm);
assert.equal(sourceSelect.value, "token:second", "ambiguous targets preserve the prioritized-source fallback");
panelTargets();
guided.onTargetGuidedToken(gm);
assert.equal(sourceSelect.value, "token:first", "no targets preserve the first-source fallback");

sourceSelect.value = "token:third";
sourceSelect.dispatch("change");
sourceSelect = renderConsequencePanel();
assert.equal(sourceSelect.value, "token:third", "manual choice without targets also survives re-render");
panelScene.tokens.delete("third");
sourceSelect.dispatch("focus");
assert.equal(sourceSelect.value, "token:first", "removed manual source falls back to an active source");
panelTargets("second");
sourceSelect = renderConsequencePanel();
assert.equal(sourceSelect.value, "token:second", "changed targets also update suggestion during re-render");
gm.targets.clear();
gm.targets.add({ document: { id: "second", parent: { id: "other-scene" } } });
guided.onTargetGuidedToken(gm);
assert.equal(sourceSelect.value, "token:first", "another Scene's target cannot select a matching local ID");
gm.targets.clear();
context.game.scenes.delete(panelScene.id);
context.document = previousDocument;
console.log("PASS GM source dropdown: target suggestion, manual selection, target hook, re-render and fallback");
