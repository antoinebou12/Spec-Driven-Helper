# Operations & observability

Plan for the day after launch.

## SLIs SLOs and SLA targets

<!-- sdd:answer operations.1 -->
SLI: share of API requests returning < 500 within 1 s. SLO: 99.5% over 28 days. No external SLA in release 1.
<!-- sdd:end -->

## Logs metrics and traces

<!-- sdd:answer operations.2 -->
JSON logs with request IDs and redacted cookies; RED metrics per route; OpenTelemetry traces via OTLP; logs kept 30 days.
<!-- sdd:end -->

## Alerts and on-call ownership

<!-- sdd:answer operations.3 -->
Page on-call when the 1-hour SLO burn rate exceeds 14×; business-hours rotation of 3 engineers; every alert links to a runbook.
<!-- sdd:end -->

## Incident response and escalation

<!-- sdd:answer operations.4 -->
SEV1: all customers affected — incident commander paged, status page within 15 minutes, blameless review within 5 business days.
<!-- sdd:end -->

## Operational runbooks

<!-- sdd:answer operations.5 -->
Rotate the email API key; restore from backup; drain and restart the worker; revoke a compromised session.
<!-- sdd:end -->

## Backup and restore verification

<!-- sdd:answer operations.6 -->
Nightly backups plus point-in-time recovery; encrypted off-site copies; quarterly restore test into staging.
<!-- sdd:end -->

## Disaster recovery RPO and RTO

<!-- sdd:answer operations.7 -->
Region outage: RPO 15 minutes, RTO 4 hours using restored backups in a secondary region; tested yearly.
<!-- sdd:end -->

## Operating cost and capacity review

<!-- sdd:answer operations.8 -->
Monthly cost review with Finance; alert at 80% of the hosting budget; quarterly capacity forecast.
<!-- sdd:end -->

## Around-the-clock on-call

<!-- sdd:answer operations.11 -->
No
<!-- sdd:end -->
