# Operations

## General

The pages run every operation on the server: HTML in answer, form
fields in requests. Each request comes from one visitor, the one its
browser keeps.

- [public] Anyone runs every operation, without signing in.
- [origin] A `POST` request without an `Origin`, or whose `Origin` is
  not `PUBLIC_ORIGIN`: refused, 403.
- [malformed] Any other request with an input missing or not of its
  type: refused, 400.
- [refused] A refused operation changes nothing and answers a page
  with a message, in the display language.
- [unknown-language] A language kept by the browser that is not a
  /model/language is read as no `language`.
- [framing] Every answer forbids browsers to show it inside a frame.
- [nosniff] Every answer forbids browsers to read it as another type
  than the one it declares.

## Initial state

- [new-visitor] A browser that keeps no language for the app is a
  visitor with no `language`.

## Show home page

HTTP: `GET /`.

- [result] Answers 200 with the Home page, in the display language.

## Get stylesheet

HTTP: `GET /style.css`.

- [result] Answers 200 with the stylesheet of the pages, as CSS.

## Choose language

HTTP: `POST /language` with `language=<language>`.

Inputs:
- `language: /model/language`

Cases:
- [chosen] The visitor's `language` is the input; answers 303 to `/`.

Then:
- [kept] After no refusal, the visitor's `language` stays the same
  for the next requests of its browser, until it chooses again or the
  browser drops it.
- [lifetime] After no refusal, the browser is asked to keep the
  `language` for a year after the choice. (not testable)
