// ==UserScript==
// @name         UDOIT + Canvas Module Item Opener (v6.8)
// @namespace    http://tampermonkey.net/
// @version      6.8
// @description  Adds UDOIT bulk actions for resolving issues, files, and nondescript links.
// @match        https://udoit3.ciditools.com/*
// @match        https://*.instructure.com/courses/*/modules*
// @run-at       document-idle
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
  'use strict';

  const PANEL_ID    = 'tm-udoit-panel';
  const DRAG_ID     = 'tm-udoit-drag';
  const RESOLVE_ID  = 'tm-udoit-resolve-all';
  const DOWNLOAD_ID = 'tm-udoit-download';
  const REPLACE_ID  = 'tm-udoit-replace';
  const FIX_LINKS_ID = 'tm-udoit-fix-links';
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
          <button id="${FIX_LINKS_ID}" style="width:100%;margin-bottom:8px;background:#0ea5e9;color:white;padding:6px;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Fix Links</button>
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
        document.getElementById(FIX_LINKS_ID).onclick = fixAllLinks;
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

  function isVisible(el) {
    if (!el) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }

  function getDialogRoot() {
    return document.querySelector('[role="dialog"]') ||
      document.querySelector('[aria-modal="true"]') ||
      document.querySelector('.MuiDialog-root') ||
      document.body;
  }

  function getCurrentFileTitle() {
    const dialog = getDialogRoot();
    const heading = Array.from(dialog.querySelectorAll('h1, h2, h3, [data-cid="Heading"]'))
      .find(el => isVisible(el) && normalize(el.textContent));
    return heading ? normalize(heading.textContent) : '';
  }

  async function copyTextToClipboard(text) {
    if (!text) return false;
    if (typeof GM_setClipboard === 'function') {
      GM_setClipboard(text, 'text');
      return true;
    }
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        return document.execCommand('copy');
      } catch {
        return false;
      } finally {
        textarea.remove();
      }
    }
  }

  function getTextInput() {
    return Array.from(document.querySelectorAll('#textInputValue, input[name="textInputValue"], textarea[name="textInputValue"]'))
      .find(el => isVisible(el) && !el.disabled && !el.readOnly);
  }

  function getEnabledButton(label) {
    return Array.from(document.querySelectorAll('button')).find(btn =>
      !btn.disabled &&
      !btn.closest('#' + PANEL_ID) &&
      normalize(btn.textContent) === label
    );
  }

  function getIssueCounter() {
    return Array.from(document.querySelectorAll('li')).find(li => normalize(li.textContent).startsWith('Issue '));
  }

  async function clickNextIssue(timeout = 8000) {
    const nextIssueBtn = await waitFor(() => getEnabledButton('Next Issue'), timeout);
    if (!nextIssueBtn) return false;
    realClick(nextIssueBtn);
    await sleep(1000);
    return true;
  }

  function setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc?.set) desc.set.call(el, value);
    else el.value = value;
  }

  function updateTextInput(el, value) {
    el.focus();
    setNativeValue(el, value);
    el.setAttribute('value', value);
    try {
      el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: value }));
    } catch {
      el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
    el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
  }

  function stripFileExtensions(text) {
    let s = String(text ?? '').trim();
    for (let i = 0; i < 3; i++) {
      const next = s.replace(/\s*\.[a-z][a-z0-9_-]{1,9}\s*$/i, '').trim();
      if (next === s) break;
      s = next;
    }
    return s;
  }

  function cleanLinkText(text) {
    const dotToken = 'UDOITDOTTOKEN';
    const apostropheToken = 'UDOITAPOSTOKEN';
    let s = String(text ?? '').trim();
    if (!s) return '';

    s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    s = stripFileExtensions(s);
    s = s.replace(/\s*(?:[-_]\s*1|\(\s*1\s*\)|\bcopy\s*\d*\b)\s*$/i, '').trim();

    s = s.replace(/\b(Dr|Mr|Mrs|Ms|Prof|St|Sr|Jr)\./gi, (_, abbr) => abbr + dotToken);
    s = s.replace(/\b(?:[A-Za-z]\.){2,}/g, match => match.replace(/\./g, dotToken));
    s = s.replace(/(\d)\.(\d)/g, '$1' + dotToken + '$2');
    s = s.replace(/([A-Za-z])'([A-Za-z])/g, '$1' + apostropheToken + '$2');

    s = s.replace(/[\u2010-\u2015-]+/g, ' ');
    s = s.replace(/[._+=~|\\/:;,#*^%$@!?()[\]{}<>`"…]+/g, ' ');
    s = s.replace(/'/g, ' ');
    s = s.replace(/[^\p{L}\p{N}&\s]/gu, ' ');
    s = s.replace(/\s*&\s*/g, ' & ');
    s = s.replace(/\s+/g, ' ').trim();

    return s
      .split(dotToken).join('.')
      .split(apostropheToken).join("'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  function looksLikeUrlOrPath(text) {
    const t = normalize(text);
    return /^(?:https?|ftp):\/\//i.test(t) ||
      /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ||
      /^www\./i.test(t) ||
      /^mailto:/i.test(t) ||
      /[a-z0-9.-]+\.(?:com|org|edu|gov|net|io|co|us|ca|uk|info|biz)(?:[/?#:]|$)/i.test(t) ||
      /[?#=&]{2,}/.test(t) ||
      /^[a-z]:\\/i.test(t) ||
      /\\\\/.test(t) ||
      (/[\\/]/.test(t) && (!/\s/.test(t) || /\d{3,}/.test(t) || /(?:^|[\\/])(courses|files|users|modules|pages|api)(?:[\\/]|$)/i.test(t)));
  }

  function looksGeneratedOrJargon(text) {
    const t = stripFileExtensions(normalize(text));
    const compact = t.replace(/[^A-Za-z0-9]/g, '');
    const words = t.match(/[A-Za-z]{2,}/g) || [];
    const alphaCount = (t.match(/[A-Za-z]/g) || []).length;

    if (alphaCount < 3) return true;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return true;
    if (/^[a-f0-9]{16,}$/i.test(compact)) return true;
    if (!/\s/.test(t) && /\d{6,}/.test(compact) && /[A-Za-z]/.test(compact)) return true;
    if (!/\s/.test(t) && compact.length >= 18 && /[A-Za-z]/.test(compact) && /\d/.test(compact)) return true;
    if (words.length === 0) return true;
    if (words.length >= 2 && words.every(word => !/[aeiouy]/i.test(word))) return true;
    if (words.length === 1 && words[0].length > 16 && !/[aeiouy]/i.test(words[0])) return true;

    return false;
  }

  function getCleanedLinkText(text) {
    const raw = String(text ?? '').trim();
    if (!raw || looksLikeUrlOrPath(raw) || looksGeneratedOrJargon(raw)) return null;

    const cleaned = cleanLinkText(raw);
    if (!cleaned || cleaned === raw || looksGeneratedOrJargon(cleaned)) return null;
    return cleaned;
  }

  function getIssueOpenCandidates() {
    const root = getDialogRoot();
    const skip = /\b(next issue|previous issue|save|submit|cancel|close|download file|next file|previous file|replace file)\b/i;

    return Array.from(root.querySelectorAll('[cursor="pointer"], [role="button"], button, [tabindex="0"], li'))
      .filter(el => !el.closest('#' + PANEL_ID) && isVisible(el))
      .map(el => {
        const label = normalize([
          el.textContent,
          el.getAttribute('aria-label'),
          el.getAttribute('title'),
          el.id,
          el.className
        ].filter(Boolean).join(' '));
        let score = 0;
        if (skip.test(label)) score -= 100;
        if (el.getAttribute('cursor') === 'pointer') score += 8;
        if (/\blink\b/i.test(label)) score += 5;
        if (/\b(edit|open|element|text|issue)\b/i.test(label)) score += 3;
        if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') score += 1;
        return { el, score, label };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.el);
  }

  async function openCurrentIssueEditor() {
    let input = await waitFor(() => getTextInput(), 1000, 100);
    if (input) return input;

    const candidates = getIssueOpenCandidates();
    for (const candidate of candidates.slice(0, 12)) {
      if (stopRequested) return null;
      realClick(candidate);
      input = await waitFor(() => getTextInput(), 1500, 100);
      if (input) return input;
    }

    return null;
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

  /* --- UDOIT: FIX NONDESCRIPT LINKS --- */
  async function fixAllLinks() {
    if (running) return;
    running = true;
    stopRequested = false;

    let counterEl = await waitFor(() => getIssueCounter(), 800, 100);
    if (!counterEl) {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      if (!rows.length) { setStatus('No rows found'); running = false; return; }

      const linkRow = rows.find(row => /\blink\b/i.test(normalize(row.textContent))) || rows[0];
      const firstClick = linkRow.querySelector('[cursor="pointer"], [role="button"], button, a') || linkRow;
      if (firstClick) realClick(firstClick);
      counterEl = await waitFor(() => getIssueCounter(), 12000);
    }

    const total = parseInt(counterEl?.textContent.match(/of\s+(\d+)/i)?.[1] || '0', 10);
    if (!total) { setStatus('No issues found'); running = false; return; }

    let fixed = 0;
    let skipped = 0;

    for (let i = 0; i < total; i++) {
      if (stopRequested) break;
      setStatus(`Fixing links ${i + 1}/${total}`);

      const input = await openCurrentIssueEditor();
      if (!input) {
        skipped++;
      } else {
        const raw = input.value || input.getAttribute('value') || '';
        const cleaned = getCleanedLinkText(raw);

        if (cleaned) {
          console.log('[UDOIT] fixing link text:', raw, '->', cleaned);
          updateTextInput(input, cleaned);
          await sleep(250);

          const save = await waitFor(() => getEnabledButton('Save'), 5000);
          if (save) {
            realClick(save);
            fixed++;
            await sleep(1000);
          } else {
            skipped++;
          }
        } else {
          console.log('[UDOIT] skipping link text:', raw);
          skipped++;
        }
      }

      if (i < total - 1) {
        const moved = await clickNextIssue();
        if (!moved) break;
      }
    }

    setStatus(stopRequested ? '⛔ Stopped' : `Done: ${fixed} fixed, ${skipped} skipped`);
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
          const fileTitle = getCurrentFileTitle();
          const copiedTitle = await copyTextToClipboard(fileTitle);
          if (fileTitle) {
              setStatus(`Copied: ${fileTitle}`);
              await sleep(copiedTitle ? 250 : 700);
          }

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
