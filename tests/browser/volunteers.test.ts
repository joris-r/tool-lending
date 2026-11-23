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
const SIGN_IN_LINK = { fr: "Se connecter", en: "Sign in" } as const;
const VOLUNTEERS_TITLE = { fr: "Bénévoles", en: "Volunteers" } as const;
const PLATEAU = "Outils du Plateau";
const ALICE = "correct horse battery";
const BOB = "bob's long password";

let browser: Browser;
let running: Running;
let context: BrowserContext;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

// Each test changes the volunteers: it runs on an app of its own.
beforeEach(async () => {
  running = await startApp();
  await createAssociation(running, PLATEAU, "alice", ALICE);
  context = await browser.newContext();
  context.setDefaultTimeout(5000);
  page = await context.newPage();
});

afterEach(async () => {
  await context?.close();
  await running?.app.close();
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

/** Runs an operation from the page's browser, by its HTTP binding. */
async function post(
  path: string,
  form: Record<string, string>,
): Promise<number> {
  const answer = await page.request.post(`${running.origin}${path}`, {
    form,
    headers: { origin: running.origin },
    maxRedirects: 0,
  });
  return answer.status();
}

/** Signs alice in from the page's browser, by the operation itself. */
async function signInAlice(): Promise<void> {
  expect(await post("/sign-in", { login: "alice", password: ALICE })).toBe(303);
}

/** Adds a volunteer to alice's association, by the operation itself. */
async function addVolunteer(login: string, password = BOB): Promise<void> {
  expect(await post("/volunteers/add", { login, password })).toBe(200);
}

async function openVolunteers(language: "fr" | "en"): Promise<void> {
  await useLanguage(language);
  await signInAlice();
  const answer = await page.goto(`${running.origin}/volunteers`);
  expect(answer?.status()).toBe(200);
}

function heading(language: "fr" | "en"): Locator {
  return page.getByRole("heading", {
    name: VOLUNTEERS_TITLE[language],
    exact: true,
  });
}

/** The dashboard link of the Volunteers page. */
function dashboardLink(): Locator {
  return page.locator('main a[href="/dashboard"]');
}

/** The list item of a volunteer. */
function row(login: string): Locator {
  return page
    .getByRole("listitem")
    .filter({ has: page.getByText(login, { exact: true }) });
}

function rowField(login: string): Locator {
  return row(login).locator('input[type="password"]');
}

/** The set-password button: the one sent with the password field. */
function setPasswordButton(login: string): Locator {
  return row(login)
    .locator("form")
    .filter({ has: page.locator('input[type="password"]') })
    .getByRole("button");
}

/** The remove button: the row's other button. */
function removeButton(login: string): Locator {
  return row(login)
    .locator("form")
    .filter({ hasNot: page.locator('input[type="password"]') })
    .getByRole("button");
}

/** The add form: the form of the page with a visible login field. */
function addForm(): Locator {
  return page
    .locator("main form")
    .filter({ has: page.locator('input[name="login"]:visible') });
}

/** The logins listed, top to bottom. */
async function listedLogins(): Promise<string[]> {
  const items = page.getByRole("listitem");
  const out: { login: string; y: number }[] = [];
  for (const item of await items.all()) {
    const text = (await item.innerText()).trim();
    const box = await item.boundingBox();
    if (box === null) continue;
    out.push({ login: text.split(/\s+/)[0] ?? "", y: box.y });
  }
  return out.sort((a, b) => a.y - b.y).map((x) => x.login);
}

/** Waits for the POST to `path` the action sends, and its page. */
async function submit(path: string, action: () => Promise<void>) {
  const [request] = await Promise.all([
    page.waitForRequest(
      (r) => r.method() === "POST" && r.url() === `${running.origin}${path}`,
    ),
    action(),
  ]);
  await page.waitForLoadState();
  return new URLSearchParams(request.postData() ?? "");
}

/** The visible text strictly between the bottom of `a` and the top of
 * `b`. */
async function textBetween(a: Locator, b: Locator): Promise<string> {
  const x = await a.boundingBox();
  const y = await b.boundingBox();
  if (x === null || y === null) throw new Error("not visible");
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
    [x.y + x.height - 1, y.y + 1] as const,
  );
}

/** The message area: between the dashboard link and the list. */
function messageText(): Promise<string> {
  return textBetween(dashboardLink(), page.getByRole("list").first());
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

async function labelOf(field: Locator): Promise<string> {
  const label = await field.evaluate(
    (el) =>
      (el as HTMLInputElement).labels?.[0]?.innerText ??
      el.getAttribute("aria-label") ??
      "",
  );
  return label.trim();
}

describe.each(["fr", "en"] as const)("Dashboard page in %s", (language) => {
  // /ui/dashboard-page/volunteers
  it("shows the volunteers link below the association's name, to the Volunteers page", async () => {
    await useLanguage(language);
    await signInAlice();
    await page.goto(`${running.origin}/dashboard`);
    const link = page.locator('main a[href="/volunteers"]');
    expect(await link.count()).toBe(1);
    expect((await link.innerText()).trim()).not.toBe("");
    await expectBelow(
      page.getByRole("heading", { name: PLATEAU, exact: true }),
      link,
    );
    await link.click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/volunteers");
    await expect.poll(() => page.title()).toBe(VOLUNTEERS_TITLE[language]);
  });
});

describe.each(["fr", "en"] as const)("Volunteers page in %s", (language) => {
  // /ui/general/display-language
  // /ui/general/stylesheet
  it("is in the display language and loads the stylesheet", async () => {
    await openVolunteers(language);
    expect(await page.getAttribute("html", "lang")).toBe(language);
    const own = await page.evaluate(() =>
      [...document.styleSheets].map((s) => ({
        href: s.href,
        rules: s.cssRules.length,
      })),
    );
    const sheets = own.filter((s) => s.href === `${running.origin}/style.css`);
    expect(sheets).toHaveLength(1);
    expect(sheets[0]?.rules).toBeGreaterThan(0);
  });

  // /ui/volunteers-page/title
  it("has the volunteers title as its document title", async () => {
    await openVolunteers(language);
    expect((await page.title()).trim()).toBe(VOLUNTEERS_TITLE[language]);
  });

  // /ui/volunteers-page/header
  // /ui/volunteers-page/heading
  // /ui/volunteers-page/dashboard
  // /ui/volunteers-page/done
  // /ui/volunteers-page/refused
  it("shows the header, the title, then the dashboard link, and no message when opened", async () => {
    await openVolunteers(language);
    const home = page.getByRole("link", {
      name: APP_NAME[language],
      exact: true,
    });
    expect(await home.count()).toBe(1);
    const header = page.locator("header");
    const login = header.getByText("alice").last();
    expect(await login.count()).toBe(1);
    const signOut = header.getByRole("button");
    expect(await signOut.count()).toBe(1);
    expect((await signOut.innerText()).trim()).not.toBe("");
    expect(await heading(language).count()).toBe(1);
    expect(await dashboardLink().count()).toBe(1);
    expect((await dashboardLink().innerText()).trim()).not.toBe("");
    await expectAfter(home, login);
    await expectAfter(login, signOut);
    await expectBelow(signOut, heading(language));
    await expectBelow(heading(language), dashboardLink());
    expect(await messageText()).toBe("");

    await home.click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  });

  // /ui/volunteers-page/dashboard
  it("leads to the Dashboard page by the dashboard link", async () => {
    await openVolunteers(language);
    await dashboardLink().click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/dashboard");
    await expect.poll(() => page.title()).toBe(PLATEAU);
  });

  // /ui/volunteers-page/list
  it("lists the volunteers in alphabetical order of login, each with an empty password field and two buttons", async () => {
    await useLanguage(language);
    await signInAlice();
    await addVolunteer("zoe");
    await addVolunteer("bob");
    await page.goto(`${running.origin}/volunteers`);
    expect(await listedLogins()).toEqual(["alice", "bob", "zoe"]);
    for (const login of ["alice", "bob", "zoe"]) {
      const field = rowField(login);
      expect(await field.count()).toBe(1);
      expect(await field.inputValue()).toBe("");
      expect(await labelOf(field)).not.toBe("");
      expect(await row(login).getByRole("button").count()).toBe(2);
      const set = setPasswordButton(login);
      const remove = removeButton(login);
      expect(await set.count()).toBe(1);
      expect(await remove.count()).toBe(1);
      expect((await set.innerText()).trim()).not.toBe("");
      expect((await remove.innerText()).trim()).not.toBe("");
      expect((await set.innerText()).trim()).not.toBe(
        (await remove.innerText()).trim(),
      );
    }
    await expectBelow(dashboardLink(), row("alice"));
  });

  // /ui/volunteers-page/add
  it("shows the add form under its heading, below the list, with empty fields", async () => {
    await openVolunteers(language);
    const form = addForm();
    expect(await form.count()).toBe(1);
    const login = form.locator('input[name="login"]');
    const password = form.locator('input[name="password"]');
    expect(await login.inputValue()).toBe("");
    expect(await password.inputValue()).toBe("");
    expect(await password.getAttribute("type")).toBe("password");
    expect(await labelOf(login)).not.toBe("");
    expect(await labelOf(password)).not.toBe("");
    const addHeading = page
      .getByRole("heading")
      .filter({ hasNotText: VOLUNTEERS_TITLE[language] })
      .last();
    expect((await addHeading.innerText()).trim()).not.toBe("");
    const button = form.getByRole("button");
    expect(await button.count()).toBe(1);
    expect((await button.innerText()).trim()).not.toBe("");
    await expectBelow(row("alice"), addHeading);
    await expectBelow(addHeading, login);
    await expectAfter(login, password);
    await expectAfter(password, button);
  });

  // /ui/volunteers-page/add-volunteer
  // /ui/volunteers-page/done
  it("runs Add volunteer with the two fields of the add form; the message names the login", async () => {
    await openVolunteers(language);
    await addForm().locator('input[name="login"]').fill("dan");
    await addForm().locator('input[name="password"]').fill(BOB);
    const form = await submit("/volunteers/add", () =>
      addForm().getByRole("button").click(),
    );
    expect(form.getAll("login")).toEqual(["dan"]);
    expect(form.getAll("password")).toEqual([BOB]);
    await expect.poll(() => listedLogins()).toEqual(["alice", "dan"]);
    expect(await page.getAttribute("html", "lang")).toBe(language);
    expect(await messageText()).toContain("dan");
    expect(await addForm().locator('input[name="login"]').inputValue()).toBe(
      "",
    );
    expect(await addForm().locator('input[name="password"]').inputValue()).toBe(
      "",
    );
  });

  // /ui/volunteers-page/set-password
  // /ui/volunteers-page/done
  it("runs Set password with the volunteer's login and their password field; the message names the login", async () => {
    await useLanguage(language);
    await signInAlice();
    await addVolunteer("bob");
    await page.goto(`${running.origin}/volunteers`);
    await rowField("bob").fill("a brand new password");
    const form = await submit("/volunteers/password", () =>
      setPasswordButton("bob").click(),
    );
    expect(form.getAll("login")).toEqual(["bob"]);
    expect(form.getAll("password")).toEqual(["a brand new password"]);
    await expect.poll(() => messageText()).toContain("bob");
    expect(await listedLogins()).toEqual(["alice", "bob"]);
    expect(await rowField("bob").inputValue()).toBe("");
  });

  // /ui/volunteers-page/remove
  // /ui/volunteers-page/done
  it("runs Remove volunteer with the volunteer's login; the message names the login", async () => {
    await useLanguage(language);
    await signInAlice();
    await addVolunteer("bob");
    await page.goto(`${running.origin}/volunteers`);
    const form = await submit("/volunteers/remove", () =>
      removeButton("bob").click(),
    );
    expect(form.getAll("login")).toEqual(["bob"]);
    await expect.poll(() => listedLogins()).toEqual(["alice"]);
    expect(await messageText()).toContain("bob");
  });

  // /ui/volunteers-page/remove
  it("shows the Home page when the volunteer removes themself", async () => {
    await useLanguage(language);
    await signInAlice();
    await addVolunteer("bob");
    await page.goto(`${running.origin}/volunteers`);
    const form = await submit("/volunteers/remove", () =>
      removeButton("alice").click(),
    );
    expect(form.getAll("login")).toEqual(["alice"]);
    await expect.poll(() => new URL(page.url()).pathname).toBe("/");
    await expect
      .poll(() =>
        page
          .getByRole("link", { name: SIGN_IN_LINK[language], exact: true })
          .count(),
      )
      .toBe(1);
  });

  // /ui/volunteers-page/refused
  // /ui/volunteers-page/done
  it("shows a message after a refused case, and the page as it was", async () => {
    await openVolunteers(language);
    await addForm().locator('input[name="login"]').fill("alice");
    await addForm().locator('input[name="password"]').fill(BOB);
    await submit("/volunteers/add", () =>
      addForm().getByRole("button").click(),
    );
    await expect.poll(() => messageText()).not.toBe("");
    expect((await page.title()).trim()).toBe(VOLUNTEERS_TITLE[language]);
    expect(await page.getAttribute("html", "lang")).toBe(language);
    expect(await listedLogins()).toEqual(["alice"]);

    await submit("/volunteers/remove", () => removeButton("alice").click());
    await expect.poll(() => messageText()).not.toBe("");
    expect(await listedLogins()).toEqual(["alice"]);
  });

  // /ui/volunteers-page/sign-out
  it("runs Sign out when the sign-out button is clicked; the Home page then shows", async () => {
    await openVolunteers(language);
    await submit("/sign-out", () =>
      page.locator("header").getByRole("button").click(),
    );
    await expect.poll(() => new URL(page.url()).pathname).toBe("/");
    await page.goto(`${running.origin}/volunteers`);
    expect(new URL(page.url()).pathname).toBe("/sign-in");
  });
});
