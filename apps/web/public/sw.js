/* Service worker do O Gado (E4, ADR-0007). Escrito à mão, sem biblioteca. Regras puras em sw-policy.js. */
importScripts('/sw-policy.js');

var P = self.OGadoSwPolicy;

self.addEventListener('install', function (event) {
  event.waitUntil(
    preCarregar().then(function () {
      return self.skipWaiting();
    }),
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (nomes) {
        return Promise.all(
          nomes
            .filter(function (n) {
              return n.indexOf('ogado-') === 0 && n !== P.CACHE_ESTATICO && n !== P.CACHE_PAGINAS;
            })
            .map(function (n) {
              return caches.delete(n);
            }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  var modo = P.estrategia(
    { method: req.method, url: req.url, mode: req.mode },
    self.location.origin,
  );
  if (modo === 'estatico' || modo === 'fonte') {
    event.respondWith(cachePrimeiro(req, P.CACHE_ESTATICO));
  } else if (modo === 'navegacao') {
    event.respondWith(navegacao(req));
  }
});

/** Baixa o HTML das telas e os arquivos que ele cita; falha de uma rota não impede a instalação. */
function preCarregar() {
  var origem = self.location.origin;
  return Promise.all([caches.open(P.CACHE_PAGINAS), caches.open(P.CACHE_ESTATICO)]).then(
    function (c) {
      var paginas = c[0];
      var estaticos = c[1];
      return Promise.all(
        P.ROTAS.map(function (rota) {
          return fetch(rota, { credentials: 'same-origin', cache: 'reload' })
            .then(function (resp) {
              if (!P.podeGuardar(resp)) return null;
              return resp
                .clone()
                .text()
                .then(function (html) {
                  return paginas.put(P.chavePagina(rota, origem), resp).then(function () {
                    return Promise.all(
                      P.ativosDoHtml(html).map(function (url) {
                        return estaticos.match(url).then(function (ja) {
                          if (ja) return null;
                          return fetch(url).then(function (r) {
                            return P.podeGuardar(r) ? estaticos.put(url, r) : null;
                          });
                        });
                      }),
                    );
                  });
                });
            })
            .catch(function () {
              return null;
            });
        }),
      );
    },
  );
}

function cachePrimeiro(req, nomeCache) {
  return caches.open(nomeCache).then(function (cache) {
    return cache.match(req).then(function (achado) {
      if (achado) return achado;
      return fetch(req).then(function (resp) {
        if (P.podeGuardar(resp)) cache.put(req, resp.clone());
        return resp;
      });
    });
  });
}

/** Rede primeiro com tempo-limite; sem rede, a página em cache; senão o HTML do Painel. */
function navegacao(req) {
  var origem = self.location.origin;
  var chave = P.chavePagina(req.url, origem);
  var guardavel = P.ehRotaDoProduto(req.url);

  return caches.open(P.CACHE_PAGINAS).then(function (cache) {
    function reserva() {
      return cache.match(chave).then(function (achado) {
        return achado || cache.match(P.chavePagina(P.ROTA_RESERVA, origem));
      });
    }
    var rede = fetch(req).then(function (resp) {
      if (guardavel && P.podeGuardar(resp)) cache.put(chave, resp.clone());
      return resp;
    });
    var limite = new Promise(function (resolve) {
      setTimeout(function () {
        resolve(null);
      }, P.TEMPO_LIMITE_REDE_MS);
    });
    return Promise.race([rede, limite])
      .then(function (resp) {
        if (resp) return resp;
        return reserva().then(function (c) {
          return c || rede;
        });
      })
      .catch(function () {
        return reserva().then(function (c) {
          return (
            c ||
            new Response('Sem conexão.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
          );
        });
      });
  });
}
