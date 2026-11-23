import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  Visitor,
  checkInvariants,
  choose,
  createAssociation,
  lang,
  makeWorld,
  signIn,
  signedIn,
  state,
  type Answer,
  type World,
} from "./helpers.js";

const PLATEAU = "Outils du Plateau";
const ROSEMONT = "Outils de Rosemont";
const ALICE = "correct horse battery";
const CAROL = "carol's long secret";
const BOB = "bob's long password";
const NEW = "a brand new password";
/** The title of the Volunteers page, in the default language. */
const TITLE = "Bénévoles";

let world: World;

beforeEach(async () => {
  world = makeWorld();
  await world.app.ready();
  await createAssociation(world, PLATEAU, "alice", ALICE);
  await createAssociation(world, ROSEMONT, "carol", CAROL);
});

afterEach(async () => {
  await world.app.close();
});

function visitor(): Visitor {
  return new Visitor(world.app);
}

/** A visitor signed in as `login`. */
async function signedInAs(login: string, password: string): Promise<Visitor> {
  const v = visitor();
  await signIn(v, login, password);
  return v;
}

function loginsOf(name: string): string[] {
  const association = state(world).associations.find((a) => a.name === name);
  if (association === undefined) throw new Error(`no association ${name}`);
  return association.volunteers.map((v) => v.login);
}

function volunteer(login: string) {
  const found = state(world)
    .associations.flatMap((a) => a.volunteers)
    .find((v) => v.login === login);
  if (found === undefined) throw new Error(`no volunteer ${login}`);
  return found;
}

function sessionsOf(login: string) {
  return state(world).sessions.filter((s) => s.login === login);
}

/** Whether `login` signs in with `password`, from a new browser. */
async function signsIn(login: string, password: string): Promise<boolean> {
  const answer = await visitor().post("/sign-in", { login, password });
  if (answer.status === 303) return true;
  expect(answer.status).toBe(401);
  return false;
}

/** The text of the page's main part. */
function mainText(answer: Answer): string {
  return answer.$("main").text();
}

/** The Volunteers page, in the default language. */
function expectVolunteersPage(answer: Answer): void {
  expect(String(answer.headers["content-type"])).toMatch(/^text\/html\b/);
  expect(answer.$("title").text().trim()).toBe(TITLE);
}

/** A refused case answered with the Volunteers page. */
function expectRefused(answer: Answer): void {
  expect(answer.status).toBeGreaterThanOrEqual(400);
  expect(answer.status).toBeLessThan(500);
  expectVolunteersPage(answer);
}

/** Alice adds bob to her association, by the operation. */
async function addBob(alice: Visitor): Promise<void> {
  const answer = await alice.post("/volunteers/add", {
    login: "bob",
    password: BOB,
  });
  expect(answer.status).toBe(200);
}

/** Fails `n` sign-ins of `login`. */
async function failTimes(login: string, n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    expect(await signsIn(login, "a wrong password")).toBe(false);
  }
}

describe("Show volunteers", () => {
  // /operations/show-volunteers/result
  // /operations/general/own-association
  it("answers 200 with the Volunteers page of the volunteer's association", async () => {
    const alice = await signedInAs("alice", ALICE);
    await addBob(alice);
    const answer = await alice.get("/volunteers");
    expect(answer.status).toBe(200);
    expectVolunteersPage(answer);
    expect(mainText(answer)).toContain("alice");
    expect(mainText(answer)).toContain("bob");
    expect(mainText(answer)).not.toContain("carol");

    const carol = await signedInAs("carol", CAROL);
    const other = await carol.get("/volunteers");
    expect(other.status).toBe(200);
    expect(mainText(other)).toContain("carol");
    expect(mainText(other)).not.toContain("alice");
    expect(mainText(other)).not.toContain("bob");
    await checkInvariants(alice, world.databasePath);
  });
});

