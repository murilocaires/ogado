---
name: prisma-migrations
description: Modela o banco com Prisma/PostgreSQL e aplica migrações seguras, multi-tenant e auditáveis. Use ao alterar schema.prisma ou criar seeds.
---

# Prisma + PostgreSQL

- Toda tabela de negócio tem `fazendaId` (FK, índice composto com as colunas de consulta mais comuns) e `criadoEm/atualizadoEm`; remoção lógica (`excluidoEm`) onde houver histórico financeiro.
- Dinheiro `Decimal(14,2)`; pesos `Decimal(10,3)`; taxas `Decimal(7,4)`. Nunca `Float`.
- Migração aditiva por padrão (`prisma migrate dev` local, `migrate deploy` em CI). Destrutiva = ADR + aprovação humana + plano de rollback.
- Um PR = uma migração coesa; nomeie com intenção (`add_lote_pesagem_individual`). Revise o SQL gerado.
- Seeds determinísticas: o cenário de ouro das planilhas (compras/vendas/recria padrão) fica em `prisma/seed.ts` para testes e demo.
- Testes de integração rodam contra Postgres real e isolam dados por transação ou schema.
