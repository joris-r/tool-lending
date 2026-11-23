# Members

Several associations share one installation, each with its own data.
The operator creates each association and its first volunteer; the
volunteers of an association sign in, manage its volunteers and
register its members.

## Outline

1. Volunteer sign-in and members: /overview, /overview/non-goals,
   /technical/stack, /security/assets, /security/actors,
   /security/boundaries, /security/threats, /model/visitor,
   /model/association,
   /model/volunteer, /model/member, /model/session, /model/application,
   /operations/general, /operations/initial-state,
   /operations/show-sign-in-page, /operations/sign-in,
   /operations/sign-out, /operations/show-dashboard,
   /operations/create-association,
   /operations/reset-password, /operations/show-volunteers,
   /operations/add-volunteer, /operations/set-password,
   /operations/remove-volunteer, /operations/show-members,
   /operations/add-member, /operations/show-member,
   /operations/edit-member, /operations/show-member-deletion,
   /operations/delete-member, /ui/home-page, /ui/sign-in-page,
   /ui/dashboard-page, /ui/volunteers-page, /ui/members-page,
   /ui/member-page, /ui/member-deletion-page, /contents/home-page,
   /contents/sign-in-page, /contents/dashboard-page,
   /contents/volunteers-page, /contents/members-page,
   /contents/member-page, /contents/member-deletion-page,
   /scenarios/first-volunteer,
   /scenarios/former-volunteer, /scenarios/new-volunteer,
   /scenarios/removed-volunteer, /scenarios/password-guessing,
   /scenarios/other-association, /scenarios/new-member,
   /scenarios/edited-member, /scenarios/deleted-member.

## Lessons

- Volunteer sign-in and members: the new mockups load
  `docs/_design/style.css` by a relative path, then `members.css`; in
  `docs/_design/`, merge `members.css` into `style.css` and load only
  that.
