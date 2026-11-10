# Design decisions

## ADR-001: Modular monolith for release 1

Status: accepted

Context: team of 3, one deployable preferred. Decision: single API service with modules. Consequences: coarse scaling; revisit if two modules need independent scaling.

## ADR-002: PostgreSQL for requests, object storage for attachments

Status: accepted

Context: flexible timeline entries and binary attachments. Decision: PostgreSQL 17 with JSONB timelines and a standby replica; attachments in S3-compatible object storage. Consequences: organization filter enforced in the data layer; schema migrations in the release pipeline.

## ADR-003: Durable notification jobs in PostgreSQL

Status: accepted

Context: email provider may be unavailable. Decision: leased jobs with retries in PostgreSQL (SELECT … FOR UPDATE SKIP LOCKED). Consequences: at-least-once delivery; consumers deduplicate.
