# Automação de Navegador — Chrome isolado via CDP

O REA **não** dirige o navegador: ele é um observador passivo via **Chrome
DevTools Protocol (CDP)**. Nós iniciamos um Chrome dedicado com porta de
depuração em loopback e o REA se conecta a ele.

## Iniciar o navegador de investigação

```powershell
$prof = "$env:TEMP\rea-browser-profile"
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList `
  '--remote-debugging-port=9222', `
  "--user-data-dir=`"$prof`"", `
  '--no-first-run', '--no-default-browser-check', `
  'https://app.bovin.com.br/'
```

Regras obrigatórias:

- **Perfil temporário dedicado** (`%TEMP%\rea-browser-profile`) — nunca o
  perfil pessoal. Na primeira execução o diretório é recriado do zero.
- **Porta apenas em loopback** (`127.0.0.1:9222`) — nunca usar
  `--remote-debugging-address=0.0.0.0`.
- Encerrar o Chrome manualmente ao final da investigação (o REA não gerencia
  o ciclo de vida do navegador).

## Validar que o navegador está acessível

```powershell
(Invoke-WebRequest 'http://127.0.0.1:9222/json/version' -UseBasicParsing).Content
```

## Listar alvos e inspecionar (CLI)

```powershell
# 1. Descobrir o ID do alvo (específico de cada instância do navegador)
npx.cmd -y rea-agents@latest list-browser-targets http://127.0.0.1:9222 --json

# 2. Inspecionar a página (DOM, acessibilidade, scripts, rede, console, WS)
npx.cmd -y rea-agents@latest inspect-web-page http://127.0.0.1:9222 <TARGET_ID> `
  --observation-ms 1000 --json
```

Sempre limitar o escopo com `allowed_origins` / `--allowed-origins` para as
origens investigadas.

## Opções de captura do `inspect_web_page`

| Opção | Conteúdo |
| --- | --- |
| (padrão) | Estrutura DOM (sem valores de texto/atributos), scripts, recursos, eventos de rede/console |
| `--include-accessibility-text` | Nomes/descrições de nós de acessibilidade |
| `--include-console-text` | Texto primitivo do console |
| `--include-json-body-shapes` | Formas tipadas dos corpos JSON (sem valores) |
| `--include-websocket-shapes` | Forma dos frames WebSocket |
| `--include-script-sources` | Código-fonte dos scripts capturados |
| `--include-storage-keys` | Nomes de chaves de storage (valores sempre redigidos) |

O resultado é um registro **Evidence** com `evidence_id` rastreável, cobertura
explícita (`complete_within_window`, `attach_limited`, `policy_filtered`) e
lista de limitações — usar sempre como lastro técnico.

## Ferramentas web disponíveis (MCP/CLI)

| Ferramenta | Uso |
| --- | --- |
| `list_browser_targets` | Descobrir páginas abertas no endpoint CDP |
| `inspect_web_page` | Captura estrutural + rede/console/WebSocket |
| `analyze_web_bundle` | Análise estática de scripts (chunks, rotas, endpoints candidatos) sem executar código |
| `observe_web_session` | Janela de observação para ações do usuário (navegação SPA, reloads) |
| `capture_web_screenshot` | PNG do viewport visível |
| `compare_web_captures` / `compare_web_screenshots` | Comparação entre duas capturas |
| `inspect_web_network_capture` | Leitura offline de HAR/SAZ |
| `export_web_scripts` | Exportar scripts capturados para análise estática |
| `capture_browser_scenario` | Cenário com ações (via Playwright embutido no REA) quando a observação passiva não basta |

## Playwright

- O repositório O Gado **já possui** Playwright (`apps/web`, configs de e2e).
  Não foi instalado nada adicional.
- Para investigação passiva, o CDP + REA é suficiente (validado).
- Para cenários com ações (login legítimo, cliques), usar
  `capture_browser_scenario` do próprio REA, que executa ações num browser de
  perfil temporário próprio ou conectado ao CDP — sem precisar de
  Playwright externo.

## Limitações conhecidas

- O CDP **não** expõe atividade anterior ao *attach*: `network.requests` só
  contém requisições feitas depois da conexão. Recarregar a página logo após
  conectar captura o tráfego completo.
- Portas de depuração: desde o Chrome 136, `--remote-debugging-port` é
  ignorado no perfil padrão — por isso o perfil dedicado é obrigatório.
- O REA não executa `Runtime.evaluate`, não navega e não fecha páginas: é
  observação passiva.
- `prior_activity_available` é sempre `false` nos resultados.
- O REA pode limpar emulação de `navigator.platform` de outro cliente ao
  desconectar — usar perfil descartável resolve.

## Segurança e privacidade

- Não usar o perfil pessoal (cookies/sessões pessoais fora do ambiente).
- Não registrar em documentação cookies, tokens, credenciais ou cabeçalhos de
  autorização — o REA já redige cookies/authorization por padrão, mas valores
  em texto de acessibilidade/console podem conter segredos: habilitar essas
  opções somente quando necessário.
- O navegador mantém seus privilégios: ele continua navegando normalmente.
  Não logar, não comprar, não excluir dados em sistemas de terceiros sem
  autorização explícita.
