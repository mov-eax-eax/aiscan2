// Render, filter and order the merged catalogue.
(() => {
  const data = window.MODEL_ROOM_CATALOG || [];
  const grid = document.getElementById('modelGrid');
  const empty = document.getElementById('catalogEmpty');
  const search = document.getElementById('search');
  const sort = document.getElementById('sort');
  const resultCount = document.getElementById('resultCount');
  const resultRange = document.getElementById('resultRange');
  const filters = [...document.querySelectorAll('[data-collection]')];

  const state = { collection: 'all', query: '', sort: 'newest' };

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function pretty(date) {
    const [day, time] = date.split(' ');
    const [y, m, d] = day.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d} ${months[Number(m) - 1]} ${y}`;
  }

  function when(date) {
    const [day, time] = date.split(' ');
    return `<time datetime="${esc(day)}T${esc(time)}">${esc(pretty(date))} <span>${esc(time)}</span></time>`;
  }

  function card(item) {
    const tags = (item.tags || []).map((t) => `<span>${esc(t)}</span>`).join('');
    return `<a class="model-card" href="${esc(item.href)}" target="_blank" rel="noopener" title="${esc(item.source)} — source file modified ${esc(item.date)}">
      <div class="m-thumb">
        <img src="${esc(item.thumb)}" alt="${esc(item.title)}" loading="lazy" />
        <span class="m-collection">${esc(item.collectionLabel)}</span>
        <span class="m-date">${esc(item.date.slice(0, 10))}</span>
      </div>
      <div class="m-body">
        <div class="m-title-row"><h3>${esc(item.title)}</h3><span class="m-arrow">↗</span></div>
        <p class="m-source">${esc(item.source)}</p>
        <div class="m-bottom">${when(item.date)}<div class="m-tags">${tags}</div></div>
      </div>
    </a>`;
  }

  function apply() {
    const q = state.query.trim().toLowerCase();
    const filtered = data.filter((item) => {
      if (state.collection !== 'all' && item.collection !== state.collection) return false;
      if (!q) return true;
      return [item.title, item.source, item.collectionLabel, item.collection, ...(item.tags || [])]
        .join(' ').toLowerCase().includes(q);
    });
    filtered.sort((a, b) => state.sort === 'oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));

    grid.innerHTML = filtered.map(card).join('');
    empty.hidden = filtered.length !== 0;
    resultCount.textContent = `${filtered.length} work${filtered.length === 1 ? '' : 's'}`;
    if (filtered.length) {
      const dates = filtered.map((x) => x.date).sort();
      resultRange.textContent = `${dates[0].slice(0, 10)} → ${dates[dates.length - 1].slice(0, 10)}`;
    } else {
      resultRange.textContent = 'no dates';
    }
    for (const button of filters) {
      const active = button.dataset.collection === state.collection;
      button.classList.toggle('is-on', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  for (const button of filters) {
    button.addEventListener('click', () => { state.collection = button.dataset.collection; apply(); });
  }
  search.addEventListener('input', () => { state.query = search.value; apply(); });
  sort.addEventListener('change', () => { state.sort = sort.value; apply(); });
  apply();
})();
