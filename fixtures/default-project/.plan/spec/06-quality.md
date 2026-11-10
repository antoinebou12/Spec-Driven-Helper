# Nonfunctional requirements

Turn expectations into measurable targets.

## Latency and throughput targets

<!-- sdd:answer quality.1 -->
Request list p95 < 300 ms server time at 50 req/s. Pages interactive within 2.5 s on a mid-range laptop.
<!-- sdd:end -->

## Concurrency and capacity

<!-- sdd:answer quality.2 -->
250 concurrent sessions, 80 req/s peak, 50 GB of attachments in year one, with 2× headroom.
<!-- sdd:end -->

## Availability target

<!-- sdd:answer quality.3 -->
99.5% monthly during business hours (8:00–18:00 ET); maintenance announced 48 hours ahead.
<!-- sdd:end -->

## Accessibility standard

<!-- sdd:answer quality.4 -->
WCAG 2.2 AA for all screens; axe checks in CI; manual NVDA review before each release.
<!-- sdd:end -->

## Scaling strategy

<!-- sdd:answer quality.5 -->
API containers scale out at 70% CPU up to 6 instances; the database is the first bottleneck — review at 60% storage.
<!-- sdd:end -->

## Resilience and recovery targets

<!-- sdd:answer quality.6 -->
Notifications queue for 24 hours if email is down. Database RPO 15 minutes, RTO 2 hours.
<!-- sdd:end -->

## Maintainability requirements

<!-- sdd:answer quality.7 -->
Domain code ≥ 80% branch coverage; dependencies updated monthly; each module has a README with its contracts.
<!-- sdd:end -->

## Verification method for each target

<!-- sdd:answer quality.8 -->
| Target | Method | Tool | Frequency |
| --- | --- | --- | --- |
| p95 < 300 ms at 50 req/s | Load test | k6 | Before each release |
| 99.5% availability | SLO monitoring | Prometheus | Continuous |
| WCAG 2.2 AA | Automated and manual audit | axe, NVDA | Each release |
<!-- sdd:end -->

## Availability target

<!-- sdd:answer quality.11 -->
99.9 %
<!-- sdd:end -->

## Response time target (p95)

<!-- sdd:answer quality.12 -->
0.5 s
<!-- sdd:end -->
