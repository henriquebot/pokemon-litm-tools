# Pokémon LITM Tools — Roadmap

## Marco 1 — Ecossistema de criação
- [x] Importer rápido de Pessoas, Pokémon e Props
- [x] Challenge Wizard de Pokémon
- [x] Pokémon selvagem como Challenge
- [x] Pokémon de Treinador NPC como Challenge vinculado
- [x] Converter Challenge selvagem capturado em Themebook do treinador jogador
- [x] Destino Time / PC e troca automática quando o Time estiver cheio
- [x] PC composto apenas por Themebooks serializados; Actors Pokémon ficam fora da listagem
- [x] Visualização em modo leitura dos Themebooks armazenados no PC
- [x] Gênero oficial do indivíduo preservado como metadata
- [x] Próximos 3 golpes por nível como Tags de Poder planejadas
- [x] Editar Challenge Pokémon novamente pelo Wizard
- [x] Seletor visual de treinador NPC com busca, imagem e filtro por pasta
- [x] Theme Pokémon com Tag-título do indivíduo e até 3 golpes planejados
- [x] Botão Tema no Importer para criar diretamente Pokémon de treinador-jogador
- [x] Perguntas semânticas das Tags Pokémon (personalidade, movimentos, stat, habilidade e fraqueza)
- [x] Special Improvements Pokémon pré-preenchidos para gimmicks oficiais
- [x] Cabeçalho persistente do Pokémon nas etapas 2–5 do Wizard
- [x] Navegação Pokémon de treinador NPC → Challenge do treinador
- [ ] Challenge Builder de Pessoas / treinadores NPC com equipe inteira em um único fluxo
- [ ] Challenge Add-ons / templates nativos do LitM no Importer
- [ ] Presets de Classes de Treinador

## Marco 2 — Combate 0.8.3
- [x] Modelo estruturado de efeitos por Move para automação futura
- [x] Combat Actor como projeção temporária de um Theme Pokémon
- [x] Token HUD do treinador para colocar um Pokémon do Time por vez
- [x] Posicionamento individual com preview e clique no mapa
- [x] Arrastar Theme Pokémon diretamente para o Canvas
- [x] Reutilização por pokemonInstanceId e prevenção de duplicatas na cena
- [x] Recolher / focar Pokémon que já está em campo
- [ ] Metadata de tipo por Move
- [ ] Targeting e múltiplos alvos
- [ ] Fraqueza, resistência e imunidade pré-selecionadas na rolagem
- [ ] Aprovação do GM antes da rolagem
- [ ] Target → aplicação automática de Tags e Status no alvo
- [ ] Aplicação e expiração de Status
- [ ] Recuo, cura, dreno, queimadura, veneno, sono, paralisia e hesitação
- [ ] Resolver VFX semântico com integrações opcionais
- [ ] Sequencer / Eskie / BLFX / JB2A opcionais; fallback nativo obrigatório

## Marco 3 — Pokémon-jogador
- [ ] Finalizar etapa 4 do criador de Pokémon-jogador
- [ ] Botão no header para reabrir Trainer/Pokémon-jogador no Criador em modo edição
- [ ] Quest dos Themes Pokémon baseada em Nature, relação e evolução
- [ ] Regras e ativação de Mega Evolução, Z-Move, Dynamax, Gigantamax, Terastalização, Reversão Primal e Ultra Burst
- [ ] Themes reais: Habitat, Ability, Nature, Estágio Evolutivo e Move Set
- [ ] Tags de Poder, Fraquezas e Quests
- [ ] Refinamentos de Mochila e Trocas

## Preparação para distribuição
- [ ] Core sem assets oficiais embutidos
- [ ] Providers configuráveis para sprites, portraits, overworld e VFX
- [ ] Add-ons independentes para conteúdo original
- [ ] Editor de Conteúdo em Configurações: Moves, Abilities, Natures, Status e Threats
- [ ] Overrides persistentes sem alterar arquivos do módulo
- [ ] Importar / exportar overrides em JSON
- [ ] Restaurar padrão por entrada ou globalmente
- [ ] Idioma configurável, PT-BR padrão
- [ ] Dependências externas sempre opcionais quando possível

## Fora do roadmap
- Speed controlando velocidade de animação.
