import { useEffect } from "react";

import type { CheckoutFrameProps } from "./CheckoutFrame.types";

/**
 * react-native-webview has no browser build, so on the web the checkout page sits in an iframe
 * and posts to this window. An iframe reports no load failure, so `onError` never fires here and
 * the sheet's own timeout covers a page that does not arrive.
 */
export function CheckoutFrame({ url, onMessage }: CheckoutFrameProps) {
  useEffect(() => {
    const origin = new URL(url).origin;
    const listen = (event: MessageEvent) => {
      if (event.origin === origin) onMessage(event.data);
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, [url, onMessage]);

  return (
    <iframe
      data-testid="checkout-frame"
      src={url}
      title="Checkout"
      allow="payment *"
      style={{ flex: 1, width: "100%", height: "100%", border: 0 }}
    />
  );
}
