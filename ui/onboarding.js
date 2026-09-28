// ============================================================
// onboarding.js — "Try it Free" wizard
// Mirrors the live QA Orchestrator flow:
//   1. intro  →  2. confirm account (email/password)
//   3. verification code  →  4. connect LLM provider + model
// Provider/model list and key URLs were extracted from the live app.
// Client-side demo — state persists in localStorage; no real backend.
// ============================================================

(function () {
  const LS_KEY = "qaOrchestrator.onboarding";

  // ---- providers + models (from the live app bundle) ----
  const PROVIDERS = [
    {
      id: "groq", name: "Groq", tag: "Best free Groq option",
      keyUrl: "https://console.groq.com/keys", keyPrefix: "gsk_",
      models: ["groq/compound-mini", "llama-3.3-70b-versatile", "gemma2-9b-it"],
    },
    {
      id: "openai", name: "OpenAI", tag: "Large model, 1M context",
      keyUrl: "https://platform.openai.com/api-keys", keyPrefix: "sk-",
      models: ["openai/gpt-4o", "openai/gpt-oss-120b", "openai/gpt-oss-20b"],
    },
    {
      id: "anthropic", name: "Anthropic", tag: "Free tier, no credit card",
      keyUrl: "https://console.anthropic.com/settings/keys", keyPrefix: "sk-ant-",
      models: ["claude-3-5-sonnet", "claude-3-5-haiku"],
    },
    {
      id: "deepseek", name: "DeepSeek", tag: "Open weights, cheapest per token",
      keyUrl: "https://platform.deepseek.com/api_keys", keyPrefix: "sk-",
      models: ["deepseek-chat", "deepseek-reasoner"],
    },
    {
      id: "google", name: "Google Gemini", tag: "Free tier, no credit card",
      keyUrl: "https://aistudio.google.com/app/apikey", keyPrefix: "AI",
      models: ["gemini-2.0-flash", "gemini-1.5-pro"],
    },
    {
      id: "openrouter", name: "OpenRouter", tag: "One key, many hosted models",
      keyUrl: "https://openrouter.ai/keys", keyPrefix: "sk-or-",
      models: ["qwen/qwen3.8-27b", "qwen/qwen3.6-27b", "openai/gpt-4o"],
    },
  ];

  let selectedProvider = PROVIDERS[0];

  const overlay = document.getElementById("overlay");
  const tryBtn = document.getElementById("tryBtn");
  const closeBtn = document.getElementById("wizClose");
  const steps = Array.from(document.querySelectorAll(".wiz-step"));
  const panels = {
    1: document.querySelector('[data-panel="1"]'),
    2: document.querySelector('[data-panel="2"]'),
    3: document.querySelector('[data-panel="3"]'),
    4: document.querySelector('[data-panel="4"]'),
    done: document.querySelector('[data-panel="done"]'),
  };
  let current = 1;

  // ---------- helpers ----------
  function show(step) {
    current = step;
    Object.entries(panels).forEach(([k, el]) => (el.hidden = String(k) !== String(step)));
    const n = step === "done" ? 4 : step;
    steps.forEach((s, i) => {
      s.classList.toggle("active", i + 1 === n);
      s.classList.toggle("done", i + 1 < n);
    });
  }
  function open() { overlay.hidden = false; show(1); }
  function close() { overlay.hidden = true; }
  function load() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; } }
  function save(patch) { localStorage.setItem(LS_KEY, JSON.stringify({ ...load(), ...patch })); }
  function genToken() { return String(Math.floor(100000 + Math.random() * 900000)); }
  function fail(el, msg) { el.textContent = msg; el.hidden = false; }
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  // ---------- generic next / back ----------
  document.querySelectorAll("[data-next]").forEach((b) =>
    b.addEventListener("click", () => show(current + 1))
  );
  document.querySelectorAll("[data-back]").forEach((b) =>
    b.addEventListener("click", () => show(current - 1))
  );

  // ---------- step 2: confirm account (email + password) ----------
  const acctEmail = document.getElementById("acctEmail");
  const acctPass = document.getElementById("acctPass");
  const acctError = document.getElementById("acctError");

  document.getElementById("acctSubmit").addEventListener("click", () => {
    const email = acctEmail.value.trim();
    const pass = acctPass.value;
    if (!validEmail(email)) return fail(acctError, "Enter your email and password. (Invalid email)");
    if (pass.length < 6) return fail(acctError, "Enter your email and password. (Password too short)");
    acctError.hidden = true;

    save({ email, createdAt: new Date().toISOString() });
    const code = genToken();
    save({ code });
    document.getElementById("tokenBox").textContent = code;
    document.getElementById("codeInput").value = "";
    show(3);
  });

  // ---------- step 3: copy + verify code ----------
  document.getElementById("copyToken").addEventListener("click", async () => {
    const code = document.getElementById("tokenBox").textContent;
    try {
      await navigator.clipboard.writeText(code);
      const hint = document.getElementById("copyHint");
      hint.hidden = false;
      setTimeout(() => (hint.hidden = true), 1600);
    } catch { /* clipboard blocked — code is visible on screen */ }
  });

  const codeInput = document.getElementById("codeInput");
  const codeError = document.getElementById("codeError");
  document.getElementById("codeSubmit").addEventListener("click", () => {
    const entered = codeInput.value.trim();
    const expected = load().code;
    if (entered !== expected) return fail(codeError, "That code doesn't match. Copy the code above and paste it here.");
    codeError.hidden = true;
    save({ verifiedAt: new Date().toISOString() });
    renderProviders();
    show(4);
  });

  // ---------- step 4: provider + model + key ----------
  const provGrid = document.getElementById("provGrid");
  const modelSelect = document.getElementById("modelSelect");
  const keyLink = document.getElementById("keyLink");
  const apiKey = document.getElementById("apiKey");
  const apiError = document.getElementById("apiError");

  function renderProviders() {
    provGrid.innerHTML = PROVIDERS.map(
      (p) => `<button type="button" class="prov-card${p.id === selectedProvider.id ? " sel" : ""}" data-prov="${p.id}">
        <span class="prov-name">${p.name}</span>
        <span class="prov-tag">${p.tag}</span>
      </button>`
    ).join("");
    provGrid.querySelectorAll(".prov-card").forEach((c) =>
      c.addEventListener("click", () => {
        selectedProvider = PROVIDERS.find((p) => p.id === c.dataset.prov);
        renderProviders();
        renderModels();
      })
    );
    renderModels();
  }

  function renderModels() {
    modelSelect.innerHTML = selectedProvider.models
      .map((m) => `<option value="${m}">${m}</option>`)
      .join("");
    keyLink.href = selectedProvider.keyUrl;
    keyLink.textContent = `${selectedProvider.name} →`;
    apiKey.placeholder = `${selectedProvider.keyPrefix}...`;
  }

  document.getElementById("apiSubmit").addEventListener("click", () => {
    const key = apiKey.value.trim();
    const model = modelSelect.value;
    if (!model) return fail(apiError, "Model and API key are required. (Select a model)");
    if (!key) return fail(apiError, "Model and API key are required. (Enter your API key)");
    apiError.hidden = true;

    save({
      provider: selectedProvider.id,
      model,
      apiKeyMask: key.slice(0, Math.min(6, key.length)) + "…" + key.slice(-4),
      connectedAt: new Date().toISOString(),
    });
    document.getElementById("doneText").textContent =
      `Connected ${selectedProvider.name} · ${model}. Mission Control is ready.`;
    show("done");
  });

  // ---------- finish ----------
  document.getElementById("wizFinish").addEventListener("click", () => {
    const data = load();
    if (data.email) {
      const nameEl = document.getElementById("userName");
      const avEl = document.getElementById("userAvatar");
      const handle = data.email.split("@")[0];
      if (nameEl) nameEl.textContent = handle;
      if (avEl) avEl.textContent = handle.slice(0, 2).toUpperCase();
    }
    close();
  });

  // ---------- triggers ----------
  tryBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) close(); });
})();
