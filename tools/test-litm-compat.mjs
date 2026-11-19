// Run: node --experimental-vm-modules tools/test-litm-compat.mjs
// Executável sem Foundry instalado, rede, assets ou dependências extras.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../scripts/litm-compat.js", import.meta.url), "utf8");
const module = new vm.SourceTextModule(source, {
  context: vm.createContext({ console }),
  identifier: "scripts/litm-compat.js"
});
await module.link(() => { throw new Error("Compat layer must have no external imports"); });
await module.evaluate();
const { litmCompatibilityReport, compareNumericVersions,
  nativeSelectedChallengeStatusOverlaps } = module.namespace;

assert.equal(compareNumericVersions("14.5.5", "14.5.4"), 1);
assert.equal(compareNumericVersions("14.370", "14.370"), 0);
assert.equal(compareNumericVersions("14.5.4", "14.5.5"), -1);
const current = litmCompatibilityReport({
  foundryVersion: "14.370", systemId: "mist-engine-fvtt", systemVersion: "14.5.5"
});
assert.equal(current.supportedEnvironment, true);
assert.equal(current.referenceVersionsMatched, true);
assert.equal(current.notes.length, 0);
assert.equal(litmCompatibilityReport({
  foundryVersion: "14.370", systemId: "dnd5e", systemVersion: "6.1.0"
}).supportedEnvironment, false);
assert.ok(litmCompatibilityReport({
  foundryVersion: "14.368", systemId: "mist-engine-fvtt", systemVersion: "14.5.4"
}).notes.length >= 2);
assert.ok(litmCompatibilityReport({
  foundryVersion: "14.370", systemId: "mist-engine-fvtt", systemVersion: "14.5.6"
}).notes.some(note => note.includes("mais recente")));

const targetStatuses = [
  { actorId: "pidgey", name: "Paralisado" },
  { actorId: "pikachu", name: "Envenenado" }
];
assert.equal(nativeSelectedChallengeStatusOverlaps([
  { source: "npc", actorId: "pidgey", name: "paralisado", value: 2, positive: false }
], targetStatuses), true, "inverted native status takes precedence");
assert.equal(nativeSelectedChallengeStatusOverlaps([
  { source: "npc", actorId: "pidgey", name: "Paralisado", value: 2, positive: true }
], targetStatuses), true);
assert.equal(nativeSelectedChallengeStatusOverlaps([
  { source: "pokemon-move-auto", actorId: "pidgey", name: "Paralisado", value: 2 }
], targetStatuses), false, "our synthetic status must not suppress itself");
assert.equal(nativeSelectedChallengeStatusOverlaps([
  { source: "npc", actorId: "pidgey", name: "Queimado", value: 2 }
], targetStatuses), false, "different status must not suppress");
assert.equal(nativeSelectedChallengeStatusOverlaps([
  { source: "npc", actorId: "other-token", name: "Paralisado", value: 2 }
], targetStatuses), false, "different actor must not suppress");
assert.equal(nativeSelectedChallengeStatusOverlaps([
  { source: "npc", actorId: "pidgey", name: "Paralisado", value: 0 }
], targetStatuses), false, "tags are not tiered statuses");
assert.equal(nativeSelectedChallengeStatusOverlaps([], targetStatuses), false);
assert.equal(nativeSelectedChallengeStatusOverlaps(null, targetStatuses), false);
console.log("PASS LitM 14.5.5 compatibility and native Status precedence");
