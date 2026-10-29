// The Model Room — filtering and small gallery interactions.
(() => {
  const grid = document.getElementById('grid');
  const cards = [...grid.querySelectorAll('.card[data-cat]')];
  const filters = [...document.querySelectorAll('[data-filter]')];
  const empty = document.getElementById('empty');
  const random = document.getElementById('random');

  const countFor = (cat) => cards.filter((c) => cat === 'all' || c.dataset.cat === cat).length;

  // Keep the counts in the filter bar honest if cards are edited.
  for (const button of filters) {
    const badge = button.querySelector('span');
    if (badge) badge.textContent = String(countFor(button.dataset.filter));
  }

  function apply(cat, { updateHash = true } = {}) {
    let shown = 0;
    for (const card of cards) {
      const match = cat === 'all' || card.dataset.cat === cat;
      card.classList.toggle('is-hidden', !match);
      if (match) shown++;
    }
    for (const button of filters) {
      const active = button.dataset.filter === cat;
      button.classList.toggle('is-on', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    empty.hidden = shown !== 0;
    if (updateHash) {
      try {
        history.replaceState(null, '', cat === 'all' ? location.pathname + location.search : `#${cat}`);
      } catch {
        /* ignore */
      }
    }
  }

  for (const button of filters) {
    button.addEventListener('click', () => apply(button.dataset.filter));
  }

  const initial = (location.hash || '').replace('#', '');
  if (filters.some((b) => b.dataset.filter === initial)) apply(initial, { updateHash: false });
  else apply('all', { updateHash: false });

  random?.addEventListener('click', () => {
    const visible = cards.filter((c) => !c.classList.contains('is-hidden'));
    if (!visible.length) return;
    const pick = visible[Math.floor(Math.random() * visible.length)];
    window.open(pick.href, '_blank', 'noopener');
  });

  // A quiet graceful fallback if a thumbnail is missing.
  for (const img of document.querySelectorAll('.thumb img')) {
    img.addEventListener('error', () => {
      img.style.display = 'none';
      img.parentElement?.classList.add('thumb-missing');
    });
  }
})();
