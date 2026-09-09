const fs = require("fs");
const os = require("os");
const path = require("path");
const cp = require("child_process");
const crypto = require("crypto");

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(line => line.replace(/[ \t]+$/g, ""))
    .join("\n");
}

function sha256Text(value) {
  return crypto
    .createHash("sha256")
    .update(String(value ?? ""), "utf8")
    .digest("hex");
}

function run(command, args, options = {}) {
  return cp.execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  }).trimEnd();
}

function assertNamedChecks(checks, phase = "Validação") {
  const failed = Object.entries(checks ?? {})
    .filter(([, ok]) => ok !== true)
    .map(([name]) => name);

  if (failed.length) {
    throw new Error(`${phase}: ${failed.join(", ")}`);
  }
}

function writeNormalizedFiles(fileMap) {
  const written = [];

  for (const [relativePath, content] of Object.entries(fileMap ?? {})) {
    const target = path.resolve(process.cwd(), relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, normalizeText(content), "utf8");
    written.push(relativePath);
  }

  return written;
}

function gitStatusFiles() {
  const raw = run("git", ["status", "--porcelain", "--untracked-files=all"]);
  if (!raw) return [];

  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => ({
      code: line.slice(0, 2),
      file: line.slice(3).trim().replace(/^"|"$/g, "")
    }));
}

function validateWorkingTree({
  allowedFiles,
  ignoredUntracked = ["apply.cmd", "apply.ps1"]
} = {}) {
  const allowed = [...new Set(allowedFiles ?? [])].sort();
  const ignored = new Set(ignoredUntracked);

  run("git", ["diff", "--check"]);

  const status = gitStatusFiles();
  const relevant = status.filter(
    row => !(row.code === "??" && ignored.has(row.file))
  );
  const changed = relevant.map(row => row.file).sort();

  assertNamedChecks({
    "lista exata de arquivos alterados":
      JSON.stringify(changed) === JSON.stringify(allowed)
  }, "Gate do diff");

  for (const relativePath of changed.filter(file => /\.(?:c?js|mjs)$/i.test(file))) {
    run(process.execPath, ["--check", relativePath]);
  }

  return changed;
}

function recoveryPaths() {
  return {
    payload: path.join(os.tmpdir(), "pokemon-litm-last-failed.cjs"),
    hash: path.join(os.tmpdir(), "pokemon-litm-last-failed.sha256")
  };
}

function preserveFailedPayload(payloadPath) {
  const source = fs.readFileSync(payloadPath, "utf8");
  const hash = sha256Text(source);
  const targets = recoveryPaths();

  fs.writeFileSync(targets.payload, source, "utf8");
  fs.writeFileSync(targets.hash, hash + "\n", "utf8");

  return { ...targets, sha256: hash };
}

function runPatch(main, { payloadPath = process.argv[1] } = {}) {
  if (typeof main !== "function") {
    throw new TypeError("runPatch exige uma função principal.");
  }

  try {
    return main({
      normalizeText,
      sha256Text,
      run,
      assertNamedChecks,
      writeNormalizedFiles,
      gitStatusFiles,
      validateWorkingTree
    });
  } catch (error) {
    try {
      const saved = preserveFailedPayload(payloadPath);
      console.error(
        `Pokemon LITM Tools | payload preservado em ${saved.payload} | SHA256 ${saved.sha256}`
      );
    } catch (preserveError) {
      console.error(
        "Pokemon LITM Tools | não foi possível preservar o payload que falhou:",
        preserveError
      );
    }
    throw error;
  }
}

module.exports = {
  normalizeText,
  sha256Text,
  run,
  assertNamedChecks,
  writeNormalizedFiles,
  gitStatusFiles,
  validateWorkingTree,
  preserveFailedPayload,
  runPatch
};
