# Members

Several associations share one installation, each with its own data.
The operator creates each association and its first volunteer; the
volunteers of an association sign in, manage its volunteers and
register its members.

## Outline

1. Volunteer sign-in done.
2. Manage volunteers done.
3. Members: /overview, /security/threats, /model/association,
   /model/member, /operations/general, /operations/create-association,
   /operations/migrate-members,
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

- Members: future mockups load `docs/_design/style.css`, then
  `members.css`; when integrating, move the remaining `members.css`
  rules into `docs/_design/style.css` and `src/views/style.ts`, delete
  `members.css`, and have the mockups load only `style.css`.
- Members: tests observe the state through `readState` (`src/state.ts`)
  and check the invariants in `checkState` (`tests/http/helpers.ts`);
  extend both with the new data, returned in a stable order.
- Members: the schema is migrated through `user_version` in
  `src/db.ts`; a new migration adding the members table gives existing
  associations no member, as Migrate members states.
- Members: list every new route of a `Volunteers only.` operation in
  `VOLUNTEERS_ONLY` (`src/app.ts`), which redirects before the body is
  parsed, so a malformed request without a session answers 303, not
  400.
- Members: each write operation checks again, inside its transaction,
  that the acting session is still stored (`isStored`,
  `src/store.ts`), so a removed volunteer cannot finish a change.
- Members: a refused case that answers a page uses status `REFUSED`
  (422, `src/app.ts`), which `isRefusal` counts, so it does not
  refresh `lastUsed`.

## For the human

- Purge expired sessions.
- Hide the password typed into the operator commands.
- Make the scrypt cost configurable for tests, to shorten the test and
  mutation runs (about 76 minutes now).
- Project CLAUDE.md: in Tests, check that each new browser test reaches
  the operation it targets before the stub fails.
- Answer the Volunteers page's operations by a redirect
  (Post/Redirect/Get), so that a reload does not repeat them and the
  address stays `/volunteers`.
