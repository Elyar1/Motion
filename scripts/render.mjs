// رندر با نوار پیشرفت زنده توی تلگرام + آمار گیت‌هاب بعد از پایان
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;
let msgId = process.env.MSG_ID && process.env.MSG_ID !== "null" ? Number(process.env.MSG_ID) : null;
const t0 = Date.now();
const compId = (readFileSync("composition.txt", "utf8").trim() || "MainComp");

const fa = (s) => String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const bar = (p) => "█".repeat(Math.round(p / 10)) + "░".repeat(10 - Math.round(p / 10));

async function tg(method, body) {
  if (!TOKEN || !CHAT) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT, ...body }),
    });
    return await r.json();
  } catch {
    return null;
  }
}

let lastText = "";
let lastAt = 0;
let busy = false;
async function show(stage, pct, force = false) {
  const el = (Date.now() - t0) / 1000;
  const eta = pct > 5 && pct < 100 ? (el / pct) * (100 - pct) : null;
  const text =
    `🎬 ${stage}\n${bar(pct)} ${fa(Math.round(pct))}٪\n⏱ ${fa(mmss(el))}` +
    (eta !== null ? ` · باقی‌مونده حدود ${fa(mmss(eta))}` : "");
  if (text === lastText || busy) return;
  if (!force && Date.now() - lastAt < 7000) return;
  busy = true;
  lastText = text;
  lastAt = Date.now();
  try {
    if (msgId) await tg("editMessageText", { message_id: msgId, text });
    else {
      const r = await tg("sendMessage", { text });
      msgId = r?.result?.message_id ?? null;
    }
  } finally {
    busy = false;
  }
}

async function stats() {
  const repo = process.env.GITHUB_REPOSITORY;
  const gh = process.env.GITHUB_TOKEN;
  if (!repo || !gh) return "";
  const H = { Authorization: `Bearer ${gh}`, Accept: "application/vnd.github+json", "User-Agent": "motion-bot" };
  try {
    const info = await (await fetch(`https://api.github.com/repos/${repo}`, { headers: H })).json();
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
    const runs =
      (
        await (
          await fetch(
            `https://api.github.com/repos/${repo}/actions/workflows/render.yml/runs?per_page=100&created=%3E%3D${start}`,
            { headers: H }
          )
        ).json()
      ).workflow_runs || [];
    const minutes = runs.reduce(
      (s, r) => s + Math.max(1, Math.ceil((new Date(r.updated_at) - new Date(r.run_started_at || r.created_at)) / 60000)),
      0
    );
    return info.private
      ? `📊 این ماه: ${fa(runs.length)} رندر · حدود ${fa(minutes)} از ${fa(2000)} دقیقه`
      : `📊 این ماه: ${fa(runs.length)} رندر (ریپو پابلیک: بدون سقف دقیقه)`;
  } catch {
    return "";
  }
}

try {
  await show("آماده‌سازی پروژه…", 0, true);
  const serveUrl = await bundle({
    entryPoint: path.resolve("src/index.ts"),
    publicDir: path.resolve("public"),
    onProgress: (p) => show("بسته‌بندی پروژه", p * 0.1),
  });
  const composition = await selectComposition({ serveUrl, id: compId, inputProps: {} });
  await show(`شروع رندر «${compId}»`, 10, true);

  mkdirSync("out", { recursive: true });
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf: 22,
    imageFormat: "jpeg",
    overwrite: true,
    outputLocation: "out/video.mp4",
    onProgress: ({ progress, renderedFrames, encodedFrames, stitchStage }) => {
      const stage =
        stitchStage === "muxing"
          ? "ترکیب صدا و تصویر"
          : encodedFrames > 0 && renderedFrames >= composition.durationInFrames
            ? "انکد ویدیو"
            : `رندر فریم‌ها ${fa(renderedFrames)}/${fa(composition.durationInFrames)}`;
      return show(stage, 10 + progress * 90);
    },
  });

  const secs = (Date.now() - t0) / 1000;
  await show("رندر تموم شد، دارم می‌فرستم…", 100, true);
  const caption = `رندر تموم شد ✅\n⏱ ${fa(mmss(secs))}\n${await stats()}`.trim();
  writeFileSync("out/caption.txt", caption);
  console.log("done in", secs.toFixed(0), "s");
} catch (e) {
  console.error(e);
  await tg(msgId ? "editMessageText" : "sendMessage", {
    ...(msgId ? { message_id: msgId } : {}),
    text: "❌ رندر خطا داد. جزئیات توی پیام بعدی میاد.",
  });
  process.exit(1);
}
