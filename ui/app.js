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
    el.className = "agent" + (a.state === "running" ? " is-running" : "");
    el.dataset.agent = a.id;
    el.style.left = x + "px";
    el.style.top = y + "px";

    const progress = typeof a.progress === "number" ? a.progress : null;
    const badge =
      a.state === "running"
        ? '<span class="run-badge">● RUNNING</span>'
        : a.state === "fail"
        ? '<span class="run-badge fail">✕ FAILED</span>'
        : a.state === "done"
        ? '<span class="run-badge done">✓ DONE</span>'
        : "";

    // The expanded "running card" (progress + output + activity) shows when the
    // agent is running or has recorded progress; otherwise just the compact node.
    const showCard = a.state === "running" || (progress !== null && progress < 100);
    const cardHtml = showCard
      ? `<div class="agent-card">
           <div class="agent-card-head">
             <span class="agent-name">${a.name.replace(/\n/g, " ")}</span>
             ${badge}
           </div>
           <div class="prog-row"><span>Progress</span><span class="prog-pct">${progress ?? 0}%</span></div>
           <div class="prog-track"><div class="prog-fill" style="width:${progress ?? 0}%"></div></div>
           <div class="agent-output">▸ ${a.output || a.status}</div>
           <div class="agent-activity-title">Activity</div>
           <div class="agent-activity">${(a.activity || []).map(l => `<div>▸ ${l}</div>`).join("") || "<div>▸ —</div>"}</div>
         </div>`
      : "";

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
      </div>
      ${cardHtml}`;
    el.querySelector(".agent-detail").addEventListener("click", (ev) => {
      ev.stopPropagation();
      openDrawer(a);
    });
    el.addEventListener("click", () => openDrawer(a));
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
  const doRun = () => runPipeline(input.value.trim());
  runBtn.addEventListener("click", doRun);
  input.addEventListener("keydown", e => { if (e.key === "Enter") doRun(); });
}

// ---------- LIVE RUN ORCHESTRATION ----------
let running = false;

// per-agent scripted activity for the simulated run
const RUN_SCRIPT = {
  req: { verb: "Analyzing requirements", lines: ["Parsing target & intent", "Extracting acceptance criteria", "[OK] Extracted 2 requirements"], done: "2 requirements extracted" },
  tcg: { verb: "Designing test cases", lines: ["Applying equivalence partitioning", "Boundary value analysis", "[OK] Generated 6 test cases"], done: "6 test cases generated" },
  auto: { verb: "Generating scripts", lines: ["Building Page Objects", "Writing spec files", "[OK] tsc --noEmit clean"], done: "6 scripts built" },
  exec: { verb: "Executing suite", lines: ["Launching Chromium", "Running 6 tests", "[OK] 6/6 passed"], done: "6/6 passed" },
  defect: { verb: "Triaging failures", lines: ["Scanning results", "Flaky-check", "[OK] no real defects"], done: "0 defects filed" },
  report: { verb: "Building report", lines: ["Aggregating metrics", "Traceability matrix", "[OK] report delivered"], done: "report delivered" },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pushConsole(t, text) {
  state.console.push({ t, text });
  renderConsole();
  const body = document.getElementById("consoleBody");
  if (body) body.scrollTop = body.scrollHeight;
}

async function runPipeline(url) {
  if (running) return;
  running = true;

  const stateEl = document.getElementById("runState");
  const coreMain = document.getElementById("coreMain");
  stateEl.textContent = "RUNNING";
  stateEl.className = "pill pill-run";
  coreMain.textContent = "Orchestrating…";

  // reset agents to idle
  state.agents.forEach((a) => { a.state = "idle"; a.progress = 0; a.activity = []; a.output = "queued"; });
  state.console = [{ t: "tag", text: "[orchestrator] pipeline started" }];
  if (url) pushConsole("dim", `→ target: ${url}`);
  renderAgents();

  const order = ["req", "tcg", "auto", "exec", "defect", "report"];
  for (const id of order) {
    const agent = state.agents.find((a) => a.id === id);
    const script = RUN_SCRIPT[id];
    agent.state = "running";
    agent.activity = [];
    agent.output = script.verb + "…";
    pushConsole("tag", `[${id}] ${script.verb}…`);

    // animate progress 0 -> 100 with activity lines dropped in along the way
    for (let p = 0; p <= 100; p += 10) {
      agent.progress = p;
      const li = Math.floor((p / 100) * script.lines.length);
      if (script.lines[li] && agent.activity[agent.activity.length - 1] !== script.lines[li]) {
        agent.activity.push(script.lines[li]);
        agent.output = script.lines[li];
      }
      renderAgents();
      await sleep(120);
    }

    agent.progress = 100;
    agent.state = "done";
    agent.status = script.done;
    agent.output = script.done;
    if (!agent.activity.includes(script.lines[script.lines.length - 1])) {
      agent.activity.push(script.lines[script.lines.length - 1]);
    }
    pushConsole("ok", `✓ ${id}: ${script.done}`);
    renderAgents();
    await sleep(260);
  }

  pushConsole("ok", "→ execution: 6/6 passed · 100% pass rate");
  pushConsole("tag", "[orchestrator] orchestration complete");
  stateEl.textContent = "COMPLETED";
  stateEl.className = "pill pill-ok";
  coreMain.textContent = "Orchestration complete";
  running = false;
}

// ---------- AGENT DETAIL DRAWER ----------
function sectionHtml(sec) {
  switch (sec.kind) {
    case "kv":
      return `<div class="d-section">
        <div class="d-section-title">${sec.title}</div>
        <dl class="d-kv">${sec.items.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
      </div>`;
    case "list":
      return `<div class="d-section">
        <div class="d-section-title">${sec.title}</div>
        <ul class="d-list">${sec.items.map(i => `<li>${i}</li>`).join("")}</ul>
      </div>`;
    case "note":
      return `<div class="d-section"><div class="d-note">${sec.text}</div></div>`;
    case "cases":
      return `<div class="d-section">
        <div class="d-section-title">${sec.title}</div>
        ${sec.rows.map(r => `<div class="d-row">
          <span class="d-row-id">${r.id}</span>
          <span class="d-row-title">${r.title}</span>
          <span class="d-badge tech">${(r.technique || "").replace(/_/g, " ")}</span>
        </div>`).join("")}
      </div>`;
    case "results":
      return `<div class="d-section">
        <div class="d-section-title">${sec.title}</div>
        ${sec.rows.map(r => `<div class="d-row">
          <span class="d-row-id">${r.id}</span>
          <span class="d-row-title">${r.title}</span>
          <span class="d-row-meta">${r.duration}</span>
          <span class="d-badge ${r.status === "passed" ? "pass" : "fail"}">${r.status}</span>
        </div>`).join("")}
      </div>`;
    case "defects":
      return `<div class="d-section">
        <div class="d-section-title">${sec.title}</div>
        ${sec.rows.map(r => `<div class="d-row">
          <span class="d-badge fail">${r.severity}</span>
          <span class="d-row-title">${r.title}${r.error ? `<br><span class="d-row-meta">${r.error}</span>` : ""}</span>
        </div>`).join("")}
      </div>`;
    case "trace":
      return `<div class="d-section">
        <div class="d-section-title">${sec.title}</div>
        ${sec.rows.map(r => `<div class="d-trace-row">
          <span class="d-trace-req">${r.req}</span>
          <span class="d-trace-cases">${r.cases}</span>
          <span class="d-trace-align">${r.align}</span>
        </div>`).join("")}
      </div>`;
    default:
      return "";
  }
}

function openDrawer(agent) {
  const drawer = document.getElementById("drawer");
  const scrim = document.getElementById("drawerScrim");
  const name = agent.name.replace(/\n/g, " ");
  document.getElementById("drawerIcon").textContent = agent.icon;
  document.getElementById("drawerTitle").textContent = name;

  const detail = agent.detail;
  document.getElementById("drawerSub").textContent =
    (detail && detail.subtitle) || agent.status || "";

  const body = document.getElementById("drawerBody");
  if (detail && detail.sections && detail.sections.length) {
    body.innerHTML = detail.sections.map(sectionHtml).join("");
  } else {
    // fallback when running under file:// with mock data (no rich detail)
    body.innerHTML = `<div class="d-note">Status: ${agent.status}<br><br>
      Rich agent output loads when the dashboard is served over HTTP with a real
      run (npm run ui:refresh &amp;&amp; npm run ui:serve).</div>`;
  }

  scrim.hidden = false;
  drawer.hidden = false;
  drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  document.getElementById("drawer").hidden = true;
  document.getElementById("drawerScrim").hidden = true;
  document.getElementById("drawer").setAttribute("aria-hidden", "true");
}

function wireDrawer() {
  document.getElementById("drawerClose").addEventListener("click", closeDrawer);
  document.getElementById("drawerScrim").addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });
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
  wireDrawer();
});
window.addEventListener("resize", renderAgents);
