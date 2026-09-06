/* Progressive enhancement only. All prose and links exist in the HTML. */
window.BenjaminInit = function initBenjamin() {
  'use strict';
  window.__benjaminCleanup?.();
  const events = new AbortController();
  const observers = [];
  let disposed = false;
  const on = (target, type, callback, options = {}) => target?.addEventListener(type, callback, { ...options, signal: events.signal });
  window.__benjaminCleanup = () => { disposed = true; events.abort(); observers.forEach((observer) => observer.disconnect()); };
  const root = document.documentElement;
  const $ = (s, context = document) => context.querySelector(s);
  const $$ = (s, context = document) => [...context.querySelectorAll(s)];
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const smooth = (v) => v * v * (3 - 2 * v);
  const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const wideScreen = matchMedia('(min-width: 1000px) and (min-height: 720px)');
  let manualMotion = false;
  try { manualMotion = localStorage.getItem('benjamin-motion') === 'reduce'; } catch (_) { /* Private browsing may deny storage. */ }
  let reduced = systemMotion.matches || manualMotion;
  root.classList.toggle('reduced-motion', reduced);

  const menu = $('#site-menu');
  const menuButton = $('.menu-toggle');
  if (menu && menuButton && typeof menu.showModal === 'function') {
    menuButton.hidden = false;
    on(menuButton, 'click', () => { menu.showModal(); menuButton.setAttribute('aria-expanded', 'true'); });
    on($('[data-menu-close]', menu), 'click', () => menu.close());
    on(menu, 'keydown', (event) => {
      if (event.key !== 'Tab') return;
      const focusable = $$('a[href], button:not([disabled]), [tabindex="0"]', menu);
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    on(menu, 'close', () => { menuButton.setAttribute('aria-expanded', 'false'); menuButton.focus({ preventScroll: true }); });
    $$('a', menu).forEach((a) => on(a, 'click', () => menu.close()));
    on(matchMedia('(min-width: 701px)'), 'change', (e) => { if (e.matches && menu.open) menu.close(); });
  } else root.classList.add('no-dialog');

  const story = $('[data-research-story]');
  const figure = $('.research-figure');
  const masthead = $('[data-masthead]');
  const groups = $$('.profile-sample');
  const control = $('#arrangement');
  const follow = $('[data-follow-page]');
  const stateLabel = $('[data-figure-state]');
  const valueLabel = $('[data-arrangement-value]');
  const chartAxis = $('[data-chart-axis]');
  const readingProgress = $('[data-reading-progress]');
  const header = $('[data-header]');
  const workList = $('[data-work-list]');
  const closing = $('[data-closing]');
  let chartManual = false;
  let lastChartProgress = -1;
  let dimensions = {};
  let framePending = false;

  function renderChart(value) {
    if (!groups.length) return;
    const p = clamp(value);
    if (Math.abs(p - lastChartProgress) < .0002) return;
    lastChartProgress = p;
    for (const group of groups) {
      const a = Number(group.dataset.original); const b = Number(group.dataset.ordered);
      const x = a + (b - a) * smooth(p); group.setAttribute('transform', `translate(${x.toFixed(3)},0)`);
    }
    const percent = Math.round(p * 100);
    if (control) { control.value = String(percent); control.setAttribute('aria-valuetext', percent === 0 ? 'Original arrangement' : percent === 100 ? 'Decreasing arrangement' : `${percent} percent rearranged`); }
    if (valueLabel) valueLabel.textContent = `${percent}%`;
    if (stateLabel) stateLabel.textContent = p < .04 ? 'Original arrangement' : p > .96 ? 'Decreasing arrangement' : 'The same values, reordered';
    if (chartAxis) chartAxis.textContent = p > .96 ? 'decreasing rank' : p < .04 ? 'original position' : 'position';
  }

  if (groups.length && control) {
    $('.diagram-controls').hidden = false;
    const above = groups.filter((g) => Number(g.dataset.value) > .55).length;
    $('[data-invariant]').textContent = `${above} of 48 above t`;
    on(control, 'input', () => { chartManual = true; renderChart(Number(control.value) / 100); if (follow) follow.hidden = !(wideScreen.matches && !reduced); });
    on(follow, 'click', () => { chartManual = false; follow.hidden = true; schedule(); });
    renderChart(0);
  }

  function absoluteRect(element) { if (!element) return null; const rect = element.getBoundingClientRect(); return { top: rect.top + scrollY, height: rect.height }; }
  function measure() {
    if (disposed) return;
    dimensions = { viewport: innerHeight, scrollHeight: Math.max(1, document.documentElement.scrollHeight - innerHeight), opening: absoluteRect($('.opening')), story: absoluteRect(story), figureHeight: figure?.getBoundingClientRect().height || 0, figureTop: figure ? parseFloat(getComputedStyle(figure).top) || 0 : 0, work: absoluteRect(workList), closing: absoluteRect(closing) };
    schedule();
  }
  function update() {
    if (disposed) return;
    framePending = false;
    const y = scrollY; const d = dimensions;
    header?.classList.toggle('is-scrolled', y > 16);
    if (readingProgress) readingProgress.style.transform = `scaleX(${clamp(y / (d.scrollHeight || 1))})`;
    if (masthead) { const p = d.opening ? clamp((y - d.opening.top + 70) / (d.opening.height * .8)) : 0; masthead.style.transform = !reduced && wideScreen.matches ? `translate3d(${p * 18}px,${p * 44}px,0) scale(${1 - p * .025})` : ''; }
    if (d.story && wideScreen.matches && !reduced && !chartManual) {
      const start = d.story.top - d.viewport * .22;
      const finish = d.story.top + d.story.height - d.figureHeight - d.figureTop - 24;
      const span = Math.max(d.viewport * .4, finish - start);
      renderChart(clamp((y - start) / span));
    }
    if (d.work && workList) { const p = clamp((y + d.viewport * .7 - d.work.top) / Math.max(1, d.work.height)); workList.style.setProperty('--work-progress', reduced ? '1' : p.toFixed(4)); }
    if (d.closing && closing) { const p = clamp((y + d.viewport - d.closing.top) / Math.max(1, Math.min(d.closing.height, d.viewport * .8))); closing.style.setProperty('--closing-inset', !reduced && wideScreen.matches ? `${(1 - p) * 70}%` : '0%'); closing.style.setProperty('--closing-shift', !reduced && wideScreen.matches ? `${(1 - p) * 18}px` : '0px'); }
  }
  function schedule() { if (disposed) return; if (!framePending) { framePending = true; requestAnimationFrame(update); } }
  on(window, 'scroll', schedule, { passive: true }); on(window, 'resize', measure, { passive: true }); on(window, 'pageshow', measure);
  on(wideScreen, 'change', () => { if (follow) follow.hidden = !(chartManual && wideScreen.matches && !reduced); measure(); });
  if ('ResizeObserver' in window) { const observer = new ResizeObserver(measure); observer.observe(document.body); observers.push(observer); }

  const motionButton = $('.motion-toggle');
  function syncMotion() {
    reduced = systemMotion.matches || manualMotion; root.classList.toggle('reduced-motion', reduced);
    if (motionButton) { motionButton.hidden = false; motionButton.disabled = systemMotion.matches; motionButton.setAttribute('aria-pressed', String(reduced)); motionButton.textContent = systemMotion.matches ? 'Reduced motion (system)' : reduced ? 'Motion reduced' : 'Reduce motion'; motionButton.setAttribute('aria-label', systemMotion.matches ? 'Reduced motion is enabled by your device' : reduced ? 'Enable standard motion' : 'Reduce motion'); }
    if (follow) follow.hidden = !(chartManual && wideScreen.matches && !reduced); measure();
  }
  on(motionButton, 'click', () => { manualMotion = !manualMotion; try { if (manualMotion) localStorage.setItem('benjamin-motion', 'reduce'); else localStorage.removeItem('benjamin-motion'); } catch (_) {} syncMotion(); });
  on(systemMotion, 'change', syncMotion);

  $$('[data-workflow]').forEach((workflow) => {
    const tabs = $$('[role="tab"]', workflow); const panels = $$('[role="tabpanel"]', workflow);
    function selectTab(index, moveFocus = false) { tabs.forEach((tab, i) => { const selected = i === index; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; panels[i].hidden = !selected; }); if (moveFocus) tabs[index].focus(); measure(); }
    tabs.forEach((tab, i) => { on(tab, 'click', () => selectTab(i)); on(tab, 'keydown', (event) => { let next; if (event.key === 'ArrowRight') next = (i + 1) % tabs.length; if (event.key === 'ArrowLeft') next = (i + tabs.length - 1) % tabs.length; if (event.key === 'Home') next = 0; if (event.key === 'End') next = tabs.length - 1; if (next !== undefined) { event.preventDefault(); selectTab(next, true); } }); });
    selectTab(0);
  });

  const articleLinks = $$('.article-aside nav a[href^="#"]');
  if (articleLinks.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => { for (const entry of entries) { if (!entry.isIntersecting) continue; articleLinks.forEach((link) => link.classList.toggle('is-current', link.hash === `#${entry.target.id}`)); } }, { rootMargin: '-18% 0px -62% 0px' });
    observers.push(observer); articleLinks.forEach((link) => { const target = $(link.hash); if (target) observer.observe(target); });
  }
  syncMotion(); measure();
};
window.BenjaminInit();
