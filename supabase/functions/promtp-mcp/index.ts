import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { tools, toolMap, loadCtx, UserError, type Ctx } from "./tools.ts";

// deno-lint-ignore no-explicit-any
type Any = any;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const FN = "promtp-mcp";
const PUBLIC_BASE = SUPABASE_URL.replace(/^http:/, "https:");
const RESOURCE = `${PUBLIC_BASE}/functions/v1/${FN}`;
const RESOURCE_METADATA = `${RESOURCE}/.well-known/oauth-protected-resource`;
const AUTH_SERVER = `${PUBLIC_BASE}/auth/v1`;
const APP_URL = "https://promoteros.com";
const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id, accept",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
};
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", ...extra } });

// ---------- JSON-RPC ----------
const INSTRUCTIONS = `PromoterOS is a show-offer, deal and settlement tool for concert promoters.
Start with list_offers to find an offer_id. All money is USD. Use calculate_deal for what-if numbers (nothing is saved).
create_offer/update_offer recalculate the deal automatically. Always tell the user what changed and share the offer link.`;

async function handleRpc(msg: Any, ctx: Ctx): Promise<Any | null> {
  const { id, method, params } = msg || {};
  const reply = (result: Any) => ({ jsonrpc: "2.0", id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });
  if (id === undefined || id === null) return null; // notification

  switch (method) {
    case "initialize": {
      const v = VERSIONS.includes(params?.protocolVersion) ? params.protocolVersion : VERSIONS[0];
      return reply({
        protocolVersion: v,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "promoteros", title: "PromoterOS", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({
        tools: tools.map(({ name, title, description, inputSchema, annotations }) => ({
          name, title, description, inputSchema, annotations: { title, ...annotations },
        })),
      });
    case "resources/list":
      return reply({ resources: [] });
    case "prompts/list":
      return reply({ prompts: [] });
    case "tools/call": {
      const tool = toolMap.get(params?.name);
      if (!tool) return fail(-32602, `Unknown tool: ${params?.name}`);
      try {
        const out = await tool.run(ctx, params?.arguments || {});
        return reply({
          content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
          structuredContent: out && typeof out === "object" && !Array.isArray(out) ? out : { result: out },
          isError: false,
        });
      } catch (e) {
        const text = e instanceof UserError ? e.message : `Something went wrong: ${(e as Error).message}`;
        if (!(e instanceof UserError)) console.error(tool.name, e);
        return reply({ content: [{ type: "text", text }], isError: true });
      }
    }
    default:
      return fail(-32601, `Method not found: ${method}`);
  }
}

function unauthorized(desc = "Sign in to PromoterOS") {
  return json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: desc } }, 401, {
    "WWW-Authenticate": `Bearer realm="promoteros", error="invalid_token", error_description="${desc}", resource_metadata="${RESOURCE_METADATA}"`,
  });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*?\/promtp-mcp/, "") || "/";

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  if (path.startsWith("/.well-known/oauth-protected-resource")) {
    return json({
      resource: RESOURCE,
      authorization_servers: [AUTH_SERVER],
      scopes_supported: ["openid", "email", "profile"],
      bearer_methods_supported: ["header"],
      resource_name: "PromoterOS",
      resource_documentation: APP_URL,
    });
  }
  if (path.startsWith("/.well-known/oauth-authorization-server")) {
    // Convenience mirror for clients that look here first.
    const r = await fetch(`${PUBLIC_BASE}/.well-known/oauth-authorization-server/auth/v1`);
    return new Response(r.body, { status: r.status, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  if (req.method === "GET") {
    if ((req.headers.get("accept") || "").includes("text/event-stream")) {
      return new Response("SSE stream not supported", { status: 405, headers: { ...CORS, Allow: "POST" } });
    }
    return json({ name: "PromoterOS MCP server", endpoint: RESOURCE, docs: APP_URL });
  }
  if (req.method === "DELETE") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  if (!token) return unauthorized();
  // Validate up front so clients get a proper 401 and start the OAuth flow.
  const ctx = await loadCtx(token);
  if (!ctx) return unauthorized("Session expired - reconnect PromoterOS");

  let body: Any;
  try {
    body = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }

  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleRpc(m, ctx)))).filter(Boolean);
    return out.length ? json(out) : new Response(null, { status: 202, headers: CORS });
  }
  const out = await handleRpc(body, ctx);
  return out ? json(out) : new Response(null, { status: 202, headers: CORS });
});

