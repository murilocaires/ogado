const origin='https://ogado.vercel.app';
const email=`sync-probe-${Date.now()}@teste.ogado.invalid`;
const senha=crypto.randomUUID()+'aA1!';
let cookie=''; let user;
async function call(path,method='GET',body){const r=await fetch(origin+'/api'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(user?{'X-OGado-Usuario':user}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});const c=r.headers.getSetCookie();if(c.length)cookie=c.map(s=>s.split(';')[0]).join('; ');const data=await r.json().catch(()=>null);console.log(JSON.stringify({path,method,status:r.status,...(data?.erro?{erro:data.erro}:{}),...(data&&typeof data==='object'?{keys:Object.keys(data)}:{})}));return {r,data};}
try {const signup=await call('/auth/signup','POST',{email,senha,aceiteTermos:true});if(!signup.r.ok)process.exit(1);user=signup.data.usuario.id;
await call('/lotes?incremental=true&incluirExcluidos=true&limit=100');
await call('/lotes?incluirExcluidos=true');
await call('/cenarios?incremental=true&incluirExcluidos=true&limit=100');
await call('/cenarios?incluirExcluidos=true');
const lote=await call('/lotes','POST',{id:crypto.randomUUID(),tipo:'compra',categoria:'TESTE SINCRONIZACAO',data:null,modo:'total',qtd:'1',peso:'200',pesos:[],preco:'300',base:'vivo',aplicarDesconto:false,descontoKg:null});
const cenario={id:crypto.randomUUID(),nome:'TESTE SINCRONIZACAO',criadoEm:new Date().toISOString(),entradas:{area:'100',dias:'365',investimento:'0',rsCabCompra:'1000',pesoIni:'200',pesoFin:'400',precoVenda:'300',consumoPct:'2',precoSuplKg:'2',rendCarcaca:'52',imposto:'1.5',sanidadeCabMes:'5',funcionario:'0',frete:'0'},variantes:{lotacaoInicial:'fixa80',faturamentoBruto:'pesoVivo',cabecasInteiras:false,schemaVersao:1,calculoVersao:'recria-1'},parametros:{arrobaVivoKg:'30',arrobaCarcacaKg:'15',uaKg:'450',lotacaoFixaHa:'80'},resultado:{cabecas:'10',lotacaoTotalUA:null,lotacaoHaInicial:null,pesoMedio:null,lotacaoFinal:null,arrobasProduzidas:null,consumoKgDia:null,arrobasCarcacaCab:null,vendaCab:null,custoTotal:null,faturamentoBruto:null,faturamentoLiquido:null,totalEmCaixa:null,liquidoMes:null,liquidoHa:null,gmdImplicito:null,custos:[{id:'supl',nome:'Suplemento',valor:'0'},{id:'san',nome:'Sanidade',valor:'0'},{id:'imp',nome:'Imposto',valor:'0'},{id:'frete',nome:'Frete',valor:'0'},{id:'func',nome:'Funcionário',valor:'0'}]}};
await call('/cenarios','POST',cenario);
await call('/lotes?incremental=true&incluirExcluidos=true&limit=100');
} finally {if(user)await call('/conta','DELETE',{confirmacao:'deletar'});}
