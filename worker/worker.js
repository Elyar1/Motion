// ربات تلگرام: گفتگو با چند مدل رایگان + ارسال فایل به گیت‌هاب + رندر
// تنظیمات (Secrets) توی داشبورد Cloudflare گذاشته میشن، نه توی این فایل.

// مدل‌های Gemini خودکار از خود API گرفته میشن (دیگه لازم نیست دستی اضافه کنی).
// فقط مدل‌های غیر Gemini اینجا هستن:
const MODELS = {
  "groq-gpt-oss": { provider: "openai", base: "https://api.groq.com/openai/v1", keyName: "GROQ_API_KEY", id: "openai/gpt-oss-120b", label: "Groq GPT-OSS 120B", limit: 1000 },
  "openrouter-free": { provider: "openai", base: "https://openrouter.ai/api/v1", keyName: "OPENROUTER_API_KEY", id: "google/gemma-4-31b-it:free", label: "OpenRouter (Gemma رایگان)", limit: 50 },
};
const VERSION = "2026-11-16-i";
const DEFAULT_MODEL = "g:gemini-3.5-flash-lite";
const FALLBACK_GEMINI = ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash"];

// سقف روزانه (RPD) پلن رایگان؛ طبق صفحه rate-limit خود AI Studio (نوامبر ۲۰۲۶).
// اگه گوگل عوضشون کرد، فقط همین تابع رو ادیت کن.
function geminiLimit(id) {
  if (/gemma/.test(id)) return 14400;
  if (/pro|argon|carbon/.test(id)) return 0; // توی پلن رایگان صفره (طبق داشبورد)
  if (/flash-lite/.test(id)) return /3\.(5|1)/.test(id) ? 500 : 20;
  return 20; // flash های بزرگ و gemini-4-hydrogen
}

function resolve(key) {
  if (key && key.startsWith("g:")) {
    const id = key.slice(2);
    const label = id.replace(/^gemini-/, "Gemini ").replace(/^gemma-/, "Gemma ");
    return { key, provider: "gemini", id, label, limit: geminiLimit(id) };
  }
  if (key && MODELS[key]) return { key, ...MODELS[key] };
  return resolve(DEFAULT_MODEL);
}

const COMPOSITIONS = {
  MainComp: "قالب لیستی (متن‌ها از چت و JSON ساخته میشن)",
  CaveFire: "انیمیشن ثابت غارنشین و کشف آتش (متنش از چت عوض نمیشه)",
};

const CHAT_SYSTEM = `You are the chat assistant inside a Telegram bot that produces short vertical Persian (Farsi) motion-graphic videos.
How the bot works: the user chats with you about a video; when they send /render the conversation is turned into JSON; /ok renders the video with Remotion on GitHub Actions and sends the MP4 back.
Your job: discuss the topic and wording, write short scene texts, suggest improvements. Reply in casual, concise Persian.
Limits (be honest about them): you cannot see or edit the user's code or GitHub repo, you cannot run anything, and you have no memory of earlier days. Never greet as if you were continuing earlier work and never ask the user for code. If the user wants new animations, scenes or code changes, say that code is written separately (by Claude) and sent to this bot as a .zip file, or as a single file with its repo path in the caption; you only handle the text content.
Templates: "MainComp" = list video (4s intro, N items of 4.5s each, 3.5s outro; 30s = 5 items, 60s = 12 items, 70s = 14 items; item title under 18 chars, text under 60 chars). "CaveFire" = a fixed caveman-discovers-fire animation whose text cannot be changed from chat.
Bot commands the user can use: /render, /ok, /go, /comp (switch template), /models (switch AI model), /limits (usage), /new (new chat).`;

const JSON_SYSTEM = `You convert a conversation into the final content of a Persian motion-graphic video.
Return ONLY valid JSON (no markdown) in exactly this shape:
{
  "intro": { "title": "...", "subtitle": "..." },
  "habits": [ { "title": "...", "text": "..." } ],
  "outro": { "title": "...", "subtitle": "..." }
}
Rules: Persian language. intro.title max 25 chars, intro.subtitle max 35 chars.
habits[].title max 18 chars, habits[].text max 60 chars, one short sentence.
outro.title max 25 chars, outro.subtitle max 40 chars.
Number of items in "habits": use the count agreed in the conversation or implied by the requested length
(each item = 4.5s; intro+outro = 7.5s; 60s = 12 items). Default 5. Min 3, max 20.`;

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("ok");
    if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
      return new Response("forbidden", { status: 403 });
    }
    const update = await request.json();
    ctx.waitUntil(
      handle(update, env).catch(async (e) => {
        const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
        if (chatId && String(chatId) === String(env.ALLOWED_CHAT_ID)) {
          await send(env, chatId, "⚠️ خطا: " + String(e.message || e).slice(0, 800));
        }
      })
    );
    return new Response("ok");
  },
};

// ---------- ابزارهای تلگرام ----------
async function tg(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}
function send(env, chatId, text, extra = {}) {
  return tg(env, "sendMessage", { chat_id: chatId, text: String(text).slice(0, 4000), ...extra });
}

// ---------- وضعیت (KV) ----------
async function load(env, chatId) {
  const s = await env.KV.get(`s:${chatId}`, "json");
  return s || { model: DEFAULT_MODEL, history: [], draft: null };
}
function save(env, chatId, st) {
  st.history = st.history.slice(-24);
  return env.KV.put(`s:${chatId}`, JSON.stringify(st));
}

