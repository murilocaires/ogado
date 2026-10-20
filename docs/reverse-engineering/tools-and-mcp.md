# Ferramentas e MCP — REA no OpenCode

## Registro MCP

Registrado pelo `rea setup --client opencode` em
`%USERPROFILE%\.config\opencode\opencode.json` (configuração **global** do
OpenCode — vale para todos os projetos):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "openai/gpt-6-astra",
  "mcp": {
    "servers": {
      "rea": {
        "type": "local",
        "command": [
          "cmd.exe", "/d", "/c",
          "npx", "-y", "rea-agents@6.7.0", "mcp"
        ],
        "environment": {
          "REA_MCP_INPUT_SCHEMA_PROFILE": "compact",
          "REA_MCP_OUTPUT_SCHEMA_PROFILE": "off"
        },
        "timeout": {
          "startup": 60000,
          "catalog": 120000,
          "execution": 600000
        }
      }
    }
  }
}
```

### Por que cada ajuste existe

| Ajuste | Motivo |
| --- | --- |
| Forma **V2** (`mcp.servers`) | O `rea setup` escreve o formato V1 (`mcp.rea`); no V1 o `timeout` só aceita inteiro e não foi aplicado. A própria documentação do REA reconhece a tabela nativa V2. |
| `REA_MCP_INPUT_SCHEMA_PROFILE=compact` | Reduz o catálogo de tools anunciadas de **3,15 MB → 219 KB** (‑93%). A validação canônica do REA permanece completa. |
| `REA_MCP_OUTPUT_SCHEMA_PROFILE=off` | Remove os *output schemas* anunciados (mesma validação continua valendo no servidor). |
| `timeout: 600000` | O padrão do OpenCode é **5000 ms**; o startup do REA via `npx` mede ~17 s e uma análise web real pode levar minutos. |
| `environment` e `timeout` | São preservados automaticamente pelo `rea setup` em atualizações futuras. |

## Verificar se o MCP está funcionando

```powershell
opencode mcp list
# esperado:  ✓ rea  connected
```

Estados possíveis: `pending` (ainda conectando), `connected`, `failed:
Request timed out` (ver "Problemas conhecidos").

Dentro de uma sessão do OpenCode, o servidor expõe **207 ferramentas** sob o
namespace `rea` (ex.: `rea.list_browser_targets`, `rea.inspect_web_page`).
A sessão OpenCode precisa ser (re)iniciada após qualquer mudança no registro.

## Uso do REA no OpenCode

- **Via agente (MCP)**: peça em linguagem natural, por exemplo:
  "inspecione a página X no navegador de investigação e resuma a estrutura".
  O agente chama as ferramentas `rea.*` automaticamente.
- **Via terminal (CLI)**: mesma implementação, útil para diagnóstico rápido.

```powershell
npx.cmd -y rea-agents@latest doctor                      # auditoria completa
npx.cmd -y rea-agents@latest list-browser-targets http://127.0.0.1:9222 --json
npx.cmd -y rea-agents@latest inspect-web-page http://127.0.0.1:9222 <TARGET_ID> --observation-ms 1000 --json
```

## Skill (instruções de workflow)

Instalada pelo setup e verificada por `doctor --skill` como `state: aligned`.
Ela instrui o agente sobre quando e como usar cada ferramenta do REA. Como o
OpenCode descobre skills do diretório pessoal, a skill fica disponível em
novas sessões.

## Engines de análise **não** instaladas (intencional)

Hopper, Ghidra, IDA, JADX e Kuna aparecem como `not_configured` no `doctor`.
São engines para binários nativos/.NET/Android — irrelevantes para o objetivo
web. `environment_healthy: false` é, portanto, **esperado**; o indicador
correto para o nosso caso é `healthy: true` no escopo `--client opencode`.

## Problemas conhecidos e correções

| Sintoma | Causa | Correção |
| --- | --- | --- |
| `✗ rea failed: Request timed out` | Startup > timeout padrão (5 s) ou cache do npx corrompido | Confirmar `timeout` na config; apagar `%LOCALAPPDATA%\npm-cache\_npx\*` e reexecutar o comando REA uma vez |
| `ERR_MODULE_NOT_FOUND` ao iniciar o MCP | Instalações `npx` **paralelas** corrompendo o cache | Sempre rodar comandos `rea-agents` sequencialmente; apagar a pasta de cache corrompida |
| `No MCP servers configured` | JSON inválido é descartado silenciosamente pelo OpenCode | Validar o `opencode.json` contra o schema `https://opencode.ai/config.json` (ex.: `timeout` objeto só existe no formato V2) |
| Ferramentas ausentes numa sessão já aberta | Sessão iniciada antes da mudança de config | Reiniciar o OpenCode |

## Rollback / remoção

```powershell
# Remover apenas o REA (preserva outros MCPs, skills e navegadores)
npx.cmd -y rea-agents@latest uninstall
```

Restaurar o backup manual também é possível:
`%USERPROFILE%\.config\opencode\opencode.json.rea.backup`.

## Relação com o Claude Code do repositório O Gado

O repositório usa `.claude/settings.json`, hooks e skills, mas **não** tem
nenhum MCP configurado no projeto. O registro do REA é global do OpenCode e
não interfere no Claude Code nem nos hooks de proteção do repositório.
