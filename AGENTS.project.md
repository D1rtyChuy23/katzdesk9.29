# KatzDesk team rules (all agents)

Chuy (the owner) works on KatzDesk with three AI agents. Every agent follows this file.

## Read first
- **docs/domain-rules.md**: what the app does with customers, equipment names and serials today; Chuy's spreadsheet rules that aren't in the app yet; and the publishing files no agent may break.
- **docs/decisions.md**: questions Chuy has already settled. Don't reopen one unless Chuy asks. When Chuy settles a new question in your PR, add a line there in the same PR.

## Who does what
- **Claude** (claude.ai and Claude Code): builds features and fixes on a branch, opens the PR, writes prompts for the other agents, and runs the real data through its changes.
- **Grok** (Grok Build): the publishing side. Chuy publishes from Grok/Vercel after he merges. Grok doesn't change code. If a change is ever needed from Grok, it goes on a branch and through a PR like everyone else's, never straight to main.
- **Cursor** (Cursor agent): builds a PR now and then, and gives second-opinion reviews when asked.

Only one agent builds a given PR at a time. If a PR already belongs to another agent, don't push to its branch unless Chuy says so.

## Reviews
Every PR gets a review from someone who did not build it, before Chuy merges. A session reviewing its own work does not count. Any of these does:
- a fresh Claude session given the diff and the PR's goal, not the builder's findings;
- a Fable reviewer, which Claude starts as a subagent;
- Cursor.

The review is named in the PR (who, and what it found), and it confirms the GitHub check is green on the PR's latest commit.

**High risk** means the PR touches migrations/, an import, billing or NetSuite, or changes more than about 500 lines. A high-risk PR gets the Fable review, whoever built it. When Cursor builds one, Claude reviews it and starts the Fable review. The reviewer of a high-risk PR gets the repo, not only the diff, and runs the real export or data through the change. If that can't be done, the reviewer says so on the **Not verified** line.

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
- Never push, force-push or reset main. Work on a branch and open a PR. Chuy merges after the review above.
- A merge to main does NOT deploy by itself. After merging, Chuy publishes from Grok/Vercel. Pending files in migrations/ run during that publish build.
- Never run the Library import, the Library cleanup or any delete against the production database. Chuy presses those buttons himself.
- Don't commit .vercel/output.
- Before you open a PR, run the same checks GitHub runs on every PR (.github/workflows/checks.yml). They must pass:
  - `npx tsc --noEmit`
  - `npm run lint` (errors fail; warnings don't)
  - `npm run build` (with no DATABASE_URL set, so migrations skip)
  - `npm test` (the whole suite; it takes a while)
- A PR whose GitHub check is red is not ready, whatever the report says. Until Chuy turns on the required check for main, GitHub won't block that merge, so the reviewer must look.
- Every report back lists: the PR link, the commit SHA, the test counts, the files changed, and anything you ran against production (normally "nothing").
- Every report also has a **Not verified** line: what the tests and checks did not cover. Always name any migration in migrations/ that was not run against a real database, and any import or data change that was not tried on a real export or live data. If everything was covered, write "Not verified: nothing".
