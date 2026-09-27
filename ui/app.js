// ============================================================
// QA Orchestrator — Mission Control (front-end mock)
// Data mirrors the reference dashboard screenshot. Swap `state`
// for a live API response to make it real.
// ============================================================

// `state` below is the fallback mock. On load we try to fetch data.json
// (produced by `node ui/build-data.js` from a real Playwright run) and use
// it instead when available.
let state = {
  runState: "COMPLETED",
  coreMessage: "Orchestration complete",
  metrics: {
    pipeline: [
      { icon: "📄", val: 2, label: "Requirements", cls: "c-cyan" },
      { icon: "🧪", val: 15, label: "Test Cases", cls: "c-cyan" },
      { icon: "</>", val: 0, label: "Scripts", cls: "c-cyan" },
      { icon: "⇄", val: 0, label: "Duplicates", cls: "c-cyan" },
    ],
    execution: [
      { icon: "▶", val: 1, label: "Executed", cls: "c-amber" },
      { icon: "✓", val: 0, label: "Passed", cls: "c-green" },
      { icon: "✕", val: 1, label: "Failed", cls: "c-red" },
      { icon: "%", val: "0%", label: "Pass Rate", cls: "c-red" },
    ],
    quality: [
      { icon: "◎", val: "100%", label: "Req. Coverage", cls: "c-green" },
      { icon: "🐞", val: 0, label: "Defects Filed", cls: "c-red" },
      { icon: "❤", val: "0 / 0", label: "Healed / Flaky", cls: "c-amber" },
    ],
  },
  // angle in degrees (0 = right, clockwise), radius fraction of stage
  agents: [
    { id: "req",   name: "Requirement\nAnalyzer",  icon: "🔍", status: "2 requirements e…", state: "done", angle: 270, r: 0.34 },
    { id: "tcg",   name: "Test Case\nGenerator",   icon: "🧪", status: "15 test cases ge…", state: "done", angle: 330, r: 0.40 },
    { id: "auto",  name: "Automation\nGenerator",  icon: "</>", status: "[ScriptExecutor] E…", state: "done", angle: 30,  r: 0.40 },
    { id: "exec",  name: "Execution\nAgent",       icon: "▷", status: "0/1 passed",       state: "fail", angle: 90,  r: 0.34 },
    { id: "defect",name: "Defect\nDetector",       icon: "🐞", status: "0 defects filed",   state: "done", angle: 150, r: 0.40 },
    { id: "report",name: "Reporting\nAgent",       icon: "📋", status: "report delivered",  state: "done", angle: 210, r: 0.40 },
  ],
  console: [
    { t: "tag", text: "[orchestrator] pipeline started" },
    { t: "dim", text: "→ requirement analyzer: 2 requirements extracted" },
    { t: "dim", text: "→ test case generator: 15 cases (EP, BVA, decision table)" },
    { t: "dim", text: "→ automation generator: scripts built" },
    { t: "run", text: "→ execution agent: running suite…" },
    { t: "fail", text: "✕ TC-001 login redirect — 1 failed" },
    { t: "ok", text: "✓ 0/1 passed · coverage 100%" },
    { t: "tag", text: "[orchestrator] orchestration complete" },
  ],
  deepeval: {
    verdict: "FAIL · 29%",
    bars: [
      { label: "Overall Accuracy", val: 29, color: "var(--blue)" },
      { label: "Test Coverage", val: 0, color: "var(--cyan)" },
      { label: "Script Quality", val: 0, color: "var(--cyan)" },
      { label: "Bug Quality", val: 100, color: "var(--violet)" },
    ],
  },
  trace: {
    rows: [
      { req: "REQ-001", desc: "User login with valid credentials", cases: 8, align: "Covered ✓✓" },
      { req: "REQ-002", desc: "Error message for locked-out account", cases: 7, align: "Covered" },
    ],
    foot: "2/2 requirements covered · 1 fully (+/-)",
  },
};

// ---------- METRICS ----------
function renderMetrics() {
  const groups = [
    { label: "PIPELINE OUTPUT", items: state.metrics.pipeline },
    { label: "EXECUTION", items: state.metrics.execution },
    { label: "QUALITY", items: state.metrics.quality },
  ];
  document.getElementById("metrics").innerHTML = groups.map(g => `
    <div class="metric-group">
      <div class="metric-group-label">${g.label}</div>
      ${g.items.map(m => `
        <div class="metric">
          <span class="metric-icon ${m.cls}">${m.icon}</span>
          <div>
            <div class="metric-val ${m.cls}">${m.val}</div>
            <div class="metric-label">${m.label}</div>
          </div>
        </div>`).join("")}
    </div>`).join("");
}

