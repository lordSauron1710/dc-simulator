# Authentication And Authorization Policy

There is no authentication or authorization layer in this repository today. That is the current design, not a shortcut.

Do not introduce hidden admin behavior, client-side role checks, or token-based integrations without adding a real server-side trust boundary.

## Current State

- No login or signup flow
- No user sessions
- No roles or permission model
- No cookies or auth headers
- No protected routes or API handlers

## If Authentication Is Added

- All authentication checks must be enforced server-side.
  - Client state may control UI, but it must not be treated as authorization.
- Prefer `HttpOnly`, `Secure`, `SameSite=Lax` or `SameSite=Strict` cookies for sessions.
  - Never store long-lived auth tokens in `localStorage` or query parameters.
- Access tokens must be short-lived.
- Refresh tokens must rotate and be invalidated on reuse.
- State-changing auth endpoints must include brute-force protection and CSRF defenses where applicable.
- Passwords must be hashed with Argon2, scrypt, or bcrypt.
  - Never use plain hashes such as SHA-256 or MD5 for password storage.
- Admin behavior must be backed by server-side role verification, not hidden UI controls.

## Authorization Rules

- Apply least privilege by default.
- Separate anonymous, authenticated, and administrative capabilities clearly.
- Ownership checks must happen server-side for any user-scoped resource.
- Role escalation requires explicit administrative workflow and auditability.

## Required Changes In The Same PR

If you add auth to this repo, update all of the following together:

- [SECURITY.md](./SECURITY.md)
- [API.md](./API.md)
- [ENV_VARIABLES.md](./ENV_VARIABLES.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- `README.md`
- `.env.example`

## Pre-Merge Checklist For Auth Work

- [ ] Server-side session or token verification exists
- [ ] Protected routes return 401 or 403 correctly
- [ ] No tokens are exposed in client bundles, URLs, or logs
- [ ] Login and recovery flows are rate limited
- [ ] Session invalidation and logout behavior are defined
- [ ] Any new roles are documented and enforced server-side
