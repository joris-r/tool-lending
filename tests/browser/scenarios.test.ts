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
