<div align="center">

# ✨ Project Fantasia

### Issue-fixing and automation tools for the Eccles School of Business Instructional Design team

</div>

Project Fantasia is a suite of tools that help the Eccles instructional design team find and fix all kinds of course issues and automate repetitive work, across UDOIT, Canvas, and beyond. It has three parts:

| Tool | What it is | Status |
| --- | --- | :-: |
| 🪄 **Wand** | Chrome extension that spots issues and helps fix them right inside UDOIT and Canvas | 🟢 **Available now (v1.0.1)** |
| 🔮 **Magic** | Windows desktop app for running accessibility and data automation scripts on your own machine | 🟢 **Available now (v1.0.0)** |
| 🧙 **Sorcerer** | Server + web dashboard for sending automation jobs in bulk (auto-tag PDFs and more) | ⚪ Planned |

> This guide covers both **Wand** and **Magic**, the tools you can use today.

---

# 🪄 Wand

**Fantasia v1.0.0**

Wand is a Chrome extension that spots course issues in UDOIT and helps you fix them in Canvas, fast. It starts with accessibility and grows to cover more kinds of issues and automations over time.

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

# 🔮 Magic

**Magic v1.0.0**

Magic is a Windows desktop app that runs automation scripts on your machine — no browser, no server, no Python install needed. Everything is bundled in. Double-click and go.

Current scripts:

| Script | What it does |
| --- | --- |
| **MHA Competencies** | Collects Canvas outcomes `.csv` exports into one Excel workbook, one sheet per student |

---

## ⬇️ Download

1. Go to the **[Releases page](../../releases)**.
2. Open the latest **Magic** release (**Magic v1.0.0**).
3. Under **Assets**, click **`magic-application-v1.0.0.zip`** to download it.

---

## 🚀 Install (30 seconds)

> 💡 No installation required. No Python, no dependencies. Just unzip and run.

### Step 1. Unzip the file
Find **`magic-application-v1.0.0.zip`** in your **Downloads** folder. **Right-click → "Extract All"**. You'll get a single `.exe` file.

### Step 2. Run it
Double-click **`magic-v1.0.0-portable.exe`**.

> Windows may show a "Windows protected your PC" SmartScreen warning the first time because the app isn't signed. Click **"More info"** → **"Run anyway"**. This is expected for internal tools.

That's it. Magic opens. ✅

---

## ▶️ How to use it

### MHA Competencies

1. Export Canvas outcomes reports for each MHA course as `.csv` files and save them all into one folder.
2. Open Magic and click **Launch** next to **MHA Competencies**.
3. Set the **CSV Reports Folder** to the folder containing your `.csv` files.
4. Set the **Output Folder** to where you want the Excel workbook saved.
5. Give the output file a name (default: `MHA_Competencies_Output`).
6. Click **Run**.
7. Magic scans the files and shows you what it found — click **Continue** to proceed or **Abort** to stop.
8. When done, click **Open Output Folder** to see the result.

**Auto-approve all steps**: Check this box to skip confirmation prompts entirely — useful for large batches or overnight runs.

---

## 🆘 Something not working?

| Problem | Fix |
| --- | --- |
| SmartScreen blocks the app | Click "More info" → "Run anyway" |
| "No .csv files found" | Make sure your exports are `.csv` files in the folder you selected |
| Script errors on exit | Check the step timeline for the red error step — it will show the message |

Still stuck? Ping the team. 💬

---

## 🗺️ Roadmap, our "Top 5" remediations

We're starting with accessibility. These are the first five UDOIT issues we're teaching Wand to fix automatically, in priority order, with more issue types and automations to follow:

| # | Remediation | Status |
| :-: | --- | --- |
| 1 | Styles might be used instead of semantic markup for structure | 🟡 **Done, in testing** |
| 2 | Link has nondescript text | ⚪ Planned |
| 3 | Potential use of color alone to communicate information | ⚪ Planned |
| 4 | Alternative text uses filename rather than a descriptive label | ⚪ Planned |
| 5 | Video captions appear to be automatically generated and may contain errors | ⚪ Planned |

**Legend:** 🟢 Shipped &nbsp;•&nbsp; 🟡 Done, in testing &nbsp;•&nbsp; ⚪ Planned
