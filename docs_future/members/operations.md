# Operations

## General

× - [volunteers-refused] A refused case that answers with the Volunteers
×   page answers with a 4xx status, free.
- [volunteers-refused] A refused case that answers with the Volunteers
  page, the Members page or the Member page answers with a 4xx status,
  free.
- [trimmed] The `name` and `contact` inputs of /operations/add-member
  and /operations/edit-member are read without the whitespace at their
  start and end.

## Create association

× 3. [created] Otherwise: a new association with the name, whose only
×    volunteer has the login and the password, `failures` 0, no `lock`;
×    exits with status 0.
3. [created] Otherwise: a new association with the name and no
   member, whose only volunteer has the login and the password,
   `failures` 0, no `lock`; exits with status 0.

## Migrate members

Trigger: the first start of the app on a database without members.

- [no-member] Every association has no member.

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
