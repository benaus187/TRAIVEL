# /test-feature

Run this skill after completing any large task or phase before committing and merging to main.

## Workflow (execute in order)

### Step 1 — QA Testing
Spawn the `qa-tester` sub-agent. Pass it:
- The feature just built (component names, endpoints, SSE events, UI states)
- Files changed in this task
- What the expected user flow is

Wait for the qa-tester report.

### Step 2 — Fix Issues (if any)
If the qa-tester report contains FAIL or HIGH-PRIORITY bugs:
- Spawn the `code-reviewer` sub-agent with the specific bug descriptions and file:line references
- Collaborate with code-reviewer to fix the issues
- Re-run qa-tester on the fixed code until all critical issues are resolved

### Step 3 — Ask User to Test
Once QA passes (or only LOW-priority issues remain), report to the user:
- What was tested
- What passed / what minor issues remain
- Ask the user to manually test the feature in the browser at http://localhost:3000

Example message:
> QA passed [N] test cases. [X issues fixed]. Please test the feature in the browser — try [specific user flow]. Reply "looks good" when you're happy and I'll commit and merge to main.

### Step 4 — Commit and Merge (only after user confirms)
Only after the user explicitly confirms the feature works:
- `git add` the relevant files
- `git commit` with a descriptive message following the project convention
- `git checkout main && git merge feature/<branch> --no-ff`
- `git push origin main`

## Important rules
- NEVER merge to main before the user confirms
- NEVER skip qa-tester even if the change looks small
- If qa-tester finds FAIL issues, ALWAYS fix before asking user to test
- If the frontend server is not running, remind user to start it with `cd frontend && npm run dev` before testing
