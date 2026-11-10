# Scope & requirements

Define what success includes.

## In scope

<!-- sdd:answer scope.1 -->
Sign-in through company SSO, request creation with attachments, request timeline, support replies, email notifications and an agent triage queue.
<!-- sdd:end -->

## Out of scope

<!-- sdd:answer scope.2 -->
Billing changes and live chat are excluded. Native mobile apps are deferred; the web app must work on mobile browsers.
<!-- sdd:end -->

## Functional requirements and priorities

<!-- sdd:answer scope.3 -->
| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| REQ-001 | Customers submit a request with up to 5 attachments | Must | Request receives an ID within 2 seconds |
| REQ-002 | Customers see only their organization’s requests | Must | Cross-organization access returns 404 |
| REQ-003 | Customers see a timeline of status changes and replies | Must | Timeline updates within 5 seconds of a reply |
| REQ-004 | Agents reply to requests from a triage queue | Must | Reply visible to the customer within 5 seconds |
| REQ-005 | Customers receive an email when a request changes status | Should | Email sent within 2 minutes for 99% of changes |
| REQ-006 | All screens meet WCAG 2.2 AA | Must | No serious axe violations; manual NVDA pass |
<!-- sdd:end -->

## Acceptance criteria

<!-- sdd:answer scope.4 -->
Given a signed-in customer, when they submit a valid request, then it appears in their timeline with an ID within 2 seconds. Given a customer of organization A, when they open a request of organization B, then the API returns 404 and the attempt is audited.
<!-- sdd:end -->

## Dependencies

<!-- sdd:answer scope.5 -->
Identity team registers the OIDC client (week 1). Email delivery account approved by Procurement (week 3).
<!-- sdd:end -->

## Assumptions to validate

<!-- sdd:answer scope.6 -->
Attachments rarely exceed 10 MB — confirm from last quarter’s mailbox. Agents prefer a single queue over per-product queues — confirm in the pilot.
<!-- sdd:end -->

## Release milestones

<!-- sdd:answer scope.7 -->
Pilot with 3 customers on June 15 (all Must requirements pass). General availability on August 1 after the pilot review.
<!-- sdd:end -->
