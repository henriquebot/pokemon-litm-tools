import fs from "node:fs/promises";

const FILE = "data/catalog.json";

const response = await fetch(
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv"
);

if (!response.ok) {
  throw new Error(`Pokemon CSV HTTP ${response.status}`);
}

const csv = await response.text();
const heights = new Map();

for (const line of csv.split(/\r?\n/).slice(1)) {
  if (!line) continue;

  const [
    id,
    identifier,
    speciesId,
    height
  ] = line.split(",");

  const dex = Number(id);
  const dm = Number(height);

  if (Number.isInteger(dex) && Number.isFinite(dm)) {
    heights.set(dex, dm);
  }
}

const data = JSON.parse(
  await fs.readFile(FILE, "utf8")
);

function visualScale(heightMeters) {
  /*
   * 1 m ≈ escala 1.
   * Mantemos limites para Pokémon enormes não destruírem a cena.
   */
  const raw = Math.sqrt(Math.max(0.2, heightMeters));
  return Math.min(2.25, Math.max(0.50, raw));
}

for (const pokemon of data.pokemon) {
  const dm = heights.get(Number(pokemon.dex));

  if (!dm) continue;

  const meters = dm / 10;

  pokemon.heightMeters = meters;
  pokemon.tokenScale = Number(
    visualScale(meters).toFixed(2)
  );
}

await fs.writeFile(
  FILE,
  JSON.stringify(data, null, 2) + "\n",
  "utf8"
);

console.log(
  `Height metadata added to ${data.pokemon.length} Pokémon.`
);
