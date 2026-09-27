---
name: qa-bug-report-writer
description: "Turn a failing test's intent and an error log (stack trace, assertion failure, screenshot description) into a structured, correctly-severity-classified bug report — title, severity, component, repro steps, expected vs actual — ready to paste into JIRA/Linear/GitHub Issues. Also flags likely-flaky failures instead of filing them as real bugs. Trigger phrases: file a bug for this, write a bug report, classify this failure, is this a flaky test."
argument-hint: "[paste the test case/intent and the error log or stack trace]"
license: MIT
metadata:
  author: QA Orchestrator (Palkit Rathod)
  version: "1.0.0"
  source: extracted from the QA Orchestrator multi-agent pipeline's Bug Filer agent
---

# QA Bug Report Writer

Converts a test failure into a bug report that's actually useful to the person who has to fix it — correctly scoped title, honest severity, and repro steps precise enough that nobody has to re-derive them from the stack trace. Also does the thing most automated bug-filing skips: telling you when a failure is probably flaky, not a real defect.

## When to use this

- A test failed and someone needs a real bug report out of the raw error, not just a copy-paste of the stack trace.
- Trigger phrases: "write a bug for this failure", "classify this error", "is this worth filing or is it flaky".

## Inputs this needs

- **Test case intent** — what the test was trying to verify (title + expected result is enough).
- **Error log** — the actual failure: assertion message, stack trace, HTTP status, or a description of what the screenshot shows.
- The page/URL where it failed, if available.

## Classification

**Title format (mandatory):** `[ComponentName] Short factual description of the action causing unexpected behavior` — not "Login broken," not "Bug in checkout." Name the component and the specific action.

**Severity:**
- **P0** — crash or data loss.
- **P1** — a core flow is broken (can't complete the primary task at all).
- **P2** — degraded experience, but a workaround exists or the flow still completes.
- **P3** — cosmetic (visual glitch, copy typo, non-blocking).

Don't default to P1 to seem thorough, and don't default to P3 to seem lenient — read the actual impact from the error and the test's intent.

**Component:** the primary UI area or backend service involved — specific enough that it routes to the right owner, not "the app."

## Flaky-failure check (do this before filing anything)

A failure is a *candidate* for flaky, not a confirmed bug, when the error pattern suggests timing/environment rather than logic:
- Timeout waiting for an element that should reliably appear.
- Intermittent network/connection errors unrelated to the feature under test.
- A failure that contradicts the test's own recent history (it passed the same assertion moments before, in a retry or a nearby run).
- Element-not-found errors where the element is present in a screenshot but the test raced ahead of a render/animation.

When the signals point to flaky: say so explicitly, suggest what to check (a wait condition, a race in the app itself) rather than filing a P0/P1 defect on shaky evidence — flag it as "likely flaky — recommend re-run before filing" instead of "verified confirmed bug".

## Duplicate awareness

If given access to existing bug titles/descriptions (a backlog export, a search result), check before writing a new report — a near-identical component + error message + URL combination is almost certainly the same bug. If a likely duplicate exists, say so and point to it, rather than describing the report you would have written as if it were new.

## Output format

```json
{
  "title": "[ComponentName] Short factual description of the action causing unexpected behaviour",
  "severity": "P0 | P1 | P2 | P3",
  "is_likely_flaky": false,
  "component": "The primary UI or backend component involved",
  "error_message": "A concise summary of the failure reason",
  "url": "The page URL where it failed, if available",
  "steps_to_reproduce": [
    "Step 1...",
    "Step 2..."
  ],
  "expected_result": "What should have happened",
  "actual_result": "What actually happened",
  "possible_duplicate_of": null
}
```

## Writing it up

Repro steps should be the *minimum* sequence that reproduces the failure — not the full original test script pasted verbatim. `expected_result` and `actual_result` should each be one clear sentence, specific enough that someone who never saw the test can tell exactly what broke. If the error log is ambiguous about root cause, say what's known and what's still unclear — don't invent a root cause the log doesn't actually support.

---

## License & attribution

MIT License — © 2026 Palkit Rathod. Free to use, modify, and redistribute, including commercially, provided this notice is retained.

Part of the [QA Orchestrator](https://qa-orchestrator-backend-vwvm.onrender.com) skills pack, extracted from its live multi-agent QA pipeline — built by [Palkit Rathod](https://github.com/palkitrathod).
