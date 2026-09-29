// Test Case Generator agent.
// Reads user stories and generates positive, negative, edge, and end-to-end
// test cases, plus Gherkin .feature files for the BDD framework.
//
// When a Groq key is set, the LLM produces intelligent, story-specific test
// cases WITH a concrete, checkable assertion per case (e.g. "URL contains
// /inventory", "an element with text 'Error' is visible"). The generated
// Gherkin carries that assertion so the step definitions can actually verify it.
// Falls back to deterministic heuristics if the LLM is unavailable.
const path = require('path');
const { readJson, writeJson, writeFile, log, slug } = require('./lib');
const groq = require('./groq');

// ---------- heuristic fallback ----------
function casesForStoryHeuristic(story, idxRef) {
  const cases = [];
  const mk = (type, title, variant, assertion) => {
    idxRef.n += 1;
    cases.push({
      id: `TC-${String(idxRef.n).padStart(3, '0')}`,
      story_id: story.id, type, priority: story.priority, title, variant,
      assertion: assertion || 'the page remains responsive',
    });
  };
  const t = story.title;
  mk('positive', `Verify ${t.toLowerCase()} succeeds with valid input`, 'valid', 'the expected result is shown after a valid action');
  mk('negative', `Verify ${t.toLowerCase()} fails gracefully with invalid input`, 'invalid', 'a clear error message is shown');
  mk('edge', `Verify ${t.toLowerCase()} handles boundary/empty input`, 'empty or boundary', 'the system handles the edge case without crashing');
  return cases;
}

// ---------- LLM-powered ----------
async function casesForStoriesLLM(stories, ctx, idxRef) {
  const system =
    'You are a senior QA test designer. For each user story, design concrete test cases using ' +
    'equivalence partitioning, boundary value analysis, and error guessing. Cover positive, negative, ' +
    'and edge types. Every test case MUST include a single concrete, machine-checkable assertion phrased ' +
    'as one of: "url contains <fragment>", "text <phrase> is visible", "element <css> is visible", ' +
    '"page title is not empty". Ground everything in the provided page structure — do not invent fields. ' +
    'Return strict JSON: {"cases":[{"story_id":"US-001","type":"positive|negative|edge","title":"Verify ...",' +
    '"variant":"valid|invalid|empty or boundary","assertion":"url contains /inventory","priority":"P1|P2|P3"}]}.';
  const user = JSON.stringify({
    stories: stories.map((s) => ({ id: s.id, title: s.title, role: s.role, want: s.want, so: s.so })),
    page: { url: ctx.url, title: ctx.title, structure: ctx.structure || {} },
  }).slice(0, 12000);

  const out = await groq.chatJSON(system, user, { temperature: 0.25, maxTokens: 3000 });
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
      variant: c.variant || (c.type === 'negative' ? 'invalid' : c.type === 'edge' ? 'empty or boundary' : 'valid'),
      assertion: c.assertion || 'page title is not empty',
      source: 'llm',
    };
  });
}

function e2eCase(stories, idxRef) {
  idxRef.n += 1;
  return {
    id: `TC-${String(idxRef.n).padStart(3, '0')}`,
    story_id: stories.map((s) => s.id).join('+'),
    type: 'e2e', priority: 'P1',
    title: 'End-to-end: complete the primary journey across the app',
    steps: stories.map((s, i) => `Step ${i + 1}: ${s.title}`),
    assertion: 'page title is not empty',
  };
}

// Build an executable scenario. The "When ... with <variant>" and the explicit
// assertion step both map to generic step defs, so the LLM's assertion is
// actually verified at runtime.
function scenarioFor(c) {
  const tag = `@${c.type} @${c.id} @${c.priority}`;
  return `  ${tag}
  Scenario: ${c.title}
    Given the application is open
    When the user performs the "${c.type}" action with ${c.variant} input
    Then the assertion "${c.assertion.replace(/"/g, "'")}" holds`;
}

function toFeature(story, cases) {
  return `Feature: ${story.title}
  # ${story.id} — As a ${story.role}, I want to ${story.want}, so that ${story.so}.

${cases.map(scenarioFor).join('\n\n')}
`;
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
      log('test-case-generator', `asking Groq (${groq.model()}) for intelligent test cases…`);
      allCases = await casesForStoriesLLM(stories, ctx, idxRef);
      mode = 'llm';
      log('test-case-generator', `LLM produced ${allCases.length} test cases`);
    } catch (e) {
      log('test-case-generator', `LLM failed (${String(e.message).slice(0, 80)}); using heuristics`);
    }
  } else {
    log('test-case-generator', 'no Groq key set; using heuristics');
  }
  if (!allCases.length) {
    stories.forEach((story) => allCases.push(...casesForStoryHeuristic(story, idxRef)));
  }

  // group cases by story and write one feature file per story
  const featureDir = path.join(runDir, 'bdd', 'features');
  const byStory = {};
  allCases.forEach((c) => ((byStory[c.story_id] = byStory[c.story_id] || []).push(c)));
  stories.forEach((story) => {
    const cases = byStory[story.id] || [];
    if (cases.length) writeFile(path.join(featureDir, `${story.id.toLowerCase()}-${slug(story.title)}.feature`), toFeature(story, cases));
  });

  // end-to-end scenario across all stories
  if (stories.length > 1) {
    const e2e = e2eCase(stories, idxRef);
    allCases.push(e2e);
    writeFile(
      path.join(featureDir, 'e2e-primary-journey.feature'),
      `Feature: End-to-end primary journey\n\n  @e2e @${e2e.id} @P1\n  Scenario: ${e2e.title}\n    Given the application is open\n${e2e.steps.map((s) => `    * note "${s}"`).join('\n')}\n    Then the assertion "page title is not empty" holds\n`
    );
  }

  const byType = allCases.reduce((m, c) => ((m[c.type] = (m[c.type] || 0) + 1), m), {});
  writeJson(path.join(runDir, 'testcases', 'test-cases.json'), { generatedAt: new Date().toISOString(), mode, total: allCases.length, byType, cases: allCases });
  log('test-case-generator', `generated ${allCases.length} test cases (${mode}) ${JSON.stringify(byType)}`);
  return { ok: true, total: allCases.length, byType, cases: allCases, mode };
}

module.exports = { run };
