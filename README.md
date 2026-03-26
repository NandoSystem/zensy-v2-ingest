# zensy-v2-ingest
Zensy V2 ingest service

## GitHub access (V2 vs legacy)
- Dette repoet (`zensy-v2-ingest`) skal bruke en egen GitHub-token.
- Tokenen for V2 skal **ikke** gjenbrukes av legacy-portalen.
- Legacy og V2 må alltid ha separate tokens for å unngå auth-feil og feil repo-tilgang.

Eksempel på filbaner:
- `.secrets/github_token` → legacy (eksisterende portal)
- `.secrets/github_token_v2` → V2-ingest (dette repoet)

Husk å holde token-filene separate og sikre at hver repo peker på riktig token.
