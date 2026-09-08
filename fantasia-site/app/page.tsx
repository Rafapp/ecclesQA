import Image from "next/image";

const products = [
  {
    name: "Wand",
    eyebrow: "Browser companion",
    description: "Move through UDOIT findings with guided Canvas remediation, safer shortcuts, and clear progress feedback.",
    status: "Ready for testing",
    version: "v1.1.0",
    href: "#install-wand",
    icon: "/products/wand.png",
  },
  {
    name: "Magic",
    eyebrow: "Desktop automations",
    description: "Run reviewed, repeatable data workflows from a focused Windows desktop application.",
    status: "Available",
    version: "v1.0.0",
    href: "#install-magic",
    icon: "/products/magic.png",
  },
  {
    name: "Sorcerer",
    eyebrow: "Automation dashboard",
    description: "Coordinate longer-running accessibility and document workflows from a dedicated workstation.",
    status: "In development",
    version: "Preview",
    href: "#sorcerer",
    icon: "/products/sorcerer.png",
  },
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Fantasia home">
          <span className="wordmark-mark">F</span>
          <span>Project Fantasia</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#tools">Tools</a>
          <a href="#install-wand">Install</a>
          <a href="#help">Help</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">Eccles School productivity tools</p>
          <h1>Small tools.<br />Less friction.</h1>
          <p className="hero-copy">
            Fantasia helps our teams move through accessibility review and repeatable administrative work with clarity and control.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#install-wand">View Wand setup</a>
            <a className="button button-secondary" href="#tools">Explore the suite</a>
          </div>
        </div>
        <div className="hero-panel" aria-label="Fantasia principles">
          <span className="hero-orbit hero-orbit-one" />
          <span className="hero-orbit hero-orbit-two" />
          <div className="hero-panel-copy">
            <strong>Human reviewed</strong>
            <span>Automation assists. People decide.</span>
          </div>
        </div>
      </section>

      <section className="section" id="tools">
        <div className="section-heading">
          <div>
            <p className="eyebrow">The suite</p>
            <h2>One home for every tool.</h2>
          </div>
          <p>Each product stays focused. The shared site keeps installation, releases, and support easy to find.</p>
        </div>
        <div className="product-grid">
          {products.map((product) => (
            <article className="product-card" key={product.name} id={product.name === "Sorcerer" ? "sorcerer" : undefined}>
              <div className="product-card-top">
                <Image src={product.icon} alt="" width={48} height={48} />
                <span className={`status ${product.status === "Available" ? "status-live" : "status-progress"}`}>{product.status}</span>
              </div>
              <p className="product-eyebrow">{product.eyebrow}</p>
              <h3>{product.name}</h3>
              <p>{product.description}</p>
              <div className="product-card-footer">
                <span>{product.version}</span>
                <a href={product.href}>{product.name === "Magic" ? "Install" : "Learn more"} <span aria-hidden="true">→</span></a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="install-preview" id="install-wand">
        <div>
          <p className="eyebrow">Wand · v1.1.0</p>
          <h2>Setup guidance is ready.</h2>
          <p>Wand is a Chrome extension for UDOIT and Canvas. The current build is ready for internal testing; team distribution is paused while University IT reviews the deployment options.</p>
          <span className="button button-disabled download-button" aria-disabled="true">Distribution pending IT</span>
          <p className="download-note">Windows · Chrome · University Canvas access required</p>
        </div>
        <ol className="step-list">
          <li><span>1</span><div><strong>Download and extract</strong><p>Open the ZIP, choose <b>Extract all</b>, and keep the resulting folder somewhere permanent.</p></div></li>
          <li><span>2</span><div><strong>Open Chrome extensions</strong><p>Enter <code>chrome://extensions</code> in Chrome and turn on <b>Developer mode</b>.</p></div></li>
          <li><span>3</span><div><strong>Load Wand</strong><p>Choose <b>Load unpacked</b>, open the extracted package, and select its <code>dist</code> folder.</p></div></li>
          <li><span>4</span><div><strong>Pin and start</strong><p>Pin Wand from Chrome’s Extensions menu, then open UDOIT in Canvas. Use the Wand icon to pause or reload it.</p></div></li>
        </ol>
      </section>

      <section className="install-section" id="install-magic">
        <div className="install-section__intro">
          <div>
            <p className="eyebrow">Magic · v1.0.0</p>
            <h2>A portable Windows automation launcher.</h2>
          </div>
          <div>
            <p>Magic packages its runtime with the app. There is no installer and no separate Python setup for end users.</p>
            <a className="button button-primary" href="https://github.com/Rafapp/ecclesQA/releases/download/magic-v1.0.0/magic-application-v1.0.0.zip">Download Magic v1.0.0</a>
          </div>
        </div>

        <div className="screenshot-grid">
          <figure>
            <div className="screenshot-frame screenshot-home"><Image src="/screenshots/magic-home.png" alt="Magic v1.0.0 showing the available MHA Competencies automation and its Launch button" width={1080} height={1755} /></div>
            <figcaption><span>1</span><div><strong>Choose an automation</strong><p>Open Magic and select <b>Launch</b> beside the workflow you need.</p></div></figcaption>
          </figure>
          <figure>
            <div className="screenshot-frame screenshot-run"><Image src="/screenshots/magic-run.png" alt="Magic MHA Competencies setup window with input and output folder choices" width={1080} height={1755} /></div>
            <figcaption><span>2</span><div><strong>Review inputs and outputs</strong><p>Choose the source and destination folders, confirm the file name, and select <b>Run</b>.</p></div></figcaption>
          </figure>
        </div>

        <ol className="compact-steps" aria-label="Magic installation steps">
          <li><strong>Download</strong><span>Get the Magic ZIP above.</span></li>
          <li><strong>Extract all</strong><span>Do not run the app from inside the ZIP.</span></li>
          <li><strong>Open Magic</strong><span>Double-click the portable <code>.exe</code>.</span></li>
          <li><strong>If Windows asks</strong><span>Choose <b>More info</b>, then <b>Run anyway</b>. The current internal build is unsigned.</span></li>
        </ol>
      </section>

      <section className="future-section" aria-labelledby="future-title">
        <div>
          <p className="eyebrow">Built to grow</p>
          <h2 id="future-title">The same simple path for every release.</h2>
        </div>
        <div className="future-grid">
          <article><span>01</span><h3>Versioned downloads</h3><p>Each tool points to a specific tested release instead of a moving development folder.</p></article>
          <article><span>02</span><h3>Focused instructions</h3><p>Installation and first-run guidance lives beside the download that needs it.</p></article>
          <article><span>03</span><h3>Room for Sorcerer</h3><p>The dashboard can join this site with its own status, setup, and operating guide when ready.</p></article>
        </div>
      </section>

      <section className="help-strip" id="help">
        <div><p className="eyebrow">Need help?</p><h2>Clear support, built into the tools.</h2></div>
        <p>Open Wand from the Chrome toolbar—or use its Canvas panel—to save a bug report or suggestion with useful context. Reports stay on your device until central delivery is connected.</p>
      </section>

      <footer><span>Project Fantasia</span><span>Human-reviewed productivity tools for the Eccles School.</span></footer>
    </main>
  );
}
