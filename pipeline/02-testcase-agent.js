// Test Case Generator agent.
// Reads user stories and generates positive, negative, edge, and end-to-end
// test cases, plus Gherkin .feature files for the BDD framework.
const path = require('path');
const { readJson, writeJson, writeFile, log, slug } = require('./lib');

function casesForStory(story, idxRef) {
  const cases = [];
  const mk = (type, title, steps, expected) => {
    idxRef.n += 1;
    cases.push({
      id: `TC-${String(idxRef.n).padStart(3, '0')}`,
      story_id: story.id,
      type, // positive | negative | edge | e2e
      priority: story.priority,
      title,
      steps,
      expected,
    });
  };

  const t = story.title;
  // positive
  mk('positive', `Verify ${t.toLowerCase()} succeeds with valid input`,
    [`Given the application is open`, `When the user performs "${t}" with valid data`],
    `The action completes and the expected result is shown`);
  // negative
  mk('negative', `Verify ${t.toLowerCase()} fails gracefully with invalid input`,
    [`Given the application is open`, `When the user performs "${t}" with invalid data`],
    `A clear error is shown and no invalid action is taken`);
  // edge
  mk('edge', `Verify ${t.toLowerCase()} handles boundary/empty input`,
    [`Given the application is open`, `When the user performs "${t}" with empty or boundary input`],
    `The system handles the edge case without crashing`);

  return cases;
}

function e2eCase(stories, idxRef) {
  idxRef.n += 1;
  return {
    id: `TC-${String(idxRef.n).padStart(3, '0')}`,
    story_id: stories.map((s) => s.id).join('+'),
    type: 'e2e',
    priority: 'P1',
    title: 'End-to-end: complete the primary journey across the app',
    steps: stories.map((s, i) => `Step ${i + 1}: ${s.title}`),
    expected: 'The full journey completes with each step producing its expected result',
  };
}

function toFeature(story, cases) {
  const scenarios = cases.map((c) => {
    const tag = `@${c.type} @${c.id} @${c.priority}`;
    const body = c.steps
      .map((s, i) => (i === 0 ? `    ${s}` : `    ${s.startsWith('When') || s.startsWith('Then') || s.startsWith('And') ? s : 'And ' + s}`))
      .join('\n');
    return `  ${tag}\n  Scenario: ${c.title}\n${body}\n    Then the expected outcome is observed`;
  });
  return `Feature: ${story.title}
  # ${story.id} — As a ${story.role}, I want to ${story.want}, so that ${story.so}.

${scenarios.join('\n\n')}
`;
}

function run(runDir) {
  const { stories } = readJson(path.join(runDir, 'requirements', 'user-stories.json'));
  log('test-case-generator', `read ${stories.length} user stories`);

  const idxRef = { n: 0 };
  const allCases = [];
  const featureDir = path.join(runDir, 'bdd', 'features');

  stories.forEach((story) => {
    const cases = casesForStory(story, idxRef);
    allCases.push(...cases);
    writeFile(path.join(featureDir, `${story.id.toLowerCase()}-${slug(story.title)}.feature`), toFeature(story, cases));
  });

  // one end-to-end scenario across all stories
  if (stories.length > 1) {
    const e2e = e2eCase(stories, idxRef);
    allCases.push(e2e);
    writeFile(
      path.join(featureDir, 'e2e-primary-journey.feature'),
      `Feature: End-to-end primary journey\n\n  @e2e @${e2e.id} @P1\n  Scenario: ${e2e.title}\n${e2e.steps.map((s) => `    * ${s}`).join('\n')}\n    Then the full journey completes successfully\n`
    );
  }

  const byType = allCases.reduce((m, c) => ((m[c.type] = (m[c.type] || 0) + 1), m), {});
  writeJson(path.join(runDir, 'testcases', 'test-cases.json'), { generatedAt: new Date().toISOString(), total: allCases.length, byType, cases: allCases });
  log('test-case-generator', `generated ${allCases.length} test cases (${JSON.stringify(byType)}) + ${stories.length + (stories.length > 1 ? 1 : 0)} feature files`);
  return { ok: true, total: allCases.length, byType, cases: allCases };
}

module.exports = { run };
