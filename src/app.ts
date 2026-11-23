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
import { homePage, refusalPage } from "./views/pages.js";
import { STYLE } from "./views/style.js";

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
const ONE_YEAR = 365 * 24 * 60 * 60;

/** The language the visitor's browser keeps, if it is a language. */
function keptLanguage(request: FastifyRequest): Language | undefined {
  for (const part of (request.headers.cookie ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0 || part.slice(0, eq).trim() !== LANGUAGE_COOKIE) continue;
    const value = part.slice(eq + 1).trim();
    if (isLanguage(value)) return value;
  }
  return undefined;
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
  const app = Fastify({
    logger: config.logger ?? false,
    // A request Fastify cannot route (e.g. a bad URL) is malformed too.
    frameworkErrors: (_error, request, reply) => refuse(request, reply, 400),
  });

  app.addHook("onSend", async (_request, reply) => {
    withHeaders(reply);
  });

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
  });

  app.setErrorHandler((error: { statusCode?: number }, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 400 && status < 500) return refuse(request, reply, 400);
    request.log.error(error);
    return refuse(request, reply, 500);
  });

  app.setNotFoundHandler((request, reply) => refuse(request, reply, 404));

  app.get("/", async (request, reply) =>
    reply
      .type("text/html; charset=utf-8")
      .send(homePage(displayLanguage(request))),
  );

  app.get("/style.css", async (_request, reply) =>
    reply
      .type("text/css; charset=utf-8")
      .header("cache-control", "public, max-age=3600")
      .send(STYLE),
  );

  app.post("/language", async (request, reply) => {
    const form =
      request.body instanceof URLSearchParams
        ? request.body
        : new URLSearchParams();
    const values = form.getAll("language");
    const language = values[0];
    if (values.length !== 1 || !isLanguage(language))
      return refuse(request, reply, 400);
    const attributes = [
      `Path=/`,
      `Max-Age=${ONE_YEAR}`,
      `SameSite=Lax`,
      `HttpOnly`,
    ];
    if (secure) attributes.push("Secure");
    return reply
      .code(303)
      .header(
        "set-cookie",
        [`${LANGUAGE_COOKIE}=${language}`, ...attributes].join("; "),
      )
      .redirect("/", 303);
  });

  return app;
}
