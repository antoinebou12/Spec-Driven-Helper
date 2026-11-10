# Running the CI locally with act

[act](https://github.com/nektos/act) runs the GitHub Actions workflow (`.github/workflows/ci.yml`) in Docker on your machine, so a change can be checked the way GitHub checks it before you push.

## Install

- Docker Desktop (Windows, macOS) or Docker Engine (Linux), running.
- act 0.2.60 or later:
  - Windows: `winget install nektos.act` or `choco install act-cli`
  - macOS: `brew install act`
  - Linux: `curl -s https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash`

Check with `act --version` and `docker version`.

## One-time setup

The repository already contains `.actrc`, which selects the runner image (`catthehacker/ubuntu:act-latest`, about 1.5 GB on first pull), the `linux/amd64` architecture, a local artifact folder and the secret and variable files.

```bash
cp .act/secrets.example .act/secrets   # optional: GITHUB_TOKEN for the gitleaks step
cp .act/vars.example .act/vars         # required: ACT_POSTGRES_PORT for the PostgreSQL service
```

On Windows PowerShell use `Copy-Item` instead of `cp`. Both files are ignored by Git; never commit a token.

## Run

| Command | What it runs |
| --- | --- |
| `pnpm ci:local` | The `checks` job: lint, types, format (advisory), backend and frontend tests with coverage, production build, Storybook build |
| `pnpm ci:local:list` | Lists every job and step without running them |
| `pnpm ci:local:all` | Every job on a `push` event: checks, e2e, security, docker |
| `act push -j e2e` | One job by id (`checks`, `e2e`, `security`, `docker`) |
| `act pull_request -j checks` | The same job as a pull request would run it |

A full `checks` run takes about five minutes after the first image pull. Artifacts such as coverage reports and Playwright traces land in `.act/artifacts/`.

## How the workflow adapts to act

act sets `env.ACT`, and the workflow reads it in a few places:

- **PostgreSQL service.** act starts service containers on their own network but runs the job container on the host network, so the service name does not resolve. When `vars.ACT_POSTGRES_PORT` is set (from `.act/vars`), the service publishes that fixed port and the tests connect to `localhost:<port>`. On GitHub the variable is empty, so the service keeps a random host port and `job.services.postgres.ports['5432']` is used. Pick another port in `.act/vars` if 55432 is taken.
- **Secret scan.** gitleaks needs a GitHub token. Locally it runs only when `.act/secrets` provides `GITHUB_TOKEN`; otherwise the step is skipped. Step conditions cannot read `secrets` directly, so the job exposes `HAS_GITHUB_TOKEN` in `env`.
- **Docker layer cache.** The GitHub Actions cache service does not exist under act, so `cache-from` and `cache-to` are empty locally.

## Limitations

- `act -n` (dry run) crashes in act 0.2.89 with a nil pointer; use `pnpm ci:local:list` instead.
- The `docker` job builds images with the host Docker daemon; it needs Docker socket access (the default).
- act copies the working tree into the container, uncommitted changes included. A `.pnpm-store` folder may appear inside the container; it is ignored by Git, ESLint and Prettier.
- Results can still differ from GitHub for hosted-only features (OIDC tokens, `actions/cache` hits, GitHub-hosted tool caches). The pushed run on GitHub remains the reference.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Bind for 127.0.0.1:55432 failed: port is already allocated` | Another service uses the port. Set a free `ACT_POSTGRES_PORT` in `.act/vars`. |
| `getaddrinfo ENOTFOUND postgres` | `.act/vars` is missing or has no `ACT_POSTGRES_PORT`. |
| `Unknown Variable Access secrets` | A step `if` reads `secrets`; move the value into job `env` first. |
| Image pull is slow or fails | Pull once with `docker pull catthehacker/ubuntu:act-latest`, then rerun. |
