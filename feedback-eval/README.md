# feedback-eval

CLI that scores customer feedback on several dimensions using TypeSafe's Jev model.

```sh
pip install -e .            # installs typesafe-sdk and pyyaml
export TYPESAFE_API_KEY=...
feedback-eval samples/feedback.txt --lines          # table, one text per line
feedback-eval reviews/ --json -o results.json       # a directory of .txt/.md files
cat note.txt | feedback-eval -                      # stdin
feedback-eval x.txt -d my-dimensions.yaml           # custom dimensions
```

Each text becomes one `system_one` request carrying every dimension as a question
(`score`, `noul` yes/no probability, or `choice`); Jev answers them in parallel. Define
dimensions in `dimensions.yaml` — Jev never sees the question names, so each dimension's
`instructions` must be self-contained. Raw probabilities are kept in `--json` output, so
you can re-weight or threshold without re-running inference.
