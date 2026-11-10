# User guide

This guide follows one design document from an empty project to a baseline handed to a coding agent. Every step names the page in the sidebar. Viewers read, Editors write, Reviewers review and approve without editing answers, and Admins and Owners can do both and configure access. See the [role matrix](administration.md). Words in _italics_ are defined in the [glossary](glossary.md).

## 1. Create or open a project

- **Dashboard** (sidebar, next to Settings) lists every project you belong to. It shows completeness, required answers, security coverage and what is waiting for you, such as proposals to review, answers to complete and blockers.
- To start, create a project and choose its type and language (English or French). Pick **Local only** when content must never leave your server. AI then uses only your Ollama models, and diagrams render locally.
- **The shortest way to a correct specification** is on by default. Write one sentence under "What are you building?" and keep the **Essentials** level. Essentials requires 15 core questions instead of 60: the problem and its users, what is in and out of scope, the requirements with their acceptance criteria, the main journey, the system boundaries and components, the data, how people sign in, the chosen stack, the end-to-end journeys and the environments. The list follows the project type: a library answers its public API and packaging instead of sign-in and environments, a device its test matrix and packaging instead of sign-in, mobile and desktop apps add packaging, and data or AI systems add model evaluation (15 or 16 questions). If an AI is set up, it drafts those answers from your sentence as a _proposal_ to review (anything the sentence does not say is marked unknown, never invented); without one, the message says so and you answer in the conversation. To ask again later, use **Overview > Draft the essentials with AI**; it reuses the project description, so nothing needs retyping. Choose **Complete** to require every question of the 14 modules, or change it later in **Settings > Project**: switching keeps every answer, and only what readiness requires changes.
- To start from existing work, open **Overview > Import existing work**. Choose a Git repository or documents, check the findings in the dialog, and confirm. The import never changes the specification directly. It creates a _proposal_ that you accept in **Proposals**.

## 2. Build with AI

A project opens on **Build with AI**: a conversation on the left and the document on the right, so you can build the whole document without changing pages.

The conversation is a guided interview. It asks one question at a time, as a card with the control that fits it, and your answer is saved into the document at once. It needs no AI and no waiting, so it works offline, in local-only projects and when no model is set up.

- **Answer with the control that fits.** Text answers send with **Enter** (**Shift+Enter** for a new line). A choice or yes/no sends when you click it. Several choices, sliders and grids have a **Send** button. Tables open in a dialog, and requirement tables can be turned into traceable requirements in Specification. **Why we ask** explains the question and shows an example.
- **Other ways to reply.** **Skip for now** sets the question aside; the assistant offers to come back to skipped questions at the end. **Not sure yet** records it as unknown, and unknown answers block the baseline until answered. **Doesn't apply** asks for a reason. **Suggest with AI** asks the AI for an answer, which arrives as a proposal.
- **Move around.** **Answer in chat** on any question of the document asks it in the conversation, and **Next question** moves on and sets the open question aside. Only the newest question stays open. When the required questions are done, the assistant offers the skipped and unknown ones, then the optional ones, then readiness.
- **Talk to the AI.** Type anything in the box at the bottom and the AI answers. When you state a fact, it becomes a **proposal** in the conversation: accept it, reject it or open its details. Nothing the AI suggests changes the document until a proposal is accepted; your own answers are saved as you give them.
- **Answers you can interact with.** Ask the AI to compare options, walk through a flow or show some numbers, and it can answer with an interactive card instead of a paragraph. A **comparison** scores each option against what matters: drag a weight and the ranking follows, open **Scores** for the details, then **Record … as the decision**. **Steps** play through a flow one step at a time (**Previous**, **Play**, **Next**), with **Use these steps in the document**. A **chart** shows values beside each bar, the limit when there is one, and a **Table** view. Estimates say where they come from. The buttons send an ordinary message, so what the AI records still arrives as a proposal; nothing changes the document on its own. These answers need a model that can call tools; in local-only projects with a small model, the AI answers in prose.
- **Watch the document grow.** Each section shows its progress. Open one to read its answers or **Edit** a simple answer in place; answers that just changed glow for a moment. The section of the current question opens on its own.
- **The model.** Pick it at the top; with Ollama it runs on your machine and is loaded as soon as the page opens. Without one the top bar says "Guided questions only". **New conversation** starts over, and the conversation is otherwise kept in this browser. Motion follows your system's reduced-motion setting.

## 3. Overview

