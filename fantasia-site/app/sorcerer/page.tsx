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
        <div><p className="eyebrow">Office workstation queue</p><h1>Sorcerer</h1><p className="hero-copy">A controlled execution farm for Magic jobs that need the office workstation&apos;s licensed Office and Acrobat applications. It deliberately runs one workflow at a time so every job has a clear, auditable place in line.</p></div>
        <div className="product-art"><span>One job at a time</span><strong>Sorcerer</strong></div>
      </section>
      <section className="content-section">
        <div className="section-intro compact"><p className="eyebrow">Job lifecycle</p><h2>Know where work is at</h2><p>Magic gives every submission a copyable job ID. Use it when checking progress or asking an operator for help; it is the safest reference for a specific run.</p></div>
        <ol className="guide-grid">
          <li><b>1</b><div><h3>Prepare and submit</h3><p>Magic packages the selected inputs and submits them over the approved network connection. The job enters the queue with its selected priority.</p></div></li>
          <li><b>2</b><div><h3>Queued, then running</h3><p>Priority is considered first, then submission time. A single worker starts the next eligible job only after the current Office or Acrobat workflow finishes.</p></div></li>
          <li><b>3</b><div><h3>Complete, fail, or cancel</h3><p>Magic reports the outcome and can retrieve completed output. Cancellation is a request and may take effect at the next safe process boundary.</p></div></li>
          <li><b>4</b><div><h3>Retry deliberately</h3><p>Requeueing creates the next attempt for the same job ID. Prior completed archives are preserved before a newer attempt replaces the current result.</p></div></li>
        </ol>
      </section>
      <section className="content-section">
        <div className="section-intro compact"><p className="eyebrow">Operator checklist</p><h2>Operate the server safely</h2></div>
        <ol className="guide-grid">
          <li><b>1</b><div><h3>Keep the server session available</h3><p>Stay signed in to the server&apos;s Windows account. The production workstation uses an interactive logon task to start Sorcerer; Office and Acrobat still require that interactive desktop session. On another workstation, install and verify the same task before accepting client work.</p></div></li>
          <li><b>2</b><div><h3>Use the local dashboard</h3><p>On the server itself, open the documented local dashboard. It refreshes every five seconds and shows queue depth, active work, timing, throughput, workflow breakdown, publishing state, and copyable job IDs. It is intentionally unavailable from the network.</p></div></li>
          <li><b>3</b><div><h3>Manage client access</h3><p>Issue one token per client device, list devices with <code>sorcerer.cmd clients</code>, and revoke retired devices with <code>sorcerer.cmd revoke --name &lt;device&gt;</code>.</p></div></li>
          <li><b>4</b><div><h3>Share completed results</h3><p>After the team UBox folder is ready, configure its Box Drive path. Sorcerer copies completed result ZIPs there without blocking Magic&apos;s direct download.</p></div></li>
        </ol>
      </section>
      <section className="live-section">
        <div className="section-intro"><div><p className="eyebrow">Results and observability</p><h2>Share results, not server internals</h2></div><p>Use a team-owned, locally mounted Box Drive folder with the server account as an Editor. Keep input archives and diagnostics on the server; publish completed results only.</p></div>
        <div className="guide-card"><h3>Built-in telemetry first</h3><p>The local dashboard provides practical operations metrics without exporting private job data or requiring a separate monitoring stack. Grafana remains a future option only if an authorized operator needs durable, organization-wide monitoring; it is not required for normal farm operation.</p></div>
        <p className="callout">Keep the server port restricted to approved office network ranges. Do not expose Sorcerer or its dashboard to the public internet. Authorized operators should use the repository&apos;s local runbook for health checks and result-share configuration.</p>
      </section>
      <SiteFooter />
    </main>
  );
}
