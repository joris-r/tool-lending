# Security

## Assets

- The visitor's choice of language.
- The integrity of the pages the site serves.
- Each association's data, which only its volunteers read and change.
- The volunteers' passwords.

## Actors

- A foreign page: a page of another site, open in a visitor's
  browser.
- An anonymous client: anyone on the internet, sending any request.
- A former volunteer: one whose password the operator reset.

## Boundaries

- The HTTP interface, open to the internet: visitors, volunteers,
  foreign pages and anonymous clients.

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
- [unsigned] An anonymous client reads or changes an association's
  data: mitigated by /operations/general/volunteers-only.
- [forged-request] A foreign page runs a volunteer's operations from
  their browser: mitigated by /operations/general/origin.
- [guessing] An anonymous client guesses a volunteer's password by
  trying many: mitigated by /model/volunteer/password-length and
  /operations/sign-in/wrong-password.
- [lockout] An anonymous client keeps a volunteer from signing in by
  failing on purpose: accepted.
- [former-volunteer] A former volunteer keeps their access: mitigated
  by /operations/reset-password/set.
- [open-session] Someone uses a session left open in a shared browser:
  mitigated by /operations/general/expiry and
  /operations/sign-out/signed-out.
- [session-theft] A foreign page or an injected script reads a
  volunteer's session: mitigated by /technical/stack.
- [password-leak] A copy of the database reveals the volunteers'
  passwords: mitigated by /technical/stack.
- [new-association] An anonymous client creates an association:
  mitigated by /technical/stack.
- [operator] The operator reads or changes any association's data:
  accepted.
