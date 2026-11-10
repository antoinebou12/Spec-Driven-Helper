# Delivery & environments

Make delivery repeatable.

## Development test and production environments

<!-- sdd:answer delivery.1 -->
_Not answered yet._
<!-- sdd:end -->

## Environment configuration and secrets

<!-- sdd:answer delivery.2 -->
Configuration variables documented in .env.example: HOST, PORT, APP_ORIGIN, APP_ALLOWED_ORIGINS, ENCRYPTION_KEY, BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD, DATABASE_URL, POSTGRES_PASSWORD, OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OLLAMA_URL, OLLAMA_NUM_CTX, OLLAMA_NUM_PREDICT, OLLAMA_RUN_TIMEOUT_MS, NIM_BASE_URL, COMPOSE_OLLAMA_URL, OLLAMA_MODEL, OLLAMA_EMBEDDING_MODEL, APP_PORT, COMPOSE_APP_ORIGIN, AGENT_RUNNER_URL, AGENT_RUNNER_TOKEN, PUBLISHER_URL, PUBLISHER_TOKEN, MCP_ALLOWED_ORIGINS, MCP_RATE_LIMIT_MAX, OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_SERVICE_NAME, METRICS_TOKEN, RATE_LIMIT_MAX, AIO_ALLOW_AI_CRAWLERS, GRAFANA_ADMIN_PASSWORD, GRAFANA_URL, PROMETHEUS_URL, NETDATA_URL, TRACES_URL.
<!-- sdd:end -->

## CI/CD pipeline

<!-- sdd:answer delivery.3 -->
_Not answered yet._
<!-- sdd:end -->

## Infrastructure and ownership

<!-- sdd:answer delivery.4 -->
_Not answered yet._
<!-- sdd:end -->

## Docker installation

<!-- sdd:answer delivery.5 -->
_Not answered yet._
<!-- sdd:end -->

## Non-Docker platform prerequisites

<!-- sdd:answer delivery.6 -->
_Not answered yet._
<!-- sdd:end -->

## Migration and rollback plan

<!-- sdd:answer delivery.7 -->
_Not answered yet._
<!-- sdd:end -->

## Deployment targets

<!-- sdd:answer delivery.9 -->
- Kubernetes
<!-- sdd:end -->

## Cloud and virtualization providers

<!-- sdd:answer delivery.10 -->
_Not answered yet._
<!-- sdd:end -->

## CI/CD platform

<!-- sdd:answer delivery.11 -->
GitHub Actions
<!-- sdd:end -->

## Pipeline stages

<!-- sdd:answer delivery.12 -->
- Lint and format check
- Type check / compile
- Unit tests
- End-to-end tests
- Dependency scan
- Secret scan
- Container image scan
- Build artifact / image
- Deploy to production
<!-- sdd:end -->

## Infrastructure as code

<!-- sdd:answer delivery.13 -->
Yes
<!-- sdd:end -->

## Server operating systems

<!-- sdd:answer delivery.14 -->
_Not answered yet._
<!-- sdd:end -->

## Infrastructure-as-code tools

<!-- sdd:answer delivery.15 -->
- Helm
<!-- sdd:end -->

## State and locking

<!-- sdd:answer delivery.16 -->
_Not answered yet._
<!-- sdd:end -->

## Infrastructure change workflow

<!-- sdd:answer delivery.17 -->
_Not answered yet._
<!-- sdd:end -->

## Drift detection

<!-- sdd:answer delivery.18 -->
_Not answered yet._
<!-- sdd:end -->

## Policy as code and IaC scanning

<!-- sdd:answer delivery.19 -->
_Not answered yet._
<!-- sdd:end -->
