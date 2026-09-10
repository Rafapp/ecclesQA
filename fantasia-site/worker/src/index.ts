interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  ASSETS: Fetcher;
  SITE_PASSWORD: string;
  SESSION_SECRET: string;
}

const COOKIE_NAME = "__Host-fantasia_session";
const SESSION_SECONDS = 60 * 60 * 8;

const worker = {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/__auth/login") {
      return handleLogin(request, env);
    }

    if (url.pathname === "/__auth/logout") {
      return logout();
    }

    if (!await hasValidSession(request, env.SESSION_SECRET)) {
      return loginPage(url);
    }

    return env.ASSETS.fetch(request);
  },
};

export default worker;

async function handleLogin(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return loginPage(new URL(request.url), "Please enter the team password.");
  }

  const form = await request.formData();
  const password = form.get("password");
  if (typeof password !== "string" || !sameValue(password, env.SITE_PASSWORD)) {
    return loginPage(new URL(request.url), "That password was not recognized.");
  }

  const session = await createSession(env.SESSION_SECRET);
  return new Response(null, {
    status: 303,
    headers: {
      "Location": "/wand",
      "Set-Cookie": `${COOKIE_NAME}=${session}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`,
      "Cache-Control": "no-store",
    },
  });
}

function logout(): Response {
  return new Response(null, {
    status: 303,
    headers: {
      "Location": "/__auth/login",
      "Set-Cookie": `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`,
      "Cache-Control": "no-store",
    },
  });
}

function loginPage(url: URL, error?: string): Response {
  const message = error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : "";
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Project Fantasia</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8f7f4;color:#201f1d;font-family:Arial,sans-serif}.card{width:min(400px,calc(100% - 40px));padding:38px;border:1px solid #ddd9d2;border-radius:16px;background:#fff;box-shadow:0 18px 50px #201f1d1a}.mark{display:grid;width:38px;height:38px;place-items:center;border-radius:9px;background:#be0000;color:#fff;font-weight:800}h1{margin:20px 0 8px;font-size:32px;letter-spacing:-.04em}p{color:#66625d;line-height:1.5}label{display:grid;gap:8px;margin-top:24px;font-size:14px;font-weight:700}input{min-height:46px;padding:0 12px;border:1px solid #aaa49b;border-radius:7px;font:inherit}button{width:100%;min-height:46px;margin-top:16px;border:0;border-radius:7px;background:#be0000;color:#fff;font:700 14px Arial;cursor:pointer}.error{padding:10px;border-left:4px solid #be0000;background:#fff0ef;color:#6b0c0c;font-size:14px}</style></head><body><main class="card"><span class="mark">F</span><h1>Project Fantasia</h1><p>This site is for the Eccles instructional-design team.</p>${message}<form method="post" action="/__auth/login"><label>Team password<input type="password" name="password" autocomplete="current-password" required autofocus></label><button type="submit">Continue</button></form></main></body></html>`, {
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

async function createSession(secret: string): Promise<string> {
  const payload = base64UrlEncode(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }));
  return `${payload}.${await sign(payload, secret)}`;
}

async function hasValidSession(request: Request, secret: string): Promise<boolean> {
  const value = getCookie(request.headers.get("Cookie"), COOKIE_NAME);
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !sameValue(signature, await sign(payload, secret))) return false;
  try {
    const session = JSON.parse(base64UrlDecode(payload)) as { exp?: unknown };
    return typeof session.exp === "number" && session.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64UrlEncode(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

function sameValue(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

function getCookie(header: string | null, name: string): string | undefined {
  return header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

function base64UrlEncode(value: string | ArrayBuffer): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value: string): string {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" })[character] ?? character);
}
