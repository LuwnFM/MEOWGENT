# SecOps MEOWGENT — production roadmap

## Compatibility-first principles

- Preserve existing API actions, skills, provider routing, file uploads and worker integrations.
- Keep Vercel as an optional control plane; run Python workers in isolated containers/VMs.
- Use PostgreSQL as the portable primary database. Neon is already PostgreSQL; migrate using pg_dump/pg_restore only when moving data.
- Avoid destructive schema changes without tested migrations and backup/restore verification.

## Security gates

1. Remove all reliance on NEXT_PUBLIC_APP_ACCESS_CODE; rotate any previously exposed code.
2. Authenticate every API route, authorize by role, rate-limit requests, and enforce per-tenant ownership.
3. Replace process-local currentTask with PostgreSQL task reads and updates.
4. Require explicit approvals and scope restrictions for active scans and privileged tool execution.
5. Run workers as non-root by default, with resource limits, no host Docker socket and restricted egress.
6. Add immutable audit events and redact secrets from logs.

## UI modules

Dashboard, AI Chat, Tasks, Agents, Red Team, Blue Team, Workflows, Skills/MCP, Files, Reports, Settings.

## Deployment targets

- Vercel + managed PostgreSQL + separate worker.
- Docker Compose: Next.js, PostgreSQL, Redis, worker and optional S3-compatible object storage.
- Single-host Linux or Windows via Docker Desktop.

## Reference designs (evaluate; do not copy code blindly)

- Strix: sandboxed execution and reproducible results.
- HexStrike AI: MCP tool discovery; expose only context-relevant tools.
- Vigil SOC: transparent playbooks and human-controlled autonomy.

## Release acceptance criteria

- npm run build and Python tests pass.
- Authentication and authorization tests cover every protected endpoint.
- End-to-end task lifecycle persists across app restarts.
- Fresh Docker installation and backup/restore are verified.
- Staging deployment passes UI and API smoke tests before production promotion.
