import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from "@azure/functions";
import { buildBaseHeaders, handleRequest } from "../lib/handlers.js";
import { BlobObjStore } from "../lib/store.js";

let cachedStore: BlobObjStore | null = null;

function getStore(): BlobObjStore {
  if (!cachedStore) {
    const conn =
      process.env.SYNC_STORAGE_CONNECTION ??
      process.env.AzureWebJobsStorage ??
      "";
    if (!conn) {
      throw new Error("SYNC_STORAGE_CONNECTION is not configured");
    }
    cachedStore = new BlobObjStore(conn);
  }
  return cachedStore;
}

async function dispatch(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const method = request.method.toUpperCase();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const urlPath = new URL(request.url).pathname;
  const env = {
    ADMIN_KEY: process.env.ADMIN_KEY,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  };

  let body: Buffer | undefined;
  if (method === "PUT" || method === "POST") {
    const ab = await request.arrayBuffer();
    if (ab.byteLength > 0) {
      body = Buffer.from(ab);
    }
  }

  try {
    const res = await handleRequest(
      { method, path: urlPath, headers, body },
      getStore(),
      env,
    );
    return {
      status: res.status,
      headers: res.headers,
      body: res.body,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error";
    context.error(`Unhandled sync API error (${method} ${urlPath}): ${msg}`);
    return {
      status: 500,
      headers: {
        ...buildBaseHeaders({ headers }, env),
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ error: "internal_error" }),
    };
  }
}

app.http("health", {
  route: "health",
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  handler: dispatch,
});

app.http("register", {
  route: "register",
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: dispatch,
});

app.http("syncItem", {
  route: "sync/{datasetId}",
  methods: ["GET", "PUT", "OPTIONS"],
  authLevel: "anonymous",
  handler: dispatch,
});

app.http("syncHistory", {
  route: "sync/{datasetId}/history",
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  handler: dispatch,
});

app.http("syncHistoryItem", {
  route: "sync/{datasetId}/history/{id}",
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  handler: dispatch,
});

app.http("account", {
  route: "account",
  methods: ["DELETE", "OPTIONS"],
  authLevel: "anonymous",
  handler: dispatch,
});

app.http("adminInvites", {
  route: "invites",
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: dispatch,
});
