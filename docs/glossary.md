# Glossary

The words SDD Studio uses, in alphabetical order. French terms used in the interface are in brackets.

| Term | Meaning |
| --- | --- |
| **.plan folder** | The folder of Markdown and JSON files that carries a project to a repository: specification, section documents, tasks, backlog, board, decisions, traceability, readiness and the security checklist. It can be exported and imported. |
| **ADR** | Architecture decision record: a decision item (ADR-…) with its context, the decision and its consequences. |
| **Agent files** | Instruction files that coding agents read at the repository root: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, Copilot and Cursor rules. |
| **AIO** | AI optimisation: making the public product description readable by AI assistants (`llms.txt`, JSON-LD, no-JavaScript summary). |
| **Answer block** | The part of a section's Markdown generated from one answer, between `<!-- sdd:answer … -->` markers. Editing it proposes a change to the answer. |
| **Baseline** [référence] | An approved, immutable snapshot of the specification at one revision. The board, publishing and handoff start from it. |
| **Board** [tableau] | The implementation board: an ordered plan of tasks made from a baseline (one card per requirement, use case, component, decision, risk and test, grouped by component, with dependencies), in five columns. |
| **Essentials** [l’essentiel] | The minimal specification level: 15 core questions (16 for some project types, which swap a few for their own) are required instead of 60, and only the sections that hold one need a review. The Complete level requires every question. Switching keeps every answer. |
| **Bundle** | An export of the specification in JSON or TOON that another workspace can import as a proposal. |
| **Card** | A unit of work on the board, linked to its specification items and pull requests. |
| **Completeness** | How much of the specification is filled in: required answers 50 %, optional answers 15 %, reviewed sections 20 %, requirements with tests 15 %. It is different from readiness. |
| **Conflict** | Two people changed the same answer from the same revision. SDD Studio shows both values instead of overwriting either. |
| **Custom question** | A question added for one project by a stack rule, an AI proposal or an author. |
| **Feature flag** | An administrator switch that turns an optional capability (board, MCP, connectors, …) on or off for the workspace. |
| **Fixture** | A reference project kept as a `.plan` folder and zip in `fixtures/`: the default example and SDD Studio itself. |
| **Implied answer** | A change to an answer inferred from an edit to the section's Markdown. It becomes a proposal. |
| **Item** | A traceable element of the specification: requirement (REQ-), use case (UC-), decision (ADR-), component (CMP-), risk (RISK-) or test (TEST-). |
| **Local-only project** | A project whose content never leaves the server: only a local Ollama model can be used, never a cloud AI provider or external renderer. |
| **Matrix answer** | One choice per row, for example a sensitivity level for each data category. |
| **MCP** | Model Context Protocol: how coding agents connect to SDD Studio with a project token to read the specification and board and propose changes. |
| **Module** [module] | One of the 14 parts of the specification, such as Business & discovery or Security & privacy. Each is a section of the document. |
| **Proposal** [proposition] | A suggested change from AI, an import, an agent or a Markdown edit. Nothing changes until someone with review rights accepts it. |
| **Readiness** [préparation] | Whether the specification can become a baseline: every required answer, every section reviewed, no contradictions, open conflicts or pending decisions. |
| **Revision** | The version number of the specification. Every accepted change increases it; every write says which revision it started from. |
| **Roles** | Owner, Admin, Editor, Reviewer and Viewer. Editors change content; Reviewers approve it; Admins and Owners manage members and settings. |
| **Security checklist** | Coverage of 15 security areas (OWASP ASVS, NIST SSDF) by the specification's answers. It shows design coverage, not an audit of the code. |
| **Skill** | A folder with `SKILL.md` and reference files that teaches an AI agent this project's design; exported per project and checked against Anthropic's skill authoring rules (`pnpm skills:check`). |
| **Slider answer** | A number within bounds, such as an availability target in percent. |
| **Spec Kit** | GitHub's spec-driven development workflow (constitution, specify, clarify, plan, tasks, analyze, implement). SDD Studio shows its phases and exports its layout. |
| **Stack** [pile technologique] | The technologies chosen for each layer (frontend, backend, data, …) before the interview. The stack fills in answers and adds questions. |
| **Three-way merge** | Combining a proposal with changes made since it was created, field by field, from their common revision. |
| **TOON** | Token-Oriented Object Notation: a compact, lossless form of JSON for language models. Bundles export and import in TOON as well as JSON. |
| **Traceability** | The links between items: which components implement which requirements, which tests verify them, which decisions they depend on. |
| **Use case** [cas d’utilisation] | A goal of an actor described as a trigger, preconditions, a main flow, alternate flows and an outcome. |
