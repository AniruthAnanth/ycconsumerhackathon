import { router, type Href } from "expo-router";

/**
 * Back for a screen's header or close button. A reload or deep link opens a screen with no
 * history, where router.back() throws "GO_BACK was not handled", so that case goes to
 * `fallback`, by default the tabs.
 *
 * Call it inside the handler, as in `onBack={() => leaveScreen("/(tabs)")}`. Passed as the
 * handler itself it would receive the press event as `fallback`.
 */
export const leaveScreen = (fallback: Href = "/") => (router.canGoBack() ? router.back() : router.replace(fallback));
