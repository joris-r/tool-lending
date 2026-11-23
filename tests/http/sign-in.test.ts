import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MINUTE,
  DAY,
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

/** A failed sign-in: 401 with the Sign-in page. */
function expectFailed(answer: Answer): void {
  expect(answer.status).toBe(401);
  expect(String(answer.headers["content-type"])).toMatch(/^text\/html\b/);
  expect(answer.$('input[name="login"]').length).toBe(1);
  expect(answer.$('input[name="password"]').length).toBe(1);
}

async function failTimes(v: Visitor, login: string, n: number) {
  for (let i = 0; i < n; i++) {
    expectFailed(
      await v.post("/sign-in", { login, password: "wrong password!" }),
    );
  }
}

describe("Show sign-in page", () => {
  // /operations/show-sign-in-page/result
  // /operations/general/public
  it("answers 200 with the Sign-in page, without signing in", async () => {
    const v = visitor();
    const answer = await v.get("/sign-in");
    expect(answer.status).toBe(200);
    expect(answer.$('input[name="login"]').length).toBe(1);
    expect(answer.$('input[name="password"]').length).toBe(1);
    await checkInvariants(v, world.databasePath);
  });

  // /operations/show-sign-in-page/result
  it("answers 200 with the Sign-in page to a signed-in volunteer", async () => {
    const v = visitor();
    await signIn(v, "alice", ALICE);
    const answer = await v.get("/sign-in");
    expect(answer.status).toBe(200);
    expect(answer.$('input[name="password"]').length).toBe(1);
    await checkInvariants(v, world.databasePath);
  });
});

describe("Sign in", () => {
  // /operations/sign-in/signed-in
  // /operations/general/public
  it("signs a volunteer in with their password: a new session, 303 to /dashboard", async () => {
    const v = visitor();
    const answer = await v.post("/sign-in", {
      login: "alice",
      password: ALICE,
    });
    expect(answer.status).toBe(303);
    expect(answer.headers.location).toBe("/dashboard");
    expect(sessionsOf("alice")).toEqual([
      { login: "alice", lastUsed: world.clock.now() },
    ]);
    expect(sessionsOf("carol")).toEqual([]);
    expect(volunteer("alice")).toEqual({
      login: "alice",
      failures: 0,
      lock: null,
    });
    expect(await signedIn(v)).toBe(true);
    await checkInvariants(v, world.databasePath);
  });

  // /operations/sign-in/signed-in
  it("resets the failures of the volunteer, and only theirs", async () => {
    const v = visitor();
    await failTimes(v, "alice", 3);
    await failTimes(v, "carol", 2);
    await signIn(v, "alice", ALICE);
    expect(volunteer("alice").failures).toBe(0);
    expect(volunteer("carol").failures).toBe(2);
    await checkInvariants(v, world.databasePath);
  });

  // /operations/sign-in/signed-in
  it("clears a lock that has ended", async () => {
    const v = visitor();
    await failTimes(v, "alice", 5);
    world.clock.advance(15 * MINUTE);
    await signIn(v, "alice", ALICE);
    expect(volunteer("alice")).toEqual({
      login: "alice",
      failures: 0,
      lock: null,
    });
    await checkInvariants(v, world.databasePath);
  });

  // /operations/sign-in/signed-in
  it("ends the visitor's earlier session, and keeps the other browsers' sessions", async () => {
    const v = visitor();
    const other = visitor();
    await signIn(other, "alice", ALICE);
    await signIn(v, "carol", CAROL);
    const earlier = new Map(v.cookies);
    world.clock.advance(1);
    await signIn(v, "alice", ALICE);
    expect(sessionsOf("carol")).toEqual([]);
    expect(sessionsOf("alice")).toHaveLength(2);
    expect(await signedIn(other)).toBe(true);
    expect(await signedIn(v)).toBe(true);
    const replay = visitor();
    for (const [k, value] of earlier) replay.cookies.set(k, value);
    expect(await signedIn(replay)).toBe(false);
    await checkInvariants(v, world.databasePath);
  });

  // /operations/sign-in/wrong-password
  it("counts a wrong password: failures grow by 1, 401 with the Sign-in page, failed", async () => {
    const v = visitor();
    for (let n = 1; n <= 4; n++) {
      const answer = await v.post("/sign-in", {
        login: "alice",
        password: `${ALICE}x`,
      });
      expectFailed(answer);
      expect(volunteer("alice")).toEqual({
        login: "alice",
        failures: n,
        lock: null,
      });
    }
    expect(volunteer("carol").failures).toBe(0);
    expect(state(world).sessions).toEqual([]);
    expect(await signedIn(v)).toBe(false);
    await checkInvariants(v, world.databasePath);
  });

  // /operations/sign-in/wrong-password
  it("locks the volunteer for 15 minutes at the 5th failure, failures back to 0", async () => {
    const v = visitor();
    await failTimes(v, "alice", 4);
    world.clock.advance(MINUTE);
    const answer = await v.post("/sign-in", {
      login: "alice",
      password: "ALICE",
    });
    expectFailed(answer);
    expect(volunteer("alice")).toEqual({
      login: "alice",
      failures: 0,
      lock: new Date(world.clock.time + 15 * MINUTE),
    });
    expect(volunteer("carol")).toEqual({
      login: "carol",
      failures: 0,
      lock: null,
    });
    await checkInvariants(v, world.databasePath);
  });

  // /operations/sign-in/wrong-password
  it("does not change the visitor's session, signed in as another volunteer", async () => {
    const v = visitor();
    await signIn(v, "carol", CAROL);
    await failTimes(v, "alice", 1);
    expect(sessionsOf("carol")).toHaveLength(1);
    expect(await signedIn(v)).toBe(true);
    await checkInvariants(v, world.databasePath);
  });

  // /operations/sign-in/locked
  it("refuses even the right password until the lock ends", async () => {
    const v = visitor();
    await failTimes(v, "alice", 5);
    const lock = volunteer("alice").lock;
    expect(lock).not.toBeNull();
    world.clock.advance(15 * MINUTE - 1);
    expectFailed(await v.post("/sign-in", { login: "alice", password: ALICE }));
    expectFailed(
      await v.post("/sign-in", { login: "alice", password: "wrong!" }),
    );
    expect(volunteer("alice")).toEqual({ login: "alice", failures: 0, lock });
    expect(state(world).sessions).toEqual([]);
    expect(await signedIn(v)).toBe(false);
    world.clock.advance(1);
    await signIn(v, "alice", ALICE);
    await checkInvariants(v, world.databasePath);
  });

  // /operations/sign-in/locked
  it("locks only that volunteer", async () => {
    const v = visitor();
    await failTimes(v, "alice", 5);
    await signIn(v, "carol", CAROL);
    await checkInvariants(v, world.databasePath);
  });

  // /operations/sign-in/unknown-login
  it.each([
    ["an unknown login", "bob"],
    ["a login in other case", "ALICE"],
    ["a login with a space", "alice "],
    ["an empty login", ""],
    ["an association's name", PLATEAU],
  ])("answers %s with 401, failed, and changes nothing", async (_l, login) => {
    const v = visitor();
    const before = state(world);
    expectFailed(await v.post("/sign-in", { login, password: ALICE }));
    expect(state(world)).toEqual(before);
    expect(await signedIn(v)).toBe(false);
    await checkInvariants(v, world.databasePath);
  });

  // /operations/initial-state/no-association
  // /operations/sign-in/unknown-login
  it("answers any login with 401 when there is no association", async () => {
    const empty = makeWorld();
    try {
      const v = new Visitor(empty.app);
      expectFailed(
        await v.post("/sign-in", { login: "alice", password: ALICE }),
      );
      expect(state(empty)).toEqual({ associations: [], sessions: [] });
      await checkInvariants(v, empty.databasePath);
    } finally {
      await empty.app.close();
    }
  });
});

