import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

http.route({
  path: "/auth/refresh",
  method: "OPTIONS",
  handler: httpAction(
    async () => new Response(null, { status: 204, headers: corsHeaders }),
  ),
});

http.route({
  path: "/auth/refresh",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body." }, 400);
    }

    const refreshToken =
      typeof body === "object" &&
      body !== null &&
      "refreshToken" in body &&
      typeof body.refreshToken === "string"
        ? body.refreshToken
        : "";

    if (!refreshToken.trim()) {
      return jsonResponse({ error: "Missing refreshToken." }, 400);
    }

    try {
      const session = await ctx.runAction(api.auth.refreshSession, {
        refreshToken,
      });
      return jsonResponse(session);
    } catch {
      return jsonResponse({ error: "Session abgelaufen." }, 401);
    }
  }),
});

export default http;
