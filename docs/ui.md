# UI

## General

- [display-language] Every page is in the display language, and its
  `html` element carries it in its `lang` attribute.
- [stylesheet] Every page loads /operations/get-stylesheet as its
  stylesheet.

## Home page

At `/`, run by /operations/show-home-page.

Shows:
- [title] as its document title, the app name of /contents/home-page;

then, top to bottom:
- [header] the app name, then the language switch: a button reading
  `English` when the display language is `fr`, `Français` when it is
  `en`;
- [account] in the header, after the language switch: without a
  signed-in volunteer, the sign-in link, to the Sign-in page; with one,
  the dashboard link, to the Dashboard page; each reading as in
  /contents/home-page;
- [welcome] the welcome text of /contents/home-page.

Actions:
- [switch] The language switch clicked: runs
  /operations/choose-language with the other language; the Home page
  then shows in it.

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
  the two fields; when it signs in, the Dashboard page then shows.

## Dashboard page

At `/dashboard`, run by /operations/show-dashboard.

Shows:
- [title] as its document title, the association's name;

then, top to bottom:
- [header] the app name of /contents/home-page, as a link to the Home
  page, then the signed-in volunteer's login, then the sign-out
  button, labelled as in /contents/dashboard-page;
- [name] the association's name, as the page's heading;
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
