# Production foundation and database portability

## Database architecture

Neon **is PostgreSQL**, not an alternative database language. The existing application uses PostgreSQL syntax and does not need a SQL rewrite. The current server adapter supports `DATABASE_URL` (Neon HTTP driver) or `POSTGRES_URL` (Node PostgreSQL connection via the existing Vercel Postgres pool). Configure **one primary database only**. If the configured database is unavailable, the API fails closed instead of silently reading another database with divergent records.

To use a local database, create `.env` locally (never commit it):

```sh
POSTGRES_PASSWORD=change-to-a-long-random-password
```

Run:

```sh
docker compose -f docker-compose.postgres.yml up -d
```

Set the application environment on the **host** to:

```sh
POSTGRES_URL=postgresql://meowgent:YOUR_PASSWORD@127.0.0.1:5432/meowgent
```

Leave `DATABASE_URL` unset in this mode. If Next.js itself runs inside Docker, use the Compose service hostname rather than 127.0.0.1. Vercel cannot reach your laptop's loopback port; use a reachable private PostgreSQL service for hosted deployment.

The task and routing tables are currently auto-created by the agent route. A later production migration should move schema changes into versioned migrations instead of executing DDL on every request.

## Moving from Neon to self-hosted PostgreSQL

1. Freeze writes or enter maintenance mode. Record a backup and the latest task ID.
2. Export the **source** database using `pg_dump` from a trusted machine (do not paste credentials into shell history): `pg_dump --format=custom --no-owner --no-acl --file=meowgent.dump "$DATABASE_URL"`.
3. Restore into a **new empty** PostgreSQL database with `pg_restore --no-owner --no-acl --dbname="$TARGET_DATABASE_URL" meowgent.dump`.
4. Compare table row counts, most recent task IDs and `routing_config`, and verify the application against the new database in staging.
5. Switch production to **only** `POSTGRES_URL` after validation. Keep the source untouched until the rollback window expires. Do not point concurrent workers at different databases.

No live user database was accessed or migrated in this change.

## Task lifecycle and compatibility

`SET_TASK` returns `taskId`. `GET_STATUS` accepts an optional `taskId` and otherwise returns the newest task for compatibility. Workers send their explicit task ID with `UPDATE_FROM_AGENT`, so a worker cannot accidentally update a different latest task. The Redis job already carries a task ID; polling mode uses the persisted row ID.

## Launch checklist

- Replace shared access code and browser-local secret storage with authenticated, httpOnly secure session cookies and individual user accounts.
- Require worker-specific scoped credentials rather than the same credential used by UI users.
- Add rate limiting, task ownership/authorization, security event audit trail, backup/restore drills and retention controls.
- Use separate isolated worker machines for high-risk tooling; don't share Docker host sockets or use privileged containers.
- Restrict outbound traffic, register approved targets for any active security assessment, and require human approval before destructive actions.
- Encrypt traffic to Postgres/Redis/S3; never expose Postgres publicly.
- Verify `npm ci && npm run build` and Python unit tests in CI before merging.
