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

## New volunteer

"alice" is the only volunteer of "Outils du Plateau", signed in.

- Alice clicks the volunteers link of the Dashboard page.
- In the add form, she types "dan" and a password, and clicks the add
  button: the Volunteers page lists "alice" and "dan".
- In another browser, Dan signs in with that password: the Dashboard
  page shows "Outils du Plateau".

## Removed volunteer

"alice" and "bob" are volunteers of "Outils du Plateau", each signed in
from their own browser.

- Alice opens the Volunteers page and clicks the remove button of
  "bob": the page lists only "alice".
- Bob reloads the Dashboard page: the Sign-in page shows.
- Bob signs in with their password: the Sign-in page shows the failure
  message.
- Alice clicks her own remove button: the Volunteers page shows a
  refusal message, and still lists "alice".
