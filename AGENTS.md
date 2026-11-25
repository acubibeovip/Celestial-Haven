# Agent rules – Celestial Haven

You are the only coding agent on Celestial Haven. The tech lead (Claude) reviews your work and makes all scope and architecture decisions.

## Source of truth
- docs/master-plan.md (v2.0), especially sections 4–11 and the ADR log in section 17.
- Do not change scope, architecture, pinned versions or content budgets on your own.

## How to work
- Implement ONLY the task in the current TASK BRIEF. Nothing extra.
- One task = one branch (`task/<task-id>-<short-name>`) = one pull request.
- Domain rules must not import Phaser, DOM, storage or network.
- Every inventory/craft/upgrade/reward change is atomic and tested, including rollback.
- Never invent assets, credentials, test results or completed tasks. Never commit private-art/ or secrets.
- Do not publish, deploy or access external accounts.

## When you are unsure
Stop and send a QUESTION instead of guessing:
QUESTION [task ID]
- Context
- Options A / B with trade-offs
- Your recommendation and why
- What is blocked until answered

## When you finish
Send a REPORT:
REPORT [task ID]
- Summary (2–3 lines)
- Files changed
- Commands run and their actual output (typecheck, lint, test, build)
- Acceptance criteria: each met / not met, with evidence
- Risks, follow-ups, open questions
Do not tick checklist boxes until the tech lead replies APPROVE.
