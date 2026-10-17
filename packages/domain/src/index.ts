// Domínio puro (sem I/O). Fórmulas entram em T-02/T-03 (ver ADR-0003 e 0008).
import Decimal from 'decimal.js';

Decimal.set({ precision: 28 });

export { Decimal };
