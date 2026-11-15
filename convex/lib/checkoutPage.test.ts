import { describe, expect, test } from "vitest";

import { checkoutPageHtml, isCheckoutId } from "./checkoutPage";

const page = { checkoutId: "ch_8Ux4kgefzRCyCgl", returnUrl: "https://lineup.test/whop/checkout?ch=ch_8Ux4kgefzRCyCgl", returned: null };

describe("isCheckoutId", () => {
  test("takes a Whop checkout configuration id and nothing else", () => {
    expect(isCheckoutId("ch_8Ux4kgefzRCyCgl")).toBe(true);
    for (const value of ["", "plan_abc", "ch_", 'ch_1";alert(1)//', "ch_1</script>", " ch_1"]) {
      expect(isCheckoutId(value)).toBe(false);
    }
  });
});

describe("checkoutPageHtml", () => {
  test("mounts Whop's sandbox Checkout element for the configuration, with this page as the return address", () => {
    const html = checkoutPageHtml(page);

    expect(html).toContain('<script src="https://cdn.whop.com/elements/amber/elements.js" data-whop-elements></script>');
    expect(html).toContain('window.WhopElements({ environment: "sandbox" })');
    expect(html).toContain('checkoutConfiguration: "ch_8Ux4kgefzRCyCgl"');
    expect(html).toContain('returnUrl: "https://lineup.test/whop/checkout?ch=ch_8Ux4kgefzRCyCgl"');
    expect(html).toContain("const returned = null;");
  });

  test("back from an off-site step, it reports the outcome it was given", () => {
    expect(checkoutPageHtml({ ...page, returned: "succeeded" })).toContain('const returned = "succeeded";');
    expect(checkoutPageHtml({ ...page, returned: "canceled" })).toContain('const returned = "canceled";');
  });

  test("no value can close the script it is written into", () => {
    const html = checkoutPageHtml({ ...page, returnUrl: "https://lineup.test/</script><script>alert(1)</script>" });

    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).toContain("\\u003c/script>");
  });
});
