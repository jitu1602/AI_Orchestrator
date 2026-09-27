---
name: qa-requirement-analyzer
description: "Read a user story, PRD, JIRA ticket, or product doc and extract a deep, structured, traceable set of testable requirements — acceptance criteria, business rules, validation rules, input fields with constraints, error handling, and dependencies, each tagged explicit vs inferred. Use before writing test cases so downstream test design has something precise to trace to. Trigger phrases: extract requirements, analyze this story, break down this PRD, structure these requirements, requirement analysis."
argument-hint: "[paste story/PRD/ticket text, or a file path]"
license: MIT
metadata:
  author: QA Orchestrator (Palkit Rathod)
  version: "1.0.0"
  source: extracted from the QA Orchestrator multi-agent pipeline's Requirement Analyser
---

# QA Requirement Analyzer

Turns a raw feature description, PRD, or ticket into a structured, machine-readable requirement set — the foundation every other QA skill in this pack (test scenarios, test cases, test plan, traceability matrix) builds on. This skill has **one job**: extract and structure. It does not judge quality or flag ambiguity — pair it with `qa-requirement-validator` for that.

## When to use this

- Someone hands you a user story, PRD, JIRA ticket, or spec and asks for requirements broken down for testing.
- Before generating test scenarios or test cases — they should trace back to something structured, not the raw prose.
- Trigger phrases: "extract requirements from this", "analyze this story", "what are the testable requirements here", "structure this PRD".

## Extraction doctrine — comprehensive AND accurate, not in conflict

Be comprehensive and accurate at once by labeling the origin of every requirement:

- **`explicit`** — stated verbatim or near-verbatim in the source. Trace it to specific text.
- **`inferred`** — not written out, but a *necessary, reasonable consequence* of what IS written, given how software of this kind must behave. Example: "users log in with email and password" implies "the system rejects login with an incorrect password" even if the failure path is never spelled out. Every inferred item must carry a `confidence` and cite, in `source`, the explicit text it derives from.

### Hard rules

1. **Never fabricate domain facts.** Don't invent URLs, credentials, field names, limits, business rules, or integrations that are neither stated nor a necessary consequence of stated behavior.
2. **Mark every inference.** If you can't point to the explicit text an inferred requirement derives from, don't emit it.
3. **No generic filler.** Never emit boilerplate like "Core Feature Functionality" or "Input Validation" unless that concept genuinely appears or is directly implied.
4. **Credentials/URLs are copied verbatim or left null.** Never guess them.
5. **Ambiguity is data, not a blocker.** If something is unclear, still extract it as best you can and record what's unclear in `open_questions` — don't silently drop it or silently resolve it your own way.

## What to extract for each requirement

Capture as much of this as the source supports:

- **Functional behavior** — what the system does.
- **Business rules** — domain constraints governing behavior (e.g. "an order over $500 requires manager approval").
- **Validation rules** — field-level constraints (formats, required fields, ranges, lengths).
- **Error handling** — what happens on invalid input, failures, denied access.
- **Acceptance criteria** — the conditions that prove the requirement is met.
- **Input fields** — name, type, required?, and any *stated* length/format/range constraint. Be thorough here — this is exactly what boundary-value and equivalence-class test design depends on later.
- **Dependencies** — other requirements or external systems it relies on.
- **Non-functional aspects** — performance, security, availability, usability — only when the source actually raises them.

## Output format

Return (or write to a file, if the user wants one) a JSON object shaped like this:

```json
{
  "requirements": [
    {
      "id": "REQ-001",
      "title": "Concise feature/behaviour name",
      "description": "What this requirement covers",
      "type": "functional | non_functional | business_rule | constraint | integration",
      "category": "e.g. authentication, navigation, data_management",
      "acceptance_criteria": [{ "id": "AC-001-1", "text": "A specific, verifiable condition" }],
      "business_rules": [{ "id": "BR-001-1", "text": "A domain rule governing this requirement" }],
      "validation_rules": ["Field/input constraints, if any"],
      "error_handling": ["Expected behaviour on invalid input / failure, if any"],
      "input_fields": [{ "name": "email", "type": "text", "required": true, "constraints": "valid email format" }],
      "dependencies": ["REQ-002", "external: payment gateway"],
      "priority": "P0 | P1 | P2 | P3",
      "derivation": "explicit | inferred",
      "confidence": "high | medium | low",
      "open_questions": ["Anything unclear about this requirement"],
      "source": "Exact heading/section/sentence this was derived from"
    }
  ],
  "target_app_url": "string | null",
  "username": "string | null",
  "password": "string | null"
}
```

Rules for the schema:
- IDs are stable and sequential: `REQ-001`, `REQ-002`, …; acceptance criteria and business rules nest under their requirement (`AC-001-1`, `BR-001-1`).
- Include every key even when empty — use `[]`, not an omitted field.
- `priority` defaults to `P1` when the text gives no severity signal.
- Extract `target_app_url`/`username`/`password` **only** if explicitly present in the text — never invent or guess them; return `null` when absent.

## After extracting

If there's no testable content at all, say so plainly rather than inventing requirements to fill the output — an empty `requirements` array with an explanation is the honest answer. If the source is genuinely ambiguous in places, extract what you can and lean on `open_questions` rather than guessing.

When you're done, offer to hand the output to `qa-requirement-validator` (to audit it before test design) or straight to `qa-test-case-generator` / `qa-test-scenario-generator`.

---

## License & attribution

MIT License — © 2026 Palkit Rathod. Free to use, modify, and redistribute, including commercially, provided this notice is retained.

Part of the [QA Orchestrator](https://qa-orchestrator-backend-vwvm.onrender.com) skills pack, extracted from its live multi-agent QA pipeline — built by [Palkit Rathod](https://github.com/palkitrathod).
