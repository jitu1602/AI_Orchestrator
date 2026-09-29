// Zero-dependency Groq client for the pipeline agents.
// Reads the API key + model from environment (and .env). Exposes a chatJSON()
// helper that asks the model to return strict JSON and parses it defensively.
//
// Env vars (any of these work for the key):
//   GROQ_API_KEY  (preferred)   ·  LLM_API_KEY  ·  API_KEY
//   GROQ_MODEL    (optional, default llama-3.3-70b-versatile)
const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// minimal .env loader (so we don't depend on dotenv being required first)
function loadEnv() {
  const p = path.join(ROOT, '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();

function apiKey() {
  return process.env.GROQ_API_KEY || process.env.LLM_API_KEY || process.env.API_KEY || '';
}
function model() {
  return process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
}
function isEnabled() {
  return /^gsk_/.test(apiKey());
}

function chat(messages, { temperature = 0.2, maxTokens = 2048 } = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: model(),
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    });
    const req = https.request(
      {
        hostname: 'api.groq.com',
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey()}`,
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 60000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`Groq HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          }
          try {
            const json = JSON.parse(data);
            resolve(json.choices?.[0]?.message?.content ?? '');
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Groq request timed out')));
    req.write(body);
    req.end();
  });
}

// Ask the model for strict JSON; parse defensively (strip fences if any).
async function chatJSON(system, user, opts) {
  const raw = await chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    opts
  );
  let text = String(raw).trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  return JSON.parse(text);
}

module.exports = { isEnabled, model, chat, chatJSON };
