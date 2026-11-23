# Scenarios

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

- An anonymous client sends `POST /sign-in` with the login "alice" and
  five wrong passwords: each answers 401.
- It sends her password: it answers 401.
- Fifteen minutes later, Alice signs in with her password: the
  Dashboard page shows.

## Other association

Plays /security/threats/other-association. "alice" is a volunteer of
"Outils du Plateau", "carol" of "Outils de Rosemont".

- Carol signs in: the Dashboard page shows "Outils de Rosemont", and
  nothing of "Outils du Plateau".
