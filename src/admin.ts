// The operator's commands: `node dist/admin.js <command> <arguments>`,
// the password typed on standard input.

export interface AdminIo {
  /** The SQLite database file, the value of `DATABASE_PATH`. */
  databasePath: string;
  /** What the operator typed on standard input. */
  stdin: string;
}

export interface AdminResult {
  /** The exit status: 0 on success, 1 when refused. */
  status: number;
  /** What the command prints. */
  output: string;
}

/** Runs the command of `args`, e.g. `["reset-password", "alice"]`. */
export async function runAdmin(
  args: string[],
  io: AdminIo,
): Promise<AdminResult> {
  void args;
  void io;
  throw new Error("not implemented");
}
