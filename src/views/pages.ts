import { TEXTS, otherLanguage, type Language } from "../locales/index.js";
import type { SignedIn } from "../store.js";
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

export function homePage(language: Language, signedIn: boolean): string {
  const t = TEXTS[language];
  const other = otherLanguage(language);
  const account = signedIn
    ? html`<a class="account-link" href="/dashboard">${t.dashboardLink}</a>`
    : html`<a class="account-link" href="/sign-in">${t.signInLink}</a>`;
  const header = html`<header class="site-header">
    <h1>${t.appName}</h1>
    <form method="post" action="/language">
      <input type="hidden" name="language" value="${other}" />
      <button type="submit" class="language-switch" lang="${other}">
        ${TEXTS[other].switchTo}
      </button>
    </form>
    ${account}
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

/** The app name, as a link to the Home page. */
function homeLink(language: Language): Html {
  return html`<h1><a href="/">${TEXTS[language].appName}</a></h1>`;
}

export function signInPage(language: Language, failed: boolean): string {
  const t = TEXTS[language];
  const header = html`<header class="site-header">
    ${homeLink(language)}
  </header>`;
  const message = failed
    ? html`<p class="message error" role="alert">${t.signInFailed}</p>`
    : html``;
  return layout(
    language,
    t.signInTitle,
    header,
    html`<h2>${t.signInTitle}</h2>
      ${message}
      <form class="stacked-form panel" method="post" action="/sign-in">
        <label
          >${t.loginLabel}
          <input type="text" name="login" autocomplete="username" required />
        </label>
        <label
          >${t.passwordLabel}
          <input
            type="password"
            name="password"
            autocomplete="current-password"
            required
          />
        </label>
        <button type="submit" class="primary">${t.signInButton}</button>
      </form>`,
  );
}

/** The header of the pages of a signed-in volunteer. */
function volunteerHeader(language: Language, signedIn: SignedIn): Html {
  return html`<header class="site-header">
    ${homeLink(language)}
    <span class="signed-in">${signedIn.login}</span>
    <form method="post" action="/sign-out">
      <button type="submit">${TEXTS[language].signOutButton}</button>
    </form>
  </header>`;
}

export function dashboardPage(language: Language, signedIn: SignedIn): string {
  const t = TEXTS[language];
  return layout(
    language,
    signedIn.associationName,
    volunteerHeader(language, signedIn),
    html`<h2>${signedIn.associationName}</h2>
      <p><a class="nav-link" href="/volunteers">${t.volunteersLink}</a></p>`,
  );
}

/** A message after an operation: done, or refused. */
export interface Notice {
  refused: boolean;
  text: string;
}

export function volunteersPage(
  language: Language,
  signedIn: SignedIn,
  logins: readonly string[],
  notice?: Notice,
): string {
  const t = TEXTS[language];
  const message =
    notice === undefined
      ? html``
      : notice.refused
        ? html`<p class="message error" role="alert">${notice.text}</p>`
        : html`<p class="message done" role="status">${notice.text}</p>`;
  const sorted = [...logins].sort((a, b) => a.localeCompare(b, language));
  const items = sorted.map(
    (login) =>
      html`<li>
        <span class="login">${login}</span>
        <form method="post" action="/volunteers/password">
          <input type="hidden" name="login" value="${login}" />
          <input
            type="password"
            name="password"
            autocomplete="new-password"
            aria-label="${t.newPasswordLabel}"
            placeholder="${t.newPasswordLabel}"
            required
          />
          <button type="submit">${t.setPasswordButton}</button>
        </form>
        <form method="post" action="/volunteers/remove">
          <input type="hidden" name="login" value="${login}" />
          <button type="submit" class="danger">${t.removeButton}</button>
        </form>
      </li>`,
  );
  return layout(
    language,
    t.volunteersTitle,
    volunteerHeader(language, signedIn),
    html`<h2>${t.volunteersTitle}</h2>
      <p><a class="nav-link" href="/dashboard">${t.dashboardLink}</a></p>
      ${message}
      <ul class="volunteer-list">
        ${items}
      </ul>
      <form class="stacked-form panel" method="post" action="/volunteers/add">
        <h3>${t.addVolunteerHeading}</h3>
        <label
          >${t.loginLabel}
          <input type="text" name="login" autocomplete="off" required />
        </label>
        <label
          >${t.passwordLabel}
          <input
            type="password"
            name="password"
            autocomplete="new-password"
            required
          />
        </label>
        <button type="submit" class="primary">${t.addButton}</button>
      </form>`,
  );
}
