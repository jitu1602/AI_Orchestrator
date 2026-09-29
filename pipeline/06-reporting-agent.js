// Reporting agent.
// Builds a consolidated HTML execution report: every test with status and
// execution time, self-heal info, defects, and embedded screenshots of the
// failed test cases. Also emits a machine-readable summary the dashboard reads.
const path = require('path');
const fs = require('fs');
const { readJson, writeJson, writeFile, log } = require('./lib');

function run(runDir, meta) {
  const stories = readJson(path.join(runDir, 'requirements', 'user-stories.json')).stories || [];
  const tc = readJson(path.join(runDir, 'testcases', 'test-cases.json'));
  const exec = readJson(path.join(runDir, 'execution', 'results.json'));
  const defects = readJson(path.join(runDir, 'defects', 'defects.json'));

  const passRate = exec.executed ? Math.round((exec.passed / exec.executed) * 100) : 0;
  const totalMs = (exec.rows || []).reduce((s, r) => s + (r.durationMs || 0), 0);

  // screenshots live under bdd/screenshots; reference them relatively in the report
  const shotDir = path.join(runDir, 'bdd', 'screenshots');
  const shots = fs.existsSync(shotDir) ? fs.readdirSync(shotDir).filter((f) => f.endsWith('.png')) : [];

  const rowHtml = (exec.rows || []).map((r) => `
    <tr class="${r.status}">
      <td>${r.id}</td>
      <td>${r.name || ''}</td>
      <td><span class="badge ${r.status}">${r.status}</span></td>
      <td>${r.durationMs ?? 0} ms</td>
      <td>${r.retries ?? 0}${r.healed ? ' (healed)' : ''}</td>
      <td>${r.error ? String(r.error).replace(/</g, '&lt;') : ''}</td>
    </tr>`).join('');

  const shotHtml = shots.length
    ? shots.map((s) => `<figure><img src="../bdd/screenshots/${s}" alt="${s}"/><figcaption>${s}</figcaption></figure>`).join('')
    : '<p class="muted">No failure screenshots (no failures, or none captured).</p>';

  const defectHtml = defects.total
    ? defects.defects.map((d) => `<li><b>${d.id}</b> [${d.severity}${d.is_likely_flaky ? ' · flaky?' : ''}] ${d.title} — ${d.error_message}</li>`).join('')
    : '<li class="muted">No defects logged.</li>';

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>QA Execution Report — ${meta.url}</title>
<style>
  body{font-family:Segoe UI,system-ui,sans-serif;background:#0a1120;color:#cfe3f2;margin:0;padding:24px;}
  h1{font-size:20px;} h2{font-size:15px;margin-top:26px;color:#38e1c4;}
  .cards{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0;}
  .card{background:#0d1728;border:1px solid rgba(58,122,168,.25);border-radius:10px;padding:12px 16px;min-width:120px;}
  .card .v{font-size:22px;font-weight:700;} .card .l{font-size:11px;color:#6f8aa5;}
  table{width:100%;border-collapse:collapse;font-size:12.5px;}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid rgba(58,122,168,.15);}
  th{color:#6f8aa5;font-size:11px;text-transform:uppercase;letter-spacing:.08em;}
  .badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;}
  .badge.passed{background:rgba(52,211,153,.15);color:#34d399;}
  .badge.failed{background:rgba(242,97,122,.15);color:#f2617a;}
  tr.failed td{background:rgba(242,97,122,.05);}
  figure{display:inline-block;margin:8px;vertical-align:top;} img{max-width:320px;border:1px solid rgba(58,122,168,.3);border-radius:8px;}
  figcaption{font-size:10px;color:#6f8aa5;} .muted{color:#47607a;} ul{line-height:1.7;}
</style></head><body>
<h1>QA Execution Report</h1>
<p class="muted">Target: ${meta.url} · generated ${new Date().toISOString()}</p>
<div class="cards">
  <div class="card"><div class="v">${stories.length}</div><div class="l">User stories</div></div>
  <div class="card"><div class="v">${tc.total}</div><div class="l">Test cases</div></div>
  <div class="card"><div class="v">${exec.executed}</div><div class="l">Executed</div></div>
  <div class="card"><div class="v" style="color:#34d399">${exec.passed}</div><div class="l">Passed</div></div>
  <div class="card"><div class="v" style="color:#f2617a">${exec.failed}</div><div class="l">Failed</div></div>
  <div class="card"><div class="v">${passRate}%</div><div class="l">Pass rate</div></div>
  <div class="card"><div class="v">${(exec.healed||[]).length}</div><div class="l">Self-healed</div></div>
  <div class="card"><div class="v">${totalMs} ms</div><div class="l">Total time</div></div>
</div>

<h2>Test results</h2>
<table><thead><tr><th>ID</th><th>Scenario</th><th>Status</th><th>Time</th><th>Retries</th><th>Error</th></tr></thead>
<tbody>${rowHtml || '<tr><td colspan="6" class="muted">No results.</td></tr>'}</tbody></table>

<h2>Defects (${defects.total})</h2><ul>${defectHtml}</ul>

<h2>Failure screenshots</h2>${shotHtml}
</body></html>`;

  writeFile(path.join(runDir, 'report', 'index.html'), html);
  const summary = {
    url: meta.url, generatedAt: new Date().toISOString(),
    stories: stories.length, testCases: tc.total, byType: tc.byType,
    executed: exec.executed, passed: exec.passed, failed: exec.failed,
    passRate, selfHealed: (exec.healed || []).length, totalMs, defects: defects.total,
    screenshots: shots.length,
  };
  writeJson(path.join(runDir, 'report', 'summary.json'), summary);
  log('reporting-agent', `report written (${passRate}% pass, ${defects.total} defects, ${shots.length} screenshots)`);
  return { ok: true, summary, reportPath: path.join(runDir, 'report', 'index.html') };
}

module.exports = { run };
