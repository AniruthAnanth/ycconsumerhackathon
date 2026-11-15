import { httpRouter } from "convex/server";

import { auth } from "./auth";
import { keikiTurn } from "./keiki";
import { invitePage } from "./referrals";
import { checkoutPage, whopWebhook } from "./whop";

// This file only routes. Handlers live in the module of their domain.
const http = httpRouter();

auth.addHttpRoutes(http);

http.route({ path: "/whop", method: "POST", handler: whopWebhook });
http.route({ path: "/whop/checkout", method: "GET", handler: checkoutPage });
http.route({ path: "/keiki/turn", method: "POST", handler: keikiTurn });
http.route({ pathPrefix: "/i/", method: "GET", handler: invitePage });

export default http;
