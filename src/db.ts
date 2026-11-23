import { DatabaseSync } from "node:sqlite";

/** The schema changes, in order; `user_version` counts those applied. */
const MIGRATIONS: readonly string[] = [
  `CREATE TABLE associations (
     id INTEGER PRIMARY KEY,
     name TEXT NOT NULL UNIQUE
   );
   CREATE TABLE volunteers (
     id INTEGER PRIMARY KEY,
     association_id INTEGER NOT NULL REFERENCES associations(id),
     login TEXT NOT NULL UNIQUE,
     password_hash TEXT NOT NULL,
     failures INTEGER NOT NULL DEFAULT 0,
     lock_until INTEGER
   );
   CREATE TABLE sessions (
     id INTEGER PRIMARY KEY,
     token_hash TEXT NOT NULL UNIQUE,
     volunteer_id INTEGER NOT NULL REFERENCES volunteers(id),
     last_used INTEGER NOT NULL
   );`,
  // Members: existing associations get none, and their first id is 1.
  `ALTER TABLE associations ADD COLUMN next_member_id INTEGER NOT NULL DEFAULT 1;
   CREATE TABLE members (
     association_id INTEGER NOT NULL REFERENCES associations(id),
     id INTEGER NOT NULL,
     name TEXT NOT NULL,
     contact TEXT NOT NULL,
     PRIMARY KEY (association_id, id),
     UNIQUE (association_id, name)
   );`,
];

/** Opens the database at `path`, creating it if needed, and applies the
 * migrations it lacks. */
export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA journal_mode = WAL");
  transaction(db, () => {
    const row = db.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    for (let v = row.user_version; v < MIGRATIONS.length; v++) {
      db.exec(MIGRATIONS[v] as string);
    }
    db.exec(`PRAGMA user_version = ${MIGRATIONS.length}`);
  });
  return db;
}

/** Runs `body` in a write transaction: all of it, or nothing. */
export function transaction<T>(db: DatabaseSync, body: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = body();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
