const k="wandPendingRemediation",C="wandAdvancePending",Be="wand:open-remediation-workspace",qe="wand:prepare-remediation-workspace",Ge=["Styles might be used instead of semantic markup for structure","Link has nondescript text","Potential use of color alone to communicate information","Alternative text uses filename rather than a descriptive label","Video captions appear to be automatically generated and may contain errors"];function le(e){return Ge.some(t=>t.toLowerCase()===e.toLowerCase())}function a(e){return String(e??"").replace(/\s+/g," ").trim()}const fe="wand-remediation-highlight",Ve=5*60*1e3,ze=24;let h=null;async function De(){if(!window.location.hostname.endsWith(".instructure.com"))return;const e=await Ke();if(!e||Date.now()-e.createdAt>Ve||!je(e))return;if(!R()&&tt()){console.info("[wand] Canvas target opened. Entering edit mode before highlighting.");return}const t=R();if(!(t?await Xe(e.previewText):await $e(e.previewText))){console.info("[wand] Canvas target opened, but no matching preview text was found.",e);return}console.info("[wand] Canvas remediation target highlighted.",{editPage:t})}async function Ke(){const t=(await chrome.storage.local.get(k))[k];return!t||typeof t!="object"?null:t}function je(e){if(R())return!0;const t=a(document.body.innerText||document.body.textContent);return t.includes(e.sourceTitle)||t.includes(e.previewText)}function $e(e){return H(e)?Promise.resolve(!0):new Promise(t=>{let n=null;const o=()=>{H(e)&&(n==null||n.disconnect(),document.removeEventListener("load",o,!0),t(!0))};n=new MutationObserver(o),n.observe(document.documentElement,{attributes:!0,childList:!0,characterData:!0,subtree:!0}),document.addEventListener("load",o,!0)})}async function Xe(e){const t=M(e);if(!t)return!1;if(me(t,"initial"))return V(t),!0;if(R())return Ye(t);const n=Ze(e),o=H(e,!n);return n||o}function Ye(e){return new Promise(t=>{V(e,()=>t(!0))})}function V(e,t){h==null||h();let n=!1,o=!1,i=null;const r=[],s=new WeakSet,u=new WeakSet,d=()=>{n||(n=!0,i==null||i.disconnect(),document.removeEventListener("load",A,!0),window.removeEventListener("resize",A),r.forEach(c=>c()),h===d&&(h=null))},m=c=>{console.info("[wand] Canvas editor interaction detected; stopping recenter watcher.",{type:c.type}),d()},l=c=>{if(u.has(c))return;u.add(c);const y=c.documentElement||c.body,j=new MutationObserver(()=>p("editor-mutation"));y&&j.observe(y,{attributes:!0,childList:!0,characterData:!0,subtree:!0});const $=["keydown","mousedown","input","paste"],X=["load","readystatechange"];$.forEach(w=>c.addEventListener(w,m,!0)),X.forEach(w=>c.addEventListener(w,I,!0)),r.push(()=>{j.disconnect(),$.forEach(w=>c.removeEventListener(w,m,!0)),X.forEach(w=>c.removeEventListener(w,I,!0))})},S=c=>{s.has(c)||(s.add(c),c.addEventListener("load",I,!0),r.push(()=>c.removeEventListener("load",I,!0)));const y=b(c);y&&l(y)},_=()=>{F().forEach(S)},p=c=>{n||(_(),me(e,c)&&(o||(o=!0,t==null||t())))},A=c=>{p(c.type)},I=c=>{p(`editor-${c.type}`)};i=new MutationObserver(()=>p("page-mutation")),i.observe(document.documentElement,{attributes:!0,childList:!0,subtree:!0}),document.addEventListener("load",A,!0),window.addEventListener("resize",A),h=d,console.info("[wand] Waiting for Canvas editor target.",{frameCount:F().length,targetText:e}),p("start")}function me(e,t){const n=Je(e);return n?Qe(n,e)?!0:z(n,e)?(U(n),!0):ge(n,e)?(U(n),console.info("[wand] Canvas editor target selected.",{reason:t}),!0):!1:!1}function Je(e){var i,r;const t=we(e);if(!t)return null;const n=b(t);if(!(n!=null&&n.body)||n.readyState==="loading")return null;const o=a(((i=n==null?void 0:n.body)==null?void 0:i.innerText)||((r=n==null?void 0:n.body)==null?void 0:r.textContent));return!o||!E(o,e)?null:t}function Qe(e,t){if(!z(e,t))return!1;const n=O(e),o=e.contentWindow;if(!n||!o)return!1;const i=n.getBoundingClientRect();if(!i.height&&!i.width)return!1;const r=o.innerHeight||e.clientHeight,s=i.top+i.height/2;return s>=r*.4&&s<=r*.6}function z(e,t){var i;const n=(i=e.contentWindow)==null?void 0:i.getSelection(),o=a(n==null?void 0:n.toString());return!!(o&&E(o,t))}function O(e){var n;const t=(n=e.contentWindow)==null?void 0:n.getSelection();return t&&t.rangeCount>0?t.getRangeAt(0):null}function U(e){var p;const t=e.contentWindow,n=b(e),o=O(e),i=ct(e);if(!t||!n||!o||!i)return;const r=o.getBoundingClientRect();if(!r||!r.height&&!r.width)return;const s=ut(e,i,t),u=dt(e,i,t),d=i.scrollTop+r.top-(s-r.height)/2,m=i.scrollLeft+r.left-(u-r.width)/2;Y(n,t,i,m,d);const l=(p=O(e))==null?void 0:p.getBoundingClientRect();if(!l)return;const S=l.top-(s-l.height)/2,_=l.left-(u-l.width)/2;(Math.abs(S)>1||Math.abs(_)>1)&&Y(n,t,i,i.scrollLeft+_,i.scrollTop+S)}function Ze(e){const t=M(e),n=window.find;return!t||typeof n!="function"?!1:(window.focus(),n.call(window,t,!1,!1,!0,!1,!0,!1))}function H(e,t=!0){const n=M(e);if(!n)return!1;if(et(n,t))return!0;const i=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let r=i.nextNode();for(;r;){const u=r,d=a(u.textContent);if(E(d,n))return nt(u,t),!0;r=i.nextNode()}const s=ot(n);return s?(he(document),s.id=fe,s.classList.add("wand-remediation-highlight"),t&&s.scrollIntoView({behavior:"smooth",block:"center"}),!0):!1}function et(e,t){const n=we(e);return n?it(n,e,t):!1}function R(){return/\/edit(?:$|[?#])/.test(window.location.href)||!!document.querySelector(".ic-RichContentEditor, .tox-tinymce, textarea")}function tt(){const e=document.querySelector("a.edit_assignment_link[href], a.quiz-edit-button[href], a[href$='/edit']");return e?(e.click(),!0):!1}function nt(e,t){const n=e.parentElement;n&&(he(document),n.id=fe,n.classList.add("wand-remediation-highlight"),t&&n.scrollIntoView({behavior:"smooth",block:"center"}))}function ot(e){return pe(document,e)}function pe(e,t){return Array.from(e.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, span, div, strong, em")).find(o=>E(a(o.innerText||o.textContent),t))??null}function b(e){try{return e.contentDocument}catch{return null}}function we(e){const t=F();return e?t.find(n=>{var r,s;const o=b(n),i=a(((r=o==null?void 0:o.body)==null?void 0:r.innerText)||((s=o==null?void 0:o.body)==null?void 0:s.textContent));return!!(i&&E(i,e))})??t[0]??null:t[0]??null}function F(){return Array.from(document.querySelectorAll(".tox-edit-area__iframe, iframe[id$='_ifr'], iframe[id^='quiz_description']"))}function it(e,t,n=!0){const o=M(t);return!o||!ge(e,o)?!1:(n&&(U(e),V(o)),!0)}function rt(e,t){const n=e.contentWindow;if(!n)return!1;const o=n.find;return typeof o!="function"?!1:(n.focus(),o.call(n,t,!1,!1,!0,!1,!0,!1))}function ge(e,t){if(rt(e,t)&&z(e,t))return!0;const n=st(e,t);return n&&console.info("[wand] Canvas editor target selected by DOM range fallback."),n}function st(e,t){const n=e.contentWindow,o=b(e),i=o==null?void 0:o.body;if(!n||!o||!i)return!1;const r=at(o,i,t);if(!r)return!1;n.focus();const s=n.getSelection();return s==null||s.removeAllRanges(),s==null||s.addRange(r),!0}function at(e,t,n){const o=e.createTreeWalker(t,NodeFilter.SHOW_TEXT);let i=o.nextNode();for(;i;){const u=i,d=u.textContent??"",m=d.indexOf(n);if(m>=0){const l=e.createRange();return l.setStart(u,m),l.setEnd(u,m+n.length),l}if(E(a(d),n)){const l=e.createRange();return l.selectNodeContents(u),l}i=o.nextNode()}const r=pe(t,n);if(!r)return null;const s=e.createRange();return s.selectNodeContents(r),s}function ct(e){const t=b(e);return(t==null?void 0:t.scrollingElement)??(t==null?void 0:t.documentElement)??(t==null?void 0:t.body)??null}function ut(e,t,n){return e.clientHeight||t.clientHeight||n.innerHeight}function dt(e,t,n){return e.clientWidth||t.clientWidth||n.innerWidth}function Y(e,t,n,o,i){const r=Math.max(0,n.scrollHeight-n.clientHeight),s=Math.max(0,n.scrollWidth-n.clientWidth),u=J(i,0,r),d=J(o,0,s);n.scrollTop=u,n.scrollLeft=d,e.documentElement&&e.documentElement!==n&&(e.documentElement.scrollTop=u,e.documentElement.scrollLeft=d),e.body&&e.body!==n&&(e.body.scrollTop=u,e.body.scrollLeft=d),t.scrollTo(d,u)}function J(e,t,n){return Math.min(Math.max(e,t),n)}function M(e){const t=a(e);return t.split(/[.!?]/).map(o=>o.trim()).find(o=>o.length>=ze)??t}function E(e,t){if(e.includes(t))return!0;const n=t.toLowerCase().split(/\W+/).filter(r=>r.length>2);if(n.length<5)return!1;const o=new Set(e.toLowerCase().split(/\W+/).filter(Boolean));return n.filter(r=>o.has(r)).length/n.length>=.75}function he(e){if(e.getElementById("wand-highlight-style"))return;const t=e.createElement("style");t.id="wand-highlight-style",t.textContent=`
    .wand-remediation-highlight {
      outline: 4px solid #facc15 !important;
      outline-offset: 4px !important;
      background: #fef3c7 !important;
    }
  `,e.documentElement.append(t)}const be="wand:page-snapshot",Ee="wand:frame-command",xe="wand:canvas-saved",ye="wand:workspace-url";function lt(){return window.top===window}function ft(e){window.parent.postMessage({type:be,snapshot:e},"*")}function mt(e){window.addEventListener("message",t=>{t.source===window||!bt(t.data)||e(t.data.snapshot)})}function ve(e){var t;for(let n=0;n<window.frames.length;n++)(t=window.frames[n])==null||t.postMessage({type:Ee,command:e},"*")}function Q(){window.parent.postMessage({type:xe},"*")}function pt(e){window.addEventListener("message",t=>{xt(t.data)&&e()})}function wt(e){window.parent.postMessage({type:ye,url:e},"*")}function gt(e){window.addEventListener("message",t=>{yt(t.data)&&e(t.data.url)})}function ht(e){window.addEventListener("message",t=>{Et(t.data)&&e(t.data.command)})}function bt(e){if(!e||typeof e!="object")return!1;const t=e;return t.type===be&&vt(t.snapshot)}function Et(e){var n,o;if(!e||typeof e!="object")return!1;const t=e;return t.type===Ee&&(((n=t.command)==null?void 0:n.type)==="start-remediation"||((o=t.command)==null?void 0:o.type)==="advance-remediation")}function xt(e){return!e||typeof e!="object"?!1:e.type===xe}function yt(e){if(!e||typeof e!="object")return!1;const t=e;return t.type===ye&&typeof t.url=="string"&&/^https:\/\/[^/]+\.instructure\.com\//.test(t.url)}function vt(e){if(!e||typeof e!="object")return!1;const t=e;return typeof t.pageKind=="string"&&typeof t.issueCount=="number"&&Array.isArray(t.issues)&&typeof t.url=="string"&&typeof t.observedAt=="number"}let Z=0;function Tt(){const e=(t,n)=>{if(!ee())return;const o=t.target instanceof HTMLElement?t.target:null;if(!o)return;const i=te(o);i&&ne()&&(console.info(`[wand] Canvas save ${n}.`,{url:window.location.href,topFrame:window.top===window,text:B(i)}),Q())};document.addEventListener("click",t=>{e(t,"button clicked")},!0),document.addEventListener("pointerup",t=>{e(t,"pointerup")},!0),document.addEventListener("submit",t=>{if(!ee())return;const n=t.target instanceof HTMLFormElement?t.target:null;if(!n)return;const o=t.submitter,i=o instanceof HTMLElement?te(o):Ct(n);i&&ne()&&(console.info("[wand] Canvas save form submitted.",{url:window.location.href,topFrame:window.top===window,text:B(i)}),Q())},!0)}function ee(){return window.location.hostname.endsWith(".instructure.com")&&!/\/external_tools\//.test(window.location.pathname)}function te(e){const t=e.closest("button, input[type='submit'], input[type='button'], a[role='button'], a.btn, [role='button']");return!t||Ce(t)?null:Te(t)?t:null}function Ct(e){return Array.from(e.querySelectorAll("button, input[type='submit'], input[type='button'], a[role='button'], a.btn, [role='button']")).find(n=>!Ce(n)&&Te(n))??null}function Te(e){return e.classList.contains("save_quiz_button")?!0:/^(save|update)(\b|$)/i.test(B(e))}function B(e){return e instanceof HTMLInputElement?a(e.value||e.getAttribute("aria-label")||e.title):a(e.innerText||e.textContent||e.getAttribute("aria-label")||e.title)}function Ce(e){return e instanceof HTMLButtonElement||e instanceof HTMLInputElement?e.disabled:e.getAttribute("aria-disabled")==="true"}function ne(){const e=Date.now();return e-Z<1500?!1:(Z=e,!0)}const St=`#wand-panel {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 2147483647;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(170px, 240px) minmax(360px, 1fr) minmax(170px, 240px);
  gap: 24px;
  align-items: center;
  width: 100vw;
  min-height: 124px;
  padding: 18px 28px;
  border: 0;
  border-top: 1px solid #334155;
  border-radius: 0;
  background: #0f172a;
  color: #e5e7eb;
  font: 13px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  box-shadow: 0 6px 18px rgb(0 0 0 / 25%);
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
  width: 62px;
  height: 62px;
  border-radius: 12px;
}

.wand-panel__label {
  font-size: 24px;
  font-weight: 700;
}

.wand-panel__version {
  justify-self: end;
  padding-right: 18px;
  color: #64748b;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0;
}

.wand-panel__meta {
  margin-top: 0;
  justify-self: center;
  color: #f8fafc;
  font-size: 18px;
  font-weight: 700;
  text-align: center;
  overflow-wrap: anywhere;
}

.wand-panel__main {
  display: grid;
  place-items: center;
  min-height: 72px;
}

.wand-panel__guidance {
  max-width: 820px;
  font-size: 24px;
  font-weight: 800;
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
  max-width: 520px;
  min-height: 52px;
  border: 1px solid #38bdf8;
  border-radius: 6px;
  background: #0284c7;
  color: #f8fafc;
  cursor: pointer;
  font: 800 22px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.wand-panel__workspace-action {
  display: grid;
  grid-template-columns: minmax(280px, auto) minmax(220px, 360px);
  gap: 18px;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.wand-workspace-active body {
  width: 65vw !important;
  min-width: 420px !important;
  padding-bottom: 124px !important;
  overflow-x: hidden !important;
}

.wand-workspace-active #wand-panel {
  width: 100vw;
}

#wand-workspace {
  position: fixed;
  inset: 0 0 124px 65vw;
  z-index: 2147483646;
  display: grid;
  grid-template-rows: 42px 1fr;
  border-left: 1px solid #334155;
  background: #020617;
  box-shadow: -10px 0 28px rgb(0 0 0 / 28%);
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
`,oe="wand-panel",ie="wand-panel-style",Se="wand-remediate-action",_t="Wand",At="Version 1.0",It=chrome.runtime.getURL("icons/48.png");let _e=!1,Ae=null;function Lt(e){Wt();const t=document.getElementById(oe);if(t instanceof HTMLElement)return re(t),t;const n=document.createElement("aside");return n.id=oe,e&&n.addEventListener("click",o=>{const i=o.target instanceof HTMLElement?o.target:null;(i==null?void 0:i.id)===Se&&e()}),window.addEventListener("wand:workspace-state",o=>{var r;_e=o instanceof CustomEvent?!!((r=o.detail)!=null&&r.active):!1,D(n,Ae)}),re(n),document.documentElement.append(n),n}function re(e){e.setAttribute("aria-label","Wand extension status"),D(e,null)}function se(e,t){e.setAttribute("aria-label","Wand extension status"),Ae=t,D(e,t)}function D(e,t){e.replaceChildren(kt(),Rt(t),Nt())}function kt(){const e=document.createElement("div");e.className="wand-panel__header";const t=document.createElement("img");t.className="wand-panel__icon",t.src=It,t.alt="";const n=document.createElement("div");return n.className="wand-panel__label",n.textContent=_t,e.replaceChildren(t,n),e}function Rt(e){const t=document.createElement("div");if(t.className="wand-panel__main",_e)return t.append(Mt()),t;if(!e||e.pageKind!=="udoit")return t.append(T("Wand ready","info")),t;if(e.udoitView==="scorecard")return t.append(T("Please select an issue type to use Wand.","needed")),t;if(!e.remediation)return t.append(T("Open a Review item to remediate it with Wand.","needed")),t;const n=document.createElement("button");return n.id=Se,n.type="button",n.textContent=Pt(e.remediation.issueType),t.append(n),t}function Mt(){const e=document.createElement("div");e.className="wand-panel__workspace-action";const t=T("Awaiting remediation and saving ... or","needed"),n=document.createElement("button");return n.type="button",n.textContent="Mark as resolved",e.replaceChildren(t,n),e}function Nt(){const e=document.createElement("div");return e.className="wand-panel__version",e.textContent=At,e}function T(e,t){const n=document.createElement("div");return n.className=`wand-panel__guidance wand-panel__text--${t}`,n.textContent=e,n}function Pt(e){return/styles might be used/i.test(e)?"Remediate styled headings":"Remediate current issue"}function Wt(){if(document.getElementById(ie))return;const e=document.createElement("style");e.id=ie,e.textContent=St,document.documentElement.append(e)}const Ot={pollIntervalMs:250},Ut={timeouts:Ot},Ht=Ut,Ft=Ht.timeouts.pollIntervalMs,Bt="tbody tr, [role='row']",qt="li, [role='status'], [aria-live], [class*='pagination' i], [class*='counter' i]",Gt=/\b(issue|error|warning|alt text|alternative text|heading|link text|caption|table|color|contrast|bold|underline|list|image|video)\b/i,Ie=/\b(0|no)\s+(issues?|errors?|warnings?)\b|\bno accessibility issues\b/i,Le=/\b(page headings|pdf|links|color|video captions|excel|images|ms word)\b/i,Vt=/\b(?:issue|file)\s+\d+\s+of\s+(\d+)\b/i,zt=/\b\d+\s*[-–]\s*\d+\s+of\s+(\d+)\b/i,Dt=/\b(\d+)\s+(?:issues?|errors?|warnings?)\b/i,Kt=/\bIssue\s+(\d+)\s+of\s+(\d+)\b/i,jt=20;let v=null,ae=0,ce="";function N(e){const t=()=>{const n=$t(),o=gn(n);o!==ce&&(ce=o,console.info("[wand] Detector snapshot",n),e(n))};t(),v==null||v.disconnect(),v=new MutationObserver(()=>{window.clearTimeout(ae),ae=window.setTimeout(t,Ft)}),v.observe(document.documentElement,{attributes:!0,childList:!0,subtree:!0})}function $t(){const e=Xt(),t=e==="udoit"?ke():void 0,n=e==="udoit"?Jt(t):void 0,o=e==="udoit"?Yt():[],i=e==="udoit"?on(o):0;return{pageKind:e,udoitView:n,issueCount:i,issues:o,remediation:t,url:window.location.href,observedAt:Date.now()}}function Xt(){const e=window.location.hostname.toLowerCase();return e==="udoit3.ciditools.com"?"udoit":e.endsWith(".instructure.com")?"canvas":"unknown"}function Yt(){const e=ke();if(e)return[{label:`${e.sourceTitle} - ${e.issueType}`,source:"fixModal"}];const t=Re();if(t.length)return t;const n=Array.from(document.querySelectorAll(Bt)),o=[],i=new Set;for(const r of n){if(o.length>=jt)break;if(!g(r)||x(r))continue;const s=mn(r);!s||i.has(s)||!ln(s)||(i.add(s),o.push({label:s,source:pn(r)}))}return o}function Jt(e){return e?"fixModal":Me()?"scorecard":document.querySelector("tbody tr button")?"issueList":"unknown"}function ke(){const e=document.querySelector("[role='dialog']");if(!e||!g(e))return;const t=Qt(e);if(!t||!le(t))return;const n=Zt(e),o=tn(e),{issueIndex:i,issueTotal:r}=nn(e);if(!(!n||!o))return{issueType:t,sourceTitle:n,sourceKind:en(e),issueIndex:i,issueTotal:r,previewText:o}}function Qt(e){const t=Array.from(e.querySelectorAll("h1, h2, h3, [data-cid='Heading']")).map(o=>a(o.innerText||o.textContent)).filter(Boolean),n=Array.from(e.querySelectorAll("span, p")).map(o=>a(o.innerText||o.textContent)).filter(Boolean);return[...t,...n].find(le)??""}function Zt(e){const n=Array.from(e.querySelectorAll("button")).find(o=>{const i=a(o.innerText||o.textContent);return i&&!/^(close|save|previous issue|next issue|html|expand preview)$/i.test(i)});return a((n==null?void 0:n.innerText)||(n==null?void 0:n.textContent))}function en(e){const t=e.querySelector("[data-cid='Pill']");return a((t==null?void 0:t.innerText)||(t==null?void 0:t.textContent))}function tn(e){const t=e.querySelector(".highlighted");return a((t==null?void 0:t.innerText)||(t==null?void 0:t.textContent))}function nn(e){const t=a(e.innerText||e.textContent).match(Kt);return t?{issueIndex:Number(t[1]),issueTotal:Number(t[2])}:{issueIndex:null,issueTotal:null}}function on(e){const t=sn();if(t!==null)return t;const n=rn();return n!==null?n:dn()?0:e.length}function rn(){const e=Array.from(document.querySelectorAll(qt));for(const t of e){if(!g(t)||x(t))continue;const n=ue(a(t.innerText||t.textContent));if(n!==null)return n}return ue(a(document.body.innerText||document.body.textContent))}function sn(){const e=Re();return e.length?e.reduce((t,n)=>t+n.count,0):cn()}function Re(){const e=Me();if(!e)return[];const t=Array.from(e.querySelectorAll("tbody tr")),n=[];for(const o of t){if(!g(o)||x(o))continue;const i=an(o);i&&n.push(i)}return n}function Me(){return Array.from(document.querySelectorAll("table")).find(t=>{var o,i;if(!g(t)||x(t))return!1;const n=a(((o=t.querySelector("thead"))==null?void 0:o.innerText)||((i=t.rows[0])==null?void 0:i.innerText));return/\bissue type\b/i.test(n)&&/\bissue count\b/i.test(n)})??null}function an(e){const t=Array.from(e.cells).map(o=>a(o.innerText||o.textContent)).filter(Boolean);if(t.length<2||!Le.test(t[0]))return null;const n=Number(t[1]);return!Number.isFinite(n)||n<=0?null:{label:`${t[0]} ${n}`,source:"scorecard",count:n}}function cn(){const e=Array.from(document.querySelectorAll("[role='row']"));let t=0,n=0;for(const o of e){if(!g(o)||x(o))continue;const i=un(o);i!==null&&(t+=i,n++)}return n>=3?t:null}function un(e){const t=Array.from(e.querySelectorAll("th, td, [role='cell'], [role='columnheader']")).map(o=>a(o.innerText||o.textContent)).filter(Boolean);if(t.length<2||!Le.test(t[0]))return null;const n=Number(t[1]);return Number.isFinite(n)?n:null}function dn(){return Array.from(document.querySelectorAll("[role='status'], [aria-live], [class*='empty' i], [class*='alert' i]")).some(t=>!g(t)||x(t)?!1:Ie.test(a(t.innerText||t.textContent)))}function ue(e){const t=e.match(Vt);if(t)return Number(t[1]);const n=e.match(zt);if(n)return Number(n[1]);const o=e.match(Dt);return o?Number(o[1]):null}function ln(e){return Ie.test(e)?!1:/\ban error occurred while checking this file\b/i.test(e)?!0:Gt.test(e)&&!fn(e)}function fn(e){return/\breview\b/i.test(e)&&!/\b(error|issue|warning)\b/i.test(e)}function mn(e){return a(e.innerText||e.textContent).slice(0,220)}function pn(e){const t=e.tagName.toLowerCase(),n=e.getAttribute("role"),o=wn(e);return[t,n?`[role="${n}"]`:"",o?`.${o.split(" ").join(".")}`:""].join("")}function wn(e){return typeof e.className=="string"?a(e.className):a(e.getAttribute("class"))}function g(e){const t=e.getBoundingClientRect(),n=window.getComputedStyle(e);return t.width>0&&t.height>0&&n.display!=="none"&&n.visibility!=="hidden"}function x(e){return!!e.closest("#wand-panel")}function gn(e){return JSON.stringify({pageKind:e.pageKind,issueCount:e.issueCount,issues:e.issues.map(t=>t.label),remediation:e.remediation,udoitView:e.udoitView,url:e.url})}const hn="Found in:",de="wand-window-open-capture-script",bn="wand:capture-next-window-open",En="wand:captured-window-open";async function Ne(e){const t=xn(e.sourceTitle);if(!t){console.info("[wand] Could not find UFIXIT source button.",e);return}const n={...e,createdAt:Date.now()};await chrome.storage.local.set({[k]:n});const o={type:qe};await chrome.runtime.sendMessage(o);const i=await yn(t);i&&wt(i)}function xn(e){const t=document.querySelector("[role='dialog']");if(!t)return null;const n=Array.from(t.querySelectorAll("button")),o=n.find(i=>a(i.innerText||i.textContent).includes(e));return o||(n.find(i=>{var s,u,d;return a(((u=(s=i.closest("span"))==null?void 0:s.parentElement)==null?void 0:u.innerText)||((d=i.closest("div"))==null?void 0:d.innerText)).includes(hn)})??null)}async function yn(e){await vn();const t=crypto.randomUUID(),n=new Promise(o=>{const i=window.setTimeout(()=>{window.removeEventListener("message",r),o(null)},1e4),r=s=>{var d;if(s.source!==window||((d=s.data)==null?void 0:d.type)!==En||s.data.token!==t)return;window.clearTimeout(i),window.removeEventListener("message",r);const u=Tn(s.data.url);o(u)};window.addEventListener("message",r)});return window.postMessage({type:bn,token:t},"*"),e.click(),n}function vn(){return document.getElementById(de)?Promise.resolve():new Promise(e=>{const t=document.createElement("script");t.id=de,t.src=chrome.runtime.getURL("windowOpenCapture.js"),t.onload=()=>e(),t.onerror=()=>e(),document.documentElement.append(t)})}function Tn(e){if(typeof e!="string"||!e)return null;try{const t=new URL(e,window.location.href);return/^https:\/\/[^/]+\.instructure\.com\//.test(t.href)?t.href:null}catch{return null}}const q="wand-workspace",Pe="wand-workspace-frame",Cn="wand-workspace-close";function Sn(){chrome.runtime.onMessage.addListener(e=>(e.type!==Be||Oe(e.url),!1))}function We(){var e;document.documentElement.classList.remove("wand-workspace-active"),Ue(!1),(e=document.getElementById(q))==null||e.remove()}function Oe(e){const n=_n().querySelector(`#${Pe}`);n&&(document.documentElement.classList.add("wand-workspace-active"),Ue(!0),n.src=e,window.setTimeout(()=>In(),350))}function _n(){const e=document.getElementById(q);if(e instanceof HTMLElement)return e;const t=document.createElement("section");return t.id=q,t.setAttribute("aria-label","Wand remediation workspace"),t.replaceChildren(An(),Ln()),document.documentElement.append(t),t}function An(){const e=document.createElement("div");e.className="wand-workspace__header";const t=document.createElement("div");t.className="wand-workspace__title",t.textContent="Canvas remediation";const n=document.createElement("button");return n.id=Cn,n.type="button",n.textContent="Close",n.addEventListener("click",We),e.replaceChildren(t,n),e}function Ue(e){window.dispatchEvent(new CustomEvent("wand:workspace-state",{detail:{active:e}}))}function In(){const e=document.querySelector("[role='dialog']");e==null||e.scrollIntoView({behavior:"smooth",block:"center",inline:"center"})}function Ln(){const e=document.createElement("iframe");return e.id=Pe,e.title="Canvas remediation target",e.referrerPolicy="strict-origin-when-cross-origin",e}const K=lt();let P=!1,f=null;console.info("[wand] Content script loaded.",{topFrame:K,url:window.location.href});Tt();De();Sn();const W=K?Lt(()=>{ve({type:"start-remediation"})}):null;W?(gt(e=>{Oe(e)}),pt(()=>{console.info("[wand] Canvas save signal received in top frame.",{url:window.location.href,hasDialog:!!document.querySelector("[role='dialog']")}),chrome.storage.local.set({[C]:Date.now()}),chrome.storage.local.remove(k),We(),ve({type:"advance-remediation"})}),mt(e=>{se(W,e)}),N(e=>{se(W,e)})):K?N(()=>{}):(window.location.hostname==="udoit3.ciditools.com"&&(kn(),L()),ht(e=>{e.type==="start-remediation"&&(f!=null&&f.remediation)&&Ne(f.remediation),e.type==="advance-remediation"&&((f==null?void 0:f.pageKind)==="udoit"||window.location.hostname==="udoit3.ciditools.com")&&L()}),N(e=>{f=e,ft(e),e.pageKind==="udoit"&&L()}));function kn(){chrome.storage.onChanged.addListener((e,t)=>{var n;t!=="local"||!((n=e[C])!=null&&n.newValue)||L()})}async function L(){if(!(window.location.hostname!=="udoit3.ciditools.com"||P||!(await chrome.storage.local.get(C))[C])){P=!0;try{const t=He(f==null?void 0:f.remediation);await Mn()&&(await chrome.storage.local.remove(C),await Rn(t))}finally{P=!1}}}async function Rn(e){const t=await Fe(()=>{const n=f==null?void 0:f.remediation;return n&&He(n)!==e?n:null},15e3,200);if(!t){console.info("[wand] Advanced UDOIT issue, but no next remediation became available.");return}console.info("[wand] Launching next Canvas remediation.",{issueType:t.issueType,sourceTitle:t.sourceTitle,issueIndex:t.issueIndex}),await Ne(t)}function He(e){return e?JSON.stringify({issueIndex:e.issueIndex,issueTotal:e.issueTotal,issueType:e.issueType,previewText:e.previewText,sourceTitle:e.sourceTitle}):""}async function Mn(){console.info("[wand] Trying to advance UDOIT issue.",{url:window.location.href,hasDialog:!!document.querySelector("[role='dialog']")}),await G(1e3);const e=await Fe(()=>Pn("Next Issue"),15e3,200);return e?(console.info("[wand] Clicking Next Issue button.",{text:(e.textContent||"").trim()}),Nn(e),await G(1e3),console.info("[wand] Advanced to next UDOIT issue."),!0):(console.info("[wand] Next Issue button not found yet.",{url:window.location.href,buttons:Array.from(document.querySelectorAll("button")).map(t=>a(t.textContent)).filter(Boolean).slice(0,12)}),!1)}function G(e){return new Promise(t=>window.setTimeout(t,e))}function Nn(e){const t=e.getBoundingClientRect(),n=t.left+t.width/2,o=t.top+t.height/2,i={bubbles:!0,cancelable:!0,clientX:n,clientY:o,button:0},r={...i,pointerId:1,pointerType:"mouse",isPrimary:!0};e.dispatchEvent(new PointerEvent("pointerdown",r)),e.dispatchEvent(new MouseEvent("mousedown",i)),e.dispatchEvent(new PointerEvent("pointerup",r)),e.dispatchEvent(new MouseEvent("mouseup",i)),e.dispatchEvent(new MouseEvent("click",i))}async function Fe(e,t=15e3,n=200){const o=Date.now()+t;for(;Date.now()<o;){const i=e();if(i)return i;await G(n)}return null}function Pn(e){return Array.from(document.querySelectorAll("button")).find(t=>!t.disabled&&a(t.textContent)===e)??null}
