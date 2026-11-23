// The stored state, as the model of docs/model.md names it, read from
// the database. Passwords are left out: only their hashes are stored.

export interface VolunteerState {
  login: string;
  failures: number;
  /** The end of their lockout, or null. */
  lock: Date | null;
}

export interface AssociationState {
  name: string;
  volunteers: VolunteerState[];
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
  void databasePath;
  throw new Error("not implemented");
}
