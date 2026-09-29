// Test Case Generator agent.
// Reads user stories and generates positive, negative, edge, and end-to-end
// test cases as structured JSON that the Automation Generator turns into real
// Playwright spec files (no BDD/Gherkin).
//
// Each case carries:
//   - actions[]  : ordered steps the spec will perform, from a fixed vocabulary
//                  { fill: "<field>", value: "<literal|env:USERNAME>" }
//                  { fillInvalid: "<field>" } | { fillEmpty: "<field>" }
//                  { click: "<button|submit>" } | { goto: true }
//   - assertion  : one checkable claim: "url contains <x>" | "text <x> is visible"
//                  | "element <css> is visible" | "page title is not empty"
// When Groq is available the LLM designs these grounded in the crawled fields;
// otherwise a deterministic heuristic builds them from the form structure.
const path = require('path');
const { readJson, writeJson, log } = require('./lib');
const groq = require('./groq');

// discover form fields from the crawl (name + type) for grounding
function fieldsFromCtx(ctx) {
  const s = ctx.structure || {};
  const forms = s.forms || [];
  const fields = forms.length ? forms[0].inputs : s.inputs || [];
  return fields.filter((f) => f.name).map((f) => ({ name: f.name, type: f.type, required: !!f.required }));
}

// ---------- heuristic fallback ----------
function casesHeuristic(stories, ctx, idxRef) {
  const fields = fieldsFromCtx(ctx);
  const textLike = fields.filter((f) => /text|email|password|search|tel|number/.test(f.type));
  const cases = [];
  const mk = (story, type, priority, title, actions, assertion) => {
    idxRef.n += 1;
    cases.push({ id: `TC-${String(idxRef.n).padStart(3, '0')}`, story_id: story.id, type, priority, title, actions, assertion, source: 'heuristic' });
  };
  const story = stories[0] || { id: 'US-001', title: 'primary flow' };

  // positive: fill every field with a valid value, submit
  mk(story, 'positive', 'P1', 'Verify the primary action succeeds with valid input',
    [{ goto: true }, ...textLike.map((f) => ({ fill: f.name, value: /pass/i.test(f.name) ? 'env:PASSWORD' : 'env:USERNAME' })), { click: 'submit' }],
    'page title is not empty');

  // negative: invalid values, submit -> expect an error
  if (textLike.length) {
    mk(story, 'negative', 'P2', 'Verify invalid input is rejected with an error',
      [{ goto: true }, ...textLike.map((f) => ({ fillInvalid: f.name })), { click: 'submit' }],
      'text error is visible');
  }
  // edge: empty required field, submit -> expect an error
  const req = fields.find((f) => f.required) || textLike[0];
  if (req) {
    mk(story, 'edge', 'P3', `Verify empty ${req.name} is handled`,
      [{ goto: true }, { fillEmpty: req.name }, { click: 'submit' }],
      'text error is visible');
  }
  return cases;
}

