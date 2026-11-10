# Security completeness checklist

Coverage 4% — design coverage of OWASP ASVS and NIST SSDF areas, not a certification of the implementation.

Status: `[x]` covered, `[/]` partly, `[ ]` missing, `[-]` not applicable.

- [ ] **Threat model and trust boundaries** (ASVS V1 · SSDF PW.1) — answer: Threat model and trust boundaries (security.2)
- [ ] **Authentication and multi-factor** (ASVS V6) — answer: Authentication and session policy (security.3), Multi-factor authentication (security.12)
- [ ] **Authorization and roles** (ASVS V8) — answer: Role and permission matrix (security.4)
- [ ] **Sessions, cookies and client storage** (ASVS V7 · V3) — answer: Cookies and client-side storage (security.11)
- [ ] **Input validation and error contracts** (ASVS V2 · V16) — answer: Validation and error contracts (data.4)
- [ ] **Data classification** (ASVS V14) — answer: Data classification (security.14), Assets and data classification (security.1)
- [ ] **Encryption in transit and at rest** (ASVS V11 · V12) — answer: Encryption requirements (security.6)
- [/] **Secrets and key management** (ASVS V13 · SSDF PS.1) — answer: Secrets and key management (security.5)
- [ ] **Privacy obligations** (ASVS V14 · GDPR/Law 25) — answer: Personal data processed (security.13), Privacy and applicable obligations (security.8)
- [ ] **Audit logging and monitoring** (ASVS V16) — answer: Audit and incident evidence (security.7), Logs metrics and traces (operations.2)
- [ ] **Dependencies and supply chain** (SSDF PW.4 · PS.3) — answer: Allowed dependency licenses (governance.10), License compliance in the pipeline (governance.11), Policy as code and IaC scanning (delivery.19)
- [ ] **Security testing** (SSDF PW.7 · PW.8) — answer: Performance and security tests (testing.5)
- [ ] **Incident response** (SSDF RV.1 · RV.2) — answer: Incident response and escalation (operations.4)
- [ ] **Backup, restore and disaster recovery** (ASVS V14) — answer: Backup and restore verification (operations.6), Disaster recovery RPO and RTO (operations.7)
- [-] **AI misuse and prompt injection** (OWASP LLM Top 10)
