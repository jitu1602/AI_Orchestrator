---
name: qa-test-case-generator
description: "Generate exhaustive, technique-driven, fully traceable test cases from requirements or a feature description — applying equivalence partitioning, boundary value analysis, decision tables, state transitions, and error guessing systematically, with every test mapped back to a requirement/acceptance-criterion id. This is the flagship skill in the QA Orchestrator pack: it produces the same depth of test design the live product's Test Case Generator agent does. Trigger phrases: generate test cases, write test cases for this, test design, boundary value analysis, equivalence partitioning."
argument-hint: "[paste requirements or a feature/user-story description]"
license: MIT
metadata:
  author: QA Orchestrator (Palkit Rathod)
  version: "1.0.0"
  source: extracted verbatim in spirit from the QA Orchestrator multi-agent pipeline's Test Case Generator agent (agents/test_case_generator.py + architecture/test_case_generator.md)
---

# QA Test Case Generator

Generates requirement-driven, traceable test cases a QA engineer can use directly for manual or automated testing. This is the most load-bearing skill in the pack — everything else in this suite (scenarios, scripts, traceability matrix) either feeds it or consumes its output. The goal is **complete, grounded coverage**: every requirement decomposed by formal test-design techniques, with zero invented functionality.

## When to use this

- Someone has requirements (ideally from `qa-requirement-analyzer`, but raw text works) and needs the actual test cases, not just a scenario outline.
- Trigger phrases: "generate test cases for this", "write test cases", "what test cases cover this requirement", "apply boundary value analysis to this field".

## The core tension, and how to resolve it

Depth and grounding pull against each other, and grounding always wins. Apply test-design techniques *exhaustively* to decompose what's stated — never to invent what isn't. If you're not sure whether a technique is inventing something, leave it out.

## Coverage techniques — apply systematically per input/condition

Tag every test case with the `coverage_technique` that produced it.

- **Equivalence Partitioning (EP)** — one test per valid class and per invalid class of each input.
- **Boundary Value Analysis (BVA)** — for any field with a *stated or inherent* length/range (e.g. "8–20 chars", a numeric or date range), test just-below-min, min, just-above-min, just-below-max, max, just-above-max. Only where a bound is stated or inherent — never invent a specific number the requirements don't imply.
- **Decision Table** — enumerate meaningful condition combinations and their outcomes (e.g. login = {valid, invalid} username × {valid, invalid} password = 4 cases).
- **State Transition** — defined state changes (logged-out → logged-in, lockout after N failures, session timeout, logout) — only when those states/rules are actually stated.
- **Error Guessing / Negative** — for each mandatory or validated input: empty, whitespace-only, leading/trailing spaces, wrong case, over-max-length, malformed/special-character input — where the field has a validation rule or is mandatory.
- **Positive / Happy path** — valid inputs produce the defined success outcome.
- **Navigation/redirect, access control, session** — whenever mentioned or implied.

**Depth example** — a single "verify login" requirement with a username+password form and an error message typically yields *many* tests: valid login; invalid username; invalid password; both empty; username empty; password empty; wrong case; leading/trailing spaces; over-length input; locked-out user (if defined); malicious/script-like input rejected (if input validation is defined); redirect/session behavior after success. Generate everything the requirement's acceptance criteria and rules actually support — don't stop at the first two or three obvious cases.

## Grounding — anti-hallucination, overrides depth

- Every test must trace to a requirement + an acceptance-criterion or business-rule id.
- Techniques only *decompose* existing requirements/ACs/fields — never invent a feature, field, rule, boundary, or error the requirements neither state nor inherently imply.
- If a technique needs a detail the requirement omits (e.g. an exact max length), cover the class generally ("exceeds maximum length") *without* fabricating a specific number, and note the assumption in the step.
- When in doubt whether something is in scope: leave it out.

## What NOT to generate

Never generate a "test case" that's really just:
- Test data on its own (e.g. "Username: Admin", "Password: admin123").
- Input values or credentials with no validation objective attached.
- Field names, button names, labels, or URLs listed without an assertion goal.

