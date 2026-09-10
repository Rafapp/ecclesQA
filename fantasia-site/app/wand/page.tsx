import type { Metadata } from "next";
import Image from "next/image";

import { SiteFooter } from "../../components/SiteFooter";
import { SiteHeader } from "../../components/SiteHeader";
import catalog from "../../content/products.json";

const wand = catalog.products.find((product) => product.id === "wand")!;

export const metadata: Metadata = {
  title: "Wand | Project Fantasia",
  description: "Download Wand and follow the illustrated Chrome installation guide.",
};

export default function WandPage() {
  return (
    <main>
      <SiteHeader active="wand" />

      <section className="product-hero">
        <div>
          <span className="status status-available">{wand.statusLabel}</span>
          <p className="eyebrow">{wand.category}</p>
          <h1>Meet Wand.</h1>
          <p className="hero-copy">{wand.description}</p>
          <div className="hero-actions">
            <a className="button button-primary" href={wand.downloadUrl ?? "#"}>Download latest version</a>
            <a className="button button-secondary" href="#install">How to install</a>
          </div>
          <p className="release-note">Version {wand.version} · Chrome for Windows · Updates published through GitHub Releases</p>
        </div>
        <div className="product-art" aria-hidden="true">
          <Image src="/products/wand.png" alt="" width={160} height={160} priority />
          <span>Wand</span>
        </div>
      </section>

      <section className="content-section" id="install">
        <div className="section-intro">
          <p className="eyebrow">Installation</p>
          <h2>Five steps. About two minutes.</h2>
          <p>Wand is installed as an unpacked Chrome extension. Downloading a newer release uses the same steps and preserves locally saved settings.</p>
        </div>
        <ol className="install-grid">
          <InstallStep number="1" title="Download Wand" description={<>Select <b>Download latest version</b> above. Chrome downloads <code>wand-extension-latest.zip</code>.</>}>
            <div className="step-visual download-visual"><span>ZIP</span><strong>wand-extension-latest.zip</strong></div>
          </InstallStep>
          <InstallStep number="2" title="Extract the ZIP" description={<>In Downloads, right-click the ZIP, choose <b>Extract all</b>, and keep the extracted folder somewhere permanent.</>}>
            <div className="step-visual folder-visual"><span>📁</span><strong>wand-extension-latest</strong><small>dist</small></div>
          </InstallStep>
          <InstallStep number="3" title="Open Extensions" description={<>Enter <code>chrome://extensions</code> in Chrome’s address bar, then turn on <b>Developer mode</b>.</>}>
            <div className="step-visual chrome-visual"><span>chrome://extensions</span><i>Developer mode&nbsp;&nbsp;●</i></div>
          </InstallStep>
          <InstallStep number="4" title="Load the dist folder" description={<>Select <b>Load unpacked</b>. Open the extracted Wand folder, select <code>dist</code>, and choose <b>Select Folder</b>.</>}>
            <div className="step-visual action-visual"><strong>Load unpacked</strong><span>wand-extension-latest › dist</span></div>
          </InstallStep>
          <InstallStep number="5" title="Pin and begin" description={<>Open Chrome’s Extensions menu, pin Wand, then refresh any open Canvas or UDOIT tabs.</>}>
            <div className="step-visual pin-visual"><Image src="/products/wand.png" alt="" width={34} height={34} /><strong>Wand</strong><span>📌</span></div>
          </InstallStep>
        </ol>
        <aside className="update-callout">
          <div><strong>Updating later</strong><p>Download the newest ZIP, replace the extracted folder, and select <b>Reload Wand</b> from the extension popup.</p></div>
          <a href={wand.downloadUrl ?? "#"}>Get the latest release →</a>
        </aside>
      </section>

      <section className="live-section">
        <div className="section-intro">
          <p className="eyebrow">What you will see</p>
          <h2>Wand stays with the review.</h2>
          <p>The red toolbar appears at the bottom of supported Canvas and UDOIT pages. It changes its guidance and available actions to match the active review item.</p>
        </div>
        <figure className="app-screenshot">
          <Image src="/screenshots/wand-udoit.png" alt="UDOIT in Canvas with the red Wand toolbar visible across the bottom of the review screen" width={1400} height={848} />
          <figcaption>Wand on the UDOIT dashboard in Rafael’s test course.</figcaption>
        </figure>
      </section>

      <section className="content-section" id="capabilities">
        <div className="section-intro compact">
          <p className="eyebrow">Current capabilities</p>
          <h2>Automation where it is safe. Guidance where judgment matters.</h2>
          <p>This list is rendered from the same product catalog that generates the repository’s capability table.</p>
        </div>
        <div className="capability-list">
          {catalog.wandCapabilities.map((capability) => (
            <article key={capability.name}>
              <div><h3>{capability.name}</h3><p>{capability.description}</p></div>
              <span className={`status status-${capability.status}`}>{capability.statusLabel}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="support-strip">
        <div><p className="eyebrow">Need help?</p><h2>Report it from Wand.</h2></div>
        <p>Use <b>Report bug</b> or <b>Suggest</b> in the Chrome popup or bottom toolbar. Reports stay on your device until the team connects an approved delivery service.</p>
      </section>

      <SiteFooter />
    </main>
  );
}

function InstallStep({ number, title, description, children }: { number: string; title: string; description: React.ReactNode; children: React.ReactNode }) {
  return (
    <li>
      <span className="step-number">{number}</span>
      <h3>{title}</h3>
      <p className="step-copy">{description}</p>
      {children}
    </li>
  );
}
