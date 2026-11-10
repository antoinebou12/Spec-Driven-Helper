# Engineering conventions

Give contributors a shared vocabulary.

## Naming and nomenclature

<!-- sdd:answer conventions.1 -->
camelCase variables, PascalCase components, kebab-case files; “request” (not ticket or case) everywhere; identifiers REQ-, UC-, ADR-, CMP-, RISK-, TEST-.
<!-- sdd:end -->

## Repository and folder structure

<!-- sdd:answer conventions.2 -->
apps/web, apps/api, packages/shared; unit tests beside code as *.test.ts; end-to-end tests in tests/e2e; specification in .plan/.
<!-- sdd:end -->

## Backend and frontend boundaries

<!-- sdd:answer conventions.3 -->
Authorization and persistence only in apps/api; zod schemas in packages/shared; the web app never imports from apps/api.
<!-- sdd:end -->

## Lint and formatting rules

<!-- sdd:answer conventions.4 -->
Prettier (100 columns, single quotes) and ESLint with typescript-eslint; CI fails on any warning.
<!-- sdd:end -->

## Error handling conventions

<!-- sdd:answer conventions.5 -->
Throw HttpError with a status and a safe message; unexpected errors are logged server-side and return a generic message.
<!-- sdd:end -->

## Documentation conventions

<!-- sdd:answer conventions.6 -->
Every pull request updates .plan/tasks.md and changes.md; architectural changes add an ADR.
<!-- sdd:end -->

## Do and do not examples

<!-- sdd:answer conventions.7 -->
| Do | Don’t | Why |
| --- | --- | --- |
| Validate with the shared schema | Hand-written checks in routes | One source of truth for contracts |
| Filter by organizationId in the data layer | Filter in the UI only | Prevents cross-tenant leaks |
<!-- sdd:end -->
