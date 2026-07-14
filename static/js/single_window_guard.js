document.addEventListener('DOMContentLoaded', () => {
  const _log = (...args) => {
    try { console.log('[MAHKAMA][single-window]', new Date().toLocaleTimeString(), ...args); } catch (e) {}
  };
  const _post = (path, payload) => {
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(path, new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      } else {
        fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
      }
    } catch (e) {}
  };
  const clickId = (el) => {
    if (!el) return 'null';
    if (el.id) return '#' + el.id;
    if (el.className && typeof el.className === 'string') return '.' + el.className.trim().split(/\s+/)[0];
    return el.tagName.toLowerCase();
  };
  document.addEventListener('click', (e) => {
    const t = e.target;
    while (t && t !== document) {
      if (t.tagName === 'A') {
        _log('click', clickId(t), 'href=', t.href, 'target=', t.target);
        _post('/api/log-client', { kind: 'click', tag: 'A', id: clickId(t), href: t.href, target: t.target || '' });
        if (t.target === '_blank') {
          e.preventDefault();
          t.removeAttribute('target');
        }
        break;
      }
      if (t.tagName === 'BUTTON' || t.tagName === 'INPUT') {
        _log('click', clickId(t), 'type=', t.type || '', 'value=', (t.value || t.innerText || '').trim().slice(0, 60));
        _post('/api/log-client', { kind: 'click', tag: t.tagName, id: clickId(t), type: t.type || '', text: (t.value || t.innerText || '').trim().slice(0, 120) });
        break;
      }
      t = t.parentElement;
    }
  }, true);

  window.open = ((orig) => (url) => {
    _log('blocked window.open ->', url);
    _post('/api/log-client', { kind: 'window.open', url: url || '' });
    if (url && typeof url === 'string') {
      if (/^https?:\/\//.test(url) || url.startsWith('/')) {
        location.assign(url);
        return null;
      }
      location.href = url;
      return null;
    }
    return orig(url);
  })(window.open);

  let lastHref = location.href;
  const navId = setInterval(() => {
    try {
      if (location && location.href && location.href !== lastHref) {
        _log('navigate', location.href);
        _post('/api/log-client', { kind: 'navigate', href: location.href });
        lastHref = location.href;
      }
    } catch (e) {}
  }, 250);

  _log('single-instance navigation guard installed');
});
