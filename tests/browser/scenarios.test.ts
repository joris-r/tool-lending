import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import type { Server } from "node:http";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { startApp, startForeignSite, type Running } from "./helpers.js";

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
