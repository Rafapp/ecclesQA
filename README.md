<div align="center">

# ✨ Project Fantasia

### Accessibility automation for UDOIT &amp; Canvas

</div>

Project Fantasia is a suite of tools for finding and fixing accessibility issues. It has three parts:

| Tool | What it is | Status |
| --- | --- | :-: |
| 🪄 **Wand** | Chrome extension that spots UDOIT issues and helps fix them in Canvas | 🟢 **Available now (v1.0.0)** |
| 🧙 **Sorcerer** | Server + web dashboard for sending accessibility jobs (auto-tag PDFs and more) | ⚪ Planned |
| 🔮 **Magic** | Windows desktop app that does what Sorcerer does, but on your own machine | ⚪ Planned |

> The rest of this guide covers **Wand**, the part you can use today.

---

# 🪄 Wand

**Fantasia v1.0.0**

Wand is a Chrome extension that spots accessibility issues in UDOIT and helps you fix them in Canvas, fast.

---

## ⬇️ Download

1. Go to the **[Releases page](../../releases)**.
2. Open the latest release (**Fantasia v1.0.0**).
3. Under **Assets**, click **`wand-extension-v1.0.0.zip`** to download it.

That's it for downloading. Now let's install it. 👇

---

## 🚀 Install in Chrome (5 easy steps)

> 💡 You only do this once. It takes about 2 minutes. No tech skills needed.

### Step 1. Unzip the file you downloaded
Find **`wand-extension-v1.0.0.zip`** in your **Downloads** folder. **Right-click it, then "Extract All"** (Windows) or **double-click it** (Mac). You'll get a folder. Remember where it is!

<!-- 📸 SCREENSHOT HERE: the unzipped folder showing manifest.json, content.js, etc. -->

### Step 2. Open Chrome's extensions page
In Chrome, click the address bar at the top, type this, and press **Enter**:

```
chrome://extensions
```

<!-- 📸 SCREENSHOT HERE: the chrome://extensions page -->

### Step 3. Turn on "Developer mode"
Look at the **top-right** corner of that page. Flip the **"Developer mode"** switch **ON**.

<!-- 📸 SCREENSHOT HERE: Developer mode toggle switched on (top-right) -->

### Step 4. Click "Load unpacked"
Three buttons appear on the top-left. Click **"Load unpacked"**, then select the **folder you unzipped in Step 1**.

<!-- 📸 SCREENSHOT HERE: the "Load unpacked" button + folder picker -->

### Step 5. Done! ✅
You'll see **Wand** appear in your list of extensions. 🎉

<!-- 📸 SCREENSHOT HERE: Wand card showing in the extensions list -->

---

## ▶️ How to use it

1. Open a course in **UDOIT** and run a scan like you normally would.
2. Look for the **Wand bar** along the **bottom** of the page. It shows what it found.
3. When you open a supported issue, click the **Wand button** and it'll open the matching Canvas page and **highlight the exact spot** to fix.

> 🔒 **Privacy:** Wand only runs on UDOIT and Canvas pages. It doesn't touch any other website.

---

## 🆘 Something not working?

| Problem | Fix |
| --- | --- |
| I don't see the Wand bar | Refresh the UDOIT/Canvas tab after installing. |
| "Load unpacked" did nothing | Make sure you picked the **unzipped folder**, not the `.zip` file. |
| It disappeared after restart | Re-open `chrome://extensions` and check it's still toggled **ON**. |

Still stuck? Ping the team. 💬

---

## 🗺️ Roadmap, our "Top 5" remediations

These are the five UDOIT issues we're teaching Wand to fix automatically, in priority order:

| # | Remediation | Status |
| :-: | --- | --- |
| 1 | Styles might be used instead of semantic markup for structure | 🟡 **Done, in testing** |
| 2 | Link has nondescript text | ⚪ Planned |
| 3 | Potential use of color alone to communicate information | ⚪ Planned |
| 4 | Alternative text uses filename rather than a descriptive label | ⚪ Planned |
| 5 | Video captions appear to be automatically generated and may contain errors | ⚪ Planned |

**Legend:** 🟢 Shipped &nbsp;•&nbsp; 🟡 Done, in testing &nbsp;•&nbsp; ⚪ Planned