describe("Add volunteer", () => {
  // /operations/add-volunteer/added
  it("adds a volunteer to the signed-in volunteer's association: 200 with the Volunteers page", async () => {
    const alice = await signedInAs("alice", ALICE);
    const before = state(world);
    const answer = await alice.post("/volunteers/add", {
      login: "dan",
      password: "dan's new password",
    });
    expect(answer.status).toBe(200);
    expectVolunteersPage(answer);
    expect(loginsOf(PLATEAU)).toEqual(["alice", "dan"]);
    expect(loginsOf(ROSEMONT)).toEqual(["carol"]);
    expect(volunteer("dan")).toEqual({ login: "dan", failures: 0, lock: null });
    expect(volunteer("alice")).toEqual(before.associations[0]?.volunteers[0]);
    expect(await signsIn("dan", "dan's new password")).toBe(true);
    await checkInvariants(alice, world.databasePath);
  });

  // /operations/add-volunteer/added
  // /operations/general/own-association
  it("adds to the adding volunteer's own association only", async () => {
    const carol = await signedInAs("carol", CAROL);
    const answer = await carol.post("/volunteers/add", {
      login: "erin",
      password: "erin's own password",
    });
    expect(answer.status).toBe(200);
    expect(loginsOf(ROSEMONT)).toEqual(["carol", "erin"]);
    expect(loginsOf(PLATEAU)).toEqual(["alice"]);
    await checkInvariants(carol, world.databasePath);
  });

  // /operations/add-volunteer/added
  // /model/volunteer/password-length
  it("accepts a password of exactly 12 characters", async () => {
    const alice = await signedInAs("alice", ALICE);
    const answer = await alice.post("/volunteers/add", {
      login: "dan",
      password: "123456789012",
    });
    expect(answer.status).toBe(200);
    expect(loginsOf(PLATEAU)).toEqual(["alice", "dan"]);
    expect(await signsIn("dan", "123456789012")).toBe(true);
    await checkInvariants(alice, world.databasePath);
  });

  // /operations/add-volunteer/invalid
  // /operations/general/volunteers-refused
  it.each([
    ["an empty login", "", "dan's new password"],
    ["a login with a space", "dan smith", "dan's new password"],
    ["a login with a leading space", " dan", "dan's new password"],
    ["a login with a trailing tab", "dan\t", "dan's new password"],
    ["a password of 11 characters", "dan", "12345678901"],
    ["an empty password", "dan", ""],
  ])(
    "refuses %s: a 4xx with the Volunteers page, nothing changes",
    async (_l, login, password) => {
      const alice = await signedInAs("alice", ALICE);
      const before = state(world);
      expectRefused(await alice.post("/volunteers/add", { login, password }));
      expect(state(world)).toEqual(before);
      await checkInvariants(alice, world.databasePath);
    },
  );

  // /operations/add-volunteer/taken
  // /operations/general/volunteers-refused
  // /operations/general/own-association
  it.each([
    ["of a volunteer of the association", "alice"],
    ["of a volunteer of another association", "carol"],
  ])(
    "refuses the login %s: a 4xx with the Volunteers page, nothing changes",
    async (_l, login) => {
      const alice = await signedInAs("alice", ALICE);
      const before = state(world);
      expectRefused(
        await alice.post("/volunteers/add", {
          login,
          password: "yet another password",
        }),
      );
      expect(state(world)).toEqual(before);
      expect(await signsIn(login, login === "alice" ? ALICE : CAROL)).toBe(
        true,
      );
      await checkInvariants(alice, world.databasePath);
    },
  );

  // /operations/general/refused
  it("answers a refusal in the display language", async () => {
    const alice = await signedInAs("alice", ALICE);
    await choose(alice, "en");
    const answer = await alice.post("/volunteers/add", {
      login: "alice",
      password: "yet another password",
    });
    expect(answer.status).toBeGreaterThanOrEqual(400);
    expect(answer.status).toBeLessThan(500);
    expect(lang(answer)).toBe("en");
    expect(answer.$("title").text().trim()).toBe("Volunteers");
    await checkInvariants(alice, world.databasePath);
  });
});