describe("Sign out", () => {
  // /operations/sign-out/signed-out
  // /operations/general/public
  it("ends the visitor's session only: 303 to /", async () => {
    const v = visitor();
    const other = visitor();
    await signIn(v, "alice", ALICE);
    await signIn(other, "alice", ALICE);
    const earlier = new Map(v.cookies);
    const answer = await v.post("/sign-out", {});
    expect(answer.status).toBe(303);
    expect(answer.headers.location).toBe("/");
    expect(sessionsOf("alice")).toHaveLength(1);
    expect(await signedIn(v)).toBe(false);
    expect(await signedIn(other)).toBe(true);
    const replay = visitor();
    for (const [k, value] of earlier) replay.cookies.set(k, value);
    expect(await signedIn(replay)).toBe(false);
    await checkInvariants(v, world.databasePath);
  });

  // /operations/sign-out/signed-out
  it("answers 303 to / without a session, and changes nothing", async () => {
    const v = visitor();
    const other = visitor();
    await signIn(other, "carol", CAROL);
    const before = state(world);
    const answer = await v.post("/sign-out", {});
    expect(answer.status).toBe(303);
    expect(answer.headers.location).toBe("/");
    expect(state(world)).toEqual(before);
    await checkInvariants(v, world.databasePath);
  });

  // /operations/sign-out/signed-out
  it("keeps the visitor's language", async () => {
    const v = visitor();
    await choose(v, "en");
    await signIn(v, "alice", ALICE);
    await v.post("/sign-out", {});
    expect(lang(await v.get("/"))).toBe("en");
    await checkInvariants(v, world.databasePath);
  });
});

