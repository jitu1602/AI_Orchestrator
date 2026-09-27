# QA Orchestrator — Claude Code Skills Pack

Five Claude Code skills, kept deliberately small. This started as nine — covering every stage of [QA Orchestrator](../README.md)'s six-agent pipeline — but four of them (test plan, test scenarios, traceability matrix, QA report) turned out to be closer to "well-organized common sense" than something that adds real value as a standalone download: a competent SDET already knows a test-plan structure, and a plain prompt to Claude gets most of the way there anyway. They were cut rather than padding the pack.

What's left are the five that encode something a naive prompt won't reliably produce — specific, checkable rules pulled from the actual prompts the live product's agents run in production, not generic QA advice.

## What's in the pack

| Skill | What it does | Why it earns a place here |
|---|---|---|
| `qa-requirement-analyzer` | Extracts structured, traceable requirements (acceptance criteria, business rules, input constraints) from a story/PRD/ticket, labeling every item explicit-vs-inferred | Most teams hand testers unstructured prose; turning it into IDs + ACs + honest inferred/explicit labeling is real, checkable value |
| `qa-requirement-validator` | Audits requirements for ambiguity, conflicts, duplicates, and testability before anyone designs tests | An independent quality gate that works on any requirements doc alone — doesn't need the other skills to be useful |
| `qa-test-case-generator` | Exhaustive, technique-driven test cases (equivalence partitioning, boundary values, decision tables, state transitions) — the flagship skill | The grounding-over-invention discipline and the systematic technique checklist go beyond what "write test cases for X" produces unprompted |
| `qa-playwright-script-generator` | Converts test cases into runnable Playwright TypeScript (Page Object Model, semantic locators) | Encodes hard-won specifics — a semantic-locator priority order and TypeScript pitfalls (private page-object members, module-scope instantiation) that come from real compile failures, not textbook advice |
| `qa-bug-report-writer` | Turns a failing test + error log into a classified bug report, and flags likely-flaky failures before they get filed as real bugs | The flaky-vs-real check is the part most bug-filing skips; genuinely useful on a single error log with no other inputs |

## A typical flow

```
qa-requirement-analyzer → qa-requirement-validator → qa-test-case-generator → qa-playwright-script-generator
                                                                                        │
                                                              (a test fails during execution)
                                                                                        │
                                                                                        ▼
                                                                          qa-bug-report-writer
```

Every skill also works alone — hand `qa-test-case-generator` a raw feature description and it's fine without the others.

## Installing

Each skill is a self-contained folder (a `SKILL.md`, nothing else needed).

**Available in every project:**
```bash
cp -r qa-requirement-analyzer qa-requirement-validator qa-test-case-generator \
      qa-playwright-script-generator qa-bug-report-writer \
      ~/.claude/skills/
```

**Just this project:**
```bash
mkdir -p .claude/skills
cp -r qa-requirement-analyzer qa-requirement-validator qa-test-case-generator \
      qa-playwright-script-generator qa-bug-report-writer \
      .claude/skills/
```

Restart Claude Code (or start a new session) and the skills are available — Claude reaches for them based on what you ask for, or invoke one directly with `/qa-test-case-generator` (etc.).

## Using them

Paste a requirement, a story, a PRD, or a failing test's error log, and say what you want:

> "Generate test cases for this login requirement: ..."
> "Write a Playwright script for these test cases: ..."
> "Is this a flaky failure or a real bug? Here's the error: ..."

## Honest limitations

- **These are prompt-only.** No code runs, nothing is enforced by a tool — "useful" means "more consistent, better-considered output," not "does something Claude literally couldn't do before." A skill is guidance the model follows, not a hard constraint.
- **Value depends on your team's conventions matching the ones baked in** — the title-must-start-with-Verify/Validate rule, the P0–P3 severity definitions. Adjust the `SKILL.md` directly if yours differ; nothing here needs to match the original product.
- **Verified so far:** the requirement-analyzer → test-case-generator → Playwright-script-generator chain has been dry-run end to end against a real sample requirement (see `../TESTING.md` in this pack if present, or ask for a fresh run) — output was checked against each skill's own self-review checklist, and generated TypeScript was checked for the compile-breaking mistakes the skill explicitly guards against.

---

Built with ❤️ by Palkit Rathod · Part of the [QA Orchestrator](https://github.com/palkitrathod) project.
