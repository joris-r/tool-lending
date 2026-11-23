import { spawn } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  Visitor,
  admin,
  checkState,
  createAssociation,
  makeWorld,
  signIn,
  signedIn,
  state,
  type World,
} from "../http/helpers.js";
import type { AdminResult } from "../../src/admin.js";

const PLATEAU = "Outils du Plateau";
const ALICE = "correct horse battery";
const NEW = "a brand new password";

let world: World;

beforeEach(async () => {
  world = makeWorld();
  await world.app.ready();
});

afterEach(async () => {
  await world.app.close();
});

/** Whether a sign-in with this login and password succeeds. */
async function canSignIn(login: string, password: string): Promise<boolean> {
  const v = new Visitor(world.app);
  const answer = await v.post("/sign-in", { login, password });
  if (answer.status === 303) {
    await v.post("/sign-out", {});
    return true;
  }
  expect(answer.status).toBe(401);
  return false;
}

/** A refused command: exits 1, prints its message, changes nothing. */
function expectRefused(result: AdminResult, before: unknown): void {
  expect(result.status).toBe(1);
  expect(result.output.trim()).not.toBe("");
  expect(state(world)).toEqual(before);
}

describe("Create association", () => {
  // /operations/create-association/created
  it("creates an association with no member and nextMemberId 1, whose only volunteer has the login and the password", async () => {
    const result = await admin(
      world,
      ["create-association", PLATEAU, "alice"],
      `${ALICE}\n`,
    );
    expect(result.status).toBe(0);
    expect(state(world)).toEqual({
      associations: [
        {
          name: PLATEAU,
          volunteers: [{ login: "alice", failures: 0, lock: null }],
          members: [],
          nextMemberId: 1,
        },
      ],
      sessions: [],
    });
    expect(await canSignIn("alice", ALICE)).toBe(true);
    checkState(state(world));
  });

  // /operations/create-association/created
  it("keeps the other associations", async () => {
    await createAssociation(world, PLATEAU, "alice", ALICE);
    const v = new Visitor(world.app);
    await signIn(v, "alice", ALICE);
    const before = state(world);
    await createAssociation(world, "Outils de Rosemont", "carol", NEW);
    const after = state(world);
    expect(after.associations).toHaveLength(2);
    expect(after.associations).toEqual(
      expect.arrayContaining(before.associations),
    );
    expect(after.associations).toContainEqual({
      name: "Outils de Rosemont",
      volunteers: [{ login: "carol", failures: 0, lock: null }],
      members: [],
      nextMemberId: 1,
    });
    expect(after.sessions).toEqual(before.sessions);
    expect(await signedIn(v)).toBe(true);
    expect(await canSignIn("carol", NEW)).toBe(true);
    checkState(state(world));
  });

  // /operations/create-association/created
  // /model/volunteer/password-length
  it.each([
    ["12 characters", "123456789012"],
    ["spaces", "  with spaces inside  "],
    ["accents", "mot de passe é"],
  ])("accepts a password of %s", async (_l, password) => {
    const result = await admin(
      world,
      ["create-association", PLATEAU, "alice"],
      `${password}\n`,
    );
    expect(result.status).toBe(0);
    expect(await canSignIn("alice", password)).toBe(true);
    checkState(state(world));
  });

  // /operations/create-association/invalid
  // /model/association/name
  // /model/volunteer/login
  // /model/volunteer/password-length
  // /operations/general/command-refused
  it.each([
    ["an empty name", "", "alice", ALICE],
    ["a name with a space at its start", " Plateau", "alice", ALICE],
    ["a name with a space at its end", "Plateau ", "alice", ALICE],
    ["a name with a tab at its end", "Plateau\t", "alice", ALICE],
    ["an empty login", PLATEAU, "", ALICE],
    ["a login with a space", PLATEAU, "al ice", ALICE],
    ["a login with a tab", PLATEAU, "alice\t", ALICE],
    ["a password of 11 characters", PLATEAU, "alice", "12345678901"],
    ["an empty password", PLATEAU, "alice", ""],
  ])("refuses %s", async (_l, name, login, password) => {
    await createAssociation(world, "Outils de Rosemont", "carol", NEW);
    const before = state(world);
    expectRefused(
      await admin(world, ["create-association", name, login], `${password}\n`),
      before,
    );
    checkState(state(world));
  });

  // /operations/create-association/taken
  // /model/association/name-unique
  // /model/volunteer/login-unique
  // /model/association/own-volunteers
  // /operations/general/command-refused
  it.each([
    ["the name of an association", PLATEAU, "bob"],
    ["the login of a volunteer", "Outils de Rosemont", "alice"],
    ["both", PLATEAU, "alice"],
  ])("refuses %s", async (_l, name, login) => {
    await createAssociation(world, PLATEAU, "alice", ALICE);
    const before = state(world);
    expectRefused(
      await admin(world, ["create-association", name, login], `${NEW}\n`),
      before,
    );
    expect(await canSignIn("alice", ALICE)).toBe(true);
    checkState(state(world));
  });
});

