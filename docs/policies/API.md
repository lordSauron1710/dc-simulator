# API Policy

This repository does not currently expose any API routes, Server Actions, or backend handlers. That low attack surface should be preserved unless a feature explicitly requires otherwise.

If you add a network-facing endpoint, it becomes security-critical immediately.

## Current State

- No `app/api/**`
- No `pages/api/**`
- No Server Actions
- No authenticated backend endpoints
- No external write APIs

## Rules For Any New Endpoint

- Validate all input at runtime.
  - Validate body, query params, path params, and headers as needed.
  - Prefer a schema library such as Zod.
- Authenticate before business logic when the endpoint is not fully public.
- Authorize separately from authentication.
  - Passing auth does not imply permission.
- Rate limit public or state-changing routes.
- Return safe error messages.
  - Do not leak stack traces, file paths, database errors, or provider internals.
- Restrict methods explicitly.
  - Reject unexpected HTTP methods with 405.
- Keep CORS narrow.
  - Do not use `*` for credentialed or privileged endpoints.
- Set request size expectations.
  - Reject unbounded uploads or oversized JSON bodies.
- Make write operations idempotent where practical.

## Next.js Route Pattern

Every new Next.js route or action should follow this order:

1. Authenticate if required.
2. Validate the input.
3. Authorize the action.
4. Execute the business logic.
5. Return a minimal response.

## Additional Rules For This Repo

- Do not create an endpoint just to avoid client-state work.
  - This project is intentionally frontend-first.
- Document every new endpoint in `README.md`.
- Update [AUTH.md](./AUTH.md) if the endpoint introduces sessions, users, roles, or privileged behavior.
- Update [ENV_VARIABLES.md](./ENV_VARIABLES.md) and `.env.example` if the endpoint requires secrets or external services.

## Pre-Merge Checklist For API Work

- [ ] Input validation is enforced at runtime
- [ ] Methods are restricted explicitly
- [ ] Rate limiting is in place for public or write endpoints
- [ ] Error responses do not reveal internals
- [ ] Auth and authorization are documented when applicable
- [ ] Required env vars and deployment assumptions are documented
