// Execution agent.
// Runs the generated BDD suite. For each failing scenario it retries up to 3
// times (self-heal window) before marking it failed and moving on. Records
// per-test results, timings, and screenshot paths.
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { ROOT, readJson, writeJson, log } = require('./lib');

const MAX_RETRIES = 3;

function runCucumber(bddDir, tagExpr) {
  const cucumberBin = path.join(ROOT, 'node_modules', '@cucumber', 'cucumber', 'bin', 'cucumber-js');
  const args = [cucumberBin, '--config', 'cucumber.js'];
  if (tagExpr) args.push('--tags', tagExpr);
  const res = spawnSync(process.execPath, args, {
    cwd: bddDir,
    env: { ...process.env },
    encoding: 'utf8',
    timeout: 180000,
  });
  return { code: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

function readCucumberReport(bddDir) {
  const p = path.join(bddDir, 'report', 'cucumber.json');
  if (!fs.existsSync(p)) return [];
  try {
    const features = JSON.parse(fs.readFileSync(p, 'utf8'));
    const rows = [];
    features.forEach((f) => {
      (f.elements || []).forEach((sc) => {
        const steps = sc.steps || [];
        const failed = steps.find((s) => s.result && s.result.status === 'failed');
        const durationNs = steps.reduce((sum, s) => sum + ((s.result && s.result.duration) || 0), 0);
        const tag = (sc.tags || []).map((t) => t.name).find((n) => /^@TC-/.test(n)) || '';
        rows.push({
          id: tag.replace('@', '') || sc.id,
          name: sc.name,
          status: failed ? 'failed' : 'passed',
          durationMs: Math.round(durationNs / 1e6),
          error: failed && failed.result ? String(failed.result.error_message || '').split('\n')[0] : null,
        });
      });
    });
    return rows;
  } catch {
    return [];
  }
}

function run(runDir) {
  const bddDir = path.join(runDir, 'bdd');
  const results = [];
  let attemptsLog = [];

  // First full pass
  log('execution-agent', 'running BDD suite…');
  let out = runCucumber(bddDir);
  let rows = readCucumberReport(bddDir);

  if (!rows.length) {
    // suite couldn't produce a report (e.g. compile/setup error) — record it honestly
    log('execution-agent', 'no cucumber report produced; recording setup failure');
    attemptsLog.push({ phase: 'initial', code: out.code, stderr: out.stderr.split('\n').slice(-8).join('\n') });
    writeJson(path.join(runDir, 'execution', 'results.json'), {
      generatedAt: new Date().toISOString(),
      executed: 0, passed: 0, failed: 0, note: 'Suite did not produce a report (setup/compile issue).',
      attempts: attemptsLog, rows: [],
    });
    return { ok: false, executed: 0, passed: 0, failed: 0, rows: [], setupError: true };
  }

  // Self-heal: retry each failed scenario up to MAX_RETRIES by tag
  const healed = [];
  for (const r of rows) {
    if (r.status === 'passed') { results.push(r); continue; }
    let attempts = 1;
    let cur = r;
    while (cur.status === 'failed' && attempts <= MAX_RETRIES && /^TC-/.test(r.id)) {
      log('execution-agent', `self-heal retry ${attempts}/${MAX_RETRIES} for ${r.id}`);
      runCucumber(bddDir, `@${r.id}`);
      const reRows = readCucumberReport(bddDir);
      const again = reRows.find((x) => x.id === r.id);
      if (again && again.status === 'passed') { cur = again; healed.push(r.id); break; }
      attempts += 1;
    }
    attemptsLog.push({ id: r.id, retries: Math.min(attempts, MAX_RETRIES), finalStatus: cur.status });
    results.push({ ...cur, retries: Math.min(attempts, MAX_RETRIES), healed: healed.includes(r.id) });
  }

  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const screenshotsDir = path.join(bddDir, 'screenshots');
  const screenshots = fs.existsSync(screenshotsDir) ? fs.readdirSync(screenshotsDir).filter((f) => f.endsWith('.png')) : [];

  writeJson(path.join(runDir, 'execution', 'results.json'), {
    generatedAt: new Date().toISOString(),
    executed: results.length, passed, failed, healed,
    maxRetries: MAX_RETRIES, attempts: attemptsLog, rows: results, screenshots,
  });
  log('execution-agent', `done: ${passed}/${results.length} passed, ${failed} failed, ${healed.length} self-healed`);
  return { ok: true, executed: results.length, passed, failed, healed, rows: results, screenshots };
}

module.exports = { run };
