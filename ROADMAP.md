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
- [x] Eficácia de tipo altera consequência/dano pós-rolagem por alvo, nunca o Power obtido na rolagem
- [ ] Aprovação do GM antes da rolagem nativa
- [x] Target → aplicação de Tags e Status estruturados no alvo
- [x] Aplicação e empilhamento de Status conforme o modelo do LitM
- [ ] Expiração automática de Status por próxima ação / confronto
- [x] Recuo, cura, dreno, queimadura, veneno, sono, paralisia e hesitação disponíveis via effects
- [x] Áreas Pokémon como Regions v14 com cor por tipo e leitura dos Tokens dentro, sem alterar os targets do jogador
- [x] Challenge Bio com botão Área para apresentar ameaça antes da reação dos jogadores
- [x] Sequencer opcional para áreas animadas e VFX de golpe; JB2A opcional para assets
- [x] Fallback nativo obrigatório sem módulos externos

## Reforma LitM-first — fila de produção
- [x] Categoria do Move define a defesa relevante: Físico → Defesa; Especial → Defesa Especial
- [x] Tags/Fraquezas derivadas dos Stats do target entram como modificadores quando relevantes
- [x] Múltiplos targets usam o alvo mais difícil; defesas nunca são somadas
- [x] Accuracy e Base Power ficam como referência, sem bônus/penalidade automático na rolagem ou no dano comprado
- [x] Tipagem modifica o Status de dano depois da rolagem e resistência pode reduzir um resultado fraco a zero
- [x] Prioridade não aumenta dano; prioridade positiva dificulta Reaction e prioridade negativa facilita Reaction
- [x] Recharge e recoil são custos intrínsecos do Move e não consomem Power do sucesso
- [x] Undo de aplicação removido: correções posteriores ficam a cargo das ferramentas normais do LitM, evitando snapshots frágeis em Actors sintéticos
- [x] Burn aplicado no Combat Actor é sincronizado de volta ao Theme Pokémon original
- [x] Challenges Pokémon antigos recebem refresh automático das Threats quando a revisão semântica muda
- [x] Might define a escala ficcional e substitui tiers de consequência derivados de Base Power nos Challenges
- [x] Converter chances secundárias em Raramente / Possivelmente / Frequentemente / Quase sempre / Sempre
- [x] Reestruturar Detailed Spend para intensidade/combinação de efeitos nunca exceder o Power gasto
- [x] Moves dependentes de Speed usam comparação contextual, sem reproduzir fórmula de Base Power
- [x] PP vira metadado de esforço/sustentabilidade e orienta o UX de Burn; sem contador de PP
- [x] Integrar Burn de Tag ao UX Pokémon para esforço extremo usando a regra nativa do LitM (+3 em vez de +1 e Tag riscada após a rolagem)
- [x] Pokémon Roll Side Panel em duas colunas para Quick, Detailed e Reaction Roll, com fallback responsivo
- [x] Compact Pokémon Chat Cards: metadata redundante removida do chat e resolução mais curta
- [x] Suggested Consequences no Detailed Spend, separando frequência narrativa do botão que aplica o efeito mecânico
- [x] Quando um alvo já possui Status negativo passageiro, sugerir narrativamente que ele se recuperou e oferecer remoção explícita do Status
- [x] Tags flutuantes riscadas por Spend permanecem na ficha como queimadas/cinzas e podem ser recuperadas; o X vermelho restaura o estado anterior
- [x] Challenge Pokémon usa FERIDO/WOUND como Limit de dano, deixando derrotado como consequência do Limit atingido
- [x] Pokémon com todos os targets imunes ao tipo do Move não recebe modificador automático de Defesa/Defesa Especial daquele ataque
- [ ] Integrar Sacrifice nativo do LitM como clímax Pokémon, sem ultimate próprio
- [ ] Expandir Reaction Roll com Speed, Tags relevantes e ameaças do Challenge

## Backlog visual
- [ ] Recolher Pokémon com efeito cinematográfico de retorno à Pokébola
- [ ] VFX automático de golpes por moveId via Pokémon Showdown como provider principal, preparado para futuras gerações
- [ ] JB2A, Eskie e outros packs de VFX permanecem apenas opcionais/fallback

## Backlog — Configurações do módulo
- [ ] Tabelas configuráveis pelo mestre: auditar listas relevantes hoje presas no código/JSON e expor nas Configurações do módulo as decisões de design/balanceamento/nomenclatura que façam sentido personalizar, sempre com defaults e “Restaurar padrões”. Incluir Tipo → fase/Limit de Boss, DEF/SDEF/SPD → fase/Limit, frequência narrativa de efeitos, Might → consequência-base, efetividade → ajuste de tier, Tags derivadas de Stats, condições reconhecidas, faixas de esforço/PP, cores/VFX por tipo e sugestões de consequências/efeitos.
- [ ] Boss em Fases: botão no header do Challenge Pokémon; manter o Challenge atual como fase final e gerar uma Fase 1 por DEF/SDEF/SPD ou por obstáculo temático de Tipo quando houver uma proposta ficcional forte. Defaults de nome/Limit devem ser editáveis nas Configurações do módulo.
- [ ] Opção de mundo para rolar a chance percentual original dos efeitos secundários (ex.: Paralisia (10%) → 1d100), mantendo o modo narrativo como padrão; permitir ocultar a rolagem do chat e desativar Dice So Nice/dados 3D separadamente.
- [ ] Fazer uma auditoria completa de regras, automações e comportamentos atualmente fixos para decidir o que deve virar opção configurável do módulo, com defaults sensatos e escopo correto (mundo ou cliente). Revisar especialmente combate (ex.: exigir Rolagem Detalhada ao usar Tag de Golpe), targeting, consequências do Narrador, visibilidade, aplicação automática de efeitos, followers, VFX/áreas, interface e comportamentos padrão.
- [ ] Guia Effects nas Configurações: editar VFX por golpe, testar, restaurar padrão e exportar presets modificados para JSON versionável no Git.
- [ ] Hierarquia de VFX: override do mundo → preset oficial do golpe → preset do tipo → fallback nativo.

## Marco 3 — Pokémon-jogador
- [ ] Validar no Foundry a etapa de Golpes do Pokémon-jogador com seleção de 1–4 golpes
- [ ] Validar Tags de Poder estruturadas de Golpe e identificação pelo VFX
- [ ] Validar botão VFX no card de rolagem com targets congelados
- [ ] Botão no header para reabrir Trainer/Pokémon-jogador no Criador em modo edição
- [ ] Quest dos Themes Pokémon baseada em Nature, relação e evolução
- [ ] Regras e ativação de Mega Evolução, Z-Move, Dynamax, Gigantamax, Terastalização, Reversão Primal e Ultra Burst
- [ ] Pokémon-jogador com 4 Themes fixos: 2 Temas de Perfil + Natureza/Habilidade + Golpes
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
