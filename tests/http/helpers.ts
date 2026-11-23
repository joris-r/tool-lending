import { load, type CheerioAPI } from "cheerio";
import { expect } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";

export const ORIGIN = "https://pret.example.org";

export function makeApp(): FastifyInstance {
  return buildApp({ publicOrigin: ORIGIN });
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

// /model/language/languages
export async function checkInvariants(visitor: Visitor): Promise<void> {
  const answer = await visitor.get("/");
  expect(["fr", "en"]).toContain(lang(answer));
}