describe("Reset password", () => {
  beforeEach(async () => {
    await createAssociation(world, PLATEAU, "alice", ALICE);
    await createAssociation(world, "Outils de Rosemont", "carol", NEW);
  });

  // /operations/reset-password/set
  it("sets the password: the old one fails, the new one signs in", async () => {
    const result = await admin(world, ["reset-password", "alice"], `${NEW}\n`);
    expect(result.status).toBe(0);
    expect(await canSignIn("alice", ALICE)).toBe(false);
    expect(await canSignIn("alice", NEW)).toBe(true);
    checkState(state(world));
  });

  // /operations/reset-password/set
  it("resets the failures and the lock", async () => {
    const v = new Visitor(world.app);
    for (let i = 0; i < 5; i++)
      await v.post("/sign-in", { login: "alice", password: "wrong!" });
    await v.post("/sign-in", { login: "alice", password: "wrong again" });
    const locked = state(world)
      .associations.flatMap((a) => a.volunteers)
      .find((x) => x.login === "alice");
    expect(locked?.lock).not.toBeNull();
    expect(
      (await admin(world, ["reset-password", "alice"], `${NEW}\n`)).status,
    ).toBe(0);
    const alice = state(world)
      .associations.flatMap((a) => a.volunteers)
      .find((x) => x.login === "alice");
    expect(alice).toEqual({ login: "alice", failures: 0, lock: null });
    expect(await canSignIn("alice", NEW)).toBe(true);
    checkState(state(world));
  });

  // /operations/reset-password/set
  it("resets failures short of a lock", async () => {
    const v = new Visitor(world.app);
    for (let i = 0; i < 3; i++)
      await v.post("/sign-in", { login: "alice", password: "wrong!" });
    await admin(world, ["reset-password", "alice"], `${NEW}\n`);
    const alice = state(world)
      .associations.flatMap((a) => a.volunteers)
      .find((x) => x.login === "alice");
    expect(alice).toEqual({ login: "alice", failures: 0, lock: null });
    checkState(state(world));
  });

  // /operations/reset-password/set
  it("ends every session of the volunteer, and only theirs", async () => {
    const first = new Visitor(world.app);
    const second = new Visitor(world.app);
    const carol = new Visitor(world.app);
    await signIn(first, "alice", ALICE);
    await signIn(second, "alice", ALICE);
    await signIn(carol, "carol", NEW);
    await admin(world, ["reset-password", "alice"], `${"x".repeat(12)}\n`);
    expect(state(world).sessions.map((s) => s.login)).toEqual(["carol"]);
    expect(await signedIn(first)).toBe(false);
    expect(await signedIn(second)).toBe(false);
    expect(await signedIn(carol)).toBe(true);
    checkState(state(world));
  });

  // /operations/reset-password/set
  it("keeps the other volunteers' passwords and failures", async () => {
    const v = new Visitor(world.app);
    await v.post("/sign-in", { login: "carol", password: "wrong!" });
    await admin(world, ["reset-password", "alice"], `${"y".repeat(12)}\n`);
    const carol = state(world)
      .associations.flatMap((a) => a.volunteers)
      .find((x) => x.login === "carol");
    expect(carol?.failures).toBe(1);
    expect(await canSignIn("carol", NEW)).toBe(true);
    checkState(state(world));
  });

  // /operations/reset-password/short
  // /model/volunteer/password-length
  // /operations/general/command-refused
  it.each([
    ["alice", "12345678901"],
    ["alice", ""],
    ["bob", "12345678901"],
  ])("refuses for %s a password of %j", async (login, password) => {
    const v = new Visitor(world.app);
    await signIn(v, "alice", ALICE);
    const before = state(world);
    expectRefused(
      await admin(world, ["reset-password", login], `${password}\n`),
      before,
    );
    expect(await signedIn(v)).toBe(true);
    expect(await canSignIn("alice", ALICE)).toBe(true);
    checkState(state(world));
  });

  // /operations/reset-password/unknown
  // /operations/general/command-refused
  it.each(["bob", "ALICE", PLATEAU, ""])(
    "refuses the login %j of no volunteer",
    async (login) => {
      const before = state(world);
      expectRefused(
        await admin(world, ["reset-password", login], `${NEW}!\n`),
        before,
      );
      checkState(state(world));
    },
  );
});

