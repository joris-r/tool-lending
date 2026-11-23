# Model

## Association

- `volunteers: set of /model/volunteer`…
  - [own-volunteers] No two associations share a volunteer.…
- `members: set of /model/member`

## Member

A person who borrows the association's tools.

- `id: integer`, identifies the member.
  - [id-unique] No two members of an association share it.
- `name: string`
  - [name] Not empty, with no whitespace at its start or end.
  - [name-unique] No two members of an association share it.
- `contact: string`, how the volunteers reach them; may be empty.
  - [contact] No whitespace at its start or end.
