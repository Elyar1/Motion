import { continueRender, delayRender, staticFile } from "remotion";

export const FONT = "Vazirmatn";

const faces: [string, string][] = [
  ["Vazirmatn-Regular.woff2", "400"],
  ["Vazirmatn-Bold.woff2", "700"],
  ["Vazirmatn-ExtraBold.woff2", "800"],
];

const handle = delayRender("loading fonts");

Promise.all(
  faces.map(async ([file, weight]) => {
    try {
      const f = new FontFace(FONT, `url(${staticFile(file)}) format("woff2")`, { weight });
      await f.load();
      document.fonts.add(f);
    } catch (e) {
      console.warn("font not found, using fallback:", file);
    }
  })
).then(() => continueRender(handle));