describe("General, for commands", () => {
  beforeEach(async () => {
    await createAssociation(world, PLATEAU, "alice", ALICE);
  });

  // /operations/general/command-malformed
  // /operations/general/command-refused
  it.each([
    ["no command", []],
    ["an unknown command", ["delete-association", PLATEAU]],
    ["create-association without login", ["create-association", "Rosemont"]],
    ["create-association without arguments", ["create-association"]],
    [
      "create-association with an extra argument",
      ["create-association", "Rosemont", "carol", "more"],
    ],
    ["reset-password without login", ["reset-password"]],
    ["reset-password with an extra argument", ["reset-password", "alice", "x"]],
  ])("refuses %s", async (_l, args) => {
    const before = state(world);
    expectRefused(await admin(world, args, `${NEW}\n`), before);
    expect(await canSignIn("alice", ALICE)).toBe(true);
    checkState(state(world));
  });
});

describe("Command line", () => {
  /** Runs `src/admin.ts` as the operator would run the built command. */
  function run(
    args: string[],
    stdin: string,
  ): Promise<{ status: number | null; output: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["--import", "tsx", "src/admin.ts", ...args],
        { env: { ...process.env, DATABASE_PATH: world.databasePath } },
      );
      let output = "";
      child.stdout.on("data", (d: Buffer) => (output += d.toString()));
      child.stderr.on("data", (d: Buffer) => (output += d.toString()));
      child.on("error", reject);
      child.on("close", (status) => resolve({ status, output }));
      child.stdin.end(stdin);
    });
  }

  // /operations/create-association/created
  // /operations/reset-password/set
  // /operations/general/command-refused
  it("reads the arguments, the password on standard input, the database of DATABASE_PATH, and exits with the status", async () => {
    const created = await run(
      ["create-association", PLATEAU, "alice"],
      `${ALICE}\n`,
    );
    expect(created.status).toBe(0);
    expect(await canSignIn("alice", ALICE)).toBe(true);

    const refused = await run(["reset-password", "bob"], `${NEW}\n`);
    expect(refused.status).toBe(1);
    expect(refused.output.trim()).not.toBe("");

    const reset = await run(["reset-password", "alice"], `${NEW}\n`);
    expect(reset.status).toBe(0);
    expect(await canSignIn("alice", NEW)).toBe(true);
  });
});
