# Customer Request Portal — tasks

Status: `[x]` done, `[/]` in progress (`_(in review)_` when awaiting review), `[ ]` to do, `[-]` backlog.

## Requirements

- [x] REQ-001 Customers submit a request with up to 5 attachments — Sources: TEST-001, UC-001, CMP-002
- [x] REQ-002 Customers see only their organization’s requests — Sources: TEST-002, CMP-002
- [/] REQ-003 Customers see a timeline of status changes and replies _(in review)_ — Sources: TEST-003, UC-002, CMP-001
- [/] REQ-004 Agents reply to requests from a triage queue — Sources: TEST-004, UC-003
- [ ] REQ-005 Customers receive an email when a request changes status — Sources: TEST-005, CMP-003

## Use cases

- [x] UC-001 Submit a request — Sources: REQ-001
- [x] UC-002 Follow a request — Sources: REQ-003
- [/] UC-003 Triage and reply _(in review)_ — Sources: REQ-004

## Components

- [/] CMP-001 Web app — Sources: REQ-003, REQ-006
- [ ] CMP-002 Request API — Sources: REQ-001, REQ-002, ADR-001, CMP-004
- [x] CMP-004 Request store — Sources: ADR-002, CMP-002

## Decisions

- [x] ADR-001 Modular monolith for release 1 — Sources: CMP-002
- [/] ADR-002 PostgreSQL for requests, object storage for attachments _(in review)_ — Sources: CMP-004
- [/] ADR-003 Durable notification jobs in PostgreSQL — Sources: CMP-003, RISK-003

## Risk mitigations

- [ ] RISK-001 Low customer adoption — Sources: TEST-007
- [x] RISK-003 Email provider outage delays notifications — Sources: ADR-003

## Tests

- [x] TEST-001 API integration: submit request returns ID < 2 s — Sources: REQ-001
- [/] TEST-002 API integration: cross-organization access returns 404 and is audited _(in review)_ — Sources: REQ-002, RISK-002
- [/] TEST-003 End-to-end: customer sees agent reply in timeline — Sources: REQ-003
- [ ] TEST-004 End-to-end: agent replies from triage queue — Sources: REQ-004
- [x] TEST-006 Accessibility: axe checks on all journeys — Sources: REQ-006
- [x] TEST-007 Pilot usability study with 3 accounts — Sources: RISK-001
