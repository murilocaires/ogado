# Operação em produção

## Backup do banco (Railway Postgres)

O plano gratuito do Railway **não faz backup automático**. O backup é feito por `scripts/backup-db.mjs`, que roda `pg_dump` dentro do serviço `Postgres` (via `railway ssh`; o banco nunca é exposto à internet) e grava `backups/ogado-AAAA-MM-DD-HH-MM.sql.gz`. A pasta `backups/` é ignorada pelo git, porque contém dados de clientes. Guarde cópias fora da máquina (disco externo ou nuvem pessoal).

```bash
railway login && railway link        # uma vez
node scripts/backup-db.mjs           # mantém os 14 mais recentes (--manter=N)
```

O script falha, sem guardar nada, se o dump não terminar com `PostgreSQL database dump complete`.

**Restaurar** (testado em 2026-10-19 num Postgres 17 local: 0 erros, contagens iguais):

```bash
gunzip -c backups/ogado-....sql.gz | sed '/^\restrict\|^\unrestrict/d' | psql "$DATABASE_URL"
```

Sempre restaure primeiro num banco vazio de teste; só depois decida o que fazer em produção. Frequência sugerida: semanal e antes de cada migração destrutiva.

## Monitoramento

- Saúde da API: `GET https://bovaro.com.br/api/health` (passa pelo rewrite; devolve `{"status":"ok","db":"ok"}`). O Railway também usa `/health` como healthcheck e reinicia em falha.
- Alerta externo (ação manual, gratuita): criar um monitor HTTP no UptimeRobot ou similar apontando para a URL acima, a cada 5 minutos, com aviso por e-mail.
- Logs: `railway logs --service api`. A API não loga senha, token de sessão, token de redefinição nem corpo de requisição.
- Uso do banco: volume de 500 MB no plano gratuito; conferir com `railway service list` (campo `volume`).

## Segredos e variáveis

Ver `docs/engenharia/deploy-railway.md`. `PROXY_SECRET` deve ser igual no Railway e na Vercel; `RESEND_API_KEY` e `EMAIL_FROM` ficam só no Railway.
