# Technology & tooling

Choose technology with evidence.

## Selected frameworks and platforms

<!-- sdd:answer technology.1 -->
| Technology | Version | Purpose | Ring |
| --- | --- | --- | --- |
| TypeScript | 5.9 | All application code | Adopt |
| React | 19 | Web interface | Adopt |
| Fastify | 5 | HTTP API | Adopt |
| PostgreSQL | 17 | Persistence and job queue | Adopt |
| OpenTelemetry | 1.x | Tracing | Trial |
<!-- sdd:end -->

## Version and support policies

<!-- sdd:answer technology.2 -->
Node.js 24 LTS; PostgreSQL 17; dependencies updated monthly; critical security patches within 72 hours.
<!-- sdd:end -->

## Licenses and restrictions

<!-- sdd:answer technology.3 -->
Allowed: MIT, Apache-2.0, BSD-3-Clause, ISC. Review: MPL-2.0, LGPL. Forbidden in distributed code: AGPL. Checked in CI.
<!-- sdd:end -->

## Alternatives considered

<!-- sdd:answer technology.4 -->
| Option | Strengths | Weaknesses | Decision |
| --- | --- | --- | --- |
| PostgreSQL | Relational integrity, team experience | Migrations for flexible timeline entries | Not chosen (ADR-002) |
| PostgreSQL | JSONB for flexible timelines, transactions, one database to operate | Schema migrations to plan | Chosen |
<!-- sdd:end -->

## Official and custom references

<!-- sdd:answer technology.5 -->
react.dev (React 19), fastify.dev (v5), PostgreSQL 17 manual, internal “API error conventions” page.
<!-- sdd:end -->

## Development tooling

<!-- sdd:answer technology.6 -->
pnpm workspaces, Prettier, ESLint, Vitest, Playwright; Claude Code and Copilot with repository instructions.
<!-- sdd:end -->

## Adoption rationale

<!-- sdd:answer technology.7 -->
TypeScript end to end lets the team share validation schemas between the interface and the API; one language keeps a team of 3 productive.
<!-- sdd:end -->

## Approved usage and restrictions

<!-- sdd:answer technology.8 -->
Hosted AI providers may be used for drafting documentation only; never with customer request content.
<!-- sdd:end -->
