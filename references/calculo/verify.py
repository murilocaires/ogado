import json, subprocess, openpyxl, sys
import os
B=os.path.dirname(os.path.abspath(__file__))
U=os.path.join(B,'..','planilhas')+'/'
S=os.path.join(B,'calc.js')
out=json.loads(subprocess.check_output(['node','-e',f"const c=require('{S}');console.log(JSON.stringify({{cv:c.compraVenda(c.sample.compraVenda),r:c.recria(c.sample.recria)}}))"]))
cv=openpyxl.load_workbook(U+'compra-e-venda-de-gado.xlsx',data_only=True).active
rc=openpyxl.load_workbook(U+'calculos-recria.xlsx',data_only=True).active
chk=[]
def t(name,app,xl): chk.append((name,app,xl,abs(app-xl)<1e-6*max(1,abs(xl))))
c=out['cv']
t('F4 @ compra1',c['compras'][0]['arrobas'],cv['F4'].value); t('H4',c['compras'][0]['total'],cv['H4'].value)
t('E5 kg',c['compras'][1]['kg'],cv['E5'].value); t('F5',c['compras'][1]['arrobas'],cv['F5'].value)
t('H5',c['compras'][1]['total'],cv['H5'].value); t('I5',c['compras'][1]['porCab'],cv['I5'].value)
t('H8 total compras',c['totalCompras'],cv['H8'].value)
t('F11 @ venda',c['vendas'][0]['arrobas'],cv['F11'].value); t('H11',c['vendas'][0]['total'],cv['H11'].value)
t('H15',c['totalVendas'],cv['H15'].value); t('H19 saldo',c['saldo'],cv['H19'].value)
r=out['r']
m={'B21':'cabecas','B23':'lotacaoTotalUA','B24':'lotacaoHaInicial','B26':'pesoMedio','B27':'lotacaoFinal','B29':'arrobasProduzidas','F24':'consumoKgDia','F25':'suplCabDia','F26':'suplDia','F27':'suplTotal','J20':'arrobasCarcacaCab','J21':'vendaCab','J23':'impostoCab','J24':'impostoTotal','M20':'sanidadeTotal','B38':'custoTotal','E33':'faturamentoBruto','E35':'faturamentoLiquido','E38':'totalEmCaixa','F33':'liquidoMes','F35':'liquidoHa'}
for cell,k in m.items(): t(cell+' '+k,r[k],rc[cell].value)
for n,a,x,ok in chk: print('OK ' if ok else 'ERRO',n,a,x)
print('TOTAL',len(chk),'falhas',sum(1 for c in chk if not c[3]))
