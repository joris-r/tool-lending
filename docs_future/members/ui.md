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
- [name] the association's name, as the page's heading.

Actions:
- [sign-out] The sign-out button clicked: runs /operations/sign-out;
  the Home page then shows.
