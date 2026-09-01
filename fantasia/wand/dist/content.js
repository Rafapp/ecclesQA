import{R as _,O as Et,g as A,i as pe,S as vt,P as Tt,a as Ct,A as P}from"./assets/remediation-oJeVVoaf.js";function c(e){return String(e??"").replace(/\s+/g," ").trim()}const X="wand-remediation-highlight",_t=5*60*1e3,St=24;let T=null;async function At(){if(!window.location.hostname.endsWith(".instructure.com"))return;const e=await Lt();if(!e||Date.now()-e.createdAt>_t||!Rt(e))return;if(!G()&&$t()){console.info("[wand] Canvas target opened. Entering edit mode before highlighting.");return}const t=G();if(!(t?await Nt(e.previewText):await Mt(e.previewText))){console.info("[wand] Canvas target opened, but no matching preview text was found.",e);return}console.info("[wand] Canvas remediation target highlighted.",{editPage:t})}function It(){var r,i;const e=S().find(a=>{var l;const s=(l=a.contentWindow)==null?void 0:l.getSelection();return!!(s&&!s.isCollapsed&&c(s.toString()))}),t=e?h(e):null,n=(r=e==null?void 0:e.contentWindow)==null?void 0:r.getSelection();return!e||!(t!=null&&t.body)||!n||n.isCollapsed||((i=e.contentWindow)==null||i.focus(),!t.execCommand("bold",!1))?!1:(t.body.dispatchEvent(new InputEvent("input",{bubbles:!0,inputType:"formatBold"})),!0)}async function kt(){const e=Dt();if(!e)return!1;const t={type:Et,url:e},n=await chrome.runtime.sendMessage(t);return(n==null?void 0:n.ok)===!0}async function Lt(){const t=(await chrome.storage.local.get(_))[_];return!t||typeof t!="object"?null:t}function Rt(e){if(G())return!0;const t=c(document.body.innerText||document.body.textContent);return t.includes(e.sourceTitle)||!!(e.previewText&&t.includes(e.previewText))}function Mt(e){return se(e)?Promise.resolve(!0):new Promise(t=>{let n=null;const o=()=>{se(e)&&(n==null||n.disconnect(),document.removeEventListener("load",o,!0),t(!0))};n=new MutationObserver(o),n.observe(document.documentElement,{attributes:!0,childList:!0,characterData:!0,subtree:!0}),document.addEventListener("load",o,!0)})}async function Nt(e){if(qe(e))return we(e,!0)?!0:Bt(e);const t=Y(e);if(!t)return!1;if(De(t,"initial"))return me(t),!0;if(G())return Ot(t);const n=Ut(e),o=se(e,!n);return n||o}function Ot(e){return new Promise(t=>{me(e,()=>t(!0))})}function me(e,t){T==null||T();let n=!1,o=!1,r=null;const i=[],a=new WeakSet,s=new WeakSet,l=()=>{n||(n=!0,r==null||r.disconnect(),document.removeEventListener("load",F,!0),window.removeEventListener("resize",F),i.forEach(u=>u()),T===l&&(T=null))},p=u=>{console.info("[wand] Canvas editor interaction detected; stopping recenter watcher.",{type:u.type}),l()},d=u=>{if(s.has(u))return;s.add(u);const L=u.documentElement||u.body,xe=new MutationObserver(()=>y("editor-mutation"));L&&xe.observe(L,{attributes:!0,childList:!0,characterData:!0,subtree:!0});const Ee=["keydown","mousedown","input","paste"],ve=["load","readystatechange"];Ee.forEach(v=>u.addEventListener(v,p,!0)),ve.forEach(v=>u.addEventListener(v,D,!0)),i.push(()=>{xe.disconnect(),Ee.forEach(v=>u.removeEventListener(v,p,!0)),ve.forEach(v=>u.removeEventListener(v,D,!0))})},E=u=>{a.has(u)||(a.add(u),u.addEventListener("load",D,!0),i.push(()=>u.removeEventListener("load",D,!0)));const L=h(u);L&&d(L)},B=()=>{S().forEach(E)},y=u=>{n||(B(),De(e,u)&&(o||(o=!0,t==null||t())))},F=u=>{y(u.type)},D=u=>{y(`editor-${u.type}`)};r=new MutationObserver(()=>y("page-mutation")),r.observe(document.documentElement,{attributes:!0,childList:!0,subtree:!0}),document.addEventListener("load",F,!0),window.addEventListener("resize",F),T=l,console.info("[wand] Waiting for Canvas editor target.",{frameCount:S().length,targetText:e}),y("start")}function De(e,t){const n=Pt(e);return n?Wt(n,e)?!0:ge(n,e)?(ae(n),!0):ze(n,e)?(ae(n),console.info("[wand] Canvas editor target selected.",{reason:t}),!0):!1:!1}function Pt(e){var r,i;const t=$e(e);if(!t)return null;const n=h(t);if(!(n!=null&&n.body)||n.readyState==="loading")return null;const o=c(((r=n==null?void 0:n.body)==null?void 0:r.innerText)||((i=n==null?void 0:n.body)==null?void 0:i.textContent));return!o||!I(o,e)?null:t}function Wt(e,t){if(!ge(e,t))return!1;const n=ie(e),o=e.contentWindow;if(!n||!o)return!1;const r=n.getBoundingClientRect();if(!r.height&&!r.width)return!1;const i=o.innerHeight||e.clientHeight,a=r.top+r.height/2;return a>=i*.4&&a<=i*.6}function ge(e,t){var r;const n=(r=e.contentWindow)==null?void 0:r.getSelection(),o=c(n==null?void 0:n.toString());return!!(o&&I(o,t))}function ie(e){var n;const t=(n=e.contentWindow)==null?void 0:n.getSelection();return t&&t.rangeCount>0?t.getRangeAt(0):null}function ae(e){var y;const t=e.contentWindow,n=h(e),o=ie(e),r=Yt(e);if(!t||!n||!o||!r)return;const i=o.getBoundingClientRect();if(!i||!i.height&&!i.width)return;const a=Jt(e,r,t),s=Qt(e,r,t),l=r.scrollTop+i.top-(a-i.height)/2,p=r.scrollLeft+i.left-(s-i.width)/2;Ce(n,t,r,p,l);const d=(y=ie(e))==null?void 0:y.getBoundingClientRect();if(!d)return;const E=d.top-(a-d.height)/2,B=d.left-(s-d.width)/2;(Math.abs(E)>1||Math.abs(B)>1)&&Ce(n,t,r,r.scrollLeft+B,r.scrollTop+E)}function Ut(e){const t=Y(e),n=window.find;return!t||typeof n!="function"?!1:(window.focus(),n.call(window,t,!1,!1,!0,!1,!0,!1))}function se(e,t=!0){if(qe(e)&&we(e,t))return!0;const n=Y(e);if(!n)return!1;if(Ht(n,t))return!0;const r=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let i=r.nextNode();for(;i;){const s=i,l=c(s.textContent);if(I(l,n))return zt(s,t),!0;i=r.nextNode()}const a=Gt(n);return a?(he(document),a.id=X,a.classList.add("wand-remediation-highlight"),t&&a.scrollIntoView({behavior:"smooth",block:"center"}),!0):!1}function Bt(e){return new Promise(t=>{const n=Date.now()+15e3,o=()=>{if(we(e,!0)){t(!0);return}if(Date.now()>=n){t(!1);return}window.setTimeout(o,200)};o()})}function we(e,t){const n=c(e).toLowerCase();if(!n)return!1;const o=[document,...S().map(h).filter(r=>!!r)];for(const r of o){const i=Ft(r,n);if(i)return he(r),i.id=X,i.classList.add("wand-remediation-highlight"),t&&i.scrollIntoView({behavior:"smooth",block:"center"}),!0}return!1}function Ft(e,t){return Array.from(e.querySelectorAll("a[href], iframe[src], img[src], video[src], source[src]")).find(o=>["aria-label","title","src","href"].map(i=>c(o.getAttribute(i)).toLowerCase()).filter(Boolean).some(i=>i===t||i.includes(t)||t.includes(i)&&i.length>=12))??null}function Dt(){const e=[document,...S().map(h).filter(n=>!!n)];for(const n of e){const o=n.querySelector(`#${X}, .wand-remediation-highlight`),r=qt(o);if(r)return Te(r)}const t=e.flatMap(n=>Array.from(n.querySelectorAll("iframe[src], video[src], source[src]")));return t.length===1?Te(t[0]):null}function qt(e){return e?e.matches("iframe[src], video[src], source[src]")?e:e.querySelector("iframe[src], video[src], source[src]"):null}function Te(e){var n,o,r;const t=e.getAttribute("src");if(!t)return null;try{const i=new URL(t,window.location.href),a=(n=i.href.match(/(?:entry_id[\/=]|entryId=)([\w-]+)/i))==null?void 0:n[1];if(a)return`https://mediaspace.utah.edu/media/t/${encodeURIComponent(a)}`;const s=i.hostname.includes("youtube")?(o=i.pathname.match(/\/embed\/([\w-]+)/))==null?void 0:o[1]:void 0;if(s)return`https://www.youtube.com/watch?v=${encodeURIComponent(s)}`;const l=i.hostname.includes("vimeo")?(r=i.pathname.match(/(?:video\/)?(\d+)/))==null?void 0:r[1]:void 0;return l?`https://vimeo.com/${l}`:i.protocol==="https:"?i.href:null}catch{return null}}function qe(e){return/^(?:https?:)?\/\//i.test(e.trim())}function Ht(e,t){const n=$e(e);return n?Vt(n,e,t):!1}function G(){return/\/edit(?:$|[?#])/.test(window.location.href)||!!document.querySelector(".ic-RichContentEditor, .tox-tinymce, textarea")}function $t(){const e=document.querySelector("a.edit_assignment_link[href], a.quiz-edit-button[href], a[href$='/edit']");return e?(e.click(),!0):!1}function zt(e,t){const n=e.parentElement;n&&(he(document),n.id=X,n.classList.add("wand-remediation-highlight"),t&&n.scrollIntoView({behavior:"smooth",block:"center"}))}function Gt(e){return He(document,e)}function He(e,t){return Array.from(e.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, span, div, strong, em")).find(o=>I(c(o.innerText||o.textContent),t))??null}function h(e){try{return e.contentDocument}catch{return null}}function $e(e){const t=S();return e?t.find(n=>{var i,a;const o=h(n),r=c(((i=o==null?void 0:o.body)==null?void 0:i.innerText)||((a=o==null?void 0:o.body)==null?void 0:a.textContent));return!!(r&&I(r,e))})??t[0]??null:t[0]??null}function S(){return Array.from(document.querySelectorAll(".tox-edit-area__iframe, iframe[id$='_ifr'], iframe[id^='quiz_description']"))}function Vt(e,t,n=!0){const o=Y(t);return!o||!ze(e,o)?!1:(n&&(ae(e),me(o)),!0)}function jt(e,t){const n=e.contentWindow;if(!n)return!1;const o=n.find;return typeof o!="function"?!1:(n.focus(),o.call(n,t,!1,!1,!0,!1,!0,!1))}function ze(e,t){if(jt(e,t)&&ge(e,t))return!0;const n=Kt(e,t);return n&&console.info("[wand] Canvas editor target selected by DOM range fallback."),n}function Kt(e,t){const n=e.contentWindow,o=h(e),r=o==null?void 0:o.body;if(!n||!o||!r)return!1;const i=Xt(o,r,t);if(!i)return!1;n.focus();const a=n.getSelection();return a==null||a.removeAllRanges(),a==null||a.addRange(i),!0}function Xt(e,t,n){const o=e.createTreeWalker(t,NodeFilter.SHOW_TEXT);let r=o.nextNode();for(;r;){const s=r,l=s.textContent??"",p=l.indexOf(n);if(p>=0){const d=e.createRange();return d.setStart(s,p),d.setEnd(s,p+n.length),d}if(I(c(l),n)){const d=e.createRange();return d.selectNodeContents(s),d}r=o.nextNode()}const i=He(t,n);if(!i)return null;const a=e.createRange();return a.selectNodeContents(i),a}function Yt(e){const t=h(e);return(t==null?void 0:t.scrollingElement)??(t==null?void 0:t.documentElement)??(t==null?void 0:t.body)??null}function Jt(e,t,n){return e.clientHeight||t.clientHeight||n.innerHeight}function Qt(e,t,n){return e.clientWidth||t.clientWidth||n.innerWidth}function Ce(e,t,n,o,r){const i=Math.max(0,n.scrollHeight-n.clientHeight),a=Math.max(0,n.scrollWidth-n.clientWidth),s=_e(r,0,i),l=_e(o,0,a);n.scrollTop=s,n.scrollLeft=l,e.documentElement&&e.documentElement!==n&&(e.documentElement.scrollTop=s,e.documentElement.scrollLeft=l),e.body&&e.body!==n&&(e.body.scrollTop=s,e.body.scrollLeft=l),t.scrollTo(l,s)}function _e(e,t,n){return Math.min(Math.max(e,t),n)}function Y(e){const t=c(e);return t.split(/[.!?]/).map(o=>o.trim()).find(o=>o.length>=St)??t}function I(e,t){if(e.includes(t))return!0;const n=t.toLowerCase().split(/\W+/).filter(i=>i.length>2);if(n.length<5)return!1;const o=new Set(e.toLowerCase().split(/\W+/).filter(Boolean));return n.filter(i=>o.has(i)).length/n.length>=.75}function he(e){if(e.getElementById("wand-highlight-style"))return;const t=e.createElement("style");t.id="wand-highlight-style",t.textContent=`
    .wand-remediation-highlight {
      outline: 4px solid #FFB81D !important;
      outline-offset: 4px !important;
      background: #fef3c7 !important;
    }
  `,e.documentElement.append(t)}const Ge="wand:page-snapshot",Ve="wand:frame-command",je="wand:canvas-saved",Ke="wand:workspace-url",Xe="wand:remediation-error",Ye="wand:action-state",Je="wand:action-success";function Zt(){return window.top===window}function en(e){window.parent.postMessage({type:Ge,snapshot:e},"*")}function tn(e){window.addEventListener("message",t=>{t.source===window||!un(t.data)||e(t.data.snapshot)})}function C(e){var t;for(let n=0;n<window.frames.length;n++)(t=window.frames[n])==null||t.postMessage({type:Ve,command:e},"*")}function ce(){window.parent.postMessage({type:je},"*")}function nn(e){window.addEventListener("message",t=>{pn(t.data)&&e()})}function on(e){window.parent.postMessage({type:Ke,url:e},"*")}function rn(e){window.addEventListener("message",t=>{mn(t.data)&&e(t.data.url)})}function w(e){window.parent.postMessage({type:Xe,message:e},"*")}function an(e){window.addEventListener("message",t=>{gn(t.data)&&e(t.data.message)})}function f(e,t=""){window.parent.postMessage({type:Ye,active:e,label:t},"*")}function sn(e){window.addEventListener("message",t=>{wn(t.data)&&e(t.data.active,t.data.label)})}function U(e){window.parent.postMessage({type:Je,message:e},"*")}function cn(e){window.addEventListener("message",t=>{fn(t.data)&&e(t.data.message)})}function ln(e){window.addEventListener("message",t=>{dn(t.data)&&e(t.data.command)})}function un(e){if(!e||typeof e!="object")return!1;const t=e;return t.type===Ge&&hn(t.snapshot)}function dn(e){var n,o,r,i,a,s,l;if(!e||typeof e!="object")return!1;const t=e;return t.type===Ve&&(((n=t.command)==null?void 0:n.type)==="start-remediation"||((o=t.command)==null?void 0:o.type)==="resolve-remediation"||((r=t.command)==null?void 0:r.type)==="advance-remediation"||((i=t.command)==null?void 0:i.type)==="workspace-opened"||((a=t.command)==null?void 0:a.type)==="apply-color-cue"||((s=t.command)==null?void 0:s.type)==="open-caption-source"||((l=t.command)==null?void 0:l.type)==="refresh-caption-status")}function fn(e){if(!e||typeof e!="object")return!1;const t=e;return t.type===Je&&typeof t.message=="string"&&t.message.length>0&&t.message.length<=240}function pn(e){return!e||typeof e!="object"?!1:e.type===je}function mn(e){if(!e||typeof e!="object")return!1;const t=e;return t.type===Ke&&typeof t.url=="string"&&/^https:\/\/[^/]+\.instructure\.com\//.test(t.url)}function gn(e){if(!e||typeof e!="object")return!1;const t=e;return t.type===Xe&&typeof t.message=="string"&&t.message.length>0&&t.message.length<=240}function wn(e){if(!e||typeof e!="object")return!1;const t=e;return t.type===Ye&&typeof t.active=="boolean"&&typeof t.label=="string"&&t.label.length<=120}function hn(e){if(!e||typeof e!="object")return!1;const t=e;return typeof t.pageKind=="string"&&typeof t.issueCount=="number"&&Array.isArray(t.issues)&&typeof t.url=="string"&&typeof t.observedAt=="number"}let Se=0;function yn(){const e=(t,n)=>{if(!Ae())return;const o=t.target instanceof HTMLElement?t.target:null;if(!o)return;const r=Ie(o);r&&ke()&&(console.info(`[wand] Canvas save ${n}.`,{url:window.location.href,topFrame:window.top===window,text:le(r)}),ce())};document.addEventListener("click",t=>{e(t,"button clicked")},!0),document.addEventListener("pointerup",t=>{e(t,"pointerup")},!0),document.addEventListener("submit",t=>{if(!Ae())return;const n=t.target instanceof HTMLFormElement?t.target:null;if(!n)return;const o=t.submitter,r=o instanceof HTMLElement?Ie(o):bn(n);r&&ke()&&(console.info("[wand] Canvas save form submitted.",{url:window.location.href,topFrame:window.top===window,text:le(r)}),ce())},!0)}function Ae(){return window.location.hostname.endsWith(".instructure.com")&&!/\/external_tools\//.test(window.location.pathname)}function Ie(e){const t=e.closest("button, input[type='submit'], input[type='button'], a[role='button'], a.btn, [role='button']");return!t||Ze(t)?null:Qe(t)?t:null}function bn(e){return Array.from(e.querySelectorAll("button, input[type='submit'], input[type='button'], a[role='button'], a.btn, [role='button']")).find(n=>!Ze(n)&&Qe(n))??null}function Qe(e){return e.classList.contains("save_quiz_button")?!0:/^(save|update)(\b|$)/i.test(le(e))}function le(e){return e instanceof HTMLInputElement?c(e.value||e.getAttribute("aria-label")||e.title):c(e.innerText||e.textContent||e.getAttribute("aria-label")||e.title)}function Ze(e){return e instanceof HTMLButtonElement||e instanceof HTMLInputElement?e.disabled:e.getAttribute("aria-disabled")==="true"}function ke(){const e=Date.now();return e-Se<1500?!1:(Se=e,!0)}const xn=`:root {
  --wand-brand-primary: #BE0000;
  --wand-brand-secondary: #FFB81D;
  --wand-neutral-dark: #242424;
  --wand-neutral-border: #5f5f5f;
  --wand-split: 65vw;
}

#wand-panel {
  position: fixed !important;
  right: 0 !important;
  bottom: 0 !important;
  left: 0 !important;
  z-index: 2147483647 !important;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(130px, 180px) minmax(280px, 1fr) minmax(130px, 180px);
  gap: 16px;
  align-items: center;
  width: 100vw;
  min-height: 72px;
  padding: 10px 20px;
  border: 0;
  border-top: 1px solid #8f0000;
  border-radius: 0;
  background: var(--wand-brand-primary);
  color: #ffffff;
  font: 13px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  box-shadow: 0 6px 18px rgb(0 0 0 / 25%);
  transition: transform 0.2s ease;
}

