// ============================================================
// serve.js — static server + pipeline runner for the dashboard.
// Serves ui/ AND exposes:
//   GET /run?url=<target>   -> starts the real pipeline (pipeline/orchestrator.js)
//   GET /status             -> current run status (running/done + summary)
//   GET /report             -> the latest run's consolidated HTML report
//
// Usage:  node ui/serve.js   (or: npm run ui:serve)  then open http://localhost:4173/
// ============================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = process.env.UI_PORT ? Number(process.env.UI_PORT) : 4173;
const UI = __dirname;
const ROOT = path.resolve(__dirname, '..');
const RUNS = path.join(ROOT, 'runs');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

// current run state (single run at a time)
let runState = { status: 'idle', url: null, log: [], summary: null, error: null };

function startRun(url) {
  if (runState.status === 'running') return false;
  runState = { status: 'running', url, log: [`[orchestrator] starting for ${url}`], summary: null, error: null };
  const child = spawn(process.execPath, [path.join(ROOT, 'pipeline', 'orchestrator.js'), url], { cwd: ROOT });
  child.stdout.on('data', (d) => runState.log.push(...String(d).split('\n').filter(Boolean)));
  child.stderr.on('data', (d) => runState.log.push(...String(d).split('\n').filter(Boolean)));
  child.on('close', (code) => {
    try {
      const latest = JSON.parse(fs.readFileSync(path.join(RUNS, 'latest.json'), 'utf8'));
      runState.summary = latest.summary;
      runState.runId = latest.runId;
    } catch { /* ignore */ }
    runState.status = code === 0 ? 'done' : 'error';
    if (code !== 0) runState.error = `pipeline exited with code ${code}`;
  });
  return true;
}

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}

function latestReportPath() {
  try {
    const latest = JSON.parse(fs.readFileSync(path.join(RUNS, 'latest.json'), 'utf8'));
    return path.join(RUNS, latest.runId, 'report', 'index.html');
  } catch { return null; }
}

http
  .createServer((req, res) => {
    const u = new URL(req.url, `http://localhost:${PORT}`);
    const route = u.pathname;

    // ---- API: start a run ----
    if (route === '/run') {
      const target = u.searchParams.get('url');
      if (!target) return send(res, 400, 'application/json', JSON.stringify({ error: 'url required' }));
      const started = startRun(target);
      return send(res, started ? 202 : 409, 'application/json',
        JSON.stringify({ started, status: runState.status, url: target }));
    }

    // ---- API: poll status ----
    if (route === '/status') {
      return send(res, 200, 'application/json', JSON.stringify(runState));
    }

    // ---- serve the latest consolidated report ----
    if (route === '/report') {
      const rp = latestReportPath();
      if (rp && fs.existsSync(rp)) {
        return send(res, 200, 'text/html; charset=utf-8', fs.readFileSync(rp));
      }
      return send(res, 404, 'text/plain', 'No report yet — run the pipeline first.');
    }

    // ---- report assets (screenshots) referenced as ../bdd/... from the report ----
    if (route.startsWith('/runs/')) {
      const fp = path.join(ROOT, decodeURIComponent(route));
      if (fp.startsWith(RUNS) && fs.existsSync(fp)) {
        return send(res, 200, MIME[path.extname(fp)] || 'application/octet-stream', fs.readFileSync(fp));
      }
      return send(res, 404, 'text/plain', '404');
    }

    // ---- static files from ui/ ----
    const rel = route === '/' ? 'index.html' : decodeURIComponent(route).replace(/^\/+/, '');
    const filePath = path.join(UI, rel);
    if (!filePath.startsWith(UI)) return send(res, 403, 'text/plain', 'Forbidden');
    fs.readFile(filePath, (err, data) => {
      if (err) return send(res, 404, 'text/plain', '404 Not Found');
      send(res, 200, MIME[path.extname(filePath)] || 'application/octet-stream', data);
    });
  })
  .listen(PORT, () => {
    console.log(`[ui] Mission Control serving at http://localhost:${PORT}/`);
    console.log(`[ui] pipeline endpoint: GET /run?url=<target>  ·  report: /report`);
  });
