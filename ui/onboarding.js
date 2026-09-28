// ============================================================
// onboarding.js — "Try it Free" wizard
// Flow: intro → create account → 6-digit token → connect Groq key → done.
// State persists in localStorage (client-side demo; no real backend).
// ============================================================

(function () {
  const LS_KEY = "qaOrchestrator.onboarding";

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
    Object.entries(panels).forEach(([k, el]) => {
      el.hidden = String(k) !== String(step);
    });
    // step bar: 1..4 (the "done" panel keeps all 4 filled)
    const n = step === "done" ? 4 : step;
    steps.forEach((s, i) => {
      s.classList.toggle("active", i + 1 === n);
      s.classList.toggle("done", i + 1 < n);
    });
  }

  function open() {
    overlay.hidden = false;
    show(1);
  }
  function close() {
    overlay.hidden = true;
  }

  function save(patch) {
    const cur = load();
    localStorage.setItem(LS_KEY, JSON.stringify({ ...cur, ...patch }));
  }
  function load() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function genToken() {
    // 6-digit numeric token
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  // ---------- generic next / back buttons ----------
  document.querySelectorAll("[data-next]").forEach((b) =>
    b.addEventListener("click", () => {
      if (current === 3) return show(4);
      if (current === 1) return show(2);
      show(current + 1);
    })
  );
  document.querySelectorAll("[data-back]").forEach((b) =>
    b.addEventListener("click", () => show(current - 1))
  );

  // ---------- step 2: create account ----------
  const acctUser = document.getElementById("acctUser");
  const acctPass = document.getElementById("acctPass");
  const acctError = document.getElementById("acctError");

  document.getElementById("acctSubmit").addEventListener("click", () => {
    const u = acctUser.value.trim();
    const p = acctPass.value;
    if (u.length < 3) return fail(acctError, "Username must be at least 3 characters.");
    if (p.length < 8) return fail(acctError, "Password must be at least 8 characters.");
    acctError.hidden = true;

    save({ username: u, createdAt: new Date().toISOString() });

    // generate + reveal the token on step 3
    const token = genToken();
    save({ token });
    document.getElementById("tokenBox").textContent = token;

    show(3);
  });

  // ---------- step 3: copy token ----------
  document.getElementById("copyToken").addEventListener("click", async () => {
    const token = document.getElementById("tokenBox").textContent;
    try {
      await navigator.clipboard.writeText(token);
      const hint = document.getElementById("copyHint");
      hint.hidden = false;
      setTimeout(() => (hint.hidden = true), 1600);
    } catch {
      /* clipboard blocked — token is visible on screen anyway */
    }
  });

  // ---------- step 4: connect Groq key ----------
  const apiKey = document.getElementById("apiKey");
  const apiError = document.getElementById("apiError");

  document.getElementById("apiSubmit").addEventListener("click", () => {
    const k = apiKey.value.trim();
    // Groq keys start with "gsk_"; keep validation light but real.
    if (!k) return fail(apiError, "Enter your Groq API key to continue.");
    if (!/^gsk_[A-Za-z0-9]{8,}$/.test(k))
      return fail(apiError, "That doesn't look like a Groq key (expected gsk_…).");
    apiError.hidden = true;

    // Store only a masked reference, never the full key in plaintext state.
    save({ apiKeyMask: k.slice(0, 6) + "…" + k.slice(-4), connectedAt: new Date().toISOString() });
    show("done");
  });

  function fail(el, msg) {
    el.textContent = msg;
    el.hidden = false;
  }

  // ---------- finish ----------
  document.getElementById("wizFinish").addEventListener("click", () => {
    const data = load();
    if (data.username) {
      // reflect the onboarded user in the top-bar badge
      const nameEl = document.getElementById("userName");
      const avEl = document.getElementById("userAvatar");
      if (nameEl) nameEl.textContent = data.username;
      if (avEl) {
        const initials = data.username
          .split(/[.\s_-]+/)
          .map((s) => s[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        avEl.textContent = initials || "U";
      }
    }
    close();
  });

  // ---------- wire triggers ----------
  tryBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) close();
  });
})();
