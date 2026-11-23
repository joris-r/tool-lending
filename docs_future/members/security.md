# Security

## Assets

- The integrity of the pages the site serves.…
- Each association's data, which only its volunteers read and change.
- The volunteers' passwords.

## Actors

- An anonymous client: anyone on the internet, sending any request.…
- A volunteer of another association: signed in, trusted only with
  their own association's data.
- A former volunteer: one whose password the operator reset.

## Boundaries

× - The HTTP interface, open to the internet: visitors, foreign pages
×   and anonymous clients.
- The HTTP interface, open to the internet: visitors, volunteers,
  foreign pages and anonymous clients.

## Threats

  accepted, left to the host's reverse proxy.…
- [unsigned] An anonymous client reads or changes an association's
  data: mitigated by /operations/general/volunteers-only.
- [forged-request] A foreign page runs a volunteer's operations from
  their browser: mitigated by /operations/general/origin.
- [guessing] An anonymous client guesses a volunteer's password by
  trying many: mitigated by /model/volunteer/password-length and
  /operations/sign-in/wrong-password.
- [lockout] An anonymous client keeps a volunteer from signing in by
  failing on purpose: accepted.
- [other-association] A volunteer of another association reads or
  changes an association's data: mitigated by
  /operations/general/own-association.
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
- [own-volunteer] A volunteer misuses their own association's data:
  accepted.
- [retention] An association keeps personal data after it is no longer
  needed: accepted, left to the association.