// ---------- CONSOLE ----------
function renderConsole() {
  document.getElementById("consoleBody").innerHTML =
    state.console.map(l => `<div class="log-line"><span class="${l.t}">${l.text}</span></div>`).join("");
  document.getElementById("consoleSub").innerHTML = "0/1 passed · 100%<br />cov · 0 defects";
}

// ---------- AGENT CONSTELLATION ----------
function renderAgents() {
  const stage = document.querySelector(".stage");
  const agentsEl = document.getElementById("agents");
  const svg = document.getElementById("linksSvg");
  const w = stage.clientWidth, h = stage.clientHeight;
  const cx = w / 2, cy = h / 2;
  const radius = Math.min(w, h);

  agentsEl.innerHTML = "";
  let lines = "";

  state.agents.forEach(a => {
    const rad = (a.angle * Math.PI) / 180;
    const x = cx + Math.cos(rad) * radius * a.r;
    const y = cy + Math.sin(rad) * radius * a.r;

    // connector line core -> node
    const strokeColor = a.state === "fail" ? "rgba(242,97,122,0.5)" : "rgba(56,225,196,0.32)";
    lines += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${strokeColor}" stroke-width="1" stroke-dasharray="3 5" />`;

    const el = document.createElement("div");
    el.className = "agent";
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.innerHTML = `
      <div class="agent-inner">
        <div class="agent-icon">${a.icon}</div>
        <div>
          <div class="agent-name">${a.name.replace(/\n/g, "<br>")}</div>
          <div class="agent-status">
            <span class="node-dot s-${a.state}"></span>${a.status}
          </div>
          <span class="agent-detail">Details ›</span>
        </div>
      </div>`;
    el.querySelector(".agent-detail").addEventListener("click", () =>
      alert(`${a.name.replace(/\n/g, " ")}\nStatus: ${a.status}`));
    agentsEl.appendChild(el);
  });

  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.innerHTML = lines;
}

// ---------- DEEPEVAL ----------
function renderDeepEval() {
  document.getElementById("evalVerdict").textContent = state.deepeval.verdict;
  document.getElementById("evalBars").innerHTML = state.deepeval.bars.map(b => `
    <div class="bar-row">
      <span class="bar-label">${b.label}</span>
      <span class="bar-val" style="color:${b.color}">${b.val}%</span>
      <div class="bar-track"><div class="bar-fill" style="width:${b.val}%;background:${b.color}"></div></div>
    </div>`).join("");
}

// ---------- TRACEABILITY ----------
function renderTrace() {
  document.getElementById("traceRows").innerHTML = state.trace.rows.map(r => `
    <div class="trace-row">
      <div>
        <div class="trace-req">${r.req}</div>
        <div class="trace-desc">${r.desc}</div>
      </div>
      <div class="trace-cases">${r.cases}</div>
      <div class="trace-align">${r.align}</div>
    </div>`).join("");
  document.getElementById("traceFoot").innerHTML =
    `✓ <b>${state.trace.foot}</b>`;
}

// ---------- INTERACTIONS ----------
function wireControls() {
  const runBtn = document.getElementById("runBtn");
  const input = document.getElementById("testInput");
  const doRun = () => {
    const stateEl = document.getElementById("runState");
    stateEl.textContent = "RUNNING";
    stateEl.className = "pill pill-fail";
    document.getElementById("coreMain").textContent = "Orchestrating…";
    setTimeout(() => {
      stateEl.textContent = "COMPLETED";
      stateEl.className = "pill pill-ok";
      document.getElementById("coreMain").textContent = "Orchestration complete";
    }, 1600);
  };
  runBtn.addEventListener("click", doRun);
  input.addEventListener("keydown", e => { if (e.key === "Enter") doRun(); });
}

function renderAll() {
  renderMetrics();
  renderConsole();
  renderAgents();
  renderDeepEval();
  renderTrace();
}

async function loadData() {
  try {
    const res = await fetch("data.json", { cache: "no-store" });
    if (res.ok) {
      const live = await res.json();
      state = { ...state, ...live };
      console.info("[dashboard] loaded live data.json", live.generatedAt || "");
    }
  } catch (e) {
    // fetch fails under file:// in some browsers — fall back to the mock.
    console.info("[dashboard] data.json not available, using mock data");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  renderAll();
  wireControls();
});
window.addEventListener("resize", renderAgents);
