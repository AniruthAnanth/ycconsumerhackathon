import { httpAction } from "./_generated/server";

/**
 * POST /keiki/turn: inbound messages from the league's Keiki agent.
 *
 * Answers 503 until signature verification is added; an unverified turn must
 * never be processed.
 */
export const keikiTurn = httpAction(async () => {
  return new Response("Keiki signature verification is not implemented", {
    status: 503,
  });
});
