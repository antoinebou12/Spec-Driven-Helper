# Architecture & ADRs

Make the reasoning behind decisions visible.

## System boundaries

<!-- sdd:answer architecture.1 -->
Inside: web app, request API, notification worker, PostgreSQL. External: corporate identity provider (OIDC) and email delivery service.
<!-- sdd:end -->

## Components and responsibilities

<!-- sdd:answer architecture.2 -->
| Component | Responsibility | Technology |
| --- | --- | --- |
| CMP-001 Web app | Customer and agent interface | React, TypeScript |
| CMP-002 Request API | Validation, authorization, persistence | Node.js, Fastify |
| CMP-003 Notification worker | Sends status emails from a durable queue | Node.js |
| CMP-004 Request store | Requests, timelines, attachments | PostgreSQL (JSONB) with S3-compatible object storage for attachments |
<!-- sdd:end -->

## Integration contracts

<!-- sdd:answer architecture.3 -->
Identity provider: OIDC authorization code with PKCE. Email service: HTTPS JSON API, API key in the vault, 5 s timeout, 3 retries with backoff, failures queued for 24 hours.
<!-- sdd:end -->

## Deployment topology

<!-- sdd:answer architecture.4 -->
Two API containers and one worker behind the company TLS ingress in the Canada Central region; managed PostgreSQL with a standby replica in the same region.
<!-- sdd:end -->

## Alternatives and tradeoffs

<!-- sdd:answer architecture.5 -->
| Option | Strengths | Weaknesses | Decision |
| --- | --- | --- | --- |
| Modular monolith | Simple deploys, one codebase | Coarse scaling | Chosen (ADR-001) |
| Microservices | Independent scaling | Operational overhead for a team of 3 | Rejected |
<!-- sdd:end -->

## Architecture decisions and rationale

<!-- sdd:answer architecture.6 -->
ADR-001 Modular monolith for release 1. ADR-002 PostgreSQL for requests, object storage for attachments. ADR-003 Durable job queue in PostgreSQL for notifications.
<!-- sdd:end -->

## Component ownership

<!-- sdd:answer architecture.7 -->
Web app, API and worker: Platform Engineering. Email templates: Customer Experience.
<!-- sdd:end -->

## Frontend components

<!-- sdd:answer architecture.9 -->
| Component | Responsibility | State / data | Technology |
| --- | --- | --- | --- |
| App shell and navigation | Layout, routing, sign-in state | Session from /auth/me | React 19 |
| Request list and detail pages | Find, filter and follow requests | Server state via query cache | React 19 |
| New request form | Capture issue and attachments | Local form state, autosave draft | React 19 |
<!-- sdd:end -->

## Backend components

<!-- sdd:answer architecture.10 -->
| Component | Responsibility | Interfaces | Technology |
| --- | --- | --- | --- |
| Request API | Validation, authorization, persistence | REST /api/v1 (OpenAPI 3.1) | Node.js 24, Fastify 5 |
| Notification worker | Send status emails with retries | Job queue in PostgreSQL | Node.js 24 |
<!-- sdd:end -->
