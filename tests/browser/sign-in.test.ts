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
  type Locator,
  type Page,
} from "playwright";
import { startApp, type Running } from "./helpers.js";
import { createAssociation } from "../http/helpers.js";

const APP_NAME = { fr: "Prêt d'outils", en: "Tool Lending" } as const;
const SWITCH_LABEL = { fr: "English", en: "Français" } as const;
const SIGN_IN_TITLE = { fr: "Connexion", en: "Sign in" } as const;
const SIGN_IN_LINK = { fr: "Se connecter", en: "Sign in" } as const;
const DASHBOARD_LINK = { fr: "Tableau de bord", en: "Dashboard" } as const;
const PLATEAU = "Outils du Plateau";
const ALICE = "correct horse battery";

let browser: Browser;
let running: Running;
let context: BrowserContext;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  running = await startApp();
  await createAssociation(running, PLATEAU, "alice", ALICE);
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

/** Sets the display language as the language switch does. */
async function useLanguage(language: "fr" | "en"): Promise<void> {
  await page.goto(`${running.origin}/`);
  if (language === "en") {
    await page
      .getByRole("button", { name: SWITCH_LABEL.fr, exact: true })
      .click();
    await expect.poll(() => page.getAttribute("html", "lang")).toBe("en");
  }
}

/** Signs alice in from the page's browser, by the operation itself. */
async function signInAlice(): Promise<void> {
  const answer = await page.request.post(`${running.origin}/sign-in`, {
    form: { login: "alice", password: ALICE },
    headers: { origin: running.origin },
    maxRedirects: 0,
  });
  expect(answer.status()).toBe(303);
}

async function openSignIn(language: "fr" | "en"): Promise<void> {
  await useLanguage(language);
  await page.goto(`${running.origin}/sign-in`);
}

async function openDashboard(language: "fr" | "en"): Promise<void> {
  await useLanguage(language);
  await signInAlice();
  await page.goto(`${running.origin}/dashboard`);
  expect(new URL(page.url()).pathname).toBe("/dashboard");
}

async function failSignIn(language: "fr" | "en"): Promise<void> {
  await openSignIn(language);
  await page.locator('input[name="login"]').fill("nobody");
  await page.locator('input[name="password"]').fill("a wrong password");
  await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url() === `${running.origin}/sign-in` &&
        r.request().method() === "POST",
    ),
    signInButton().click(),
  ]);
  await page.waitForLoadState();
}

function signInButton(): Locator {
  return page.locator("main form").getByRole("button");
}

/** The visible text below the sign-in heading and above the form. */
async function textBetweenHeadingAndForm(
  language: "fr" | "en",
): Promise<string> {
  const heading = await page
    .getByRole("heading", { name: SIGN_IN_TITLE[language], exact: true })
    .boundingBox();
  const form = await page.locator("main form").boundingBox();
  if (heading === null || form === null) throw new Error("not visible");
  return page.evaluate(
    ([top, bottom]) => {
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
        if (r.width > 0 && r.height > 0 && r.top >= top && r.bottom <= bottom)
          parts.push(text);
      }
      return parts.join(" ");
    },
    [heading.y + heading.height - 1, form.y + 1] as const,
  );
}

/** Asserts that `b` comes after `a`: beside it, or below it. */
async function expectAfter(a: Locator, b: Locator): Promise<void> {
  const x = await a.boundingBox();
  const y = await b.boundingBox();
  if (x === null || y === null) throw new Error("not visible");
  expect(y.x >= x.x + x.width - 1 || y.y >= x.y + x.height - 1).toBe(true);
}

/** Asserts that `b` is below `a`. */
async function expectBelow(a: Locator, b: Locator): Promise<void> {
  const x = await a.boundingBox();
  const y = await b.boundingBox();
  if (x === null || y === null) throw new Error("not visible");
  expect(y.y).toBeGreaterThanOrEqual(x.y + x.height - 1);
}

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

