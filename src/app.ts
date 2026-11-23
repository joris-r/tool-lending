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
  addVolunteer,
  deleteSession,
  readSession,
  removeVolunteer,
  setPassword,
  signIn,
  touchSession,
  volunteerLogins,
  type SignedIn,
} from "./store.js";
import {
  dashboardPage,
  homePage,
  refusalPage,
  signInPage,
  volunteersPage,
  type Notice,
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

/** The routes of the operations marked `Volunteers only.` */
const VOLUNTEERS_ONLY = new Set([
  "/dashboard",
  "/volunteers",
  "/volunteers/add",
  "/volunteers/password",
  "/volunteers/remove",
]);

/** The status of a refused case answered with the Volunteers page. */
const REFUSED = 422;

/** The answers that are a refusal of the request. */
function isRefusal(status: number): boolean {
  return (
    status === 400 ||
    status === 403 ||
    status === 404 ||
    status === REFUSED ||
    status >= 500
  );
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
    // Before the body is parsed: a malformed body is not answered first.
    if (
      VOLUNTEERS_ONLY.has(request.routeOptions.url ?? "") &&
      request.signedIn === undefined
    ) {
      return reply.redirect("/sign-in", 303);
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

  /** Answers the Volunteers page of the signed-in volunteer's association. */
  function volunteers(
    request: FastifyRequest,
    reply: FastifyReply,
    signedIn: SignedIn,
    status: number,
    notice?: Notice,
  ) {
    const logins = volunteerLogins(db, signedIn.associationId);
    return html(
      reply,
      status,
      volunteersPage(displayLanguage(request), signedIn, logins, notice),
    );
  }

  app.get("/volunteers", async (request, reply) => {
    const signedIn = request.signedIn;
    if (signedIn === undefined) return reply.redirect("/sign-in", 303);
    return volunteers(request, reply, signedIn, 200);
  });

  app.post("/volunteers/add", async (request, reply) => {
    const signedIn = request.signedIn;
    if (signedIn === undefined) return reply.redirect("/sign-in", 303);
    const form = fields(request, ["login", "password"] as const);
    if (form === undefined) return refuse(request, reply, 400);
    const t = TEXTS[displayLanguage(request)];
    const result = await addVolunteer(
      db,
      signedIn.associationId,
      form.login,
      form.password,
      signedIn.sessionId,
    );
    switch (result) {
      case "signed-out":
        return reply.redirect("/sign-in", 303);
      case "invalid":
        return volunteers(request, reply, signedIn, REFUSED, {
          refused: true,
          text: t.invalidVolunteer,
        });
      case "taken":
        return volunteers(request, reply, signedIn, REFUSED, {
          refused: true,
          text: t.loginTaken(form.login),
        });
      case "added":
        return volunteers(request, reply, signedIn, 200, {
          refused: false,
          text: t.volunteerAdded(form.login),
        });
    }
  });

  app.post("/volunteers/password", async (request, reply) => {
    const signedIn = request.signedIn;
    if (signedIn === undefined) return reply.redirect("/sign-in", 303);
    const form = fields(request, ["login", "password"] as const);
    if (form === undefined) return refuse(request, reply, 400);
    const t = TEXTS[displayLanguage(request)];
    const result = await setPassword(
      db,
      signedIn.associationId,
      form.login,
      form.password,
      signedIn.sessionId,
    );
    switch (result) {
      case "signed-out":
        return reply.redirect("/sign-in", 303);
      case "unknown":
        return volunteers(request, reply, signedIn, REFUSED, {
          refused: true,
          text: t.unknownVolunteer(form.login),
        });
      case "short":
        return volunteers(request, reply, signedIn, REFUSED, {
          refused: true,
          text: t.shortPassword,
        });
      case "set":
        return volunteers(request, reply, signedIn, 200, {
          refused: false,
          text: t.passwordSet(form.login),
        });
    }
  });

  app.post("/volunteers/remove", async (request, reply) => {
    const signedIn = request.signedIn;
    if (signedIn === undefined) return reply.redirect("/sign-in", 303);
    const form = fields(request, ["login"] as const);
    if (form === undefined) return refuse(request, reply, 400);
    const t = TEXTS[displayLanguage(request)];
    switch (
      removeVolunteer(
        db,
        signedIn.associationId,
        form.login,
        signedIn.sessionId,
      )
    ) {
      case "signed-out":
        return reply.redirect("/sign-in", 303);
      case "unknown":
        return volunteers(request, reply, signedIn, REFUSED, {
          refused: true,
          text: t.unknownVolunteer(form.login),
        });
      case "last":
        return volunteers(request, reply, signedIn, REFUSED, {
          refused: true,
          text: t.lastVolunteer,
        });
      case "removed":
        if (form.login === signedIn.login) {
          return reply
            .header(
              "set-cookie",
              `${SESSION_COOKIE}=; ${attributes("Max-Age=0")}`,
            )
            .redirect("/", 303);
        }
        return volunteers(request, reply, signedIn, 200, {
          refused: false,
          text: t.volunteerRemoved(form.login),
        });
    }
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
