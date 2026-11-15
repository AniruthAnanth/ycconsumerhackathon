import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// SecureStore has no web implementation, so the browser build uses localStorage.
// Both calls swallow failures: a preference that cannot be read or saved only
// means the app starts from its default, which is never worth an error screen.

export async function readPreference(key: string): Promise<string | null> {
  try {
    return Platform.OS === "web" ? window.localStorage.getItem(key) : await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function writePreference(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === "web") window.localStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // See the note at the top of the file.
  }
}
