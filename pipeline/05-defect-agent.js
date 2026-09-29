// Defect Detector agent.
// Reads execution results, analyzes failed test cases, and logs a defect per
// real (non-healed) failure. Classifies severity and flags likely-flaky.
const path = require('path');
const { readJson, writeJson, writeFile, log } = require('./lib');

function classify(row) {
  const err = (row.error || '').toLowerCase();
  const flaky = /timeout|timed out|net::|connection|navigation|detached|target closed/.test(err);
  let severity = 'P2';
  if (/crash|cannot read|undefined is not|500|is not a function/.test(err)) severity = 'P1';
  else if (/not found|no element|visible|assert|expect/.test(err)) severity = 'P2';
  else if (!err) severity = 'P3';
  return { severity, flaky };
}

function run(runDir) {
  const exec = readJson(path.join(runDir, 'execution', 'results.json'));
  const failures = (exec.rows || []).filter((r) => r.status === 'failed');
  log('defect-detector', `analyzing ${failures.length} failed test case(s)`);

  const defects = failures.map((r, i) => {
    const { severity, flaky } = classify(r);
    return {
      id: `BUG-${String(i + 1).padStart(3, '0')}`,
      test_id: r.id,
      title: `[${r.id}] ${r.name}`,
      severity,
      is_likely_flaky: flaky,
      error_message: r.error || '(no message captured)',
      retries_attempted: r.retries ?? 0,
      recommendation: flaky
        ? 'Likely flaky (timing/environment). Re-run before filing; add explicit waits.'
        : 'Reproducible failure. Review the step and the target behavior.',
    };
  });

  writeJson(path.join(runDir, 'defects', 'defects.json'), { generatedAt: new Date().toISOString(), total: defects.length, defects });
  // human-readable log too
  const md = `# Defect Log\n\n${defects.length ? defects.map((d) =>
    `## ${d.id} — ${d.title}\n- **Severity:** ${d.severity}\n- **Likely flaky:** ${d.is_likely_flaky ? 'yes' : 'no'}\n- **Retries attempted:** ${d.retries_attempted}\n- **Error:** ${d.error_message}\n- **Recommendation:** ${d.recommendation}`
  ).join('\n\n') : 'No defects — all test cases passed (or self-healed).'}\n`;
  writeFile(path.join(runDir, 'defects', 'defects.md'), md);

  log('defect-detector', `logged ${defects.length} defect(s)`);
  return { ok: true, total: defects.length, defects };
}

module.exports = { run };
