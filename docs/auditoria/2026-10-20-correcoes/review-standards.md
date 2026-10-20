# Revisão Standards — WIP sobre 912e38f

Leitura de `git diff HEAD` e arquivos novos, confrontada com CLAUDE.md, constituição, glossário, spec de correções e ADRs 0007/0010/0015/0016. Nenhum teste ou serviço foi iniciado nesta revisão. Os resultados de execução pertencem ao gate principal.

**P1 condicional — migração pode apagar legado não importado.** Em `apps/web/lib/repo/durable-repo.ts:121`, falhas de leitura de localStorage são ignoradas; mesmo assim `migrado=true` é gravado na linha 143. Na próxima carga, restaurado o acesso, a importação é pulada, mas as chaves antigas são removidas nas linhas 150–151. Se o envelope não foi lido na primeira carga, também não há backup. Esse caminho contraria a preservação exigida no critério 2/RNF-017. Avisado imediatamente à coordenação; exige regressão de leitura temporariamente bloqueada seguida de recarga. Condicionar conclusão/remoção à importação ou backup confirmado.

**Risco concreto de identidade — RNF-014/RF-078.** A identidade é copiada para IndexedDB/meta (`durable-repo.ts:140`), porém `browserIdentityStore` continua consultando exclusivamente localStorage e converte erro em ausência (`session-controller.ts:270`). Com dados persistidos e chave bloqueada/perdida, o login de outra conta pode não detectar divergência. Não houve reprodução nesta revisão. O proprietário do banco precisa ser consultável pelo mesmo armazenamento ou a operação deve falhar fechada.

**P2 — cobertura parcial de desempenho.** `scripts/performance-check.ts:62` mede cálculo e seleção; não mede API p95 <300 ms exigida em RNF-002. A limitação é declarada corretamente na política de cobertura. Manter o requisito como parcialmente validado até carga HTTP representativa.

**Risco de compatibilidade.** `engine.ts:186` serializa abas somente quando Web Locks está disponível; o fallback executa diretamente. Delimitar navegadores suportados ou validar exclusão equivalente antes de prometer essa garantia universal.

Os repositórios revisados escopam consultas de negócio por fazenda; `withSyncWrite` mantém lock até commit e calcula timestamp monotônico dentro da transação. A migração SQL é aditiva. CI possui comandos reais, exceções de rastreabilidade são explícitas, e a troca para IndexedDB acompanha atualização legal/versão dos termos. Não identifiquei `any`, fórmula nova ou dependência de I/O no domínio nessas alterações. A corrida de sincronização entre identidades foi detectada por outra frente e está em correção; não é contabilizada como achado novo aqui.

**Encaminhamento:** migração e proprietário foram atribuídos, respectivamente, a `fix_persistence` e `fix_scenarios`. As correções estão aguardando GREEN; a coordenação atualizará o parecer final com os resultados integrados. Nenhuma nova suíte foi iniciada por esta revisão.
