#!/usr/bin/env node
/**
 * Emerald Lead Co. — Site Template Build Script
 *
 * Reads config/market.json, walks /src, replaces every {{dotted.path}}
 * placeholder with the corresponding config value, and writes the result
 * to /dist.
 *
 * Placeholder syntax: {{market.city}}, {{trade.name}}, {{brand.phone}}, etc.
 * All paths resolve against the config object using dotted access.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'market.json');
const EXAMPLE_PATH = path.join(ROOT, 'config', 'market.example.json');
const SRC_DIR = path.join(ROOT, 'src');
const DIST_DIR = path.join(ROOT, 'dist');
const SITEMAP_TEMPLATE = path.join(ROOT, 'sitemap-template.xml');
const ROBOTS_TXT = path.join(ROOT, 'robots.txt');

const TEXT_EXTENSIONS = new Set([
  '.html', '.htm', '.css', '.js', '.mjs', '.cjs',
  '.xml', '.json', '.txt', '.md', '.svg', '.webmanifest',
]);

// Values shipped in market.example.json that must be replaced before a build is valid.
const SENTINEL_VALUES = new Set([
  'ATTOM_KEY_HERE',
  'MELISSA_KEY_HERE',
  'G-XXXXXXXXXX',
  'your-verification-content',
  'your_public_key',
  'service_xxxxxxx',
  'template_buyer',
  'template_confirm',
  '541-000-0000',
]);

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
const MAX_EXPANSION_PASSES = 5;

// ---------- load ----------

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    fail([
      'config/market.json not found.',
      'Run: cp config/market.example.json config/market.json',
      'Then fill in the market-specific values before building.',
    ]);
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (err) {
    fail([`config/market.json is not valid JSON: ${err.message}`]);
  }
}

// ---------- validate ----------

function walkLeaves(node, pathParts, visit) {
  if (node === null || node === undefined) {
    visit(pathParts.join('.'), node);
    return;
  }
  if (Array.isArray(node)) {
    if (node.length === 0) visit(pathParts.join('.'), node);
    node.forEach((item, i) => walkLeaves(item, [...pathParts, String(i)], visit));
    return;
  }
  if (typeof node === 'object') {
    const keys = Object.keys(node);
    if (keys.length === 0) visit(pathParts.join('.'), node);
    for (const k of keys) walkLeaves(node[k], [...pathParts, k], visit);
    return;
  }
  visit(pathParts.join('.'), node);
}

function validateConfig(config) {
  const problems = [];
  walkLeaves(config, [], (dotted, value) => {
    if (value === null || value === undefined) {
      problems.push(`${dotted}: value is null/undefined`);
      return;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') {
        problems.push(`${dotted}: empty string`);
      } else if (SENTINEL_VALUES.has(trimmed)) {
        problems.push(`${dotted}: still set to example value "${trimmed}"`);
      }
    }
  });
  if (problems.length > 0) {
    fail([
      `config/market.json has ${problems.length} unpopulated field(s):`,
      ...problems.map((p) => `  - ${p}`),
      '',
      'Replace every placeholder value with a real one and run the build again.',
    ]);
  }
}

// ---------- resolve ----------

function getByPath(obj, dotted) {
  const parts = dotted.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[p];
  }
  return cur;
}

function stringifyValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (value === null || value === undefined) return '';
  return String(value);
}

function replacePlaceholders(text, config, source) {
  let out = text;
  let pass = 0;
  while (PLACEHOLDER_RE.test(out)) {
    if (pass >= MAX_EXPANSION_PASSES) {
      fail([`Placeholder expansion in ${source} exceeded ${MAX_EXPANSION_PASSES} passes (cycle?).`]);
    }
    out = out.replace(PLACEHOLDER_RE, (match, dotted) => {
      const value = getByPath(config, dotted);
      if (value === undefined) {
        fail([`${source}: unknown placeholder {{${dotted}}} — no such path in config.`]);
      }
      return stringifyValue(value);
    });
    pass += 1;
  }
  return out;
}

// ---------- build ----------

function emptyDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function walkSrc(config) {
  if (!fs.existsSync(SRC_DIR)) {
    console.log('[build] /src does not exist yet — skipping template walk.');
    return 0;
  }
  let fileCount = 0;
  const stack = [SRC_DIR];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
        continue;
      }
      const rel = path.relative(SRC_DIR, abs);
      const out = path.join(DIST_DIR, rel);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      const ext = path.extname(entry.name).toLowerCase();
      if (TEXT_EXTENSIONS.has(ext)) {
        const text = fs.readFileSync(abs, 'utf8');
        fs.writeFileSync(out, replacePlaceholders(text, config, rel));
      } else {
        fs.copyFileSync(abs, out);
      }
      fileCount += 1;
    }
  }
  return fileCount;
}

function generateSitemap(config) {
  if (!fs.existsSync(SITEMAP_TEMPLATE)) return;
  const text = fs.readFileSync(SITEMAP_TEMPLATE, 'utf8');
  fs.writeFileSync(
    path.join(DIST_DIR, 'sitemap.xml'),
    replacePlaceholders(text, config, 'sitemap-template.xml'),
  );
}

function copyRobots() {
  if (!fs.existsSync(ROBOTS_TXT)) return;
  fs.copyFileSync(ROBOTS_TXT, path.join(DIST_DIR, 'robots.txt'));
}

// ---------- checklist ----------

function printChecklist(config) {
  const city = config.market.city;
  const trade = config.trade.nameDisplay;
  const domain = config.brand.consumerDomain;
  const repoHint = `${config.market.citySlug}-${config.trade.name}`;
  const lines = [
    '',
    '============================================================',
    `  Build complete — ${city} ${trade} (${domain})`,
    '============================================================',
    '',
    'Pre-Deployment checklist:',
    '  [ ] Open dist/index.html in a browser — visual check',
    '  [ ] Submit a test lead locally — verify temperature score',
    '  [ ] Purchase domain for ' + domain,
    '  [ ] Acquire tracking phone number (area code ' + config.market.areaCode + ')',
    '',
    'Netlify setup:',
    `  [ ] Create GitHub repo: ${repoHint}`,
    '  [ ] Push dist/ contents to the new repo',
    '  [ ] Netlify → Import from Git → connect repo',
    `  [ ] Add custom domain: ${domain}`,
    '  [ ] Update nameservers at registrar',
    '  [ ] Enable Netlify Forms',
    '  [ ] Set env vars: ATTOM_API_KEY, CLAUDE_API_KEY, EMAILJS_SERVICE_ID, EMAILJS_PRIVATE_KEY',
    '  [ ] Verify enrich-lead function deployed',
    '',
    'Verification:',
    '  [ ] Submit test lead via live form',
    '  [ ] Confirm temperature score, confirmation page, dashboard entry',
    '  [ ] Confirm buyer + homeowner emails arrive',
    '  [ ] Confirm enrichment data present in buyer email',
    '',
    'Full checklist: README.md §"Deployment Checklist".',
    '',
  ];
  console.log(lines.join('\n'));
}

// ---------- utility ----------

function fail(lines) {
  console.error('\n[build] FAILED');
  for (const line of lines) console.error(line);
  console.error('');
  process.exit(1);
}

// ---------- main ----------

function main() {
  const config = loadConfig();
  validateConfig(config);
  emptyDir(DIST_DIR);
  const fileCount = walkSrc(config);
  generateSitemap(config);
  copyRobots();
  console.log(`[build] wrote ${fileCount} template file(s) to dist/`);
  printChecklist(config);
}

main();
