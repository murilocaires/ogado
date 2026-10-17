---
name: traceability
description: Mantém a matriz de rastreabilidade leve requisito → ticket → teste → código em docs/sdd/traceability.md. Use ao fechar tickets e antes de revisar.
---

# Rastreabilidade (o "grafo" mínimo)

`docs/sdd/traceability.md` é uma tabela: `ID | Requisito | Ticket | Teste(s) | Código | Status`.

- Todo teste inclui o ID no nome (`RN-012`, `RF-031`). Para atualizar, rode `node scripts/trace-check.mjs`: ele varre testes por IDs e aponta (a) requisitos sem teste, (b) testes com ID inexistente.
- Requisito sem teste não pode ficar "Concluído". Teste sem requisito = escopo extra: justifique ou remova.
- Se a spec mudar, marque os testes afetados como "revisar" antes de mexer no código.
