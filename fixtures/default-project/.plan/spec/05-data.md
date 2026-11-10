# Data & APIs

Describe the information the system depends on.

## Entities and relationships

<!-- sdd:answer data.1 -->
Organization 1–n Customer; Customer 1–n Request; Request 1–n TimelineEntry; Request 1–n Attachment. Request IDs are opaque UUIDs; the organizationId is on every request.
<!-- sdd:end -->

## API contracts and versioning

<!-- sdd:answer data.2 -->
REST JSON under /api/v1 described with OpenAPI 3.1. Breaking changes ship as /api/v2 with 6 months of overlap.
<!-- sdd:end -->

## Events and delivery guarantees

<!-- sdd:answer data.3 -->
RequestStatusChanged is delivered at least once to the notification worker; the worker deduplicates by requestId and status.
<!-- sdd:end -->

## Validation and error contracts

<!-- sdd:answer data.4 -->
Every request body is validated with shared JSON Schemas on the server. Errors use RFC 9457 problem details with field paths.
<!-- sdd:end -->

## Retention and deletion

<!-- sdd:answer data.5 -->
Closed requests kept 3 years, then anonymized. Attachments deleted after 1 year. Backups expire after 35 days.
<!-- sdd:end -->

## Schema migrations

<!-- sdd:answer data.6 -->
Versioned migration scripts run before deployment using expand/contract: add fields, switch code, remove old fields one release later.
<!-- sdd:end -->

## Interoperability and import/export

<!-- sdd:answer data.7 -->
CSV export of requests for reporting (lossy). JSON export and import of an organization’s data (lossless, schema-validated).
<!-- sdd:end -->

## Communication styles

<!-- sdd:answer data.10 -->
- Synchronous REST over HTTP
- Asynchronous message queue
<!-- sdd:end -->

## Contract languages

<!-- sdd:answer data.11 -->
- OpenAPI
- JSON Schema
<!-- sdd:end -->

## Serialization formats

<!-- sdd:answer data.12 -->
- JSON
- CSV
<!-- sdd:end -->
