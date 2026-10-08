import type { Metadata } from "next";

import { SiteFooter } from "../../components/SiteFooter";
import { SiteHeader } from "../../components/SiteHeader";
import catalog from "../../content/products.json";

export const metadata: Metadata = {
  title: "Magic | Project Fantasia",
  description: "Run Eccles document workflows locally or submit larger batches to Sorcerer.",
};

export default function MagicPage() {
  const magic = catalog.products.find((product) => product.id === "magic")!;
  return (
    <main>
      <SiteHeader active="magic" />
      <section className="product-hero">
        <div>
          <p className="eyebrow">Windows application</p>
          <h1>Magic</h1>
          <p className="hero-copy">Run repeatable document workflows on your computer, or send larger batches to the approved Sorcerer server while keeping your source files and output location explicit.</p>
          <div className="hero-actions"><a className="button button-primary" href={magic.downloadUrl!}>Download Magic {magic.version}</a><a className="button button-secondary" href="#install">Installation and setup</a></div>
          <p className="release-note">Portable Windows application · Version {magic.version}</p>
        </div>
        <div className="product-art"><span>Local or queued</span><strong>Magic</strong></div>
      </section>
      <section className="content-section" id="install">
        <div className="section-intro compact"><p className="eyebrow">Installation</p><h2>Download, extract, and run</h2></div>
        <ol className="guide-grid">
          <li><b>1</b><div><h3>Download the release</h3><p>Download the Magic ZIP, extract it to a folder you can write to, then run the portable executable inside. No separate Python installation is required.</p></div></li>
          <li><b>2</b><div><h3>Choose explicit folders</h3><p>Select the source and output folders for every run. Magic preserves source files and puts local results only in the output folder you choose.</p></div></li>
          <li><b>3</b><div><h3>Configure remote access per run</h3><p>For Sorcerer work, enter the approved LAN URL and the token issued to your device. Magic stores the token in its user preferences; never paste it into documents, job metadata, or source code.</p></div></li>
          <li><b>4</b><div><h3>Recover safely</h3><p>Use the queue panel to copy a job ID, refresh its state, cancel only your own job, or requeue a terminal job as its next attempt. Magic preserves completed archives before a newer attempt replaces the current result.</p></div></li>
        </ol>
      </section>
      <section className="content-section">
        <div className="section-intro compact"><p className="eyebrow">Start here</p><h2>Run a workflow</h2></div>
        <ol className="guide-grid">
          <li><b>1</b><div><h3>Open Magic</h3><p>Choose the workflow that matches the files you need to process. Select a source folder and an output folder; Magic leaves the source files unchanged.</p></div></li>
          <li><b>2</b><div><h3>Review the run details</h3><p>Use the output folder and file name shown in the dialog. Confirm review checkpoints before Magic continues a local workflow.</p></div></li>
          <li><b>3</b><div><h3>Choose local or Sorcerer</h3><p>For a small batch, run locally. For a larger batch, select <strong>Send to Sorcerer server</strong>.</p></div></li>
          <li><b>4</b><div><h3>Collect the result</h3><p>Magic shows server-side progress, then downloads and extracts the completed result into the output folder you selected. Copy the visible job ID before contacting support; never include your remote token.</p></div></li>
        </ol>
      </section>
      <section className="workflow-section" aria-labelledby="workflow-title">
        <div className="section-intro compact"><p className="eyebrow">What happens next</p><h2 id="workflow-title">One clear path from files to results</h2></div>
        <ol className="workflow-flow">
          <li><span className="workflow-step">1</span><div><h3>Magic</h3><p>You choose the source and output folders, then select a workflow.</p></div></li>
          <li><span className="workflow-arrow" aria-hidden="true">&rarr;</span><span className="workflow-step">2</span><div><h3>Authenticated submission</h3><p>Magic sends the batch to the approved Sorcerer server using your device-specific access token.</p></div></li>
          <li><span className="workflow-arrow" aria-hidden="true">&rarr;</span><span className="workflow-step">3</span><div><h3>Queue and one active workflow</h3><p>Office and Acrobat automation runs safely one job at a time. Your priority affects order, not concurrent capacity.</p></div></li>
          <li><span className="workflow-arrow" aria-hidden="true">&rarr;</span><span className="workflow-step">4</span><div><h3>Direct result, optional team publication</h3><p>Magic downloads the result to your chosen output folder. Team-share publication is optional and never replaces that direct result.</p></div></li>
        </ol>
      </section>
      <section className="live-section">
        <div className="section-intro"><div><p className="eyebrow">Large batches</p><h2>Send work to Sorcerer</h2></div><p>Sorcerer is for the approved office workstation that runs Office and Acrobat one job at a time. It is best for longer runs or batches of five or more files.</p></div>
        <div className="guide-card"><h3>Before submitting</h3><ul><li>Get the approved server URL and your own client token from the Sorcerer operator.</li><li>In Magic, check <strong>Send to Sorcerer server</strong>, enter the URL and token, and set a priority from 0–100.</li><li>Do not share tokens. Each device receives its own token and only sees its own jobs.</li><li>Keep Magic open until the result downloads, or use the Sorcerer queue panel to monitor, cancel, or requeue your own job.</li></ul></div>
        <div className="troubleshooting" aria-labelledby="troubleshooting-title"><h3 id="troubleshooting-title">Troubleshooting without losing your place</h3><dl><div><dt>Server cannot be reached</dt><dd>Check the approved server address and your office connection. Avoid repeated submissions; use the queue panel and share the visible job ID with the operator.</dd></div><div><dt>Token rejected</dt><dd>Ask the operator to verify the device-specific token. Do not send the token in email, chat, or a support request.</dd></div><div><dt>Job failed or Magic closed</dt><dd>Reopen Magic and use the queue panel to find your job. Terminal jobs can be requeued as a new attempt; completed results remain available for direct download.</dd></div><div><dt>Shared publication is delayed</dt><dd>Your direct result remains the source of truth. A delayed or failed team-share copy does not delete the server result.</dd></div></dl></div>
        <p className="callout">Need help? Include the copied job ID, workflow name, and safe error summary. Never include a token, source document contents, or a shared-folder link.</p>
      </section>
      <SiteFooter />
    </main>
  );
}
