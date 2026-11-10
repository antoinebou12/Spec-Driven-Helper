# Users & workflows

Follow the journey, including its exceptions.

## Actors and permissions

<!-- sdd:answer workflows.1 -->
| Actor | May do | May not do |
| --- | --- | --- |
| Customer | Create and view own organization’s requests; reply | See other organizations; change status |
| Support agent | View queues, reply, change status | Change organization settings |
| Administrator | Manage organizations, users and settings | Read request content without an assignment |
<!-- sdd:end -->

## Primary user journey

<!-- sdd:answer workflows.2 -->
1. Customer signs in with SSO. 2. Opens “New request”. 3. Describes the issue and attaches files. 4. Submits. 5. Sees the request ID and status “Submitted”. 6. Receives an email when an agent replies.
<!-- sdd:end -->

## Use cases and triggers

<!-- sdd:answer workflows.3 -->
| ID | Use case | Actor | Trigger | Outcome |
| --- | --- | --- | --- | --- |
| UC-001 | Submit a request | Customer | New issue | Request tracked with an ID |
| UC-002 | Follow a request | Customer | Status question | Current status and history visible |
| UC-003 | Triage and reply | Support agent | New request in queue | Customer receives a reply |
<!-- sdd:end -->

## Business rules

<!-- sdd:answer workflows.4 -->
BR-01: A closed request can be reopened only within 14 days. BR-02: Attachments are limited to 5 files of 10 MB each. BR-03: Only agents change status.
<!-- sdd:end -->

## Error and exception paths

<!-- sdd:answer workflows.5 -->
Attachment upload fails: keep the draft, show which file failed, allow retry. Session expires: preserve the draft locally and ask the user to sign in again. Email provider down: queue notifications for 24 hours.
<!-- sdd:end -->

## States and transitions

<!-- sdd:answer workflows.6 -->
Draft → Submitted (customer) → In progress (agent) → Resolved (agent) → Closed after 14 days; Submitted → Rejected (agent, with reason).
<!-- sdd:end -->

## Accessibility needs

<!-- sdd:answer workflows.7 -->
The full request journey works with keyboard and NVDA; no step has a time limit; error messages name the field and the fix.
<!-- sdd:end -->
