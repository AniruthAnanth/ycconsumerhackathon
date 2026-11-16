import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

/**
 * Whether the tabs use the system tab bar (expo-router NativeTabs: a real UITabBarController with
 * iOS 26 liquid glass, the selection pill and minimize-on-scroll). That is the iOS Release build.
 * Expo Go (storeClient) and the web keep the custom GlassTabBar, so a QR-code session and the web
 * build never depend on the native tab host.
 */
export const systemTabBar = Platform.OS === "ios" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
