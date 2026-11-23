# Model

## Visitor

  chose; absent until they choose one.…
- `session: optional /model/session`, the session its browser keeps;
  absent until a volunteer signs in from it.

## Association

A neighbourhood association using the installation.

- `name: string`
  - [name] Not empty, with no whitespace at its start or end.
  - [name-unique] No two associations share it.
- `volunteers: set of /model/volunteer`
  - [one-volunteer] Not empty.
- `members: set of /model/member`

## Volunteer

A person who runs an association's lending, and signs in to do so.

- `login: string`, what they sign in with.
  - [login] Not empty, with no whitespace.
  - [login-unique] No two volunteers share it, across all associations.
- `password: string`
  - [password-length] At least 12 characters.
- `failures: integer`, their failed sign-ins counted towards a
  lockout.
  - [failures] From 0 to 4.
- `lock: optional time`, the end of their lockout.

## Member

A person who borrows the association's tools.

- `id: integer`, identifies the member.
  - [id-unique] No two members of an association share it.
- `name: string`
  - [name] Not empty, with no whitespace at its start or end.
  - [name-unique] No two members of an association share it.
- `contact: string`, how the volunteers reach them; may be empty.
  - [contact] No whitespace at its start or end.

## Session

A volunteer signed in from one browser.

- `volunteer: /model/volunteer`
  - [session-volunteer] A volunteer of an association.
- `lastUsed: time`, the time of its last request.

Signed-in volunteer: the volunteer of the visitor's `session`.

## Application

- `visitors: set of /model/visitor`, each kept in its own browser.…
- `associations: set of /model/association`
- `sessions: set of /model/session`
