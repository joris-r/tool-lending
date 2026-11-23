# Security

## Assets

- The visitor's choice of language.
- The integrity of the pages the site serves.

## Actors

- A foreign page: a page of another site, open in a visitor's
  browser.
- An anonymous client: anyone on the internet, sending any request.

## Boundaries

- The HTTP interface, open to the internet: visitors, foreign pages
  and anonymous clients.

## Threats

- [foreign-page] A foreign page changes a visitor's language through
  the HTTP interface: mitigated by /operations/general/origin.
- [framing] A foreign page shows the app's pages in a frame, to make a
  visitor click them unknowingly: mitigated by
  /operations/general/framing.
- [sniffing] A foreign page has a visitor's browser read an answer of
  the app as another type than it declares, such as a script:
  mitigated by /operations/general/nosniff.
- [injection] An anonymous client gets its input rendered as markup
  in a page: mitigated by /technical/stack.
- [dependency] A known vulnerability in a dependency is exploited
  through the HTTP interface: mitigated by
  /technical/test-and-quality-policy.
- [flood] An anonymous client floods the server with requests:
  accepted, left to the host's reverse proxy.
