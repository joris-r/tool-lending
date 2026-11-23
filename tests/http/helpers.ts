import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { load, type CheerioAPI } from "cheerio";
import { expect } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { runAdmin, type AdminResult } from "../../src/admin.js";
import { readState, type State } from "../../src/state.js";

export const ORIGIN = "https://pret.example.org";

export const MINUTE = 60_000;
export const DAY = 24 * 60 * MINUTE;

/** A path for a new, empty database file. */
export function tempDatabase(): string {
  return join(mkdtempSync(join(tmpdir(), "tool-lending-")), "test.db");
}

/** A clock the tests move by hand. */
export class Clock {
  constructor(public time = Date.UTC(2026, 10, 23, 9, 0, 0)) {}
  readonly now = (): Date => new Date(this.time);
  advance(ms: number): void {
    this.time += ms;
  }
}

/** The app on a new database, with its clock. */
export interface World {
  app: FastifyInstance;
  databasePath: string;
  clock: Clock;
}

export function makeWorld(): World {
  const databasePath = tempDatabase();
  const clock = new Clock();
  const app = buildApp({ publicOrigin: ORIGIN, databasePath, now: clock.now });
  return { app, databasePath, clock };
}

export function makeApp(): FastifyInstance {
  return makeWorld().app;
}

/** Runs a command of the operator on the world's database. */
export function admin(
  world: Pick<World, "databasePath">,
  args: string[],
  stdin = "",
): Promise<AdminResult> {
  return runAdmin(args, { databasePath: world.databasePath, stdin });
}

/** Creates an association by the operator's command; it must succeed. */
export async function createAssociation(
  world: Pick<World, "databasePath">,
  name: string,
  login: string,
  password: string,
): Promise<void> {
  const result = await admin(
    world,
    ["create-association", name, login],
    `${password}\n`,
  );
  expect(result.status, result.output).toBe(0);
}

export function state(world: Pick<World, "databasePath">): State {
  return readState(world.databasePath);
}

export interface Answer {
  status: number;
  headers: Record<string, string | string[] | number | undefined>;
  body: string;
  $: CheerioAPI;
}

/** A browser: keeps the cookies the app sets, and sends them back. */
export class Visitor {
  readonly cookies = new Map<string, string>();

  constructor(private readonly app: FastifyInstance) {}

  get(url: string): Promise<Answer> {
    return this.send("GET", url, undefined, {});
  }

  /** A form POST; `origin` is the `Origin` header, or none when null. */
  post(
    url: string,
    form: Record<string, string> | string,
    origin: string | null = ORIGIN,
  ): Promise<Answer> {
    const body =
      typeof form === "string" ? form : new URLSearchParams(form).toString();
    const headers: Record<string, string> = {
      "content-type": "application/x-www-form-urlencoded",
    };
    if (origin !== null) headers.origin = origin;
    return this.send("POST", url, body, headers);
  }

  private async send(
    method: "GET" | "POST",
    url: string,
    payload: string | undefined,
    headers: Record<string, string>,
  ): Promise<Answer> {
    if (this.cookies.size > 0) {
      headers.cookie = [...this.cookies]
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
    }
    const res = await this.app.inject({ method, url, payload, headers });
    this.keep(res.headers["set-cookie"]);
    return {
      status: res.statusCode,
      headers: res.headers,
      body: res.body,
      $: load(res.body),
    };
  }

  private keep(setCookie: string | string[] | undefined): void {
    if (setCookie === undefined) return;
    for (const line of Array.isArray(setCookie) ? setCookie : [setCookie]) {
      const [pair = "", ...attributes] = line.split(";");
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const expired = attributes.some((a) =>
        /^\s*max-age=(0|-\d+)\s*$/i.test(a),
      );
      if (expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
}

/** The `lang` attribute of the page's `html` element. */
export function lang(answer: Answer): string | undefined {
  return answer.$("html").attr("lang");
}

/** Chooses a language as the language switch does. */
export async function choose(
  visitor: Visitor,
  language: "fr" | "en",
): Promise<Answer> {
  const answer = await visitor.post("/language", { language });
  expect(answer.status).toBe(303);
  return answer;
}

/** Signs a visitor in; it must succeed. */
export async function signIn(
  visitor: Visitor,
  login: string,
  password: string,
): Promise<Answer> {
  const answer = await visitor.post("/sign-in", { login, password });
  expect(answer.status).toBe(303);
  return answer;
}

/** Whether the visitor has a signed-in volunteer, as /dashboard tells. */
export async function signedIn(visitor: Visitor): Promise<boolean> {
  const answer = await visitor.get("/dashboard");
  if (answer.status === 200) return true;
  expect(answer.status).toBe(303);
  expect(answer.headers.location).toBe("/sign-in");
  return false;
}

/** The invariants of the model, on the visitor's language and, given a
 * database, on the stored state. */
export async function checkInvariants(
  visitor: Visitor,
  databasePath?: string,
): Promise<void> {
  // /model/language/languages
  const answer = await visitor.get("/");
  expect(["fr", "en"]).toContain(lang(answer));
  if (databasePath !== undefined) checkState(readState(databasePath));
}

export function checkState(current: State): void {
  const names = current.associations.map((a) => a.name);
  const logins = current.associations.flatMap((a) =>
    a.volunteers.map((v) => v.login),
  );
  for (const association of current.associations) {
    // /model/association/name
    expect(association.name).not.toBe("");
    expect(association.name).toBe(association.name.trim());
    // /model/association/one-volunteer
    expect(association.volunteers.length).toBeGreaterThan(0);
    for (const volunteer of association.volunteers) {
      // /model/volunteer/login
      expect(volunteer.login).toMatch(/^\S+$/);
      // /model/volunteer/failures
      expect(Number.isInteger(volunteer.failures)).toBe(true);
      expect(volunteer.failures).toBeGreaterThanOrEqual(0);
      expect(volunteer.failures).toBeLessThanOrEqual(4);
    }
    const ids = association.members.map((m) => m.id);
    const memberNames = association.members.map((m) => m.name);
    for (const member of association.members) {
      expect(Number.isInteger(member.id)).toBe(true);
      // /model/member/name
      expect(member.name).not.toBe("");
      expect(member.name).toBe(member.name.trim());
      // /model/member/contact
      expect(member.contact).toBe(member.contact.trim());
      // /model/association/next-member-id
      expect(association.nextMemberId).toBeGreaterThan(member.id);
    }
    expect(Number.isInteger(association.nextMemberId)).toBe(true);
    // /model/member/id-unique
    expect(new Set(ids).size).toBe(ids.length);
    // /model/member/name-unique
    expect(new Set(memberNames).size).toBe(memberNames.length);
  }
  // /model/association/name-unique
  expect(new Set(names).size).toBe(names.length);
  // /model/association/own-volunteers
  // /model/volunteer/login-unique
  expect(new Set(logins).size).toBe(logins.length);
  // /model/session/session-volunteer
  for (const session of current.sessions) {
    expect(logins).toContain(session.login);
  }
}
