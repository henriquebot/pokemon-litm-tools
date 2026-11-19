# Fase A — Compatibilidade Foundry v14 / LitM 14.5.5

Data da auditoria: 2026-11-19
Branch de origem: `ag/ranger-smoke-fixes`
Branch de trabalho: `feature/litm-1455-foundry14-compat`

## Escopo

- Sem alteração de produção, `main`, mundos ou armazenamento `storage/`.
- Referência: Foundry v14.370 / `mist-engine-fvtt` 14.5.5.
- Não ativar DAS Core: ele depende do sistema D&D 5e. A Fase B tratará VFX e bibliotecas de animações.
- Mantido o modelo narrativo do Legend in the Mist (Power, Tags, Status e consequências), sem reproduzir fórmula de dano Pokémon.

## Alterações de código

1. `scripts/litm-compat.js`: comparação de versões e relatório acessível por
   `game.modules.get("pokemon-litm-tools").api.getPokemonLitmCompatibilityReport()`.
   Não bloqueia mundos automaticamente nem afirma compatibilidade testada.
2. `scripts/pokemon-combat-effects.js`: respeita seleção nativa de Status de Challenge
   (inclusive inversão por rolagem), evitando adicionar uma cópia automática do
   mesmo Status no painel de rolagem. Não altera a regra nativa de seleção do
   maior Status positivo/negativo.
3. Imports de módulos internos do LitM: falhas não ficam eternamente armazenadas
   em cache; uma próxima tentativa pode recuperar após atualização.
4. `scripts/pokemon-guided-flow.js`: minicards reconhecem `/s`, `/sn`,
   aliases de Status `/sp`, `/sg`, `/sr`, `/so`, `/n`,
   `/t` para Tags e `/w` ou `/wo` para fraquezas. Texto original é
   escapado antes de montar HTML arrastável.
5. `scripts/pokemon-combat-effects.js`: os botões de Status na biografia
   reconhecem marcadores numéricos equivalentes aos atuais do sistema.

## Testes automatizados

- `node --experimental-vm-modules tools/test-litm-compat.mjs`
- `node --experimental-vm-modules tools/test-combat-ux.mjs`
- `node tools/test-v081-bundle.mjs`
- `node tools/test-next-pull-ranger.mjs`
- `node tools/test-importer-assets.mjs`
- `node tools/test-visual-showcase.mjs`
- `node tools/test-post-smoke-round3-v4-safe.mjs`

Workflow: `.github/workflows/phase-a-compat.yml`.
Testes automáticos são uma barreira estática/de regressão, **não** substituem teste real no Foundry.

## Checklist obrigatório no mundo descartável

- [ ] Conferir com a API o Foundry 14.370 e LitM 14.5.5 realmente **instalados**
  (o manifesto do código-fonte do LitM e o pacote publicado podem divergir).
- [ ] Verificar `pokemonLitmCombatSelfTest()` e `pokemonGuidedFlowSelfTest()`.
- [ ] Quick, Detailed e Reaction Roll de Pokémon: Power, Burn de no máximo uma
  Tag e cálculo do maior Status de cada polaridade.
- [ ] Selecionar Status nativo de Challenge, inverter sua polaridade durante a
  rolagem e verificar que não há cópia automática; testar também sem seleção.
- [ ] Testar um alvo e múltiplos alvos, imunes, resistentes e vulneráveis.
- [ ] Testar Consequência do Narrador, Detailed Spend, mini-card, aplicação e
  remoção de Status sem alterar dados de outro Actor.
- [ ] Verificar `/s`, `/sn`, `/t`, `/wo` em cards e ações do Challenge,
  incluindo nomes com espaço e texto que parece HTML.
- [ ] Criar e apagar Region de golpe; com e sem Sequencer/JB2A; garantir limpeza
  dos VFX persistentes.
- [ ] Criar treinador, Ranger e Pokémon, abrir Wizard e ficha, capturar, recolher,
  seguir e trocar; validar ausência de tokens duplicados.
- [ ] Testar com 1 GM + 1 jogador, incluindo permissões, flags e sincronização
  de socket em cenas diferentes.
- [ ] Recarregar a cena / mundo e verificar restauração do Theme e do Combat Actor.
- [ ] Somente após testes no Foundry, atualizar marca de versão verificada do
  manifest e preparar release; não fazer deploy automático.

## Pontos ainda monitorados

O módulo importa funções internas do LitM (como `DiceRollApp.getInstance`,
`calculatePowerTags` e `renderDetailedCard`). Essas APIs existem na
referência 14.5.5, mas não são contrato público de estabilidade. O reporte
e o roteiro de regressão devem ser revisados em cada atualização do sistema.
