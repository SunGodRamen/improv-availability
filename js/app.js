(() => {

  const qs  = (sel, el = document) => el.querySelector(sel);
  const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  function srSay(msg){
    const n = qs('#sr-status');
    if (!n) return;
    n.textContent = '';
    setTimeout(() => { n.textContent = msg; }, 10);
  }

  function addHidden(form, name, value = '') {
    let i = form.querySelector(`input[type="hidden"][name="${name}"]`);
    if (!i) {
      i = document.createElement('input');
      i.type = 'hidden';
      i.name = name;
      form.appendChild(i);
    }
    if (value !== undefined) i.value = String(value);
    return i;
  }

  function fmtHourRange(h) {
    const d = (H) => new Date(2000, 0, 1, H, 0);
    const toLabel = (date) => date.toLocaleTimeString([], { hour: 'numeric' });
    return `${toLabel(d(h))}–${toLabel(d(h + 1))}`;
  }

  function coerceInt(v, def = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const POLICY = window.POLICY || {
      specVersion: 'v1.4',
      policyVersion: 'windowed-dates-v1',
      windowISO: '2025-11',
      startISO: '2025-11-01',
      endISO:   '2025-11-30'
    };

    const form = qs('#availability-form');
    const grid = qs('#weekly-grid');
    const mobileDragToggle = qs('#mobile-drag-toggle');

    if (!form || !grid) {
      console.warn('[improv-availability] Missing required form/grid nodes');
      return;
    }

    addHidden(form, '_spec_version',   POLICY.specVersion || 'v1.4');
    addHidden(form, '_policy_version', POLICY.policyVersion || 'windowed-dates-v1');
    addHidden(form, '_policy_window',  POLICY.windowISO || '2025-11');
    addHidden(form, '_policy_start',   POLICY.startISO || '2025-11-01');
    addHidden(form, '_policy_end',     POLICY.endISO || '2025-11-30');

    const t0 = performance.now();
    let firstInteractionMs = null;
    let focusCount = 0, blurCount = 0, clickCount = 0;
    let cellPaints = 0, rangeSelections = 0;
    let pageMaxScroll = 0, gridMaxScroll = 0;

    (function captureStatic(){
      const nav = navigator || {};
      const conn = nav.connection || nav.webkitConnection || nav.mozConnection || {};
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

      addHidden(form, '_meta[page_url]', location.href);
      addHidden(form, '_meta[referrer]', document.referrer || '');
      addHidden(form, '_meta[user_agent]', nav.userAgent || '');
      addHidden(form, '_meta[language]', nav.language || '');
      addHidden(form, '_meta[languages]', (nav.languages || []).join(','));
      addHidden(form, '_meta[platform]', nav.platform || '');
      addHidden(form, '_meta[vendor]', nav.vendor || '');
      addHidden(form, '_meta[deviceMemory]', nav.deviceMemory ?? '');
      addHidden(form, '_meta[hardwareConcurrency]', nav.hardwareConcurrency ?? '');
      addHidden(form, '_meta[maxTouchPoints]', nav.maxTouchPoints ?? '');
      addHidden(form, '_meta[cookieEnabled]', nav.cookieEnabled ?? '');
      addHidden(form, '_meta[doNotTrack]', nav.doNotTrack ?? '');
      addHidden(form, '_meta[timezone]', tz || '');
      addHidden(form, '_meta[color_scheme]', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      addHidden(form, '_meta[pointer_coarse]', matchMedia('(pointer: coarse)').matches);
      addHidden(form, '_meta[pointer_fine]', matchMedia('(pointer: fine)').matches);
      addHidden(form, '_meta[hover]', matchMedia('(hover: hover)').matches);
      addHidden(form, '_meta[dpr]', window.devicePixelRatio || 1);
      addHidden(form, '_meta[screen_w]', screen.width);
      addHidden(form, '_meta[screen_h]', screen.height);
      addHidden(form, '_meta[viewport_w]', window.innerWidth);
      addHidden(form, '_meta[viewport_h]', window.innerHeight);
      addHidden(form, '_meta[connection_effectiveType]', conn.effectiveType || '');
      addHidden(form, '_meta[connection_downlink]', conn.downlink ?? '');
      addHidden(form, '_meta[connection_rtt]', conn.rtt ?? '');
      addHidden(form, '_meta[connection_saveData]', conn.saveData ?? '');
      addHidden(form, '_meta[visibilityState]', document.visibilityState || '');
      addHidden(form, '_meta[is_touch]', matchMedia('(pointer: coarse)').matches);
    })();

    window.addEventListener('resize', () => {
      addHidden(form, '_meta[viewport_w]', window.innerWidth);
      addHidden(form, '_meta[viewport_h]', window.innerHeight);
    });
    window.addEventListener('scroll', () => {
      pageMaxScroll = Math.max(pageMaxScroll, window.scrollY || document.documentElement.scrollTop || 0);
    }, { passive: true });
    grid.addEventListener('scroll', () => {
      gridMaxScroll = Math.max(gridMaxScroll, grid.scrollTop);
    }, { passive: true });
    window.addEventListener('focus', () => { focusCount++; }, true);
    window.addEventListener('blur',  () => { blurCount++;  }, true);
    window.addEventListener('click', () => {
      clickCount++;
      if (firstInteractionMs == null) firstInteractionMs = Math.round(performance.now() - t0);
    }, { capture: true });

    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const startHours = Array.from({ length: 12 }, (_, i) => 10 + i); // 10..21
    addHidden(form, '_meta[weekly_slots]', days.length * startHours.length);

    function currentMode() {
      return (qs('input[name="paint"]:checked')?.value) || 'preferred';
    }

    function ensureHidden(name) {
      return addHidden(form, name);
    }

    function getState(cell) {
      if (cell.classList.contains('preferred')) return 'preferred';
      if (cell.classList.contains('unavailable')) return 'unavailable';
      return 'unset';
    }

    function setCellLabelFromState(cell) {
      const st = getState(cell);
      cell.textContent = st === 'preferred' ? 'Preferred' :
                         st === 'unavailable' ? 'Unavailable' : '—';
    }

    function applyState(cell, state) {
      cell.classList.remove('preferred', 'unavailable', 'pending');
      if (cell.dataset._originalLabel) {
        cell.textContent = cell.dataset._originalLabel;
        delete cell.dataset._originalLabel;
      } else {
        cell.textContent = '—';
      }
      const hidden = ensureHidden(cell.dataset.name);
      if (state === 'preferred') {
        cell.classList.add('preferred');
        cell.textContent = 'Preferred';
        hidden.value = 'Preferred';
      } else if (state === 'unavailable') {
        cell.classList.add('unavailable');
        cell.textContent = 'Unavailable';
        hidden.value = 'Unavailable';
      } else {
        hidden.value = '';
      }
    }

    (function buildGrid() {
      startHours.forEach((h) => {
        const row = document.createElement('div');
        row.className = 'row';

        const label = document.createElement('div');
        label.textContent = fmtHourRange(h);
        row.appendChild(label);

        days.forEach((d) => {
          const name = `week[${d}_${String(h).padStart(2, '0')}]`;
          const cell = document.createElement('button');
          cell.type = 'button';
          cell.className = 'cell';
          cell.dataset.name = name;
          cell.dataset.day = d;
          cell.dataset.hour = String(h);
          cell.setAttribute('aria-label', `${d} ${fmtHourRange(h)}`);
          cell.textContent = '—';
          row.appendChild(cell);
          ensureHidden(name);
        });

        grid.appendChild(row);
      });

      const noonIndex = startHours.indexOf(12);
      const rowEls = qsa('.row', grid);
      if (noonIndex >= 0 && rowEls[noonIndex]) {
        const target = rowEls[noonIndex];
        const offset = target.offsetTop - grid.clientHeight / 2 + target.clientHeight / 2;
        grid.scrollTop = Math.max(0, offset);
      }
    })();

    let dragging = false;
    let operation = 'set';
    let opMode = 'preferred';

    function decideOperation(startCell) {
      const mode = currentMode();
      const state = getState(startCell);
      opMode = mode;
      if (state === 'unset') operation = 'set';
      else if (state === mode) operation = 'unset';
      else operation = 'set';
    }

    function paintCell(cell) {
      if (!cell.classList.contains('cell')) return;
      if (operation === 'set') {
        applyState(cell, opMode);
      } else {
        applyState(cell, 'unset');
      }
      cellPaints++;
    }

    function onCellClick(e) {
      const t = e.target;
      if (!t.classList.contains('cell')) return;
      decideOperation(t);
      paintCell(t);
    }

    function onPointerDown(e) {
      const t = e.target;
      if (!t.classList.contains('cell')) return;
      decideOperation(t);
      dragging = true;
      grid.setPointerCapture(e.pointerId);
      paintCell(t);
    }

    function onPointerMove(e) {
      if (!dragging) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && el.classList && el.classList.contains('cell')) paintCell(el);
    }

    function onPointerUp() { dragging = false; }

    function enableDesktopDrag() {
      grid.addEventListener('pointerdown', onPointerDown);
      grid.addEventListener('pointermove', onPointerMove);
      grid.addEventListener('pointerup', onPointerUp);
      grid.addEventListener('pointercancel', onPointerUp);
      grid.addEventListener('click', onCellClick);
    }
    function disableDesktopDrag() {
      grid.removeEventListener('pointerdown', onPointerDown);
      grid.removeEventListener('pointermove', onPointerMove);
      grid.removeEventListener('pointerup', onPointerUp);
      grid.removeEventListener('pointercancel', onPointerUp);
      grid.removeEventListener('click', onCellClick);
    }

    let rangeStart = null;

    function sameColumn(a, b) {
      return a && b && a.dataset.day === b.dataset.day;
    }

    function setPending(cell) {
      clearPending();
      cell.classList.add('pending');
      cell.dataset._originalLabel = cell.textContent;
      cell.textContent = 'Select end';
      cell.setAttribute(
        'aria-label',
        (cell.getAttribute('aria-label') || '') + ' — start selected, choose end'
      );
      srSay('Start selected. Choose end in the same day.');
    }

    function clearPending() {
      if (!rangeStart) return;
      const c = rangeStart;
      c.classList.remove('pending');
      if (c.dataset._originalLabel != null) {
        c.textContent = c.dataset._originalLabel;
        delete c.dataset._originalLabel;
      } else {
        setCellLabelFromState(c);
      }
      c.setAttribute('aria-label', (c.getAttribute('aria-label') || '').replace(/ — start selected.*$/, ''));
      rangeStart = null;
    }

    function applyRange(a, b) {
      if (!a || !b) return;
      if (!sameColumn(a, b)) {
        decideOperation(a);
        paintCell(a);
        return;
      }
      const day = a.dataset.day;
      const h1 = coerceInt(a.dataset.hour);
      const h2 = coerceInt(b.dataset.hour);
      const [lo, hi] = h1 <= h2 ? [h1, h2] : [h2, h1];

      decideOperation(a);
      for (let h = lo; h <= hi; h++) {
        const cell = qs(`.cell[data-day="${day}"][data-hour="${h}"]`, grid);
        if (cell) paintCell(cell);
      }
      rangeSelections++;
    }

    function onTap(e) {
      const t = e.target;
      if (!t.classList.contains('cell')) return;
      if (firstInteractionMs == null) firstInteractionMs = Math.round(performance.now() - t0);

      if (rangeStart === t) {
        clearPending();
        srSay('Selection canceled.');
        return;
      }
      if (!rangeStart) {
        rangeStart = t;
        setPending(t);
        t.focus();
      } else {
        applyRange(rangeStart, t);
        clearPending();
      }
    }

    function cancelIfOutside(e) {
      if (!grid.contains(e.target) && rangeStart) clearPending();
    }

    function enableMobileTapRange() {
      grid.addEventListener('click', onTap);
      disableDesktopDrag();
      document.addEventListener('click', cancelIfOutside, { capture: true });
    }
    function disableMobileTapRange() {
      grid.removeEventListener('click', onTap);
      document.removeEventListener('click', cancelIfOutside, { capture: true });
      clearPending();
      enableDesktopDrag();
    }

    const isTouch = matchMedia('(pointer: coarse)').matches;
    if (isTouch) enableMobileTapRange(); else enableDesktopDrag();
    if (mobileDragToggle) {
      mobileDragToggle.addEventListener('change', () => {
        if (mobileDragToggle.checked) {
          disableMobileTapRange();
          srSay('Drag mode enabled.');
        } else {
          if (isTouch) {
            enableMobileTapRange();
            srSay('Tap range mode enabled.');
          }
        }
      });
    }

    grid.addEventListener('keydown', (e) => {
      const t = e.target;
      if (!t.classList || !t.classList.contains('cell')) return;
      if (e.key === 'p' || e.key === 'P') {
        const st = getState(t);
        applyState(t, st === 'preferred' ? 'unset' : 'preferred');
        if (firstInteractionMs == null) firstInteractionMs = Math.round(performance.now() - t0);
        e.preventDefault();
      } else if (e.key === 'u' || e.key === 'U') {
        const st = getState(t);
        applyState(t, st === 'unavailable' ? 'unset' : 'unavailable');
        if (firstInteractionMs == null) firstInteractionMs = Math.round(performance.now() - t0);
        e.preventDefault();
      } else if (e.key === 'Escape') {
        clearPending();
      }
    });

    (function oneOffs() {
      const list = qs('#oneoff-list');
      const tpl  = qs('#oneoff-template')?.innerHTML || '';
      const addBtn = qs('#add-oneoff');
      if (!list || !tpl || !addBtn) return;

      let idx = 0;
      const START = new Date((POLICY.startISO || '2025-11-01') + 'T00:00:00');
      const END   = new Date((POLICY.endISO   || '2025-11-30') + 'T23:59:59');

      function inWindow(iso) {
        if (!iso) return false;
        const d = new Date(iso + 'T12:00:00');
        return !Number.isNaN(d) && d >= START && d <= END;
      }

      function setWindowFlag(card, ok, i) {
        const warn = qs('[data-warn]', card);
        if (warn) warn.style.display = ok ? 'none' : 'block';
        const name = `oneoff[${i}][window_ok]`;
        let hidden = form.querySelector(`input[type="hidden"][name="${name}"]`);
        if (!hidden) {
          hidden = document.createElement('input');
          hidden.type = 'hidden';
          hidden.name = name;
          form.appendChild(hidden);
        }
        hidden.value = ok ? 'true' : 'false';
      }

      function wireWatchers(card, i) {
        const dateEl = qs(`[name="oneoff[${i}][date]"]`, card);
        const onChange = () => setWindowFlag(card, inWindow(dateEl.value), i);
        dateEl.addEventListener('change', onChange);
        onChange();
      }

      function addOneOff(prefill = {}) {
        const html = tpl.replaceAll('__i__', String(idx));
        const wrap = document.createElement('div');
        wrap.innerHTML = html;
        const card = wrap.firstElementChild;

        const setVal = (sel, v) => { if (v != null) qs(sel, card).value = v; };
        setVal(`[name="oneoff[${idx}][date]"]`,   prefill.date);
        setVal(`[name="oneoff[${idx}][start]"]`,  prefill.start);
        setVal(`[name="oneoff[${idx}][end]"]`,    prefill.end);
        setVal(`[name="oneoff[${idx}][status]"]`, prefill.status);
        setVal(`[name="oneoff[${idx}][notes]"]`,  prefill.notes);

        qs('[data-remove]', card).addEventListener('click', () => card.remove());
        list.appendChild(card);

        wireWatchers(card, idx);
        idx += 1;
      }

      addOneOff();
      addOneOff();

      addBtn.addEventListener('click', () => addOneOff());
    })();

    form.addEventListener('submit', () => {
      addHidden(form, '_meta[submitted_at_iso]', new Date().toISOString());
      addHidden(form, '_meta[time_open_ms]', Math.round(performance.now() - t0));
      addHidden(form, '_meta[first_interaction_ms]', firstInteractionMs ?? '');
      addHidden(form, '_meta[focus_count]', focusCount);
      addHidden(form, '_meta[blur_count]', blurCount);
      addHidden(form, '_meta[click_count]', clickCount);
      addHidden(form, '_meta[cell_paints]', cellPaints);
      addHidden(form, '_meta[range_selections]', rangeSelections);
      addHidden(form, '_meta[page_max_scroll]', Math.round(pageMaxScroll));
      addHidden(form, '_meta[grid_max_scroll]', Math.round(gridMaxScroll));
      addHidden(form, '_meta[visibilityState]', document.visibilityState || '');
    });
  });
})();
