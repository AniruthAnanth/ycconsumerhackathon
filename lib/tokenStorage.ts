import type { TokenStorage } from "@convex-dev/auth/react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// The session lives in the device keychain, which is what binds an anonymous
// account to this phone. SecureStore has no web implementation, so on web
// Convex Auth falls back to its default, localStorage.
export const tokenStorage: TokenStorage | undefined =
  Platform.OS === "web"
    ? undefined
    : {
        getItem: SecureStore.getItemAsync,
        setItem: SecureStore.setItemAsync,
        removeItem: SecureStore.deleteItemAsync,
      };
