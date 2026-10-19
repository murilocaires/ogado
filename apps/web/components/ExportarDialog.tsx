'use client';

import { useState } from 'react';
import type { FormatoExportacao } from '../lib/exportacao/baixar';
import { Dialog } from './Dialog';
import { useToast } from './Toast';

export interface OpcaoConteudo<Id extends string> {
  id: Id;
  rotulo: string;
  /** Quantos registros esta opção exporta (0 = nada a exportar). */
  quantidade: number;
}

interface ExportarDialogProps<Id extends string> {
  titulo: string;
  /** O que exportar (compras, vendas...). Sem opções, só se escolhe o formato. */
  conteudos: readonly OpcaoConteudo<Id>[];
  conteudoInicial: Id;
  /** Gera e baixa o arquivo; devolve a mensagem de sucesso. Falhas viram aviso no diálogo. */
  onExportar: (formato: FormatoExportacao, conteudo: Id) => Promise<string>;
  onClose: () => void;
}

const FORMATOS: { id: FormatoExportacao; rotulo: string; dica: string }[] = [
  { id: 'csv', rotulo: 'CSV', dica: 'Abre direto no Excel (separador ponto e vírgula, vírgula decimal).' },
  { id: 'xlsx', rotulo: 'XLSX', dica: 'Planilha do Excel, com os números como número.' },
];

/** Escolha de formato (e do conteúdo) antes de baixar (RF-041). Funciona offline. */
export function ExportarDialog<Id extends string>({
  titulo,
  conteudos,
  conteudoInicial,
  onExportar,
  onClose,
}: ExportarDialogProps<Id>) {
  const toast = useToast();
  const [formato, setFormato] = useState<FormatoExportacao>('csv');
  const [conteudo, setConteudo] = useState<Id>(conteudoInicial);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');

  const atual = conteudos.find((c) => c.id === conteudo);
  const vazio = !atual || atual.quantidade === 0;
  const dica = FORMATOS.find((f) => f.id === formato)?.dica;

  async function exportar(): Promise<void> {
    setGerando(true);
    setErro('');
    try {
      const mensagem = await onExportar(formato, conteudo);
      toast(mensagem);
      onClose();
    } catch {
      setErro('Não foi possível gerar o arquivo. Tente de novo.');
      setGerando(false);
    }
  }

  return (
    <Dialog titulo={titulo} onClose={onClose} estreito fecharNoFundo focoInicial="[data-formato]">
      {conteudos.length > 1 && (
        <div>
          <div className="th" style={{ marginBottom: 6 }} id="exp-conteudo">
            O que exportar
          </div>
          <div className="seg g" role="group" aria-labelledby="exp-conteudo">
            {conteudos.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={conteudo === c.id}
                onClick={() => setConteudo(c.id)}
              >
                {c.rotulo}
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={conteudos.length > 1 ? { marginTop: 14 } : undefined}>
        <div className="th" style={{ marginBottom: 6 }} id="exp-formato">
          Formato
        </div>
        <div className="seg g" role="group" aria-labelledby="exp-formato">
          {FORMATOS.map((f) => (
            <button
              key={f.id}
              type="button"
              data-formato
              aria-pressed={formato === f.id}
              onClick={() => setFormato(f.id)}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
        <p className="hint" style={{ margin: '8px 0 0' }}>
          {dica}
        </p>
      </div>
      {vazio && (
        <div className="note" role="status" style={{ marginTop: 12 }}>
          Nada para exportar ainda. Cadastre ao menos um registro.
        </div>
      )}
      {erro && (
        <div className="note erro" role="alert" style={{ marginTop: 12 }}>
          {erro}
        </div>
      )}
      <div className="actions">
        <button type="button" className="btn sec" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn"
          disabled={vazio || gerando}
          onClick={() => void exportar()}
        >
          {gerando ? 'Gerando…' : 'Exportar'}
        </button>
      </div>
    </Dialog>
  );
}