// ---------- مدل‌ها ----------
const day = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

async function geminiModelIds(env) {
  const cached = await env.KV.get("gemini-models-v2", "json");
  if (cached) return cached;
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
      headers: { "x-goog-api-key": env.GEMINI_API_KEY },
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const d = await r.json();
    const all = (d.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""))
      .filter((id) => /^(gemini|gemma)-/.test(id) && !/tts|image|live|embed|audio|robotics|computer|vision|latest|customtools|thinking-exp|transcribe|omni|translate|banana|nano|lyria|veo|imagen/.test(id))
      .filter((id) => geminiLimit(id) > 0)
      .sort((x, y) => y.localeCompare(x, "en", { numeric: true }));
    const ids = [...all.filter((id) => id.startsWith("gemini-")).slice(0, 8), ...all.filter((id) => id.startsWith("gemma-")).slice(0, 2)];
    if (!ids.length) throw new Error("empty");
    await env.KV.put("gemini-models-v2", JSON.stringify(ids), { expirationTtl: 21600 });
    return ids;
  } catch (e) {
    return FALLBACK_GEMINI;
  }
}

async function modelButtons(env, current) {
  const rows = [];
  if (env.GEMINI_API_KEY) {
    for (const id of await geminiModelIds(env)) {
      const m = resolve("g:" + id);
      rows.push([{ text: (m.key === current ? "✅ " : "") + m.label + (m.limit ? ` (${m.limit}/روز)` : ""), callback_data: m.key }]);
    }
  }
  for (const [k, m] of Object.entries(MODELS)) {
    if (env[m.keyName]) {
      rows.push([{ text: (k === current ? "✅ " : "") + m.label + ` (${m.limit}/روز)`, callback_data: k }]);
    }
  }
  return rows;
}

async function bump(env, m) {
  const k = `u:${day()}:${m.key}`;
  const n = parseInt((await env.KV.get(k)) || "0", 10) + 1;
  await env.KV.put(k, String(n), { expirationTtl: 172800 });
  return n;
}

async function callModel(env, key, system, messages) {
  const m = resolve(key);
  const used = await bump(env, m);
  const info = { label: m.label, used, limit: m.limit };
  if (m.provider === "gemini") {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${m.id}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify(
          /^gemma/.test(m.id)
            ? {
                contents: messages.map((x, i) => ({
                  role: x.role === "user" ? "user" : "model",
                  parts: [{ text: i === 0 ? system + "\n\n" + x.text : x.text }],
                })),
              }
            : {
                systemInstruction: { parts: [{ text: system }] },
                contents: messages.map((x) => ({
                  role: x.role === "user" ? "user" : "model",
                  parts: [{ text: x.text }],
                })),
              }
        ),
      }
    );
    if (!r.ok) throw new Error(friendly(m, r.status, await r.text()));
    const d = await r.json();
    const t = (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    if (!t) throw new Error(`${m.label}: پاسخ خالی`);
    return { text: t, ...info };
  }
  const r = await fetch(m.base + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + env[m.keyName] },
    body: JSON.stringify({
      model: m.id,
      messages: [
        { role: "system", content: system },
        ...messages.map((x) => ({ role: x.role === "user" ? "user" : "assistant", content: x.text })),
      ],
    }),
  });
  if (!r.ok) throw new Error(friendly(m, r.status, await r.text()));
  const d = await r.json();
  const t = d.choices?.[0]?.message?.content;
  if (!t) throw new Error(`${m.label}: پاسخ خالی`);
  return { text: t, ...info };
}

function friendly(m, status, body) {
  if (status === 429) return `${m.label}: سقف رایگان این مدل پر شده (یا خیلی تند پیام دادی). چند دقیقه صبر کن یا با /models مدل دیگه‌ای انتخاب کن. برای دیدن مصرف: /limits`;
  if (status === 404) return `${m.label}: این مدل پیدا نشد (اسمش عوض شده یا برای کلیدت فعال نیست). با /models مدل دیگه‌ای انتخاب کن.`;
  return `${m.label}: HTTP ${status} ${body.slice(0, 250)}`;
}

// ---------- مصرف و سقف‌ها ----------
async function renderStats(env) {
  try {
    const rr = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}`, { headers: ghHeaders(env) });
    const repo = await rr.json();
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
    const r = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPO}/actions/runs?per_page=100&created=%3E%3D${monthStart}`,
      { headers: ghHeaders(env) }
    );
    const runs = ((await r.json()).workflow_runs || []).filter((x) => /render(-chalk)?\.yml/.test(x.path || ""));
    const today = now.toISOString().slice(0, 10);
    const todayCount = runs.filter((x) => x.created_at.startsWith(today)).length;
    const minutes = runs.reduce((s, x) => {
      const ms = new Date(x.updated_at) - new Date(x.run_started_at || x.created_at);
      return s + Math.max(1, Math.ceil(ms / 60000));
    }, 0);
    const lines = ["🎬 رندر (گیت‌هاب)", `• امروز: ${todayCount} بار · این ماه: ${runs.length} بار`];
    if (repo.private) {
      lines.push(`• ریپو پرایوته: حدود ${minutes} از ۲۰۰۰ دقیقه‌ی ماهانه‌ی پلن رایگان مصرف شده (تخمینی)`);
    } else {
      lines.push(`• ریپو پابلیکه: رندر روی ران‌ر استاندارد محدودیت دقیقه نداره (مصرف این ماه حدود ${minutes} دقیقه)`);
    }
    return lines.join("\n");
  } catch (e) {
    return "🎬 رندر: آمار گیت‌هاب گرفته نشد (" + e.message + ")";
  }
}

