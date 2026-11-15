import { env, httpAction } from "./_generated/server";

/**
 * POST /whop: Whop payment webhooks.
 *
 * An event is only ever processed after its signature is verified against
 * WHOP_WEBHOOK_SECRET. Until that secret is set the endpoint answers 503, and
 * until verification is implemented it rejects every request, so an unverified
 * event can never mark a buy-in as paid.
 */
export const whopWebhook = httpAction(async () => {
  if (!env.WHOP_WEBHOOK_SECRET) {
    return new Response("WHOP_WEBHOOK_SECRET is not set", { status: 503 });
  }
  return new Response("Whop signature verification is not implemented", {
    status: 501,
  });
});
