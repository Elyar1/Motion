import { FPS } from "../config";

// مدت هر صحنه (ثانیه). جمع = ۴۰ ثانیه، هماهنگ با soundtrack.wav
export const CAVE_SECONDS = [6, 6, 7, 6, 9, 6];

export const CAVE_FRAMES = CAVE_SECONDS.map((s) => Math.round(s * FPS));
export const CAVE_STARTS = CAVE_FRAMES.map((_, i) =>
  CAVE_FRAMES.slice(0, i).reduce((a, b) => a + b, 0)
);
export const CAVE_TOTAL_FRAMES = CAVE_FRAMES.reduce((a, b) => a + b, 0);

export const CAVE_CAPTIONS = [
  "هزاران سال پیش، شب‌ها فقط تاریکی و سرما بود",
  "تا اینکه یه شب، رعد و برق به یه درخت خورد",
  "مرد غارنشین اول ترسید… ولی بعد کنجکاو شد",
  "اون یه چوب برداشت و شعله رو با خودش برد",
  "آتش سرما رو دور کرد، غذا رو پخت و شب رو روشن کرد",
  "",
];

export const CAVE_TITLE = { title: "آتش", subtitle: "اولین جرقه‌ی تمدن" };