async function limitsText(env) {
  const d = day();
  const list = await env.KV.list({ prefix: `u:${d}:` });
  const lines = ["📊 مصرف امروز از طریق همین بات (روز = ساعت آمریکای غربی)"];
  if (!list.keys.length) lines.push("• هنوز چیزی استفاده نشده");
  for (const k of list.keys) {
    const name = k.name.split(":").slice(2).join(":");
    const m = resolve(name);
    const used = await env.KV.get(k.name);
    lines.push(`• ${m.label}: ${used}${m.limit ? " / " + m.limit : ""}`);
  }
  lines.push(
    "",
    "سقف‌های رایگان (طبق صفحه rate-limit خودت):",
    "• Gemini 3.8 / 3.6 / 3 Flash و 4 Hydrogen: ۲۰ در روز، ۵ در دقیقه",
    "• Gemini 3.5 / 3.1 Flash-Lite: ۵۰۰ در روز، ۱۵ در دقیقه",
    "• Gemma 4 (26B / 31B): ۱۴٬۴۰۰ در روز، ۳۰ در دقیقه، ۱۶ هزار توکن در دقیقه",
    "• Gemini Pro (2.5 / 3.1): توی پلن رایگان صفره",
    "• Groq: ۱۰۰۰ در روز · OpenRouter: ۵۰ در روز",
    "فقط درخواست‌های همین بات شمرده میشن. عدد دقیق: aistudio.google.com/rate-limit",
    "",
    await renderStats(env)
  );
  return lines.join("\n");
}

