# UI

## General

- [display-language] Every page is in the display language, and its
  `html` element carries it in its `lang` attribute.

## Home page

At `/`, run by /operations/show-home-page.

Shows:
- [title] as its document title, the app name of /contents/home-page;

then, top to bottom:
- [header] the app name, then the language switch: a button reading
  `English` when the display language is `fr`, `Français` when it is
  `en`;
- [welcome] the welcome text of /contents/home-page.

Actions:
- [switch] The language switch clicked: runs
  /operations/choose-language with the other language; the Home page
  then shows in it.
