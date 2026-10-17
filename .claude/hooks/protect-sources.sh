#!/bin/bash
# Bloqueia edição de fontes de verdade imutáveis (planilhas e design de referência).
INPUT=$(cat)
F=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
case "$F" in
  */references/planilhas/*|*/references/design/*|*/references/calculo/calc.js)
    echo "BLOCKED: references/ é somente leitura (fonte de verdade). Mude a spec e crie um ADR se precisar divergir." >&2; exit 2;;
esac
exit 0
