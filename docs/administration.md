# Administration and access

Use Settings to manage the current project and workspace. Tabs and actions depend on your role and enabled features. This guide describes the current implementation; enterprise/team inheritance, SMTP delivery and two-factor authentication are planned, not available settings.

## Roles

Project actions use the effective project role. Workspace-level administration uses the workspace role. Roles are capability sets, not a simple ladder: Reviewer is not an Editor.

| Action | Viewer | Editor | Reviewer | Admin / Owner |
| --- | --- | --- | --- | --- |
| Read permitted project content and search | Yes | Yes | Yes | Yes |
| Edit answers and request AI/import proposals | No | Yes | No | Yes |
| Review proposals and sections, approve baselines | No | No | Yes | Yes |
| Manage project members and configuration | No | No | No | Yes |

### Who can grant which role

Root and administrator access cannot be created by accident or by escalation. The rules are enforced by the server for the workspace and for every project:

- **The owner (root) is never granted through the application.** No role change, invitation, sign-up or single sign-on flow can create one. The workspace owner is set at deployment with `BOOTSTRAP_EMAIL`, and a project's owner is the person who created it.
- **Only an owner grants administrator access,** whether by invitation or by changing a role. Administrators manage Editors, Reviewers and Viewers, and cannot change or remove another administrator or an owner.
- **Nobody changes their own role,** so no one can promote themselves.
- Invitations are checked again when they are accepted: one for an owner is refused, and one for an administrator counts only while the person who issued it is still an owner. Sign-up and single sign-on without an invitation only ever request a disabled Viewer account that an administrator must activate.
- Refused attempts to reach owner or administrator access are recorded in the audit log (`role.escalation-denied`).

If the only owner is lost, the operator restores access by setting `BOOTSTRAP_EMAIL` and `BOOTSTRAP_PASSWORD` for a new account and restarting.

The server checks access, even for bookmarked URLs or direct API calls. Do not use hidden navigation as a security boundary. Changing an answer invalidates affected reviews; a stale revision returns a conflict instead of replacing another person's changes.

## First sign-in and local origins

The bootstrap owner uses the operator's `BOOTSTRAP_EMAIL` and `BOOTSTRAP_PASSWORD`; there is no universal production password. Consult your local environment configuration without sharing its secrets. Account registration is invitation-only by default; a self-registration request, when enabled, needs administrator activation. Company SSO and Google need operator configuration.

For a local deployment use the origins configured in `APP_ORIGIN` and `APP_ALLOWED_ORIGINS` (`COMPOSE_APP_ORIGIN` supplies the primary origin in Compose). A request-origin 403 means the browser origin is not allowed; it is different from a 401 for a missing or expired session. Include the exact scheme, hostname and port of the local web client, including `localhost` versus `127.0.0.1`, then restart the affected services. Keep the allow-list explicit, never disable origin checks. See [Installation](installation.md) for the supported environment settings.

## Feature switches and integrations

Settings > Administration contains workspace feature switches. Disabled capabilities disappear from navigation/actions and their protected API routes reject requests. Read-only catalog access is still needed by the stack picker even when catalog editing is disabled.

Settings > Integrations contains coding-agent MCP access and external connectors. Project agent tokens act with the token owner's permissions and must be treated as secrets. AI and imports create proposals for human review; a configured connector is not automatically connected, and publishing an external issue requires an explicit user action. See [AI readiness](ai-readiness.md) for MCP capabilities and [User guide](user-guide.md) for project workflows.

## Local AI and semantic search

Configure provider models in AI providers and inspect the Ollama connection in Administration. The server's Ollama address must be reachable from its container, not just from the host browser. Local-only projects must use local models with no cloud fallback. A generation model and an embedding model serve different purposes.

### NVIDIA NIM

NVIDIA NIM is an AI provider like OpenAI and Anthropic. The free hosted endpoint needs only an API key: sign in at [build.nvidia.com](https://build.nvidia.com), open a model, choose "Get API key", then paste the key under Settings > AI providers > NVIDIA NIM and give a default model. Keys are stored encrypted, are never shown again and are never written to logs or the audit log. The free tier is rate limited, so a busy workspace can see "request failed (429)"; wait a minute and retry. NVIDIA offers it for trying models and prototyping: read its terms before sending real project content through it, or run your own NIM server.

- **Models.** The provider lists the catalog's chat models only (embedding, safety and vision models are hidden). The Build with AI conversation uses tool calls, and not every catalog model supports them; pick one that does, for example `openai/gpt-oss-20b` or `mistralai/mistral-large-2-instruct`. A model without tool support fails with a hint instead of a silent error.
- **Your own NIM server.** Set `NIM_BASE_URL` (for example `http://nim:8000/v1`) for the API and the worker. The provider then needs no key and shows "Uses your own NIM server". The address must be a plain http(s) URL without a user name or password; anything else is refused. Inside Docker, `localhost` is the container: use `host.docker.internal` or a service name.
- **Local-only projects never use NIM.** Even a self-hosted NIM is a network service, so local-only projects keep using Ollama only; the hosted endpoint sends project content to NVIDIA.
- **Check the connection.** `NVIDIA_API_KEY=nvapi-… pnpm nim:check` lists models, streams a reply and tries a tool call; set `NIM_BASE_URL` instead to check a self-hosted server.

Use top-bar Search for the current project. Text search does not require a vector index. Search by meaning needs configured embeddings; Editors, Admins and Owners can open Semantic index and rebuild it. Rebuild after changing the embedding model. Read-only users can search but cannot trigger indexing. Empty results are not evidence that indexing succeeded: inspect the error shown by the request and the server diagnostics.

## Example data

Projects created with **Start from the complete example project** are listed under **Settings > Administration > Example data**. **Remove example projects** deletes them for everyone, with their revisions, proposals, baselines, board, AI runs, files and search index, after a confirmation. Your own projects are not affected, and the audit log keeps a record of the removal. Only administrators and owners see this section.

## Audit and observability

Audit records project actions such as proposal acceptance, exports and token creation. Administration shows API metrics and job failures, along with configured observability links. Grafana, Prometheus and traces require the optional observability deployment and their own access controls; they are not automatically embedded or authenticated by the app. Keep metrics endpoints and dashboards private, redact logs, and never publish provider credentials or raw sensitive project data in diagnostics.

See [Operations](operations.md) for health checks, backup/restore, observability setup and troubleshooting, and [CI locally](ci-local.md) for Docker/act checks. A successful local act run does not prove that GitHub-hosted Actions has passed.

## Development references and planned work

The [testing guide](testing.md) lists component tests, browser journeys, Storybook and accessibility checks. Run Storybook with `pnpm exec storybook dev -p 6006`; this is a separate development service, not a production route. The [software design](design.md) and [architecture dependencies](architecture/dependencies.md) describe current boundaries.

The implementation record tracks bulk project actions, organization/team/project hierarchy, SMTP/2FA, Teams integration, embedded Grafana, OLAP requirements, focused developer skills and more deployment diagrams. These are not implied by the existing Settings tabs. An AWS starter template remains deferred and must not change the default self-hosted stack.
