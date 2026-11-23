import { openDatabase } from "./db.js";

// The stored state, as the model of docs/model.md names it, read from
// the database. Passwords are left out: only their hashes are stored.

export interface VolunteerState {
  login: string;
  failures: number;
  /** The end of their lockout, or null. */
  lock: Date | null;
}

export interface MemberState {
  id: number;
  name: string;
  contact: string;
}

export interface AssociationState {
  name: string;
  volunteers: VolunteerState[];
  /** Its members, in order of id. */
  members: MemberState[];
  nextMemberId: number;
}

export interface SessionState {
  /** The login of the session's volunteer. */
  login: string;
  lastUsed: Date;
}

export interface State {
  associations: AssociationState[];
  sessions: SessionState[];
}

/** Reads the state stored in the database at `databasePath`. */
export function readState(databasePath: string): State {
  const db = openDatabase(databasePath);
  try {
    const associations = db
      .prepare("SELECT id, name, next_member_id FROM associations ORDER BY id")
      .all() as { id: number; name: string; next_member_id: number }[];
    const members = db
      .prepare(
        "SELECT association_id, id, name, contact FROM members ORDER BY association_id, id",
      )
      .all() as {
      association_id: number;
      id: number;
      name: string;
      contact: string;
    }[];
    const volunteers = db
      .prepare(
        "SELECT association_id, login, failures, lock_until FROM volunteers ORDER BY id",
      )
      .all() as {
      association_id: number;
      login: string;
      failures: number;
      lock_until: number | null;
    }[];
    const sessions = db
      .prepare(
        `SELECT v.login AS login, s.last_used AS lastUsed
           FROM sessions s JOIN volunteers v ON v.id = s.volunteer_id
          ORDER BY s.id`,
      )
      .all() as { login: string; lastUsed: number }[];
    return {
      associations: associations.map((a) => ({
        name: a.name,
        volunteers: volunteers
          .filter((v) => v.association_id === a.id)
          .map((v) => ({
            login: v.login,
            failures: v.failures,
            lock: v.lock_until === null ? null : new Date(v.lock_until),
          })),
        members: members
          .filter((m) => m.association_id === a.id)
          .map((m) => ({ id: m.id, name: m.name, contact: m.contact })),
        nextMemberId: a.next_member_id,
      })),
      sessions: sessions.map((s) => ({
        login: s.login,
        lastUsed: new Date(s.lastUsed),
      })),
    };
  } finally {
    db.close();
  }
}
