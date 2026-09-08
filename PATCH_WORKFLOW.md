# Pokémon LITM Tools — Patch Workflow

Este arquivo define o gate obrigatório para qualquer patch gerado para a branch `v0.8.0-dev`.

## Regras obrigatórias

1. Confirmar o HEAD remoto no início e imediatamente antes de entregar o patch.
2. Ler os arquivos no commit exato; contexto de chat não substitui o repositório.
3. O patch deve ser idempotente: se a mudança já estiver aplicada, encerrar com sucesso e sem novo commit.
4. Não criar branches automaticamente.
5. Trabalhar apenas com árvore rastreada limpa; arquivos locais não rastreados de workflow (como apply.cmd/apply.ps1) não contam.
6. Validar blobs/anchors reais antes de transformar. Preferir blocos delimitados por funções a frases genéricas.
7. Preparar todas as transformações em memória antes de escrever.
8. Rodar `node --check` nos JS gerados e `git diff --check`.
9. Validar a lista exata de arquivos alterados antes do commit.
10. Se qualquer validação falhar após escrita, restaurar automaticamente o estado anterior.
11. Se o push falhar, desfazer o commit local criado pelo patch e restaurar o HEAD inicial.
12. Após o push, confirmar que o HEAD remoto é exatamente o commit criado.
13. Depois que o usuário executar apply.cmd, consultar o GitHub antes de pedir qualquer diagnóstico Git ao usuário.
14. Testes funcionais/self-tests são gates; buscas textuais frágeis são apenas auxiliares.
15. “Validado” significa que o payload exato entregue passou pelo gate de transformação, sintaxe, diff, arquivos esperados e simulação de commit/push; não significa apenas inspeção visual do código.
16. O payload JavaScript executado pelo `apply.ps1` só transforma e valida arquivos; ele nunca executa `git add`, `git commit` ou `git push`. O wrapper é a única autoridade para stage/commit/push.
17. O gate deve simular o fluxo real `apply.cmd`/`apply.ps1`: executar o payload, confirmar diff não vazio, stage, `git diff --cached --check`, `node --check`, commit, push e HEAD remoto. O transformador também deve aceitar uma segunda execução como no-op sem alterar arquivos.

## Princípio

Erros de geração devem ser absorvidos antes de chegar ao PowerShell do usuário.
