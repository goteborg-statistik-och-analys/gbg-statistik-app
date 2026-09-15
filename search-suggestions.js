export function initSearchSuggestions(input, suggestion) {
  const examples = [
    'Folkmängden i Majorna 2010–2025',
    'Vad finns det för tabeller om utbildning?',
    'Vad finns det för statistik om inkomst?',
    'Folkmängden i Göteborg 2010–2025'
  ];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0, timer, transition;
  input.classList.add('has-suggestions');

  function sync() {
    clearTimeout(timer);
    clearTimeout(transition);
    suggestion.classList.remove('is-changing');
    suggestion.hidden = input.value.length > 0;
    if (suggestion.hidden || document.activeElement === input || document.hidden || reducedMotion.matches) return;
    timer = setTimeout(() => {
      suggestion.classList.add('is-changing');
      transition = setTimeout(() => {
        index = (index + 1) % examples.length;
        suggestion.textContent = examples[index];
        sync();
      }, 180);
    }, 5000);
  }

  for (const event of ['input', 'focus', 'blur', 'change']) input.addEventListener(event, sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pageshow', sync);
  reducedMotion.addEventListener('change', sync);
  sync();
  return sync;
}
