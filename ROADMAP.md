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
- [x] Pokémon iniciais do Character Creator usam o mesmo Theme completo do Builder/captura
- [x] Pokémon Manager com Time / PC / Liberados e retorno do mesmo indivíduo por pokemonInstanceId
- [x] Limpeza de referências órfãs sem transformar Actors antigos em entradas do PC
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
- [x] Recolher / focar Pokémon que já está em campo com botões diretos
- [x] Estado de combate persistido no Theme e restaurado quando o Combat Actor é recriado
- [x] Follower e Combat Token unificados por pokemonInstanceId; nunca duplicar o mesmo Pokémon na cena
- [x] HUD do Combat Token com Recolher, Seguir/Parar e até 4 Moves
- [x] Metadata de tipo por Move
- [x] Targeting e múltiplos alvos pelo target nativo do Foundry
- [x] Prévia de fraqueza, resistência e imunidade por alvo
- [ ] Injetar automaticamente a eficácia de tipo na rolagem nativa do LitM
- [ ] Aprovação do GM antes da rolagem nativa
- [x] Target → aplicação de Tags e Status estruturados no alvo
- [x] Aplicação e empilhamento de Status conforme o modelo do LitM
- [ ] Expiração automática de Status por próxima ação / confronto
- [x] Recuo, cura, dreno, queimadura, veneno, sono, paralisia e hesitação disponíveis via effects
- [x] Áreas Pokémon como Regions v14 com cor por tipo e targeting dos Tokens dentro
- [x] Challenge Bio com botão Área para apresentar ameaça antes da reação dos jogadores
- [x] Sequencer opcional para áreas animadas e VFX de golpe; JB2A opcional para assets
- [x] Fallback nativo obrigatório sem módulos externos

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
