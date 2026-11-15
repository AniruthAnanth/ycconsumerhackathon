import * as Sharing from "expo-sharing";
import { Platform, Share } from "react-native";

/**
 * The system share sheet, for text (the league invite) and for an image (a Wrapped card).
 * Both resolve to whether the sheet could open; a cancelled sheet is not an error.
 */

export async function shareText(message: string, title?: string): Promise<boolean> {
  try {
    await Share.share(title ? { message, title } : { message });
    return true;
  } catch {
    return false;
  }
}

/** Shares a local image file (file://), for example a card captured with react-native-view-shot. */
export async function shareImage(fileUri: string, dialogTitle?: string): Promise<boolean> {
  if (Platform.OS === "web" || !(await Sharing.isAvailableAsync())) return false;
  try {
    await Sharing.shareAsync(fileUri, { mimeType: "image/png", UTI: "public.png", dialogTitle });
    return true;
  } catch {
    return false;
  }
}

