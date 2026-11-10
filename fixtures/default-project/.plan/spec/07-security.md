# Security & privacy

Know what you protect and who can access it.

## Assets and data classification

<!-- sdd:answer security.1 -->
| Asset | Classification | Owner | Location |
| --- | --- | --- | --- |
| Request content and attachments | Confidential | Customer Experience | PostgreSQL, object storage and backups |
| User identities | Confidential | Platform Engineering | PostgreSQL |
| Email API key | Restricted | Platform Engineering | Vault |
<!-- sdd:end -->

## Threat model and trust boundaries

<!-- sdd:answer security.2 -->
Browser→API: session hijacking — HttpOnly SameSite cookies, origin checks. API→DB: cross-tenant reads — organization filter enforced in the data layer (RISK-002). Worker→Email: key leakage — key only in the vault.
<!-- sdd:end -->

## Authentication and session policy

<!-- sdd:answer security.3 -->
Corporate OIDC with MFA enforced by the IdP; 8-hour sessions in HttpOnly cookies; invitation-only provisioning.
<!-- sdd:end -->

## Role and permission matrix

<!-- sdd:answer security.4 -->
| Role | Allowed | Denied | Scope |
| --- | --- | --- | --- |
| Customer | Own organization’s requests | Status changes, other organizations | Organization |
| Support agent | Assigned queues, replies, status | Organization settings | Assigned queues |
| Administrator | Users and settings | Unassigned request content | Workspace |
<!-- sdd:end -->

## Secrets and key management

<!-- sdd:answer security.5 -->
Secrets in the cloud vault, injected at runtime, rotated every 90 days; secret scanning on every pull request.
<!-- sdd:end -->

## Encryption requirements

<!-- sdd:answer security.6 -->
TLS 1.2+ everywhere; storage encryption by the database service; the email API key is never stored in the database.
<!-- sdd:end -->

## Audit and incident evidence

<!-- sdd:answer security.7 -->
Audit role changes, exports, denied cross-organization access and settings changes with actor, time and target; keep 1 year.
<!-- sdd:end -->

## Privacy and applicable obligations

<!-- sdd:answer security.8 -->
Customers in Québec and Ontario: Québec Law 25 and PIPEDA likely apply. Privacy officer confirms and completes a privacy impact assessment by week 4.
<!-- sdd:end -->

## Cookies and client-side storage

<!-- sdd:answer security.11 -->
- Session cookie (HttpOnly, Secure)
- SameSite=Lax or Strict
- CSRF protection
- Preferences in local storage
- No third-party cookies
<!-- sdd:end -->

## Multi-factor authentication

<!-- sdd:answer security.12 -->
Yes
<!-- sdd:end -->

## Personal data processed

<!-- sdd:answer security.13 -->
Yes
<!-- sdd:end -->

## Data classification

<!-- sdd:answer security.14 -->
| Item | Choice |
| --- | --- |
| Personal data | Confidential |
| Credentials and secrets | Restricted |
| Payment data | Not handled |
| Business documents | Confidential |
| Logs and telemetry | Internal |
| Backups | Confidential |
<!-- sdd:end -->
