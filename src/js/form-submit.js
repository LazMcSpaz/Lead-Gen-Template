/**
 * Lead-form submission handler.
 *
 * Flow on submit (with JS):
 *   1. Re-score defensively so the lead-* hidden fields are current
 *      (form-scoring.js already updates on every change; this is a belt-
 *      and-suspenders pass)
 *   2. POST to Netlify Forms at "/" — the source of record. Await this.
 *      If it fails, surface the error and let the user retry.
 *   3. POST to /.netlify/functions/enrich-lead with keepalive:true so the
 *      enrichment kicks off and survives the navigation. We do not await
 *      this — the function runs server-side regardless and the user
 *      shouldn't watch a 3-5s spinner for it.
 *   4. Redirect to thanks.html?score=<n>&temp=<Hot|Warm|Cool> so that
 *      page can personalize the confirmation copy.
 *
 * No-JS fallback:
 *   The form's action="thanks.html" + data-netlify="true" lets Netlify
 *   Forms capture the lead and redirect to thanks.html on a normal POST,
 *   without enrichment. Graceful degradation.
 */
(function () {
  'use strict';

  if (typeof document === 'undefined') return;

  var ENRICH_ENDPOINT = '/.netlify/functions/enrich-lead';
  var NETLIFY_ENDPOINT = '/'; // Netlify Forms accepts POST to the page URL

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function init() {
    var form = document.querySelector('.lead-form');
    if (!form) return;
    form.addEventListener('submit', function (e) { handleSubmit(form, e); });
  }

  function handleSubmit(form, event) {
    event.preventDefault();

    // 1. Re-score so hidden lead-* fields are current.
    if (window.LeadScoring && typeof window.LeadScoring.updateFromForm === 'function') {
      try { window.LeadScoring.updateFromForm(form); } catch (e) { /* non-fatal */ }
    }

    var submitBtn = form.querySelector('button[type="submit"]');
    setSubmittingState(submitBtn, true);
    clearError(form);

    var formData = new FormData(form);

    // 2. Fire enrichment in parallel — keepalive so it survives unload.
    triggerEnrichment(formData);

    // 3. Submit to Netlify Forms (source of record).
    submitToNetlify(formData)
      .then(function () {
        var params = new URLSearchParams();
        var score = formData.get('lead-score');
        var temp = formData.get('lead-temperature');
        if (score) params.set('score', score);
        if (temp) params.set('temp', temp);
        var query = params.toString();
        window.location.assign('thanks.html' + (query ? '?' + query : ''));
      })
      .catch(function (err) {
        console.error('[form-submit] Netlify submission failed:', err);
        setSubmittingState(submitBtn, false);
        showError(form, "We couldn't send your request. Please try again, or call us if it's urgent.");
      });
  }

  function submitToNetlify(formData) {
    var params = new URLSearchParams();
    formData.forEach(function (value, key) {
      params.append(key, typeof value === 'string' ? value : '');
    });
    return fetch(NETLIFY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('Netlify Forms returned ' + response.status);
      }
      return response;
    });
  }

  function triggerEnrichment(formData) {
    var payload = {};
    formData.forEach(function (value, key) {
      // Skip the honeypot and Netlify control fields.
      if (key === 'bot-field' || key === 'form-name') return;
      payload[key] = value;
    });
    try {
      fetch(ENRICH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(function (err) {
        // Best-effort. Buyer email still arrives via Netlify notification.
        console.warn('[form-submit] enrichment fetch failed:', err);
      });
    } catch (err) {
      console.warn('[form-submit] enrichment fetch threw:', err);
    }
  }

  function setSubmittingState(btn, busy) {
    if (!btn) return;
    if (busy) {
      btn.dataset.originalLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Sending…';
      btn.setAttribute('aria-busy', 'true');
    } else {
      if (btn.dataset.originalLabel) btn.textContent = btn.dataset.originalLabel;
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    }
  }

  function showError(form, message) {
    var slot = form.querySelector('[data-form-error]');
    if (!slot) {
      slot = document.createElement('div');
      slot.setAttribute('data-form-error', '');
      slot.className = 'form-error-banner';
      var submitRow = form.querySelector('.form-submit-row');
      if (submitRow) {
        submitRow.parentNode.insertBefore(slot, submitRow);
      } else {
        form.appendChild(slot);
      }
    }
    slot.textContent = message;
    slot.setAttribute('role', 'alert');
  }

  function clearError(form) {
    var slot = form.querySelector('[data-form-error]');
    if (slot) {
      slot.textContent = '';
      slot.removeAttribute('role');
    }
  }

  ready(init);
})();
