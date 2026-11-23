# Scenarios

## Switching language

A browser that never used the app.

- The visitor opens `/`.
- The Home page shows `Prêt d'outils`, in French, with a button
  `English`.
- They click `English`.
- The Home page shows `Tool Lending`, in English, with a button
  `Français`.
- They reload the page: it is still in English.

## Foreign page

Plays /security/threats/foreign-page. A visitor whose display
language is `fr`.

- A foreign page sends `POST /language` with `language=en` from the
  visitor's browser.
- It is refused, 403.
- The visitor reloads `/`: the Home page is still in French.
