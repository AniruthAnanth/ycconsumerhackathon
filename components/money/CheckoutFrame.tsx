import { StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

import { colors } from "@/theme";

import type { CheckoutFrameProps } from "./CheckoutFrame.types";

/**
 * The checkout page in a web view, which Expo Go ships. The browser build draws the same page
 * in an iframe instead (CheckoutFrame.web.tsx).
 */
export function CheckoutFrame({ url, onMessage, onError }: CheckoutFrameProps) {
  return (
    <WebView
      testID="checkout-frame"
      source={{ uri: url }}
      style={styles.frame}
      onMessage={(event) => onMessage(event.nativeEvent.data)}
      onError={onError}
      onHttpError={onError}
      // Whop opens 3-D Secure and bank pages from the form. On Android they stay in this view.
      setSupportMultipleWindows={false}
    />
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: colors.background },
});