| Bad | Good |
|---|---|
| "Username input field" | "Verify login fails when the username field is left empty" |
| "Login button" | "Verify user is redirected to the dashboard after clicking Login with valid credentials" |
| "Invalid data" | "Verify login fails with an invalid password" |

Also out of scope unless the requirement explicitly asks for it: performance, security, accessibility, or other non-functional test cases.

## Title format (mandatory)

Every title starts with **Verify | Validate | Ensure | Confirm**, and names the specific thing being validated — not just what exists.

## Preconditions — must be actionable

- "User is on the login page" → a concrete navigation step, not vague scene-setting.
- "User is logged in" → spell out the full login flow as a step, don't assume it.
- Never assume state carried over from a previous test — every test case is independent.

## Step detail

Name the exact element and value: "Enter valid username in the username field", not "Enter username". Expected results are specific and verifiable: "Page URL changes to /dashboard", not "Login succeeds".

## Mapping (mandatory on every test case)

- `requirement_ids` — the requirement(s) it validates (usually one).
- `acceptance_criteria_ids` — the AC id(s) it verifies (e.g. `AC-001-2`).
- `business_rule_ids` — any business-rule id(s) it enforces, if applicable.

If a test case can't be mapped to at least one of these, don't generate it.

## Automatability classification (on every test case)

- `automatable: true` → `execution_type: "automated"` — UI interactions, DOM/URL/API assertions.
- `automatable: false` → `execution_type: "manual"` — visual layout, colors, subjective UX judgment. Always provide `manual_test_instructions` in this case.
- Always provide `automatable_reason` either way.

## Output format

```json
{
  "test_cases": [
    {
      "id": "TC-001",
      "requirement_ids": ["REQ-001"],
      "acceptance_criteria_ids": ["AC-001-1"],
      "business_rule_ids": [],
      "title": "Verify login fails with an invalid password",
      "type": "positive | negative | edge_case | boundary",
      "coverage_technique": "equivalence_partitioning | boundary_value_analysis | decision_table | state_transition | error_guessing | positive",
      "priority": "P0 | P1 | P2 | P3",
      "preconditions": ["Navigate to the login page at <url>"],
      "test_data": { "username": "valid_user", "password": "wrong_pass" },
      "steps": [
        { "step_number": 1, "action": "Enter a valid username in the username field", "expected_result": "Username field shows the entered value" },
        { "step_number": 2, "action": "Enter an incorrect password and click Login", "expected_result": "An 'incorrect credentials' error message is shown; the user remains on the login page" }
      ],
      "execution_type": "automated | manual",
      "automatable": true,
      "automatable_reason": "Pure UI interaction and DOM/URL assertions, no subjective judgment required",
      "manual_test_instructions": null
    }
  ]
}
```

Use `{}` for `test_data` when a test case genuinely has none.

## Self-review before returning (do this, don't skip it)

1. Every acceptance criterion and validation/error rule is exercised by at least one test; every input field has been run through EP + BVA (where bounded) + negative classes.
2. Every test maps to a requirement (and AC/BR id) — no orphans, no duplicates.
3. Each test carries a `coverage_technique` and validates exactly one objective.
4. No test is merely test data or a UI element without a validation objective.
5. No fabricated field/rule/boundary — everything traces to something stated or inherent.
6. All titles start with Verify/Validate/Ensure/Confirm and are specific.
7. Ask: "what scenario would a senior QA engineer still test here?" — if it's grounded in the requirements, add it.

## Handing off

Offer to convert the output into runnable Playwright scripts with `qa-playwright-script-generator`, or into a full traceability matrix with `qa-traceability-matrix-builder`.

---

## License & attribution

MIT License — © 2026 Palkit Rathod. Free to use, modify, and redistribute, including commercially, provided this notice is retained.

Part of the [QA Orchestrator](https://qa-orchestrator-backend-vwvm.onrender.com) skills pack, extracted from its live multi-agent QA pipeline — built by [Palkit Rathod](https://github.com/palkitrathod).
