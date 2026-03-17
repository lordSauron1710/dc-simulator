# Incident Response

Use this workflow for security events affecting this repository, its deployments, or related credentials.

## What Counts As A Security Incident

- A secret or token is committed, logged, or exposed publicly
- A dependency receives a high- or critical-severity advisory that affects this app
- A deployment account or hosting credential is suspected compromised
- A third-party script, embed, or package behaves maliciously
- A browser injection bug or unsafe data exposure is discovered

## Immediate Response

1. Contain the issue.
   - Revoke tokens, rotate secrets, disable affected integrations, or pause deployments if needed.
2. Assess scope.
   - Identify impacted files, commits, environments, and user exposure.
3. Remediate.
   - Remove the vulnerable code or configuration and redeploy if necessary.
4. Verify.
   - Confirm the fix in code, config, and production behavior.
5. Document.
   - Record the root cause and lesson in [docs/project/errors.md](../project/errors.md) when it should influence future engineering behavior.

## Communication Rules

- Report suspected vulnerabilities privately first.
- Do not create a public issue for an unpatched security problem.
- When multiple environments are involved, state clearly whether the issue affects local dev, preview deploys, production, or all three.

## Post-Incident Follow-Up

- Add or update policy documentation if a gap allowed the incident.
- Add tests, checks, or release steps that would have prevented recurrence.
- Review related dependencies and integrations for similar exposure.
