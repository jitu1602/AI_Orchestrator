# Mission Control Dashboard

A static, zero-build dashboard that recreates the QA Orchestrator "Mission Control"
view: a radial 6-agent constellation around the orchestrator core, a pipeline metrics
strip, a result console, DeepEval score bars, and a traceability matrix.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `styles.css` | Dark sci-fi theme + layout |
| `app.js` | Renders the dashboard; fetches `data.json`, falls back to built-in mock data |
| `build-data.js` | Transforms Playwright's `test-results/results.json` into `data.json` |
| `serve.js` | Tiny zero-dependency static server (needed because browsers block `fetch()` over `file://`) |
| `data.json` | Generated dashboard data (produced by `build-data.js`) |

## Quick start

From the project root:

```bash
npm run ui:refresh   # run the Playwright suite, then rebuild ui/data.json
npm run ui:serve     # serve the dashboard at http://localhost:4173/
```

Then open http://localhost:4173/.

## How it's wired

```
playwright test  ──▶  test-results/results.json  ──▶  build-data.js  ──▶  ui/data.json  ──▶  app.js (fetch)
```

- `npm run ui:data` rebuilds `data.json` from the **last** run without re-running tests.
- `npm run ui:refresh` runs the suite and rebuilds in one step.
- Opening `index.html` directly (via `file://`) still works — it just shows the
  built-in mock data instead of the live run, because browsers block `fetch()` of
  local files. Use `npm run ui:serve` to see real data.

## Customizing

- Change the port: `UI_PORT=8080 npm run ui:serve`.
- The dashboard shape (agents, metrics, bars, trace rows) is defined in `build-data.js`.
  Point it at a real orchestrator API response instead of the Playwright JSON to make
  it fully live.
