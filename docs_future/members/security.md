# Security

## Actors

- An anonymous client: anyone on the internet, sending any request.…
- A volunteer of another association: signed in, trusted only with
  their own association's data.
× - A former volunteer: one whose password the operator reset.
- A former volunteer: one removed from their association, or whose
  password the operator or another volunteer set.

## Threats

  failing on purpose: accepted.…
- [other-association] A volunteer of another association reads or
  changes an association's data: mitigated by
  /operations/general/own-association.
× - [former-volunteer] A former volunteer keeps their access: mitigated
×   by /operations/reset-password/set.
- [former-volunteer] A former volunteer keeps their access: mitigated
  by /operations/reset-password/set, /operations/set-password/set and
  /operations/remove-volunteer/removed.
  accepted.…
- [login-exists] A volunteer learns that a login is a volunteer's of
  another association, by adding it: accepted.
- [own-volunteer] A volunteer misuses their own association's data,
  or takes over the account of a volunteer of their association by
  setting its password: accepted.
- [retention] An association keeps personal data after it is no longer
  needed: accepted, left to the association.
