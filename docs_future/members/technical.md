# Technical

## Stack

- Templates escape every value by default.…
- Passwords are stored only as salted hashes, made with `scrypt` from
  Node.js `crypto`.
- A browser keeps its session as a random token of at least 128 bits,
  in an `HttpOnly`, `SameSite=Lax` cookie, `Secure` when
  `PUBLIC_ORIGIN` is `https`.
- The operator's commands run on the server as
  `node dist/admin.js <command>`, on the database of `DATABASE_PATH`;
  the HTTP interface creates no association.
