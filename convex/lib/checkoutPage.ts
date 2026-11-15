/**
 * The page behind the app's checkout sheet: one HTML document that mounts Whop's Checkout
 * element (Whop Elements) for a single checkout configuration. The card form is Whop's, inside
 * Whop's own frame, so no card detail ever touches this page or our backend.
 *
 * The app shows the page in a web view and cannot see inside it, so the page says what happens
 * with postMessage, as JSON: "ready" once the form is drawn, "complete" when the payment went
 * through, "failed" when the element could not load, and "returned" when Whop brought the buyer
 * back from an off-site step, such as 3-D Secure, without a payment. Those messages only move the
 * sheet. Whop's webhook is what marks a member paid.
 *
 * Pure: values in, a string out, so it is tested without a server.
 */

/** What every message carries, so the app can tell this page's messages from anything else's. */
export const CHECKOUT_MESSAGE_SOURCE = "lineup-checkout";

export type CheckoutPage = {
  /** A Whop checkout configuration id, "ch_…". */
  checkoutId: string;
  /** This page's own address. Whop sends the buyer back to it after an off-site payment step. */
  returnUrl: string;
  /** Set when Whop has just sent the buyer back: what became of the payment. */
  returned: "succeeded" | "failed" | "canceled" | null;
};

/** True for a Whop checkout configuration id and nothing else, which is what may reach the page. */
export function isCheckoutId(value: string): boolean {
  return /^ch_[A-Za-z0-9]+$/.test(value);
}

// The app's paper and ink (theme/tokens.ts), so the page reads as part of the sheet around it.
const PAPER = "#FAF8F2";
const INK = "#172B23";

export function checkoutPageHtml({ checkoutId, returnUrl, returned }: CheckoutPage): string {
  // A JSON string is a valid script literal once "<" is escaped, so no value can end the script.
  const literal = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Lineup buy-in</title>
    <style>
      html, body { margin: 0; background: ${PAPER}; }
      #note { margin: 0; padding: 32px 24px; font: 600 16px/22px system-ui, sans-serif; color: ${INK}; text-align: center; }
    </style>
    <script src="https://cdn.whop.com/elements/amber/elements.js" data-whop-elements></script>
  </head>
  <body>
    <div id="checkout"></div>
    <p id="note" hidden></p>
    <script type="module">
      const send = (message) => {
        const text = JSON.stringify({ source: ${literal(CHECKOUT_MESSAGE_SOURCE)}, ...message });
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
        else if (window.parent !== window) window.parent.postMessage(text, "*");
      };
      const say = (text) => {
        const note = document.querySelector("#note");
        note.textContent = text;
        note.hidden = false;
      };
      const returned = ${literal(returned)};
      if (returned === "succeeded") {
        say("Payment received.");
        send({ type: "complete" });
      } else if (returned !== null) {
        say("The payment did not go through. No money was taken.");
        send({ type: "returned", status: returned });
      } else {
        try {
          // Sandbox only, like every Whop call the backend makes.
          const whop = window.WhopElements({ environment: "sandbox" });
          const checkout = whop.checkout.create({
            checkoutConfiguration: ${literal(checkoutId)},
            returnUrl: ${literal(returnUrl)},
            onComplete: (completion) => {
              if (completion.result === "payment") send({ type: "complete" });
            },
            onLoadingChange: (loading) => {
              if (!loading) send({ type: "ready" });
            },
          });
          checkout.create("checkout").mount("#checkout");
        } catch (error) {
          say("Checkout could not load here.");
          send({ type: "failed", reason: String(error) });
        }
      }
    </script>
  </body>
</html>
`;
}