describe("Set password", () => {
  // /operations/set-password/set
  it("sets another volunteer's password, ends their sessions, keeps the others'", async () => {
    const alice = await signedInAs("alice", ALICE);
    await addBob(alice);
    const bob1 = await signedInAs("bob", BOB);
    const bob2 = await signedInAs("bob", BOB);
    const carol = await signedInAs("carol", CAROL);
    await failTimes("bob", 3);
    expect(volunteer("bob").failures).toBe(3);

    const answer = await alice.post("/volunteers/password", {
      login: "bob",
      password: NEW,
    });
    expect(answer.status).toBe(200);
    expectVolunteersPage(answer);
    expect(volunteer("bob")).toEqual({ login: "bob", failures: 0, lock: null });
    expect(sessionsOf("bob")).toEqual([]);
    expect(await signedIn(bob1)).toBe(false);
    expect(await signedIn(bob2)).toBe(false);
    expect(await signedIn(alice)).toBe(true);
    expect(await signedIn(carol)).toBe(true);
    expect(loginsOf(PLATEAU)).toEqual(["alice", "bob"]);
    expect(await signsIn("bob", BOB)).toBe(false);
    expect(await signsIn("bob", NEW)).toBe(true);
    expect(await signsIn("alice", ALICE)).toBe(true);
    await checkInvariants(alice, world.databasePath);
  });

  // /operations/set-password/set
  it("ends the lock of the volunteer", async () => {
    const alice = await signedInAs("alice", ALICE);
    await addBob(alice);
    await failTimes("bob", 5);
    expect(volunteer("bob").lock).not.toBeNull();
    const answer = await alice.post("/volunteers/password", {
      login: "bob",
      password: "123456789012",
    });
    expect(answer.status).toBe(200);
    expect(volunteer("bob")).toEqual({ login: "bob", failures: 0, lock: null });
    expect(await signsIn("bob", "123456789012")).toBe(true);
    await checkInvariants(alice, world.databasePath);
  });

  // /operations/set-password/set
  it("sets the signed-in volunteer's own password, keeping only the visitor's session", async () => {
    const alice = await signedInAs("alice", ALICE);
    const elsewhere = await signedInAs("alice", ALICE);
    const answer = await alice.post("/volunteers/password", {
      login: "alice",
      password: NEW,
    });
    expect(answer.status).toBe(200);
    expectVolunteersPage(answer);
    expect(sessionsOf("alice")).toHaveLength(1);
    expect(await signedIn(alice)).toBe(true);
    expect(await signedIn(elsewhere)).toBe(false);
    expect(await signsIn("alice", ALICE)).toBe(false);
    expect(await signsIn("alice", NEW)).toBe(true);
    await checkInvariants(alice, world.databasePath);
  });

  // /operations/set-password/unknown
  // /operations/general/volunteers-refused
  // /operations/general/own-association
  it.each([
    ["no volunteer", "nobody", NEW],
    ["a volunteer of another association", "carol", NEW],
    ["no volunteer, with a short password", "nobody", "short"],
  ])(
    "refuses the login of %s: a 4xx with the Volunteers page, nothing changes",
    async (_l, login, password) => {
      const alice = await signedInAs("alice", ALICE);
      const carol = await signedInAs("carol", CAROL);
      const before = state(world);
      expectRefused(
        await alice.post("/volunteers/password", { login, password }),
      );
      expect(state(world)).toEqual(before);
      expect(await signedIn(carol)).toBe(true);
      expect(await signsIn("carol", CAROL)).toBe(true);
      await checkInvariants(alice, world.databasePath);
    },
  );

  // /operations/set-password/short
  // /operations/general/volunteers-refused
  it.each([
    ["of 11 characters", "12345678901"],
    ["empty", ""],
  ])(
    "refuses a password %s: a 4xx with the Volunteers page, nothing changes",
    async (_l, password) => {
      const alice = await signedInAs("alice", ALICE);
      await addBob(alice);
      const bob = await signedInAs("bob", BOB);
      const before = state(world);
      expectRefused(
        await alice.post("/volunteers/password", { login: "bob", password }),
      );
      expect(state(world)).toEqual(before);
      expect(await signedIn(bob)).toBe(true);
      expect(await signsIn("bob", BOB)).toBe(true);
      await checkInvariants(alice, world.databasePath);
    },
  );
});

