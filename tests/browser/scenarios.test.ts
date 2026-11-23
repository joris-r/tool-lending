import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import type { Server } from "node:http";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { startApp, startForeignSite, type Running } from "./helpers.js";
import { MINUTE, admin, createAssociation } from "../http/helpers.js";

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

// /scenarios/switching-language
it("Switching language", async () => {
  await page.goto(`${running.origin}/`);
  expect(await page.getAttribute("html", "lang")).toBe("fr");
  await expect
    .poll(() => page.locator("body").innerText())
    .toContain("Prêt d'outils");
  const english = page.getByRole("button", { name: "English", exact: true });
  expect(await english.count()).toBe(1);

  await english.click();
  await expect.poll(() => page.getAttribute("html", "lang")).toBe("en");
  await expect
    .poll(() => page.locator("body").innerText())
    .toContain("Tool Lending");
  expect(
    await page.getByRole("button", { name: "Français", exact: true }).count(),
  ).toBe(1);

  await page.reload();
  expect(await page.getAttribute("html", "lang")).toBe("en");
  expect(await page.locator("body").innerText()).toContain("Tool Lending");
});

// /scenarios/foreign-page
it("Foreign page", async () => {
  let foreign: Server | undefined;
  try {
    const site = await startForeignSite(`<!doctype html>
<form id="f" method="post" action="${running.origin}/language">
  <input type="hidden" name="language" value="en">
</form>
<script>document.getElementById("f").submit();</script>`);
    foreign = site.server;

    await page.goto(`${running.origin}/`);
    expect(await page.getAttribute("html", "lang")).toBe("fr");

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url() === `${running.origin}/language`),
      page.goto(site.origin),
    ]);
    expect(response.status()).toBe(403);

    await page.goto(`${running.origin}/`);
    expect(await page.getAttribute("html", "lang")).toBe("fr");
  } finally {
    foreign?.close();
  }
});

/** Runs a scenario on an app of its own, on a new database. */
async function onOwnApp(body: (own: Running) => Promise<void>): Promise<void> {
  const own = await startApp();
  try {
    await body(own);
  } finally {
    await own.app.close();
  }
}

/** Signs in from the Sign-in page, as a volunteer types it. */
async function signInFromPage(
  own: Running,
  login: string,
  password: string,
): Promise<void> {
  await page.goto(`${own.origin}/sign-in`);
  await page.locator('input[name="login"]').fill(login);
  await page.locator('input[name="password"]').fill(password);
  await page.locator("main form").getByRole("button").click();
}

