import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { load } from "cheerio";
import {
  Visitor,
  checkInvariants,
  choose,
  lang,
  makeApp,
  ORIGIN,
  type Answer,
} from "./helpers.js";

let app: FastifyInstance;

beforeEach(async () => {
  app = makeApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

function isHtmlPage(answer: {
  headers: Record<string, unknown>;
  body: string;
}): boolean {
  return (
    String(answer.headers["content-type"]).startsWith("text/html") &&
    answer.body.trim() !== ""
  );
}

describe("Show home page", () => {
  // /operations/initial-state/new-visitor
  // /operations/show-home-page/result
  // /operations/general/public
  it("answers a new visitor, without signing in, with the Home page in French", async () => {
    const visitor = new Visitor(app);
    const answer = await visitor.get("/");
    expect(answer.status).toBe(200);
    expect(isHtmlPage(answer)).toBe(true);
    expect(lang(answer)).toBe("fr");
    await checkInvariants(visitor);
  });

  // /operations/show-home-page/result
  it("answers in the language the visitor chose", async () => {
    const visitor = new Visitor(app);
    await choose(visitor, "en");
    const answer = await visitor.get("/");
    expect(answer.status).toBe(200);
    expect(lang(answer)).toBe("en");
    await checkInvariants(visitor);
  });
});

describe("Choose language", () => {
  // /operations/choose-language/chosen
  // /operations/general/public
  it.each([
    ["fr", "en"],
    ["en", "fr"],
    ["fr", "fr"],
    ["en", "en"],
  ] as const)(
    "from %s, choosing %s answers 303 to / and sets the language",
    async (from, to) => {
      const visitor = new Visitor(app);
      if (from === "en") await choose(visitor, "en");
      const answer = await visitor.post("/language", { language: to });
      expect(answer.status).toBe(303);
      expect(answer.headers.location).toBe("/");
      expect(lang(await visitor.get("/"))).toBe(to);
      await checkInvariants(visitor);
    },
  );

  // /operations/choose-language/kept
  it("keeps the choice for the next requests, until the visitor chooses again", async () => {
    const visitor = new Visitor(app);
    await choose(visitor, "en");
    for (let i = 0; i < 3; i++) expect(lang(await visitor.get("/"))).toBe("en");
    await choose(visitor, "fr");
    for (let i = 0; i < 3; i++) expect(lang(await visitor.get("/"))).toBe("fr");
    await checkInvariants(visitor);
  });

  // /operations/choose-language/kept
  it("keeps each visitor's choice apart", async () => {
    const english = new Visitor(app);
    const french = new Visitor(app);
    await choose(english, "en");
    expect(lang(await french.get("/"))).toBe("fr");
    expect(lang(await english.get("/"))).toBe("en");
    await checkInvariants(english);
    await checkInvariants(french);
  });

  // /operations/choose-language/kept
  it("ends when the browser drops the kept language", async () => {
    const visitor = new Visitor(app);
    await choose(visitor, "en");
    visitor.cookies.clear();
    expect(lang(await visitor.get("/"))).toBe("fr");
    await checkInvariants(visitor);
  });
});

describe("General", () => {
  // /operations/general/origin
  // /operations/general/refused
  it.each([
    ["no Origin", null],
    ["Origin null", "null"],
    ["another host", "https://evil.example.com"],
    ["another scheme", "http://pret.example.org"],
    ["another port", "https://pret.example.org:8443"],
    ["a subdomain", "https://www.pret.example.org"],
  ])("refuses a POST with %s: 403, nothing changes", async (_label, origin) => {
    const visitor = new Visitor(app);
    const answer = await visitor.post("/language", { language: "en" }, origin);
    expect(answer.status).toBe(403);
    expect(lang(await visitor.get("/"))).toBe("fr");
    await checkInvariants(visitor);
  });

  // /operations/general/origin
  // /operations/general/refused
  it("refuses a foreign POST without changing a chosen language", async () => {
    const visitor = new Visitor(app);
    await choose(visitor, "en");
    const answer = await visitor.post(
      "/language",
      { language: "fr" },
      "https://evil.example.com",
    );
    expect(answer.status).toBe(403);
    expect(lang(await visitor.get("/"))).toBe("en");
    await checkInvariants(visitor);
  });

  // /operations/general/origin
  // /operations/general/malformed
  it.each([
    ["no Origin", null],
    ["another origin", "https://evil.example.com"],
  ])(
    "refuses a malformed POST with %s as forbidden: 403",
    async (_label, origin) => {
      const visitor = new Visitor(app);
      const answer = await visitor.post("/language", "language=de", origin);
      expect(answer.status).toBe(403);
      await checkInvariants(visitor);
    },
  );

  // /operations/general/malformed
  // /operations/general/refused
  it.each([
    ["an unknown language", "language=de"],
    ["a language in capitals", "language=EN"],
    ["an empty language", "language="],
    ["no language", ""],
    ["another field", "lang=en"],
    ["the field twice", "language=en&language=fr"],
  ])("refuses a POST with %s: 400, nothing changes", async (_label, form) => {
    const visitor = new Visitor(app);
    await choose(visitor, "en");
    const answer = await visitor.post("/language", form);
    expect(answer.status).toBe(400);
    expect(lang(await visitor.get("/"))).toBe("en");
    await checkInvariants(visitor);
  });

  // /operations/general/refused
  it.each(["fr", "en"] as const)(
    "answers a refusal with a page in the display language (%s)",
    async (language) => {
      const visitor = new Visitor(app);
      if (language === "en") await choose(visitor, "en");
      const home = (await visitor.get("/")).$("body").text().trim();
      for (const answer of [
        await visitor.post("/language", { language: "de" }),
        await visitor.post(
          "/language",
          { language: "en" },
          "https://evil.example.com",
        ),
      ]) {
        expect(isHtmlPage(answer)).toBe(true);
        expect(lang(answer)).toBe(language);
        const text = answer.$("body").text().trim();
        expect(text).not.toBe("");
        expect(text).not.toBe(home);
      }
      await checkInvariants(visitor);
    },
  );

  // /operations/general/unknown-language
  it.each(["de", "", "EN", "<script>"])(
    "reads a kept language %j that is not a language as no language",
    async (forged) => {
      const visitor = new Visitor(app);
      await choose(visitor, "en");
      expect(visitor.cookies.size).toBeGreaterThan(0);
      for (const name of visitor.cookies.keys())
        visitor.cookies.set(name, encodeURIComponent(forged));
      const answer = await visitor.get("/");
      expect(answer.status).toBe(200);
      expect(lang(answer)).toBe("fr");
      await checkInvariants(visitor);
    },
  );
});

describe("Get stylesheet", () => {
  // /operations/get-stylesheet/result
  // /operations/general/public
  it.each(["fr", "en"] as const)(
    "answers 200 with CSS, without signing in, to a visitor in %s",
    async (language) => {
      const visitor = new Visitor(app);
      if (language === "en") await choose(visitor, "en");
      const answer = await visitor.get("/style.css");
      expect(answer.status).toBe(200);
      expect(String(answer.headers["content-type"])).toMatch(/^text\/css\b/);
      expect(answer.body.trim()).not.toBe("");
      await checkInvariants(visitor);
    },
  );
});

describe("Headers of every answer", () => {
  /** One answer of each kind the app gives. */
  async function everyKindOfAnswer(): Promise<[string, Answer][]> {
    const visitor = new Visitor(app);
    return [
      ["the Home page", await visitor.get("/")],
      ["the stylesheet", await visitor.get("/style.css")],
      [
        "a language chosen",
        await visitor.post("/language", { language: "en" }),
      ],
      ["a malformed POST", await visitor.post("/language", "language=de")],
      [
        "a foreign POST",
        await visitor.post(
          "/language",
          { language: "fr" },
          "https://evil.example.com",
        ),
      ],
      ["an unknown route", await visitor.get("/no-such-page")],
      ["a bad URL", await visitor.get("/%")],
      [
        "a POST without Origin",
        await visitor.post("/language", { language: "en" }, null),
      ],
      ["a POST of JSON", await postJson()],
    ];
  }

  /** A POST /language whose body is not a form. */
  async function postJson(): Promise<Answer> {
    const res = await app.inject({
      method: "POST",
      url: "/language",
      payload: JSON.stringify({ language: "en" }),
      headers: { "content-type": "application/json", origin: ORIGIN },
    });
    return {
      status: res.statusCode,
      headers: res.headers,
      body: res.body,
      $: load(res.body),
    };
  }

  /** The values of a header, each comma-separated item apart. */
  function values(answer: Answer, name: string): string[] {
    const value = answer.headers[name];
    const lines = Array.isArray(value) ? value : [String(value ?? "")];
    return lines.flatMap((line) => line.split(",")).map((v) => v.trim());
  }

  // /operations/general/framing
  it("forbids every answer to be shown inside a frame", async () => {
    for (const [label, answer] of await everyKindOfAnswer()) {
      const frameOptions = values(answer, "x-frame-options");
      const denied =
        frameOptions.length > 0 &&
        frameOptions.every((v) => v.toUpperCase() === "DENY");
      const ancestors = values(answer, "content-security-policy").some(
        (policy) =>
          /(?:^|;)\s*frame-ancestors\s+'none'\s*(?:;|$)/i.test(policy),
      );
      expect(denied || ancestors, label).toBe(true);
    }
  });

  // /operations/general/nosniff
  it("forbids browsers to read every answer as another type", async () => {
    for (const [label, answer] of await everyKindOfAnswer()) {
      const options = values(answer, "x-content-type-options");
      expect(options.length, label).toBeGreaterThan(0);
      for (const v of options) expect(v.toLowerCase(), label).toBe("nosniff");
    }
  });
});
