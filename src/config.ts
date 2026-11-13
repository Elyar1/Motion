import content from "./content.json";

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export const COLORS = {
  background: "#0f172a",
  card: "#1e293b",
  text: "#ffffff",
  muted: "#94a3b8",
  accent: "#38bdf8",
};

export const INTRO = { seconds: 4, ...content.intro };
export const HABITS: { title: string; text: string }[] = content.habits;
export const HABIT_SECONDS = 4.5;
export const OUTRO = { seconds: 3.5, ...content.outro };

export const TOTAL_SECONDS =
  INTRO.seconds + HABITS.length * HABIT_SECONDS + OUTRO.seconds;
