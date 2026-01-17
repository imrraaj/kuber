import { TimeFrame } from "./timeframe"

abstract class Strategy {


    public TIME_FRAME: TimeFrame


    public constructor(timeFrame: TimeFrame) {
        this.TIME_FRAME = timeFrame;
    }
}

export { Strategy }