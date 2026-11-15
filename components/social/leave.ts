import { leaveScreen as leave } from "@/lib/leaveScreen";

/** leaveScreen as a press handler: it takes no arguments, so the press event never becomes the fallback. */
export const leaveScreen = () => leave();
