(() => {
  const qs  = (sel, el = document) => el.querySelector(sel);

  function addHidden(form, name, value='') {
    let i = form.querySelector(`input[type="hidden"][name="${name}"]`);
    if (!i) { i = document.createElement('input'); i.type = 'hidden'; i.name = name; form.appendChild(i); }
    if (value !== undefined) i.value = String(value);
    return i;
  }

  function fmtHourRange(h){
    const d = (H)=>new Date(2000,0,1,H,0);
    const toLabel = d=>d.toLocaleTimeString([], {hour:'numeric'});
    return `${toLabel(d(h))}–${toLabel(d(h+1))}`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = qs('#availability-form');
    const grid = qs('#weekly-grid');
    if (!form || !grid) return;

    addHidden(form, '_spec_version', 'v1.4');

    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    const startHours = window.startHours || Array.from({ length: 12 }, (_, i) => i + 10);

    startHours.forEach((h) => {
      const row = document.createElement('div');
      row.className = 'row';
      const label = document.createElement('div');
      label.textContent = fmtHourRange(h);
      row.appendChild(label);

      days.forEach((d) => {
        const name = `week[${d}_${String(h).padStart(2,'0')}]`;
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell';
        cell.dataset.name = name;
        cell.dataset.day = d;
        cell.dataset.hour = String(h);
        cell.textContent = '—';
        row.appendChild(cell);
        addHidden(form, name, '');
      });

      grid.appendChild(row);
    });

    function getState(cell){
      if (cell.classList.contains('preferred')) return 'preferred';
      if (cell.classList.contains('unavailable')) return 'unavailable';
      return 'unset';
    }
    function applyState(cell, state){
      cell.classList.remove('preferred','unavailable','pending');
      const hidden = form.querySelector(`input[type="hidden"][name="${cell.dataset.name}"]`);
      if (state === 'preferred') { cell.classList.add('preferred'); cell.textContent='Preferred'; hidden.value='Preferred'; }
      else if (state === 'unavailable') { cell.classList.add('unavailable'); cell.textContent='Unavailable'; hidden.value='Unavailable'; }
      else { cell.textContent='—'; hidden.value=''; }
    }
    function currentMode(){ return qs('input[name="paint"]:checked')?.value || 'preferred'; }

    let dragging = false;
    let operation = 'set';
    let opMode = 'preferred';

    function decideOperation(startCell){
      const mode = currentMode();
      const state = getState(startCell);
      opMode = mode;
      operation = (state === 'unset' || state !== mode) ? 'set' : 'unset';
    }
    function paintCell(cell){
      if (!cell.classList.contains('cell')) return;
      applyState(cell, operation === 'set' ? opMode : 'unset');
    }

    function onClick(e){
      const t = e.target;
      if (!t.classList.contains('cell')) return;
      decideOperation(t);
      paintCell(t);
    }
    function onDown(e){
      const t = e.target;
      if (!t.classList.contains('cell')) return;
      decideOperation(t);
      dragging = true;
      grid.setPointerCapture?.(e.pointerId);
      paintCell(t);
    }
    function onMove(e){
      if (!dragging) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && el.classList && el.classList.contains('cell')) paintCell(el);
    }
    function onUp(){ dragging = false; }

    grid.addEventListener('pointerdown', onDown);
    grid.addEventListener('pointermove', onMove);
    grid.addEventListener('pointerup', onUp);
    grid.addEventListener('pointercancel', onUp);
    grid.addEventListener('click', onClick);

    form.addEventListener('submit', () => {
      metas.forEach(n => n.remove());
    });
  });
})();
