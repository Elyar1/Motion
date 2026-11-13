import { Composition } from "remotion";
import { MainComp } from "./MainComp";
import { FPS, WIDTH, HEIGHT, DURATION_SECONDS } from "./config";

export const Root: React.FC = () => {
  return (
    <Composition
      id="MainComp"
      component={MainComp}
      durationInFrames={FPS * DURATION_SECONDS}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
