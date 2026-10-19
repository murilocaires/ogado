import { describe, expect, it } from 'vitest';
import { calcularVenda } from '@ogado/domain';
import {
  DESCONTO_PADRAO_KG,
  errosDoRascunho,
  novoRascunho,
  rascunhoParaDominio,
  validarRascunho,
} from './lote-draft';

function venda(extra: Partial<ReturnType<typeof novoRascunho>> = {}) {
  return {
    ...novoRascunho('venda', 1, '2026-10-19'),
    categoria: 'NOVILHAS',
    aplicarDesconto: true,
    qtd: '16',
    pesoTotal: '2920',
    preco: '290',
    ...extra,
  };
}

describe('RN-025/ADR-0013 rascunho do lote: desconto em kg por cabeça', () => {
  it('o padrão é 10 kg por cabeça e liga sozinho para categoria feminina', () => {
    expect(DESCONTO_PADRAO_KG).toBe('10');
    const d = novoRascunho('venda', 1, '2026-10-19');
    expect(d.descontoKg).toBe('10');
    expect(d.aplicarDesconto).toBe(false); // BOIS
  });

  it('a pré-visualização usa kg/cab.: 16 cab., 2.920 kg, carcaça → 184 @', () => {
    const linha = calcularVenda(rascunhoParaDominio(venda({ base: 'carcaca' })));
    expect(linha.arrobas.toString()).toBe('184');
    expect(linha.total.toString()).toBe('53360');
  });

  it('desconto editado (12,5 kg/cab.) e desligado (0 kg)', () => {
    const editado = calcularVenda(rascunhoParaDominio(venda({ descontoKg: '12,5' })));
    expect(editado.kgLiquido.toString()).toBe('2720'); // 2920 − 16×12,5
    const desligado = calcularVenda(rascunhoParaDominio(venda({ aplicarDesconto: false })));
    expect(desligado.kgLiquido.toString()).toBe('2920');
  });

  it('valida: vazio, texto, negativo e acima da capacidade da coluna são erros', () => {
    for (const ruim of ['', 'abc', '-5', '100000']) {
      expect(errosDoRascunho(venda({ descontoKg: ruim })).map((e) => e.campo)).toContain('desconto');
    }
    expect(errosDoRascunho(venda({ descontoKg: '0' }))).toEqual([]);
    expect(errosDoRascunho(venda({ aplicarDesconto: false, descontoKg: '' }))).toEqual([]);
  });

  it('salva descontoKg só quando o desconto está ligado', () => {
    const ligado = validarRascunho(venda());
    expect(ligado.ok && ligado.lote.descontoKg).toBe('10');
    const desligado = validarRascunho(venda({ aplicarDesconto: false }));
    expect(desligado.ok && desligado.lote.descontoKg).toBe('');
  });
});
