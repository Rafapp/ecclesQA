import type { Metadata } from "next";

import { SiteFooter } from "../../components/SiteFooter";
import { SiteHeader } from "../../components/SiteHeader";

export const metadata: Metadata = {
  title: "Magic | Project Fantasia",
  description: "Run Eccles document workflows locally or submit larger batches to Sorcerer.",
};

export default function MagicPage() {
  return (
    <main>
      <SiteHeader active="magic" />
      <section className="product-hero">
        <div>
          <p className="eyebrow">Windows application</p>
          <h1>Magic</h1>
          <p className="hero-copy">Run repeatable document workflows on your computer, or send larger batches to the approved Sorcerer server while keeping your source files and output location explicit.</p>
        </div>
        <div className="product-art"><span>Local or queued</span><strong>Magic</strong></div>
      </section>
      <section className="content-section">
        <div className="section-intro compact"><p className="eyebrow">Start here</p><h2>Run a workflow</h2></div>
        <ol className="guide-grid">
          <li><b>1</b><div><h3>Open Magic</h3><p>Choose the workflow that matches the files you need to process. Select a source folder and an output folder; Magic leaves the source files unchanged.</p></div></li>
          <li><b>2</b><div><h3>Review the run details</h3><p>Use the output folder and file name shown in the dialog. Confirm review checkpoints before Magic continues a local workflow.</p></div></li>
          <li><b>3</b><div><h3>Choose local or Sorcerer</h3><p>For a small batch, run locally. For a larger batch, select <strong>Send to Sorcerer server</strong>.</p></div></li>
          <li><b>4</b><div><h3>Collect the result</h3><p>Magic shows server-side progress, then downloads and extracts the completed result into the output folder you selected.</p></div></li>
        </ol>
      </section>
      <section className="live-section">
        <div className="section-intro"><div><p className="eyebrow">Large batches</p><h2>Send work to Sorcerer</h2></div><p>Sorcerer is for the approved office workstation that runs Office and Acrobat one job at a time. It is best for longer runs or batches of five or more files.</p></div>
        <div className="guide-card"><h3>Before submitting</h3><ul><li>Get the approved server URL and your own client token from the Sorcerer operator.</li><li>In Magic, check <strong>Send to Sorcerer server</strong>, enter the URL and token, and set a priority from 0–100.</li><li>Do not share tokens. Each device receives its own token and only sees its own jobs.</li><li>Keep Magic open until the result downloads, or use the Sorcerer queue panel to monitor, cancel, or requeue your own job.</li></ul></div>
        <p className="callout">If the server cannot be reached, do not retry repeatedly. Check the queue panel, then contact the Sorcerer operator with the job ID and error message.</p>
      </section>
      <SiteFooter />
    </main>
  );
}
