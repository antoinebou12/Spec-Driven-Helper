# Operating SDD Studio

## Health and monitoring

- `GET /api/health/live` — the process is up. It is used by the container `HEALTHCHECK`.
- `GET /api/health` — the database answers a ping.
- `GET /api/metrics` — Prometheus metrics: HTTP requests and durations, jobs by status, and pending proposals. It requires `Authorization: Bearer $METRICS_TOKEN`; without `METRICS_TOKEN`, only requests from the same host are allowed.
- Traces are exported through OpenTelemetry when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.
- Logs are JSON (pino, level from `LOG_LEVEL`). Authorization headers, cookies, passwords, tokens and provider keys are redacted before they are written.
- Privileged operations are recorded in the `audit` collection: role changes, provider credentials, publishing, imports, baselines and administration settings.

### Prometheus, Grafana and Netdata

`compose.observability.yaml` adds three services to the Compose stack. Set `METRICS_TOKEN` and `GRAFANA_ADMIN_PASSWORD` in `.env`, then run:

```bash
docker compose -f compose.yaml -f compose.observability.yaml up -d
```

| Tool       | Address (127.0.0.1 only) | What it gives you                                                                                         |
| ---------- | ------------------------ | --------------------------------------------------------------------------------------------------------- |
| Prometheus | http://localhost:9090    | Scrapes `/api/metrics` with the token (a Compose secret) and Netdata; evaluates `deploy/observability/alerts.yml` (API down, 5xx rate above 5 %, p95 above 2.5 s, failing or queued jobs). |
| Grafana    | http://localhost:3300    | The provisioned **SDD Studio** dashboard: availability, request rate, error rate, latency quantiles, slowest routes, jobs, pending proposals, host CPU and memory. |
| Netdata    | http://localhost:19999   | Per-second host and container resources.                                                                   |

The dashboard is generated from code (`pnpm grafana:dashboard`), so panels follow the metric names. On the **Administration** page, workspace admins see live figures from the running API (requests, error rate, p95 latency, database round trip, jobs, recent failures, busiest routes). The page also links to these tools once `GRAFANA_URL`, `PROMETHEUS_URL` and `NETDATA_URL` are set; the overlay sets them to the local addresses.

Netdata needs `pid: host`, `SYS_PTRACE` and read-only `/proc` and `/sys` mounts to see the host. Leave the service out if that is not acceptable on your host.

## Upgrades

1. Back up the database (see below).
2. Pull the new version and rebuild: `docker compose up -d --build` (or `pnpm install && pnpm build`, then restart both services).
3. Migrations run at API start and are recorded in the `migrations` collection; each runs once. `pnpm migrate` runs them without starting the server.
4. Check `GET /api/health` and the audit page.

Never run two different versions of the API against one database at the same time. Workers of the previous version must be stopped before the new API starts migrations.

## Backup and restore

All state (projects, revisions, proposals, jobs, users, audit, assets and vectors) lives in PostgreSQL. Back up the whole database, **and back up `ENCRYPTION_KEY` separately**: provider credentials cannot be decrypted without it.

```bash
docker compose exec -T postgres pg_dump -U sdd -Fc sdd_studio > sdd-studio-$(date +%F).dump
```

To restore into an empty database:

```bash
docker compose stop app worker
docker compose exec -T postgres pg_restore -U sdd -d sdd_studio --clean --if-exists < sdd-studio-2026-09-27.dump
docker compose start app worker
```

Test a restore regularly on a separate host. The project export (Publishing → Export) produces a portable Markdown and JSON archive of one project. It complements the database backup but does not replace it.

## Security operations

- **Rotating `ENCRYPTION_KEY`.** Remove the stored provider credentials in Settings, change the key, restart, and enter the credentials again.
- **Revoking access.** Removing a member or lowering a role takes effect on the next request. Sessions expire automatically.
- **Local-only projects** reject cloud providers and external renderers (Kroki, UML MCP), even when those are configured.
- **Workers** inspect repositories and generate proposals only. Pushes and pull requests always require an explicit user action in Publishing. Force-pushes are never performed.
- **Imported repositories and documents** are untrusted. Archives are extracted with path-traversal and size checks, and files that look like secrets are skipped.

## Troubleshooting

| Symptom                                   | Check                                                                                           |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| API exits with `Set ENCRYPTION_KEY …`     | `.env` must contain 64 hexadecimal characters.                                                  |
| Jobs stay queued                          | The `worker` service is running and can reach the database; see `docker compose logs worker`.   |
| Local model runs fail                     | `OLLAMA_URL` is reachable from the worker container (`host.docker.internal` on Docker Desktop). |
| Repository import fails with `git` errors | The remote is allowed (HTTPS GitHub, GitLab or Azure DevOps) and the token has read access.     |
| Blank page after an upgrade               | Hard-refresh the browser; migrations normalize stored specifications on first read.             |
