# Backlog

- Volunteers add tools to the catalogue (name, category, condition).
- Anyone browses the catalogue.
- Demo mode with sample data and a "reset demo" button.
- Purge expired sessions.
- Hide the password typed into the operator commands.
- Make the scrypt cost configurable for tests, to shorten the test and
  mutation runs (about 76 minutes now).
- Project CLAUDE.md: in Tests, check that each new browser test reaches
  the operation it targets before the stub fails.
- Answer the Volunteers page's operations by a redirect
  (Post/Redirect/Get), so that a reload does not repeat them and the
  address stays `/volunteers`.
