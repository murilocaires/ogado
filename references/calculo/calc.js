/* O Gado — motor de cálculo v1
   Reproduz, célula a célula, as planilhas:
   - "Compra e Venda de Gado" (Planilha1)
   - "Cálculos Recria 11-07-2026" (Planilha1)
   Os comentários [A1] citam a célula de origem. */
(function (g) {
  'use strict';

  // ---------- entrada / saída em pt-BR ----------
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (v === null || v === undefined) return 0;
    var s = String(v).trim().replace(/[R$\s%]/g, '');
    if (s === '') return 0;
    if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  function div(a, b) { return b ? a / b : 0; }
  function fmt(n, d) {
    d = d === undefined ? 2 : d;
    return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function brl(n, d) { return 'R$ ' + fmt(n, d === undefined ? 2 : d); }

  // ---------- Compra e Venda ----------
  // Constantes que na planilha estão "embutidas" nas fórmulas
  var CV_PARAMS = { arrobaCompraKg: 30, arrobaVendaKg: 15, descontoVendaKgCab: 10 };

  // Peso do lote: informado (total), por cabeça (médio) ou animal a animal (individual).
  // No modo individual a quantidade é o nº de animais pesados e o peso é a soma deles.
  function pesoLote(r) {
    if (r.modo === 'individual') {
      var ps = (r.pesos || []).map(num).filter(function (x) { return x > 0; });
      return { qtd: ps.length, kg: ps.reduce(function (s, x) { return s + x; }, 0) };
    }
    var qtd = num(r.qtd), peso = num(r.peso);
    return { qtd: qtd, kg: r.modo === 'medio' ? qtd * peso : peso };
  }
  function compraLinha(r, p) {
    var pl = pesoLote(r), qtd = pl.qtd;
    var kg = pl.kg;                                         // [E5] =D5*210
    var arr = kg / p.arrobaCompraKg;                        // [F4] =E4/30
    var total = arr * num(r.preco);                         // [H4] =F4*G4
    return { qtd: qtd, kg: kg, arrobas: arr, preco: num(r.preco), total: total, porCab: div(total, qtd) }; // [I5] =H5/D5
  }
  function vendaLinha(r, p) {
    var pl = pesoLote(r), qtd = pl.qtd;
    var kg = pl.kg;
    var arr = (kg - qtd * p.descontoVendaKgCab) / p.arrobaVendaKg; // [F12] =(E12-D12*10)/15
    var total = arr * num(r.preco);                          // [H11] =F11*G11
    return { qtd: qtd, kg: kg, arrobas: arr, preco: num(r.preco), total: total, porCab: div(total, qtd) };
  }
  function compraVenda(st, params) {
    var p = Object.assign({}, CV_PARAMS, params || {});
    var compras = (st.compras || []).map(function (r) { return compraLinha(r, p); });
    var vendas = (st.vendas || []).map(function (r) { return vendaLinha(r, p); });
    var sum = function (a, k) { return a.reduce(function (s, x) { return s + x[k]; }, 0); };
    var totalCompras = sum(compras, 'total');               // [H8]
    var totalVendas = sum(vendas, 'total');                 // [H15]
    return {
      compras: compras, vendas: vendas,
      totalCompras: totalCompras, totalVendas: totalVendas,
      saldo: totalVendas - totalCompras,                    // [H19] =H15-H8
      cabCompra: sum(compras, 'qtd'), cabVenda: sum(vendas, 'qtd'),
      arrCompra: sum(compras, 'arrobas'), arrVenda: sum(vendas, 'arrobas'),
      params: p
    };
  }

  // ---------- Recria ----------
  var RECRIA_DEFAULTS = {
    area: 102,            // B17 ha
    dias: 270,            // B18
    investimento: 122534.8, // B19
    rsCabCompra: 2050,    // B20
    pesoIni: 188,         // B22
    pesoFin: 420,         // B25
    precoVenda: 325,      // B28  (R$ por @ — o rótulo da planilha diz "R$/cab")
    consumoPct: 0.003,    // E23  consumo de proteinado, % do peso vivo
    precoSuplKg: 2,       // F23  R$/kg
    rendCarcaca: 0.52,    // J19
    imposto: 0.015,       // J22
    sanidadeCabMes: 2.5,  // M19
    funcionario: 9000,    // N23 (e B37)
    frete: 3000,          // B36
    areaLotacaoInicial: 'fixa80' // B24 divide por 80 ha fixos; 'area' usa a área pastável
  };
  var UA_KG = 450, ARROBA_VIVO = 30, ARROBA_CARCACA = 15;

  function recria(raw) {
    var i = {};
    Object.keys(RECRIA_DEFAULTS).forEach(function (k) {
      i[k] = k === 'areaLotacaoInicial' ? (raw[k] || RECRIA_DEFAULTS[k]) : num(raw[k]);
    });
    var o = {};
    o.cabecas = div(i.investimento, i.rsCabCompra);                       // B21
    o.lotacaoTotalUA = o.cabecas * i.pesoIni / UA_KG;                     // B23
    o.lotacaoHaInicial = div(o.lotacaoTotalUA, i.areaLotacaoInicial === 'area' ? i.area : 80); // B24
    o.pesoMedio = (i.pesoIni + i.pesoFin) / 2;                            // B26
    o.lotacaoFinal = div(o.cabecas * o.pesoMedio / UA_KG, i.area);        // B27
    o.arrobasProduzidas = i.pesoFin / ARROBA_VIVO * o.cabecas;            // B29
    // Suplemento
    o.consumoKgDia = o.pesoMedio * i.consumoPct;                          // F24
    o.suplCabDia = o.consumoKgDia * i.precoSuplKg;                        // F25
    o.suplDia = o.suplCabDia * o.cabecas;                                 // F26
    o.suplTotal = o.suplDia * i.dias;                                     // F27
    // Imposto
    o.arrobasCarcacaCab = i.pesoFin * i.rendCarcaca / ARROBA_CARCACA;     // J20
    o.vendaCab = o.arrobasCarcacaCab * i.precoVenda;                      // J21
    o.impostoCab = o.vendaCab * i.imposto;                                // J23
    o.impostoTotal = o.impostoCab * o.cabecas;                            // J24
    // Sanidade
    o.sanidadeTotal = i.dias / 30 * o.cabecas * i.sanidadeCabMes;         // M20
    // Custo operacional
    o.custos = [
      { id: 'supl', nome: 'Suplemento', valor: o.suplTotal },             // B33
      { id: 'san', nome: 'Sanidade', valor: o.sanidadeTotal },           // B34
      { id: 'imp', nome: 'Imposto', valor: o.impostoTotal },             // B35
      { id: 'frete', nome: 'Transporte (frete)', valor: i.frete },       // B36
      { id: 'func', nome: 'Funcionário', valor: i.funcionario }          // B37
    ];
    o.custoTotal = o.custos.reduce(function (s, c) { return s + c.valor; }, 0); // B38
    o.faturamentoBruto = o.arrobasProduzidas * i.precoVenda;              // E33
    o.faturamentoLiquido = o.faturamentoBruto - o.custoTotal - i.investimento; // E35
    o.totalEmCaixa = i.investimento + o.faturamentoLiquido;               // E38
    o.liquidoMes = div(o.faturamentoLiquido, i.dias / 30);                // F33
    o.liquidoHa = div(o.faturamentoLiquido, i.area);                      // F35
    // Extra (não existe na planilha): ganho médio diário implícito
    o.gmdImplicito = div(i.pesoFin - i.pesoIni, i.dias);
    o.inputs = i;
    return o;
  }

  var sample = {
    compraVenda: {
      compras: [
        { lote: 1, categoria: 'BEZERRAS', qtd: 60, modo: 'total', peso: 11311, preco: 325, data: '2026-07-11' },
        { lote: 2, categoria: 'BEZERRAS', qtd: 10, modo: 'medio', peso: 210, preco: 290, data: '' }
      ],
      vendas: [
        { lote: 1, categoria: 'NOVILHAS', qtd: 16, modo: 'total', peso: 2920, preco: 290, data: '2026-07-24' }
      ]
    },
    recria: RECRIA_DEFAULTS
  };

  var api = {
    num: num, fmt: fmt, brl: brl, div: div,
    compraVenda: compraVenda, recria: recria,
    CV_PARAMS: CV_PARAMS, RECRIA_DEFAULTS: RECRIA_DEFAULTS, sample: sample
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  g.OGado = api;
})(typeof window !== 'undefined' ? window : globalThis);
