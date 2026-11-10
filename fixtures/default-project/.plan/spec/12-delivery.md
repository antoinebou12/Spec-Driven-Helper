# Delivery & environments

Make delivery repeatable.

## Development test and production environments

<!-- sdd:answer delivery.1 -->
Local (Docker Compose, seed data); staging (production-like, synthetic data, team access); production (customer data, on-call access only).
<!-- sdd:end -->

## Environment configuration and secrets

<!-- sdd:answer delivery.2 -->
.env.example lists every variable; secrets come from the vault; the API refuses to start without required settings.
<!-- sdd:end -->

## CI/CD pipeline

<!-- sdd:answer delivery.3 -->
GitHub Actions: lint → tests → scans → image build → staging deploy → manual approval → rolling production deploy.
<!-- sdd:end -->

## Infrastructure and ownership

<!-- sdd:answer delivery.4 -->
Kubernetes manifests in the platform-infra repository, reviewed by Platform Engineering.
<!-- sdd:end -->

## Docker installation

<!-- sdd:answer delivery.5 -->
`docker compose up -d` starts the app, worker and PostgreSQL; data persists in a named volume; the app waits for a healthy database.
<!-- sdd:end -->

## Non-Docker platform prerequisites

<!-- sdd:answer delivery.6 -->
Node.js 24 and pnpm on all platforms; PostgreSQL 17 via winget (Windows), Homebrew (macOS) or the official apt repository (Linux).
<!-- sdd:end -->

## Migration and rollback plan

<!-- sdd:answer delivery.7 -->
Back up before migration; deploy to 10% then 100%; roll back to the previous image tag if the error rate exceeds 2% for 5 minutes.
<!-- sdd:end -->

## Deployment targets

<!-- sdd:answer delivery.9 -->
- Kubernetes
<!-- sdd:end -->

## Cloud and virtualization providers

<!-- sdd:answer delivery.10 -->
- Microsoft Azure
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
- Integration tests
- End-to-end tests
- Dependency scan
- Secret scan
- Build artifact / image
- Deploy to staging
- Manual approval
- Deploy to production
- Smoke tests
<!-- sdd:end -->

## Infrastructure as code

<!-- sdd:answer delivery.13 -->
Yes
<!-- sdd:end -->

## Server operating systems

<!-- sdd:answer delivery.14 -->
- Ubuntu LTS
<!-- sdd:end -->

## Infrastructure-as-code tools

<!-- sdd:answer delivery.15 -->
- Terraform
- Helm
<!-- sdd:end -->

## State and locking

<!-- sdd:answer delivery.16 -->
Remote backend with locking (object storage)
<!-- sdd:end -->

## Infrastructure change workflow

<!-- sdd:answer delivery.17 -->
- Plan shown on every pull request
- Approval required before apply
- Apply only from the pipeline
- Short-lived cloud credentials (OIDC federation)
<!-- sdd:end -->

## Drift detection

<!-- sdd:answer delivery.18 -->
Yes
<!-- sdd:end -->

## Policy as code and IaC scanning

<!-- sdd:answer delivery.19 -->
- Checkov
- Trivy (configuration scan)
<!-- sdd:end -->
