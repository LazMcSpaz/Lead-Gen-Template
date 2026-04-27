#!/usr/bin/env node
/**
 * Verifies form-scoring.js against the table in README.md
 * §"Lead Temperature Scoring". Run: node scripts/test-form-scoring.js
 *
 * Exits 0 on success, 1 on any mismatch.
 */
const path = require('path');
const scoring = require(path.join(__dirname, '..', 'src', 'js', 'form-scoring.js'));

const cases = [
  // {name, answers, expected: {total, temperature}}
  {
    name: 'all-cool: info page, just researching, flexible, renter, shopping broadly',
    answers: { source: 'info', urgency: 'info', timeline: 'unsure', ownership: 'renter', competition: 'broad' },
    expected: { total: 0, temperature: 'Cool' },
  },
  {
    name: 'all-hot from service page',
    answers: { source: 'service', urgency: 'emergency', timeline: '48h', ownership: 'owner', competition: 'first' },
    expected: { total: 10, temperature: 'Hot' },
  },
  {
    name: 'phone source pegs source +3',
    answers: { source: 'phone', urgency: 'emergency', timeline: '48h', ownership: 'owner', competition: 'first' },
    expected: { total: 11, temperature: 'Hot' }, // phone source rarely combined with form, but should still classify
  },
  {
    name: 'mixed warm — homepage form, scheduled / week / manager / few',
    answers: { source: 'homepage', urgency: 'scheduled', timeline: 'week', ownership: 'manager', competition: 'few' },
    expected: { total: 5, temperature: 'Warm' },
  },
  {
    name: 'service-page prefix matched (service-panel-upgrade → 2)',
    answers: { source: 'service-panel-upgrade', urgency: 'scheduled', timeline: 'week', ownership: 'owner', competition: 'first' },
    expected: { total: 2 + 1 + 1 + 2 + 2, temperature: 'Hot' },
  },
  {
    name: 'blog-post prefix matched (blog-panel-upgrade-cost → 1)',
    answers: { source: 'blog-panel-upgrade-cost', urgency: 'scheduled', timeline: 'week', ownership: 'owner', competition: 'first' },
    expected: { total: 1 + 1 + 1 + 2 + 2, temperature: 'Hot' },
  },
  {
    name: 'boundary 7: just over warm/hot threshold',
    // blog (1) + emergency (2) + 48h (2) + manager (1) + first (2) = 8 → Hot
    answers: { source: 'blog', urgency: 'emergency', timeline: '48h', ownership: 'manager', competition: 'first' },
    expected: { total: 8, temperature: 'Hot' },
  },
  {
    name: 'boundary 6: top of warm',
    // homepage (1) + scheduled (1) + week (1) + manager (1) + first (2) = 6 → Warm
    answers: { source: 'homepage', urgency: 'scheduled', timeline: 'week', ownership: 'manager', competition: 'first' },
    expected: { total: 6, temperature: 'Warm' },
  },
  {
    name: 'boundary 4: bottom of warm',
    // homepage (1) + quote (0) + week (1) + manager (1) + few (1) = 4 → Warm
    answers: { source: 'homepage', urgency: 'quote', timeline: 'week', ownership: 'manager', competition: 'few' },
    expected: { total: 4, temperature: 'Warm' },
  },
  {
    name: 'boundary 3: top of cool',
    // info (0) + quote (0) + week (1) + manager (1) + few (1) = 3 → Cool
    answers: { source: 'info', urgency: 'quote', timeline: 'week', ownership: 'manager', competition: 'few' },
    expected: { total: 3, temperature: 'Cool' },
  },
  {
    name: 'unknown source defaults to 0',
    answers: { source: 'something-weird', urgency: 'emergency', timeline: '48h', ownership: 'owner', competition: 'first' },
    expected: { total: 0 + 2 + 2 + 2 + 2, temperature: 'Hot' },
  },
  {
    name: 'unknown qualifier value defaults to 0',
    answers: { source: 'service', urgency: 'wat', timeline: '48h', ownership: 'owner', competition: 'first' },
    expected: { total: 2 + 0 + 2 + 2 + 2, temperature: 'Hot' },
  },
  {
    name: 'missing answers default to 0',
    answers: { source: 'homepage' },
    expected: { total: 1, temperature: 'Cool' },
  },
  {
    name: 'empty answers',
    answers: {},
    expected: { total: 0, temperature: 'Cool' },
  },
];

let failed = 0;
console.log('Running form-scoring tests...\n');
for (const c of cases) {
  const result = scoring.scoreFromAnswers(c.answers);
  const ok = result.total === c.expected.total && result.temperature === c.expected.temperature;
  const status = ok ? '✓' : '✗';
  console.log(`  ${status} ${c.name}`);
  if (!ok) {
    failed += 1;
    console.log(`      expected: total=${c.expected.total} temp=${c.expected.temperature}`);
    console.log(`      got:      total=${result.total} temp=${result.temperature}`);
    console.log(`      breakdown: ${JSON.stringify(result.breakdown)}`);
  }
}

console.log('');
if (failed > 0) {
  console.error(`${failed} of ${cases.length} test(s) failed.`);
  process.exit(1);
}
console.log(`All ${cases.length} tests passed.`);
