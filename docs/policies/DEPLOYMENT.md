# Deployment Policy

DC Simulator must remain deployable on Vercel, Netlify, and Cloud Run using standard Next.js workflows.

## Current Deployment Shape

- Framework: Next.js 15 App Router
- Standard commands: `npm run build`, `npm run start`
- Current runtime posture: frontend-first, no auth layer, no database, no API routes
- Baseline browser security headers are served through `next.config.js`.

## Deployment Rules

- Production deployments must use a production build.
  - Never expose `next dev` to the public internet.
- Keep the app portable.
  - No host-specific filesystem writes for runtime state.
  - No long-lived local processes or machine-local assumptions.
- Prefer static or edge-friendly patterns unless a server feature is required.
- Any new environment variable must be documented in [ENV_VARIABLES.md](./ENV_VARIABLES.md), `.env.example`, and `README.md`.
- Preview deployments must not silently point at privileged production services.

## Security Baseline For Deployments

- Serve security headers through platform config or Next.js config when deployment settings are touched.
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - Clickjacking protection via `X-Frame-Options` or CSP `frame-ancestors`
  - Restrictive `Permissions-Policy` for unused browser features
- Do not expose stack traces or debug mode in production.
- Keep source maps private or intentionally managed if they are published.

## Required Validation Before Release

- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npx secure-repo audit`
- [ ] `README.md` reflects any deploy or config change
- [ ] New external services or secrets are documented
