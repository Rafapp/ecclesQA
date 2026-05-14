// ==UserScript==
// @name         UDOIT + Canvas Module Item Opener (v6.6)
// @namespace    http://tampermonkey.net/
// @version      6.6
// @description  Fixed file dialog trigger for "Replace All" sequence.
// @match        https://udoit3.ciditools.com/*
// @match        https://*.instructure.com/courses/*/modules*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const PANEL_ID    = 'tm-udoit-panel';
  const DRAG_ID     = 'tm-udoit-drag';
  const RESOLVE_ID  = 'tm-udoit-resolve-all';
  const DOWNLOAD_ID = 'tm-udoit-download';
  const REPLACE_ID  = 'tm-udoit-replace';
  const OPEN_MOD_ID = 'tm-udoit-open-modules';
  const STATUS_ID   = 'tm-udoit-status';

  let running = false;
  let stopRequested = false;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const normalize = t => String(t ?? '').replace(/\s+/g, ' ').trim();

  function waitFor(fn, timeout = 15000, interval = 200) {
    return new Promise(async (resolve) => {
      const end = Date.now() + timeout;
      while (Date.now() < end && !stopRequested) {
        const val = fn();
        if (val) return resolve(val);
        await sleep(interval);
      }
      resolve(null);
    });
  }

  function setStatus(msg) {
    const el = document.getElementById(STATUS_ID);
    if (el) el.textContent = msg;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      stopRequested = true;
      setStatus('⛔ Stopped');
      running = false;
    }
  });

  function makePanel() {
    if (document.getElementById(PANEL_ID)) return;
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.style = `position:fixed; bottom:20px; right:20px; background:#0f172a; color:white; padding:12px; border-radius:12px; z-index:999999; width:230px; font-family:sans-serif; box-shadow: 0 4px 15px rgba(0,0,0,0.5);`;

    const isCanvasModules = window.location.href.includes('/modules');

    panel.innerHTML = `
      <div id="${DRAG_ID}" style="cursor:grab;font-weight:bold;margin-bottom:8px; border-bottom: 1px solid #334155; padding-bottom: 4px;">Auto Runner ⠿</div>

      <div id="udoit-tools" style="display: ${isCanvasModules ? 'none' : 'block'};">
          <button id="${RESOLVE_ID}" style="width:100%;margin-bottom:8px;background:#8b5cf6;color:white;padding:6px;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">✔ Mark All as Resolved</button>
          <button id="${DOWNLOAD_ID}" style="width:100%;margin-bottom:8px;background:#16a34a;color:white;padding:6px;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">⬇ Download All Files</button>
          <button id="${REPLACE_ID}" style="width:100%;margin-bottom:8px;background:#f59e0b;color:white;padding:6px;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">🔁 Replace All Files</button>
      </div>

      <div id="canvas-tools" style="display: ${isCanvasModules ? 'block' : 'none'};">
          <button id="${OPEN_MOD_ID}" style="width:100%;margin-bottom:8px;background:#3b82f6;color:white;padding:6px;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">📂 Open All Module Items</button>
      </div>

      <div id="${STATUS_ID}" style="font-size:11px;color:#94a3b8;text-align:center;margin-top:4px;">Idle (ESC to stop)</div>
    `;
    document.body.appendChild(panel);

    const drag = panel.querySelector('#' + DRAG_ID);
    drag.onmousedown = (e) => {
      let dragging = true;
      let offsetX = e.clientX - panel.offsetLeft;
      let offsetY = e.clientY - panel.offsetTop;
      document.onmousemove = (ev) => {
        if (!dragging) return;
        panel.style.left = (ev.clientX - offsetX) + 'px';
        panel.style.top  = (ev.clientY - offsetY) + 'px';
        panel.style.right = 'auto'; panel.style.bottom = 'auto';
      };
      document.onmouseup = () => { dragging = false; document.onmousemove = null; };
    };

    if (!isCanvasModules) {
        document.getElementById(RESOLVE_ID).onclick = resolveAllIssues;
        document.getElementById(DOWNLOAD_ID).onclick = downloadAllFiles;
        document.getElementById(REPLACE_ID).onclick = replaceAllFiles;
    } else {
        document.getElementById(OPEN_MOD_ID).onclick = openAllModuleItems;
    }
  }
  setInterval(makePanel, 2000);

  function realClick(el) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const base = { bubbles:true, cancelable:true, clientX:x, clientY:y, button:0 };
    const ptr  = { ...base, pointerId:1, pointerType:'mouse', isPrimary:true };
    el.dispatchEvent(new PointerEvent('pointerdown', ptr));
    el.dispatchEvent(new MouseEvent('mousedown', base));
    el.dispatchEvent(new PointerEvent('pointerup', ptr));
    el.dispatchEvent(new MouseEvent('mouseup', base));
    el.dispatchEvent(new MouseEvent('click', base));
  }

  /* ─── CANVAS: OPEN ALL MODULE ITEMS ─── */
  function openAllModuleItems() {
    if (running) return;
    running = true;
    const links = Array.from(document.querySelectorAll('a.ig-title.title.item_link')).map(a => a.href);
    if (!links.length) { setStatus('No module items found'); running = false; return; }
    setStatus(`Opening ${links.length} tabs...`);
    links.forEach(url => {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.click();
    });
    setStatus(`✅ Done! Opened ${links.length} items`);
    running = false;
  }

  /* ─── UDOIT: REPLACE ALL FILES (Dialog Fix) ─── */
  async function replaceAllFiles() {
    if (running) return; running = true; stopRequested = false;
    const rows = Array.from(document.querySelectorAll('tbody tr'));
    if (!rows.length) { setStatus('No rows found'); running = false; return; }

    const firstClick = rows[0].querySelector('[cursor="pointer"]');
    if (firstClick) firstClick.click();

    const counterEl = await waitFor(() => Array.from(document.querySelectorAll('li')).find(li => normalize(li.textContent).startsWith('File ')));
    const total = parseInt(counterEl?.textContent.match(/of\s+(\d+)/i)?.[1] || rows.length, 10);

    for (let i = 0; i < total; i++) {
      if (stopRequested) break;
      setStatus(`Replacing ${i + 1}/${total}`);

      // Wait for button
      const repBtn = await waitFor(() => {
          const b = Array.from(document.querySelectorAll('button')).find(btn => normalize(btn.textContent).includes('Replace file with an uploaded file'));
          return (b && !b.disabled) ? b : null;
      }, 8000);

      if (repBtn) {
          // CLEANUP: Remove any stale inputs to force a fresh event
          document.querySelectorAll('input[type="file"]').forEach(el => el.remove());

          realClick(repBtn);

          // Wait for the new input and trigger immediately
          const input = await waitFor(() => document.querySelector('input[type="file"]'));
          if (input) {
              input.click(); // Trigger file dialog
              setStatus('👉 Select File + Enter');

              // Wait for checkmark
              await waitFor(() => document.querySelector('svg[name="IconCheckMark"]'), 60000);

              const sub = await waitFor(() => {
                  const b = Array.from(document.querySelectorAll('button')).find(btn => normalize(btn.textContent) === 'Submit');
                  return (b && !b.disabled) ? b : null;
              }, 5000);

              if (sub) {
                  realClick(sub);
                  await sleep(2000); // Wait for processing
              }

              if (i < total - 1) {
                  const nextBtn = await waitFor(() => {
                      const b = Array.from(document.querySelectorAll('button')).find(btn =>
                          normalize(btn.textContent) === 'Next File' || normalize(btn.textContent) === 'Next Issue'
                      );
                      return (b && !b.disabled) ? b : null;
                  }, 8000);
                  if (nextBtn) {
                      realClick(nextBtn);
                      await sleep(1500);
                  } else break;
              }
          }
      } else break;
    }
    setStatus(stopRequested ? '⛔ Stopped' : '✅ Done');
    running = false;
  }

  /* ─── UDOIT: RESOLVE & DOWNLOAD (RETAINED) ─── */
  async function resolveAllIssues() {
    if (running) return;
    running = true; stopRequested = false;
    const rows = Array.from(document.querySelectorAll('tbody tr'));
    if (!rows.length) { setStatus('No rows found'); running = false; return; }
    const firstClick = rows[0].querySelector('[cursor="pointer"]');
    if (firstClick) firstClick.click();
    const counterEl = await waitFor(() => Array.from(document.querySelectorAll('li')).find(li => normalize(li.textContent).startsWith('Issue ')));
    const total = parseInt(counterEl?.textContent.match(/of\s+(\d+)/i)?.[1] || 0, 10);
    for (let i = 0; i < total; i++) {
        if (stopRequested) break;
        setStatus(`Resolving ${i + 1}/${total}`);
        const manualResSpan = await waitFor(() => Array.from(document.querySelectorAll('span')).find(s => normalize(s.textContent) === 'Manual Resolution'));
        if (manualResSpan) {
            const isExpanded = !!Array.from(document.querySelectorAll('label')).find(l => l.textContent.includes('confirm this content'));
            if (!isExpanded) { realClick(manualResSpan); await sleep(600); }
        }
        const confirmLabel = await waitFor(() => Array.from(document.querySelectorAll('label')).find(l => normalize(l.textContent).includes('confirm this content')), 5000);
        if (confirmLabel) {
            const inputId = confirmLabel.getAttribute('for');
            const checkbox = inputId ? document.getElementById(inputId) : confirmLabel.querySelector('input[type="checkbox"]');
            if (checkbox && !checkbox.checked) { realClick(checkbox); await sleep(800); }
        }
        if (i < total - 1) {
            const nextIssueBtn = await waitFor(() => {
                const b = Array.from(document.querySelectorAll('button')).find(btn => normalize(btn.textContent) === 'Next Issue');
                return (b && !b.disabled) ? b : null;
            }, 8000);
            if (nextIssueBtn) { realClick(nextIssueBtn); await sleep(1000); } else break;
        }
    }
    setStatus(stopRequested ? '⛔ Stopped' : '✅ Done');
    running = false;
  }

  async function downloadAllFiles() {
    if (running) return; running = true; stopRequested = false;
    const rows = Array.from(document.querySelectorAll('tbody tr'));
    if (rows[0]?.querySelector('[cursor="pointer"]')) rows[0].querySelector('[cursor="pointer"]').click();
    const counterEl = await waitFor(() => Array.from(document.querySelectorAll('li')).find(li => normalize(li.textContent).startsWith('File ')));
    const total = parseInt(counterEl?.textContent.match(/of\s+(\d+)/i)?.[1] || 0, 10);
    for (let i = 0; i < total; i++) {
        if (stopRequested) break;
        setStatus(`Downloading ${i + 1}/${total}`);
        const link = await waitFor(() => Array.from(document.querySelectorAll('a')).find(a => normalize(a.textContent) === 'Download File'));
        if (link) realClick(link);
        await sleep(1200);
        if (i < total - 1) {
            const next = await waitFor(() => Array.from(document.querySelectorAll('button')).find(b => normalize(b.textContent) === 'Next File' && !b.disabled));
            if (next) { realClick(next); await sleep(1200); }
        }
    }
    setStatus('Done'); running = false;
  }
})();