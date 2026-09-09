# Regras permanentes

- Trabalhar em branch dev; nunca alterar `main` ou tocar produção/Oracle.
- Nunca usar Docker, sudo, deploy, force push, `git reset --hard` ou limpeza destrutiva.
- Não baixar assets em massa; preservar o runtime `storage/`.
- Inspecionar o código e o estado Git antes de alterar; preferir a menor mudança robusta.
- Preservar comportamentos fora do escopo e correções já validadas.
- Revisar o diff completo, checar sintaxe e executar os self-tests/testes locais aplicáveis.
- Nunca declarar pronto sem evidência; distinguir validação local de teste no Foundry.
- Projeto para Foundry 2D, com preparação mínima; 3D fora de escopo.
