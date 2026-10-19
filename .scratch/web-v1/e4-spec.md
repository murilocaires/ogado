# E4 · Instalável e offline (mini-spec, 2026-10-19)

**O cliente vê:** botão "Instalar o app" (Chrome/Edge) e instruções no iOS; o app instalado abre em janela própria, abre sem internet depois da primeira visita online, e Compra/Venda e Recria calculam offline com o mesmo resultado de ouro.

**Requisitos:** RF-070, RF-071, RF-072, RF-073 (já atendido: lançar offline grava no aparelho e sobe ao reconectar, pelo motor de sincronização da E3), RNF-012, RNF-016. ADR-0007 §1, §3, §7, §8.

## Decisões
1. **Service worker escrito à mão** (`apps/web/public/sw.js`), sem biblioteca: o escopo é pequeno e evita dependência (ADR-0007 deixou o Serwist "a confirmar"). Só registra em produção (HTTPS).
2. **Estratégias:** `/_next/static/*` e fontes: cache-first (nomes com hash). Navegação (`/painel`, `/negocios`, `/recria`, `/conta`, `/entrar`, `/cadastrar`): rede primeiro com tempo-limite curto e reserva no cache; offline sem a rota em cache cai no HTML do `/painel`. Na instalação do SW, pré-carrega o HTML das rotas do produto e os scripts/estilos que ele cita.
3. **Nunca cacheia `/api/*`** nem qualquer resposta com `Set-Cookie`/não-GET (ADR-0007 §3). Dados vivem só no aparelho (localStorage da E3), escopados à conta.
4. **Sessão offline** (ADR-0007 §7): já tratada (`offline-nao-verificado` usa a identidade do aparelho). Login/cadastro continuam exigindo internet.
5. **Instalar:** captura `beforeinstallprompt`; iOS Safari fora do modo standalone mostra instruções "Compartilhar → Adicionar à Tela de Início". Botão na Conta e no rodapé da lateral.
6. **Manifest:** pt-BR, `display: standalone`, `start_url: /painel`, ícones 192/512/maskable a partir da marca (tokens de cor).

## Fora desta entrega (vira E5/T-14/T-15)
Migração do localStorage para IndexedDB/Dexie e outbox explícita (hoje a "fila" é a diferença de versão entre aparelho e nuvem, suficiente para 1 fazenda/usuário); selo "pendente" por item e contagem; aviso "nova versão disponível"; conflito "manter o meu/usar o do servidor" (RF-076); cota de armazenamento.

## Critérios de aceite
- [ ] Manifest válido com ícones 192/512/maskable; Lighthouse/Chromium reconhece como instalável.
- [ ] e2e em build de produção: visita online, `setOffline(true)`, recarrega e navega pelas 4 telas; a Recria mostra `R$ 102.408,05` (ouro).
- [ ] e2e: lançar lote offline aparece na lista e sobe após `setOffline(false)` (conferir na API).
- [ ] Nenhuma requisição `/api/*` entra no cache do SW (teste inspecionando `caches`).
- [ ] Tela de instruções do iOS acessível por teclado.
