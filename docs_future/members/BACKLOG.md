# Members

Several associations share one installation, each with its own data.
The operator creates each association and its first volunteer; the
volunteers of an association sign in and manage its volunteers.

## Outline

1. Volunteer sign-in: /overview, /overview/non-goals, /technical/stack,
   /security/assets, /security/actors, /security/boundaries,
   /security/threats, /model/visitor, /model/association,
   /model/volunteer, /model/session, /model/application,
   /operations/general, /operations/initial-state,
   /operations/show-sign-in-page, /operations/sign-in,
   /operations/sign-out, /operations/show-dashboard,
   /operations/create-association,
   /operations/reset-password, /operations/show-volunteers,
   /operations/add-volunteer, /operations/set-password,
   /operations/remove-volunteer, /ui/home-page, /ui/sign-in-page,
   /ui/dashboard-page, /ui/volunteers-page, /contents/home-page,
   /contents/sign-in-page, /contents/dashboard-page,
   /contents/volunteers-page, /scenarios/first-volunteer,
   /scenarios/former-volunteer, /scenarios/new-volunteer,
   /scenarios/removed-volunteer, /scenarios/password-guessing,
   /scenarios/other-association.

## Lessons

- Register members: deleting a member removes their data for good, and
  nothing purges member data on its own, as ruled for the threat model.
- Volunteer sign-in: the new mockups load `docs/_design/style.css` by a
  relative path, then `members.css`; in `docs/_design/`, merge
  `members.css` into `style.css` and load only that.
