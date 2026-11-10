## Purpose

Keep new repository changes traceable through OpenSpec while preserving the authoritative implementation and verification record in .plan.

## ADDED Requirements

### Requirement: Verified task parity
The repository SHALL require every tracked OpenSpec task to reference a .plan task and match its verified completion state.

#### Scenario: Verification remains incomplete
- **WHEN** a .plan task is marked partially verified
- **THEN** its OpenSpec checkbox remains unchecked and a checked box fails the consistency check

### Requirement: Preserve existing records
The repository SHALL adopt OpenSpec for new work only without migrating or archiving pre-existing task history.

#### Scenario: Initial adoption
- **WHEN** OpenSpec is initialized for this integration
- **THEN** existing maintenance skills and unfinished .plan tasks remain intact
