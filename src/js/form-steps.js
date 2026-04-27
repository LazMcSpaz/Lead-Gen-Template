/**
 * Multi-step lead form controller.
 *
 * Progressive enhancement: with JS off, the form renders all steps stacked
 * and submits as a normal single-page form. With JS on, only one step is
 * visible at a time, gated by per-step validation.
 *
 * Scoring (Session 4) and submission/enrichment (Session 5) live elsewhere
 * — this file is navigation only.
 */
(function () {
  const form = document.querySelector('.lead-form');
  if (!form) return;
  const steps = Array.from(form.querySelectorAll('.form-step'));
  if (steps.length <= 1) return;

  form.classList.add('is-stepped');
  let currentIndex = 0;

  const segments = Array.from(form.querySelectorAll('.form-progress__segment'));
  const currentLabel = form.querySelector('.form-progress__current');
  const totalLabel = form.querySelector('.form-progress__total');
  if (totalLabel) totalLabel.textContent = String(steps.length);

  steps.forEach((step, i) => {
    if (i === 0) step.classList.add('is-active');
  });
  updateProgress();

  form.addEventListener('click', function (e) {
    const next = e.target.closest('[data-form-next]');
    const back = e.target.closest('[data-form-back]');
    if (next) {
      e.preventDefault();
      goNext();
    } else if (back) {
      e.preventDefault();
      goBack();
    }
  });

  // Keyboard: Enter on any input in a non-final step advances rather than submits.
  form.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    const target = e.target;
    if (target && target.tagName === 'TEXTAREA') return;
    if (currentIndex < steps.length - 1) {
      e.preventDefault();
      goNext();
    }
  });

  // "Something else" service reveals a free-text input.
  form.addEventListener('change', function (e) {
    const t = e.target;
    if (t && t.name === 'service') {
      const otherInput = form.querySelector('.form-other-input');
      if (otherInput) {
        const isOther = t.value === 'Something else';
        otherInput.classList.toggle('is-visible', isOther);
        const input = otherInput.querySelector('input, textarea');
        if (input) input.required = isOther;
      }
    }
  });

  function goNext() {
    if (!validateStep(currentIndex)) return;
    if (currentIndex >= steps.length - 1) return;
    setStep(currentIndex + 1);
  }

  function goBack() {
    if (currentIndex === 0) return;
    setStep(currentIndex - 1);
  }

  function setStep(next) {
    steps[currentIndex].classList.remove('is-active');
    currentIndex = next;
    steps[currentIndex].classList.add('is-active');
    updateProgress();
    const top = form.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: top, behavior: 'smooth' });
    const focusable = steps[currentIndex].querySelector('input:not([type=hidden]), select, textarea, button');
    if (focusable) focusable.focus({ preventScroll: true });
  }

  function validateStep(index) {
    const step = steps[index];
    const inputs = step.querySelectorAll('input, select, textarea');
    for (let i = 0; i < inputs.length; i += 1) {
      const el = inputs[i];
      if (el.disabled || el.type === 'hidden') continue;
      if (!el.checkValidity()) {
        el.reportValidity();
        return false;
      }
    }
    return true;
  }

  function updateProgress() {
    segments.forEach(function (seg, i) {
      seg.classList.toggle('is-complete', i < currentIndex);
      seg.classList.toggle('is-active', i === currentIndex);
    });
    if (currentLabel) currentLabel.textContent = String(currentIndex + 1);
  }
})();