// ---------- گیت‌هاب ----------
function ghHeaders(env) {
  return {
    Authorization: "Bearer " + env.GITHUB_TOKEN,
    Accept: "application/vnd.github+json",
    "User-Agent": "motion-bot",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}
function toB64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
async function githubPut(env, path, b64, message, repo) {
  const url = `https://api.github.com/repos/${repo || env.GITHUB_REPO}/contents/${path}`;
  const branch = env.GITHUB_BRANCH || "main";
  let sha;
  const g = await fetch(`${url}?ref=${branch}`, { headers: ghHeaders(env) });
  if (g.ok) sha = (await g.json()).sha;
  const r = await fetch(url, {
    method: "PUT",
    headers: ghHeaders(env),
    body: JSON.stringify({ message, content: b64, branch, ...(sha ? { sha } : {}) }),
  });
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 300)}`);
}
async function latestRun(env) {
  const r = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/actions/runs?per_page=10`, { headers: ghHeaders(env) });
  const d = await r.json();
  return (d.workflow_runs || []).find((x) => /render(-chalk)?\.yml/.test(x.path || "")) || null;
}
async function dispatchRender(env) {
  const r = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/render.yml/dispatches`,
    {
      method: "POST",
      headers: ghHeaders(env),
      body: JSON.stringify({ ref: env.GITHUB_BRANCH || "main" }),
    }
  );
  if (r.status !== 204) throw new Error(`Dispatch ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

async function getComposition(env) {
  try {
    const r = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPO}/contents/composition.txt?ref=${env.GITHUB_BRANCH || "main"}`,
      { headers: ghHeaders(env) }
    );
    if (!r.ok) return "MainComp";
    const d = await r.json();
    return atob(d.content.replace(/\n/g, "")).trim() || "MainComp";
  } catch (e) {
    return "MainComp";
  }
}
function setComposition(env, name) {
  return githubPut(env, "composition.txt", toB64(new TextEncoder().encode(name + "\n")), "set composition " + name);
}


// ---------- رندر مرد گچی + فایل‌های صوتی (ریپوی private) ----------
const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|amr|wma)$/i;
const EP_RE = /^[A-Za-z0-9_-]{1,32}$/;
const safeName = (s) => String(s || "").replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 80);
function assetsRepo(env) {
  return env.ASSETS_REPO || String(env.GITHUB_REPO).split("/")[0] + "/motion-assets";
}
async function lastEpisode(env) {
  return (await env.KV.get("last_ep")) || "ep1v2";
}
async function dispatchWorkflow(env, file, inputs) {
  const body = { ref: env.GITHUB_BRANCH || "main" };
  if (inputs) body.inputs = inputs;
  const r = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${file}/dispatches`, {
    method: "POST",
    headers: ghHeaders(env),
    body: JSON.stringify(body),
  });
  if (r.status !== 204) {
    const t = await r.text();
    if (r.status === 422 && /Unexpected inputs/i.test(t)) throw new Error("فایل workflow توی ریپو قدیمی‌تر از بات هست (ورودی‌های جدید رو نمی‌شناسه). نسخه‌ی جدید render-chalk-v3.yml رو دوباره بفرست.");
    throw new Error(`Dispatch ${r.status}: ${t.slice(0, 300)}`);
  }
}
function parseChalkArgs(tokens, lastEp) {
  const o = { episode: lastEp, start: "0", seconds: "0", audio: "mix", scale: "1080", crf: "24", shards: "6", deliver: "tg" };
  const nums = [];
  for (const t of tokens) {
    const low = t.toLowerCase();
    if (low === "preview") { o.audio = "none"; o.scale = "720"; continue; }
    if (low === "master" || low === "release") { o.deliver = "release"; continue; }
    if (low === "split") { o.deliver = "split"; continue; }
    if (/^\d+(\.\d+)?$/.test(t)) { nums.push(t); continue; }
    const m = low.match(/^([a-z]+)=(.+)$/);
    if (m) {
      const k = m[1], v = m[2];
      if (k === "start" || k === "from") o.start = v;
      else if (k === "sec" || k === "seconds" || k === "len") o.seconds = v;
      else if (k === "crf") o.crf = v;
      else if (k === "scale") o.scale = v;
      else if (k === "audio") o.audio = v;
      else if (k === "shards") o.shards = v;
      else if (k === "deliver") o.deliver = v;
      else return { error: "گزینه‌ی ناشناخته: " + t };
      continue;
    }
    if (EP_RE.test(t)) { o.episode = t; continue; }
    return { error: "نفهمیدم: " + t };
  }
  if (nums[0] !== undefined) o.start = nums[0];
  if (nums[1] !== undefined) o.seconds = nums[1];
  if (nums.length > 2) return { error: "فقط دو عدد (شروع و مدت) قبول می‌کنم." };
  const n = (v) => Number(v);
  if (!(n(o.start) >= 0) || !(n(o.seconds) >= 0)) return { error: "شروع و مدت باید عدد باشن." };
  if (!(Number.isInteger(n(o.crf)) && n(o.crf) >= 14 && n(o.crf) <= 35)) return { error: "crf باید عدد بین ۱۴ تا ۳۵ باشه." };
  if (!["1080", "720"].includes(o.scale)) return { error: "scale فقط 1080 یا 720." };
  if (!["mix", "none"].includes(o.audio)) return { error: "audio فقط mix یا none." };
  if (!(Number.isInteger(n(o.shards)) && n(o.shards) >= 1 && n(o.shards) <= 12)) return { error: "shards بین ۱ تا ۱۲." };
  if (!["tg", "release", "split"].includes(o.deliver)) return { error: "deliver فقط tg یا release یا split." };
  return { inputs: o };
}
async function runCanvas(env, chatId, tokens) {
  const p = parseChalkArgs(tokens, await lastEpisode(env));
  if (p.error) return send(env, chatId, "⚠️ " + p.error + "\n\nمثال: /go canvas ep1v2\n/go canvas preview 8.6 17.4\n/go canvas ep1v2 master");
  const o = p.inputs;
  await dispatchWorkflow(env, "render-chalk.yml", o);
  await env.KV.put("last_ep", o.episode);
  const range = Number(o.seconds) > 0 ? `از ثانیه ${o.start} به مدت ${o.seconds} ثانیه` : Number(o.start) > 0 ? `از ثانیه ${o.start} تا آخر` : "کل ویدیو";
  const dl = o.deliver === "release" ? "پیش‌نمایش توی تلگرام + مستر توی گیت‌هاب (private)" : o.deliver === "split" ? "چندتکه‌ی ۴۵ مگی توی تلگرام" : "مستقیم توی تلگرام";
  return send(env, chatId, [
    "🚀 رندر مرد گچی شروع شد",
    `قسمت: ${o.episode}`,
    `بازه: ${range}`,
    `کیفیت: ${o.scale}p · crf ${o.crf} · صدا: ${o.audio === "mix" ? "دارد" : "ندارد (پیش‌نمایش بی‌زیرنویس)"}`,
    `تحویل: ${dl}`,
    "/status برای وضعیت · /cancel برای لغو",
  ].join("\n"));
}
async function onAudio(env, chatId, msg, f, kind) {
  const cap = (msg.caption || "").trim().replace(/^audio\s+/i, "");
  let ep = null, name = null;
  if (cap) {
    const parts = cap.split(/[\s/]+/).filter(Boolean);
    if (parts[0] && EP_RE.test(parts[0])) { ep = parts[0]; name = parts.slice(1).join("_") || null; }
  }
  if (!ep) ep = await lastEpisode(env);
  const repo = assetsRepo(env);
  if (f.file_size && f.file_size > 18 * 1024 * 1024) {
    return send(env, chatId, `این فایل بیشتر از ۱۸ مگه و بات نمی‌تونه از تلگرام بگیره.\nخودت توی گیتهاب آپلودش کن:\nhttps://github.com/${repo}/upload/${env.GITHUB_BRANCH || "main"}/episodes/${ep}`);
  }
  const ext = ((f.file_name || "").match(/\.[A-Za-z0-9]+$/) || [kind === "voice" ? ".ogg" : f.mime_type === "audio/mpeg" ? ".mp3" : ".m4a"])[0];
  let fname = safeName(name || f.file_name || (kind === "voice" ? "voice_" : "audio_") + Date.now());
  if (!AUDIO_EXT.test(fname)) fname += ext;
  const path = `episodes/${ep}/${fname}`;
  const info = await tg(env, "getFile", { file_id: f.file_id });
  if (!info.ok) throw new Error("تلگرام فایل رو نداد: " + JSON.stringify(info).slice(0, 200));
  const fr = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${info.result.file_path}`);
  if (!fr.ok) throw new Error("دانلود فایل از تلگرام ناموفق: " + fr.status);
  const bytes = new Uint8Array(await fr.arrayBuffer());
  await githubPut(env, path, toB64(bytes), "audio from telegram: " + path, repo);
  await env.KV.put("last_ep", ep);
  return send(env, chatId, `✅ صدا ذخیره شد (ریپوی private، نه public)\n📁 ${repo}/${path}\n${Math.max(1, Math.round(bytes.length / 1024))} KB\nبرای دیدن فایل‌های این قسمت: /assets ${ep}`);
}
async function listAssets(env, chatId, ep) {
  const repo = assetsRepo(env);
  const r = await fetch(`https://api.github.com/repos/${repo}/contents/episodes${ep ? "/" + ep : ""}?ref=${env.GITHUB_BRANCH || "main"}`, { headers: ghHeaders(env) });
  if (r.status === 404) return send(env, chatId, ep ? `پوشه‌ی ${ep} وجود نداره یا خالیه.` : "هنوز قسمتی توی ریپوی private نیست.");
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const items = await r.json();
  const lines = items.map((i) => (i.type === "dir" ? `📁 ${i.name}` : `🎵 ${i.name} · ${Math.max(1, Math.round(i.size / 1024))} KB`));
  return send(env, chatId, `${repo}/episodes${ep ? "/" + ep : ""}\n` + (lines.join("\n") || "(خالی)"));
}


