---
name: qa-requirement-validator
description: "Audit a set of requirements (raw or already structured) for ambiguity, conflicts, duplicates, missing acceptance criteria, and testability before anyone designs tests against them. Produces a scored verdict (PASS/WARN/FAIL) with per-requirement findings and concrete fix suggestions. Trigger phrases: validate these requirements, are these requirements testable, review this PRD for gaps, requirement quality check."
argument-hint: "[paste requirements, or the JSON from qa-requirement-analyzer]"
license: MIT
metadata:
  author: QA Orchestrator (Palkit Rathod)
  version: "1.0.0"
  source: extracted from the QA Orchestrator multi-agent pipeline's Requirement Validation Agent
---

# QA Requirement Validator

An independent quality gate between requirement extraction and test design. This skill does **not** extract or rewrite requirements — it audits what's already there and decides whether it's good enough to build tests on. Pair it with `qa-requirement-analyzer`, which produces the structured input this skill audits.

## When to use this

- Someone has a requirement set (structured or a plain list) and wants to know if it's actually testable before time is spent writing test cases against it.
- Before handing requirements to `qa-test-case-generator` — catching a critical gap here is far cheaper than discovering it after a full test suite has been written against the wrong assumption.
- Trigger phrases: "review these requirements", "are these testable", "what's ambiguous here", "requirement quality check".

## What to check

For the requirement set as a whole, and per requirement:

1. **Ambiguity** — vague, subjective, or unmeasurable wording ("fast", "user-friendly", "etc.", "should probably") that can't be tested deterministically.
2. **Conflicts** — two requirements that contradict each other.
3. **Duplicates** — two requirements describing the same behavior.
4. **Missing information** — a requirement with no acceptance criteria, or whose behavior can't be determined from what's written.
5. **Testability** — can a tester (or automation) deterministically verify this? A requirement with no observable outcome is untestable.
6. **Completeness** — required structural fields present (id, title, description, priority, at least one acceptance criterion).
7. **Atomicity** — a single requirement shouldn't bundle several unrelated behaviors that should really be split apart.

## Method

1. Run the deterministic checks first, even before reading closely: missing fields, missing acceptance criteria, duplicate titles/descriptions, a scan for vague terms.
2. Then do the semantic read: ambiguity, conflicts, testability — the things that need actual judgment, not pattern-matching.
3. Merge both into one validation report, annotating each requirement with its own findings.

## Severity and verdict

- **critical** — a conflict, or a requirement that's untestable / has no acceptance criteria and can't be tested → drives the overall verdict to **FAIL**.
- **major** — ambiguity or duplication that should be resolved → **WARN** (can proceed, but it's logged and should be surfaced to whoever owns the requirements).
- **minor** — style/atomicity nits → **WARN**.
- No issues → **PASS**.

The overall verdict is FAIL only when there's at least one critical issue. A FAIL means "send this back for another pass," not "block forever" — if this is standalone (no requirement-analyzer to send feedback to), report the FAIL clearly and let the user decide how to proceed rather than silently downgrading it.

## Output format

```json
{
  "verdict": "PASS | WARN | FAIL",
  "score": 0.0,
  "total_requirements": 0,
  "testable_requirements": 0,
  "requirement_findings": [
    {
      "requirement_id": "REQ-001",
      "testable": true,
      "issues": [
        {
          "type": "ambiguity | conflict | duplicate | missing_info | untestable | incomplete | atomicity",
          "severity": "critical | major | minor",
          "detail": "What is wrong",
          "suggestion": "How to fix it"
        }
      ]
    }
  ],
  "conflicts": [{ "requirement_ids": ["REQ-001", "REQ-003"], "detail": "..." }],
  "duplicates": [{ "requirement_ids": ["REQ-002", "REQ-005"], "detail": "..." }],
  "clarifications_needed": ["Open questions to resolve with stakeholders"],
  "gaps": ["Human-readable feedback strings a requirement-analysis pass could act on"],
  "summary": "One-paragraph assessment"
}
```

## Delivering the verdict

Lead with the verdict and the one or two things that actually matter (a real conflict, a genuinely untestable requirement) — don't bury a critical finding under a wall of minor nits. If everything is fine, say so briefly and move on; a validator that manufactures nitpicks to look thorough isn't doing its job. When the verdict is FAIL or WARN, phrase `suggestion` as something a requirement author could act on directly, not just a restatement of the problem.

---

## License & attribution

MIT License — © 2026 Palkit Rathod. Free to use, modify, and redistribute, including commercially, provided this notice is retained.

Part of the [QA Orchestrator](https://qa-orchestrator-backend-vwvm.onrender.com) skills pack, extracted from its live multi-agent QA pipeline — built by [Palkit Rathod](https://github.com/palkitrathod).
