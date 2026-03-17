# Database Policy

This repository does not currently use a database, ORM, or persistent backend store.

If a database is introduced later, treat that change as a security boundary crossing.

## Current State

- No database client libraries
- No migrations
- No persistent user data
- No server-side write paths

## Rules If Persistence Is Added

- All privileged database access must stay server-side.
- Never expose service-role credentials or private connection strings to the browser.
- Use parameterized queries or a safe query builder.
- Apply least privilege.
  - Separate read-only, application, and administrative access where possible.
- If using a BaaS platform, enable row-level security or equivalent access controls for user data.
- Review migrations for destructive changes, accidental public access, and unsafe defaults.
- Document the data model, retention expectations, and operational assumptions in `README.md` and related policy files.

## Required Companion Changes

If database support is added, update:

- [SECURITY.md](./SECURITY.md)
- [API.md](./API.md)
- [AUTH.md](./AUTH.md) if users or roles are involved
- [ENV_VARIABLES.md](./ENV_VARIABLES.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- `README.md`
- `.env.example`
