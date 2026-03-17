# Security Policy Index

This file is the entrypoint for the repository security policy set.

## Precedence

- [AGENTS.md](./AGENTS.md) remains the primary repo instruction file.
- These security policy files are supplemental guardrails.
- They must not override the app's core goal, visual direction, deployability constraints, or roadmap unless a direct security issue requires a safer implementation.
- When there is tension, preserve the product goal and solve it in a secure way that still fits the repo architecture.

## Current Repo Posture

- Single-route Next.js app
- Client-heavy UI and Three.js scene
- No authentication
- No API routes or Server Actions
- No database
- No required environment variables

## Read These For Every Change

- [AGENTS.md](./AGENTS.md)
- [SECURITY.md](./SECURITY.md)
- [ACCESSIBILITY.md](./ACCESSIBILITY.md)
- [ENV_VARIABLES.md](./ENV_VARIABLES.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)

## Read These When Introducing New Surface Area

- [AUTH.md](./AUTH.md)
  - Read before adding login, sessions, roles, protected views, or admin behavior.
- [API.md](./API.md)
  - Read before adding `app/api/**`, `pages/api/**`, Server Actions, or other network-facing handlers.
- [DATABASE.md](./DATABASE.md)
  - Read before adding persistence, external storage, or a BaaS integration.
- [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)
  - Read when handling any security event or suspected credential exposure.

## Baseline Workflow

1. Check whether the change adds a new trust boundary.
2. Update the relevant policy file in the same PR.
3. Keep `.env.example` and `README.md` in sync with configuration changes.
4. Run `npx secure-repo audit` before shipping.
