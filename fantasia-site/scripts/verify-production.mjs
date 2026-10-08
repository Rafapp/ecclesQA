import process from "node:process";
import https from "node:https";

const siteUrl = process.env.FANTASIA_SITE_URL ?? "https://fantasia-site.rpadiper.workers.dev";
const attempts = Number(process.env.FANTASIA_VERIFY_ATTEMPTS ?? 12);
const delayMs = Number(process.env.FANTASIA_VERIFY_DELAY_MS ?? 1000);
const loginForm = '<form method="post" action="/__auth/login">';

let lastError;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    const response = await request(siteUrl);
    if (response.statusCode === 200 && response.body.includes(loginForm)) {
      console.log(`Protected production check passed on attempt ${attempt}/${attempts}.`);
      process.exit(0);
    }
    lastError = new Error(`received HTTP ${response.statusCode} without the expected password gate`);
  } catch (error) {
    lastError = error;
  }
  if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs));
}

throw new Error(`Production verification failed for ${siteUrl}: ${lastError?.message ?? "unknown error"}`);

function request(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { "User-Agent": "Fantasia protected deployment check" } }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ statusCode: response.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
    });
    request.setTimeout(15_000, () => request.destroy(new Error("request timed out")));
    request.on("error", reject);
  });
}
