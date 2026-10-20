import { readFileSync, writeFileSync } from 'node:fs';
const file = 'docs/sdd/traceability.md';
const lines = readFileSync(file, 'utf8').split('\n');
let changed = 0;
const result = lines.map(line => {
  if (line.startsWith('| RF-074 (reconexão')) {
    changed++;
    return '| RF-074 (reconexão/reenvio idempotente), RF-076 (resolução automática com histórico), RF-079 (quarentena/atenção), RF-080 (fila conserva dados com sessão expirada), RNF-017 | T-14 + correções 20/10 | `apps/web/lib/sync/{engine-robusto,engine-incremental,engine,data-client}.test.ts`, `apps/web/components/SyncUi.test.tsx`, `apps/web/e2e/{e1-multiaba,e5-sync-robusta}.spec.ts`, `apps/api/test/dados-incremental.test.ts` e harness IndexedDB real no parecer de correções | `apps/web/lib/repo/{durable-repo,indexed-db}.ts`, `lib/sync/{engine,data-client,storage}.ts`, `apps/api/src/repositories/{sync-write,lote-repository,cenario-repository}.ts` | IndexedDB/outbox transacional, cursor estável e checkpoint durável; conflitos seguem `docs/sincronizacao-automatica.md`. RNF-013 em telefone a frio segue pendente |';
  }
  if (line.startsWith('| RF-073 (lançar offline')) {
    changed++;
    return '| RF-073 (lançar offline e subir ao reconectar) | T-14 + correções 20/10 | `apps/web/e2e/{e4-offline,e1-multiaba}.spec.ts`, regressões de cota/migração/duas abas no parecer de correções | `lib/repo/{durable-repo,indexed-db}.ts`, `lib/sync/engine.ts`, `components/SyncProvider.tsx` | Gravação e outbox atômicas; sucesso da tela depende do commit; fila preservada em recarga |';
  }
  return line.replace('Recria R$ 102.408,05 offline', 'Recria R$ 103.307,60 offline na variante atual da UI')
    .replace('provam o valor de ouro R$ 102.408,05', 'distinguem o ouro fracionário R$ 102.408,05 da variante atual da UI R$ 103.307,60')
    .replace('Implementado, dados só no localStorage (', 'Entrega histórica sobre localStorage; implementação atual em IndexedDB (ADR-0016). Na entrega original, (');
});
if (changed !== 2) throw new Error('Linhas de rastreabilidade não encontradas');
writeFileSync(file, result.join('\n'));
