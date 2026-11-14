// ربات تلگرام: گفتگو با چند مدل رایگان + ارسال فایل به گیت‌هاب + رندر
// تنظیمات (Secrets) توی داشبورد Cloudflare گذاشته میشن، نه توی این فایل.

// مدل‌های Gemini خودکار از خود API گرفته میشن (دیگه لازم نیست دستی اضافه کنی).
// فقط مدل‌های غیر Gemini اینجا هستن:
const MODELS = {
  "groq-gpt-oss": { provider: "openai", base: "https://api.groq.com/openai/v1", keyName: "GROQ_API_KEY", id: "openai/gpt-oss-120b", label: "Groq GPT-OSS 120B", limit: 1000 },
  "openrouter-free": { provider: "openai", base: "https://openrouter.ai/api/v1", keyName: "OPENROUTER_API_KEY", id: "google/gemma-4-31b-it:free", label: "OpenRouter (Gemma رایگان)", limit: 50 },
};
const VERSION = "2026-11-14-c (self-update)";
const DEFAULT_MODEL = "g:gemini-3.5-flash-lite";
const FALLBACK_GEMINI = ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash"];

// سقف روزانه (RPD) پلن رایگان؛ طبق صفحه rate-limit خود AI Studio (نوامبر ۲۰۲۶).
// اگه گوگل عوضشون کرد، فقط همین تابع رو ادیت کن.
function geminiLimit(id) {
  if (/gemma/.test(id)) return 14400;
  if (/pro/.test(id)) return 0; // توی پلن رایگان صفره
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

const CHAT_SYSTEM = `You help the user plan short vertical motion-graphic list videos in Persian (Farsi).
Reply in casual, concise Persian. Video structure: a 4s intro, N list items (4.5s each), a 3.5s outro.
So 30s = 5 items, 45s = 8 items, 60s = 12 items, 70s = 14 items.
Help with topic, item titles and short texts. Keep each item title under 18 characters and text under 60 characters.`;

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
  const cached = await env.KV.get("gemini-models", "json");
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
      .filter((id) => /^(gemini|gemma)-/.test(id) && !/tts|image|live|embed|audio|robotics|computer|vision|latest|customtools|thinking-exp|transcribe|omni|translate/.test(id))
      .filter((id) => geminiLimit(id) > 0)
      .sort((x, y) => y.localeCompare(x, "en", { numeric: true }));
    const ids = [...all.filter((id) => id.startsWith("gemini-")).slice(0, 8), ...all.filter((id) => id.startsWith("gemma-")).slice(0, 2)];
    if (!ids.length) throw new Error("empty");
    await env.KV.put("gemini-models", JSON.stringify(ids), { expirationTtl: 21600 });
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
      `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/render.yml/runs?per_page=100&created=%3E%3D${monthStart}`,
      { headers: ghHeaders(env) }
    );
    const runs = (await r.json()).workflow_runs || [];
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
async function githubPut(env, path, b64, message) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`;
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

// ---------- منطق اصلی ----------
async function handle(update, env) {
  // انتخاب مدل از دکمه‌ها
  const cb = update.callback_query;
  if (cb) {
    const chatId = cb.message.chat.id;
    if (String(chatId) !== String(env.ALLOWED_CHAT_ID)) return;
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

  if (msg.document) return onDocument(env, chatId, msg);

  const text = (msg.text || "").trim();
  if (!text) return;

  if (text.startsWith("/")) {
    const cmd = text.split(/[\s@]/)[0].toLowerCase();
    return onCommand(env, chatId, st, cmd);
  }

  // گفتگوی عادی
  st.history.push({ role: "user", text });
  try {
    const res = await callModel(env, st.model, CHAT_SYSTEM, st.history);
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

async function onCommand(env, chatId, st, cmd) {
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
        "/go ← همین الان رندر بگیر (بعد از آپلود فایل)",
        "/models ← عوض کردن مدل (سقف رایگان هر مدل کنارش نوشته)",
        "/limits ← مصرف امروز، سقف مدل‌ها و آمار رندر",
        "/new ← شروع گفتگوی جدید",
        "/version ← نسخه‌ی کد بات",
        "• فایل worker.js با کپشن worker ← خود بات رو آپدیت می‌کنه",
        "",
        "فایل بفرستی:",
        "• ZIP ← باز میشه و روی پروژه اعمال میشه",
        "• یک فایل ← توی کپشن مسیرش رو بنویس (مثلاً src/config.ts)",
      ].join("\n")
    );
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
    st.draft = null;
    await save(env, chatId, st);
    await dispatchRender(env);
    return send(env, chatId, "🚀 رندر شروع شد. چند دقیقه دیگه ویدیو میاد.");
  }
  if (cmd === "/go") {
    await dispatchRender(env);
    return send(env, chatId, "🚀 رندر شروع شد. چند دقیقه دیگه ویدیو میاد.");
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