describe.each(["fr", "en"] as const)("Home page in %s", (language) => {
  // /ui/home-page/account
  it("shows the sign-in link after the language switch, without a signed-in volunteer", async () => {
    await useLanguage(language);
    const link = page.getByRole("link", {
      name: SIGN_IN_LINK[language],
      exact: true,
    });
    expect(await link.count()).toBe(1);
    expect(
      await page
        .getByRole("link", { name: DASHBOARD_LINK[language], exact: true })
        .count(),
    ).toBe(0);
    await expectAfter(
      page.getByRole("button", { name: SWITCH_LABEL[language], exact: true }),
      link,
    );
    await link.click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/sign-in");
    await expect.poll(() => page.title()).toBe(SIGN_IN_TITLE[language]);
  });

  // /ui/home-page/account
  it("shows the dashboard link after the language switch, with a signed-in volunteer", async () => {
    await useLanguage(language);
    await signInAlice();
    await page.goto(`${running.origin}/`);
    const link = page.getByRole("link", {
      name: DASHBOARD_LINK[language],
      exact: true,
    });
    expect(await link.count()).toBe(1);
    expect(
      await page
        .getByRole("link", { name: SIGN_IN_LINK[language], exact: true })
        .count(),
    ).toBe(0);
    await expectAfter(
      page.getByRole("button", { name: SWITCH_LABEL[language], exact: true }),
      link,
    );
    await link.click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/dashboard");
    await expect.poll(() => page.title()).toBe(PLATEAU);
  });
});

describe.each(["fr", "en"] as const)("Sign-in page in %s", (language) => {
  // /ui/general/display-language
  // /ui/general/stylesheet
  it("is in the display language and loads the stylesheet", async () => {
    await openSignIn(language);
    expect(await page.getAttribute("html", "lang")).toBe(language);
    const own = await ownStylesheets();
    expect(own).toHaveLength(1);
    expect(own[0]).toBeGreaterThan(0);
  });

  // /ui/sign-in-page/title
  it("has the sign-in title as its document title", async () => {
    await openSignIn(language);
    expect((await page.title()).trim()).toBe(SIGN_IN_TITLE[language]);
  });

  // /ui/sign-in-page/header
  // /ui/sign-in-page/heading
  // /ui/sign-in-page/form
  it("shows the app name as a link home, the title, then the empty form", async () => {
    await openSignIn(language);
    const home = page.getByRole("link", {
      name: APP_NAME[language],
      exact: true,
    });
    expect(await home.count()).toBe(1);
    const heading = page.getByRole("heading", {
      name: SIGN_IN_TITLE[language],
      exact: true,
    });
    expect(await heading.count()).toBe(1);
    const login = page.locator('input[name="login"]');
    const password = page.locator('input[name="password"]');
    expect(await login.inputValue()).toBe("");
    expect(await password.inputValue()).toBe("");
    expect(await password.getAttribute("type")).toBe("password");
    for (const field of [login, password]) {
      const label = await field.evaluate(
        (el) => (el as HTMLInputElement).labels?.[0]?.innerText ?? "",
      );
      expect(label.trim()).not.toBe("");
    }
    expect(await signInButton().count()).toBe(1);
    expect((await signInButton().innerText()).trim()).not.toBe("");
    await expectBelow(home, heading);
    await expectBelow(heading, login);
    await expectAfter(login, password);
    await expectAfter(password, signInButton());

    await home.click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  });

  // /ui/sign-in-page/failed
  // /ui/sign-in-page/form
  it("shows the failure message only after a failed sign-in, with the form empty again", async () => {
    await openSignIn(language);
    const opened = await page.locator("main").innerText();
    expect(await textBetweenHeadingAndForm(language)).toBe("");
    await failSignIn(language);
    expect(await page.getAttribute("html", "lang")).toBe(language);
    expect((await page.title()).trim()).toBe(SIGN_IN_TITLE[language]);
    const failed = await page.locator("main").innerText();
    expect(failed).not.toBe(opened);
    expect(failed.length).toBeGreaterThan(opened.length);
    const heading = page.getByRole("heading", {
      name: SIGN_IN_TITLE[language],
      exact: true,
    });
    await expectBelow(heading, page.locator('input[name="login"]'));
    expect(await textBetweenHeadingAndForm(language)).not.toBe("");
    expect(await page.locator('input[name="login"]').inputValue()).toBe("");
    expect(await page.locator('input[name="password"]').inputValue()).toBe("");
  });
});

