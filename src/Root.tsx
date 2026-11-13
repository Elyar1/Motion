import { Composition } from "remotion";
import { MainComp } from "./MainComp";
import { FPS, WIDTH, HEIGHT, TOTAL_SECONDS } from "./config";

export const Root: React.FC = () => {
  return (
    <Composition
      id="MainComp"
      component={MainComp}
      durationInFrames={Math.round(FPS * TOTAL_SECONDS)}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
