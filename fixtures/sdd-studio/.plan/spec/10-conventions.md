# Engineering conventions

Give contributors a shared vocabulary.

## Naming and nomenclature

<!-- sdd:answer conventions.1 -->
**TypeScript / JavaScript** — [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)

| Element | Convention | Example |
| --- | --- | --- |
| Files and modules | kebab-case; React components PascalCase | `user-service.ts, UserCard.tsx` |
| Folders and packages | kebab-case | `src/features/order-history/` |
| Types, classes, interfaces | PascalCase | `OrderSummary, PaymentStatus` |
| Functions and methods | camelCase | `calculateTotal()` |
| Variables and parameters | camelCase | `retryCount` |
| Constants | camelCase, or SCREAMING_SNAKE_CASE for fixed values | `MAX_RETRIES` |
| Tests | *.test.ts beside the code | `user-service.test.ts` |

Avoid the I prefix on interfaces and default exports for shared modules.

**Python** — [PEP 8 — Style Guide for Python Code](https://peps.python.org/pep-0008/)

| Element | Convention | Example |
| --- | --- | --- |
| Files and modules | snake_case, short and lower case | `user_service.py` |
| Folders and packages | snake_case packages (no hyphens) | `src/order_history/` |
| Types, classes, interfaces | PascalCase; exceptions end in Error | `OrderSummary, PaymentError` |
| Functions and methods | snake_case | `calculate_total()` |
| Variables and parameters | snake_case; _leading underscore when internal | `retry_count, _cache` |
| Constants | SCREAMING_SNAKE_CASE at module level | `MAX_RETRIES` |
| Tests | tests/test_*.py | `tests/test_user_service.py` |

Distribution names may use hyphens (my-package); the import package uses underscores (my_package).
<!-- sdd:end -->

## Repository and folder structure

<!-- sdd:answer conventions.2 -->
**TypeScript / JavaScript**

```text
package.json
tsconfig.json
src/
  features/<feature>/
  lib/
  index.ts
tests/
  e2e/
```

Tools: ESLint (typescript-eslint), Prettier or Biome, EditorConfig.

**Python**

```text
pyproject.toml
src/<package_name>/
  __init__.py
  <module>.py
tests/
  test_<module>.py
```

Tools: Ruff (lint and format), mypy or pyright, uv or Poetry.
<!-- sdd:end -->

## Backend and frontend boundaries

<!-- sdd:answer conventions.3 -->
_Not answered yet._
<!-- sdd:end -->

## Lint and formatting rules

<!-- sdd:answer conventions.4 -->
_Not answered yet._
<!-- sdd:end -->

## Error handling conventions

<!-- sdd:answer conventions.5 -->
_Not answered yet._
<!-- sdd:end -->

## Documentation conventions

<!-- sdd:answer conventions.6 -->
_Not answered yet._
<!-- sdd:end -->

## Do and do not examples

<!-- sdd:answer conventions.7 -->
_Not answered yet._
<!-- sdd:end -->
