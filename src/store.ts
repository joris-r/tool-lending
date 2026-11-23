import { createHash, randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { transaction } from "./db.js";
import { DUMMY_HASH, hashPassword, verifyPassword } from "./passwords.js";

/** Failed sign-ins in a row that lock a volunteer out. */
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60_000;
/** Inactivity after which a session is read as none. */
export const SESSION_LIMIT_MS = 24 * 60 * 60_000;
export const MIN_PASSWORD_LENGTH = 12;

export interface SignedIn {
  sessionId: number;
  login: string;
  associationId: number;
  associationName: string;
}

interface VolunteerRow {
  id: number;
  password_hash: string;
  failures: number;
  lock_until: number | null;
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function isValidName(name: string): boolean {
  return name !== "" && !/^\s|\s$/u.test(name);
}

export function isValidLogin(login: string): boolean {
  return /^\S+$/u.test(login);
}

export function isValidPassword(password: string): boolean {
  return [...password].length >= MIN_PASSWORD_LENGTH;
}

/** The volunteer signed in with this session token, if the session is
 * stored and not expired at `now`. */
export function readSession(
  db: DatabaseSync,
  token: string,
  now: Date,
): SignedIn | undefined {
  const row = db
    .prepare(
      `SELECT s.id AS sessionId, s.last_used AS lastUsed, v.login AS login,
              a.id AS associationId, a.name AS associationName
         FROM sessions s
         JOIN volunteers v ON v.id = s.volunteer_id
         JOIN associations a ON a.id = v.association_id
        WHERE s.token_hash = ?`,
    )
    .get(tokenHash(token)) as (SignedIn & { lastUsed: number }) | undefined;
  if (row === undefined) return undefined;
  if (now.getTime() - row.lastUsed > SESSION_LIMIT_MS) return undefined;
  return {
    sessionId: row.sessionId,
    login: row.login,
    associationId: row.associationId,
    associationName: row.associationName,
  };
}

/** Records a request of the session at `now`, if it is still stored. */
export function touchSession(
  db: DatabaseSync,
  sessionId: number,
  now: Date,
): void {
  db.prepare("UPDATE sessions SET last_used = ? WHERE id = ?").run(
    now.getTime(),
    sessionId,
  );
}

export function deleteSession(db: DatabaseSync, sessionId: number): void {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

function findVolunteer(
  db: DatabaseSync,
  login: string,
): VolunteerRow | undefined {
  return db
    .prepare(
      "SELECT id, password_hash, failures, lock_until FROM volunteers WHERE login = ?",
    )
    .get(login) as VolunteerRow | undefined;
}

function isLocked(volunteer: VolunteerRow, now: Date): boolean {
  return volunteer.lock_until !== null && volunteer.lock_until > now.getTime();
}

/** Signs a volunteer in. On success, the new session's token; the
 * visitor's earlier session, if any, is no longer stored. */
export async function signIn(
  db: DatabaseSync,
  login: string,
  password: string,
  earlierSessionId: number | undefined,
  now: () => Date,
): Promise<{ token: string } | undefined> {
  const found = findVolunteer(db, login);
  if (found === undefined) {
    await verifyPassword(password, DUMMY_HASH);
    return undefined;
  }
  if (isLocked(found, now())) {
    await verifyPassword(password, DUMMY_HASH);
    return undefined;
  }
  const matches = await verifyPassword(password, found.password_hash);
  return transaction(db, () => {
    const at = now();
    // Read again: other sign-ins may have run during the hash.
    const volunteer = findVolunteer(db, login);
    if (volunteer === undefined || isLocked(volunteer, at)) return undefined;
    if (volunteer.password_hash !== found.password_hash) return undefined;
    if (!matches) {
      const failures = volunteer.failures + 1;
      if (failures >= MAX_FAILURES) {
        db.prepare(
          "UPDATE volunteers SET failures = 0, lock_until = ? WHERE id = ?",
        ).run(at.getTime() + LOCK_MS, volunteer.id);
      } else {
        db.prepare("UPDATE volunteers SET failures = ? WHERE id = ?").run(
          failures,
          volunteer.id,
        );
      }
      return undefined;
    }
    db.prepare(
      "UPDATE volunteers SET failures = 0, lock_until = NULL WHERE id = ?",
    ).run(volunteer.id);
    if (earlierSessionId !== undefined) deleteSession(db, earlierSessionId);
    const token = randomBytes(32).toString("base64url");
    db.prepare(
      "INSERT INTO sessions (token_hash, volunteer_id, last_used) VALUES (?, ?, ?)",
    ).run(tokenHash(token), volunteer.id, at.getTime());
    return { token };
  });
}

export type CreateResult = "created" | "invalid" | "taken";

export async function createAssociation(
  db: DatabaseSync,
  name: string,
  login: string,
  password: string,
): Promise<CreateResult> {
  if (!isValidName(name) || !isValidLogin(login) || !isValidPassword(password))
    return "invalid";
  const hash = await hashPassword(password);
  return transaction(db, () => {
    const nameTaken = db
      .prepare("SELECT 1 FROM associations WHERE name = ?")
      .get(name);
    const loginTaken = db
      .prepare("SELECT 1 FROM volunteers WHERE login = ?")
      .get(login);
    if (nameTaken !== undefined || loginTaken !== undefined) return "taken";
    const { lastInsertRowid } = db
      .prepare("INSERT INTO associations (name) VALUES (?)")
      .run(name);
    db.prepare(
      "INSERT INTO volunteers (association_id, login, password_hash) VALUES (?, ?, ?)",
    ).run(lastInsertRowid, login, hash);
    return "created";
  });
}

export type ResetResult = "set" | "short" | "unknown";

export async function resetPassword(
  db: DatabaseSync,
  login: string,
  password: string,
): Promise<ResetResult> {
  if (!isValidPassword(password)) return "short";
  const hash = await hashPassword(password);
  return transaction(db, () => {
    const volunteer = findVolunteer(db, login);
    if (volunteer === undefined) return "unknown";
    replacePassword(db, volunteer.id, hash, undefined);
    return "set";
  });
}

/** Sets a volunteer's password hash, clears their failures and lock, and
 * ends their sessions, except `keptSessionId`. */
function replacePassword(
  db: DatabaseSync,
  volunteerId: number,
  hash: string,
  keptSessionId: number | undefined,
): void {
  db.prepare(
    "UPDATE volunteers SET password_hash = ?, failures = 0, lock_until = NULL WHERE id = ?",
  ).run(hash, volunteerId);
  db.prepare("DELETE FROM sessions WHERE volunteer_id = ? AND id IS NOT ?").run(
    volunteerId,
    keptSessionId ?? null,
  );
}

/** Whether the session is still stored: another request may have ended
 * it since this one read it. */
function isStored(db: DatabaseSync, sessionId: number): boolean {
  return (
    db.prepare("SELECT 1 FROM sessions WHERE id = ?").get(sessionId) !==
    undefined
  );
}

/** The volunteer of the association with this login, if any. */
function findOwnVolunteer(
  db: DatabaseSync,
  associationId: number,
  login: string,
): { id: number } | undefined {
  return db
    .prepare("SELECT id FROM volunteers WHERE association_id = ? AND login = ?")
    .get(associationId, login) as { id: number } | undefined;
}

/** The logins of the association's volunteers, in no particular order. */
export function volunteerLogins(
  db: DatabaseSync,
  associationId: number,
): string[] {
  const rows = db
    .prepare("SELECT login FROM volunteers WHERE association_id = ?")
    .all(associationId) as { login: string }[];
  return rows.map((r) => r.login);
}

/** The result of an operation whose session ended while it ran. */
export type SignedOut = "signed-out";

export type AddResult = "added" | "invalid" | "taken" | SignedOut;

/** Adds a volunteer to the association, on behalf of the session
 * `sessionId`. */
export async function addVolunteer(
  db: DatabaseSync,
  associationId: number,
  login: string,
  password: string,
  sessionId: number,
): Promise<AddResult> {
  if (!isValidLogin(login) || !isValidPassword(password)) return "invalid";
  if (findVolunteer(db, login) !== undefined) return "taken";
  const hash = await hashPassword(password);
  return transaction(db, () => {
    if (!isStored(db, sessionId)) return "signed-out";
    // Read again: another request may have taken the login meanwhile.
    if (findVolunteer(db, login) !== undefined) return "taken";
    db.prepare(
      "INSERT INTO volunteers (association_id, login, password_hash) VALUES (?, ?, ?)",
    ).run(associationId, login, hash);
    return "added";
  });
}

export type SetResult = "set" | "short" | "unknown" | SignedOut;

/** Sets the password of a volunteer of the association, on behalf of the
 * session `keptSessionId`, which stays if it is theirs. */
export async function setPassword(
  db: DatabaseSync,
  associationId: number,
  login: string,
  password: string,
  keptSessionId: number,
): Promise<SetResult> {
  if (findOwnVolunteer(db, associationId, login) === undefined)
    return "unknown";
  if (!isValidPassword(password)) return "short";
  const hash = await hashPassword(password);
  return transaction(db, () => {
    if (!isStored(db, keptSessionId)) return "signed-out";
    const volunteer = findOwnVolunteer(db, associationId, login);
    if (volunteer === undefined) return "unknown";
    replacePassword(db, volunteer.id, hash, keptSessionId);
    return "set";
  });
}

export type RemoveResult = "removed" | "last" | "unknown" | SignedOut;

/** Removes a volunteer of the association, on behalf of the session
 * `sessionId`. */
export function removeVolunteer(
  db: DatabaseSync,
  associationId: number,
  login: string,
  sessionId: number,
): RemoveResult {
  return transaction(db, () => {
    if (!isStored(db, sessionId)) return "signed-out";
    const volunteer = findOwnVolunteer(db, associationId, login);
    if (volunteer === undefined) return "unknown";
    const { count } = db
      .prepare(
        "SELECT COUNT(*) AS count FROM volunteers WHERE association_id = ?",
      )
      .get(associationId) as { count: number };
    if (count <= 1) return "last";
    db.prepare("DELETE FROM sessions WHERE volunteer_id = ?").run(volunteer.id);
    db.prepare("DELETE FROM volunteers WHERE id = ?").run(volunteer.id);
    return "removed";
  });
}
