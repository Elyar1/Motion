import { AbsoluteFill, Sequence } from "remotion";
import { COLORS, FPS, HABITS, HABIT_SECONDS, INTRO, OUTRO } from "./config";
import { TitleScene } from "./scenes/TitleScene";
import { HabitScene } from "./scenes/HabitScene";

export const MainComp: React.FC = () => {
  const introFrames = Math.round(INTRO.seconds * FPS);
  const habitFrames = Math.round(HABIT_SECONDS * FPS);
  const outroFrames = Math.round(OUTRO.seconds * FPS);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <Sequence from={0} durationInFrames={introFrames}>
        <TitleScene title={INTRO.title} subtitle={INTRO.subtitle} />
      </Sequence>

      {HABITS.map((h, i) => (
        <Sequence
          key={i}
          from={introFrames + i * habitFrames}
          durationInFrames={habitFrames}
        >
          <HabitScene index={i} total={HABITS.length} title={h.title} text={h.text} />
        </Sequence>
      ))}

      <Sequence
        from={introFrames + HABITS.length * habitFrames}
        durationInFrames={outroFrames}
      >
        <TitleScene title={OUTRO.title} subtitle={OUTRO.subtitle} />
      </Sequence>
    </AbsoluteFill>
  );
};