describe("Show dashboard", () => {
  // /operations/show-dashboard/result
  it("answers 200 with the Dashboard page of the volunteer's association", async () => {
    const v = visitor();
    await signIn(v, "carol", CAROL);
    const answer = await v.get("/dashboard");
    expect(answer.status).toBe(200);
    expect(answer.body).toContain(ROSEMONT);
    expect(answer.body).not.toContain(PLATEAU);
    await checkInvariants(v, world.databasePath);
  });

  // /operations/general/volunteers-only
  it("answers 303 to /sign-in without a signed-in volunteer, and changes nothing", async () => {
    const v = visitor();
    const other = visitor();
    await signIn(other, "alice", ALICE);
    const before = state(world);
    world.clock.advance(MINUTE);
    const answer = await v.get("/dashboard");
    expect(answer.status).toBe(303);
    expect(answer.headers.location).toBe("/sign-in");
    expect(state(world)).toEqual(before);
    await checkInvariants(v, world.databasePath);
  });

  // /operations/general/volunteers-only
  // /operations/general/expiry
  it.each(["", "forged", "0".repeat(32)])(
    "reads a forged session %j as none",
    async (forged) => {
      const v = visitor();
      await signIn(v, "alice", ALICE);
      for (const name of v.cookies.keys()) v.cookies.set(name, forged);
      expect(await signedIn(v)).toBe(false);
      await checkInvariants(v, world.databasePath);
    },
  );
});

describe("Sessions", () => {
  // /operations/general/expiry
  it("reads a session unused for more than 7 days as none", async () => {
    const v = visitor();
    await signIn(v, "alice", ALICE);
    world.clock.advance(7 * DAY + 1);
    expect(await signedIn(v)).toBe(false);
    await checkInvariants(v, world.databasePath);
  });

  // /operations/general/activity
  it("sets lastUsed to now on each request with a signed-in volunteer", async () => {
    const v = visitor();
    const other = visitor();
    await signIn(v, "alice", ALICE);
    await signIn(other, "carol", CAROL);
    const signedAt = world.clock.now();
    for (const url of ["/", "/dashboard", "/sign-in", "/style.css"]) {
      world.clock.advance(1);
      await v.get(url);
      expect(sessionsOf("alice")).toEqual([
        { login: "alice", lastUsed: world.clock.now() },
      ]);
    }
    expect(sessionsOf("carol")).toEqual([
      { login: "carol", lastUsed: signedAt },
    ]);
    world.clock.advance(1);
    await choose(v, "en");
    expect(sessionsOf("alice")[0]?.lastUsed).toEqual(world.clock.now());
    await checkInvariants(v, world.databasePath);
  });

  // /operations/general/activity
  // /operations/general/refused
  it("leaves lastUsed after a refused request", async () => {
    const v = visitor();
    await signIn(v, "alice", ALICE);
    const before = state(world);
    world.clock.advance(1);
    expect((await v.post("/language", "language=de")).status).toBe(400);
    expect(
      (await v.post("/language", { language: "en" }, "https://evil.example"))
        .status,
    ).toBe(403);
    expect(state(world)).toEqual(before);
    await checkInvariants(v, world.databasePath);
  });
});

describe("General, for sign-in", () => {
  // /operations/general/origin
  it.each([
    ["no Origin", null],
    ["another origin", "https://evil.example.com"],
  ])("refuses a sign-in with %s: 403, nothing changes", async (_l, origin) => {
    const v = visitor();
    const before = state(world);
    for (const password of [ALICE, "wrong password"]) {
      const answer = await v.post(
        "/sign-in",
        { login: "alice", password },
        origin,
      );
      expect(answer.status).toBe(403);
    }
    expect(state(world)).toEqual(before);
    expect(await signedIn(v)).toBe(false);
    await checkInvariants(v, world.databasePath);
  });

  // /operations/general/origin
  it.each([
    ["no Origin", null],
    ["another origin", "https://evil.example.com"],
  ])(
    "refuses a sign-out with %s: 403, the session stays",
    async (_l, origin) => {
      const v = visitor();
      await signIn(v, "alice", ALICE);
      const answer = await v.post("/sign-out", {}, origin);
      expect(answer.status).toBe(403);
      expect(await signedIn(v)).toBe(true);
      await checkInvariants(v, world.databasePath);
    },
  );

  // /operations/general/malformed
  it.each([
    ["no password", "login=alice"],
    ["no login", "password=x"],
    ["nothing", ""],
    ["the login twice", "login=alice&login=carol&password=x"],
    ["the password twice", "login=alice&password=x&password=y"],
  ])("refuses a sign-in with %s: 400, nothing changes", async (_l, form) => {
    const v = visitor();
    const before = state(world);
    expect((await v.post("/sign-in", form)).status).toBe(400);
    expect(state(world)).toEqual(before);
    await checkInvariants(v, world.databasePath);
  });
});
