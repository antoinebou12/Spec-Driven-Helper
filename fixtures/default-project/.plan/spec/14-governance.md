# Governance & handoff

Make responsibilities and next steps explicit.

## RACI responsibilities

<!-- sdd:answer governance.1 -->
| Activity | Responsible | Accountable | Consulted | Informed |
| --- | --- | --- | --- | --- |
| Approve specification baseline | Tech lead | Customer Experience director | Security architect | Support Operations |
| Release to production | Platform Engineering | Tech lead | Support Operations | Customers |
| Operate on-call | Platform Engineering | Platform Engineering lead | Support Operations | Customer Experience |
<!-- sdd:end -->

## Reviewers and approvals

<!-- sdd:answer governance.2 -->
Security section: security architect. Operations: platform lead. Baseline approval: Customer Experience director and tech lead.
<!-- sdd:end -->

## Milestones and dependencies

<!-- sdd:answer governance.3 -->
Pilot (June 15): REQ-001 to REQ-004 and REQ-006; depends on the OIDC client. General availability (August 1): all requirements.
<!-- sdd:end -->

## Readiness and unresolved decisions

<!-- sdd:answer governance.4 -->
Email provider (SES or Postmark) — owner: tech lead — by week 2 — blocks REQ-005 only.
<!-- sdd:end -->

## Contributor onboarding

<!-- sdd:answer governance.5 -->
Read .plan/README.md and the conventions; run the Docker setup in under 30 minutes; first task tagged “good first issue”.
<!-- sdd:end -->

## Implementation tasks

<!-- sdd:answer governance.6 -->
TASK-01 Request submission API (REQ-001, TEST-001). TASK-02 Organization isolation (REQ-002, TEST-002). TASK-03 Timeline and replies (REQ-003, REQ-004, TEST-003).
<!-- sdd:end -->

## Coding-agent instructions

<!-- sdd:answer governance.7 -->
Always run pnpm lint and pnpm test before finishing; keep REQ/ADR identifiers; update .plan records. Never weaken organization isolation, never edit an approved baseline, and never guess an open decision — report it.
<!-- sdd:end -->

## Project license

<!-- sdd:answer governance.8 -->
Proprietary (all rights reserved)
<!-- sdd:end -->

## Distribution model

<!-- sdd:answer governance.9 -->
Hosted service (SaaS)
<!-- sdd:end -->

## Allowed dependency licenses

<!-- sdd:answer governance.10 -->
- Permissive (MIT, BSD, Apache-2.0, ISC)
- Weak copyleft (LGPL, MPL, EPL)
<!-- sdd:end -->

## License compliance in the pipeline

<!-- sdd:answer governance.11 -->
Yes
<!-- sdd:end -->

## Specification persistence model

<!-- sdd:answer governance.12 -->
Living specification (kept in sync, drift checked)
<!-- sdd:end -->

## Large feature decomposition

<!-- sdd:answer governance.13 -->
One specification per epic or release
<!-- sdd:end -->
