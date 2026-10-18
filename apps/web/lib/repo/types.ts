// Entidades e interface do repositório de dados da web (ADR-0007, seam de dados).
// As telas só falam com `OGadoRepo`. Na E1 a implementação é o localStorage; na E3/E4 troca-se por
// API/IndexedDB sem mexer nas telas. Valores de dinheiro/peso ficam como STRING (pt-BR digitado).
import type { ModoPeso, VarianteLotacaoInicial } from '@ogado/domain';

export type LoteTipo = 'compra' | 'venda';
export type BaseArroba = 'vivo' | 'carcaca';

/** Convenção de sincronização (ADR-0007 §5): id UUID do cliente, version, updatedAt, deletedAt. */
export interface EntityMeta {
  id: string;
  version: number;
  updatedAt: string;
  deletedAt: string | null;
}

export interface LoteEntity extends EntityMeta {
  tipo: LoteTipo;
  /** Número sequencial por tipo (RF-025). */
  numero: number;
  /** Gravada em maiúsculas. */
  categoria: string;
  /** ISO `AAAA-MM-DD`; pode ser vazia. */
  data: string;
  modo: ModoPeso;
  /** Cabeças (modos total e médio). */
  qtd: string;
  /** kg do lote (total) ou kg por cabeça (médio). */
  peso: string;
  /** kg de cada animal (modo individual). */
  pesos: string[];
  /** R$ por @. */
  preco: string;
  /** Só venda (RN-024). */
  base?: BaseArroba;
  /** Só venda (RN-025). */
  aplicarDesconto?: boolean;
  /** Só venda: percentual na tela (`10` = 10%), texto pt-BR. */
  descontoPct?: string;
}

export type LoteSalvar = Omit<LoteEntity, 'id' | 'version' | 'updatedAt' | 'deletedAt'> & {
  id?: string;
};

export const RECRIA_CAMPOS = [
  'area',
  'dias',
  'investimento',
  'rsCabCompra',
  'pesoIni',
  'pesoFin',
  'precoVenda',
  'consumoPct',
  'precoSuplKg',
  'rendCarcaca',
  'imposto',
  'sanidadeCabMes',
  'funcionario',
  'frete',
] as const;

export type RecriaCampo = (typeof RECRIA_CAMPOS)[number];
/** Campos como digitados (percentuais em %, não em fração). */
export type RecriaForm = Record<RecriaCampo, string>;

export interface RecriaEntity extends EntityMeta {
  form: RecriaForm;
  lotacaoInicial: VarianteLotacaoInicial;
}

export interface RecriaAtualizacao {
  form?: Partial<RecriaForm>;
  lotacaoInicial?: VarianteLotacaoInicial;
}

export type PersistenciaStatus = 'ok' | 'indisponivel';

export type RepoSnapshot =
  | { status: 'carregando' }
  | {
      status: 'pronto';
      /** Só os não excluídos, na ordem de criação. */
      lotes: readonly LoteEntity[];
      recria: RecriaEntity;
      /** `indisponivel`: o navegador não deixa gravar; os dados valem só até fechar a aba. */
      persistencia: PersistenciaStatus;
    };

export interface OGadoRepo {
  subscribe(listener: () => void): () => void;
  getSnapshot(): RepoSnapshot;
  getServerSnapshot(): RepoSnapshot;
  salvarLote(lote: LoteSalvar): LoteEntity;
  excluirLote(id: string): void;
  atualizarRecria(atualizacao: RecriaAtualizacao): void;
  /** `padrao` = valores da planilha (ENTRADA_PADRAO); `vazio` = todos os campos em branco. */
  redefinirRecria(modo: 'padrao' | 'vazio'): void;
}