// ---------- LLM-powered ----------
async function casesLLM(stories, ctx, idxRef) {
  const fields = fieldsFromCtx(ctx);
  const system =
    'You are a senior QA automation engineer. Design concrete, runnable Playwright test cases for the given ' +
    'web page, using equivalence partitioning, boundary value analysis, and error guessing. Cover positive, ' +
    'negative, and edge types. Ground everything in the provided form fields — never invent fields.\n' +
    'For each case return an ordered "actions" array from THIS vocabulary only:\n' +
    '  {"goto": true}\n' +
    '  {"fill": "<fieldName>", "value": "<literal>"}     // use "env:USERNAME"/"env:PASSWORD" for real creds\n' +
    '  {"fillInvalid": "<fieldName>"}                     // a wrong-but-formatted value\n' +
    '  {"fillEmpty": "<fieldName>"}                       // clear the field\n' +
    '  {"click": "submit"}                                // submit the form / primary button\n' +
    'and a single "assertion": one of "url contains <fragment>", "text <phrase> is visible", ' +
    '"element <cssSelector> is visible", "page title is not empty".\n' +
    'Return AT MOST 3 cases per story (one positive, one negative, one edge) to keep output compact. ' +
    'Return strict minified JSON: {"cases":[{"story_id":"US-001","type":"positive|negative|edge","priority":"P1|P2|P3",' +
    '"title":"Verify ...","actions":[...],"assertion":"..."}]}.';
  const user = JSON.stringify({
    stories: stories.map((s) => ({ id: s.id, title: s.title, role: s.role, want: s.want, so: s.so })),
    page: { url: ctx.url, title: ctx.title, fields },
  }).slice(0, 12000);

  const out = await groq.chatJSON(system, user, { temperature: 0.2, maxTokens: 8000 });
  const raw = out.cases || [];
  if (!raw.length) throw new Error('LLM returned no test cases');
  return raw.map((c) => {
    idxRef.n += 1;
    return {
      id: `TC-${String(idxRef.n).padStart(3, '0')}`,
      story_id: c.story_id || stories[0].id,
      type: ['positive', 'negative', 'edge'].includes(c.type) ? c.type : 'positive',
      priority: /P[0-3]/.test(c.priority) ? c.priority : 'P2',
      title: c.title || 'Verify behavior',
      actions: Array.isArray(c.actions) && c.actions.length ? c.actions : [{ goto: true }, { click: 'submit' }],
      assertion: c.assertion || 'page title is not empty',
      source: 'llm',
    };
  });
}

function e2eCase(stories, ctx, idxRef) {
  const fields = fieldsFromCtx(ctx);
  const textLike = fields.filter((f) => /text|email|password|search|tel|number/.test(f.type));
  idxRef.n += 1;
  return {
    id: `TC-${String(idxRef.n).padStart(3, '0')}`,
    story_id: stories.map((s) => s.id).join('+'),
    type: 'e2e', priority: 'P1',
    title: 'End-to-end: complete the primary journey with valid data',
    actions: [{ goto: true }, ...textLike.map((f) => ({ fill: f.name, value: /pass/i.test(f.name) ? 'env:PASSWORD' : 'env:USERNAME' })), { click: 'submit' }],
    assertion: 'page title is not empty',
  };
}

async function run(runDir) {
  const { stories } = readJson(path.join(runDir, 'requirements', 'user-stories.json'));
  const ctx = readJson(path.join(runDir, 'requirements', 'crawl-context.json'));
  log('test-case-generator', `read ${stories.length} user stories`);

  const idxRef = { n: 0 };
  let allCases = [];
  let mode = 'heuristic';

  if (groq.isEnabled()) {
    try {
      log('test-case-generator', `asking ${groq.provider()} (${groq.model()}) for intelligent test cases…`);
      allCases = await casesLLM(stories, ctx, idxRef);
      mode = 'llm';
      log('test-case-generator', `LLM produced ${allCases.length} test cases`);
    } catch (e) {
      log('test-case-generator', `LLM failed (${String(e.message).slice(0, 80)}); using heuristics`);
    }
  } else {
    log('test-case-generator', 'no LLM available; using heuristics');
  }
  if (!allCases.length) allCases = casesHeuristic(stories, ctx, idxRef);

  if (stories.length > 1) allCases.push(e2eCase(stories, ctx, idxRef));

  const byType = allCases.reduce((m, c) => ((m[c.type] = (m[c.type] || 0) + 1), m), {});
  writeJson(path.join(runDir, 'testcases', 'test-cases.json'), { generatedAt: new Date().toISOString(), mode, total: allCases.length, byType, cases: allCases });
  log('test-case-generator', `generated ${allCases.length} test cases (${mode}) ${JSON.stringify(byType)}`);
  return { ok: true, total: allCases.length, byType, cases: allCases, mode };
}

module.exports = { run };
