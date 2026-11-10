# Business & discovery

Start with the problem worth solving.

## Problem to solve

<!-- sdd:answer discovery.1 -->
Business customers track service requests through email threads. Support spends about 6 hours per week answering status questions, and customers cannot see progress or history in one place.
<!-- sdd:end -->

## Business goals

<!-- sdd:answer discovery.2 -->
Reduce status follow-up emails by 30% within one quarter of launch. Give every customer a single, current view of their requests.
<!-- sdd:end -->

## Stakeholders and owners

<!-- sdd:answer discovery.3 -->
| Stakeholder | Interest | Decision rights |
| --- | --- | --- |
| Customer Experience director | Fewer escalations | Approves scope and budget |
| Platform Engineering lead | Operable, secure system | Approves architecture |
| Support Operations manager | Faster responses | Consulted on workflows |
| Security architect | Tenant isolation | Approves threat model |
<!-- sdd:end -->

## Target users and personas

<!-- sdd:answer discovery.4 -->
Primary: office managers at client companies who submit and follow requests a few times a week from a laptop. Secondary: support agents who work in the tool all day and need fast triage.
<!-- sdd:end -->

## Expected users and concurrent users

<!-- sdd:answer discovery.5 -->
Launch: 2,000 registered users, 200 daily, 50 concurrent. Year one: 10,000 registered, 250 concurrent. Source: current CRM account list; confidence medium.
<!-- sdd:end -->

## Business model and budget

<!-- sdd:answer discovery.6 -->
Internal cost centre (Customer Experience). Build: 3 engineers for 4 months. Hosting under $600/month; AI assistance capped at $150/month.
<!-- sdd:end -->

## Constraints and assumptions

<!-- sdd:answer discovery.7 -->
Must run on the company Kubernetes platform and use the corporate identity provider. Assumption: customers accept email notifications — validate with 5 interviews before the pilot.
<!-- sdd:end -->

## Success metrics

<!-- sdd:answer discovery.8 -->
Status emails per week: 120 → 84 by end of Q2 (support mailbox tags). Median first response time under 4 business hours (support tool).
<!-- sdd:end -->

## Business risks

<!-- sdd:answer discovery.9 -->
| Risk | Likelihood | Impact | Mitigation | Owner |
| --- | --- | --- | --- | --- |
| Low customer adoption | Medium | High | Pilot with 3 accounts before launch | Product owner |
| Identity integration delayed | Medium | Medium | Register OIDC client in week 1 | Tech lead |
<!-- sdd:end -->
