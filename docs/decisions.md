# KatzDesk decisions

Questions Chuy has settled, newest first. Don't reopen one unless Chuy asks. Add a line in the same PR when Chuy
settles something new. Write "Pending Chuy" in the Decided by column until he confirms it.

| Date | Decision | Decided by |
| --- | --- | --- |
| 2026-11-12 | Every PR is reviewed by someone who didn't build it: a fresh Claude session, Fable or Cursor. A session's review of its own PR doesn't count. | Pending Chuy (merging this PR confirms it) |
| 2026-11-12 | Grok doesn't change code. Any change goes on a branch and through a PR, like every other agent's. | Pending Chuy (merging this PR confirms it) |
| 2026-11-12 | GitHub runs the typecheck, lint, the build and the full test suite on every PR. A red check means the PR isn't ready. | Pending Chuy (merging this PR confirms it) |
| 2026-11-12 | Roles: Claude builds most PRs, Chuy publishes from Grok/Vercel, Cursor builds now and then and gives second-opinion reviews. | Chuy |
| 2026-10-04 | Each model variation (for example Axiom DV-APS and Axiom Twin) is its own model with its own spec sheet, never merged into one family. | Chuy |
| 2026-10-04 | Equipment assigned to an account is locked: it's an asset at a site or customer. | Chuy |

## Open questions
- Should main require the "checks" status and a PR before merging? This is a GitHub ruleset that Chuy turns on.
  Until he does, the check runs but doesn't block a merge.
- Should KatzDesk count Bunn ITCB and ITB "(NS)" units as their own models, the way the equipment list spreadsheet
  does? The app strips "(NS)" today. Does the one "Bunn ICB Short Coffee Brewer (NS)" get its own model too?
- Should the Ready Equipment Log spelling (the Master Asset List standard) become KatzDesk's catalog spelling?
