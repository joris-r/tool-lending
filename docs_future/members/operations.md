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
  changes only the signed-in volunteer's association, except that
  /operations/add-volunteer/taken reads the logins of every
  association.
- [expiry] A session kept by the browser that is not in `sessions`, or
  whose `lastUsed` is longer ago than the inactivity limit, is read as
  no `session`; the limit is free, up to 7 days.
- [activity] After no refusal, a request with a signed-in volunteer
  sets its session's `lastUsed` to now, if that session is still
  stored.
- [volunteers-refused] A refused case that answers with the Volunteers
  page, the Members page or the Member page answers with a 4xx status,
  free.
- [trimmed] The `name` and `contact` inputs of /operations/add-member
  and /operations/edit-member are read without the whitespace at their
  start and end.

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

## Show volunteers

HTTP: `GET /volunteers`. Volunteers only.

- [result] Answers 200 with the Volunteers page of the signed-in
  volunteer's association.

## Add volunteer

HTTP: `POST /volunteers/add` with `login=<login>&password=<password>`.
Volunteers only.

Inputs:
- `login: string`
- `password: string`

Cases:
1. [invalid] A login refused by /model/volunteer/login, or a password
   refused by /model/volunteer/password-length: refused, with the
   Volunteers page.
2. [taken] The login of a volunteer: refused, with the Volunteers
   page.
3. [added] Otherwise: a new volunteer of the signed-in volunteer's
   association, with the login and the password, `failures` 0, no
   `lock`; answers 200 with the Volunteers page, added.

## Set password

HTTP: `POST /volunteers/password` with
`login=<login>&password=<password>`. Volunteers only.

Inputs:
- `login: string`
- `password: string`

Cases:
1. [unknown] A login that is not of a volunteer of the signed-in
   volunteer's association: refused, with the Volunteers page.
2. [short] A password refused by /model/volunteer/password-length:
   refused, with the Volunteers page.
3. [set] Otherwise:
   - the volunteer's `password` is the input, `failures` 0, no `lock`;
   - none of their sessions is stored any more, except the visitor's;
   - answers 200 with the Volunteers page, set.

## Remove volunteer

HTTP: `POST /volunteers/remove` with `login=<login>`. Volunteers only.

Inputs:
- `login: string`

Cases:
1. [unknown] A login that is not of a volunteer of the signed-in
   volunteer's association: refused, with the Volunteers page.
2. [last] The login of the association's only volunteer: refused, with
   the Volunteers page.
3. [removed] Otherwise:
   - the volunteer is no longer one of the association, and none of
     their sessions is stored any more;
   - when they are the signed-in volunteer, the visitor has no
     `session`, and it answers 303 to `/`;
   - otherwise, it answers 200 with the Volunteers page, removed.

## Show members

HTTP: `GET /members`. Volunteers only.

- [result] Answers 200 with the Members page of the signed-in
  volunteer's association.

## Add member

HTTP: `POST /members/add` with `name=<name>&contact=<contact>`.
Volunteers only.

Inputs:
- `name: string`
- `contact: string`

Cases:
1. [invalid] A name refused by /model/member/name: refused, with the
   Members page.
2. [taken] The name of a member of the signed-in volunteer's
   association: refused, with the Members page.
3. [added] Otherwise: a new member of the association, with an id no
   member of the association has, the name and the contact; answers
   200 with the Members page, added.

## Show member

HTTP: `GET /members/<id>`. Volunteers only.

Inputs:
- `id: integer`

Cases:
- [result] The id of a member of the signed-in volunteer's
  association: answers 200 with the Member page of that member.
- [unknown] Any other id: refused, 404.

## Edit member

HTTP: `POST /members/<id>/edit` with `name=<name>&contact=<contact>`.
Volunteers only.

Inputs:
- `id: integer`
- `name: string`
- `contact: string`

Cases:
1. [unknown] An id that is not of a member of the signed-in
   volunteer's association: refused, 404.
2. [invalid] A name refused by /model/member/name: refused, with the
   Member page.
3. [taken] The name of another member of the association: refused,
   with the Member page.
4. [edited] Otherwise: the member's `name` and `contact` are the
   inputs; answers 200 with the Members page, edited.

## Show member deletion

HTTP: `GET /members/<id>/delete`. Volunteers only.

Inputs:
- `id: integer`

Cases:
- [result] The id of a member of the signed-in volunteer's
  association: answers 200 with the Member deletion page of that
  member.
- [unknown] Any other id: refused, 404.

## Delete member

HTTP: `POST /members/<id>/delete`. Volunteers only.

Inputs:
- `id: integer`

Cases:
- [deleted] The id of a member of the signed-in volunteer's
  association: the member is no longer stored; answers 200 with the
  Members page, deleted.
- [unknown] Any other id: refused, 404.

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
3. [created] Otherwise: a new association with the name and no
   member, whose only volunteer has the login and the password,
   `failures` 0, no `lock`; exits with status 0.

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
