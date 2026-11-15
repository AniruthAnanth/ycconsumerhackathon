import { router } from "expo-router";

/**
 * Back for a screen's header or close button. A reload or deep link opens a screen with no
 * history, where router.back() throws "GO_BACK was not handled", so that case goes to the tabs.
 */
export const leaveScreen = () => (router.canGoBack() ? router.back() : router.replace("/"));