Open **Specification visualizer** to explore required-answer progress and recorded relationships between requirements, components, decisions and tests. Select a section, then **Open section** to continue the conversation or edit its answers. Filter and page through the item list. The same view is available in an MCP Apps assistant through `show_specification`; its **Improve with AI** action asks the assistant for proposals that you review in SDD Studio. See [MCP setup and limits](ai-readiness.md#visualize-and-improve-a-specification-in-your-assistant).

Overview shows where the project stands: the completeness score, the next useful action and the _Spec Kit_ workflow. The score explanation, workflow details and revision history are folded away. The Sections heading also folds the progress list; opening it restores the links to each section.

## 4. Technology stack

Drag technologies from the catalog into the layers (frontend, backend, data, infrastructure as code, development tools and more). Each technology in the catalog also has an **Add to…** button, which works from the keyboard. **Prefer LTS versions** picks long-term-support versions. A chosen technology can answer questions for you. For example, choosing PostgreSQL fills the data-storage answers. **What your stack can fill in** lists these answers before you apply them. The licence check below the stack flags licences that conflict with the project's licence policy. The naming-conventions guide lists the file and folder conventions for the languages in your stack.

## 5. Specification

The specification has 14 modules, from discovery to operations. The page has three parts:

- **Sections** (left): the outline of modules and their questions. The **Sections** toggle hides or shows it and remembers your choice.
- **Chat** (default): answer one question at a time using the guided conversation. Selecting an unanswered question brings it into the conversation once; selecting an answered question opens Form for editing. Switching sections does not record a skipped answer. Your own answers save directly; AI suggestions remain proposals.
- **Form**: direct editing with concise controls. The book icon expands help and examples; the sparkle opens a contextual conversation on the same page. Unknown answers block approval; N/A requires a reason. The selected mode is remembered.
- **Document** (right): filename and status stay visible and the readable preview opens by default. The **Tools** icon reveals Preview, Edit, Diagram, History and Refresh. Closing the tools returns to Preview. Markdown changes inside a _managed answer block_ become proposals; other text saves directly.
- **Diagrams**: Tools > Diagram > Generate sends recorded answers to the configured UML MCP renderer. Choose the current document or all missing diagrams. These are evidence maps, not inferred architecture: links group recorded answers and labels are abbreviated. Review the resulting proposals before they appear in documents. Empty sections are skipped and existing diagrams are kept; failures stop the batch and leave earlier proposals available. Local-only projects cannot use external rendering. Administration must allow the read-only `generate_uml` tool with structured `{ success: true }` results. Accepted diagrams accompany `spec.md`, `PRODUCT.md` and `DESIGN.md` in the implementation bundle. No background uploads occur when opening a document.

On narrow screens the questions and the document are two tabs. Every save carries the revision it started from. If someone else saved first, a conflict dialog shows both versions. Nothing is overwritten silently.

**Search** is the magnifier in the top bar, or **Ctrl+K** (**⌘K** on a Mac). It searches the current project only, and can search by meaning when the administrator has set up an embedding model.

## 6. Requirements & decisions

Add requirements, decisions, risks, tests and use cases, then link them: a test _tests_ a requirement, a decision _mitigates_ a risk, and two items can _contradict_ each other. A requirement needs measurable acceptance criteria and at least one linked test before the baseline can be approved.

## 7. Proposals

Anything that did not come from your own typing arrives here: AI answers, imports, stack suggestions, Git changes and bundle imports. Open a proposal to see the change against the current revision. Each proposal lists its assumptions, sources and follow-up questions. Reviewers **Accept changes** or **Reject** it, with an optional reason. When the specification has moved on since the proposal was made, **Rebase onto latest** carries it forward. Changes that overlap are shown side by side, and you choose which version to keep. **Ask AI** opens a streamed conversation on this page, without a modal. AI changes still arrive as proposals.

## 8. Readiness & baselines

- **Next step** names the most important thing left to do.
- **Blockers by kind** groups what stops approval: required answers, unknown answers, sections not reviewed, draft decisions, untested requirements, items to review, contradictions and open conflicts. **Fix** opens the place to fix each one.
- **Warnings** do not block approval. They are folded away.
- **Section reviews**: a Reviewer marks a section reviewed once all its required questions are answered. At the Essentials level only the nine sections that hold an essential question need a review; the others say "Not required".
- **Review all and approve**: when reviews are all that stands in the way, a Reviewer can do both in one action. It marks the complete sections reviewed, approves the revision as the baseline and creates the tasks, and it changes nothing if the approval cannot go through.
- **Baselines**: when nothing blocks, a Reviewer approves the current revision as a baseline. A baseline never changes, and publishing and the board start from it: approving one creates the board's tasks.
- **Security checklist**: 15 areas from OWASP ASVS and NIST SSDF, each met, partial, missing or not applicable, with links to the missing questions.

## 9. Implementation board

When a Reviewer approves a baseline, the specification is correct and the project is split into tasks automatically: no extra click. The tasks come in this order: **Foundations** (one per stack layer you chose), **Decisions**, then **one epic per component** with its requirements by priority (must, should, could), the tests that verify each, and the component's own task last, then requirements no component implements, **use cases** (each waits for its requirements), risk mitigations and any loose tests. A requirement with no test gets a "Write tests for …" task, and "won't" items go to the backlog. A card in **To do** that still waits for other cards says **Waits for …**; the cards that can start now are the ones that do not.

The board also lists **gaps the task plan found in the specification**, such as a requirement no component implements or one without acceptance criteria, so you can close them. **Refresh from baseline** updates the plan after a newer baseline; it adds tasks and never deletes a card, and cards you already started keep their column, assignee and pull requests. You can also import an existing `.plan/tasks.md`; its `— After: REQ-001` lines become dependencies. You can move a card by dragging it or with its **Move…** button. **Export .plan** writes the board back to `tasks.md`. Paste a pull-request link on a card to see the pull request's status, read-only, from GitHub, GitLab or Azure DevOps.

## 10. Publish & handoff

Choose an **Export format** from the grouped dropdown, then select **Download**. Changing the format does not start a download. Only the selected format's description is shown. Exports are grouped by who will use them:

| Group | Formats | Use it to |
| --- | --- | --- |
| For coding agents | Implementation bundle, Agent files, Claude skill, Spec Kit, OpenSpec | hand the design to coding agents or a specification workflow |
| Documents to read and share | Printable HTML, PDF (when the publisher is configured), Markdown, LaTeX | give reviewers and stakeholders a readable document |
| Data and backups | JSON, TOON, XML | keep a lossless copy with JSON or TOON, or an export-only XML document |

**OpenSpec** shows diagnostics before download and labels incomplete bundles as drafts. Import it through **Overview > Import existing work > OpenSpec**: preview a folder or ZIP, select a change if needed, then propose specification changes for review. Task imports have a separate confirmation and preserve existing PR links and dependencies. See [OpenSpec exchange](openspec.md) for formats, limits and repository workflow.

**Claude skill** downloads a folder named after the project, such as `customer-request-portal-spec`; unzip it into `.claude/skills/` (this project) or `~/.claude/skills/` (all projects). Its `SKILL.md` is short: a checklist, which parts of the design must be followed exactly and which are open to judgement, and a list of reference files that Claude opens only when the task needs them (product, design, items by type, security, and one file per section). Sections nobody has answered yet are listed as open instead of exported as empty files. The skill is a snapshot of one revision, so export it again after the specification changes. **Agent files** also include a `maintain-spec` skill that keeps `.plan/` in step with code changes.

**Git and GitHub** writes the bundle to a new branch, and opens a pull request on GitHub. It asks for your confirmation first and never force-pushes. **Import changes from Git** turns edits made in the repository into a proposal. The **.plan folder** section exports or imports the `.plan/` folder that coding agents keep up to date.

## 11. Settings

The top bar holds the language, the theme and **Display preferences** (font and text size). The theme matches your system's light or dark setting until you pick Light or Dark there; the app also follows the system's increased-contrast and reduced-motion settings. On a phone, Dashboard, Settings and Sign out are in the **Views** menu.

- **Integrations**: MCP tokens for coding agents, and connectors.
- **Workspace users** and **Members**: workspace invitations and project membership respectively.
- **AI providers**: provider credentials and model defaults.
- **AI activity**: background run history, event details and cancellation (Editors and above). Advanced background requests, including the isolated Claude Agent when configured, remain available here. Interactive chat activity stays in the conversation. The AI feature switch hides this tab.
- **Administration** (Admins and Owners): local Ollama diagnostics, feature switches and observability.
- **Audit**: recorded project activity. See [Administration and access](administration.md) for permissions, defaults and troubleshooting.

## Retired pages and missing actions

Technology radar and the standalone Open Questions page are no longer separate destinations. Old bookmarks open Technology stack and Specification respectively. The stack catalog remains available; unanswered or unknown answers still appear in Specification and readiness checks. Search is available in the top bar rather than the sidebar and only returns sections from the current project.

When a control is missing, first check your project role, then ask a workspace administrator whether its feature is enabled. A disabled feature is also refused by the API. Hiding a page does not grant or revoke membership.

## Keyboard

**Alt+1** to **Alt+9** and **Alt+0** open the pages in sidebar order. **Ctrl+K** opens search. The keyboard-shortcuts dialog lists them all.
