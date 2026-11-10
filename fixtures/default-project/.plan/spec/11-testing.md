# Testing & quality

Connect every important promise to a test.

## Test pyramid and ownership

<!-- sdd:answer testing.1 -->
Unit tests for domain rules (developers, < 30 s); API integration tests against PostgreSQL (< 3 min); 5 end-to-end journeys (QA lead).
<!-- sdd:end -->

## Unit test boundaries

<!-- sdd:answer testing.2 -->
State transitions, permission checks and validation; no mocks of our own domain code; 80% branch coverage for packages/shared.
<!-- sdd:end -->

## Integration and contract tests

<!-- sdd:answer testing.3 -->
API tests run against PostgreSQL in Docker (Testcontainers); responses validated against the OpenAPI document; email provider replaced by a contract stub.
<!-- sdd:end -->

## End-to-end acceptance journeys

<!-- sdd:answer testing.4 -->
Sign in → submit request → agent replies → customer sees reply (REQ-001, REQ-003, REQ-004); cross-organization access denied (REQ-002).
<!-- sdd:end -->

## Performance and security tests

<!-- sdd:answer testing.5 -->
k6 load test at 2× expected peak before release; dependency and secret scanning in CI; external penetration test before general availability.
<!-- sdd:end -->

## Accessibility tests

<!-- sdd:answer testing.6 -->
axe checks in every end-to-end test (no serious violations); manual NVDA pass on the three main journeys each release.
<!-- sdd:end -->

## Fixtures and test data

<!-- sdd:answer testing.7 -->
A seed script creates 3 organizations and 50 requests with synthetic names; each run uses a fresh database.
<!-- sdd:end -->

## Quality gates and release criteria

<!-- sdd:answer testing.8 -->
Merge: lint, typecheck, unit and integration tests, no high-severity vulnerabilities. Release: end-to-end suite green and product owner sign-off.
<!-- sdd:end -->
