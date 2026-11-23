# Operations

## General

× - [public] Anyone runs every operation, without signing in.
- [public] Anyone runs the operations not marked `Volunteers only.`
  not `PUBLIC_ORIGIN`: refused, 403.…
- [volunteers-only] Any other request to an operation marked
  `Volunteers only.`, without a signed-in volunteer: answers 303 to
  `/sign-in`, and changes nothing.
  with a message, in the display language.…
- [command-refused] A refused command of the operator changes nothing,
  prints its message and exits with status 1, instead of answering a
  page.
  than the one it declares.…
- [own-association] An operation marked `Volunteers only.` reads and
  changes only the signed-in volunteer's association.
- [expiry] A session kept by the browser that is not in `sessions`, or
  whose `lastUsed` is longer ago than the inactivity limit, is read as
  no `session`; the limit is free, up to 7 days.
- [activity] After no refusal, a request with a signed-in volunteer
  sets its session's `lastUsed` to now.

## Initial state

× - [new-visitor] A browser that keeps no language for the app is a
×   visitor with no `language`.
- [new-visitor] A browser that keeps nothing for the app is a visitor
  with no `language` and no `session`.
- [no-association] No association, and no session.

## Show sign-in page

HTTP: `GET /sign-in`.

- [result] Answers 200 with the Sign-in page.

## Sign in

HTTP: `POST /sign-in` with `login=<login>&password=<password>`.

Inputs:
- `login: string`
- `password: string`

Cases:
1. [locked] Login of a volunteer whose `lock` is after now: answers
   401 with the Sign-in page, failed.
2. [signed-in] Login of a volunteer, and their password:
   - the volunteer's `failures` is 0, and their `lock` absent;
   - a new session of the volunteer, `lastUsed` now, is the visitor's
     `session`; the visitor's earlier session, if any, is no longer
     stored;
   - answers 303 to `/dashboard`.
3. [wrong-password] Login of a volunteer, another password:
   - the volunteer's `failures` grows by 1; when that makes 5, it is 0
     and their `lock` is 15 minutes from now;
   - answers 401 with the Sign-in page, failed.
4. [unknown-login] Any other login: answers 401 with the Sign-in page,
   failed.

## Sign out

HTTP: `POST /sign-out`.

- [signed-out] The visitor's session, if any, is no longer stored, and
  the visitor has no `session`; answers 303 to `/`.

## Show dashboard

HTTP: `GET /dashboard`. Volunteers only.

- [result] Answers 200 with the Dashboard page of the signed-in
  volunteer's association.

## Create association

Trigger: the operator runs
`node dist/admin.js create-association <name> <login>`, then types the
password on standard input.

Inputs:
- `name: string`
- `login: string`
- `password: string`

Cases:
1. [invalid] A name refused by /model/association/name, a login
   refused by /model/volunteer/login, or a password refused by
   /model/volunteer/password-length: refused.
2. [taken] The name of an association, or the login of a volunteer:
   refused.
3. [created] Otherwise: a new association with the name, whose only
   volunteer has the login and the password, `failures` 0, no `lock`;
   exits with status 0.

## Reset password

Trigger: the operator runs `node dist/admin.js reset-password <login>`,
then types the password on standard input.

Inputs:
- `login: string`
- `password: string`

Cases:
1. [short] A password refused by /model/volunteer/password-length:
   refused.
2. [set] The login of a volunteer: their `password` is the input,
   `failures` 0, no `lock`, and none of their sessions is stored any
   more; exits with status 0.
3. [unknown] Any other login: refused.