// /scenarios/first-volunteer
it("First volunteer", async () => {
  await onOwnApp(async (own) => {
    const password = "alice's secret phrase";
    await createAssociation(own, "Outils du Plateau", "alice", password);

    await page.goto(`${own.origin}/`);
    await page.getByRole("link", { name: "Se connecter", exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/sign-in");

    await page.locator('input[name="login"]').fill("alice");
    await page.locator('input[name="password"]').fill(password);
    await page.locator("main form").getByRole("button").click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/dashboard");
    expect(
      await page
        .getByRole("heading", { name: "Outils du Plateau", exact: true })
        .count(),
    ).toBe(1);
    expect(await page.locator("header").innerText()).toContain("alice");

    await page.locator("header").getByRole("button").click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/");
    await expect
      .poll(() =>
        page.getByRole("link", { name: "Se connecter", exact: true }).count(),
      )
      .toBe(1);
  });
});

// /scenarios/former-volunteer
it("Former volunteer", async () => {
  await onOwnApp(async (own) => {
    await createAssociation(
      own,
      "Outils du Plateau",
      "bob",
      "bob's old password",
    );
    await signInFromPage(own, "bob", "bob's old password");
    await expect.poll(() => new URL(page.url()).pathname).toBe("/dashboard");

    const reset = await admin(
      own,
      ["reset-password", "bob"],
      "bob's new password\n",
    );
    expect(reset.status).toBe(0);

    await page.reload();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/sign-in");
    expect(await page.locator('input[name="password"]').count()).toBe(1);
  });
});

// /scenarios/password-guessing
it("Password guessing", async () => {
  await onOwnApp(async (own) => {
    const password = "alice's secret phrase";
    await createAssociation(own, "Outils du Plateau", "alice", password);

    const attempt = (guess: string) =>
      fetch(`${own.origin}/sign-in`, {
        method: "POST",
        headers: {
          origin: own.origin,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ login: "alice", password: guess }),
        redirect: "manual",
      });
    for (const guess of ["123456", "password", "alice", "qwerty", "letmein"]) {
      expect((await attempt(guess)).status).toBe(401);
    }
    expect((await attempt(password)).status).toBe(401);

    own.clock.advance(15 * MINUTE);
    await signInFromPage(own, "alice", password);
    await expect.poll(() => new URL(page.url()).pathname).toBe("/dashboard");
    await expect.poll(() => page.title()).toBe("Outils du Plateau");
  });
});

// /scenarios/new-volunteer
it("New volunteer", async () => {
  await onOwnApp(async (own) => {
    const password = "alice's secret phrase";
    const dans = "dan's own password";
    await createAssociation(own, "Outils du Plateau", "alice", password);
    await signInFromPage(own, "alice", password);
    await expect.poll(() => new URL(page.url()).pathname).toBe("/dashboard");

    await page.locator('main a[href="/volunteers"]').click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/volunteers");

    const add = page
      .locator("main form")
      .filter({ has: page.locator('input[name="login"]:visible') });
    await add.locator('input[name="login"]').fill("dan");
    await add.locator('input[name="password"]').fill(dans);
    await add.getByRole("button").click();
    await expect
      .poll(() => page.getByRole("listitem").filter({ hasText: "dan" }).count())
      .toBe(1);
    expect(
      await page.getByRole("listitem").filter({ hasText: "alice" }).count(),
    ).toBe(1);
    expect(await page.getByRole("listitem").count()).toBe(2);

    const other = await browser.newContext();
    try {
      const dan = await other.newPage();
      await dan.goto(`${own.origin}/sign-in`);
      await dan.locator('input[name="login"]').fill("dan");
      await dan.locator('input[name="password"]').fill(dans);
      await dan.locator("main form").getByRole("button").click();
      await expect.poll(() => new URL(dan.url()).pathname).toBe("/dashboard");
      expect(
        await dan
          .getByRole("heading", { name: "Outils du Plateau", exact: true })
          .count(),
      ).toBe(1);
    } finally {
      await other.close();
    }
  });
});

// /scenarios/removed-volunteer
it("Removed volunteer", async () => {
  await onOwnApp(async (own) => {
    const alices = "alice's secret phrase";
    const bobs = "bob's own password";
    await createAssociation(own, "Outils du Plateau", "alice", alices);
    await signInFromPage(own, "alice", alices);
    await expect.poll(() => new URL(page.url()).pathname).toBe("/dashboard");
    const added = await page.request.post(`${own.origin}/volunteers/add`, {
      form: { login: "bob", password: bobs },
      headers: { origin: own.origin },
    });
    expect(added.status()).toBe(200);

    const other = await browser.newContext();
    try {
      const bob = await other.newPage();
      await bob.goto(`${own.origin}/sign-in`);
      await bob.locator('input[name="login"]').fill("bob");
      await bob.locator('input[name="password"]').fill(bobs);
      await bob.locator("main form").getByRole("button").click();
      await expect.poll(() => new URL(bob.url()).pathname).toBe("/dashboard");

      const rowOf = (login: string) =>
        page
          .getByRole("listitem")
          .filter({ has: page.getByText(login, { exact: true }) });
      // The remove button: the row's button not sent with a password.
      const removeOf = (login: string) =>
        rowOf(login)
          .locator("form")
          .filter({ hasNot: page.locator('input[type="password"]') })
          .getByRole("button");
      await page.goto(`${own.origin}/volunteers`);
      await removeOf("bob").click();
      await expect.poll(() => rowOf("bob").count()).toBe(0);
      expect(await rowOf("alice").count()).toBe(1);
      expect(await page.getByRole("listitem").count()).toBe(1);

      await bob.reload();
      await expect.poll(() => new URL(bob.url()).pathname).toBe("/sign-in");
      const opened = await bob.locator("main").innerText();
      await bob.locator('input[name="login"]').fill("bob");
      await bob.locator('input[name="password"]').fill(bobs);
      const [answer] = await Promise.all([
        bob.waitForResponse(
          (r) =>
            r.url() === `${own.origin}/sign-in` &&
            r.request().method() === "POST",
        ),
        bob.locator("main form").getByRole("button").click(),
      ]);
      expect(answer.status()).toBe(401);
      await bob.waitForLoadState();
      expect(new URL(bob.url()).pathname).toBe("/sign-in");
      expect((await bob.locator("main").innerText()).length).toBeGreaterThan(
        opened.length,
      );

      // The page without a message, opened aside, as a reference.
      const aside = await page.context().newPage();
      await aside.goto(`${own.origin}/volunteers`);
      const unannounced = await aside.locator("main").innerText();
      await aside.close();
      await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url() === `${own.origin}/volunteers/remove` &&
            r.request().method() === "POST",
        ),
        removeOf("alice").click(),
      ]);
      await page.waitForLoadState();
      const refused = await page.locator("main").innerText();
      expect(refused).not.toContain("bob");
      expect(refused.length).toBeGreaterThan(unannounced.length);
      expect((await page.title()).trim()).toBe("Bénévoles");
      expect(await rowOf("alice").count()).toBe(1);
      expect(await page.getByRole("listitem").count()).toBe(1);
    } finally {
      await other.close();
    }
  });
});
