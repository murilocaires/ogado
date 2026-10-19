import { describe, expect, it } from 'vitest';
import { descreverConflito } from './conflitos';
import type { Conflito } from './engine';
import { aparelho, COMPRA, criarServidor } from './engine.test-support';
import { descreverSync, rotuloSync } from './indicador';
import { sincronizar } from './engine';

describe('descreverSync (seção Sincronização da Conta)', () => {
  it('sem conta, é só neste aparelho', () => {
    expect(descreverSync('desligado', 0, true)).toMatchObject({ tom: 'neutro' });
  });

  it('sincronizado sem pendências', () => {
    expect(descreverSync('sincronizado', 0, true)).toMatchObject({
      tom: 'ok',
      texto: 'Sincronizado',
    });
  });

  it('N pendentes (singular e plural)', () => {
    expect(descreverSync('sincronizado', 1, true).texto).toBe('1 pendente');
    expect(descreverSync('sincronizado', 3, true).texto).toBe('3 pendentes');
  });

  it('erro mantém a contagem', () => {
    expect(descreverSync('erro', 1, true)).toMatchObject({
      tom: 'erro',
      texto: 'Erro ao sincronizar · 1 pendente',
    });
  });
});

describe('rotuloSync (RF-075: indicador global só sem internet)', () => {
  it('online e sincronizado não mostra nada', () => {
    expect(rotuloSync('sincronizado', 0, true)).toBeNull();
  });

  it('online com pendentes, sincronizando ou erro também não mostra pílula', () => {
    expect(rotuloSync('sincronizado', 3, true)).toBeNull();
    expect(rotuloSync('sincronizando', 1, true)).toBeNull();
    expect(rotuloSync('erro', 1, true)).toBeNull();
  });

  it('sem conta não mostra nada, mesmo offline', () => {
    expect(rotuloSync('desligado', 0, true)).toBeNull();
    expect(rotuloSync('desligado', 0, false)).toBeNull();
  });

  it('sem conexão, com ou sem pendências; offline do navegador vale mesmo com status ok', () => {
    expect(rotuloSync('offline', 0, false)?.texto).toBe('Sem conexão');
    expect(rotuloSync('offline', 2, false)?.texto).toBe('Sem conexão · 2 pendentes');
    expect(rotuloSync('offline', 1, true)?.texto).toBe('Sem conexão · 1 pendente');
    expect(rotuloSync('sincronizado', 1, false)).toMatchObject({
      tom: 'offline',
      texto: 'Sem conexão · 1 pendente',
    });
  });
});

describe('descreverConflito (RF-076)', () => {
  it('lote: mostra os dois valores e marca o que difere', async () => {
    const srv = criarServidor();
    const a = aparelho();
    const lote = a.repo.salvarLote(COMPRA);
    await sincronizar({ ...a, api: srv.api, usuarioId: 'u1' });
    const atual = { ...srv.lotes.get(lote.id)!, qtd: '50', version: 2 };
    a.repo.salvarLote({ ...COMPRA, id: lote.id, qtd: '99' });
    const conflito: Conflito = {
      tipo: 'lote',
      id: lote.id,
      motivo: 'alterado',
      acao: 'editar',
      versaoLocal: 2,
      atual,
      detectadoEm: '2026-10-19T10:00:00.000Z',
    };

    const d = descreverConflito(conflito, a.repo.exportar());

    expect(d.titulo).toBe('Este lote foi alterado em outro aparelho');
    expect(d.item).toBe('Lote 1 de compra');
    const qtd = d.linhas.find((l) => l.rotulo === 'Quantidade');
    expect(qtd).toEqual({ rotulo: 'Quantidade', meu: '99', servidor: '50', difere: true });
    expect(d.linhas.find((l) => l.rotulo === 'Categoria')?.difere).toBe(false);
  });

  it('excluído em outro aparelho: o título muda e a situação aparece', () => {
    const a = aparelho();
    const lote = a.repo.salvarLote(COMPRA);
    const conflito: Conflito = {
      tipo: 'lote',
      id: lote.id,
      motivo: 'excluido-no-servidor',
      acao: 'editar',
      versaoLocal: 2,
      atual: {},
      detectadoEm: '2026-10-19T10:00:00.000Z',
    };
    const d = descreverConflito(conflito, a.repo.exportar());
    expect(d.titulo).toBe('Este lote foi excluído em outro aparelho');
    expect(d.servidorExcluido).toBe(true);
    expect(d.linhas[0]).toMatchObject({
      rotulo: 'Situação',
      servidor: 'Excluído em outro aparelho',
    });
  });
});
