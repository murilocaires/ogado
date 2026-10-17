---
name: zod-contracts
description: Define contratos Zod compartilhados (entrada/saída da API, formulários e domínio) com um único schema como fonte de tipos. Use ao criar/alterar endpoints ou formulários.
---

# Contratos com Zod

- Um schema por conceito em `packages/contracts`; tipos TS via `z.infer`. Fastify valida com `fastify-type-provider-zod`; o Next reutiliza o mesmo schema em formulários.
- Entrada numérica pt-BR (`2.050,00`) entra como string e é normalizada por um *preprocess* único (`parseDecimalPtBr`), nunca espalhado.
- `z.coerce` só nas bordas; dentro do domínio os tipos já são estritos. Valores monetários/peso: string decimal ou `Decimal`, nunca `float` serializado.
- Erros de validação retornam 422 com `{ campo, codigo, mensagem }` em português; nunca devolva o erro cru do Zod.
- Todo schema novo ganha teste de caso válido, inválido e limite. Cite o ID do requisito.
