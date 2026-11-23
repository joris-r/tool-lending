# UI

## Dashboard page

- [name] the association's name, as the page's heading;…
- [members] the members link, to the Members page, reading as in
  /contents/dashboard-page;

## Members page

At `/members`, run by /operations/show-members, and answered by
/operations/add-member, /operations/edit-member/edited and
/operations/delete-member/deleted.

Shows:
- [title] as its document title, the title of /contents/members-page;

then, top to bottom:
- [header] the header of the Dashboard page;
- [heading] the title of /contents/members-page;
- [dashboard] the dashboard link, to the Dashboard page, reading as in
  /contents/members-page;
- [done] only when answered by a case that is not refused: the message
  of /contents/members-page for it, naming the member by name, the
  new one after an edit;
- [refused] only when answered by a refused case: its message;
- [list] with some members: the association's members, in
  alphabetical order of name, each with their name, their contact,
  and the edit link, to their Member page, labelled as in
  /contents/members-page;
- [empty] with no member: the empty-list text of
  /contents/members-page;
- [add] the add form, under its heading: a name field and a contact
  field, both empty, then the add button, labelled as in
  /contents/members-page.

Actions:
- [add-member] The add button clicked: runs /operations/add-member
  with the two fields of the add form.
- [sign-out] The sign-out button clicked: as on the Dashboard page.

## Member page

At `/members/<id>`, run by /operations/show-member, and answered by
/operations/edit-member/invalid and /operations/edit-member/taken.

Shows:
- [title] as its document title, the member's name;

then, top to bottom:
- [header] the header of the Dashboard page;
- [heading] the member's name;
- [members] the members link, to the Members page, reading as in
  /contents/member-page;
- [refused] only when answered by a refused case: its message;
- [form] the edit form: a name field holding the member's name and a
  contact field holding their contact, then the save button, labelled
  as in /contents/member-page;
- [delete] the delete link, to the Member deletion page of the
  member, labelled as in /contents/member-page.

Actions:
- [edit-member] The save button clicked: runs /operations/edit-member
  with the member's id and the two fields of the edit form.
- [sign-out] The sign-out button clicked: as on the Dashboard page.

## Member deletion page

At `/members/<id>/delete`, run by /operations/show-member-deletion.

Shows:
- [title] as its document title, the title of
  /contents/member-deletion-page;

then, top to bottom:
- [header] the header of the Dashboard page;
- [heading] the title of /contents/member-deletion-page;
- [question] the question of /contents/member-deletion-page, naming
  the member's name;
- [buttons] the confirm button, then the cancel link, to the Member
  page of the member, labelled as in /contents/member-deletion-page.

Actions:
- [delete-member] The confirm button clicked: runs
  /operations/delete-member with the member's id.
- [sign-out] The sign-out button clicked: as on the Dashboard page.
