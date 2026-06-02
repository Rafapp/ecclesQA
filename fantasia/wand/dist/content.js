const R="wandPendingRemediation",S="wandAdvancePending",ze="wand:open-remediation-workspace",Ge="wand:prepare-remediation-workspace",De=["Styles might be used instead of semantic markup for structure","Link has nondescript text","Potential use of color alone to communicate information","Alternative text uses filename rather than a descriptive label","Video captions appear to be automatically generated and may contain errors"];function fe(e){return De.some(t=>t.toLowerCase()===e.toLowerCase())}function a(e){return String(e??"").replace(/\s+/g," ").trim()}const pe="wand-remediation-highlight",Ve=5*60*1e3,$e=24;let h=null;async function je(){if(!window.location.hostname.endsWith(".instructure.com"))return;const e=await Ke();if(!e||Date.now()-e.createdAt>Ve||!Xe(e))return;if(!M()&&ot()){console.info("[wand] Canvas target opened. Entering edit mode before highlighting.");return}const t=M();if(!(t?await Je(e.previewText):await Ye(e.previewText))){console.info("[wand] Canvas target opened, but no matching preview text was found.",e);return}console.info("[wand] Canvas remediation target highlighted.",{editPage:t})}async function Ke(){const t=(await chrome.storage.local.get(R))[R];return!t||typeof t!="object"?null:t}function Xe(e){if(M())return!0;const t=a(document.body.innerText||document.body.textContent);return t.includes(e.sourceTitle)||t.includes(e.previewText)}function Ye(e){return F(e)?Promise.resolve(!0):new Promise(t=>{let n=null;const o=()=>{F(e)&&(n==null||n.disconnect(),document.removeEventListener("load",o,!0),t(!0))};n=new MutationObserver(o),n.observe(document.documentElement,{attributes:!0,childList:!0,characterData:!0,subtree:!0}),document.addEventListener("load",o,!0)})}async function Je(e){const t=N(e);if(!t)return!1;if(me(t,"initial"))return D(t),!0;if(M())return Qe(t);const n=tt(e),o=F(e,!n);return n||o}function Qe(e){return new Promise(t=>{D(e,()=>t(!0))})}function D(e,t){h==null||h();let n=!1,o=!1,i=null;const r=[],s=new WeakSet,u=new WeakSet,d=()=>{n||(n=!0,i==null||i.disconnect(),document.removeEventListener("load",L,!0),window.removeEventListener("resize",L),r.forEach(c=>c()),h===d&&(h=null))},p=c=>{console.info("[wand] Canvas editor interaction detected; stopping recenter watcher.",{type:c.type}),d()},l=c=>{if(u.has(c))return;u.add(c);const y=c.documentElement||c.body,K=new MutationObserver(()=>m("editor-mutation"));y&&K.observe(y,{attributes:!0,childList:!0,characterData:!0,subtree:!0});const X=["keydown","mousedown","input","paste"],Y=["load","readystatechange"];X.forEach(w=>c.addEventListener(w,p,!0)),Y.forEach(w=>c.addEventListener(w,I,!0)),r.push(()=>{K.disconnect(),X.forEach(w=>c.removeEventListener(w,p,!0)),Y.forEach(w=>c.removeEventListener(w,I,!0))})},_=c=>{s.has(c)||(s.add(c),c.addEventListener("load",I,!0),r.push(()=>c.removeEventListener("load",I,!0)));const y=b(c);y&&l(y)},A=()=>{B().forEach(_)},m=c=>{n||(A(),me(e,c)&&(o||(o=!0,t==null||t())))},L=c=>{m(c.type)},I=c=>{m(`editor-${c.type}`)};i=new MutationObserver(()=>m("page-mutation")),i.observe(document.documentElement,{attributes:!0,childList:!0,subtree:!0}),document.addEventListener("load",L,!0),window.addEventListener("resize",L),h=d,console.info("[wand] Waiting for Canvas editor target.",{frameCount:B().length,targetText:e}),m("start")}function me(e,t){const n=Ze(e);return n?et(n,e)?!0:V(n,e)?(H(n),!0):he(n,e)?(H(n),console.info("[wand] Canvas editor target selected.",{reason:t}),!0):!1:!1}function Ze(e){var i,r;const t=ge(e);if(!t)return null;const n=b(t);if(!(n!=null&&n.body)||n.readyState==="loading")return null;const o=a(((i=n==null?void 0:n.body)==null?void 0:i.innerText)||((r=n==null?void 0:n.body)==null?void 0:r.textContent));return!o||!E(o,e)?null:t}function et(e,t){if(!V(e,t))return!1;const n=U(e),o=e.contentWindow;if(!n||!o)return!1;const i=n.getBoundingClientRect();if(!i.height&&!i.width)return!1;const r=o.innerHeight||e.clientHeight,s=i.top+i.height/2;return s>=r*.4&&s<=r*.6}function V(e,t){var i;const n=(i=e.contentWindow)==null?void 0:i.getSelection(),o=a(n==null?void 0:n.toString());return!!(o&&E(o,t))}function U(e){var n;const t=(n=e.contentWindow)==null?void 0:n.getSelection();return t&&t.rangeCount>0?t.getRangeAt(0):null}function H(e){var m;const t=e.contentWindow,n=b(e),o=U(e),i=dt(e);if(!t||!n||!o||!i)return;const r=o.getBoundingClientRect();if(!r||!r.height&&!r.width)return;const s=lt(e,i,t),u=ft(e,i,t),d=i.scrollTop+r.top-(s-r.height)/2,p=i.scrollLeft+r.left-(u-r.width)/2;J(n,t,i,p,d);const l=(m=U(e))==null?void 0:m.getBoundingClientRect();if(!l)return;const _=l.top-(s-l.height)/2,A=l.left-(u-l.width)/2;(Math.abs(_)>1||Math.abs(A)>1)&&J(n,t,i,i.scrollLeft+A,i.scrollTop+_)}function tt(e){const t=N(e),n=window.find;return!t||typeof n!="function"?!1:(window.focus(),n.call(window,t,!1,!1,!0,!1,!0,!1))}function F(e,t=!0){const n=N(e);if(!n)return!1;if(nt(n,t))return!0;const i=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let r=i.nextNode();for(;r;){const u=r,d=a(u.textContent);if(E(d,n))return it(u,t),!0;r=i.nextNode()}const s=rt(n);return s?(be(document),s.id=pe,s.classList.add("wand-remediation-highlight"),t&&s.scrollIntoView({behavior:"smooth",block:"center"}),!0):!1}function nt(e,t){const n=ge(e);return n?st(n,e,t):!1}function M(){return/\/edit(?:$|[?#])/.test(window.location.href)||!!document.querySelector(".ic-RichContentEditor, .tox-tinymce, textarea")}function ot(){const e=document.querySelector("a.edit_assignment_link[href], a.quiz-edit-button[href], a[href$='/edit']");return e?(e.click(),!0):!1}function it(e,t){const n=e.parentElement;n&&(be(document),n.id=pe,n.classList.add("wand-remediation-highlight"),t&&n.scrollIntoView({behavior:"smooth",block:"center"}))}function rt(e){return we(document,e)}function we(e,t){return Array.from(e.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, span, div, strong, em")).find(o=>E(a(o.innerText||o.textContent),t))??null}function b(e){try{return e.contentDocument}catch{return null}}function ge(e){const t=B();return e?t.find(n=>{var r,s;const o=b(n),i=a(((r=o==null?void 0:o.body)==null?void 0:r.innerText)||((s=o==null?void 0:o.body)==null?void 0:s.textContent));return!!(i&&E(i,e))})??t[0]??null:t[0]??null}function B(){return Array.from(document.querySelectorAll(".tox-edit-area__iframe, iframe[id$='_ifr'], iframe[id^='quiz_description']"))}function st(e,t,n=!0){const o=N(t);return!o||!he(e,o)?!1:(n&&(H(e),D(o)),!0)}function at(e,t){const n=e.contentWindow;if(!n)return!1;const o=n.find;return typeof o!="function"?!1:(n.focus(),o.call(n,t,!1,!1,!0,!1,!0,!1))}function he(e,t){if(at(e,t)&&V(e,t))return!0;const n=ct(e,t);return n&&console.info("[wand] Canvas editor target selected by DOM range fallback."),n}function ct(e,t){const n=e.contentWindow,o=b(e),i=o==null?void 0:o.body;if(!n||!o||!i)return!1;const r=ut(o,i,t);if(!r)return!1;n.focus();const s=n.getSelection();return s==null||s.removeAllRanges(),s==null||s.addRange(r),!0}function ut(e,t,n){const o=e.createTreeWalker(t,NodeFilter.SHOW_TEXT);let i=o.nextNode();for(;i;){const u=i,d=u.textContent??"",p=d.indexOf(n);if(p>=0){const l=e.createRange();return l.setStart(u,p),l.setEnd(u,p+n.length),l}if(E(a(d),n)){const l=e.createRange();return l.selectNodeContents(u),l}i=o.nextNode()}const r=we(t,n);if(!r)return null;const s=e.createRange();return s.selectNodeContents(r),s}function dt(e){const t=b(e);return(t==null?void 0:t.scrollingElement)??(t==null?void 0:t.documentElement)??(t==null?void 0:t.body)??null}function lt(e,t,n){return e.clientHeight||t.clientHeight||n.innerHeight}function ft(e,t,n){return e.clientWidth||t.clientWidth||n.innerWidth}function J(e,t,n,o,i){const r=Math.max(0,n.scrollHeight-n.clientHeight),s=Math.max(0,n.scrollWidth-n.clientWidth),u=Q(i,0,r),d=Q(o,0,s);n.scrollTop=u,n.scrollLeft=d,e.documentElement&&e.documentElement!==n&&(e.documentElement.scrollTop=u,e.documentElement.scrollLeft=d),e.body&&e.body!==n&&(e.body.scrollTop=u,e.body.scrollLeft=d),t.scrollTo(d,u)}function Q(e,t,n){return Math.min(Math.max(e,t),n)}function N(e){const t=a(e);return t.split(/[.!?]/).map(o=>o.trim()).find(o=>o.length>=$e)??t}function E(e,t){if(e.includes(t))return!0;const n=t.toLowerCase().split(/\W+/).filter(r=>r.length>2);if(n.length<5)return!1;const o=new Set(e.toLowerCase().split(/\W+/).filter(Boolean));return n.filter(r=>o.has(r)).length/n.length>=.75}function be(e){if(e.getElementById("wand-highlight-style"))return;const t=e.createElement("style");t.id="wand-highlight-style",t.textContent=`
    .wand-remediation-highlight {
      outline: 4px solid #facc15 !important;
      outline-offset: 4px !important;
      background: #fef3c7 !important;
    }
  `,e.documentElement.append(t)}const Ee="wand:page-snapshot",xe="wand:frame-command",ye="wand:canvas-saved",ve="wand:workspace-url";function pt(){return window.top===window}function mt(e){window.parent.postMessage({type:Ee,snapshot:e},"*")}function wt(e){window.addEventListener("message",t=>{t.source===window||!xt(t.data)||e(t.data.snapshot)})}function Te(e){var t;for(let n=0;n<window.frames.length;n++)(t=window.frames[n])==null||t.postMessage({type:xe,command:e},"*")}function Z(){window.parent.postMessage({type:ye},"*")}function gt(e){window.addEventListener("message",t=>{vt(t.data)&&e()})}function ht(e){window.parent.postMessage({type:ve,url:e},"*")}function bt(e){window.addEventListener("message",t=>{Tt(t.data)&&e(t.data.url)})}function Et(e){window.addEventListener("message",t=>{yt(t.data)&&e(t.data.command)})}function xt(e){if(!e||typeof e!="object")return!1;const t=e;return t.type===Ee&&Ct(t.snapshot)}function yt(e){var n,o;if(!e||typeof e!="object")return!1;const t=e;return t.type===xe&&(((n=t.command)==null?void 0:n.type)==="start-remediation"||((o=t.command)==null?void 0:o.type)==="advance-remediation")}function vt(e){return!e||typeof e!="object"?!1:e.type===ye}function Tt(e){if(!e||typeof e!="object")return!1;const t=e;return t.type===ve&&typeof t.url=="string"&&/^https:\/\/[^/]+\.instructure\.com\//.test(t.url)}function Ct(e){if(!e||typeof e!="object")return!1;const t=e;return typeof t.pageKind=="string"&&typeof t.issueCount=="number"&&Array.isArray(t.issues)&&typeof t.url=="string"&&typeof t.observedAt=="number"}let ee=0;function St(){const e=(t,n)=>{if(!te())return;const o=t.target instanceof HTMLElement?t.target:null;if(!o)return;const i=ne(o);i&&oe()&&(console.info(`[wand] Canvas save ${n}.`,{url:window.location.href,topFrame:window.top===window,text:q(i)}),Z())};document.addEventListener("click",t=>{e(t,"button clicked")},!0),document.addEventListener("pointerup",t=>{e(t,"pointerup")},!0),document.addEventListener("submit",t=>{if(!te())return;const n=t.target instanceof HTMLFormElement?t.target:null;if(!n)return;const o=t.submitter,i=o instanceof HTMLElement?ne(o):_t(n);i&&oe()&&(console.info("[wand] Canvas save form submitted.",{url:window.location.href,topFrame:window.top===window,text:q(i)}),Z())},!0)}function te(){return window.location.hostname.endsWith(".instructure.com")&&!/\/external_tools\//.test(window.location.pathname)}function ne(e){const t=e.closest("button, input[type='submit'], input[type='button'], a[role='button'], a.btn, [role='button']");return!t||Se(t)?null:Ce(t)?t:null}function _t(e){return Array.from(e.querySelectorAll("button, input[type='submit'], input[type='button'], a[role='button'], a.btn, [role='button']")).find(n=>!Se(n)&&Ce(n))??null}function Ce(e){return e.classList.contains("save_quiz_button")?!0:/^(save|update)(\b|$)/i.test(q(e))}function q(e){return e instanceof HTMLInputElement?a(e.value||e.getAttribute("aria-label")||e.title):a(e.innerText||e.textContent||e.getAttribute("aria-label")||e.title)}function Se(e){return e instanceof HTMLButtonElement||e instanceof HTMLInputElement?e.disabled:e.getAttribute("aria-disabled")==="true"}function oe(){const e=Date.now();return e-ee<1500?!1:(ee=e,!0)}const At=`#wand-panel {
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
  border-top: 1px solid #334155;
  border-radius: 0;
  background: #0f172a;
  color: #e5e7eb;
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
  background: #0f172a;
  color: #94a3b8;
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
  padding: 0;
  outline: none;
}

.wand-panel__toggle:hover {
  color: #e5e7eb;
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
  color: #64748b;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0;
}

.wand-panel__meta {
  margin-top: 0;
  justify-self: center;
  color: #f8fafc;
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

.wand-panel__text--info {
  color: #f8fafc;
}

.wand-panel__text--needed {
  color: #facc15;
}

.wand-panel__text--error {
  color: #f87171;
}

.wand-panel__main button {
  width: 100%;
  max-width: 400px;
  min-height: 36px;
  border: 1px solid #38bdf8;
  border-radius: 6px;
  background: #0284c7;
  color: #ffffff !important;
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

:root {
  --wand-split: 65vw;
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
  border-left: 1px solid #334155;
  background: #020617;
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
  background: #334155;
  transition: background 0.15s;
}

#wand-workspace-resizer:hover::after {
  background: #38bdf8;
}

.wand-workspace__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid #334155;
  color: #e5e7eb;
  font: 600 13px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.wand-workspace__header button {
  min-height: 28px;
  border: 1px solid #475569;
  border-radius: 6px;
  background: #1e293b;
  color: #e5e7eb;
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
  outline: 4px solid #facc15;
  outline-offset: 4px;
  background: #fef3c7;
}
`,ie="wand-panel",re="wand-panel-style",_e="wand-remediate-action",Ae="wand-panel-toggle",Lt="Wand",It="Version 1.0.1",kt=chrome.runtime.getURL("icons/48.png"),Rt="wand-panel--collapsed";let Le=!1,Ie=null,v=!1;function Mt(e){Ht();const t=document.getElementById(ie);if(t instanceof HTMLElement)return se(t),t;const n=document.createElement("aside");n.id=ie,n.style.position="relative";const o=document.createElement("button");return o.id=Ae,o.className="wand-panel__toggle",o.setAttribute("aria-label","Toggle Wand panel"),o.textContent="▲",o.addEventListener("click",()=>{v=!v,n.classList.toggle(Rt,v),o.textContent=v?"▲":"▼",o.setAttribute("aria-label",v?"Expand Wand panel":"Collapse Wand panel")}),n.append(o),e&&n.addEventListener("click",i=>{const r=i.target instanceof HTMLElement?i.target:null;(r==null?void 0:r.id)===_e&&e()}),window.addEventListener("wand:workspace-state",i=>{var s;Le=i instanceof CustomEvent?!!((s=i.detail)!=null&&s.active):!1,$(n,Ie)}),se(n),document.documentElement.append(n),n}function se(e){e.setAttribute("aria-label","Wand extension status"),$(e,null)}function ae(e,t){e.setAttribute("aria-label","Wand extension status"),Ie=t,$(e,t)}function $(e,t){const n=e.querySelector(`#${Ae}`);e.replaceChildren(Nt(),Pt(t),Ot()),n instanceof HTMLElement&&e.prepend(n)}function Nt(){const e=document.createElement("div");e.className="wand-panel__header";const t=document.createElement("img");t.className="wand-panel__icon",t.src=kt,t.alt="";const n=document.createElement("div");return n.className="wand-panel__label",n.textContent=Lt,e.replaceChildren(t,n),e}function Pt(e){const t=document.createElement("div");if(t.className="wand-panel__main",Le)return t.append(Wt()),t;if(!e||e.pageKind!=="udoit")return t.append(C("Wand ready","info")),t;if(e.udoitView==="scorecard")return t.append(C("Please select an issue type to use Wand.","needed")),t;if(!e.remediation)return t.append(C("Open a Review item to remediate it with Wand.","needed")),t;const n=document.createElement("button");return n.id=_e,n.type="button",n.textContent=Ut(e.remediation.issueType),t.append(n),t}function Wt(){const e=document.createElement("div");e.className="wand-panel__workspace-action";const t=C("Awaiting remediation and saving ... or","needed"),n=document.createElement("button");return n.type="button",n.textContent="Mark as resolved",e.replaceChildren(t,n),e}function Ot(){const e=document.createElement("div");return e.className="wand-panel__version",e.textContent=It,e}function C(e,t){const n=document.createElement("div");return n.className=`wand-panel__guidance wand-panel__text--${t}`,n.textContent=e,n}function Ut(e){return/styles might be used/i.test(e)?"Remediate styled headings":"Remediate current issue"}function Ht(){if(document.getElementById(re))return;const e=document.createElement("style");e.id=re,e.textContent=At,document.documentElement.append(e)}const Ft={pollIntervalMs:250},Bt={timeouts:Ft},qt=Bt,zt=qt.timeouts.pollIntervalMs,Gt="tbody tr, [role='row']",Dt="li, [role='status'], [aria-live], [class*='pagination' i], [class*='counter' i]",Vt=/\b(issue|error|warning|alt text|alternative text|heading|link text|caption|table|color|contrast|bold|underline|list|image|video)\b/i,ke=/\b(0|no)\s+(issues?|errors?|warnings?)\b|\bno accessibility issues\b/i,Re=/\b(page headings|pdf|links|color|video captions|excel|images|ms word)\b/i,$t=/\b(?:issue|file)\s+\d+\s+of\s+(\d+)\b/i,jt=/\b\d+\s*[-–]\s*\d+\s+of\s+(\d+)\b/i,Kt=/\b(\d+)\s+(?:issues?|errors?|warnings?)\b/i,Xt=/\bIssue\s+(\d+)\s+of\s+(\d+)\b/i,Yt=20;let T=null,ce=0,ue="";function P(e){const t=()=>{const n=Jt(),o=En(n);o!==ue&&(ue=o,console.info("[wand] Detector snapshot",n),e(n))};t(),T==null||T.disconnect(),T=new MutationObserver(()=>{window.clearTimeout(ce),ce=window.setTimeout(t,zt)}),T.observe(document.documentElement,{attributes:!0,childList:!0,subtree:!0})}function Jt(){const e=Qt(),t=e==="udoit"?Me():void 0,n=e==="udoit"?en(t):void 0,o=e==="udoit"?Zt():[],i=e==="udoit"?an(o):0;return{pageKind:e,udoitView:n,issueCount:i,issues:o,remediation:t,url:window.location.href,observedAt:Date.now()}}function Qt(){const e=window.location.hostname.toLowerCase();return e==="udoit3.ciditools.com"?"udoit":e.endsWith(".instructure.com")?"canvas":"unknown"}function Zt(){const e=Me();if(e)return[{label:`${e.sourceTitle} - ${e.issueType}`,source:"fixModal"}];const t=Ne();if(t.length)return t;const n=Array.from(document.querySelectorAll(Gt)),o=[],i=new Set;for(const r of n){if(o.length>=Yt)break;if(!g(r)||x(r))continue;const s=gn(r);!s||i.has(s)||!mn(s)||(i.add(s),o.push({label:s,source:hn(r)}))}return o}function en(e){return e?"fixModal":Pe()?"scorecard":document.querySelector("tbody tr button")?"issueList":"unknown"}function Me(){const e=document.querySelector("[role='dialog']");if(!e||!g(e))return;const t=tn(e);if(!t||!fe(t))return;const n=nn(e),o=rn(e),{issueIndex:i,issueTotal:r}=sn(e);if(!(!n||!o))return{issueType:t,sourceTitle:n,sourceKind:on(e),issueIndex:i,issueTotal:r,previewText:o}}function tn(e){const t=Array.from(e.querySelectorAll("h1, h2, h3, [data-cid='Heading']")).map(o=>a(o.innerText||o.textContent)).filter(Boolean),n=Array.from(e.querySelectorAll("span, p")).map(o=>a(o.innerText||o.textContent)).filter(Boolean);return[...t,...n].find(fe)??""}function nn(e){const n=Array.from(e.querySelectorAll("button")).find(o=>{const i=a(o.innerText||o.textContent);return i&&!/^(close|save|previous issue|next issue|html|expand preview)$/i.test(i)});return a((n==null?void 0:n.innerText)||(n==null?void 0:n.textContent))}function on(e){const t=e.querySelector("[data-cid='Pill']");return a((t==null?void 0:t.innerText)||(t==null?void 0:t.textContent))}function rn(e){const t=e.querySelector(".highlighted");return a((t==null?void 0:t.innerText)||(t==null?void 0:t.textContent))}function sn(e){const t=a(e.innerText||e.textContent).match(Xt);return t?{issueIndex:Number(t[1]),issueTotal:Number(t[2])}:{issueIndex:null,issueTotal:null}}function an(e){const t=un();if(t!==null)return t;const n=cn();return n!==null?n:pn()?0:e.length}function cn(){const e=Array.from(document.querySelectorAll(Dt));for(const t of e){if(!g(t)||x(t))continue;const n=de(a(t.innerText||t.textContent));if(n!==null)return n}return de(a(document.body.innerText||document.body.textContent))}function un(){const e=Ne();return e.length?e.reduce((t,n)=>t+n.count,0):ln()}function Ne(){const e=Pe();if(!e)return[];const t=Array.from(e.querySelectorAll("tbody tr")),n=[];for(const o of t){if(!g(o)||x(o))continue;const i=dn(o);i&&n.push(i)}return n}function Pe(){return Array.from(document.querySelectorAll("table")).find(t=>{var o,i;if(!g(t)||x(t))return!1;const n=a(((o=t.querySelector("thead"))==null?void 0:o.innerText)||((i=t.rows[0])==null?void 0:i.innerText));return/\bissue type\b/i.test(n)&&/\bissue count\b/i.test(n)})??null}function dn(e){const t=Array.from(e.cells).map(o=>a(o.innerText||o.textContent)).filter(Boolean);if(t.length<2||!Re.test(t[0]))return null;const n=Number(t[1]);return!Number.isFinite(n)||n<=0?null:{label:`${t[0]} ${n}`,source:"scorecard",count:n}}function ln(){const e=Array.from(document.querySelectorAll("[role='row']"));let t=0,n=0;for(const o of e){if(!g(o)||x(o))continue;const i=fn(o);i!==null&&(t+=i,n++)}return n>=3?t:null}function fn(e){const t=Array.from(e.querySelectorAll("th, td, [role='cell'], [role='columnheader']")).map(o=>a(o.innerText||o.textContent)).filter(Boolean);if(t.length<2||!Re.test(t[0]))return null;const n=Number(t[1]);return Number.isFinite(n)?n:null}function pn(){return Array.from(document.querySelectorAll("[role='status'], [aria-live], [class*='empty' i], [class*='alert' i]")).some(t=>!g(t)||x(t)?!1:ke.test(a(t.innerText||t.textContent)))}function de(e){const t=e.match($t);if(t)return Number(t[1]);const n=e.match(jt);if(n)return Number(n[1]);const o=e.match(Kt);return o?Number(o[1]):null}function mn(e){return ke.test(e)?!1:/\ban error occurred while checking this file\b/i.test(e)?!0:Vt.test(e)&&!wn(e)}function wn(e){return/\breview\b/i.test(e)&&!/\b(error|issue|warning)\b/i.test(e)}function gn(e){return a(e.innerText||e.textContent).slice(0,220)}function hn(e){const t=e.tagName.toLowerCase(),n=e.getAttribute("role"),o=bn(e);return[t,n?`[role="${n}"]`:"",o?`.${o.split(" ").join(".")}`:""].join("")}function bn(e){return typeof e.className=="string"?a(e.className):a(e.getAttribute("class"))}function g(e){const t=e.getBoundingClientRect(),n=window.getComputedStyle(e);return t.width>0&&t.height>0&&n.display!=="none"&&n.visibility!=="hidden"}function x(e){return!!e.closest("#wand-panel")}function En(e){return JSON.stringify({pageKind:e.pageKind,issueCount:e.issueCount,issues:e.issues.map(t=>t.label),remediation:e.remediation,udoitView:e.udoitView,url:e.url})}const xn="Found in:",le="wand-window-open-capture-script",yn="wand:capture-next-window-open",vn="wand:captured-window-open";async function We(e){const t=Tn(e.sourceTitle);if(!t){console.info("[wand] Could not find UFIXIT source button.",e);return}const n={...e,createdAt:Date.now()};await chrome.storage.local.set({[R]:n});const o={type:Ge};await chrome.runtime.sendMessage(o);const i=await Cn(t);i&&ht(i)}function Tn(e){const t=document.querySelector("[role='dialog']");if(!t)return null;const n=Array.from(t.querySelectorAll("button")),o=n.find(i=>a(i.innerText||i.textContent).includes(e));return o||(n.find(i=>{var s,u,d;return a(((u=(s=i.closest("span"))==null?void 0:s.parentElement)==null?void 0:u.innerText)||((d=i.closest("div"))==null?void 0:d.innerText)).includes(xn)})??null)}async function Cn(e){await Sn();const t=crypto.randomUUID(),n=new Promise(o=>{const i=window.setTimeout(()=>{window.removeEventListener("message",r),o(null)},1e4),r=s=>{var d;if(s.source!==window||((d=s.data)==null?void 0:d.type)!==vn||s.data.token!==t)return;window.clearTimeout(i),window.removeEventListener("message",r);const u=_n(s.data.url);o(u)};window.addEventListener("message",r)});return window.postMessage({type:yn,token:t},"*"),e.click(),n}function Sn(){return document.getElementById(le)?Promise.resolve():new Promise(e=>{const t=document.createElement("script");t.id=le,t.src=chrome.runtime.getURL("windowOpenCapture.js"),t.onload=()=>e(),t.onerror=()=>e(),document.documentElement.append(t)})}function _n(e){if(typeof e!="string"||!e)return null;try{const t=new URL(e,window.location.href);return/^https:\/\/[^/]+\.instructure\.com\//.test(t.href)?t.href:null}catch{return null}}const z="wand-workspace",Oe="wand-workspace-frame",An="wand-workspace-close",Ln="wand-workspace-resizer",In=20,kn=80;function Rn(){chrome.runtime.onMessage.addListener(e=>(e.type!==ze||He(e.url),!1))}function Ue(){var e;document.documentElement.classList.remove("wand-workspace-active"),Fe(!1),(e=document.getElementById(z))==null||e.remove()}function He(e){const n=Mn().querySelector(`#${Oe}`);n&&(document.documentElement.classList.add("wand-workspace-active"),Fe(!0),n.src=e,window.setTimeout(()=>Pn(),350))}function Mn(){const e=document.getElementById(z);if(e instanceof HTMLElement)return e;const t=document.createElement("section");return t.id=z,t.setAttribute("aria-label","Wand remediation workspace"),t.replaceChildren(Wn(t),Nn(),On()),document.documentElement.append(t),t}function Nn(){const e=document.createElement("div");e.className="wand-workspace__header";const t=document.createElement("div");t.className="wand-workspace__title",t.textContent="Canvas remediation";const n=document.createElement("button");return n.id=An,n.type="button",n.textContent="Close",n.addEventListener("click",Ue),e.replaceChildren(t,n),e}function Fe(e){window.dispatchEvent(new CustomEvent("wand:workspace-state",{detail:{active:e}}))}function Pn(){const e=document.querySelector("[role='dialog']");e==null||e.scrollIntoView({behavior:"smooth",block:"center",inline:"center"})}function Wn(e){const t=document.createElement("div");return t.id=Ln,t.setAttribute("aria-hidden","true"),t.addEventListener("pointerdown",n=>{n.preventDefault(),t.setPointerCapture(n.pointerId);const o=r=>{const s=Math.min(kn,Math.max(In,r.clientX/window.innerWidth*100));e.style.left=`${s}vw`,document.documentElement.style.setProperty("--wand-split",`${s}vw`)},i=()=>{t.removeEventListener("pointermove",o),t.removeEventListener("pointerup",i)};t.addEventListener("pointermove",o),t.addEventListener("pointerup",i)}),t}function On(){const e=document.createElement("iframe");return e.id=Oe,e.title="Canvas remediation target",e.referrerPolicy="strict-origin-when-cross-origin",e}const j=pt();let W=!1,f=null;console.info("[wand] Content script loaded.",{topFrame:j,url:window.location.href});St();je();Rn();const O=j?Mt(()=>{Te({type:"start-remediation"})}):null;O?(bt(e=>{He(e)}),gt(()=>{console.info("[wand] Canvas save signal received in top frame.",{url:window.location.href,hasDialog:!!document.querySelector("[role='dialog']")}),chrome.storage.local.set({[S]:Date.now()}),chrome.storage.local.remove(R),Ue(),Te({type:"advance-remediation"})}),wt(e=>{ae(O,e)}),P(e=>{ae(O,e)})):j?P(()=>{}):(window.location.hostname==="udoit3.ciditools.com"&&(Un(),k()),Et(e=>{e.type==="start-remediation"&&(f!=null&&f.remediation)&&We(f.remediation),e.type==="advance-remediation"&&((f==null?void 0:f.pageKind)==="udoit"||window.location.hostname==="udoit3.ciditools.com")&&k()}),P(e=>{f=e,mt(e),e.pageKind==="udoit"&&k()}));function Un(){chrome.storage.onChanged.addListener((e,t)=>{var n;t!=="local"||!((n=e[S])!=null&&n.newValue)||k()})}async function k(){if(!(window.location.hostname!=="udoit3.ciditools.com"||W||!(await chrome.storage.local.get(S))[S])){W=!0;try{const t=Be(f==null?void 0:f.remediation);await Fn()&&(await chrome.storage.local.remove(S),await Hn(t))}finally{W=!1}}}async function Hn(e){const t=await qe(()=>{const n=f==null?void 0:f.remediation;return n&&Be(n)!==e?n:null},15e3,200);if(!t){console.info("[wand] Advanced UDOIT issue, but no next remediation became available.");return}console.info("[wand] Launching next Canvas remediation.",{issueType:t.issueType,sourceTitle:t.sourceTitle,issueIndex:t.issueIndex}),await We(t)}function Be(e){return e?JSON.stringify({issueIndex:e.issueIndex,issueTotal:e.issueTotal,issueType:e.issueType,previewText:e.previewText,sourceTitle:e.sourceTitle}):""}async function Fn(){console.info("[wand] Trying to advance UDOIT issue.",{url:window.location.href,hasDialog:!!document.querySelector("[role='dialog']")}),await G(1e3);const e=await qe(()=>qn("Next Issue"),15e3,200);return e?(console.info("[wand] Clicking Next Issue button.",{text:(e.textContent||"").trim()}),Bn(e),await G(1e3),console.info("[wand] Advanced to next UDOIT issue."),!0):(console.info("[wand] Next Issue button not found yet.",{url:window.location.href,buttons:Array.from(document.querySelectorAll("button")).map(t=>a(t.textContent)).filter(Boolean).slice(0,12)}),!1)}function G(e){return new Promise(t=>window.setTimeout(t,e))}function Bn(e){const t=e.getBoundingClientRect(),n=t.left+t.width/2,o=t.top+t.height/2,i={bubbles:!0,cancelable:!0,clientX:n,clientY:o,button:0},r={...i,pointerId:1,pointerType:"mouse",isPrimary:!0};e.dispatchEvent(new PointerEvent("pointerdown",r)),e.dispatchEvent(new MouseEvent("mousedown",i)),e.dispatchEvent(new PointerEvent("pointerup",r)),e.dispatchEvent(new MouseEvent("mouseup",i)),e.dispatchEvent(new MouseEvent("click",i))}async function qe(e,t=15e3,n=200){const o=Date.now()+t;for(;Date.now()<o;){const i=e();if(i)return i;await G(n)}return null}function qn(e){return Array.from(document.querySelectorAll("button")).find(t=>!t.disabled&&a(t.textContent)===e)??null}
