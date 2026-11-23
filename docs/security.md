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
- [injection] An anonymous client gets its input rendered as markup
  in a page: mitigated by /technical/stack.
- [dependency] A known vulnerability in a dependency is exploited
  through the HTTP interface: mitigated by
  /technical/test-and-quality-policy.
- [flood] An anonymous client floods the server with requests:
  accepted, left to the host's reverse proxy.
