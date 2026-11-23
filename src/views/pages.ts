import { TEXTS, otherLanguage, type Language } from "../locales/index.js";
import { html, type Html } from "./html.js";

function layout(
  language: Language,
  title: string,
  header: Html,
  body: Html,
): string {
  return html`<!doctype html>
    <html lang="${language}">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <link rel="stylesheet" href="/style.css" />
      </head>
      <body>
        ${header}
        <main>${body}</main>
      </body>
    </html> `.value;
}

export function homePage(language: Language): string {
  const t = TEXTS[language];
  const other = otherLanguage(language);
  const header = html`<header class="site-header">
    <h1>${t.appName}</h1>
    <form method="post" action="/language">
      <input type="hidden" name="language" value="${other}" />
      <button type="submit" class="language-switch" lang="${other}">
        ${TEXTS[other].switchTo}
      </button>
    </form>
  </header>`;
  return layout(language, t.appName, header, html`<p>${t.welcome}</p>`);
}

export function refusalPage(language: Language, message: string): string {
  const t = TEXTS[language];
  const header = html`<header class="site-header">
    <h1>${t.appName}</h1>
  </header>`;
  return layout(
    language,
    t.appName,
    header,
    html`<p>${message}</p>
      <p><a href="/">${t.backHome}</a></p>`,
  );
}
