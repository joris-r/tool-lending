# Model

## Language

A language of the interface.

- [languages] `fr` or `en`.

## Visitor

A browser using the app.

- `language: optional /model/language`, the language the visitor
  chose; absent until they choose one.
- `session: optional /model/session`, the session its browser keeps;
  absent until a volunteer signs in from it.

Display language: the visitor's `language`, or `fr` when absent.

## Association

A neighbourhood association using the installation.

- `name: string`
  - [name] Not empty, with no whitespace at its start or end.
  - [name-unique] No two associations share it.
- `volunteers: set of /model/volunteer`
  - [one-volunteer] Not empty.
  - [own-volunteers] No two associations share a volunteer.
- `members: set of /model/member`
- `nextMemberId: integer`, the id its next new member gets.
  - [next-member-id] Greater than the id of each of its members.

## Member

A person who borrows the association's tools.

- `id: integer`, identifies the member.
  - [id-unique] No two members of an association share it.
- `name: string`
  - [name] Not empty, with no whitespace at its start or end.
  - [name-unique] No two members of an association share it.
- `contact: string`, how the volunteers reach them; may be empty.
  - [contact] No whitespace at its start or end.

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

## Session

A volunteer signed in from one browser.

- `volunteer: /model/volunteer`
  - [session-volunteer] A volunteer of an association.
- `lastUsed: time`, the time of its last request.

Signed-in volunteer: the volunteer of the visitor's `session`.

## Application

The state: everything the software stores.

- `visitors: set of /model/visitor`, each kept in its own browser.
- `associations: set of /model/association`
- `sessions: set of /model/session`
