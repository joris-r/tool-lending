# Members

Several associations share one installation, each with its own data.
The operator creates each association and its first volunteer; the
volunteers of an association sign in, manage its volunteers and
register its members.

## Outline

1. Volunteer sign-in: /overview (part), /overview/non-goals (part),
   /technical/stack, /security/assets, /security/actors (part),
   /security/boundaries, /security/threats (part), /model/visitor,
   /model/association (part), /model/volunteer, /model/session,
   /model/application, /operations/general (part),
   /operations/initial-state, /operations/show-sign-in-page,
   /operations/sign-in, /operations/sign-out,
   /operations/show-dashboard, /operations/create-association,
   /operations/reset-password, /ui/home-page, /ui/sign-in-page,
   /ui/dashboard-page (part), /contents/home-page,
   /contents/sign-in-page, /contents/dashboard-page (part),
   /scenarios/first-volunteer, /scenarios/former-volunteer,
   /scenarios/password-guessing.
2. Manage volunteers: /overview (part), /security/actors (part),
   /security/threats (part), /operations/general (part),
   /operations/show-volunteers, /operations/add-volunteer,
   /operations/set-password, /operations/remove-volunteer,
   /ui/dashboard-page (part), /ui/volunteers-page,
   /contents/dashboard-page (part), /contents/volunteers-page,
   /scenarios/new-volunteer, /scenarios/removed-volunteer.
3. Members: /overview, /security/actors, /security/threats,
   /model/association, /model/member, /operations/general,
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

- Volunteer sign-in and members: the new mockups load
  `docs/_design/style.css` by a relative path, then `members.css`; in
  `docs/_design/`, merge `members.css` into `style.css` and load only
  that.
