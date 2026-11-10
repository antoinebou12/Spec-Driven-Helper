# Traceability

| ID | Type | Title | Status | Depends on | Referenced by |
| --- | --- | --- | --- | --- | --- |
| REQ-001 | requirement | Customers submit a request with up to 5 attachments | accepted | — | TEST-001 tests, UC-001 satisfies, CMP-002 implements |
| REQ-002 | requirement | Customers see only their organization’s requests | accepted | — | TEST-002 tests, CMP-002 implements |
| REQ-003 | requirement | Customers see a timeline of status changes and replies | accepted | — | TEST-003 tests, UC-002 satisfies, CMP-001 implements |
| REQ-004 | requirement | Agents reply to requests from a triage queue | accepted | — | TEST-004 tests, UC-003 satisfies |
| REQ-005 | requirement | Customers receive an email when a request changes status | accepted | — | TEST-005 tests, CMP-003 implements |
| REQ-006 | requirement | All screens meet WCAG 2.2 AA | accepted | — | TEST-006 tests, CMP-001 implements |
| UC-001 | use-case | Submit a request | accepted | satisfies REQ-001 | — |
| UC-002 | use-case | Follow a request | accepted | satisfies REQ-003 | — |
| UC-003 | use-case | Triage and reply | accepted | satisfies REQ-004 | — |
| ADR-001 | decision | Modular monolith for release 1 | accepted | — | CMP-002 decides |
| ADR-002 | decision | PostgreSQL for requests, object storage for attachments | accepted | — | CMP-004 decides |
| ADR-003 | decision | Durable notification jobs in PostgreSQL | accepted | mitigates RISK-003 | CMP-003 decides |
| CMP-001 | component | Web app | accepted | implements REQ-003, implements REQ-006 | — |
| CMP-002 | component | Request API | accepted | implements REQ-001, implements REQ-002, decides ADR-001, depends-on CMP-004 | — |
| CMP-003 | component | Notification worker | accepted | implements REQ-005, decides ADR-003 | — |
| CMP-004 | component | Request store | accepted | decides ADR-002 | CMP-002 depends-on |
| RISK-001 | risk | Low customer adoption | accepted | — | TEST-007 mitigates |
| RISK-002 | risk | Cross-organization data exposure | accepted | — | TEST-002 mitigates |
| RISK-003 | risk | Email provider outage delays notifications | accepted | — | ADR-003 mitigates |
| TEST-001 | test | API integration: submit request returns ID < 2 s | accepted | tests REQ-001 | — |
| TEST-002 | test | API integration: cross-organization access returns 404 and is audited | accepted | tests REQ-002, mitigates RISK-002 | — |
| TEST-003 | test | End-to-end: customer sees agent reply in timeline | accepted | tests REQ-003 | — |
| TEST-004 | test | End-to-end: agent replies from triage queue | accepted | tests REQ-004 | — |
| TEST-005 | test | Worker integration: status email queued and retried | accepted | tests REQ-005 | — |
| TEST-006 | test | Accessibility: axe checks on all journeys | accepted | tests REQ-006 | — |
| TEST-007 | test | Pilot usability study with 3 accounts | accepted | mitigates RISK-001 | — |
