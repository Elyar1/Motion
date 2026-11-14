import { Composition } from "remotion";
import { MainComp } from "./MainComp";
import { CaveFire } from "./cave/CaveFire";
import { ChalkTest } from "./chalk/ChalkTest";
import { CAVE_TOTAL_FRAMES } from "./cave/timeline";
import { FPS, WIDTH, HEIGHT, TOTAL_SECONDS } from "./config";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="MainComp"
        component={MainComp}
        durationInFrames={Math.round(FPS * TOTAL_SECONDS)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="CaveFire"
        component={CaveFire}
        durationInFrames={CAVE_TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="ChalkTest"
        component={ChalkTest}
        durationInFrames={360}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
