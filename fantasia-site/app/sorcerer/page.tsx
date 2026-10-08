import type { Metadata } from "next";

import { SiteFooter } from "../../components/SiteFooter";
import { SiteHeader } from "../../components/SiteHeader";

export const metadata: Metadata = {
  title: "Sorcerer | Project Fantasia",
  description: "Operate the Eccles document-workflow queue and its local operator dashboard.",
};

export default function SorcererPage() {
  return (
    <main>
      <SiteHeader active="sorcerer" />
      <section className="product-hero">
        <div><p className="eyebrow">Office workstation queue</p><h1>Sorcerer</h1><p className="hero-copy">An authenticated, single-worker server for Magic jobs that need the office workstation&apos;s licensed Office and Acrobat applications.</p></div>
        <div className="product-art"><span>One job at a time</span><strong>Sorcerer</strong></div>
      </section>
      <section className="content-section">
        <div className="section-intro compact"><p className="eyebrow">Operator checklist</p><h2>Operate the server safely</h2></div>
        <ol className="guide-grid">
          <li><b>1</b><div><h3>Keep the server session available</h3><p>Stay signed in to the server&apos;s Windows account. Sorcerer starts at sign-in and requires the interactive Office and Acrobat session.</p></div></li>
          <li><b>2</b><div><h3>Use the local dashboard</h3><p>On the server itself, open <code>http://127.0.0.1:8765/dashboard</code>. It refreshes every five seconds and is intentionally unavailable from the network.</p></div></li>
          <li><b>3</b><div><h3>Manage client access</h3><p>Issue one token per client device, list devices with <code>sorcerer.cmd clients</code>, and revoke retired devices with <code>sorcerer.cmd revoke --name &lt;device&gt;</code>.</p></div></li>
          <li><b>4</b><div><h3>Share completed results</h3><p>After the team UBox folder is ready, configure its Box Drive path. Sorcerer copies completed result ZIPs there without blocking Magic&apos;s direct download.</p></div></li>
        </ol>
      </section>
      <section className="live-section">
        <div className="section-intro"><div><p className="eyebrow">UBox results</p><h2>Configure the team share</h2></div><p>Use a team-owned UBox folder with the server account as an Editor. Keep input archives and diagnostics on the server; share completed results only.</p></div>
        <div className="guide-card"><h3>After Box Drive shows the team folder</h3><code>.\sorcerer.cmd set-result-share --data-dir C:\SorcererData --share-dir &quot;C:\Users\Fantasia\Box\Accessibility\Sorcerer Results&quot;</code><p>Restart Sorcerer after setting the folder. If Box Drive is unavailable, the job remains completed and Magic can still download its result directly.</p></div>
        <p className="callout">Keep TCP 8765 restricted to approved office network ranges. Do not expose Sorcerer or its dashboard to the public internet.</p>
      </section>
      <SiteFooter />
    </main>
  );
}