describe("Remove volunteer", () => {
  // /operations/remove-volunteer/removed
  it("removes another volunteer and ends their sessions: 200 with the Volunteers page", async () => {
    const alice = await signedInAs("alice", ALICE);
    await addBob(alice);
    const bob = await signedInAs("bob", BOB);
    const carol = await signedInAs("carol", CAROL);
    const answer = await alice.post("/volunteers/remove", { login: "bob" });
    expect(answer.status).toBe(200);
    expectVolunteersPage(answer);
    expect(loginsOf(PLATEAU)).toEqual(["alice"]);
    expect(loginsOf(ROSEMONT)).toEqual(["carol"]);
    expect(sessionsOf("bob")).toEqual([]);
    expect(await signedIn(bob)).toBe(false);
    expect(await signedIn(alice)).toBe(true);
    expect(await signedIn(carol)).toBe(true);
    expect(await signsIn("bob", BOB)).toBe(false);
    await checkInvariants(alice, world.databasePath);
  });

  // /operations/remove-volunteer/removed
  it("removes the signed-in volunteer: no session left, 303 to /", async () => {
    const alice = await signedInAs("alice", ALICE);
    const elsewhere = await signedInAs("alice", ALICE);
    await addBob(alice);
    const bob = await signedInAs("bob", BOB);
    const answer = await alice.post("/volunteers/remove", { login: "alice" });
    expect(answer.status).toBe(303);
    expect(answer.headers.location).toBe("/");
    expect(loginsOf(PLATEAU)).toEqual(["bob"]);
    expect(sessionsOf("alice")).toEqual([]);
    expect(await signedIn(alice)).toBe(false);
    expect(await signedIn(elsewhere)).toBe(false);
    expect(await signedIn(bob)).toBe(true);
    await checkInvariants(alice, world.databasePath);
  });

  // /operations/remove-volunteer/last
  // /operations/general/volunteers-refused
  it("refuses to remove the association's only volunteer: a 4xx with the Volunteers page, nothing changes", async () => {
    const alice = await signedInAs("alice", ALICE);
    const before = state(world);
    expectRefused(await alice.post("/volunteers/remove", { login: "alice" }));
    expect(state(world)).toEqual(before);
    expect(await signedIn(alice)).toBe(true);
    await checkInvariants(alice, world.databasePath);
  });

  // /operations/remove-volunteer/unknown
  // /operations/general/volunteers-refused
  // /operations/general/own-association
  it.each([
    ["no volunteer", "nobody"],
    ["a volunteer of another association", "carol"],
  ])(
    "refuses the login of %s: a 4xx with the Volunteers page, nothing changes",
    async (_l, login) => {
      const alice = await signedInAs("alice", ALICE);
      await addBob(alice);
      const carol = await signedInAs("carol", CAROL);
      const before = state(world);
      expectRefused(await alice.post("/volunteers/remove", { login }));
      expect(state(world)).toEqual(before);
      expect(await signedIn(carol)).toBe(true);
      await checkInvariants(alice, world.databasePath);
    },
  );

  // /operations/remove-volunteer/unknown
  // /operations/general/own-association
  it("refuses another association's only volunteer as unknown, not as last", async () => {
    const carol = await signedInAs("carol", CAROL);
    const alice = await signedInAs("alice", ALICE);
    await addBob(alice);
    const before = state(world);
    expectRefused(await carol.post("/volunteers/remove", { login: "alice" }));
    expect(state(world)).toEqual(before);
    expect(await signedIn(alice)).toBe(true);
    await checkInvariants(carol, world.databasePath);
  });
});

describe("General, for the volunteers' operations", () => {
  const POSTS: [string, Record<string, string>][] = [
    ["/volunteers/add", { login: "dan", password: "dan's new password" }],
    ["/volunteers/password", { login: "alice", password: NEW }],
    ["/volunteers/remove", { login: "alice" }],
  ];

  // /operations/general/volunteers-only
  it("answers 303 to /sign-in without a signed-in volunteer, and changes nothing", async () => {
    const v = visitor();
    const before = state(world);
    const shown = await v.get("/volunteers");
    expect(shown.status).toBe(303);
    expect(shown.headers.location).toBe("/sign-in");
    for (const [url, form] of POSTS) {
      const answer = await v.post(url, form);
      expect(answer.status).toBe(303);
      expect(answer.headers.location).toBe("/sign-in");
    }
    expect(state(world)).toEqual(before);
    expect(await signsIn("alice", ALICE)).toBe(true);
    await checkInvariants(v, world.databasePath);
  });

  // /operations/general/origin
  it.each([
    ["no Origin", null],
    ["another origin", "https://evil.example.com"],
  ])("refuses each with %s: 403, nothing changes", async (_l, origin) => {
    const alice = await signedInAs("alice", ALICE);
    await addBob(alice);
    const before = state(world);
    for (const [url, form] of POSTS) {
      expect((await alice.post(url, form, origin)).status).toBe(403);
    }
    expect(state(world)).toEqual(before);
    expect(await signsIn("alice", ALICE)).toBe(true);
    await checkInvariants(alice, world.databasePath);
  });

  // /operations/general/malformed
  it.each([
    ["/volunteers/add", "login=dan"],
    ["/volunteers/add", "password=dan%27s+new+password"],
    ["/volunteers/add", "login=dan&login=erin&password=dan%27s+new+password"],
    [
      "/volunteers/add",
      "login=dan&password=x234567890123&password=y234567890123",
    ],
    ["/volunteers/password", "login=alice"],
    ["/volunteers/password", "password=a+brand+new+password"],
    [
      "/volunteers/password",
      "login=alice&login=bob&password=a+brand+new+password",
    ],
    ["/volunteers/remove", ""],
    ["/volunteers/remove", "login=bob&login=alice"],
  ])("refuses %s with %j: 400, nothing changes", async (url, form) => {
    const alice = await signedInAs("alice", ALICE);
    await addBob(alice);
    const before = state(world);
    expect((await alice.post(url, form)).status).toBe(400);
    expect(state(world)).toEqual(before);
    await checkInvariants(alice, world.databasePath);
  });
});