#wand-panel.wand-panel--collapsed {
  transform: translateY(calc(100%));
}

.wand-panel__toggle {
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 20px;
  border: none;
  border-radius: 8px 8px 0 0;
  background: var(--wand-brand-primary);
  color: #ffffff;
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
  padding: 0;
  outline: none;
}

.wand-panel__toggle:hover {
  color: var(--wand-brand-secondary);
}

.wand-panel__toggle:focus-visible {
  outline: none;
}

#wand-panel * {
  box-sizing: border-box;
}

.wand-panel__header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.wand-panel__icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
}

.wand-panel__label {
  font-size: 16px;
  font-weight: 700;
}

.wand-panel__version {
  justify-self: end;
  padding-right: 12px;
  color: #ffffff;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0;
}

.wand-panel__meta {
  margin-top: 0;
  justify-self: center;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  text-align: center;
  overflow-wrap: anywhere;
}

.wand-panel__main {
  display: grid;
  place-items: center;
  min-height: 44px;
}

.wand-panel__guidance {
  max-width: 820px;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
}

.wand-panel__guidance-group {
  display: grid;
  gap: 5px;
  justify-items: center;
  width: 100%;
}

.wand-panel__busy {
  display: grid;
  gap: 8px;
  width: min(520px, 70vw);
}