describe("Sign-in button", () => {
  // /ui/sign-in-page/sign-in
  it("runs Sign in with the two fields; once signed in, the Dashboard page shows", async () => {
    await page.goto(`${running.origin}/sign-in`);
    await page.locator('input[name="login"]').fill("alice");
    await page.locator('input[name="password"]').fill(ALICE);
    const [request] = await Promise.all([
      page.waitForRequest(
        (r) => r.method() === "POST" && r.url() === `${running.origin}/sign-in`,
      ),
      signInButton().click(),
    ]);
    const form = new URLSearchParams(request.postData() ?? "");
    expect(form.getAll("login")).toEqual(["alice"]);
    expect(form.getAll("password")).toEqual([ALICE]);
    await expect.poll(() => new URL(page.url()).pathname).toBe("/dashboard");
    await expect.poll(() => page.title()).toBe(PLATEAU);
  });
});

describe.each(["fr", "en"] as const)("Dashboard page in %s", (language) => {
  // /ui/general/display-language
  // /ui/general/stylesheet
  it("is in the display language and loads the stylesheet", async () => {
    await openDashboard(language);
    expect(await page.getAttribute("html", "lang")).toBe(language);
    const own = await ownStylesheets();
    expect(own).toHaveLength(1);
    expect(own[0]).toBeGreaterThan(0);
  });

  // /ui/dashboard-page/title
  it("has the association's name as its document title", async () => {
    await openDashboard(language);
    expect((await page.title()).trim()).toBe(PLATEAU);
  });

  // /ui/dashboard-page/header
  // /ui/dashboard-page/name
  it("shows the app name as a link home, the login, the sign-out button, then the association's name as heading", async () => {
    await openDashboard(language);
    const home = page.getByRole("link", {
      name: APP_NAME[language],
      exact: true,
    });
    expect(await home.count()).toBe(1);
    const header = page.locator("header");
    expect(await header.innerText()).toContain("alice");
    const login = header.getByText("alice").last();
    const signOut = header.getByRole("button");
    expect(await signOut.count()).toBe(1);
    expect((await signOut.innerText()).trim()).not.toBe("");
    const heading = page.getByRole("heading", { name: PLATEAU, exact: true });
    expect(await heading.count()).toBe(1);
    await expectAfter(home, login);
    await expectAfter(login, signOut);
    await expectBelow(home, heading);
    await expectBelow(signOut, heading);

    await home.click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  });

  // /ui/dashboard-page/sign-out
  it("runs Sign out when the sign-out button is clicked; the Home page then shows", async () => {
    await openDashboard(language);
    const [request] = await Promise.all([
      page.waitForRequest(
        (r) =>
          r.method() === "POST" && r.url() === `${running.origin}/sign-out`,
      ),
      page.locator("header").getByRole("button").click(),
    ]);
    expect(request.method()).toBe("POST");
    await expect.poll(() => new URL(page.url()).pathname).toBe("/");
    await expect
      .poll(() =>
        page
          .getByRole("link", { name: SIGN_IN_LINK[language], exact: true })
          .count(),
      )
      .toBe(1);
    await page.goto(`${running.origin}/dashboard`);
    expect(new URL(page.url()).pathname).toBe("/sign-in");
  });
});
