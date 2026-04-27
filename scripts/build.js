#!/usr/bin/env node
/**
 * Emerald Lead Co. — Site Template Build Script
 *
 * Reads config/market.json, walks /src, expands <!-- @include partials/X.html -->
 * directives, replaces every {{dotted.path}} placeholder with the corresponding
 * config value, and writes the result to /dist.
 *
 * Special handling:
 *  - src/partials/         — included via @include, never emitted directly
 *  - src/schema/           — consumed at build time, never emitted directly
 *  - files starting with _ — build-time templates (e.g. _post-template.html),
 *                            never emitted directly
 *  - src/pages/blog/_post-template.html
 *                          — duplicated once per config.blog.posts[i] entry,
 *                            output as dist/blog/<post.slug>.html
 *  - dist/sitemap.xml      — generated programmatically from config (incl. blog)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_CONFIG_PATH = path.join(ROOT, 'config', 'market.json');
const SRC_DIR = path.join(ROOT, 'src');
const PARTIALS_DIR = path.join(SRC_DIR, 'partials');
const DIST_DIR = path.join(ROOT, 'dist');
const ROBOTS_TXT = path.join(ROOT, 'robots.txt');

const TEXT_EXTENSIONS = new Set([
  '.html', '.htm', '.css', '.js', '.mjs', '.cjs',
  '.xml', '.json', '.txt', '.md', '.svg', '.webmanifest',
]);

// src/ subdirectories that are not deployed — consumed at build time only.
const SRC_EXCLUDE_TOP = new Set(['schema', 'partials']);

// Files under src/pages/ are routed at the dist root. Other src/ subdirs keep
// their relative path. So src/pages/index.html → dist/index.html, but
// src/css/style.css → dist/css/style.css.
const SRC_FLATTEN_PREFIX = 'pages';

const BLOG_POST_TEMPLATE = path.join(SRC_DIR, 'pages', 'blog', '_post-template.html');

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
const INCLUDE_RE = /<!--\s*@include\s+([^\s>]+)\s*-->/g;
const MAX_EXPANSION_PASSES = 5;
const MAX_INCLUDE_DEPTH = 5;

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

function validateConfig(config, configPath) {
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
    const rel = path.relative(ROOT, configPath);
    fail([
      `${rel} has ${problems.length} unpopulated field(s):`,
      ...problems.map((p) => `  - ${p}`),
      '',
      'Replace every placeholder value with a real one and run the build again.',
    ]);
  }
}

// ---------- includes ----------

function expandIncludes(text, source, depth) {
  if (!INCLUDE_RE.test(text)) return text;
  if (depth >= MAX_INCLUDE_DEPTH) {
    fail([`Include depth in ${source} exceeded ${MAX_INCLUDE_DEPTH} levels (cycle?).`]);
  }
  return text.replace(INCLUDE_RE, (match, partialPath) => {
    const abs = path.join(PARTIALS_DIR, partialPath);
    if (!abs.startsWith(PARTIALS_DIR + path.sep)) {
      fail([`${source}: include path "${partialPath}" escapes src/partials/.`]);
    }
    if (!fs.existsSync(abs)) {
      fail([`${source}: include not found: src/partials/${partialPath}`]);
    }
    const inner = fs.readFileSync(abs, 'utf8');
    return expandIncludes(inner, `partials/${partialPath}`, depth + 1);
  });
}

// ---------- placeholder resolve ----------

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

function replacePlaceholders(text, context, source) {
  let out = text;
  let pass = 0;
  while (PLACEHOLDER_RE.test(out)) {
    if (pass >= MAX_EXPANSION_PASSES) {
      fail([`Placeholder expansion in ${source} exceeded ${MAX_EXPANSION_PASSES} passes (cycle?).`]);
    }
    out = out.replace(PLACEHOLDER_RE, (match, dotted) => {
      const value = getByPath(context, dotted);
      if (value === undefined) {
        fail([`${source}: unknown placeholder {{${dotted}}} — no such path in config.`]);
      }
      return stringifyValue(value);
    });
    pass += 1;
  }
  return out;
}

function processText(text, context, source) {
  return replacePlaceholders(expandIncludes(text, source, 0), context, source);
}

function pathsFor(outRel) {
  const depth = outRel.split(path.sep).length - 1;
  return { root: depth === 0 ? './' : '../'.repeat(depth) };
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
      if (entry.name.startsWith('_')) continue;
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
        const ctx = Object.assign({}, config, { paths: pathsFor(outRel) });
        fs.writeFileSync(out, processText(text, ctx, rel));
      } else {
        fs.copyFileSync(abs, out);
      }
      fileCount += 1;
    }
  }
  return fileCount;
}

function generateBlogPosts(config) {
  if (!fs.existsSync(BLOG_POST_TEMPLATE)) return 0;
  if (!config.blog || !Array.isArray(config.blog.posts)) return 0;
  const tmplRaw = fs.readFileSync(BLOG_POST_TEMPLATE, 'utf8');
  const tmplExpanded = expandIncludes(tmplRaw, 'blog/_post-template.html', 0);
  const outDir = path.join(DIST_DIR, 'blog');
  fs.mkdirSync(outDir, { recursive: true });
  let count = 0;
  config.blog.posts.forEach((post, index) => {
    if (!post.slug) {
      fail([`config.blog.posts[${index}] is missing "slug".`]);
    }
    const prev = config.blog.posts[index - 1];
    const next = config.blog.posts[index + 1];
    const prevLink = prev
      ? { href: `${prev.slug}.html`, label: `← ${prev.title}` }
      : { href: './', label: '← All guides' };
    const nextLink = next
      ? { href: `${next.slug}.html`, label: `Next guide: ${next.title}` }
      : { href: './', label: 'Browse all guides' };
    const context = Object.assign({}, config, {
      paths: { root: '../' },
      post: Object.assign({}, post, { index, prevLink, nextLink }),
    });
    const out = replacePlaceholders(tmplExpanded, context, `blog/${post.slug}.html`);
    fs.writeFileSync(path.join(outDir, `${post.slug}.html`), out);
    count += 1;
  });
  return count;
}

function generateSitemap(config) {
  const domain = `https://${config.brand.consumerDomain}`;
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${domain}/`, freq: 'weekly', priority: '1.0' },
    { loc: `${domain}/privacy.html`, freq: 'yearly', priority: '0.2' },
    { loc: `${domain}/terms.html`, freq: 'yearly', priority: '0.2' },
    { loc: `${domain}/blog/`, freq: 'weekly', priority: '0.7' },
  ];
  if (config.blog && Array.isArray(config.blog.posts)) {
    for (const post of config.blog.posts) {
      urls.push({
        loc: `${domain}/blog/${post.slug}.html`,
        freq: 'monthly',
        priority: '0.6',
        lastmod: post.date || today,
      });
    }
  }
  const body = urls.map((u) => {
    const lastmod = u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : '';
    return `  <url>\n    <loc>${u.loc}</loc>${lastmod}\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`;
  }).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), xml);
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
  validateConfig(config, args.configPath);
  emptyDir(DIST_DIR);
  const fileCount = walkSrc(config);
  const postCount = generateBlogPosts(config);
  generateSitemap(config);
  copyRobots();
  console.log(`[build] wrote ${fileCount} page(s) + ${postCount} blog post(s) to dist/ (config: ${path.relative(ROOT, args.configPath)})`);
  printChecklist(config);
}

main();