.wand-panel__busy-label {
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  text-align: center;
}

.wand-panel__progress {
  position: relative;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgb(255 255 255 / 35%);
}

.wand-panel__progress-indicator {
  position: absolute;
  inset: 0 auto 0 -35%;
  width: 35%;
  border-radius: inherit;
  background: var(--wand-brand-secondary);
  animation: wand-progress 1.1s ease-in-out infinite;
}

@keyframes wand-progress {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(385%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .wand-panel__progress-indicator {
    right: 0;
    left: 0;
    width: 100%;
    animation: none;
  }
}

.wand-panel__supported {
  position: relative;
  width: min(680px, 70vw);
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
}

.wand-panel__supported summary {
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wand-panel__supported ul {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 1;
  display: grid;
  gap: 8px;
  max-height: 240px;
  margin: 0;
  padding: 14px 18px 14px 36px;
  overflow-y: auto;
  border: 1px solid var(--wand-brand-primary);
  border-radius: 6px;
  background: #ffffff;
  color: #242424;
  box-shadow: 0 -8px 24px rgb(0 0 0 / 24%);
  text-align: left;
}

.wand-panel__toast {
  position: fixed;
  right: 20px;
  bottom: 88px;
  z-index: 2147483647;
  width: min(420px, calc(100vw - 40px));
  padding: 12px 16px;
  border: 2px solid var(--wand-brand-primary);
  border-radius: 6px;
  background: #ffffff;
  color: var(--wand-brand-primary);
  box-shadow: 0 8px 28px rgb(0 0 0 / 28%);
  font: 700 14px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.wand-panel__toast--success {
  border-color: #2f6f3e;
  color: #245b32;
}

.wand-panel__text--info {
  color: #ffffff;
}

.wand-panel__text--needed {
  color: var(--wand-brand-secondary);
}

.wand-panel__text--error {
  color: #ffe3e3;
}

.wand-panel__main button {
  width: 100%;
  max-width: 400px;
  min-height: 36px;
  border: 1px solid #ffffff;
  border-radius: 6px;
  background: #ffffff;
  color: var(--wand-brand-primary) !important;
  cursor: pointer;
  font: 700 14px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.wand-panel__workspace-action {
  display: grid;
  grid-template-columns: minmax(280px, auto) minmax(220px, 360px);
  gap: 18px;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.wand-panel__workspace-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(150px, 1fr));
  gap: 6px;
  width: min(620px, 100%);
}

.wand-panel__workspace-controls #wand-resolve-action {
  grid-column: 1 / -1;
  max-width: none;
}

.wand-panel__main .wand-panel__secondary-action {
  border-color: var(--wand-brand-secondary);
  background: var(--wand-brand-secondary);
  color: #242424 !important;
}

.wand-workspace-active body {
  width: var(--wand-split) !important;
  min-width: 420px !important;
  overflow-x: hidden !important;
}

.wand-workspace-active #wand-panel {
  width: 100vw;
}

#wand-workspace {
  position: fixed;
  inset: 0 0 72px var(--wand-split);
  z-index: 2147483646;
  display: grid;
  grid-template-rows: 42px 1fr;
  border-left: 1px solid var(--wand-neutral-border);
  background: var(--wand-neutral-dark);
  box-shadow: -10px 0 28px rgb(0 0 0 / 28%);
}

