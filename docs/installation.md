# Installing SDD Studio

SDD Studio is self-hosted. It needs **Node.js 24**, **pnpm 11** (through Corepack), **Git**, and **PostgreSQL 17 with the pgvector extension**. PostgreSQL is the only supported application database.

| Component         | Purpose                                                          | Default address             |
| ----------------- | ---------------------------------------------------------------- | --------------------------- |
| API (`app`)       | Fastify API, static web client, Swagger UI at `/api/docs`        | `http://127.0.0.1:3001`     |
| Worker (`worker`) | Durable jobs: AI runs, imports, Git inspection, exports          | no port                     |
| PostgreSQL        | Documents (`sdd_documents` JSONB), assets (`sdd_blobs`), vectors | `127.0.0.1:5433` in Compose |
| Ollama (optional) | Local models for local-only projects                             | `http://127.0.0.1:11434`    |

## Option 1 — Docker Compose (recommended)

1. Create the environment file and the first Owner account:

   ```bash
   cp .env.example .env
   ```

   Set at least:
   - `ENCRYPTION_KEY`: 64 hexadecimal characters. Generate it with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Provider credentials are encrypted with it; **losing it makes stored credentials unreadable**.
   - `POSTGRES_PASSWORD`: a strong password.
   - `BOOTSTRAP_EMAIL` and `BOOTSTRAP_PASSWORD`: the first Owner. They are only used when no user exists yet.

2. Build and start:

   ```bash
   docker compose up -d --build
   ```

3. Open `http://localhost:3001`, sign in with the bootstrap account, and follow the guided tour. Migrations run automatically at API start; the app and the worker can start together because migrations take a database lock.

The image runs as the unprivileged `node` user, uses `tini` as PID 1, contains Git for repository import and publishing, and reports health through `GET /api/health/live` (Docker `HEALTHCHECK`). In Compose, the app and worker also run with a read-only root filesystem, no Linux capabilities and `no-new-privileges`; Git work happens in a `/tmp` tmpfs. Logs rotate (3 × 10 MB). Ports are bound to `127.0.0.1`; put a TLS reverse proxy (Caddy, nginx, Traefik) in front for any other access and set `COMPOSE_APP_ORIGIN` to the public URL.

### Compose profiles and variants

| Command                                                                   | Adds                                                                                                   |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `docker compose up -d`                                                    | PostgreSQL, app (API and web client) and worker. Uses Ollama on the Docker host if one runs there.    |
| `docker compose --profile ollama up -d`                                   | Ollama in a container and a one-shot pull of `OLLAMA_MODEL` and `OLLAMA_EMBEDDING_MODEL`. Set `COMPOSE_OLLAMA_URL=http://ollama:11434`. |
| `docker compose -f compose.yaml -f compose.gpu.yaml --profile ollama up -d` | The same, with an NVIDIA GPU for Ollama (needs the NVIDIA container toolkit).                          |
| `docker compose --profile pdf up -d`                                      | The isolated PDF publisher. Set `PUBLISHER_URL=http://publisher:3200` and a random `PUBLISHER_TOKEN`.  |
| `docker compose -f compose.yaml -f compose.split.yaml up -d`              | Separate API and nginx web images; the web client is served on `WEB_PORT` (default 8080).             |

Profiles can also be set once in `.env` with `COMPOSE_PROFILES=ollama,pdf`.

### Local AI with Ollama

Inside a container, `127.0.0.1` is the container itself, so Compose points the app and the worker at `http://host.docker.internal:11434` (Ollama on the Docker host) unless `COMPOSE_OLLAMA_URL` says otherwise. Outside Docker, `OLLAMA_URL` defaults to `http://127.0.0.1:11434`.

Check the connection in **Administration → Local AI (Ollama)**, which lists the installed models and their context windows, or from a terminal:

```bash
pnpm ollama:check                      # uses the model chosen in Settings → Providers
pnpm ollama:check --model qwen2.5:7b   # try another installed model
pnpm ollama:check --skip-generate      # connection and models only
```

The check runs a real proposal against the example specification, applies it to a copy, and tests embeddings. Small models have short context windows. When the specification does not fit, SDD Studio sends a compact context that covers only the sections your request names, such as "Security" or `operations.3`. When the request names no section, it uses the sections with the most open questions. Proposals from local models never replace a recorded answer with "unknown". A 2–3B model works but often answers "unknown". A 7–8B instruction model (`qwen2.5:7b`, `llama3.1:8b`) gives much better proposals. `OLLAMA_NUM_CTX`, `OLLAMA_NUM_PREDICT` and `OLLAMA_RUN_TIMEOUT_MS` tune the window, the answer length and the timeout.

To build the image alone:

```bash
docker build -f docker/local.Dockerfile -t sdd-studio:local .
```

## Option 2 — Manual installation

### Windows 11

1. Install Node.js 24 LTS from nodejs.org, and Git for Windows.
2. Install PostgreSQL 17 and pgvector, or run only the database container: `docker compose up -d postgres`.
3. In PowerShell, from the repository folder:

   ```powershell
   corepack enable
   pnpm install
   pnpm exec tsx scripts/setup-local.ts
   ```

   `setup-local.ts` creates `.env` with a random encryption key and a local Owner password. It writes the sign-in details to `.runtime/local-access.md`; both files are ignored by Git. It never overwrites an existing `.env`.

