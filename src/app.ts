import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import {
  DEFAULT_LANGUAGE,
  TEXTS,
  isLanguage,
  type Language,
} from "./locales/index.js";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "./db.js";
import {
  deleteSession,
  readSession,
  signIn,
  touchSession,
  type SignedIn,
} from "./store.js";
import {
  dashboardPage,
  homePage,
  refusalPage,
  signInPage,
} from "./views/pages.js";
import { STYLE } from "./views/style.js";

declare module "fastify" {
  interface FastifyRequest {
    /** The signed-in volunteer, read once per request. */
    signedIn?: SignedIn;
  }
}

export interface AppConfig {
  /** The origin visitors reach the app at, e.g. `https://pret.example.org`. */
  publicOrigin: string;
  /** The SQLite database file, e.g. the value of `DATABASE_PATH`. */
  databasePath: string;
  /** The current time; the system clock by default. */
  now?: () => Date;
  /** Logs requests and errors to stdout. */
  logger?: boolean;
}

const LANGUAGE_COOKIE = "lang";
const SESSION_COOKIE = "session";
const ONE_YEAR = 365 * 24 * 60 * 60;

/** The value of a cookie the browser sends, if any. */
function cookie(request: FastifyRequest, name: string): string | undefined {
  for (const part of (request.headers.cookie ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0 || part.slice(0, eq).trim() !== name) continue;
    return part.slice(eq + 1).trim();
  }
  return undefined;
}

/** The language the visitor's browser keeps, if it is a language. */
function keptLanguage(request: FastifyRequest): Language | undefined {
  const value = cookie(request, LANGUAGE_COOKIE);
  return isLanguage(value) ? value : undefined;
}

/** The answers that are a refusal of the request. */
function isRefusal(status: number): boolean {
  return status === 400 || status === 403 || status === 404 || status >= 500;
}

/** The form fields of a request, each given exactly once, or undefined. */
function fields<K extends string>(
  request: FastifyRequest,
  names: readonly K[],
): Record<K, string> | undefined {
  const form =
    request.body instanceof URLSearchParams
      ? request.body
      : new URLSearchParams();
  const out = {} as Record<K, string>;
  for (const name of names) {
    const values = form.getAll(name);
    if (values.length !== 1) return undefined;
    out[name] = values[0] as string;
  }
  return out;
}

function displayLanguage(request: FastifyRequest): Language {
  return keptLanguage(request) ?? DEFAULT_LANGUAGE;
}

function withHeaders(reply: FastifyReply): FastifyReply {
  return reply.headers({
    "x-frame-options": "DENY",
    "content-security-policy": "frame-ancestors 'none'",
    "x-content-type-options": "nosniff",
  });
}

const MESSAGES = {
  400: "malformed",
  403: "forbidden",
  404: "notFound",
  500: "internalError",
} as const;

function refuse(
  request: FastifyRequest,
  reply: FastifyReply,
  status: keyof typeof MESSAGES,
): FastifyReply {
  const language = displayLanguage(request);
  const message = TEXTS[language][MESSAGES[status]];
  return withHeaders(reply)
    .code(status)
    .type("text/html; charset=utf-8")
    .send(refusalPage(language, message));
}

export function buildApp(config: AppConfig): FastifyInstance {
  const publicOrigin = new URL(config.publicOrigin).origin;
  const secure = publicOrigin.startsWith("https:");
  const now = config.now ?? (() => new Date());
  const db: DatabaseSync = openDatabase(config.databasePath);
  const app = Fastify({
    logger: config.logger ?? false,
    // A request Fastify cannot route (e.g. a bad URL) is malformed too.
    frameworkErrors: (_error, request, reply) => refuse(request, reply, 400),
  });

  app.addHook("onSend", async (request, reply) => {
    withHeaders(reply);
    if (request.signedIn !== undefined && !isRefusal(reply.statusCode)) {
      touchSession(db, request.signedIn.sessionId, now());
    }
  });

  app.addHook("onClose", async () => {
    db.close();
  });

  /** The cookie attributes of the app's cookies. */
  function attributes(...extra: string[]): string {
    const all = ["Path=/", "SameSite=Lax", "HttpOnly", ...extra];
    if (secure) all.push("Secure");
    return all.join("; ");
  }

  function html(reply: FastifyReply, status: number, page: string) {
    return reply.code(status).type("text/html; charset=utf-8").send(page);
  }

  // Form bodies are kept whole, so that a repeated field can be refused.
  app.removeAllContentTypeParsers();
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_req, body, done) => {
      done(null, new URLSearchParams(body as string));
    },
  );

  app.addHook("onRequest", async (request, reply) => {
    if (request.method === "POST" && request.headers.origin !== publicOrigin) {
      return refuse(request, reply, 403);
    }
    const token = cookie(request, SESSION_COOKIE);
    if (token) request.signedIn = readSession(db, token, now());
  });

  app.setErrorHandler((error: { statusCode?: number }, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 400 && status < 500) return refuse(request, reply, 400);
    request.log.error(error);
    return refuse(request, reply, 500);
  });

  app.setNotFoundHandler((request, reply) => refuse(request, reply, 404));

  app.get("/", async (request, reply) =>
    html(
      reply,
      200,
      homePage(displayLanguage(request), request.signedIn !== undefined),
    ),
  );

  app.get("/sign-in", async (request, reply) =>
    html(reply, 200, signInPage(displayLanguage(request), false)),
  );

  app.post("/sign-in", async (request, reply) => {
    const form = fields(request, ["login", "password"] as const);
    if (form === undefined) return refuse(request, reply, 400);
    const result = await signIn(
      db,
      form.login,
      form.password,
      request.signedIn?.sessionId,
      now,
    );
    if (result === undefined)
      return html(reply, 401, signInPage(displayLanguage(request), true));
    return reply
      .header(
        "set-cookie",
        `${SESSION_COOKIE}=${result.token}; ${attributes()}`,
      )
      .redirect("/dashboard", 303);
  });

  app.post("/sign-out", async (request, reply) => {
    if (request.signedIn !== undefined)
      deleteSession(db, request.signedIn.sessionId);
    return reply
      .header("set-cookie", `${SESSION_COOKIE}=; ${attributes("Max-Age=0")}`)
      .redirect("/", 303);
  });

  app.get("/dashboard", async (request, reply) => {
    const signedIn = request.signedIn;
    if (signedIn === undefined) return reply.redirect("/sign-in", 303);
    return html(reply, 200, dashboardPage(displayLanguage(request), signedIn));
  });

  app.get("/style.css", async (_request, reply) =>
    reply
      .type("text/css; charset=utf-8")
      .header("cache-control", "public, max-age=3600")
      .send(STYLE),
  );

  app.post("/language", async (request, reply) => {
    const language = fields(request, ["language"] as const)?.language;
    if (!isLanguage(language)) return refuse(request, reply, 400);
    return reply
      .header(
        "set-cookie",
        `${LANGUAGE_COOKIE}=${language}; ${attributes(`Max-Age=${ONE_YEAR}`)}`,
      )
      .redirect("/", 303);
  });

  return app;
}
