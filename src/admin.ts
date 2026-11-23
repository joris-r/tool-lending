// The operator's commands: `node dist/admin.js <command> <arguments>`,
// the password typed on standard input.
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import { openDatabase } from "./db.js";
import {
  MIN_PASSWORD_LENGTH,
  createAssociation,
  resetPassword,
} from "./store.js";

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

// @dev43:unsure
const USAGE = `Usage:
  node dist/admin.js create-association <name> <login>
  node dist/admin.js reset-password <login>
The password is read from standard input.`;

const refused = (output: string): AdminResult => ({ status: 1, output });
const done = (output: string): AdminResult => ({ status: 0, output });

/** The password: the first line typed, kept as is. */
function firstLine(stdin: string): string {
  return stdin.split(/\r?\n/u)[0] ?? "";
}

/** Runs the command of `args`, e.g. `["reset-password", "alice"]`. */
export async function runAdmin(
  args: string[],
  io: AdminIo,
): Promise<AdminResult> {
  const [command, ...rest] = args;
  const password = firstLine(io.stdin);
  if (command === "create-association" && rest.length === 2) {
    const [name, login] = rest as [string, string];
    const db = openDatabase(io.databasePath);
    try {
      switch (await createAssociation(db, name, login, password)) {
        case "created":
          return done(`Created association "${name}", volunteer "${login}".`);
        case "invalid":
          return refused(
            `Refused: the name must not be empty nor start or end with a space, the login must not be empty nor hold a space, and the password must have at least ${MIN_PASSWORD_LENGTH} characters.`,
          );
        case "taken":
          return refused(
            "Refused: an association has this name, or a volunteer this login.",
          );
      }
    } finally {
      db.close();
    }
  }
  if (command === "reset-password" && rest.length === 1) {
    const [login] = rest as [string];
    const db = openDatabase(io.databasePath);
    try {
      switch (await resetPassword(db, login, password)) {
        case "set":
          return done(`Password of "${login}" set; their sessions are closed.`);
        case "short":
          return refused(
            `Refused: the password must have at least ${MIN_PASSWORD_LENGTH} characters.`,
          );
        case "unknown":
          return refused(`Refused: no volunteer has the login "${login}".`);
      }
    } finally {
      db.close();
    }
  }
  return refused(USAGE);
}

/** The first line of standard input, without waiting for its end. */
function readFirstLine(): Promise<string> {
  return new Promise((resolve) => {
    const lines = createInterface({ input: process.stdin });
    let answered = false;
    const answer = (line: string) => {
      if (answered) return;
      answered = true;
      lines.close();
      resolve(line);
    };
    lines.once("line", answer);
    lines.once("close", () => answer(""));
  });
}

async function main(): Promise<void> {
  const databasePath = process.env.DATABASE_PATH;
  if (!databasePath) {
    console.error("DATABASE_PATH is required, e.g. /data/tool-lending.db");
    process.exit(1);
  }
  const args = process.argv.slice(2);
  const needsPassword =
    args[0] === "create-association" || args[0] === "reset-password";
  if (needsPassword && process.stdin.isTTY) process.stderr.write("Password: ");
  const stdin = needsPassword ? await readFirstLine() : "";
  const result = await runAdmin(args, { databasePath, stdin });
  (result.status === 0 ? process.stdout : process.stderr).write(
    `${result.output}\n`,
  );
  process.exit(result.status);
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main();
}
