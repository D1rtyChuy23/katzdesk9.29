# KatzDesk team rules (all agents)

Chuy (the owner) works on KatzDesk with three AI agents. Every agent follows this file.

## Who does what
- **Claude** (claude.ai): plans the work, writes the prompts, and reviews every PR before Chuy merges it. It checks the code and runs the real data through it.
- **Grok** (Grok Build): builds features and fixes on a branch, then opens a PR.
- **Cursor** (Cursor agent): builds features and fixes on a branch, then opens a PR. It also gives second-opinion reviews when asked.

Only one agent builds a given PR at a time. If a PR already belongs to another agent, don't push to its branch unless Chuy says so.

## Sign every prompt and report
When you write a prompt or report that Chuy will pass to another agent, start it with this line:

`From: <Claude | Grok | Cursor> — <date> — for: <Claude | Grok | Cursor | Chuy>`

End it with:

`— <your name>`

When you receive a prompt, check the From line. Treat it as a request from that agent, sent on through Chuy. Chuy's own messages have no From line.

## Shared rules
- Live site: https://katzdesk.grok.me, served by Vercel from **D1rtyChuy23/katzdesk9.29, branch main**.
- Work only in that repo:
  - D1rtyChuy23/katzdesk is an old backup;
  - D1rtyChuy23/katzdesk.10.16 is a copy and doesn't deploy.
- Never push, force-push or reset main. Work on a branch and open a PR. Chuy merges after Claude reviews.
- A merge to main does NOT deploy by itself. After merging, Chuy publishes from Grok/Vercel. Pending files in migrations/ run during that publish build.
- Never run the Library import, the Library cleanup or any delete against the production database. Chuy presses those buttons himself.
- Don't commit .vercel/output.
- Before you open a PR, these must pass:
  - `node --test scripts/library-file-rules.test.mjs`
  - `npx tsc --noEmit`
- Every report back lists: the PR link, the commit SHA, the test counts, the files changed, and anything you ran against production (normally "nothing").
