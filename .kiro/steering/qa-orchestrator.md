---
inclusion: always
---

# QA Orchestrator — Pipeline Guide

This workspace implements a multi-agent QA pipeline. Seven specialized agents live in
`.kiro/agents/`. This file describes how they fit together so any agent (or the default
agent acting as the Orchestrator Core) can route work correctly and preserve the data
contract between stages.

## The pipeline

```
Requirement Analyzer  ──▶  Requirement Validator  ──▶  Test Case Generator  ──▶  Automation Generator
   (qa-requirement-        (qa-requirement-              (qa-test-case-             (qa-automation-
    analyzer)               validator)                    generator)                 generator)
                                                                                          │
                                                                                          ▼
                                                                                   Execution Agent
                                                                                   (qa-execution-agent)
                                                                                          │
                                                            ┌─────────────────────────────┤
                                                            ▼                             ▼
                                                     Defect Detector             Reporting Agent
                                                    (qa-defect-detector)        (qa-reporting-agent)
```

The **Orchestrator Core** is not a separate agent file — it is the coordinating role.
When asked to "run the whole pipeline" or "orchestrate", drive the stages in order,
passing each stage's JSON output as the next stage's input.

## Agents, shortcuts, and one-line jobs

| Stage | Agent | Shortcut | Job |
|---|---|---|---|
| 1 | `qa-requirement-analyzer` | `ctrl+alt+1` | Extract structured, traceable requirements (explicit vs inferred) |
| 2 | `qa-requirement-validator` | `ctrl+alt+2` | Audit requirements for testability → PASS/WARN/FAIL |
| 3 | `qa-test-case-generator` | `ctrl+alt+3` | Exhaustive technique-driven, traceable test cases |
| 4 | `qa-automation-generator` | `ctrl+alt+4` | Convert test cases into Playwright TS (Page Object Model) |
| 5 | `qa-execution-agent` | `ctrl+alt+5` | Run the suite, collect honest per-test results |
| 6 | `qa-reporting-agent` | `ctrl+alt+6` | Final QA report + traceability matrix + coverage |
| — | `qa-defect-detector` | `ctrl+alt+7` | Classify a failure into a bug report; flag flaky failures |

## Data contract between stages

Each stage consumes the prior stage's JSON. Preserve IDs across the whole pipeline so
traceability survives end to end:

- **REQ-xxx** — requirement id (from the Analyzer). Never renumbered downstream.
- **AC-xxx-n / BR-xxx-n** — acceptance criteria / business rules nested under a requirement.
- **TC-xxx** — test case id (from the Test Case Generator). Every TC maps to at least one REQ + AC/BR.
- Scripts (Automation Generator) reference the TC they automate.
- The Execution Agent reports results keyed by **TC-xxx**.
- The Reporting Agent's traceability matrix links **REQ-xxx → [TC-xxx]** with an alignment status.
- The Defect Detector consumes a single failure (TC intent + error log) and emits one bug report.

## Routing rules

- Requirements arrive as raw prose → start at the **Requirement Analyzer**.
- Requirements already structured but unaudited → **Requirement Validator** first.
- Validator returns FAIL → send feedback back to the Analyzer (or the human) before test design; do not proceed to test cases on a critical gap.
- Test cases exist, need automation → **Automation Generator**.
- Scripts exist, need to run → **Execution Agent**.
- A test failed → **Defect Detector** (it decides real bug vs likely flaky before anything is filed).
- Run finished, need the rollup → **Reporting Agent**.

## Shared principles (all agents honor these)

- **Grounding over invention.** Never fabricate requirements, fields, boundaries, selectors, or root causes not stated or inherently implied.
- **Traceability is mandatory.** Anything that can't map back to a REQ/AC/BR id shouldn't be emitted.
- **Honesty over green dashboards.** A command exiting 0 is not proof of success; uncovered requirements and skipped tests are surfaced, not hidden.
- **Every test is independent.** Preconditions are automated, never assumed to carry over.
- **Severity/priority scheme is shared:** P0 = crash/data loss, P1 = core flow broken, P2 = degraded with workaround, P3 = cosmetic.