#wand-workspace-resizer {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -4px;
  width: 8px;
  cursor: col-resize;
  z-index: 1;
}

#wand-workspace-resizer::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 3px;
  width: 2px;
  background: var(--wand-neutral-border);
  transition: background 0.15s;
}

#wand-workspace-resizer:hover::after {
  background: var(--wand-brand-primary);
}

.wand-workspace__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid var(--wand-neutral-border);
  color: #ffffff;
  font: 600 13px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.wand-workspace__header button {
  min-height: 28px;
  border: 1px solid #ffffff;
  border-radius: 6px;
  background: var(--wand-brand-primary);
  color: #ffffff;
  cursor: pointer;
  font: 600 12px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

#wand-workspace-frame {
  width: 100%;
  height: 100%;
  border: 0;
  background: #ffffff;
}

.wand-remediation-highlight {
  outline: 4px solid var(--wand-brand-secondary);
  outline-offset: 4px;
  background: #fef3c7;
}
`,Le="wand-panel",Re="wand-panel-style",et="wand-remediate-action",tt="wand-resolve-action",nt="wand-panel-toggle",En="Wand",vn="Version 1.1.0",Tn=chrome.runtime.getURL("icons/48.png"),Cn="wand-panel--collapsed",Me="wand-panel-toast",ot="data-wand-workspace-action";let rt=!1,ye=null,R=!1,it=!1,ue="Working…";function _n(e,t,n){Un();const o=document.getElementById(Le);if(o instanceof HTMLElement)return Ne(o),o;const r=document.createElement("aside");r.id=Le,r.style.position="relative";const i=document.createElement("button");return i.id=nt,i.className="wand-panel__toggle",i.setAttribute("aria-label","Toggle Wand panel"),i.textContent="▲",i.addEventListener("click",()=>{R=!R,r.classList.toggle(Cn,R),i.textContent=R?"▲":"▼",i.setAttribute("aria-label",R?"Expand Wand panel":"Collapse Wand panel")}),r.append(i),document.addEventListener("pointerdown",a=>{Pn(r,a.target)}),(e||t)&&r.addEventListener("click",a=>{const s=a.target instanceof HTMLElement?a.target:null;(s==null?void 0:s.id)===et&&(e==null||e()),(s==null?void 0:s.id)===tt&&(t==null||t());const l=s==null?void 0:s.getAttribute(ot);l&&(n==null||n(l))}),window.addEventListener("wand:workspace-state",a=>{var l;rt=a instanceof CustomEvent?!!((l=a.detail)!=null&&l.active):!1,J(r,ye)}),Ne(r),document.documentElement.append(r),r}function Ne(e){e.setAttribute("aria-label","Wand extension status"),J(e,null)}function q(e,t){e.setAttribute("aria-label","Wand extension status"),ye=t,J(e,t)}function J(e,t){const n=e.querySelector(`#${nt}`);e.replaceChildren(Sn(),An(t),kn()),n instanceof HTMLElement&&e.prepend(n)}function Sn(){const e=document.createElement("div");e.className="wand-panel__header";const t=document.createElement("img");t.className="wand-panel__icon",t.src=Tn,t.alt="";const n=document.createElement("div");return n.className="wand-panel__label",n.textContent=En,e.replaceChildren(t,n),e}function An(e){const t=document.createElement("div");if(t.className="wand-panel__main",it)return t.append(Mn()),t;if(rt)return t.append(In(e)),t;if(!e||e.pageKind!=="udoit")return t.append(V("Wand ready","info")),t;if(e.udoitView==="scorecard")return t.append(H("Please select an issue type to use Wand.","needed")),t;if(e.udoitView==="fixModal"&&e.activeIssueType&&!pe(e.activeIssueType))return t.append(H("Format issue not supported yet. If you'd like support, flag it to the team!","error")),t;if(e.udoitView==="fixModal"&&!e.remediation)return t.append(H("Wand couldn't identify this format issue. Please flag it to the team!","error")),t;if(!e.remediation)return t.append(H("Open a Review item to remediate it with Wand.","needed")),t;const n=document.createElement("button");return n.id=et,n.type="button",n.textContent=Wn(e.remediation.issueType),t.append(n),t}function In(e){const t=document.createElement("div");t.className="wand-panel__workspace-action";const n=e!=null&&e.remediation?A(e.remediation.issueType):void 0,o=V((n==null?void 0:n.workspaceGuidance)??"Complete the remediation in Canvas, then save your change.","needed"),r=document.createElement("button");r.id=tt,r.type="button",r.textContent="Mark as resolved and go to next";const i=document.createElement("div");i.className="wand-panel__workspace-controls";for(const a of(n==null?void 0:n.workspaceActions)??[]){const s=document.createElement("button");s.type="button",s.className="wand-panel__secondary-action",s.setAttribute(ot,a.action),s.textContent=a.label,i.append(s)}return i.append(r),t.replaceChildren(o,i),t}function kn(){const e=document.createElement("div");return e.className="wand-panel__version",e.textContent=vn,e}function V(e,t){const n=document.createElement("div");return n.className=`wand-panel__guidance wand-panel__text--${t}`,n.textContent=e,n}function H(e,t){const n=document.createElement("div");return n.className="wand-panel__guidance-group",n.replaceChildren(V(e,t),Ln()),n}function Ln(){const e=document.createElement("details");e.className="wand-panel__supported";const t=document.createElement("summary");t.textContent=Rn();const n=document.createElement("ul");for(const o of vt){const r=document.createElement("li");r.textContent=o,n.append(r)}return e.replaceChildren(t,n),e}function Rn(){return"In development: Click to show current remediation support"}function b(e,t,n="Working…"){it=t,ue=n||"Working…",e.setAttribute("aria-busy",String(t)),J(e,ye)}function Mn(){const e=document.createElement("div");e.className="wand-panel__busy";const t=document.createElement("div");t.className="wand-panel__busy-label",t.textContent=ue;const n=document.createElement("div");n.className="wand-panel__progress",n.setAttribute("role","progressbar"),n.setAttribute("aria-label",ue);const o=document.createElement("div");return o.className="wand-panel__progress-indicator",n.append(o),e.replaceChildren(t,n),e}function Nn(e){at(e,"error")}function On(e){at(e,"success")}function at(e,t){var o;(o=document.getElementById(Me))==null||o.remove();const n=document.createElement("div");n.id=Me,n.className=`wand-panel__toast wand-panel__toast--${t}`,n.setAttribute("role",t==="error"?"alert":"status"),n.textContent=e,document.documentElement.append(n),window.setTimeout(()=>n.remove(),7e3)}function Pn(e,t){const n=e.querySelector(".wand-panel__supported[open]");!n||t instanceof Node&&n.contains(t)||(n.open=!1)}function Wn(e){var t;return((t=A(e))==null?void 0:t.actionLabel)??"Remediate current issue"}function Un(){if(document.getElementById(Re))return;const e=document.createElement("style");e.id=Re,e.textContent=xn,document.documentElement.append(e)}const st="textarea, input[type='text'], input:not([type])";function ct(){return Array.from(document.querySelectorAll("[role='dialog']")).find(Q)??null}function lt(e){const t=e.id?document.querySelector(`label[for="${CSS.escape(e.id)}"]`):null;return c((t==null?void 0:t.innerText)||(t==null?void 0:t.textContent)||e.getAttribute("aria-label")||e.getAttribute("placeholder"))}function ut(e,t){var r;const n=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,o=(r=Object.getOwnPropertyDescriptor(n,"value"))==null?void 0:r.set;o?o.call(e,t):e.value=t,e.setAttribute("value",t),e.dispatchEvent(new InputEvent("input",{bubbles:!0,composed:!0,data:t,inputType:"insertText"})),e.dispatchEvent(new Event("change",{bubbles:!0,composed:!0}))}function Q(e){const t=e.getBoundingClientRect(),n=window.getComputedStyle(e);return t.width>0&&t.height>0&&n.display!=="none"&&n.visibility!=="hidden"}const Bn=/^(?:scan video for caption updates|check captions again|refresh caption(?:ing)? status)$/i;async function Fn(){f(!0,"Checking captions again…");try{const e=Array.from(document.querySelectorAll("button, [role='button']")).find(t=>Q(t)&&Bn.test(c(t.innerText||t.textContent)));if(!e||e.getAttribute("aria-disabled")==="true"||e instanceof HTMLButtonElement&&e.disabled){w("Wand couldn't find UDOIT's caption refresh control. Please flag this to the team.");return}e.click(),await Dn(800),U("UDOIT is checking the video captions again.")}finally{f(!1)}}function Dn(e){return new Promise(t=>window.setTimeout(t,e))}const qn={pollIntervalMs:250},Hn={timeouts:qn},$n=Hn,zn=$n.timeouts.pollIntervalMs,Gn=/\bfound in\s*:/i,Vn=/\b(ulearn|accessibility guide|learn more)\b/i,jn=/^(close|save|previous issue|next issue|html|expand preview|manual resolution)$/i;function Kn(e,t=""){var o;const n=be(e,t);return((o=n[0])==null?void 0:o.score)>=60?n[0].control:null}function Xn(e){var n;const t=be(e,"");return((n=t[0])==null?void 0:n.score)>=60?t[0].label:""}function Yn(e,t){return be(e,t).map(({label:n,score:o})=>({label:n,score:o}))}function be(e,t){const n=c(t).toLowerCase();return Array.from(e.querySelectorAll("button, [role='button']")).map(r=>Jn(r,n)).filter(r=>!!r).sort((r,i)=>i.score-r.score)}function Jn(e,t){const n=Qn(e);if(!n||Zn(e,n))return null;const o=n.toLowerCase();let r=0;t&&o===t?r+=140:t&&(o.includes(t)||t.includes(o))&&(r+=90);const i=eo(e,to(e));return i!==null&&(r+=120-i*10),/\b(page|assignment|discussion|quiz|module|syllabus|announcement)\b/i.test(n)&&(r+=10),{control:e,label:n,score:r}}function Qn(e){return c(e.innerText||e.textContent||e.getAttribute("aria-label")||e.title)}function Zn(e,t){return jn.test(t)||Vn.test(t)||e.getAttribute("data-popover-trigger")==="true"?!0:!!e.querySelector("svg[name='IconInfo']")}function eo(e,t){let n=e,o=0;for(;n&&o<=5;){const r=c(n.innerText||n.textContent);if(Gn.test(r)&&r.length<=500)return o;if(n===t)break;n=n.parentElement,o++}return null}function to(e){return e.closest("[role='dialog']")??e.parentElement??e}const no="tbody tr, [role='row']",oo="li, [role='status'], [aria-live], [class*='pagination' i], [class*='counter' i]",dt=/\b(issue|error|warning|alt text|alternative text|heading|link text|caption|table|color|contrast|bold|underline|list|image|video)\b/i,ft=/\b(0|no)\s+(issues?|errors?|warnings?)\b|\bno accessibility issues\b/i,pt=/\b(page headings|pdf|links|color|video captions|excel|images|ms word)\b/i,ro=/\b(?:issue|file)\s+\d+\s+of\s+(\d+)\b/i,io=/\b\d+\s*[-–]\s*\d+\s+of\s+(\d+)\b/i,ao=/\b(\d+)\s+(?:issues?|errors?|warnings?)\b/i,so=/\bIssue\s+(\d+)\s+of\s+(\d+)\b/i,co=20;let M=null,Oe=0,Pe="";function ee(e){const t=()=>{const n=lo(),o=Po(n);o!==Pe&&(Pe=o,console.info("[wand] Detector snapshot",n),e(n))};t(),M==null||M.disconnect(),M=new MutationObserver(()=>{window.clearTimeout(Oe),Oe=window.setTimeout(t,zn)}),M.observe(document.documentElement,{attributes:!0,childList:!0,subtree:!0})}function lo(){const e=uo(),t=e==="udoit"?wo():null,n=t?go(t):void 0,o=t&&n&&pe(n)?mo(t,n):void 0,r=e==="udoit"?po(t):void 0,i=e==="udoit"?fo(o):[],a=e==="udoit"?To(i):0;return{pageKind:e,udoitView:r,activeIssueType:n,issueCount:a,issues:i,remediation:o,url:window.location.href,observedAt:Date.now()}}function uo(){const e=window.location.hostname.toLowerCase();return e==="udoit3.ciditools.com"?"udoit":e.endsWith(".instructure.com")?"canvas":"unknown"}function fo(e){if(e)return[{label:`${e.sourceTitle} - ${e.issueType}`,source:"fixModal"}];const t=mt();if(t.length)return t;const n=Array.from(document.querySelectorAll(no)),o=[],r=new Set;for(const i of n){if(o.length>=co)break;if(!x(i)||k(i))continue;const a=Mo(i);!a||r.has(a)||!Lo(a)||(r.add(a),o.push({label:a,source:No(i)}))}return o}function po(e){return e?"fixModal":bo()?"issueList":gt()?"scorecard":document.querySelector("tbody tr button")?"issueList":"unknown"}function mo(e,t){const n=yo(e),o=Eo(e),{issueIndex:r,issueTotal:i}=vo(e),a=A(t);if(!(!n||!o&&(a==null?void 0:a.requiresPreview)!==!1))return{issueType:t,sourceTitle:n,sourceKind:xo(e),issueIndex:r,issueTotal:i,previewText:o}}function go(e){const t=Array.from(e.querySelectorAll("h1, h2, h3, [data-cid='Heading']")).map(i=>c(i.innerText||i.textContent)).filter(Boolean),n=Array.from(e.querySelectorAll("span, p")).map(i=>c(i.innerText||i.textContent)).filter(Boolean),o=[...t,...n],r=o.find(pe);return r||(o.find(ho)??"")}function wo(){return Array.from(document.querySelectorAll("[role='dialog']")).find(x)??null}function ho(e){return e.length<8||e.length>240||/^(review|ufixit|manual resolution|html|expand preview|issue \d+ of \d+)$/i.test(e)?!1:dt.test(e)}function yo(e){return Xn(e)}function bo(){return Array.from(document.querySelectorAll("button, [role='button'], a[href]")).some(t=>x(t)&&c(t.innerText||t.textContent)==="Review")}function xo(e){const t=e.querySelector("[data-cid='Pill']");return c((t==null?void 0:t.innerText)||(t==null?void 0:t.textContent))}function Eo(e){const t=e.querySelector(".highlighted"),n=c((t==null?void 0:t.innerText)||(t==null?void 0:t.textContent));if(n)return n;const o=t!=null&&t.matches("a[href], iframe[src], img[src], video[src], source[src]")?t:t==null?void 0:t.querySelector("a[href], iframe[src], img[src], video[src], source[src]");return c((o==null?void 0:o.getAttribute("aria-label"))||(o==null?void 0:o.getAttribute("title"))||(o==null?void 0:o.getAttribute("src"))||(o==null?void 0:o.getAttribute("href")))}function vo(e){const t=c(e.innerText||e.textContent).match(so);return t?{issueIndex:Number(t[1]),issueTotal:Number(t[2])}:{issueIndex:null,issueTotal:null}}function To(e){const t=_o();if(t!==null)return t;const n=Co();return n!==null?n:ko()?0:e.length}function Co(){const e=Array.from(document.querySelectorAll(oo));for(const t of e){if(!x(t)||k(t))continue;const n=We(c(t.innerText||t.textContent));if(n!==null)return n}return We(c(document.body.innerText||document.body.textContent))}function _o(){const e=mt();return e.length?e.reduce((t,n)=>t+n.count,0):Ao()}function mt(){const e=gt();if(!e)return[];const t=Array.from(e.querySelectorAll("tbody tr")),n=[];for(const o of t){if(!x(o)||k(o))continue;const r=So(o);r&&n.push(r)}return n}function gt(){return Array.from(document.querySelectorAll("table")).find(t=>{var o,r;if(!x(t)||k(t))return!1;const n=c(((o=t.querySelector("thead"))==null?void 0:o.innerText)||((r=t.rows[0])==null?void 0:r.innerText));return/\bissue type\b/i.test(n)&&/\bissue count\b/i.test(n)})??null}function So(e){const t=Array.from(e.cells).map(o=>c(o.innerText||o.textContent)).filter(Boolean);if(t.length<2||!pt.test(t[0]))return null;const n=Number(t[1]);return!Number.isFinite(n)||n<=0?null:{label:`${t[0]} ${n}`,source:"scorecard",count:n}}function Ao(){const e=Array.from(document.querySelectorAll("[role='row']"));let t=0,n=0;for(const o of e){if(!x(o)||k(o))continue;const r=Io(o);r!==null&&(t+=r,n++)}return n>=3?t:null}function Io(e){const t=Array.from(e.querySelectorAll("th, td, [role='cell'], [role='columnheader']")).map(o=>c(o.innerText||o.textContent)).filter(Boolean);if(t.length<2||!pt.test(t[0]))return null;const n=Number(t[1]);return Number.isFinite(n)?n:null}function ko(){return Array.from(document.querySelectorAll("[role='status'], [aria-live], [class*='empty' i], [class*='alert' i]")).some(t=>!x(t)||k(t)?!1:ft.test(c(t.innerText||t.textContent)))}function We(e){const t=e.match(ro);if(t)return Number(t[1]);const n=e.match(io);if(n)return Number(n[1]);const o=e.match(ao);return o?Number(o[1]):null}function Lo(e){return ft.test(e)?!1:/\ban error occurred while checking this file\b/i.test(e)?!0:dt.test(e)&&!Ro(e)}function Ro(e){return/\breview\b/i.test(e)&&!/\b(error|issue|warning)\b/i.test(e)}function Mo(e){return c(e.innerText||e.textContent).slice(0,220)}function No(e){const t=e.tagName.toLowerCase(),n=e.getAttribute("role"),o=Oo(e);return[t,n?`[role="${n}"]`:"",o?`.${o.split(" ").join(".")}`:""].join("")}function Oo(e){return typeof e.className=="string"?c(e.className):c(e.getAttribute("class"))}function x(e){const t=e.getBoundingClientRect(),n=window.getComputedStyle(e);return t.width>0&&t.height>0&&n.display!=="none"&&n.visibility!=="hidden"}function k(e){return!!e.closest("#wand-panel")}function Po(e){return JSON.stringify({pageKind:e.pageKind,activeIssueType:e.activeIssueType,issueCount:e.issueCount,issues:e.issues.map(t=>t.label),remediation:e.remediation,udoitView:e.udoitView,url:e.url})}const Ue="wand-window-open-capture-script",Wo="wand:capture-next-window-open",Uo="wand:captured-window-open";let W=null;function Bo(){W==null||W()}async function Fo(e){var t;f(!0,((t=A(e.issueType))==null?void 0:t.busyLabel)??"Opening Canvas remediation…");try{const n=Ho(),o=n?Kn(n,e.sourceTitle):null;if(!n||!o){te("source-control-not-found","Wand couldn't find the Canvas source for this issue.",e,{candidates:n?Yn(n,e.sourceTitle):[]});return}const r={...e,createdAt:Date.now()};await chrome.storage.local.set({[_]:r});const i={type:Tt};await chrome.runtime.sendMessage(i);const a=await Do(o);if(!a){await chrome.storage.local.remove(_),te("canvas-url-not-captured","Wand couldn't open the Canvas source for this issue.",e,{selectedControl:c(o.innerText||o.textContent)});return}a.url&&on(a.url),console.info("[wand] Remediation source verified.",{issueType:e.issueType,sourceTitle:e.sourceTitle,selectedControl:c(o.innerText||o.textContent),route:a.route,canvasUrl:a.url})}catch(n){await chrome.storage.local.remove(_),te("unexpected-start-error","Wand couldn't start this remediation.",e,{error:n instanceof Error?n.message:String(n)})}finally{f(!1)}}async function Do(e){if(!await qo())return null;const n=crypto.randomUUID(),o=new Promise(r=>{let i=!1;const a=p=>{i||(i=!0,window.clearTimeout(s),window.removeEventListener("message",l),W=null,r(p))},s=window.setTimeout(()=>{a(null)},1e4),l=p=>{var E;if(p.source!==window||((E=p.data)==null?void 0:E.type)!==Uo||p.data.token!==n)return;const d=$o(p.data.url);d&&a({route:"captured",url:d})};W=()=>a({route:"background"}),window.addEventListener("message",l)});return window.postMessage({type:Wo,token:n},"*"),e.click(),o}function qo(){return document.getElementById(Ue)?Promise.resolve(!0):new Promise(e=>{const t=document.createElement("script");t.id=Ue,t.src=chrome.runtime.getURL("windowOpenCapture.js"),t.onload=()=>e(!0),t.onerror=()=>e(!1),document.documentElement.append(t)})}function Ho(){return Array.from(document.querySelectorAll("[role='dialog']")).find(t=>{const n=t.getBoundingClientRect(),o=window.getComputedStyle(t);return n.width>0&&n.height>0&&o.display!=="none"&&o.visibility!=="hidden"})??null}function te(e,t,n,o={}){console.error("[wand] Remediation failed.",{code:e,issueType:n.issueType,sourceTitle:n.sourceTitle,...o}),w(t)}function $o(e){if(typeof e!="string"||!e)return null;try{const t=new URL(e,window.location.href);return/^https:\/\/[^/]+\.instructure\.com\//.test(t.href)?t.href:null}catch{return null}}const zo=/\.(?:pdf|docx?|pptx?|xlsx?|csv|txt|rtf|odt|ods|odp|html?|zip)\s*$/i,Go=/\s*(?:[-–—_]\s*)?(?:copy(?:\s*\d+)?|\(\s*\d+\s*\)|[-_]\s*\d+)\s*$/i;function Vo(e){let t=Xo(e.trim());return t?(t=t.replace(/\\_/g,"_"),t=t.replace(/_+/g," "),t=Ko(t),t=t.replace(Go,""),t=t.replace(/\s+[-–—]\s*/g," - "),t=t.replace(/\s*[-–—]\s+/g," - "),t=t.replace(/\s+([,.;:!?])/g,"$1"),t=t.replace(/\(\s+/g,"(").replace(/\s+\)/g,")"),t=t.replace(/\s+/g," ").trim(),t):""}function jo(e){const t=e.trim();if(!t||Yo(t)||Jo(t))return null;const n=Vo(t);return n&&n!==t?n:null}function Ko(e){let t=e;for(let n=0;n<3;n++){const o=t.replace(zo,"").trim();if(o===t)break;t=o}return t}function Xo(e){if(!/%[0-9a-f]{2}/i.test(e))return e;try{return decodeURIComponent(e)}catch{return e}}function Yo(e){return/^(?:https?|ftp|mailto):/i.test(e)||/^www\./i.test(e)||/[a-z0-9.-]+\.(?:com|org|edu|gov|net)(?:[/?#:]|$)/i.test(e)}function Jo(e){return/^(?:click here|here|link|learn more|more|read more|download)$/i.test(e.trim())}async function Qo(e){f(!0,"Improving link text…");try{const t=ct(),n=t?Zo(t):null;if(!n){ne("link-input-not-found","Wand couldn't find UDOIT's New Link Text field.",e);return}const o=n.value||n.getAttribute("value")||"",r=jo(o);if(!r){ne("no-safe-link-suggestion","Wand couldn't create a safe link-text suggestion from this value.",e,{original:o});return}if(n.focus(),n.select(),ut(n,r),n.setSelectionRange(r.length,r.length),n.blur(),n.value!==r){ne("link-input-update-failed","Wand couldn't update UDOIT's New Link Text field.",e,{original:o,expected:r,actual:n.value});return}console.info("[wand] Link text suggestion applied.",{issueType:e.issueType,original:o,suggestion:r}),U("Suggested link text was applied. Review it before saving.")}finally{f(!1)}}function Zo(e){var o;const n=Array.from(e.querySelectorAll(st)).filter(r=>!r.disabled&&!r.readOnly&&Q(r)).map(r=>({input:r,score:er(r)})).sort((r,i)=>i.score-r.score);return((o=n[0])==null?void 0:o.score)>=50?n[0].input:null}function er(e){var a,s;const t=c(e.id).toLowerCase(),n=c(e.getAttribute("name")).toLowerCase(),o=lt(e).toLowerCase(),r=c(((a=e.parentElement)==null?void 0:a.innerText)||((s=e.parentElement)==null?void 0:s.textContent)).toLowerCase();let i=0;return(t==="textinputvalue"||n==="textinputvalue")&&(i+=120),o.includes("new link text")&&(i+=100),r.includes("new link text")&&(i+=50),e instanceof HTMLTextAreaElement&&(i+=10),i}function ne(e,t,n,o={}){console.error("[wand] Link remediation failed.",{code:e,issueType:n.issueType,sourceTitle:n.sourceTitle,...o}),w(t)}const tr=/\.(?:avif|bmp|gif|heic|jpe?g|png|svg|tiff?|webp)\s*$/i,nr=/\s*(?:copy(?:\s*\d+)?|\(\s*\d+\s*\))\s*$/i;function or(e){const t=e.trim();if(!t)return null;let n=rr(t).split(/[?#]/,1)[0];return n=n.split(/[\\/]/).pop()??n,n=n.replace(tr,""),n=n.replace(/\\_/g,"_"),n=n.replace(/[_-]+/g," "),n=n.replace(nr,""),n=n.replace(/\s+/g," ").trim(),n=n.replace(new RegExp("^\\p{Ll}","u"),o=>o.toUpperCase()),n&&n!==t?n:null}function rr(e){if(!/%[0-9a-f]{2}/i.test(e))return e;try{return decodeURIComponent(e)}catch{return e}}async function ir(e){f(!0,"Improving alternative text…");try{const t=ct(),n=t?ar(t):null;if(!n){oe("alt-input-not-found","Wand couldn't find UDOIT's alternative-text field.",e);return}const o=n.value||n.getAttribute("value")||"",r=or(o);if(!r){oe("no-safe-alt-suggestion","Wand couldn't create an alternative-text suggestion from this filename.",e,{original:o});return}if(n.focus(),n.select(),ut(n,r),n.setSelectionRange(r.length,r.length),n.blur(),n.value!==r){oe("alt-input-update-failed","Wand couldn't update UDOIT's alternative-text field.",e,{original:o,expected:r,actual:n.value});return}console.info("[wand] Alternative-text suggestion applied.",{issueType:e.issueType,original:o,suggestion:r}),U("Suggested alternative text was applied. Review it before saving.")}finally{f(!1)}}function ar(e){var n;const t=Array.from(e.querySelectorAll(st)).filter(o=>!o.disabled&&!o.readOnly&&Q(o)).map(o=>({input:o,score:sr(o)})).sort((o,r)=>r.score-o.score);return((n=t[0])==null?void 0:n.score)>=80?t[0].input:null}function sr(e){var a,s;const t=c(e.id).toLowerCase(),n=c(e.getAttribute("name")).toLowerCase(),o=lt(e).toLowerCase(),r=c(((a=e.parentElement)==null?void 0:a.innerText)||((s=e.parentElement)==null?void 0:s.textContent)).toLowerCase();let i=0;return(t==="alttextinput"||n==="alttextinput")&&(i+=140),(o.includes("alternative text")||o.includes("alt text"))&&(i+=120),r.includes("edit alternative text")&&(i+=80),i}function oe(e,t,n,o={}){console.error("[wand] Alternative-text remediation failed.",{code:e,issueType:n.issueType,sourceTitle:n.sourceTitle,...o}),w(t)}const de="wand-workspace",wt="wand-workspace-frame",cr="wand-workspace-close",lr="wand-workspace-resizer",ur=20,dr=80;function fr(){chrome.runtime.onMessage.addListener(e=>(e.type!==Ct||yt(e.url),!1))}function ht(){var e;document.documentElement.classList.remove("wand-workspace-active"),bt(!1),(e=document.getElementById(de))==null||e.remove()}function yt(e){const n=pr().querySelector(`#${wt}`);n&&(document.documentElement.classList.add("wand-workspace-active"),bt(!0),n.src=e,window.setTimeout(()=>gr(),350))}function pr(){const e=document.getElementById(de);if(e instanceof HTMLElement)return e;const t=document.createElement("section");return t.id=de,t.setAttribute("aria-label","Wand remediation workspace"),t.replaceChildren(wr(t),mr(),hr()),document.documentElement.append(t),t}function mr(){const e=document.createElement("div");e.className="wand-workspace__header";const t=document.createElement("div");t.className="wand-workspace__title",t.textContent="Canvas remediation";const n=document.createElement("button");return n.id=cr,n.type="button",n.textContent="Close",n.addEventListener("click",ht),e.replaceChildren(t,n),e}function bt(e){window.dispatchEvent(new CustomEvent("wand:workspace-state",{detail:{active:e}}))}function gr(){const e=document.querySelector("[role='dialog']");e==null||e.scrollIntoView({behavior:"smooth",block:"center",inline:"center"})}function wr(e){const t=document.createElement("div");return t.id=lr,t.setAttribute("aria-hidden","true"),t.addEventListener("pointerdown",n=>{n.preventDefault(),t.setPointerCapture(n.pointerId);const o=i=>{const a=Math.min(dr,Math.max(ur,i.clientX/window.innerWidth*100));e.style.left=`${a}vw`,document.documentElement.style.setProperty("--wand-split",`${a}vw`)},r=()=>{t.removeEventListener("pointermove",o),t.removeEventListener("pointerup",r)};t.addEventListener("pointermove",o),t.addEventListener("pointerup",r)}),t}function hr(){const e=document.createElement("iframe");return e.id=wt,e.title="Canvas remediation target",e.referrerPolicy="strict-origin-when-cross-origin",e}const Be="wandEnabled",$=Zt();let re=!1,m=null,g=null,N=!1,O="";yr();async function yr(){if((await chrome.storage.local.get(Be))[Be]===!1){console.info("[wand] Wand is turned off for UDOIT and Canvas pages.");return}console.info("[wand] Content script loaded.",{topFrame:$,url:window.location.href}),yn(),At(),fr();const t=$?_n(()=>{b(t,!0,xr(g==null?void 0:g.remediation)),C({type:"start-remediation"})},()=>{b(t,!0,"Marking as resolved and loading the next issue…"),C({type:"resolve-remediation"})},r=>{b(t,!0,{"apply-color-cue":"Adding a non-color cue…","open-caption-source":"Opening the video platform…","refresh-caption-status":"Checking captions again…"}[r]),C({type:r})}):null;$&&window.addEventListener("wand:workspace-state",r=>{var i;N=r instanceof CustomEvent&&!!((i=r.detail)!=null&&i.active),O=N?Z(g==null?void 0:g.remediation):"",N&&(C({type:"workspace-opened"}),t&&(g&&q(t,g),b(t,!1)))}),t?(rn(r=>{yt(r)}),an(r=>{b(t,!1),Nn(r)}),sn((r,i)=>{b(t,r,i)}),cn(r=>{b(t,!1),On(r)}),nn(()=>{b(t,!0,"Saving and loading the next issue…"),console.info("[wand] Canvas save signal received in top frame.",{url:window.location.href,hasDialog:!!document.querySelector("[role='dialog']")}),Er()}),tn(r=>{if(r.pageKind==="udoit"){g=r,q(t,r),br(r.remediation);return}N||q(t,r)}),ee(r=>{q(t,r)})):$?ee(()=>{}):(window.location.hostname==="udoit3.ciditools.com"&&(Cr(),z()),ln(r=>{r.type==="start-remediation"&&(m!=null&&m.remediation)&&xt(m.remediation),r.type==="advance-remediation"&&((m==null?void 0:m.pageKind)==="udoit"||window.location.hostname==="udoit3.ciditools.com")&&z(),r.type==="resolve-remediation"&&window.location.hostname==="udoit3.ciditools.com"&&vr(),r.type==="workspace-opened"&&window.location.hostname==="udoit3.ciditools.com"&&Bo(),r.type==="refresh-caption-status"&&window.location.hostname==="udoit3.ciditools.com"&&Fn(),r.type==="apply-color-cue"&&window.location.hostname.endsWith(".instructure.com")&&n(),r.type==="open-caption-source"&&window.location.hostname.endsWith(".instructure.com")&&o()}),ee(r=>{m=r,en(r),r.pageKind==="udoit"&&z()}));function n(){if(f(!0,"Adding a non-color cue…"),!It()){w("Wand couldn't find selected Canvas text. Select the color-only text, then try again."),f(!1);return}U("Bold was added as a non-color cue. Review the result, then save in Canvas."),f(!1)}async function o(){f(!0,"Opening the video platform…");try{if(!await kt()){w("Wand couldn't identify the embedded video's platform. Open it from Canvas and flag this to the team.");return}U("The video platform opened in a new tab.")}finally{f(!1)}}}function br(e){if(!N||!e)return;const t=Z(e);if(!t||!O){O=t;return}t!==O&&(O=t,console.info("[wand] UDOIT issue changed while workspace was open. Synchronizing Canvas remediation.",{issueType:e.issueType,sourceTitle:e.sourceTitle,issueIndex:e.issueIndex}),C({type:"start-remediation"}))}function xr(e){var t;return e?((t=A(e.issueType))==null?void 0:t.busyLabel)??"Opening Canvas remediation…":"Opening Canvas remediation…"}function xt(e){var n;const t=(n=A(e.issueType))==null?void 0:n.workflow;return t==="linkText"?Qo(e):t==="imageAlt"?ir(e):Fo(e)}async function Er(){await chrome.storage.local.set({[P]:Date.now()}),await chrome.storage.local.remove(_),ht(),C({type:"advance-remediation"})}async function vr(){f(!0,"Marking as resolved and loading the next issue…");let e=!1;try{const t=await K(()=>Tr("span","Manual Resolution"),5e3,200);if(!t){console.error("[wand] Manual Resolution control was not found."),w("Wand couldn't find UDOIT's Manual Resolution control.");return}let n=Fe();if(n||(fe(t),n=await K(Fe,5e3,200)),!n){console.error("[wand] Manual Resolution confirmation was not found."),w("Wand couldn't confirm the manual resolution in UDOIT.");return}n.checked||(fe(n),await j(800)),ce(),e=!0}finally{e||f(!1)}}function Fe(){const e=Array.from(document.querySelectorAll("label")).find(o=>c(o.textContent).includes("confirm this content"));if(!e)return null;const t=e.htmlFor,n=t?document.getElementById(t):e.querySelector("input[type='checkbox']");return n instanceof HTMLInputElement&&n.type==="checkbox"?n:null}function Tr(e,t){return Array.from(document.querySelectorAll(e)).find(n=>c(n.textContent)===t)??null}function Cr(){chrome.storage.onChanged.addListener((e,t)=>{var n;t!=="local"||!((n=e[P])!=null&&n.newValue)||z()})}async function z(){if(!(window.location.hostname!=="udoit3.ciditools.com"||re||!(await chrome.storage.local.get(P))[P])){re=!0;try{const t=Z(m==null?void 0:m.remediation);await Sr()&&(await chrome.storage.local.remove(P),await _r(t))}finally{re=!1}}}async function _r(e){const t=await K(()=>{const n=m==null?void 0:m.remediation;return n&&Z(n)!==e?n:null},15e3,200);if(!t){console.info("[wand] Advanced UDOIT issue, but no next remediation became available."),f(!1);return}console.info("[wand] Launching next Canvas remediation.",{issueType:t.issueType,sourceTitle:t.sourceTitle,issueIndex:t.issueIndex}),await xt(t)}function Z(e){return e?JSON.stringify({issueIndex:e.issueIndex,issueTotal:e.issueTotal,issueType:e.issueType,previewText:e.previewText,sourceTitle:e.sourceTitle}):""}async function Sr(){console.info("[wand] Trying to advance UDOIT issue.",{url:window.location.href,hasDialog:!!document.querySelector("[role='dialog']")}),await j(1e3);const e=await K(()=>Ar("Next Issue"),15e3,200);return e?(console.info("[wand] Clicking Next Issue button.",{text:(e.textContent||"").trim()}),fe(e),await j(1e3),console.info("[wand] Advanced to next UDOIT issue."),!0):(console.info("[wand] Next Issue button not found yet.",{url:window.location.href,buttons:Array.from(document.querySelectorAll("button")).map(t=>c(t.textContent)).filter(Boolean).slice(0,12)}),w("Wand couldn't advance to the next UDOIT issue."),!1)}function j(e){return new Promise(t=>window.setTimeout(t,e))}function fe(e){const t=e.getBoundingClientRect(),n=t.left+t.width/2,o=t.top+t.height/2,r={bubbles:!0,cancelable:!0,clientX:n,clientY:o,button:0},i={...r,pointerId:1,pointerType:"mouse",isPrimary:!0};e.dispatchEvent(new PointerEvent("pointerdown",i)),e.dispatchEvent(new MouseEvent("mousedown",r)),e.dispatchEvent(new PointerEvent("pointerup",i)),e.dispatchEvent(new MouseEvent("mouseup",r)),e.dispatchEvent(new MouseEvent("click",r))}async function K(e,t=15e3,n=200){const o=Date.now()+t;for(;Date.now()<o;){const r=e();if(r)return r;await j(n)}return null}function Ar(e){return Array.from(document.querySelectorAll("button")).find(t=>!t.disabled&&c(t.textContent)===e)??null}
