// Compatibilidade isolada: Foundry v14 + Legend in the Mist.
// Regras de Pokémon continuam no módulo; este arquivo só trata da superfície
// compartilhada com o sistema oficial e não altera documentos do LitM.
export const LITM_SYSTEM_ID = "mist-engine-fvtt";
export const REFERENCE_FOUNDRY = "14.370";
export const REFERENCE_LITM = "14.5.5";

function versionParts(value) {
  return String(value ?? "").split(/[.-]/).slice(0, 3).map(part => {
    const value = Number.parseInt(part, 10);
    return Number.isFinite(value) ? value : 0;
  });
}

export function compareNumericVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) {
      return (a[i] ?? 0) > (b[i] ?? 0) ? 1 : -1;
    }
  }
  return 0;
}

export function litmCompatibilityReport({
  foundryVersion = "",
  systemId = "",
  systemVersion = ""
} = {}) {
  const isLitm = systemId === LITM_SYSTEM_ID;
  const isV14 = versionParts(foundryVersion)[0] === 14;
  const foundryReference = compareNumericVersions(foundryVersion, REFERENCE_FOUNDRY);
  const litmReference = compareNumericVersions(systemVersion, REFERENCE_LITM);
  const notes = [];
  if (!isLitm) notes.push("O mundo não utiliza Legend in the Mist.");
  if (!isV14) notes.push("O módulo foi desenvolvido para Foundry v14.");
  if (isV14 && foundryReference < 0) notes.push("Atualizar Foundry para 14.370 é recomendado; esta build não foi auditada.");
  if (isLitm && !systemVersion) notes.push("Não foi possível identificar a versão do Legend in the Mist.");
  if (isLitm && systemVersion && litmReference < 0) notes.push("O LitM é anterior à referência 14.5.5; valide as regras de rolagem e Status.");
  if (isLitm && systemVersion && litmReference > 0) notes.push("O LitM é mais recente que a versão auditada: execute os testes de integração.");
  return {
    foundryVersion, systemId, systemVersion,
    referenceFoundry: REFERENCE_FOUNDRY,
    referenceLitm: REFERENCE_LITM,
    supportedEnvironment: isLitm && isV14,
    referenceVersionsMatched: isLitm && isV14
      && foundryReference === 0 && litmReference === 0,
    notes
  };
}

export function currentLitmCompatibilityReport() {
  return litmCompatibilityReport({
    foundryVersion: globalThis.game?.version
      ?? globalThis.game?.release?.version ?? "",
    systemId: globalThis.game?.system?.id ?? "",
    systemVersion: globalThis.game?.system?.version ?? ""
  });
}

// LitM 14.5.x permite selecionar/inverter Status de Challenges diretamente
// no diálogo nativo. Não adicionamos uma segunda cópia automática do mesmo
// Status quando ele já foi explicitamente selecionado pelo jogador.
export function nativeSelectedChallengeStatusOverlaps(selectedTags, targetStatuses) {
  if (!Array.isArray(selectedTags) || !Array.isArray(targetStatuses)) return false;
  const normalized = value => String(value ?? "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  return selectedTags.some(tag =>
    tag?.source === "npc" && Number(tag?.value ?? 0) > 0
    && targetStatuses.some(status =>
      String(status?.actorId ?? "") !== ""
      && String(status.actorId) === String(tag.actorId ?? "")
      && normalized(status?.name) === normalized(tag?.name)
    )
  );
}
