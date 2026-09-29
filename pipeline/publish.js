// Publish an existing run's artifacts into top-level committed folders.
//   node pipeline/publish.js <runId>
// If no runId given, uses output/latest.json.
const path = require('path');
const fs = require('fs');
const { ROOT, RUNS, readJson } = require('./lib');

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

const runId = process.argv[2] || readJson(path.join(RUNS, 'latest.json')).runId;
const runDir = path.join(RUNS, runId);
const map = [
  ['requirements', 'requirements'],
  ['testcases', 'test-cases'],
  ['test-scripts', 'test-scripts'],
  ['execution', 'execution'],
  ['defects', 'defects'],
  ['report', 'reports'],
];
let n = 0;
for (const [src, dest] of map) {
  const from = path.join(runDir, src);
  if (!fs.existsSync(from)) continue;
  copyDir(from, path.join(ROOT, dest, runId));
  const latestDir = path.join(ROOT, dest, 'latest');
  fs.rmSync(latestDir, { recursive: true, force: true });
  copyDir(from, latestDir);
  n++;
}
console.log(`PUBLISHED ${n} folders from ${runId}`);
