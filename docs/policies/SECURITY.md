# Security Policy

DC Simulator is currently a client-heavy Next.js 15 web app with one public route, no authentication layer, no API routes, no database, and no required environment variables. The main security risks in this repo are browser-exposed secrets, unsafe future server features, unsafe third-party embeds, and client-side injection bugs.

Treat security requirements as non-optional.

## Scope And Precedence

- This file supplements [AGENTS.md](../../AGENTS.md); it does not replace it.
- These security rules should reinforce the app's core goal: a visually creative, deployable 3D data center sandbox.
- Do not use this policy set to justify generic enterprise boilerplate that fights the repo's frontend-first architecture or product direction.
- If a security control would materially affect UX, scene behavior, or deployability, implement the safest version that still fits the repo's stated goals and document the tradeoff.

## Current Security Posture

- App surface is the single App Router page under `app/`.
- Rendering and UI logic live in `src/scene/`, `src/ui/`, `src/state/`, and `src/model/`.
- There is no trusted backend in this repository today. Do not assume hidden buttons or client-only checks create security boundaries.
- This repo is expected to stay deployable on Vercel, Netlify, and Cloud Run using standard Next.js build and start commands.
- Baseline browser hardening headers are configured in `next.config.js`.
- The supported framework dependency line is `next@15.5.13` until a newer patched release is intentionally adopted.

## Core Rules

- Never commit secrets.
  - No API keys, tokens, private URLs with credentials, service-account material, or `.env*` files in git.
- Treat all browser-delivered code as public.
  - `NEXT_PUBLIC_*` values are public by definition and must be safe to expose.
- Do not add unsafe browser sinks.
  - No `dangerouslySetInnerHTML` with untrusted content.
  - No `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `new Function`, or string-based timers for untrusted input.
- Do not widen the attack surface casually.
  - New API routes, Server Actions, auth flows, databases, third-party scripts, iframes, or telemetry endpoints require policy updates in the same PR.
- Prefer React and typed data over raw DOM manipulation.
  - Render untrusted values through normal JSX escaping.
- Keep dependencies minimal and reviewable.
  - New packages must have a clear purpose and must not introduce native binaries or host-specific runtime assumptions unless explicitly justified.

## Security Requirements For New Features

- Any new network-facing endpoint must follow [API.md](./API.md).
- Any new session, login, or role logic must follow [AUTH.md](./AUTH.md).
- Any new persistence layer must follow [DATABASE.md](./DATABASE.md).
- Any new environment variable must be documented in [ENV_VARIABLES.md](./ENV_VARIABLES.md), `.env.example`, and `README.md` in the same change.
- Any deployment behavior change must be documented in [DEPLOYMENT.md](./DEPLOYMENT.md).

## Browser And Deployment Baseline

- Prefer security headers at the platform or Next.js config layer when deployment config is introduced or changed.
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - Clickjacking protection via `X-Frame-Options: DENY` or CSP `frame-ancestors 'none'` unless embedding is intentional
  - A restrictive `Permissions-Policy` when browser features are not needed
- Do not load third-party scripts unless there is a documented product need.
- External embeds and analytics must be documented with purpose, origin, and data exposure.

## Required Checks Before Merge

- Review the diff for secrets, debug logs, and accidental URLs with credentials.
- Run `npm test`.
- Run `npm run build`.
- Run `npx secure-repo audit`.
- If dependencies changed, run `npm audit`.
- If a security-sensitive surface changed, update the relevant policy files in the same PR.

## Reporting A Vulnerability

- Do not open a public issue for an unpatched security vulnerability.
- Report privately to the repository owner or maintainers first.
- Include reproduction steps, impacted files, and a short impact statement.
- After remediation, document the lesson in [docs/project/errors.md](../project/errors.md) if it affects engineering practice in this repo.
