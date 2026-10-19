// Entidades e interface do repositório de dados da web (ADR-0007, seam de dados).
// As telas só falam com `OGadoRepo`. Na E1 a implementação é o localStorage; na E3/E4 troca-se por
// API/IndexedDB sem mexer nas telas. Valores de dinheiro/peso ficam como STRING (pt-BR digitado).
import type { ModoPeso, VarianteFaturamentoBruto, VarianteLotacaoInicial } from '@ogado/domain';

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
  /** Só venda: kg descontados por cabeça (`10` = 10 kg/cab.), texto pt-BR (ADR-0013). */
  descontoKg?: string;
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

/** Campos `Valor` do resultado do domínio guardados no snapshot do cenário (ADR-0003, RN-023). */
export const CENARIO_RESULTADO_CAMPOS = [
  'cabecas',
  'lotacaoTotalUA',
  'lotacaoHaInicial',
  'pesoMedio',
  'lotacaoFinal',
  'arrobasProduzidas',
  'consumoKgDia',
  'arrobasCarcacaCab',
  'vendaCab',
  'custoTotal',
  'faturamentoBruto',
  'faturamentoLiquido',
  'totalEmCaixa',
  'liquidoMes',
  'liquidoHa',
  'gmdImplicito',
] as const;

export type CenarioResultadoCampo = (typeof CENARIO_RESULTADO_CAMPOS)[number];

/** Resultado do domínio como string decimal SEM arredondar; `null` = indefinido (RN-022). */
export type CenarioResultado = Record<CenarioResultadoCampo, string | null> & {
  custos: { id: string; nome: string; valor: string | null }[];
};

/** Parâmetros efetivamente usados no cálculo (RN-021), como string decimal. */
export interface CenarioParametros {
  arrobaVivoKg: string;
  arrobaCarcacaKg: string;
  uaKg: string;
  lotacaoFixaHa: string;
}

export interface CenarioVariantes {
  lotacaoInicial: VarianteLotacaoInicial;
  faturamentoBruto: VarianteFaturamentoBruto;
}

/**
 * Cenário salvo (RF-032, RN-023): SNAPSHOT imutável das entradas, variantes, parâmetros e do
 * resultado. Mudar o simulador ou a configuração depois não altera o que foi salvo.
 */
export interface CenarioEntity extends EntityMeta {
  /** Nome livre, até 80 caracteres. */
  nome: string;
  /** Data de criação (ISO). */
  criadoEm: string;
  form: RecriaForm;
  variantes: CenarioVariantes;
  parametros: CenarioParametros;
  resultado: CenarioResultado;
}

export type CenarioSalvar = Pick<
  CenarioEntity,
  'nome' | 'form' | 'variantes' | 'parametros' | 'resultado'
>;

export const CENARIO_NOME_MAX = 80;

export type PersistenciaStatus = 'ok' | 'indisponivel';

export type RepoSnapshot =
  | { status: 'carregando' }
  | {
      status: 'pronto';
      /** Só os não excluídos, na ordem de criação. */
      lotes: readonly LoteEntity[];
      recria: RecriaEntity;
      /** Cenários salvos não excluídos, na ordem de criação (RF-032). */
      cenarios: readonly CenarioEntity[];
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
  /** Deixa todos os campos em branco (ADR-0014: não há "restaurar padrões"). */
  limparRecria(): void;
  /** Guarda o snapshot de um cenário (RF-032). Nome vazio vira "Cenário N". */
  salvarCenario(cenario: CenarioSalvar): CenarioEntity;
  /** Altera só o nome (o snapshot nunca muda). */
  renomearCenario(id: string, nome: string): void;
  /** Copia o snapshot como "<nome> (cópia)"; `null` se o cenário não existe. */
  duplicarCenario(id: string): CenarioEntity | null;
  excluirCenario(id: string): void;
}

/** Tudo o que o aparelho guarda, inclusive excluídos (tombstones), para a sincronização (E3). */
export interface DadosCompletos {
  lotes: LoteEntity[];
  recria: RecriaEntity;
  cenarios: CenarioEntity[];
}

/** Repositório local que também deixa o motor de sincronização ler e aplicar dados da nuvem. */
export interface SyncableRepo extends OGadoRepo {
  exportar(): DadosCompletos;
  /** Substitui por `id` (ou acrescenta) o que veio da nuvem; não mexe no resto. */
  aplicar(mudanca: {
    lotes?: LoteEntity[];
    cenarios?: CenarioEntity[];
    recria?: RecriaEntity;
  }): void;
  /** Apaga os dados do aparelho (logout confirmado, RF-078). */
  limpar(): void;
}
