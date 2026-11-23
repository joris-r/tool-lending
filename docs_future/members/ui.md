# UI

## Home page

  `en`;…
- [account] in the header, after the language switch: without a
  signed-in volunteer, the sign-in link, to the Sign-in page; with one,
  the dashboard link, to the Dashboard page; each reading as in
  /contents/home-page;

## Sign-in page

At `/sign-in`, run by /operations/show-sign-in-page and answered by
/operations/sign-in when it fails.

Shows:
- [title] as its document title, the title of /contents/sign-in-page;

then, top to bottom:
- [header] the app name of /contents/home-page, as a link to the Home
  page;
- [heading] the title of /contents/sign-in-page;
- [failed] only when answered by /operations/sign-in: the failure
  message of /contents/sign-in-page;
- [form] a login field and a password field, both empty, then the
  sign-in button, labelled as in /contents/sign-in-page.

Actions:
- [sign-in] The sign-in button clicked: runs /operations/sign-in with
  the two fields.

## Dashboard page

At `/dashboard`, run by /operations/show-dashboard.

Shows:
- [title] as its document title, the association's name;

then, top to bottom:
- [header] the app name of /contents/home-page, as a link to the Home
  page, then the signed-in volunteer's login, then the sign-out
  button, labelled as in /contents/dashboard-page;
- [name] the association's name, as the page's heading;
- [members] the members link, to the Members page, reading as in
  /contents/dashboard-page;
- [volunteers] the volunteers link, to the Volunteers page, reading as
  in /contents/dashboard-page.

Actions:
- [sign-out] The sign-out button clicked: runs /operations/sign-out;
  the Home page then shows.

## Volunteers page

At `/volunteers`, run by /operations/show-volunteers, and answered by
/operations/add-volunteer, /operations/set-password and
/operations/remove-volunteer, except when they answer 303.

Shows:
- [title] as its document title, the title of
  /contents/volunteers-page;

then, top to bottom:
- [header] the header of the Dashboard page;
- [heading] the title of /contents/volunteers-page;
- [dashboard] the dashboard link, to the Dashboard page, reading as in
  /contents/volunteers-page;
- [done] only when answered by a case that is not refused: the message
  of /contents/volunteers-page for it, naming the login of the input;
- [refused] only when answered by a refused case: its message;
- [list] the association's volunteers, in alphabetical order of login,
  each with their login, an empty password field, the set-password
  button and the remove button, labelled as in
  /contents/volunteers-page;
- [add] the add form, under its heading: a login field and a password
  field, both empty, then the add button, labelled as in
  /contents/volunteers-page.

Actions:
- [set-password] A volunteer's set-password button clicked: runs
  /operations/set-password with their login and their password field.
- [remove] A volunteer's remove button clicked: runs
  /operations/remove-volunteer with their login; when it answers 303,
  the Home page then shows.
- [add-volunteer] The add button clicked: runs
  /operations/add-volunteer with the two fields of the add form.
- [sign-out] The sign-out button clicked: as on the Dashboard page.

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
