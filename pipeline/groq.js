// Zero-dependency LLM client for the pipeline agents.
// Supports two providers, selectable via env; same exported API either way so
// the agents don't need to change:
//   - groq   : cloud, needs GROQ_API_KEY (gsk_...)
//   - ollama : local, no key, talks to http://localhost:11434
//
// Provider selection (LLM_PROVIDER=groq|ollama), else auto:
//   * if GROQ_API_KEY (gsk_) is set  -> groq
//   * else                           -> ollama (local)
//
// Env vars:
//   LLM_PROVIDER              groq | ollama   (optional; auto-detected)
//   GROQ_API_KEY / LLM_API_KEY / API_KEY
//   GROQ_MODEL                default openai/gpt-oss-20b
//   OLLAMA_HOST               default http://localhost:11434
//   OLLAMA_MODEL              default llama3.2
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// minimal .env loader (so we don't depend on dotenv being required first)
(function loadEnv() {
  const p = path.join(ROOT, '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

function groqKey() {
  return process.env.GROQ_API_KEY || process.env.LLM_API_KEY || process.env.API_KEY || '';
}
function ollamaHost() {
  return process.env.OLLAMA_HOST || 'http://localhost:11434';
}

// which provider to use
function provider() {
  const explicit = (process.env.LLM_PROVIDER || '').toLowerCase();
  if (explicit === 'groq' || explicit === 'ollama') return explicit;
  if (/^gsk_/.test(groqKey())) return 'groq';
  return 'ollama';
}

function model() {
  if (provider() === 'groq') return process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  return process.env.OLLAMA_MODEL || 'llama3.2';
}

// Groq is "enabled" if it has a key. Ollama is assumed available locally; the
// agents call isEnabled() to decide whether to attempt the LLM at all, and fall
// back to heuristics on any failure — so returning true for ollama is safe.
function isEnabled() {
  return provider() === 'groq' ? /^gsk_/.test(groqKey()) : true;
}

// ---- Groq (OpenAI-compatible) ----
// jsonMode=true asks Groq to enforce JSON (can 400 on complex schemas);
// jsonMode=false lets the model return text we parse defensively.
function groqChat(messages, { temperature = 0.2, maxTokens = 2048, jsonMode = true } = {}) {
  return new Promise((resolve, reject) => {
    const payload = { model: model(), messages, temperature, max_tokens: maxTokens };
    if (jsonMode) payload.response_format = { type: 'json_object' };
    const body = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: 'api.groq.com', path: '/openai/v1/chat/completions', method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey()}`,
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 60000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`Groq HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          try { resolve(JSON.parse(data).choices?.[0]?.message?.content ?? ''); }
          catch (e) { reject(e); }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Groq request timed out')));
    req.write(body); req.end();
  });
}

// ---- Ollama (local) ----
function ollamaChat(messages, { temperature = 0.2 } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/chat', ollamaHost());
    const body = JSON.stringify({
      model: model(), messages, stream: false,
      format: 'json', // ask Ollama to constrain output to valid JSON
      options: { temperature },
    });
    const req = http.request(
      {
        hostname: url.hostname, port: url.port || 11434, path: url.pathname, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 120000, // local models can be slower
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`Ollama HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          try { resolve(JSON.parse(data).message?.content ?? ''); }
          catch (e) { reject(e); }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Ollama request timed out')));
    req.write(body); req.end();
  });
}

function chat(messages, opts) {
  return provider() === 'groq' ? groqChat(messages, opts) : ollamaChat(messages, opts);
}

function parseJson(raw) {
  let text = String(raw).trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  // last resort: slice from first { to last }
  if (!/^[[{]/.test(text)) {
    const a = text.indexOf('{'); const b = text.lastIndexOf('}');
    if (a >= 0 && b > a) text = text.slice(a, b + 1);
  }
  return JSON.parse(text);
}

// Ask the model for JSON; parse defensively. On Groq's json-validation 400,
// retry once WITHOUT json mode (the model returns JSON text we parse ourselves).
async function chatJSON(system, user, opts = {}) {
  const messages = [
    { role: 'system', content: system + ' Respond with ONLY valid minified JSON, no prose, no code fences.' },
    { role: 'user', content: user },
  ];
  try {
    return parseJson(await chat(messages, opts));
  } catch (e) {
    if (provider() === 'groq' && /HTTP 400|validate JSON|Unexpected|JSON/i.test(String(e.message))) {
      const raw = await groqChat(messages, { ...opts, jsonMode: false });
      return parseJson(raw);
    }
    throw e;
  }
}

module.exports = { isEnabled, model, provider, chat, chatJSON };
