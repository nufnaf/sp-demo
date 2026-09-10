/** Presentation-only additions. The saved HTML stays complete and script-free. */
export function recruitingJdPreviewDocument(content: string): string {
  const style = `<style>
html.jd-awaiting main{visibility:hidden}
[data-jd-pending]{display:none!important}
.jd-writing::after{content:"";display:inline-block;width:2px;height:1em;margin-left:4px;background:#087457;vertical-align:-.1em;animation:jd-caret .85s ease-in-out infinite}
.jd-enter{animation:jd-enter .45s ease-out both}
@keyframes jd-caret{50%{opacity:.2}}
@keyframes jd-enter{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.jd-enter,.jd-writing::after{animation:none}}
</style><script>document.documentElement.classList.add('jd-awaiting');</script>`;
  return content.replace(/<\/head>/i, `${style}</head>`).replace(/<\/body>/i, `${REVEAL_SCRIPT}</body>`);
}

const REVEAL_SCRIPT = String.raw`<script>
(() => {
  const main = document.querySelector('main');
  const content = document.querySelector('.content');
  let initialized = false, active = false, finished = false, frame = 0;
  let elapsed = 0, previousTime = null, follow = true, previousScroll = 0;
  let units = [], index = 0;
  const pending = Array.from(content.querySelectorAll(':scope > :not(.hero), .list-section, .detail-card, .step, h2, h3, p, li'))
    .filter(element => !element.closest('.hero'));

  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    for (const unit of units) for (const part of unit.parts) part.node.data = part.text;
    pending.forEach(element => element.removeAttribute('data-jd-pending'));
    document.querySelectorAll('.jd-writing').forEach(element => element.classList.remove('jd-writing'));
    document.documentElement.classList.remove('jd-awaiting');
    main.setAttribute('aria-busy', 'false');
    window.parent.postMessage({ type: 'jd-preview-complete' }, '*');
  }

  function reveal(element) {
    for (let ancestor = element; ancestor && ancestor !== content; ancestor = ancestor.parentElement) {
      ancestor.removeAttribute('data-jd-pending');
    }
  }

  function tick(now) {
    if (!active || document.hidden || finished) { previousTime = null; return; }
    if (previousTime !== null) elapsed += now - previousTime;
    previousTime = now;
    const oldHeight = document.documentElement.scrollHeight;
    while (index < units.length) {
      const unit = units[index];
      if (elapsed < unit.start) break;
      reveal(unit.element);
      unit.element.classList.add('jd-writing');
      const progress = Math.min(1, (elapsed - unit.start) / unit.duration);
      // Advance small batches of Unicode characters while retaining inline markup.
      let remaining = progress === 1 ? unit.length : Math.floor(unit.length * progress / 4) * 4;
      for (const part of unit.parts) {
        const count = Math.min(remaining, part.characters.length);
        part.node.data = part.characters.slice(0, count).join('');
        remaining -= count;
      }
      if (progress < 1) break;
      unit.element.classList.remove('jd-writing');
      index++;
    }
    if (follow && document.documentElement.scrollHeight !== oldHeight) {
      // On narrow layouts the sidebar sits below the body; follow the writing,
      // not the sidebar at the document's bottom.
      window.scrollTo(0, Math.max(0, content.getBoundingClientRect().bottom + window.scrollY - window.innerHeight + 32));
      previousScroll = window.scrollY;
    }
    if (index === units.length) { finish(); return; }
    frame = requestAnimationFrame(tick);
  }

  function resume() {
    cancelAnimationFrame(frame);
    previousTime = null;
    if (active && !document.hidden && !finished && initialized) frame = requestAnimationFrame(tick);
  }

  function start(animate) {
    initialized = true;
    if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    pending.forEach(element => element.setAttribute('data-jd-pending', ''));
    units = Array.from(content.querySelectorAll('h2, h3, p, li')).filter(element => !element.closest('.hero')).map(element => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const parts = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        parts.push({ node, text: node.data, characters: Array.from(node.data) });
      }
      const length = parts.reduce((sum, part) => sum + part.characters.length, 0);
      return { element, parts, length, heading: element.matches('h2'), start: 0, duration: 0 };
    });
    const characters = units.reduce((sum, unit) => sum + unit.length, 0);
    const pauses = units.reduce((sum, unit) => sum + (unit.heading ? 180 : 55), 0);
    const textTime = Math.max(1, 18000 - 300 - pauses);
    let cursor = 300;
    for (const unit of units) {
      unit.start = cursor;
      unit.duration = textTime * unit.length / Math.max(1, characters);
      cursor += unit.duration + (unit.heading ? 180 : 55);
      for (const part of unit.parts) part.node.data = '';
    }
    main.setAttribute('aria-busy', 'true');
    document.querySelectorAll('.hero, .sidebar').forEach(element => element.classList.add('jd-enter'));
    document.documentElement.classList.remove('jd-awaiting');
    resume();
  }

  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.data?.type !== 'jd-preview-state') return;
    active = event.data.active === true;
    if (!initialized && (active || !event.data.animate)) start(event.data.animate === true);
    else resume();
  });
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y < previousScroll - 2) follow = false;
    else if (y + window.innerHeight >= content.getBoundingClientRect().bottom + y - 48) follow = true;
    previousScroll = y;
  }, { passive: true });
  window.addEventListener('wheel', event => { if (event.deltaY < 0) follow = false; }, { passive: true });
  window.addEventListener('keydown', event => {
    if (['ArrowUp', 'PageUp', 'Home'].includes(event.key)) follow = false;
  });
  window.addEventListener('beforeprint', finish);
})();
</script>`;
