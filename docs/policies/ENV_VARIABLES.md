# Environment Variables Policy

DC Simulator does not currently require any environment variables for local development or deployment.

That is the current baseline. Do not add environment variables casually.

## Current Inventory

- Required variables: none
- Optional variables: none
- Client-exposed variables: none

## Rules For Adding Variables

- Add every new variable to `.env.example` in the same PR.
- Document every new variable in `README.md` and explain whether it is required.
- Use `NEXT_PUBLIC_*` only for values that are safe to expose in the browser bundle.
- Keep secrets server-only.
  - Never import secret-bearing modules into client components or shared client code.
- Do not hardcode deploy URLs, API hosts, tokens, or environment-specific IDs in source files.
- Remove unused variables when the code that depends on them is removed.

## Handling And Storage

- Local development variables live in untracked `.env.local` or equivalent host tooling.
- Hosted deployments must use the platform secret manager or environment configuration UI.
- Do not echo secrets in logs, screenshots, or issue threads.

## Pre-Merge Checklist

- [ ] `.env.example` reflects the new variable set
- [ ] `README.md` documents required setup
- [ ] The variable is public only if it uses `NEXT_PUBLIC_*`
- [ ] No client component imports or logs server-only secrets
