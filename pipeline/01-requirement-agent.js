// Requirement Analyzer agent.
// Connects to the target URL with a headless browser, extracts the REAL page
// structure (title, forms, inputs, buttons, links, landmarks), writes a
// knowledge-context markdown, and derives grounded user stories from it.
//
// Honesty note: without an LLM, user stories are derived heuristically from the
// crawled elements. Every story cites the on-page evidence it came from.
const path = require('path');
const { writeFile, writeJson, log, pwChromium } = require('./lib');

async function crawl(url) {
  const chromium = pwChromium();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const ctx = { url, ok: false };
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    ctx.status = resp ? resp.status() : null;
    ctx.title = await page.title();
    ctx.finalUrl = page.url();

    ctx.structure = await page.evaluate(() => {
      const txt = (el) => (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
      const attr = (el, a) => el.getAttribute(a) || '';
      const forms = Array.from(document.querySelectorAll('form')).slice(0, 10).map((f) => ({
        name: attr(f, 'name') || attr(f, 'id') || '(unnamed)',
        action: attr(f, 'action'),
        inputs: Array.from(f.querySelectorAll('input,select,textarea')).slice(0, 20).map((i) => ({
          type: i.getAttribute('type') || i.tagName.toLowerCase(),
          name: i.getAttribute('name') || i.getAttribute('id') || '',
          placeholder: i.getAttribute('placeholder') || '',
          required: i.hasAttribute('required'),
          label: i.getAttribute('aria-label') || '',
        })),
      }));
      const buttons = Array.from(document.querySelectorAll('button,[role="button"],input[type="submit"]'))
        .map((b) => txt(b) || b.getAttribute('aria-label') || '')
        .filter(Boolean)
        .slice(0, 25);
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map((a) => ({ text: txt(a), href: a.getAttribute('href') }))
        .filter((l) => l.text)
        .slice(0, 30);
      const inputs = Array.from(document.querySelectorAll('input,select,textarea')).slice(0, 30).map((i) => ({
        type: i.getAttribute('type') || i.tagName.toLowerCase(),
        name: i.getAttribute('name') || i.getAttribute('id') || '',
        placeholder: i.getAttribute('placeholder') || '',
        required: i.hasAttribute('required'),
      }));
      const headings = Array.from(document.querySelectorAll('h1,h2')).map(txt).filter(Boolean).slice(0, 15);
      const landmarks = Array.from(document.querySelectorAll('nav,header,footer,main,[role]'))
        .map((el) => el.getAttribute('role') || el.tagName.toLowerCase())
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .slice(0, 15);
      return { forms, buttons, links, inputs, headings, landmarks };
    });
    ctx.ok = true;
  } catch (e) {
    ctx.error = String(e.message || e).split('\n')[0];
  } finally {
    await browser.close();
  }
  return ctx;
}

function deriveStories(ctx) {
  const stories = [];
  let n = 1;
  const add = (title, role, want, so, evidence, priority = 'P1') =>
    stories.push({ id: `US-${String(n++).padStart(3, '0')}`, title, role, want, so, priority, evidence });

  const s = ctx.structure || {};
  // Page-load story (always grounded — the page responded)
  add(
    `Load the ${ctx.title || 'target'} page`,
    'visitor', 'open the application and see it load successfully',
    'I can begin my task',
    `HTTP ${ctx.status} · title "${ctx.title}"`, 'P1'
  );

  // Forms -> submission + validation stories
  (s.forms || []).forEach((f) => {
    const required = f.inputs.filter((i) => i.required);
    add(
      `Submit the ${f.name} form`,
      'user', `fill in ${f.inputs.length} field(s) and submit "${f.name}"`,
      'the form is accepted and I proceed',
      `<form ${f.name}> with fields: ${f.inputs.map((i) => i.name || i.type).join(', ')}`, 'P1'
    );
    if (required.length) {
      add(
        `Validate required fields on ${f.name}`,
        'user', `be prevented from submitting "${f.name}" with empty required fields`,
        'I get clear validation feedback',
        `required: ${required.map((i) => i.name || i.type).join(', ')}`, 'P2'
      );
    }
  });

  // Search-like inputs
  (s.inputs || []).filter((i) => /search|query|q/i.test(i.name + i.placeholder)).slice(0, 2).forEach((i) => {
    add(
      `Search using the "${i.name || i.placeholder}" field`,
      'visitor', 'enter a search term and see relevant results',
      'I can find what I need',
      `input[name=${i.name}] placeholder="${i.placeholder}"`, 'P1'
    );
  });

  // Primary navigation
  (s.links || []).slice(0, 3).forEach((l) => {
    add(
      `Navigate via "${l.text}"`,
      'visitor', `click "${l.text}" and reach the correct page`,
      'navigation works as expected',
      `<a href="${l.href}">${l.text}</a>`, 'P3'
    );
  });

  return stories;
}

function toMarkdown(ctx, stories) {
  const s = ctx.structure || {};
  const list = (arr) => (arr && arr.length ? arr.map((x) => `- ${x}`).join('\n') : '- (none found)');
  return `# Knowledge Context — ${ctx.title || ctx.url}

> Generated by the Requirement Analyzer agent by connecting to the target and
> extracting its live structure. This grounds every downstream story and test.

## Target
- **URL:** ${ctx.url}
- **Final URL:** ${ctx.finalUrl || ctx.url}
- **HTTP status:** ${ctx.status ?? 'n/a'}
- **Reachable:** ${ctx.ok ? 'yes' : 'no' + (ctx.error ? ` (${ctx.error})` : '')}

## Page landmarks
${list(s.landmarks)}

## Headings
${list(s.headings)}

## Forms
${(s.forms || []).map((f) => `### form: ${f.name}\n- action: ${f.action || '(none)'}\n${f.inputs.map((i) => `  - ${i.type} \`${i.name}\`${i.required ? ' (required)' : ''}${i.placeholder ? ` — "${i.placeholder}"` : ''}`).join('\n') || '  - (no fields)'}`).join('\n\n') || '- (no forms found)'}

## Interactive controls
**Buttons:**
${list(s.buttons)}

**Key links:**
${(s.links || []).slice(0, 15).map((l) => `- [${l.text}](${l.href})`).join('\n') || '- (none)'}

## Derived user stories (${stories.length})
${stories.map((u) => `### ${u.id} · ${u.title} (${u.priority})\nAs a **${u.role}**, I want to ${u.want}, so that ${u.so}.\n_Evidence:_ ${u.evidence}`).join('\n\n')}

---
_Stories are derived heuristically from crawled page structure. Where an LLM key is
connected, this step can produce richer, intent-level stories._
`;
}

async function run(url, runDir) {
  log('requirement-analyzer', `connecting to ${url}…`);
  const ctx = await crawl(url);
  log('requirement-analyzer', ctx.ok ? `crawled OK (HTTP ${ctx.status})` : `crawl failed: ${ctx.error}`);

  const stories = deriveStories(ctx);
  const mdPath = writeFile(path.join(runDir, 'requirements', 'knowledge-context.md'), toMarkdown(ctx, stories));
  const storiesPath = writeJson(path.join(runDir, 'requirements', 'user-stories.json'), { url, generatedAt: new Date().toISOString(), stories });
  writeJson(path.join(runDir, 'requirements', 'crawl-context.json'), ctx);

  log('requirement-analyzer', `wrote ${stories.length} user stories + knowledge-context.md`);
  return { ok: true, storiesCount: stories.length, stories, mdPath, storiesPath, reachable: ctx.ok };
}

module.exports = { run };
