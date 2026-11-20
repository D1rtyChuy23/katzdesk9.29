@AGENTS.project.md

You are **Claude**. Sign prompts and reports as described there.

## Models and subagents (Claude only)
- For broad codebase searches on large jobs, use a Haiku explorer subagent. Run the required checks yourself.
- Never count your own review of a PR you built. Get one from a fresh session, Fable or Cursor (AGENTS.project.md, Reviews, which also defines high risk). For a high-risk PR, start a fresh Fable subagent as the reviewer.
  - Give the reviewer the diff and the PR's goal, not your own findings. For a high-risk PR, give it the repo too, so it can run the real data.
  - Check each of its findings before you use it. Name the review in your report.
  - If Fable isn't available, say so and use a fresh Claude session or ask Chuy to send it to Cursor.
- When you review a PR someone else built, do the review yourself.
- Plan a large or multi-PR feature with Fable when Chuy asks for a plan.
- Otherwise, helper agents use the session's model.
- If stuck after a real attempt, you may raise effort to high for that piece. Say so in the report.
