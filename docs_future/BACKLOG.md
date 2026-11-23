# Backlog

- Volunteers add tools to the catalogue (name, category, condition).
- Anyone browses the catalogue.
- Demo mode with sample data and a "reset demo" button.
- Purge expired sessions.
- Hide the password typed into the operator commands.
- Make the scrypt cost configurable for tests, to shorten the test and
  mutation runs (about 118 minutes now).
- Test and quality policy: before Implementation, each new test must
  fail at the operation it targets, not earlier in its setup.
- Answer the operations of the Volunteers, Members, Member and Member
  deletion pages by a redirect (Post/Redirect/Get), so that a reload
  does not repeat them.
- Split the routes of src/app.ts by page group: sign-in, volunteers,
  members.
