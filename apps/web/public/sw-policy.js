/*
 * Regras puras do service worker (E4, ADR-0007 §3). Script clássico, sem módulos: o sw.js o carrega
 * com importScripts e os testes (Vitest) o importam via require. Sem acesso a rede ou a caches aqui.
 */
(function (root) {
  'use strict';

  /** Mude ao alterar a estratégia: o activate apaga os caches de outras versões. */
  var VERSAO = 'v1';
  var CACHE_ESTATICO = 'ogado-estatico-' + VERSAO;
  var CACHE_PAGINAS = 'ogado-paginas-' + VERSAO;

  /** Telas que abrem sem internet depois da primeira visita. */
  var ROTAS = ['/painel', '/negocios', '/recria', '/conta', '/entrar', '/cadastrar'];
  var ROTA_RESERVA = '/painel';
  var TEMPO_LIMITE_REDE_MS = 3000;

  function caminho(url) {
    try {
      // aceita também caminhos relativos ("/painel"); a base só serve para resolvê-los
      return new URL(url, 'http://base.invalid').pathname.replace(/\/+$/, '') || '/';
    } catch {
      return '';
    }
  }

  function mesmaOrigem(url, origem) {
    try {
      return new URL(url).origin === origem;
    } catch {
      return false;
    }
  }

  /**
   * Decide a estratégia de uma requisição: 'ignorar' (segue direto à rede, nada é cacheado),
   * 'estatico' (cache primeiro), 'fonte' (cache primeiro, entre origens) ou 'navegacao'.
   * `req` = { method, url, mode }.
   */
  function estrategia(req, origem) {
    if (req.method !== 'GET') return 'ignorar';
    var host;
    try {
      host = new URL(req.url).hostname;
    } catch {
      return 'ignorar';
    }
    if (host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com') return 'fonte';
    if (!mesmaOrigem(req.url, origem)) return 'ignorar';
    var p = caminho(req.url);
    if (p === '/api' || p.indexOf('/api/') === 0) return 'ignorar';
    if (p.indexOf('/_next/static/') === 0) return 'estatico';
    if (req.mode === 'navigate') return 'navegacao';
    return 'ignorar';
  }

  /** Só guarda respostas completas e públicas: nada com cookie, erro, redirecionamento ou parcial. */
  function podeGuardar(resp) {
    if (!resp) return false;
    if (resp.type === 'opaque') return true; // fontes entre origens: não dá para inspecionar
    if (resp.status !== 200 || resp.redirected) return false;
    if (resp.headers && typeof resp.headers.get === 'function') {
      if (resp.headers.get('set-cookie')) return false;
      if (/no-store/i.test(resp.headers.get('cache-control') || '')) return false;
    }
    return true;
  }

  function ehRotaDoProduto(url) {
    return ROTAS.indexOf(caminho(url)) >= 0;
  }

  /** Chave de cache de uma página: a rota, sem query nem barra final. */
  function chavePagina(url, origem) {
    return origem + caminho(url);
  }

  /** URLs de /_next/static/ citadas no HTML (scripts, estilos, fontes), sem repetição. */
  function ativosDoHtml(html) {
    var achados = {};
    var re = /\/_next\/static\/[^"'\s)\\<>]+/g;
    var m;
    while ((m = re.exec(html)) !== null) achados[m[0]] = true;
    return Object.keys(achados);
  }

  var api = {
    VERSAO: VERSAO,
    CACHE_ESTATICO: CACHE_ESTATICO,
    CACHE_PAGINAS: CACHE_PAGINAS,
    ROTAS: ROTAS,
    ROTA_RESERVA: ROTA_RESERVA,
    TEMPO_LIMITE_REDE_MS: TEMPO_LIMITE_REDE_MS,
    estrategia: estrategia,
    podeGuardar: podeGuardar,
    ehRotaDoProduto: ehRotaDoProduto,
    chavePagina: chavePagina,
    ativosDoHtml: ativosDoHtml,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.OGadoSwPolicy = api;
})(typeof self !== 'undefined' ? self : undefined);
