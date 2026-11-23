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
import { createAssociation, state } from "../http/helpers.js";

const APP_NAME = { fr: "Prêt d'outils", en: "Tool Lending" } as const;
const SWITCH_LABEL = { fr: "English", en: "Français" } as const;
const MEMBERS_TITLE = { fr: "Membres", en: "Members" } as const;
const DELETION_TITLE = {
  fr: "Supprimer un membre",
  en: "Delete a member",
} as const;
const PLATEAU = "Outils du Plateau";
const ALICE = "correct horse battery";

type Language = "fr" | "en";

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

// Each test changes the members: it runs on an app of its own.
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
async function useLanguage(language: Language): Promise<void> {
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

/** Signs alice in, in the language, from the page's browser. */
async function signInAlice(language: Language): Promise<void> {
  await useLanguage(language);
  expect(await post("/sign-in", { login: "alice", password: ALICE })).toBe(303);
}

/** Adds a member by the operation itself. */
async function addMember(name: string, contact = ""): Promise<void> {
  expect(await post("/members/add", { name, contact })).toBe(200);
}

/** The id of the member named `name`. */
function idOf(name: string): number {
  const found = state(running)
    .associations.flatMap((a) => a.members)
    .find((m) => m.name === name);
  if (found === undefined) throw new Error(`no member ${name}`);
  return found.id;
}

async function open(path: string): Promise<void> {
  const answer = await page.goto(`${running.origin}${path}`);
  expect(answer?.status()).toBe(200);
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

async function expectStylesheet(): Promise<void> {
  const own = await page.evaluate(() =>
    [...document.styleSheets].map((s) => ({
      href: s.href,
      rules: s.cssRules.length,
    })),
  );
  const sheets = own.filter((s) => s.href === `${running.origin}/style.css`);
  expect(sheets).toHaveLength(1);
  expect(sheets[0]?.rules).toBeGreaterThan(0);
}

/** Checks the header of the Dashboard page: the app name, as a link to
 * the Home page, then alice's login, then the sign-out button. */
async function expectDashboardHeader(language: Language): Promise<Locator> {
  const header = page.locator("header");
  const home = header.getByRole("link", {
    name: APP_NAME[language],
    exact: true,
  });
  expect(await home.count()).toBe(1);
  expect(await home.getAttribute("href")).toBe("/");
  const login = header.getByText("alice").last();
  expect(await login.count()).toBe(1);
  const signOut = header.getByRole("button");
  expect(await signOut.count()).toBe(1);
  expect((await signOut.innerText()).trim()).not.toBe("");
  await expectAfter(home, login);
  await expectAfter(login, signOut);
  return signOut;
}

/** Checks the sign-out button: it runs Sign out, then the Home page shows. */
async function expectSignOut(): Promise<void> {
  await submit("/sign-out", () =>
    page.locator("header").getByRole("button").click(),
  );
  await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  await page.goto(`${running.origin}/members`);
  expect(new URL(page.url()).pathname).toBe("/sign-in");
}

function heading(text: string): Locator {
  return page.getByRole("heading", { name: text, exact: true });
}

// The Members page.

function dashboardLink(): Locator {
  return page.locator('main a[href="/dashboard"]');
}

/** The add form: the form of the page sent to /members/add. */
function addForm(): Locator {
  return page.locator('main form[action="/members/add"]');
}

function addHeading(language: Language): Locator {
  return page
    .locator("main")
    .getByRole("heading")
    .filter({ hasNotText: MEMBERS_TITLE[language] })
    .last();
}

/** The list item of a member. */
function row(name: string): Locator {
  return page
    .getByRole("listitem")
    .filter({ has: page.getByText(name, { exact: true }) });
}

/** The names listed, top to bottom. */
async function listedNames(names: string[]): Promise<string[]> {
  const out: { name: string; y: number }[] = [];
  for (const name of names) {
    const box = await row(name).boundingBox();
    if (box !== null) out.push({ name, y: box.y });
  }
  return out.sort((a, b) => a.y - b.y).map((x) => x.name);
}

/** The message area of the Members page: between the dashboard link and
 * the list, or the add form's heading without one. */
async function membersMessage(language: Language): Promise<string> {
  const items = page.getByRole("listitem");
  const below = (await items.count()) > 0 ? items.first() : null;
  if (below !== null) return textBetween(dashboardLink(), below);
  return textBetween(dashboardLink(), addHeading(language));
}

// The Member page.

function membersLink(): Locator {
  return page.locator('main a[href="/members"]');
}

function editForm(id: number): Locator {
  return page.locator(`main form[action="/members/${id}/edit"]`);
}

function deleteLink(id: number): Locator {
  return page.locator(`main a[href="/members/${id}/delete"]`);
}

describe.each(["fr", "en"] as const)("Dashboard page in %s", (language) => {
  // /ui/dashboard-page/members
  it("shows the members link, reading as in contents, below the name and above the volunteers link, to the Members page", async () => {
    await signInAlice(language);
    await open("/dashboard");
    const link = page.locator('main a[href="/members"]');
    expect(await link.count()).toBe(1);
    expect((await link.innerText()).trim()).toBe(MEMBERS_TITLE[language]);
    await expectBelow(heading(PLATEAU), link);
    await expectBelow(link, page.locator('main a[href="/volunteers"]'));
    await link.click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/members");
    await expect.poll(() => page.title()).toBe(MEMBERS_TITLE[language]);
  });
});

describe.each(["fr", "en"] as const)("Members page in %s", (language) => {
  // /ui/general/display-language
  // /ui/general/stylesheet
  // /ui/members-page/title
  it("is in the display language, loads the stylesheet, and has the members title as its document title", async () => {
    await signInAlice(language);
    await open("/members");
    expect(await page.getAttribute("html", "lang")).toBe(language);
    await expectStylesheet();
    expect((await page.title()).trim()).toBe(MEMBERS_TITLE[language]);
  });

  // /ui/members-page/header
  // /ui/members-page/heading
  // /ui/members-page/dashboard
  // /ui/members-page/empty
  // /ui/members-page/done
  // /ui/members-page/refused
  it("shows the header, the title, the dashboard link, then the empty-list text with no member, and no message", async () => {
    await signInAlice(language);
    await open("/members");
    const signOut = await expectDashboardHeader(language);
    expect(await heading(MEMBERS_TITLE[language]).count()).toBe(1);
    expect(await dashboardLink().count()).toBe(1);
    expect((await dashboardLink().innerText()).trim()).not.toBe("");
    await expectBelow(signOut, heading(MEMBERS_TITLE[language]));
    await expectBelow(heading(MEMBERS_TITLE[language]), dashboardLink());
    expect(await page.getByRole("listitem").count()).toBe(0);
    // The empty-list text, and nothing else, there.
    const empty = await membersMessage(language);
    expect(empty).not.toBe("");
    const aside = await context.newPage();
    try {
      await addMember("Marie Dupont");
      await aside.goto(`${running.origin}/members`);
      expect(await aside.locator("main").innerText()).not.toContain(empty);
    } finally {
      await aside.close();
    }
  });

  // /ui/members-page/dashboard
  it("leads to the Dashboard page by the dashboard link", async () => {
    await signInAlice(language);
    await open("/members");
    await dashboardLink().click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/dashboard");
    await expect.poll(() => page.title()).toBe(PLATEAU);
  });

  // /ui/members-page/list
  // /ui/members-page/done
  // /ui/members-page/refused
  it("lists the members in alphabetical order of name, each with their contact and the edit link, and no message", async () => {
    await signInAlice(language);
    await addMember("Sophie Roy", "12 rue des Lilas");
    await addMember("Marie Dupont", "514 555-0123");
    await addMember("Paul Tremblay", "");
    await open("/members");
    const names = ["Marie Dupont", "Paul Tremblay", "Sophie Roy"];
    expect(await listedNames(names)).toEqual(names);
    expect(await page.getByRole("listitem").count()).toBe(3);
    await expectBelow(dashboardLink(), row("Marie Dupont"));
    for (const [name, contact] of [
      ["Marie Dupont", "514 555-0123"],
      ["Paul Tremblay", ""],
      ["Sophie Roy", "12 rue des Lilas"],
    ] as const) {
      const item = row(name);
      if (contact !== "") {
        const shown = item.getByText(contact, { exact: true });
        expect(await shown.count()).toBe(1);
        await expectAfter(item.getByText(name, { exact: true }), shown);
      }
      const edit = item.locator(`a[href="/members/${idOf(name)}"]`);
      expect(await edit.count()).toBe(1);
      expect((await edit.innerText()).trim()).not.toBe("");
    }
    expect(await membersMessage(language)).toBe("");
    await expectBelow(row("Sophie Roy"), addHeading(language));
  });

  // /ui/members-page/list
  it("leads to the Member page by the edit link", async () => {
    await signInAlice(language);
    await addMember("Marie Dupont", "514 555-0123");
    await open("/members");
    await row("Marie Dupont").locator("a").click();
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe(`/members/${idOf("Marie Dupont")}`);
    await expect.poll(() => page.title()).toBe("Marie Dupont");
  });

  // /ui/members-page/add
  it("shows the add form under its heading, below the list, with two empty fields and the add button", async () => {
    await signInAlice(language);
    await addMember("Marie Dupont", "514 555-0123");
    await open("/members");
    const form = addForm();
    expect(await form.count()).toBe(1);
    const name = form.locator('input[name="name"]');
    const contact = form.locator('input[name="contact"]');
    expect(await name.inputValue()).toBe("");
    expect(await contact.inputValue()).toBe("");
    expect(await labelOf(name)).not.toBe("");
    expect(await labelOf(contact)).not.toBe("");
    expect(await labelOf(name)).not.toBe(await labelOf(contact));
    const title = addHeading(language);
    expect((await title.innerText()).trim()).not.toBe("");
    const button = form.getByRole("button");
    expect(await button.count()).toBe(1);
    expect((await button.innerText()).trim()).not.toBe("");
    await expectBelow(row("Marie Dupont"), title);
    await expectBelow(title, name);
    await expectAfter(name, contact);
    await expectAfter(contact, button);
  });

  // /ui/members-page/add-member
  // /ui/members-page/done
  // /ui/members-page/add
  it("runs Add member with the two fields of the add form; the message names the member, the fields are empty again", async () => {
    await signInAlice(language);
    await open("/members");
    await addForm().locator('input[name="name"]').fill("Marie Dupont");
    await addForm().locator('input[name="contact"]').fill("514 555-0123");
    const form = await submit("/members/add", () =>
      addForm().getByRole("button").click(),
    );
    expect(form.getAll("name")).toEqual(["Marie Dupont"]);
    expect(form.getAll("contact")).toEqual(["514 555-0123"]);
    await expect.poll(() => row("Marie Dupont").count()).toBe(1);
    expect(await page.getAttribute("html", "lang")).toBe(language);
    expect((await page.title()).trim()).toBe(MEMBERS_TITLE[language]);
    expect(await membersMessage(language)).toContain("Marie Dupont");
    expect(await addForm().locator('input[name="name"]').inputValue()).toBe("");
    expect(await addForm().locator('input[name="contact"]').inputValue()).toBe(
      "",
    );
  });

  // /ui/members-page/refused
  // /ui/members-page/done
  it("shows a message after a refused case, and the list as it is", async () => {
    await signInAlice(language);
    await addMember("Marie Dupont", "514 555-0123");
    await open("/members");
    await addForm().locator('input[name="name"]').fill("Marie Dupont");
    await submit("/members/add", () => addForm().getByRole("button").click());
    await expect.poll(() => membersMessage(language)).not.toBe("");
    expect((await page.title()).trim()).toBe(MEMBERS_TITLE[language]);
    expect(await page.getAttribute("html", "lang")).toBe(language);
    expect(await page.getByRole("listitem").count()).toBe(1);
    expect(await row("Marie Dupont").count()).toBe(1);
  });

  // /ui/members-page/sign-out
  it("runs Sign out when the sign-out button is clicked; the Home page then shows", async () => {
    await signInAlice(language);
    await open("/members");
    await expectSignOut();
  });
});

describe.each(["fr", "en"] as const)("Member page in %s", (language) => {
  // /ui/general/display-language
  // /ui/general/stylesheet
  // /ui/member-page/title
  it("is in the display language, loads the stylesheet, and has the member's name as its document title", async () => {
    await signInAlice(language);
    await addMember("Marie Dupont", "514 555-0123");
    await open(`/members/${idOf("Marie Dupont")}`);
    expect(await page.getAttribute("html", "lang")).toBe(language);
    await expectStylesheet();
    expect((await page.title()).trim()).toBe("Marie Dupont");
  });

  // /ui/member-page/header
  // /ui/member-page/heading
  // /ui/member-page/members
  // /ui/member-page/refused
  // /ui/member-page/form
  // /ui/member-page/delete
  it("shows the header, the name, the members link, the edit form holding the record, then the delete link, and no message", async () => {
    await signInAlice(language);
    await addMember("Marie Dupont", "514 555-0123");
    const id = idOf("Marie Dupont");
    await open(`/members/${id}`);
    const signOut = await expectDashboardHeader(language);
    const name = heading("Marie Dupont");
    expect(await name.count()).toBe(1);
    expect(await membersLink().count()).toBe(1);
    expect((await membersLink().innerText()).trim()).not.toBe("");
    const form = editForm(id);
    expect(await form.count()).toBe(1);
    const nameField = form.locator('input[name="name"]');
    const contactField = form.locator('input[name="contact"]');
    expect(await labelOf(nameField)).not.toBe("");
    expect(await labelOf(contactField)).not.toBe("");
    const save = form.getByRole("button");
    expect(await save.count()).toBe(1);
    expect((await save.innerText()).trim()).not.toBe("");
    expect(await deleteLink(id).count()).toBe(1);
    expect((await deleteLink(id).innerText()).trim()).not.toBe("");
    await expectBelow(signOut, name);
    await expectBelow(name, membersLink());
    await expectBelow(membersLink(), nameField);
    await expectAfter(nameField, contactField);
    await expectAfter(contactField, save);
    await expectBelow(save, deleteLink(id));
    expect(await textBetween(membersLink(), form)).toBe("");
  });

  // /ui/member-page/members
  it("leads to the Members page by the members link", async () => {
    await signInAlice(language);
    await addMember("Marie Dupont");
    await open(`/members/${idOf("Marie Dupont")}`);
    await membersLink().click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/members");
    await expect.poll(() => page.title()).toBe(MEMBERS_TITLE[language]);
  });

  // /ui/member-page/delete
  it("leads to the Member deletion page by the delete link", async () => {
    await signInAlice(language);
    await addMember("Marie Dupont");
    const id = idOf("Marie Dupont");
    await open(`/members/${id}`);
    await deleteLink(id).click();
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe(`/members/${id}/delete`);
    await expect.poll(() => page.title()).toBe(DELETION_TITLE[language]);
  });

  // /ui/member-page/edit-member
  // /ui/members-page/done
  it("runs Edit member with the member's id and the two fields; the Members page names the new name", async () => {
    await signInAlice(language);
    await addMember("Marie Dupont", "514 555-0123");
    const id = idOf("Marie Dupont");
    await open(`/members/${id}`);
    await editForm(id).locator('input[name="name"]').fill("Marie Roy");
    await editForm(id)
      .locator('input[name="contact"]')
      .fill("marie@example.org");
    const form = await submit(`/members/${id}/edit`, () =>
      editForm(id).getByRole("button").click(),
    );
    expect(form.getAll("name")).toEqual(["Marie Roy"]);
    expect(form.getAll("contact")).toEqual(["marie@example.org"]);
    await expect.poll(() => page.title()).toBe(MEMBERS_TITLE[language]);
    expect(await row("Marie Roy").count()).toBe(1);
    expect(
      await row("Marie Roy")
        .getByText("marie@example.org", { exact: true })
        .count(),
    ).toBe(1);
    expect(await membersMessage(language)).toContain("Marie Roy");
  });

  // /ui/member-page/refused
  it("shows a message after a refused case, with the member's record as stored", async () => {
    await signInAlice(language);
    await addMember("Marie Dupont", "514 555-0123");
    await addMember("Paul Tremblay");
    const id = idOf("Marie Dupont");
    await open(`/members/${id}`);
    await editForm(id).locator('input[name="name"]').fill("Paul Tremblay");
    await editForm(id).locator('input[name="contact"]').fill("x@example.org");
    await submit(`/members/${id}/edit`, () =>
      editForm(id).getByRole("button").click(),
    );
    await expect.poll(() => page.title()).toBe("Marie Dupont");
    expect(await page.getAttribute("html", "lang")).toBe(language);
    const nameField = editForm(id).locator('input[name="name"]');
    expect(await nameField.inputValue()).toBe("Marie Dupont");
    expect(
      await editForm(id).locator('input[name="contact"]').inputValue(),
    ).toBe("514 555-0123");
    expect(await textBetween(membersLink(), editForm(id))).not.toBe("");
    await expectBelow(heading("Marie Dupont"), membersLink());
    expect(await deleteLink(id).count()).toBe(1);
  });

  // /ui/member-page/sign-out
  it("runs Sign out when the sign-out button is clicked; the Home page then shows", async () => {
    await signInAlice(language);
    await addMember("Marie Dupont");
    await open(`/members/${idOf("Marie Dupont")}`);
    await expectSignOut();
  });
});

describe.each(["fr", "en"] as const)(
  "Member deletion page in %s",
  (language) => {
    // /ui/general/display-language
    // /ui/general/stylesheet
    // /ui/member-deletion-page/title
    it("is in the display language, loads the stylesheet, and has the deletion title as its document title", async () => {
      await signInAlice(language);
      await addMember("Marie Dupont");
      await open(`/members/${idOf("Marie Dupont")}/delete`);
      expect(await page.getAttribute("html", "lang")).toBe(language);
      await expectStylesheet();
      expect((await page.title()).trim()).toBe(DELETION_TITLE[language]);
    });

    // /ui/member-deletion-page/header
    // /ui/member-deletion-page/heading
    // /ui/member-deletion-page/question
    // /ui/member-deletion-page/buttons
    it("shows the header, the title, the question naming the member, then the confirm button and the cancel link", async () => {
      await signInAlice(language);
      await addMember("Marie Dupont");
      const id = idOf("Marie Dupont");
      await open(`/members/${id}/delete`);
      const signOut = await expectDashboardHeader(language);
      const title = heading(DELETION_TITLE[language]);
      expect(await title.count()).toBe(1);
      const confirm = page
        .locator(`main form[action="/members/${id}/delete"]`)
        .getByRole("button");
      expect(await confirm.count()).toBe(1);
      expect((await confirm.innerText()).trim()).not.toBe("");
      const cancel = page.locator(`main a[href="/members/${id}"]`);
      expect(await cancel.count()).toBe(1);
      expect((await cancel.innerText()).trim()).not.toBe("");
      await expectBelow(signOut, title);
      const question = await textBetween(title, confirm);
      expect(question).toContain("Marie Dupont");
      await expectAfter(confirm, cancel);
    });

    // /ui/member-deletion-page/buttons
    it("leads to the Member page by the cancel link", async () => {
      await signInAlice(language);
      await addMember("Marie Dupont");
      const id = idOf("Marie Dupont");
      await open(`/members/${id}/delete`);
      await page.locator(`main a[href="/members/${id}"]`).click();
      await expect
        .poll(() => new URL(page.url()).pathname)
        .toBe(`/members/${id}`);
      await expect.poll(() => page.title()).toBe("Marie Dupont");
    });

    // /ui/member-deletion-page/delete-member
    // /ui/members-page/done
    it("runs Delete member with the member's id; the Members page names the member", async () => {
      await signInAlice(language);
      await addMember("Marie Dupont");
      await addMember("Paul Tremblay");
      const id = idOf("Marie Dupont");
      await open(`/members/${id}/delete`);
      await submit(`/members/${id}/delete`, () =>
        page
          .locator(`main form[action="/members/${id}/delete"]`)
          .getByRole("button")
          .click(),
      );
      await expect.poll(() => page.title()).toBe(MEMBERS_TITLE[language]);
      expect(await row("Marie Dupont").count()).toBe(0);
      expect(await row("Paul Tremblay").count()).toBe(1);
      expect(await membersMessage(language)).toContain("Marie Dupont");
    });

    // /ui/member-deletion-page/sign-out
    it("runs Sign out when the sign-out button is clicked; the Home page then shows", async () => {
      await signInAlice(language);
      await addMember("Marie Dupont");
      await open(`/members/${idOf("Marie Dupont")}/delete`);
      await expectSignOut();
    });
  },
);
