# Members

Several associations share one installation, each with its own data.
The operator creates each association and its first volunteer; the
volunteers of an association sign in, manage its volunteers and
register its members.

## Outline

1. Volunteer sign-in done.
2. Manage volunteers: /overview (part), /security/actors (part),
   /security/threats (part), /operations/general (part),
   /operations/show-volunteers, /operations/add-volunteer,
   /operations/set-password, /operations/remove-volunteer,
   /ui/dashboard-page (part), /ui/volunteers-page,
   /contents/dashboard-page (part), /contents/volunteers-page,
   /scenarios/new-volunteer, /scenarios/removed-volunteer.
3. Members: /overview, /security/actors, /security/threats,
   /model/association, /model/member, /operations/general,
   /operations/create-association, /operations/migrate-members,
   /operations/show-members, /operations/add-member,
   /operations/show-member, /operations/edit-member,
   /operations/show-member-deletion, /operations/delete-member,
   /ui/dashboard-page, /ui/members-page, /ui/member-page,
   /ui/member-deletion-page, /contents/dashboard-page,
   /contents/members-page, /contents/member-page,
   /contents/member-deletion-page, /scenarios/other-association,
   /scenarios/new-member, /scenarios/edited-member,
   /scenarios/deleted-member.

## Lessons

- Manage volunteers, Members: future mockups load
  `docs/_design/style.css`, then `members.css`; when integrating, move
  the rules your pages use (`.nav-link` first, which the dashboard patch
  needs) from `members.css` into `docs/_design/style.css` and
  `src/views/style.ts`, and have the `docs/_design/` mockups load only
  `style.css`.
- Manage volunteers, Members: tests observe the state through
  `readState` (`src/state.ts`) and check the invariants in `checkState`
  (`tests/http/helpers.ts`); extend both with the new data, returned in
  a stable order.
- Manage volunteers, Members: `request.signedIn` holds the session id,
  the login and the association's name, not its id; own-association
  scoping needs the id added.
- Manage volunteers: closing all sessions of a volunteer is done in
  `resetPassword` (`src/store.ts`); reuse it for set-password and
  remove-volunteer.
- Members: the schema is migrated through `user_version` in
  `src/db.ts`; a new migration adding the members table gives existing
  associations no member, as Migrate members states.

## For the human

- Purge expired sessions.
- Hide the password typed into the operator commands.
- Make the scrypt cost configurable for tests, to shorten the test and
  mutation runs.
- Project CLAUDE.md: in Tests, check that each new browser test reaches
  the operation it targets before the stub fails.