4. Add `DATABASE_URL=postgresql://sdd:<password>@127.0.0.1:5433/sdd_studio` to `.env` if it is not present.
5. Run `pnpm dev` and open `http://localhost:5173`.

### macOS

```bash
brew install node@24 git postgresql@17 pgvector
brew services start postgresql@17
createuser -s sdd && createdb -O sdd sdd_studio
psql sdd_studio -c 'CREATE EXTENSION IF NOT EXISTS vector'
corepack enable && pnpm install && pnpm exec tsx scripts/setup-local.ts
pnpm dev
```

Set `DATABASE_URL=postgresql://sdd@127.0.0.1:5432/sdd_studio` in `.env`.

### Linux (Debian or Ubuntu)

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs git postgresql-17 postgresql-17-pgvector
sudo -u postgres createuser -P sdd
sudo -u postgres createdb -O sdd sdd_studio
sudo -u postgres psql sdd_studio -c 'CREATE EXTENSION IF NOT EXISTS vector'
corepack enable && pnpm install && pnpm exec tsx scripts/setup-local.ts
pnpm dev
```

For a production host without Docker, run `pnpm build` once, then run `pnpm start` (API and web client) and `pnpm worker` as two systemd services under a dedicated user, with `HOST=127.0.0.1` behind a reverse proxy.

## Option 3 — Kubernetes with Helm

The chart in `deploy/helm/sdd-studio` runs the same image as Compose. It creates:

- an API Deployment (2 replicas, with probes and a disruption budget);
- a worker Deployment;
- a Service;
- an optional Ingress (buffering off for event streams and MCP), an optional NetworkPolicy, and an optional Prometheus ServiceMonitor.

Pods run as non-root with a read-only root file system and no capabilities. PostgreSQL 17 with pgvector is external (a managed service or your own chart).

1. Build and push the image to your registry: `docker build -f docker/local.Dockerfile -t registry.example.com/sdd-studio:1.0 .`.
2. Install:

   ```bash
   helm install sdd deploy/helm/sdd-studio -n sdd --create-namespace \
     --set image.repository=registry.example.com/sdd-studio --set image.tag=1.0 \
     --set appOrigin=https://sdd.example.com \
     --set database.url='postgresql://sdd:…@db:5432/sdd_studio' \
     --set secrets.encryptionKey=$(openssl rand -hex 32) \
     --set secrets.bootstrapEmail=owner@example.com --set secrets.bootstrapPassword='…' \
     --set ingress.enabled=true --set ingress.host=sdd.example.com
   ```

   To keep secrets out of the command line, create a Secret with `ENCRYPTION_KEY`, `BOOTSTRAP_EMAIL`, `BOOTSTRAP_PASSWORD` and `METRICS_TOKEN`, then set `secrets.existingSecret`. For the database, set `database.existingSecret`.
3. Check the release: `helm test sdd -n sdd`.

The chart refuses to render without an encryption key (64 hexadecimal characters) and a database. `pnpm helm:check` lints the chart, renders it and validates it with kubeconform. `pnpm k8s:test` installs it into a throw-away k3s cluster in Docker and signs in through the Service; both run in CI.

## Optional integrations

| Setting                                               | Enables                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------- |
| `OLLAMA_URL`                                          | Local models; local-only projects never fall back to the cloud |
| Provider keys (Settings → Providers)                  | OpenAI, Anthropic and the free hosted NVIDIA NIM endpoint; stored encrypted per workspace |
| `NIM_BASE_URL`                                        | Your own NVIDIA NIM server instead of the hosted endpoint (no key needed) |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | Company single sign-on (any OpenID Connect provider)           |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`            | Google sign-in and sign-up                                     |
| `AGENT_RUNNER_URL`, `AGENT_RUNNER_TOKEN`              | Isolated Claude Agent workspaces                               |
| `PUBLISHER_URL`, `PUBLISHER_TOKEN`                    | Isolated PDF rendering: stored reports and the direct PDF export |
| `OTEL_EXPORTER_OTLP_ENDPOINT`                         | OpenTelemetry traces                                           |

Kroki and the UML MCP endpoint are configured by an Owner or Admin in the administration page, not in `.env`.

### Single sign-on

Register SDD Studio with your identity provider and use these redirect URIs, where the origin is `APP_ORIGIN` (or `COMPOSE_APP_ORIGIN` in Compose):

- Company SSO: `<origin>/api/v1/auth/oidc/callback`
- Google: `<origin>/api/v1/auth/google/callback`

When a provider is configured, the sign-in and sign-up pages show "Continue with …" and "Sign up with …" buttons for it. The server applies the same rules to both:

- The provider must report a verified email address.
- A returning user signs in. A disabled account is refused.
- An invited email joins with the role on its invitation, and the invitation is used up.
- Without an invitation, a new account is created only when self-registration is on (Administration). It stays disabled until an administrator activates it. When registration is off, the person is asked to request an invitation.
- An email that already belongs to a password account is not linked automatically. The person signs in with their password instead.

Failures return to the sign-in page with a readable message, never a raw error.

## Checking changes before you push

`pnpm ci:local` runs the GitHub Actions `checks` job in Docker with [act](https://github.com/nektos/act): lint, types, tests with coverage, build and Storybook. Setup, the other jobs and the known differences from GitHub are described in [Running the CI locally](ci-local.md). `pnpm smoke:web` builds the nginx web image and checks its headers, deep links and `/api` proxy.

Older MongoDB data is not imported by SDD Studio. Export and transform it outside the application before switching to PostgreSQL.
