/**
 * Lead temperature scoring.
 *
 * Implements the rules in README.md §"Lead Temperature Scoring":
 *   Source signal    +0..+3
 *   Urgency          +0..+2
 *   Timeline         +0..+2
 *   Ownership        +0..+2
 *   Competition      +0..+2  (Have you reached out to others?)
 *
 *   Total 0–3   → Cool   (Research Lead — Early Stage)
 *   Total 4–6   → Warm   (Standard Lead — Active Shopper)
 *   Total 7–10  → Hot    (Priority Lead — High Intent)
 *
 * The same logic runs in two places:
 *   - the browser, attached to .lead-form to keep the hidden lead-* fields
 *     in sync as the user makes choices
 *   - scripts/test-form-scoring.js (Node), to verify the table above
 *     hasn't drifted from the README
 *
 * The pure scoreFromAnswers() is the contract; everything else is glue.
 */
(function (root) {
  'use strict';

  // Source-page prefix → points. The source-page hidden field is set per
  // page; service pages produce service-<slug>, blog posts produce
  // blog-<slug>, etc. We match by exact key or "<key>-..." prefix so the
  // map stays small.
  var SOURCE_POINTS = {
    phone: 3,        // tracked phone calls (logged separately, not via form)
    service: 2,      // service-specific landing page form
    homepage: 1,
    blog: 1,
    location: 1,
    info: 0,
    faq: 0,
  };

  var QUALIFIER_POINTS = {
    urgency: { emergency: 2, scheduled: 1, quote: 0, info: 0 },
    timeline: { '48h': 2, week: 1, month: 0, unsure: 0 },
    ownership: { owner: 2, manager: 1, renter: 0 },
    competition: { first: 2, few: 1, broad: 0 },
  };

  var QUALIFIER_NAMES = ['urgency', 'timeline', 'ownership', 'competition'];

  function sourcePoints(source) {
    if (!source) return 0;
    var keys = Object.keys(SOURCE_POINTS);
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (source === key || source.indexOf(key + '-') === 0) {
        return SOURCE_POINTS[key];
      }
    }
    return 0;
  }

  function qualifierPoints(name, value) {
    var map = QUALIFIER_POINTS[name];
    if (!map || value == null) return 0;
    var pts = map[value];
    return typeof pts === 'number' ? pts : 0;
  }

  function classify(total) {
    if (total >= 7) return { temperature: 'Hot', label: 'Priority Lead — High Intent', emoji: '🔥' };
    if (total >= 4) return { temperature: 'Warm', label: 'Standard Lead — Active Shopper', emoji: '🌡️' };
    return { temperature: 'Cool', label: 'Research Lead — Early Stage', emoji: '🧊' };
  }

  /**
   * Pure scoring from a flat answers object.
   * @param {{source?: string, urgency?: string, timeline?: string, ownership?: string, competition?: string}} answers
   * @returns {{total: number, temperature: 'Hot'|'Warm'|'Cool', label: string, emoji: string, breakdown: Record<string, number>}}
   */
  function scoreFromAnswers(answers) {
    answers = answers || {};
    var breakdown = { source: sourcePoints(answers.source) };
    QUALIFIER_NAMES.forEach(function (name) {
      breakdown[name] = qualifierPoints(name, answers[name]);
    });
    var total = 0;
    Object.keys(breakdown).forEach(function (k) { total += breakdown[k]; });
    var c = classify(total);
    return { total: total, temperature: c.temperature, label: c.label, emoji: c.emoji, breakdown: breakdown };
  }

  function readForm(form) {
    var sourceEl = form.querySelector('input[name="source-page"]');
    var answers = { source: sourceEl ? sourceEl.value : '' };
    QUALIFIER_NAMES.forEach(function (name) {
      var checked = form.querySelector('input[name="' + name + '"]:checked');
      if (checked) answers[name] = checked.value;
    });
    return answers;
  }

  function writeFields(form, result) {
    var fields = {
      'lead-temperature': result.temperature,
      'lead-score': String(result.total),
      'lead-label': result.emoji + ' ' + result.label,
    };
    Object.keys(fields).forEach(function (name) {
      var el = form.querySelector('input[name="' + name + '"]');
      if (el) el.value = fields[name];
    });
  }

  function updateFromForm(form) {
    var result = scoreFromAnswers(readForm(form));
    writeFields(form, result);
    return result;
  }

  function init() {
    var form = document.querySelector('.lead-form');
    if (!form) return;
    form.addEventListener('change', function () { updateFromForm(form); });
    updateFromForm(form);
  }

  // Browser auto-init + global for debugging.
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
    if (root) {
      root.LeadScoring = {
        scoreFromAnswers: scoreFromAnswers,
        classify: classify,
        readForm: readForm,
        updateFromForm: updateFromForm,
        SOURCE_POINTS: SOURCE_POINTS,
        QUALIFIER_POINTS: QUALIFIER_POINTS,
      };
    }
  }

  // Node export (for scripts/test-form-scoring.js).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      scoreFromAnswers: scoreFromAnswers,
      classify: classify,
      sourcePoints: sourcePoints,
      qualifierPoints: qualifierPoints,
      SOURCE_POINTS: SOURCE_POINTS,
      QUALIFIER_POINTS: QUALIFIER_POINTS,
    };
  }
})(typeof self !== 'undefined' ? self : null);
