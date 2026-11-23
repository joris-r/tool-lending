import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { startApp, type Running } from "./helpers.js";

const APP_NAME = { fr: "Prêt d'outils", en: "Tool Lending" } as const;
const SWITCH_LABEL = { fr: "English", en: "Français" } as const;

let browser: Browser;
let running: Running;
let context: BrowserContext;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  running = await startApp();
});

afterAll(async () => {
  await browser?.close();
  await running?.app.close();
});

beforeEach(async () => {
  context = await browser.newContext();
  page = await context.newPage();
});

afterEach(async () => {
  await context.close();
});

async function openHome(language: "fr" | "en"): Promise<void> {
  await page.goto(`${running.origin}/`);
  if (language === "en") {
    await page
      .getByRole("button", { name: SWITCH_LABEL.fr, exact: true })
      .click();
    await expect.poll(() => page.getAttribute("html", "lang")).toBe("en");
  }
  await page.waitForLoadState();
}

/** The visible text below the language switch, top to bottom. */
async function textBelowSwitch(language: "fr" | "en"): Promise<string> {
  const box = await page
    .getByRole("button", { name: SWITCH_LABEL[language], exact: true })
    .boundingBox();
  if (box === null) throw new Error("language switch not visible");
  const bottom = box.y + box.height;
  return page.evaluate((limit) => {
    const parts: string[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
      const text = (n.textContent ?? "").trim();
      const el = n.parentElement;
      if (text === "" || el === null) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.top >= limit) parts.push(text);
    }
    return parts.join(" ");
  }, bottom);
}

describe.each(["fr", "en"] as const)("Home page in %s", (language) => {
  // /ui/general/display-language
  it("is in the display language, carried by the html lang attribute", async () => {
    await openHome(language);
    expect(await page.getAttribute("html", "lang")).toBe(language);
  });

  // /ui/home-page/title
  it("has the app name as its document title", async () => {
    await openHome(language);
    expect((await page.title()).trim()).toBe(APP_NAME[language]);
  });

  // /ui/home-page/header
  it("shows the app name, then a button naming the other language", async () => {
    await openHome(language);
    const name = page.getByText(APP_NAME[language], { exact: true }).first();
    await expect.poll(() => name.isVisible()).toBe(true);
    const button = page.getByRole("button", {
      name: SWITCH_LABEL[language],
      exact: true,
    });
    expect(await button.count()).toBe(1);
    expect(await button.isVisible()).toBe(true);
    const other = language === "fr" ? SWITCH_LABEL.en : SWITCH_LABEL.fr;
    expect(
      await page.getByRole("button", { name: other, exact: true }).count(),
    ).toBe(0);
    const n = await name.boundingBox();
    const b = await button.boundingBox();
    if (n === null || b === null) throw new Error("header not visible");
    // "then": the switch comes after the name, beside it or below it.
    expect(b.x >= n.x + n.width - 1 || b.y >= n.y + n.height - 1).toBe(true);
  });
});

describe("Home page welcome", () => {
  // /ui/home-page/welcome
  it("shows a welcome text below the header, in the display language", async () => {
    await openHome("fr");
    const fr = await textBelowSwitch("fr");
    await context.clearCookies();
    await openHome("en");
    const en = await textBelowSwitch("en");
    expect(fr).not.toBe("");
    expect(en).not.toBe("");
    expect(fr).not.toBe(en);
  });
});

describe("Language switch", () => {
  // /ui/home-page/switch
  it("runs Choose language with the other language when clicked", async () => {
    await page.goto(`${running.origin}/`);
    expect(await page.getAttribute("html", "lang")).toBe("fr");

    const [request] = await Promise.all([
      page.waitForRequest(
        (r) =>
          r.method() === "POST" && r.url() === `${running.origin}/language`,
      ),
      page.getByRole("button", { name: "English", exact: true }).click(),
    ]);
    expect(
      new URLSearchParams(request.postData() ?? "").getAll("language"),
    ).toEqual(["en"]);
    await expect.poll(() => page.getAttribute("html", "lang")).toBe("en");
    await expect
      .poll(() => page.locator("body").innerText())
      .toContain("Tool Lending");

    const [back] = await Promise.all([
      page.waitForRequest(
        (r) =>
          r.method() === "POST" && r.url() === `${running.origin}/language`,
      ),
      page.getByRole("button", { name: "Français", exact: true }).click(),
    ]);
    expect(
      new URLSearchParams(back.postData() ?? "").getAll("language"),
    ).toEqual(["fr"]);
    await expect.poll(() => page.getAttribute("html", "lang")).toBe("fr");
    await expect
      .poll(() => page.locator("body").innerText())
      .toContain("Prêt d'outils");
  });
});

/** The app's own stylesheets the open page loaded, with their rule counts. */
async function ownStylesheets(): Promise<number[]> {
  const sheets = await page.evaluate(() =>
    [...document.styleSheets].map((sheet) => ({
      href: sheet.href,
      rules: sheet.cssRules.length,
    })),
  );
  return sheets
    .filter((s) => s.href === `${running.origin}/style.css`)
    .map((s) => s.rules);
}

describe.each(["fr", "en"] as const)("Stylesheet in %s", (language) => {
  // /ui/general/stylesheet
  it("is loaded by the Home page", async () => {
    await openHome(language);
    const own = await ownStylesheets();
    expect(own).toHaveLength(1);
    expect(own[0]).toBeGreaterThan(0);
  });

  // /ui/general/stylesheet
  // /operations/general/refused
  it("is loaded by a refusal page", async () => {
    await openHome(language);
    await Promise.all([
      page.waitForURL(`${running.origin}/language`),
      page.evaluate(() => {
        const form = document.createElement("form");
        form.method = "post";
        form.action = "/language";
        const input = document.createElement("input");
        input.name = "language";
        input.value = "de";
        form.append(input);
        document.body.append(form);
        form.submit();
      }),
    ]);
    await page.waitForLoadState();
    const own = await ownStylesheets();
    expect(own).toHaveLength(1);
    expect(own[0]).toBeGreaterThan(0);
  });
});
