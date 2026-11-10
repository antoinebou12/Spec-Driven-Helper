# Browser review - 2026-09-29

The owner's eight annotated comments are tracked as TASK-128 through TASK-135 in `tasks.md`. Work already implemented during CHG-027 is retained, including the AI builder added separately in CHG-028. The review does not authorize deleting specification answers or catalog records.

| Task | Acceptance | Verification |
| --- | --- | --- |
| 128 | One labeled export selector, grouped options, explicit download, all existing formats retained, no unavailable PDF | Component test, Storybook axe, browser download link and responsive layout |
| 129 | Compact summary, expandable blockers/warnings, focusable section review targets, same review/baseline guards | Component test, browser review link and axe |
| 130 | No radar page, menu item or public feature claim; old catalog bookmarks open Stack | Browser redirect and stack catalog regression |
| 131 | No standalone Open Questions page; old bookmarks open Specification; actual questions still editable | Browser redirect and domain regression |
| 132 | Hide/show outline with aria-expanded/controls; saved preference; no empty columns when collapsed | Browser collapse/reopen/reload at desktop and phone sizes |
| 133 | Sections disclosure supports keyboard and keeps all progress rows and navigation | Component and browser checks |
| 134 | Top-bar search, shortcut, Escape, localized results, old search link, no sidebar duplication, hidden when flag disabled | Component API/error/role tests and browser dialog journey |
| 135 | User/admin guides in site navigation/search, working links, actual roles and unavailable capabilities stated | Docs build/link tests and browser docs smoke |

## Native conversation acceptance (additional comments)

| Task | Acceptance | Verification |
| --- | --- | --- |
| 144 | Ask AI opens an in-page conversation; requests are consumed once; focused question suggestions use the existing scoped proposal contract | Agent tests, native-chat journey and proposal acceptance |
| 145 | Help/example and AI actions in question header; hints hidden initially; answer controls and autosave retained | Form story, component checks and browser editing |
| 146 | Run diagnostics in Settings; feature and cancel-role gates; advanced background requests remain possible | Settings tests and native-chat journey |
| 147 | Chat default, Form alternative, outline navigation, narrow tabs, local guided fallback when AI disabled | Interview and native-chat journeys, desktop/phone screenshots and axe |
| 148 | Filename/status visible; Preview default; document toolbar hidden until toggle; short labels without lost accessible names | Document panel component/story, keyboard editing journey and axe |

## Scope retained in the broader plan

TASK-111/112: concise remaining views and project bulk/detail workflows. TASK-113: remaining settings consolidation. TASK-115: in-app Storybook/design-system discovery. TASK-116/119: contextual AI beyond Builder and measured Ollama guidance. TASK-117: SMTP and 2FA. TASK-118: enterprise/team/project hierarchy and inherited RBAC. TASK-120/121: authenticated observability, ingestion, JSON configuration exports and OLAP requirements. TASK-122: Teams connector. TASK-123: frontend/backend/documentation skills. TASK-124: deployment/use-case diagrams. TASK-125: optional AWS template only, deferred, never the default stack. TASK-052 still needs a GitHub-hosted run; local act verification is not that run. TASK-063 is PostgreSQL-only, with no maintained MongoDB migration/runtime.

## Verification record

- Typecheck and lint passed. All 93 frontend tests passed, including new export selection, search/error/role/French, readiness and Overview disclosure tests.
- All four navigation/documentation browser tests passed, plus three workspace journeys (editing/proposals/baselines, stale-write conflict, keyboard/phone) and two governance journeys. Verified desktop 1440 px, tablet 919 px and phone 390 px; axe passed on affected views. Screenshots are under `test-results/review-*.png`.
- Storybook built; 64 stories across light English, dark English and light French passed axe. The runner requests reduced motion so entrance opacity is not mistaken for a settled contrast failure; the addon stays in error mode.
- Documentation build: 16 pages, no broken links. New Administration and access guide is visible in the published navigation and search index.
- The expanded fixture exposed an existing MCP task-export budget mismatch. The tool preview is now capped at 24,000 characters, advertises truncation and directs clients to the complete tasks resource; all eight MCP quality checks pass. No task records are dropped from the resource or exported files.
- Docker rebuild is tracked in CHG-029. Broader tasks listed above remain pending or partial; these UI checks do not complete them.
