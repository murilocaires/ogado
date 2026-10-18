// Dicionário de ajuda contextual (RF-052): nome, explicação simples e "Como é calculado".
// Textos do protótipo; os de venda seguem a regra revisada (RN-024/RN-025, ADR-0012).
export interface InfoItem {
  nome: string;
  texto: string;
  formula: string;
}

const tabela = {
  saldo: [
    'Saldo',
    'Diferença entre tudo o que você vendeu e tudo o que comprou. Positivo: vendeu mais do que comprou. Negativo: comprou mais do que vendeu.',
    'Total vendido − total comprado',
  ],
  comprado: [
    'Comprado',
    'Soma do valor de todos os lotes de compra.',
    'Cada lote = (kg ÷ 30) × preço da arroba',
  ],
  vendido: [
    'Vendido',
    'Soma do valor de todos os lotes de venda, já considerando o desconto de peso quando houver.',
    'Cada lote = (kg × (1 − desconto%) ÷ kg por @) × preço da arroba',
  ],
  arrC: ['Arrobas (compra)', 'Peso total do lote convertido em arrobas de peso vivo.', '@ = kg ÷ 30'],
  arrV: [
    'Arrobas (venda)',
    'Peso do lote já sem o desconto (se houver), dividido pelos kg de uma arroba: 30 kg no peso vivo ou 15 kg na carcaça.',
    '@ = kg × (1 − desconto%) ÷ (30 ou 15)',
  ],
  totalLote: [
    'Total do lote',
    'Valor do lote: arrobas multiplicadas pelo preço da arroba.',
    'Total = @ × preço da arroba',
  ],
  porCab: [
    'Valor por cabeça',
    'Quanto, em média, cada animal do lote vale.',
    'R$/cab. = total ÷ cabeças',
  ],
  cabLote: [
    'Cabeças',
    'No peso total ou médio, é a quantidade informada. No peso individual, é o número de pesos que você digitou.',
    '',
  ],
  recLiq: [
    'Faturamento líquido',
    'O que sobra depois de vender os animais e descontar todos os custos e o dinheiro investido na compra.',
    'Bruto − custo operacional − investimento',
  ],
  mes: [
    'Líquido por mês',
    'Resultado líquido dividido pelos meses de recria, para comparar lotes com durações diferentes.',
    'Líquido ÷ (dias ÷ 30)',
  ],
  ha: [
    'Líquido por hectare',
    'Resultado líquido por hectare da área pastável. Mostra o quanto cada hectare rendeu.',
    'Líquido ÷ área pastável',
  ],
  caixa: [
    'Total em caixa',
    'Quanto volta para o caixa no fim: o investimento recuperado mais o resultado líquido.',
    'Investimento + faturamento líquido',
  ],
  custo: [
    'Custo operacional',
    'Tudo o que se gasta para manter o lote durante a recria, sem contar a compra dos animais.',
    'Suplemento + sanidade + imposto + frete + funcionário',
  ],
  supl: [
    'Suplemento',
    'Gasto com o proteinado durante toda a recria.',
    'Consumo por cabeça/dia × R$/kg × cabeças × dias',
  ],
  san: [
    'Sanidade',
    'Gasto com vacinas e medicamentos, cobrado por cabeça a cada mês.',
    '(dias ÷ 30) × cabeças × R$/cab./mês',
  ],
  imp: [
    'Imposto',
    'Imposto sobre a venda, calculado sobre o valor de cada animal na carcaça.',
    'Venda por cabeça × % de imposto × cabeças',
  ],
  frete: ['Transporte (frete)', 'Valor informado para o transporte do lote.', ''],
  func: ['Funcionário', 'Valor informado para a mão de obra durante a recria.', ''],
  bruto: [
    'Faturamento bruto',
    'O que você recebe ao vender todos os animais, em arrobas de peso vivo.',
    '@ produzidas × preço de venda',
  ],
  invest: ['Investimento', 'Valor informado, usado para comprar os animais.', ''],
  cabecas: [
    'Cabeças',
    'Quantos animais o investimento compra. O cálculo usa o número exato, sem arredondar.',
    'Investimento ÷ R$ por cabeça',
  ],
  lotTot: [
    'Lotação total',
    'Peso do lote em unidades animal (1 UA = 450 kg).',
    'Cabeças × peso inicial ÷ 450',
  ],
  lotIni: [
    'Lotação inicial',
    'Quantas UA há por hectare na entrada, sobre 80 ha de referência ou sobre a área informada, conforme sua escolha.',
    'Lotação total ÷ área de base',
  ],
  lotFin: [
    'Lotação final',
    'UA por hectare na saída, usando o peso médio do lote e a área pastável.',
    'Cabeças × peso médio ÷ 450 ÷ área',
  ],
  pesoMed: [
    'Peso médio',
    'Média entre o peso de entrada e o de saída.',
    '(peso inicial + peso final) ÷ 2',
  ],
  gmd: [
    'GMD implícito',
    'Ganho médio diário que o lote precisa ter para ir do peso inicial ao final no prazo.',
    '(peso final − inicial) ÷ dias',
  ],
  arrVivo: [
    '@ na venda (peso vivo)',
    'Total de arrobas vivas do lote na saída.',
    'Peso final ÷ 30 × cabeças',
  ],
  arrCarc: [
    '@ de carcaça por cabeça',
    'Arrobas de carcaça de cada animal, pelo rendimento informado.',
    'Peso final × rendimento ÷ 15',
  ],
  consumo: [
    'Consumo por cabeça',
    'Quanto de suplemento cada animal come por dia.',
    'Peso médio × % de consumo',
  ],
  vendaCab: [
    'Venda por cabeça',
    'Valor de cada animal vendido pela carcaça. É a base do imposto.',
    '@ de carcaça × preço de venda',
  ],
} as const satisfies Record<string, readonly [string, string, string]>;

export type InfoKey = keyof typeof tabela;

export const INFO: Record<InfoKey, InfoItem> = Object.fromEntries(
  Object.entries(tabela).map(([chave, [nome, texto, formula]]) => [
    chave,
    { nome, texto, formula },
  ]),
) as Record<InfoKey, InfoItem>;
