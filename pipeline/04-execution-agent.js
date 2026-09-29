// Execution agent.
// Runs the generated Playwright Test suite. Playwright's own `retries` provides
// the self-heal window (up to 3 retries per test); a test that only passes on a
// later attempt is reported as "flaky/self-healed". Records per-test results,
// timings, and screenshot paths from the JSON reporter.
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { ROOT, writeJson, log } = require('./lib');

const MAX_RETRIES = 3;

function runPlaywright(scriptsDir) {
  const pwCli = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
  const args = [pwCli, 'test', `--retries=${MAX_RETRIES}`, '--config', 'playwright.config.ts'];
  const res = spawnSync(process.execPath, args, {
    cwd: scriptsDir,
    env: { ...process.env },
    encoding: 'utf8',
    timeout: 300000,
  });
  return { code: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

// Flatten Playwright's JSON report into per-test rows.
function readReport(scriptsDir) {
  const p = path.join(scriptsDir, 'results.json');
  if (!fs.existsSync(p)) return null;
  let json;
  try { json = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
  const rows = [];
  const walk = (suite) => {
    (suite.suites || []).forEach(walk);
    (suite.specs || []).forEach((spec) => {
      const test = (spec.tests || [])[0] || {};
      const results = test.results || [];
      const last = results[results.length - 1] || {};
      const status = spec.ok ? 'passed' : 'failed';
      const retries = Math.max(0, results.length - 1);
      const healed = spec.ok && retries > 0; // passed only after a retry
      const durationMs = results.reduce((s, r) => s + (r.duration || 0), 0);
      const errObj = (last.error && last.error.message) || (last.errors && last.errors[0] && last.errors[0].message) || '';
      const id = (spec.title.match(/TC-\d+/) || ['—'])[0];
      const attachments = (last.attachments || []).filter((a) => a.contentType === 'image/png').map((a) => a.path);
      rows.push({
        id, name: spec.title, status, retries, healed,
        durationMs: Math.round(durationMs),
        error: errObj ? String(errObj).replace(/\u001b\[[0-9;]*m/g, '').split('\n')[0] : null,
        screenshot: attachments[0] || null,
      });
    });
  };
  (json.suites || []).forEach(walk);
  return rows;
}

function run(runDir) {
  const scriptsDir = path.join(runDir, 'test-scripts');
  log('execution-agent', `running Playwright suite (retries=${MAX_RETRIES} self-heal)…`);
  const out = runPlaywright(scriptsDir);
  const rows = readReport(scriptsDir);

  if (!rows) {
    log('execution-agent', 'no Playwright report produced; recording setup failure');
    writeJson(path.join(runDir, 'execution', 'results.json'), {
      generatedAt: new Date().toISOString(), executed: 0, passed: 0, failed: 0,
      note: 'Suite did not produce a report (setup/compile issue).',
      stderr: (out.stderr || '').split('\n').slice(-10).join('\n'), rows: [],
    });
    return { ok: false, executed: 0, passed: 0, failed: 0, rows: [], setupError: true };
  }

  const passed = rows.filter((r) => r.status === 'passed').length;
  const failed = rows.filter((r) => r.status === 'failed').length;
  const healed = rows.filter((r) => r.healed).map((r) => r.id);

  // collect failure screenshots into an execution/screenshots folder (stable paths)
  const shotDir = path.join(runDir, 'execution', 'screenshots');
  const screenshots = [];
  rows.forEach((r) => {
    if (r.status === 'failed' && r.screenshot && fs.existsSync(r.screenshot)) {
      fs.mkdirSync(shotDir, { recursive: true });
      const dest = `${r.id}.png`;
      try { fs.copyFileSync(r.screenshot, path.join(shotDir, dest)); r.screenshotFile = dest; screenshots.push(dest); } catch {}
    }
  });

  writeJson(path.join(runDir, 'execution', 'results.json'), {
    generatedAt: new Date().toISOString(),
    executed: rows.length, passed, failed, healed,
    maxRetries: MAX_RETRIES, rows, screenshots,
  });
  log('execution-agent', `done: ${passed}/${rows.length} passed, ${failed} failed, ${healed.length} self-healed`);
  return { ok: true, executed: rows.length, passed, failed, healed, rows, screenshots };
}

module.exports = { run };
