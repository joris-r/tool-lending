# Scenarios

## Other association

Plays /security/threats/other-association. "alice" is a volunteer of
"Outils du Plateau", signed in from her browser, and "carol" of
"Outils de Rosemont", which has no member. "Marie Dupont" is a member
of "Outils du Plateau".

- Carol signs in: the Dashboard page shows "Outils de Rosemont", and
  nothing of "Outils du Plateau".
- Her browser sends `GET /members/<id>` with the id of "Marie Dupont":
  it answers 404.
- It sends `POST /members/<id>/delete` with that id, from a page of
  the app: it answers 404.
- Alice opens the Members page: it lists "Marie Dupont".

## New member

"alice" is a volunteer of "Outils du Plateau", which has no member,
signed in.

- Alice clicks the members link of the Dashboard page: the Members
  page shows the empty-list text.
- In the add form, she types "Marie Dupont" and "514 555-0123", and
  clicks the add button: the Members page lists "Marie Dupont" with
  "514 555-0123".
- She types "Marie Dupont" again, with no contact, and clicks the add
  button: the Members page shows a refusal message, and lists one
  "Marie Dupont".

## Edited member

"alice" is a volunteer of "Outils du Plateau", signed in. "Marie
Dupont" is a member, with the contact "514 555-0123".

- Alice opens the Members page and clicks the edit link of "Marie
  Dupont": the Member page shows her name and contact in its fields.
- She replaces the contact with "marie@example.org" and clicks the
  save button: the Members page lists "Marie Dupont" with
  "marie@example.org".

## Deleted member

"alice" is a volunteer of "Outils du Plateau", signed in. "Marie
Dupont" and "Paul Tremblay" are members.

- Alice opens the Member page of "Marie Dupont" and clicks the delete
  link: the Member deletion page names "Marie Dupont".
- She clicks the cancel link: the Member page of "Marie Dupont" shows.
- She clicks the delete link, then the confirm button: the Members
  page lists only "Paul Tremblay".
- She opens the address of the Member page of "Marie Dupont" again: it
  answers 404.
