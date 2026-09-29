// Shared helpers for the QA pipeline agents.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RUNS = path.join(ROOT, 'runs');

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function writeFile(p, content) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content);
  return p;
}

function writeJson(p, obj) {
  return writeFile(p, JSON.stringify(obj, null, 2));
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'target';
}

function log(agent, msg) {
  const line = `[${new Date().toISOString()}] [${agent}] ${msg}`;
  console.log(line);
  return line;
}

// resolve the Playwright chromium; used by crawler + executor
function pwChromium() {
  try {
    return require(path.join(ROOT, 'node_modules', 'playwright')).chromium;
  } catch {
    return require(path.join(ROOT, 'node_modules', '@playwright', 'test')).chromium;
  }
}

module.exports = { ROOT, RUNS, ts, ensureDir, writeFile, writeJson, readJson, slug, log, pwChromium };
