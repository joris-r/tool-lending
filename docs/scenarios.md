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

## First volunteer

The operator created the association "Outils du Plateau", whose only
volunteer is "alice".

- A visitor opens `/` and clicks the sign-in link.
- They type "alice" and her password, and click the sign-in button.
- The Dashboard page shows "Outils du Plateau", with "alice" in its
  header.
- They click the sign-out button: the Home page shows the sign-in
  link.

## Former volunteer

"bob" is a volunteer, signed in from their browser.

- The operator runs `reset-password` for "bob" with a new password.
- Bob reloads the Dashboard page: the Sign-in page shows.

## Password guessing

Plays /security/threats/guessing. "alice" is a volunteer.

- An anonymous client sends `POST /sign-in`, with `PUBLIC_ORIGIN` as
  its `Origin`, the login "alice" and five wrong passwords: each
  answers 401.
- It sends her password: it answers 401.
- Fifteen minutes later, Alice signs in with her password: the
  Dashboard page shows.
