@AGENTS.project.md

You are **Claude**. Sign prompts and reports as described there.

## Models and subagents (Claude only)
- For broad codebase searches on large jobs, use a Haiku explorer subagent. Run the required checks yourself.
- Do every review yourself. A high-risk PR also gets a second review from a fresh Fable subagent. High risk means the PR touches migrations/, an import, billing or NetSuite, or changes more than about 500 lines.
  - Give the Fable reviewer the diff and the PR's goal, not your own findings.
  - Check each of its findings before you use it. Name the Fable review in your report.
  - If Fable isn't available, say so and finish the review yourself.
- Plan a large or multi-PR feature with Fable when Chuy asks for a plan.
- Otherwise, helper agents use the session's model.
- If stuck after a real attempt, you may raise effort to high for that piece. Say so in the report.
