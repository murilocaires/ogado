# Configuração do Ambiente — REA (Reverse Engineer Anything)

> Data da configuração: **2026-10-20**
> Status: **MCP conectado e validado com operação real** ✅

## Objetivo

Disponibilizar o **REA** (`rea-agents`) dentro do OpenCode para investigar
aplicações web de referência (alvo inicial: `https://app.bovin.com.br/`) e
alimentar a evolução do **O Gado** com descobertas verificáveis.

Referência oficial: <https://github.com/morluto/rea> · <https://rea.tools/>

## Diagnóstico do ambiente (Etapa 1)

| Item | Valor encontrado |
| --- | --- |
| Sistema operacional | Windows 11 Home Single Language (x64), PowerShell 5.1 |
| Node.js | v22.23.2 (**atende** o requisito REA: 22.x ≥ 22.19) |
| npm / npx | 12.2.0 |
| OpenCode | v2.0.21 (`C:\Users\Murilo Caires\AppData\Roaming\npm\opencode.ps1`) |
| REA pré-existente | **Não** instalado para OpenCode (havia registro anterior apenas no Codex) |
| Chrome | Google Chrome 155.0.8059.85 (`C:\Program Files\Google\Chrome\Application\chrome.exe`) |
| Playwright | Já presente no repositório O Gado (`apps/web`, e2e) — **não** instalado globalmente |
| MCPs existentes | Nenhum servidor MCP configurado no OpenCode antes desta configuração |

## Ferramentas instaladas

| Ferramenta | Versão | Forma de instalação |
| --- | --- | --- |
| `rea-agents` (CLI + servidor MCP) | **6.7.0** | Via `npx` (cache em `%LOCALAPPDATA%\npm-cache\_npx`) — **sem** instalação global |
| Skill `reverse-engineer-anything` | v42 (207 tools documentadas) | Instalada automaticamente pelo `rea setup --client opencode` |

**Não foram instalados** (conforme restrição da tarefa): Hopper, Ghidra, IDA,
JADX, Kuna — engines de análise de binários nativos, desnecessárias para
engenharia reversa web.

## Arquivos de configuração modificados

| Arquivo | Mudança | Backup |
| --- | --- | --- |
| `%USERPROFILE%\.config\opencode\opencode.json` | Adicionada a entrada MCP `rea` + `environment` + `timeout` | `opencode.json.rea.backup` (gerado pelo REA) e `backup-20261020-125022\opencode.json.bak` |
| `%USERPROFILE%\.config\opencode\skills\` | Skill `reverse-engineer-anything` instalada | — |
| `%LOCALAPPDATA%\npm-cache\_npx\a1722018f28f9df2` | **Removido e reinstalado** (cache corrompido — ver "Problemas encontrados") | é cache, regenerável |

Nenhum arquivo do repositório O Gado foi modificado.

## Comandos de instalação executados

```powershell
# 1. Plano somente-leitura (revisão antes de qualquer escrita)
npx.cmd -y rea-agents@latest setup --client opencode --dry-run --json

# 2. Aplicação aprovada (escopo explícito = OpenCode; sem Hopper)
npx.cmd -y rea-agents@latest setup --client opencode --yes --json

# 3. Diagnóstico oficial
npx.cmd -y rea-agents@latest doctor --client opencode --skill
```

O registro escrito pelo setup ficou com o comando:

```text
cmd.exe /d /c npx -y rea-agents@6.7.0 mcp
```

O `rea setup` preserva entradas não relacionadas e cria backups
(`*.rea.backup`) antes de editar qualquer configuração.

## Como atualizar o REA

```powershell
npx.cmd -y rea-agents@latest setup --client opencode --dry-run --json   # revisar plano
npx.cmd -y rea-agents@latest setup --client opencode --yes --json       # aplicar
opencode    # reiniciar o OpenCode para recarregar o MCP
```

O registro fica fixado na versão exata (`rea-agents@6.7.0`). Ao aprovar um
setup mais novo, o REA atualiza esse pin automaticamente.

## Problemas encontrados e resolvidos

1. **Cache do npx corrompido** — execuções paralelas de `npx` corromperam o
   pacote (`ERR_MODULE_NOT_FOUND: @jridgewell/resolve-uri/dist/resolve-uri.mjs`),
   fazendo o servidor MCP morrer no arranque e o OpenCode reportar
   `Request timed out`.
   **Solução:** remover a pasta de cache corrompida em
   `%LOCALAPPDATA%\npm-cache\_npx\` e reexecutar o comando uma única vez
   (sequencialmente) para recriar o cache.
2. **Timeout do MCP no OpenCode** — o timeout padrão por servidor é **5 s**,
   enquanto o REA leva ~17 s para iniciar via `npx`. Solução em
   [tools-and-mcp.md](./tools-and-mcp.md).
3. **Formato de configuração** — no formato V1 do OpenCode, `timeout` deve ser
   inteiro (ms). A forma V2 (`mcp.servers`) aceita o objeto
   `{startup, catalog, execution}` e foi a adotada.

## Como verificar que tudo continua funcionando

```powershell
opencode mcp list                 # esperado: ✓ rea  connected
npx.cmd -y rea-agents@latest doctor --client opencode --skill
```

> `doctor` sempre reportará `environment_healthy: false` enquanto as engines
> nativas (Hopper/Ghidra/IDA/JADX/Kuna) não existirem. Isso é **esperado e
> intencional** — o escopo web (`scope.mode: explicit`, `healthy: true`) é o
> que importa.
