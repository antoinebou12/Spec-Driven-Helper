## Purpose

Allow teams to exchange specification contracts and task handoffs with OpenSpec while retaining SDD Studio review and revision safeguards.

## ADDED Requirements

### Requirement: Export recorded contracts
The system SHALL export capability specifications, recorded scenarios, source mappings and project context without inventing missing behavior or claiming unperformed validation.

#### Scenario: Incomplete acceptance criteria
- **WHEN** a requirement lacks recorded WHEN/THEN scenarios
- **THEN** export diagnostics identify it and the downloaded bundle is labeled draft

### Requirement: Preview and review imports
The system SHALL preview supported snapshot and delta files without writes, require explicit change selection when ambiguous, and stage specification changes as proposals.

#### Scenario: Stale preview
- **WHEN** a confirmation uses an obsolete specification revision
- **THEN** the request is rejected without changing the specification

#### Scenario: Unsafe input
- **WHEN** uploaded paths traverse directories or exceed supported limits
- **THEN** the import is rejected without executing its content

### Requirement: Separate task confirmation
The system SHALL import tasks only through a separate authorized revision-guarded action while retaining existing task identities, dependencies and pull-request links.

#### Scenario: Specification-only import
- **WHEN** a user confirms a specification proposal from a bundle containing tasks
- **THEN** no board tasks change until the user separately confirms their import