// ---------- تمیزکاری ریپوی public: لاگ‌ها، artifactها، ران‌های قدیمی ----------
function b64ToText(b64) {
  const bin = atob(String(b64).replace(/\n/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
// فقط خط‌هایی که جواب تلگرام رو توی لاگ عمومی چاپ می‌کنن و artifactهای طولانی
function quietWorkflow(text) {
  let hidden = 0, retention = 0;
  const src = text.split("\n");
  // آیا خروجی این دستور (که ممکنه چند خطی با \ باشه) از قبل به /dev/null می‌ره؟
  const alreadyQuiet = (i) => {
    for (let j = i; j < src.length; j++) {
      if (/\/dev\/null/.test(src[j])) return true;
      if (!/\\\s*$/.test(src[j])) return false;
    }
    return false;
  };
  const out = src.map((line, i) => {
    if (/^\s*curl -sS\b/.test(line) && /api\.telegram\.org/.test(line) && !alreadyQuiet(i)) {
      hidden++;
      return line.replace(/curl -sS\b/, "curl -sS -o /dev/null");
    }
    const m = line.match(/^(\s*retention-days:\s*)(\d+)\s*$/);
    if (m && Number(m[2]) > 1) { retention++; return m[1] + "1"; }
    return line;
  });
  return { text: out.join("\n"), hidden, retention };
}
async function quietWorkflows(env) {
  const files = [".github/workflows/render.yml", ".github/workflows/deploy-worker.yml", ".github/workflows/render-chalk.yml"];
  const lines = [];
  for (const f of files) {
    const r = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${f}?ref=${env.GITHUB_BRANCH || "main"}`, { headers: ghHeaders(env) });
    if (!r.ok) { lines.push(`• ${f.split("/").pop()}: پیدا نشد`); continue; }
    const j = await r.json();
    const q = quietWorkflow(b64ToText(j.content));
    if (!q.hidden && !q.retention) { lines.push(`• ${f.split("/").pop()}: از قبل تمیز بود`); continue; }
    await githubPut(env, f, toB64(new TextEncoder().encode(q.text)), "hide Telegram replies in public logs, shorter artifact retention");
    lines.push(`• ${f.split("/").pop()}: ${q.hidden} جواب تلگرام پنهان شد` + (q.retention ? `، ${q.retention} artifact به ۱ روز رسید` : ""));
  }
  return lines;
}
async function deleteOldRuns(env, cap) {
  let deleted = 0, skipped = 0, more = false;
  for (let round = 0; round < 4 && deleted < cap; round++) {
    const r = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/actions/runs?per_page=100`, { headers: ghHeaders(env) });
    const runs = (await r.json()).workflow_runs || [];
    let did = 0;
    for (const run of runs) {
      if (run.status !== "completed") { skipped++; continue; }
      if (deleted >= cap) { more = true; break; }
      const d = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/actions/runs/${run.id}`, { method: "DELETE", headers: ghHeaders(env) });
      if (d.status === 204) { deleted++; did++; } else skipped++;
    }
    if (!did) break;
  }
  return { deleted, skipped, more };
}
async function cleanLogs(env, chatId) {
  const wf = await quietWorkflows(env);
  const d = await deleteOldRuns(env, 35);
  return send(env, chatId, [
    "🧹 تمیزکاری ریپوی public",
    ...wf,
    `ران‌های قدیمی پاک شد: ${d.deleted} (همراه لاگ‌ها و artifactهاشون)` + (d.skipped ? ` · ${d.skipped} تا رد شد (در حال اجرا)` : ""),
    d.more || d.deleted >= 35 ? "ران‌های بیشتری مونده؛ دوباره /cleanlogs بزن." : "همه‌ی ران‌های تمام‌شده پاک شدن.",
  ].join("\n"));
}

// ---------- منطق اصلی ----------
async function handle(update, env) {
  // انتخاب مدل از دکمه‌ها
  const cb = update.callback_query;
  if (cb) {
    const chatId = cb.message.chat.id;
    if (String(chatId) !== String(env.ALLOWED_CHAT_ID)) return;
    if (cb.data === "go:canvas" || cb.data === "go:remotion") {
      await tg(env, "answerCallbackQuery", { callback_query_id: cb.id });
      if (cb.data === "go:remotion") {
        const comp = await getComposition(env);
        await dispatchRender(env);
        return send(env, chatId, `🚀 رندر Remotion شروع شد (قالب: ${comp}).`);
      }
      return runCanvas(env, chatId, []);
    }
    if (cb.data && (cb.data.startsWith("g:") || MODELS[cb.data])) {
      const st = await load(env, chatId);
      st.model = cb.data;
      await save(env, chatId, st);
      await tg(env, "answerCallbackQuery", { callback_query_id: cb.id });
      await send(env, chatId, "✅ مدل فعلی: " + resolve(st.model).label);
    }
    return;
  }

  const msg = update.message;
  if (!msg) return;
  const chatId = msg.chat.id;
  if (String(chatId) !== String(env.ALLOWED_CHAT_ID)) return;

  const st = await load(env, chatId);

  if (msg.audio) return onAudio(env, chatId, msg, msg.audio, "audio");
  if (msg.voice) return onAudio(env, chatId, msg, msg.voice, "voice");
  if (msg.document) {
    const d = msg.document;
    if ((d.mime_type || "").startsWith("audio/") || AUDIO_EXT.test(d.file_name || "")) return onAudio(env, chatId, msg, d, "document");
    return onDocument(env, chatId, msg);
  }

  const text = (msg.text || "").trim();
  if (!text) return;

  if (text.startsWith("/")) {
    const cmd = text.split(/[\s@]/)[0].toLowerCase();
    return onCommand(env, chatId, st, cmd, text);
  }

  // گفتگوی عادی
  st.history.push({ role: "user", text });
  try {
    const comp = await getComposition(env);
    const res = await callModel(env, st.model, CHAT_SYSTEM + `\nActive template in the repo right now: ${comp}.`, st.history);
    st.history.push({ role: "assistant", text: res.text });
    await save(env, chatId, st);
    const footer = `\n\n— ${res.label}${res.limit ? ` · امروز ${res.used}/${res.limit}` : ` · امروز ${res.used}`}`;
    await send(env, chatId, res.text + footer);
  } catch (e) {
    st.history.pop();
    await save(env, chatId, st);
    await send(env, chatId, "⚠️ " + e.message + "\n\nبا /models مدل دیگه‌ای انتخاب کن و دوباره بفرست.");
  }
}

async function onCommand(env, chatId, st, cmd, text) {
  if (cmd === "/start" || cmd === "/help") {
    return send(
      env,
      chatId,
      [
        "سلام! من بات موشن‌گرافیکم 🎬",
        "",
        "• معمولی چت کن تا درباره موضوع و متن‌ها حرف بزنیم.",
        "/render ← از گفتگو، پیش‌نویس ویدیو می‌سازم",
        "/ok ← پیش‌نویس رو می‌فرستم گیت‌هاب و رندر شروع میشه",
        "/go ← انتخاب موتور با دکمه",
        "/go canvas ← رندر کامل مرد گچی (آخرین قسمت)",
        "/go canvas ep2 ← قسمت مشخص",
        "/go canvas preview 8.6 17.4 ← پیش‌نمایش بی‌صدا ۷۲۰ از ثانیه ۸.۶ به مدت ۱۷.۴",
        "/go canvas master ← مستر باکیفیت توی گیت‌هاب private + پیش‌نمایش توی تلگرام",
        "/go canvas split ← تکه‌های ۴۵ مگی (با ZArchiver یا 7-Zip بازشون کن)",
        "/go remotion ← رندر Remotion مثل قبل",
        "/assets ep1v2 ← فایل‌های صوتی ذخیره‌شده‌ی اون قسمت",
        "/cleanlogs ← پاک‌کردن لاگ‌ها و artifactهای قدیمی ریپوی public + پنهان‌کردن جواب تلگرام توی لاگ‌ها",
        "/comp ← دیدن یا عوض کردن قالب (MainComp یا CaveFire)",
        "/models ← عوض کردن مدل (سقف رایگان هر مدل کنارش نوشته)",
        "/limits ← مصرف امروز، سقف مدل‌ها و آمار رندر",
        "/status ← وضعیت آخرین رندر · /cancel ← لغو رندر در حال اجرا",
        "/new ← شروع گفتگوی جدید",
        "/version ← نسخه‌ی کد بات",
        "• فایل worker.js با کپشن worker ← خود بات رو آپدیت می‌کنه",
        "",
        "فایل بفرستی:",
        "• ZIP ← باز میشه و روی پروژه اعمال میشه",
        "• یک فایل ← توی کپشن مسیرش رو بنویس (مثلاً src/config.ts)",
        "• صدا (mp3/m4a/wav/...) ← کپشن: ep1v2 یا ep1v2/main.wav → می‌ره توی ریپوی private، هیچ‌وقت public نمی‌شه (تا ۱۸ مگ)",
      ].join("\n")
    );
  }
  if (cmd === "/comp") {
    const arg = text.trim().split(/\s+/)[1];
    const cur = await getComposition(env);
    const list = Object.entries(COMPOSITIONS).map(([k, v]) => `• ${k}: ${v}`).join("\n");
    if (!arg) return send(env, chatId, `قالب فعلی: ${cur}\n\n${list}\n\nبرای تغییر: /comp MainComp یا /comp CaveFire`);
    const name = Object.keys(COMPOSITIONS).find((k) => k.toLowerCase() === arg.toLowerCase());
    if (!name) return send(env, chatId, "قالب ناشناخته.\n\n" + list);
    await setComposition(env, name);
    return send(env, chatId, `✅ قالب رندر شد: ${name}\nبرای رندر /go بزن.`);
  }
  if (cmd === "/status") {
    const run = await latestRun(env);
    if (!run) return send(env, chatId, "هنوز رندری ثبت نشده.");
    const started = new Date(run.run_started_at || run.created_at);
    const end = run.status === "completed" ? new Date(run.updated_at) : new Date();
    const sec = Math.max(0, Math.round((end - started) / 1000));
    const state =
      run.status === "queued" ? "در صف ⏳"
      : run.status === "in_progress" ? "در حال اجرا 🎬"
      : run.conclusion === "success" ? "تموم شد ✅"
      : run.conclusion === "cancelled" ? "لغو شد ⛔"
      : "خطا ❌";
    const chalk = /render-chalk/.test(run.path || "");
    let extra = "";
    if (chalk && run.status !== "completed") {
      try {
        const jr = await fetch(`${run.url}/jobs?per_page=50`, { headers: ghHeaders(env) });
        const sh = ((await jr.json()).jobs || []).filter((j) => /^shard/.test(j.name));
        if (sh.length) extra = `\nشاردها: ${sh.filter((j) => j.status === "completed").length}/${sh.length}`;
      } catch (e) {}
    }
    return send(env, chatId, `آخرین رندر (${chalk ? "مرد گچی" : "Remotion"}): ${state}\n⏱ ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}${extra}\n${run.html_url}`);
  }
  if (cmd === "/cancel") {
    const run = await latestRun(env);
    if (!run || run.status === "completed") return send(env, chatId, "رندر در حال اجرایی نیست.");
    const r = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/actions/runs/${run.id}/cancel`, {
      method: "POST",
      headers: ghHeaders(env),
    });
    return send(env, chatId, r.status === 202 ? "⛔ درخواست لغو رندر ارسال شد." : `لغو نشد (HTTP ${r.status}).`);
  }
  if (cmd === "/version") {
    return send(env, chatId, "نسخه‌ی در حال اجرای بات: " + VERSION);
  }
  if (cmd === "/new") {
    st.history = [];
    st.draft = null;
    await save(env, chatId, st);
    return send(env, chatId, "گفتگو پاک شد. موضوع جدید رو بگو.");
  }
  if (cmd === "/models") {
    return send(env, chatId, "مدل فعلی: " + resolve(st.model).label + "\nیکی رو انتخاب کن (عدد داخل پرانتز = سقف رایگان روزانه):", {
      reply_markup: { inline_keyboard: await modelButtons(env, st.model) },
    });
  }
  if (cmd === "/limits") {
    return send(env, chatId, await limitsText(env));
  }
  if (cmd === "/render") {
    if (!st.history.length) return send(env, chatId, "اول درباره موضوع ویدیو باهام حرف بزن.");
    const convo = st.history
      .map((h) => (h.role === "user" ? "User: " : "Assistant: ") + h.text)
      .join("\n");
    const raw = (await callModel(env, st.model, JSON_SYSTEM, [
      { role: "user", text: "Conversation:\n" + convo + "\n\nProduce the final JSON now." },
    ])).text;
    const a = raw.indexOf("{");
    const b = raw.lastIndexOf("}");
    if (a < 0 || b < 0) throw new Error("خروجی مدل JSON نبود. دوباره /render بزن یا مدل رو عوض کن.");
    const json = JSON.parse(raw.slice(a, b + 1));
    if (!json.intro || !json.outro || !Array.isArray(json.habits) || json.habits.length < 1) {
      throw new Error("ساختار JSON ناقصه. دوباره /render بزن.");
    }
    st.draft = json;
    await save(env, chatId, st);
    const secs = 4 + json.habits.length * 4.5 + 3.5;
    const lines = [
      `📝 پیش‌نویس (حدود ${Math.round(secs)} ثانیه)`,
      "",
      `${json.intro.title} — ${json.intro.subtitle}`,
      "",
      ...json.habits.map((h, i) => `${i + 1}. ${h.title}: ${h.text}`),
      "",
      `${json.outro.title} — ${json.outro.subtitle}`,
      "",
      "اگه خوبه /ok بزن. اگه نه، بگو چی عوض بشه و دوباره /render بزن.",
    ];
    return send(env, chatId, lines.join("\n"));
  }
  if (cmd === "/ok") {
    if (!st.draft) return send(env, chatId, "پیش‌نویسی نیست. اول /render بزن.");
    const bytes = new TextEncoder().encode(JSON.stringify(st.draft, null, 2));
    await githubPut(env, "src/content.json", toB64(bytes), "update content from telegram");
    await setComposition(env, "MainComp");
    st.draft = null;
    await save(env, chatId, st);
    await dispatchRender(env);
    return send(env, chatId, "🚀 رندر شروع شد. چند دقیقه دیگه ویدیو میاد.");
  }
  if (cmd === "/go") {
    const args = text.trim().split(/\s+/).slice(1);
    const engine = (args[0] || "").toLowerCase();
    if (!engine) {
      return send(env, chatId, "با کدوم موتور رندر بگیرم؟", {
        reply_markup: { inline_keyboard: [[{ text: "🧱 مرد گچی (Canvas)", callback_data: "go:canvas" }, { text: "🧩 Remotion", callback_data: "go:remotion" }]] },
      });
    }
    if (engine === "remotion") {
      const comp = await getComposition(env);
      await dispatchRender(env);
      return send(env, chatId, `🚀 رندر Remotion شروع شد (قالب: ${comp}). چند دقیقه دیگه ویدیو میاد.`);
    }
    if (engine === "canvas" || engine === "chalk") return runCanvas(env, chatId, args.slice(1));
    return send(env, chatId, "موتور ناشناخته. /go remotion یا /go canvas");
  }
  if (cmd === "/cleanlogs") return cleanLogs(env, chatId);
  if (cmd === "/assets") {
    return listAssets(env, chatId, text.trim().split(/\s+/)[1]);
  }
  return send(env, chatId, "دستور ناشناخته. /help رو بزن.");
}

async function onDocument(env, chatId, msg) {
  const doc = msg.document;
  const name = doc.file_name || "file";
  if (doc.file_size && doc.file_size > 18 * 1024 * 1024) {
    return send(env, chatId, "فایل بزرگ‌تر از ۱۸ مگابایته و قابل دریافت نیست.");
  }
  if ((msg.caption || "").trim().toLowerCase() === "worker") return selfUpdate(env, chatId, doc);
  const isZip = name.toLowerCase().endsWith(".zip");
  let path;
  if (isZip) {
    path = `uploads/${Date.now()}.zip`;
  } else {
    path = (msg.caption || "").trim().replace(/^\/+/, "");
    if (!path || path.includes("..")) {
      return send(env, chatId, "برای فایل تکی، مسیرش رو توی کپشن بنویس (مثلاً src/scenes/Scene1.tsx) و دوباره بفرست.");
    }
  }
  const info = await tg(env, "getFile", { file_id: doc.file_id });
  if (!info.ok) throw new Error("تلگرام فایل رو نداد: " + JSON.stringify(info).slice(0, 200));
  const fr = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${info.result.file_path}`);
  if (!fr.ok) throw new Error("دانلود فایل از تلگرام ناموفق: " + fr.status);
  const bytes = new Uint8Array(await fr.arrayBuffer());
  await githubPut(env, path, toB64(bytes), "upload from telegram: " + path);
  return send(
    env,
    chatId,
    isZip
      ? "✅ ZIP ذخیره شد. موقع رندر باز و اعمال میشه. برای شروع /go بزن."
      : `✅ ذخیره شد: ${path}\nبرای رندر /go بزن.`
  );
}


// ---------- آپدیت خودِ Worker از تلگرام ----------
// لازم: CF_API_TOKEN (دسترسی Workers Scripts: Edit)، CF_ACCOUNT_ID، CF_WORKER_NAME
async function selfUpdate(env, chatId, doc) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID || !env.CF_WORKER_NAME) {
    return send(env, chatId, "برای آپدیت از تلگرام باید سه Secret اضافه کنی: CF_API_TOKEN، CF_ACCOUNT_ID، CF_WORKER_NAME");
  }
  if (doc.file_size && doc.file_size > 5 * 1024 * 1024) {
    return send(env, chatId, "فایل برای کد Worker زیادی بزرگه.");
  }
  const info = await tg(env, "getFile", { file_id: doc.file_id });
  if (!info.ok) throw new Error("تلگرام فایل رو نداد");
  const fr = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${info.result.file_path}`);
  if (!fr.ok) throw new Error("دانلود فایل ناموفق: " + fr.status);
  const code = await fr.text();

  if (!code.includes("export default") || !code.includes("WEBHOOK_SECRET")) {
    return send(env, chatId, "این فایل شبیه کد بات نیست (export default یا WEBHOOK_SECRET پیدا نشد). آپدیت انجام نشد.");
  }

  const meta = {
    main_module: "worker.js",
    compatibility_date: "2025-11-01",
    keep_bindings: ["secret_text", "plain_text", "kv_namespace", "json"],
  };
  const fd = new FormData();
  fd.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  fd.append("worker.js", new Blob([code], { type: "application/javascript+module" }), "worker.js");

  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/workers/scripts/${env.CF_WORKER_NAME}`,
    { method: "PUT", headers: { Authorization: "Bearer " + env.CF_API_TOKEN }, body: fd }
  );
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.success) {
    const err = (d.errors || []).map((e) => `${e.code}: ${e.message}`).join(" | ") || "HTTP " + r.status;
    return send(env, chatId, "❌ آپدیت رد شد (نسخه‌ی قبلی سر جاشه):\n" + err.slice(0, 700));
  }
  return send(
    env,
    chatId,
    "✅ نسخه‌ی جدید آپلود شد. چند ثانیه صبر کن و /version بزن تا مطمئن بشی عوض شده.\nاگه بات جواب نداد: داشبورد Cloudflare ← Worker ← Deployments ← Rollback."
  );
}
