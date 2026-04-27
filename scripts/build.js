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
const DEFAULT_CONFIG_PATH = path.join(ROOT, 'config', 'market.json');
const SRC_DIR = path.join(ROOT, 'src');
const DIST_DIR = path.join(ROOT, 'dist');
const SITEMAP_TEMPLATE = path.join(ROOT, 'sitemap-template.xml');
const ROBOTS_TXT = path.join(ROOT, 'robots.txt');

const TEXT_EXTENSIONS = new Set([
  '.html', '.htm', '.css', '.js', '.mjs', '.cjs',
  '.xml', '.json', '.txt', '.md', '.svg', '.webmanifest',
]);

// src/ subdirectories that are not deployed (consumed at build time only).
const SRC_EXCLUDE_TOP = new Set(['schema']);

// Files under src/pages/ are routed at the dist root. Other src/ subdirs keep
// their relative path. So src/pages/index.html → dist/index.html, but
// src/css/style.css → dist/css/style.css.
const SRC_FLATTEN_PREFIX = 'pages';

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

// ---------- args & load ----------

function parseArgs(argv) {
  const args = { configPath: DEFAULT_CONFIG_PATH };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--config' || a === '-c') {
      args.configPath = path.resolve(ROOT, argv[i + 1] || '');
      i += 1;
    } else if (a.startsWith('--config=')) {
      args.configPath = path.resolve(ROOT, a.slice('--config='.length));
    } else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/build.js [--config <path>]');
      console.log('  Defaults to config/market.json. Pass --config config/market.demo.json for previews.');
      process.exit(0);
    } else {
      fail([`Unknown argument: ${a}`, 'Run with --help for usage.']);
    }
  }
  return args;
}

function loadConfig(configPath) {
  const rel = path.relative(ROOT, configPath);
  if (!fs.existsSync(configPath)) {
    fail([
      `${rel} not found.`,
      'Run: cp config/market.example.json config/market.json',
      'Then fill in the market-specific values before building.',
    ]);
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    fail([`${rel} is not valid JSON: ${err.message}`]);
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

function distPathFor(rel) {
  const parts = rel.split(path.sep);
  if (parts[0] === SRC_FLATTEN_PREFIX) return parts.slice(1).join(path.sep);
  return rel;
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
      const rel = path.relative(SRC_DIR, abs);
      const topDir = rel.split(path.sep)[0];
      if (SRC_EXCLUDE_TOP.has(topDir)) continue;
      if (entry.isDirectory()) {
        stack.push(abs);
        continue;
      }
      const outRel = distPathFor(rel);
      if (!outRel) continue;
      const out = path.join(DIST_DIR, outRel);
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
  const args = parseArgs(process.argv);
  const config = loadConfig(args.configPath);
  validateConfig(config);
  emptyDir(DIST_DIR);
  const fileCount = walkSrc(config);
  generateSitemap(config);
  copyRobots();
  console.log(`[build] wrote ${fileCount} template file(s) to dist/ (config: ${path.relative(ROOT, args.configPath)})`);
  printChecklist(config);
}

main();
