import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { hashPassword } from "../../src/passwords.js";
import {
  Clock,
  MINUTE,
  ORIGIN,
  Visitor,
  checkInvariants,
  checkState,
  choose,
  createAssociation,
  lang,
  makeWorld,
  signIn,
  state,
  tempDatabase,
  type Answer,
  type World,
} from "./helpers.js";

const PLATEAU = "Outils du Plateau";
const ROSEMONT = "Outils de Rosemont";
const ALICE = "correct horse battery";
const CAROL = "carol's long secret";
/** The titles of the pages, in the default language. */
const MEMBERS_TITLE = "Membres";
const DELETION_TITLE = "Supprimer un membre";

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

/** A visitor signed in as `login`. */
async function signedInAs(login: string, password: string): Promise<Visitor> {
  const v = new Visitor(world.app);
  await signIn(v, login, password);
  return v;
}

function association(name: string) {
  const found = state(world).associations.find((a) => a.name === name);
  if (found === undefined) throw new Error(`no association ${name}`);
  return found;
}

function membersOf(name: string) {
  return association(name).members;
}

/** The id of the member of `associationName` named `name`. */
function idOf(associationName: string, name: string): number {
  const found = membersOf(associationName).find((m) => m.name === name);
  if (found === undefined) throw new Error(`no member ${name}`);
  return found.id;
}

function mainText(answer: Answer): string {
  return answer.$("main").text();
}

function title(answer: Answer): string {
  return answer.$("title").text().trim();
}

function expectHtml(answer: Answer): void {
  expect(String(answer.headers["content-type"])).toMatch(/^text\/html\b/);
}

/** The Members page, in the default language. */
function expectMembersPage(answer: Answer): void {
  expectHtml(answer);
  expect(title(answer)).toBe(MEMBERS_TITLE);
}

/** The Member page of the member named `name`. */
function expectMemberPage(answer: Answer, name: string): void {
  expectHtml(answer);
  expect(title(answer)).toBe(name);
}

function expect4xx(answer: Answer): void {
  expect(answer.status).toBeGreaterThanOrEqual(400);
  expect(answer.status).toBeLessThan(500);
}

/** Adds a member by the operation; it must succeed. */
async function add(v: Visitor, name: string, contact = ""): Promise<void> {
  const answer = await v.post("/members/add", { name, contact });
  expect(answer.status).toBe(200);
}

describe("Show members", () => {
  // /operations/show-members/result
  // /operations/general/own-association
  it("answers 200 with the Members page of the volunteer's association", async () => {
    const alice = await signedInAs("alice", ALICE);
    const carol = await signedInAs("carol", CAROL);
    await add(alice, "Marie Dupont", "514 555-0123");
    await add(carol, "Paul Tremblay", "paul@example.org");

    const answer = await alice.get("/members");
    expect(answer.status).toBe(200);
    expectMembersPage(answer);
    expect(mainText(answer)).toContain("Marie Dupont");
    expect(mainText(answer)).toContain("514 555-0123");
    expect(mainText(answer)).not.toContain("Paul Tremblay");

    const other = await carol.get("/members");
    expect(other.status).toBe(200);
    expect(mainText(other)).toContain("Paul Tremblay");
    expect(mainText(other)).not.toContain("Marie Dupont");
    await checkInvariants(alice, world.databasePath);
  });
});

describe("Add member", () => {
  // /operations/add-member/added
  it("adds a member with nextMemberId as id, which then grows by 1: 200 with the Members page", async () => {
    const alice = await signedInAs("alice", ALICE);
    const rosemont = association(ROSEMONT);
    const first = association(PLATEAU).nextMemberId;

    const answer = await alice.post("/members/add", {
      name: "Marie Dupont",
      contact: "514 555-0123",
    });
    expect(answer.status).toBe(200);
    expectMembersPage(answer);
    expect(membersOf(PLATEAU)).toEqual([
      { id: first, name: "Marie Dupont", contact: "514 555-0123" },
    ]);
    expect(association(PLATEAU).nextMemberId).toBe(first + 1);

    await add(alice, "Paul Tremblay", "");
    expect(membersOf(PLATEAU)).toEqual([
      { id: first, name: "Marie Dupont", contact: "514 555-0123" },
      { id: first + 1, name: "Paul Tremblay", contact: "" },
    ]);
    expect(association(PLATEAU).nextMemberId).toBe(first + 2);
    expect(association(ROSEMONT)).toEqual(rosemont);
    await checkInvariants(alice, world.databasePath);
  });

  // /operations/add-member/added
  // /model/member/id-unique
  it("never gives the id of a deleted member to a new one", async () => {
    const alice = await signedInAs("alice", ALICE);
    await add(alice, "Marie Dupont");
    await add(alice, "Paul Tremblay");
    const marie = idOf(PLATEAU, "Marie Dupont");
    const paul = idOf(PLATEAU, "Paul Tremblay");
    const next = association(PLATEAU).nextMemberId;
    expect((await alice.post(`/members/${paul}/delete`, {})).status).toBe(200);
    expect(association(PLATEAU).nextMemberId).toBe(next);
    await add(alice, "Sophie Roy");
    const sophie = idOf(PLATEAU, "Sophie Roy");
    expect(sophie).toBe(next);
    expect([marie, paul]).not.toContain(sophie);
    await checkInvariants(alice, world.databasePath);
  });

  // /operations/add-member/added
  // /operations/general/own-association
  it("adds to the adding volunteer's association only, even with the name of another association's member", async () => {
    const alice = await signedInAs("alice", ALICE);
    const carol = await signedInAs("carol", CAROL);
    await add(carol, "Marie Dupont", "carol's Marie");
    const rosemont = association(ROSEMONT);
    await add(alice, "Marie Dupont", "alice's Marie");
    expect(membersOf(PLATEAU).map((m) => [m.name, m.contact])).toEqual([
      ["Marie Dupont", "alice's Marie"],
    ]);
    expect(association(ROSEMONT)).toEqual(rosemont);
    await checkInvariants(alice, world.databasePath);
  });

  // /operations/general/trimmed
  // /operations/add-member/added
  it("reads the name and the contact without the whitespace at their start and end", async () => {
    const alice = await signedInAs("alice", ALICE);
    await add(alice, "  Marie  Dupont\t", " \t514 555-0123  ");
    expect(membersOf(PLATEAU).map((m) => [m.name, m.contact])).toEqual([
      ["Marie  Dupont", "514 555-0123"],
    ]);
    await add(alice, "Paul Tremblay", "   ");
    expect(membersOf(PLATEAU).map((m) => [m.name, m.contact])).toEqual([
      ["Marie  Dupont", "514 555-0123"],
      ["Paul Tremblay", ""],
    ]);
    await checkInvariants(alice, world.databasePath);
  });

  // /operations/add-member/invalid
  // /operations/general/trimmed
  // /operations/general/volunteers-refused
  it.each([
    ["an empty name", ""],
    ["a name of spaces only", "   "],
    ["a name of a tab and a newline", "\t\n"],
  ])(
    "refuses %s: a 4xx with the Members page, nothing changes",
    async (_l, name) => {
      const alice = await signedInAs("alice", ALICE);
      await add(alice, "Paul Tremblay");
      const before = state(world);
      const answer = await alice.post("/members/add", {
        name,
        contact: "514 555-0123",
      });
      expect4xx(answer);
      expectMembersPage(answer);
      expect(state(world)).toEqual(before);
      await checkInvariants(alice, world.databasePath);
    },
  );

  // /operations/add-member/taken
  // /operations/general/trimmed
  // /operations/general/volunteers-refused
  it.each([
    ["the same name", "Marie Dupont"],
    ["the same name once trimmed", "  Marie Dupont "],
  ])(
    "refuses %s as a member of the association: a 4xx with the Members page, nothing changes",
    async (_l, name) => {
      const alice = await signedInAs("alice", ALICE);
      await add(alice, "Marie Dupont", "514 555-0123");
      const before = state(world);
      const answer = await alice.post("/members/add", { name, contact: "" });
      expect4xx(answer);
      expectMembersPage(answer);
      expect(state(world)).toEqual(before);
      await checkInvariants(alice, world.databasePath);
    },
  );

  // /operations/general/refused
  it("answers a refusal in the display language", async () => {
    const alice = await signedInAs("alice", ALICE);
    await choose(alice, "en");
    const answer = await alice.post("/members/add", { name: "", contact: "" });
    expect4xx(answer);
    expect(lang(answer)).toBe("en");
    expect(title(answer)).toBe("Members");
    await checkInvariants(alice, world.databasePath);
  });
});

describe("Show member", () => {
  // /operations/show-member/result
  it("answers 200 with the Member page of a member of the association", async () => {
    const alice = await signedInAs("alice", ALICE);
    await add(alice, "Marie Dupont", "514 555-0123");
    await add(alice, "Paul Tremblay", "paul@example.org");
    const answer = await alice.get(`/members/${idOf(PLATEAU, "Marie Dupont")}`);
    expect(answer.status).toBe(200);
    expectMemberPage(answer, "Marie Dupont");
    expect(answer.$('input[name="name"]').val()).toBe("Marie Dupont");
    expect(answer.$('input[name="contact"]').val()).toBe("514 555-0123");
    expect(mainText(answer)).not.toContain("Paul Tremblay");
    await checkInvariants(alice, world.databasePath);
  });

  // /operations/show-member/unknown
  // /operations/general/own-association
  it("answers 404 for the id of another association's member, of a deleted member, or of no member", async () => {
    const alice = await signedInAs("alice", ALICE);
    const carol = await signedInAs("carol", CAROL);
    await add(carol, "Paul Tremblay", "paul@example.org");
    await add(alice, "Marie Dupont");
    const marie = idOf(PLATEAU, "Marie Dupont");
    expect((await alice.post(`/members/${marie}/delete`, {})).status).toBe(200);
    const before = state(world);
    for (const id of [
      idOf(ROSEMONT, "Paul Tremblay"),
      marie,
      association(PLATEAU).nextMemberId,
      0,
      -1,
    ]) {
      const answer = await alice.get(`/members/${id}`);
      expect(answer.status, `id ${id}`).toBe(404);
      expect(mainText(answer)).not.toContain("paul@example.org");
    }
    expect(state(world)).toEqual(before);
    await checkInvariants(alice, world.databasePath);
  });
});

describe("Edit member", () => {
  // /operations/edit-member/edited
  it("sets the member's name and contact: 200 with the Members page", async () => {
    const alice = await signedInAs("alice", ALICE);
    await add(alice, "Marie Dupont", "514 555-0123");
    await add(alice, "Paul Tremblay", "paul@example.org");
    const marie = idOf(PLATEAU, "Marie Dupont");
    const paul = idOf(PLATEAU, "Paul Tremblay");
    const before = association(PLATEAU);
    const rosemont = association(ROSEMONT);
    const answer = await alice.post(`/members/${marie}/edit`, {
      name: "Marie Dupont-Roy",
      contact: "marie@example.org",
    });
    expect(answer.status).toBe(200);
    expectMembersPage(answer);
    expect(membersOf(PLATEAU)).toEqual([
      { id: marie, name: "Marie Dupont-Roy", contact: "marie@example.org" },
      { id: paul, name: "Paul Tremblay", contact: "paul@example.org" },
    ]);
    expect(association(PLATEAU).nextMemberId).toBe(before.nextMemberId);
    expect(association(ROSEMONT)).toEqual(rosemont);
    await checkInvariants(alice, world.databasePath);
  });

  // /operations/edit-member/edited
  // /operations/general/trimmed
  it("keeps the member's own name, and reads the inputs trimmed", async () => {
    const alice = await signedInAs("alice", ALICE);
    await add(alice, "Marie Dupont", "514 555-0123");
    const marie = idOf(PLATEAU, "Marie Dupont");
    const answer = await alice.post(`/members/${marie}/edit`, {
      name: " Marie Dupont ",
      contact: "\t",
    });
    expect(answer.status).toBe(200);
    expect(membersOf(PLATEAU)).toEqual([
      { id: marie, name: "Marie Dupont", contact: "" },
    ]);
    await checkInvariants(alice, world.databasePath);
  });

  // /operations/edit-member/unknown
  // /operations/general/own-association
  it("answers 404 for the id of another association's member, of a deleted member, or of no member, nothing changes", async () => {
    const alice = await signedInAs("alice", ALICE);
    const carol = await signedInAs("carol", CAROL);
    await add(carol, "Paul Tremblay", "paul@example.org");
    await add(alice, "Marie Dupont");
    await add(alice, "Sophie Roy");
    const sophie = idOf(PLATEAU, "Sophie Roy");
    expect((await alice.post(`/members/${sophie}/delete`, {})).status).toBe(
      200,
    );
    const before = state(world);
    for (const [id, name] of [
      [idOf(ROSEMONT, "Paul Tremblay"), "Paul Martin"],
      [sophie, "Sophie Roy"],
      [association(PLATEAU).nextMemberId, "Nouveau Membre"],
      // Unknown comes first, before the name is read.
      [idOf(ROSEMONT, "Paul Tremblay"), ""],
      [idOf(ROSEMONT, "Paul Tremblay"), "Marie Dupont"],
    ] as const) {
      const answer = await alice.post(`/members/${id}/edit`, {
        name,
        contact: "x",
      });
      expect(answer.status, `id ${id}, name ${name}`).toBe(404);
    }
    expect(state(world)).toEqual(before);
    await checkInvariants(alice, world.databasePath);
  });

  // /operations/edit-member/invalid
  // /operations/general/trimmed
  // /operations/general/volunteers-refused
  it.each([
    ["an empty name", ""],
    ["a name of spaces only", "  "],
  ])(
    "refuses %s: a 4xx with the Member page, nothing changes",
    async (_l, name) => {
      const alice = await signedInAs("alice", ALICE);
      await add(alice, "Marie Dupont", "514 555-0123");
      const marie = idOf(PLATEAU, "Marie Dupont");
      const before = state(world);
      const answer = await alice.post(`/members/${marie}/edit`, {
        name,
        contact: "marie@example.org",
      });
      expect4xx(answer);
      expectMemberPage(answer, "Marie Dupont");
      expect(state(world)).toEqual(before);
      await checkInvariants(alice, world.databasePath);
    },
  );

  // /operations/edit-member/taken
  // /operations/general/trimmed
  // /operations/general/volunteers-refused
  it.each([
    ["the name", "Paul Tremblay"],
    ["the name once trimmed", " Paul Tremblay  "],
  ])(
    "refuses %s of another member of the association: a 4xx with the Member page, nothing changes",
    async (_l, name) => {
      const alice = await signedInAs("alice", ALICE);
      await add(alice, "Marie Dupont", "514 555-0123");
      await add(alice, "Paul Tremblay");
      const marie = idOf(PLATEAU, "Marie Dupont");
      const before = state(world);
      const answer = await alice.post(`/members/${marie}/edit`, {
        name,
        contact: "",
      });
      expect4xx(answer);
      expectMemberPage(answer, "Marie Dupont");
      expect(state(world)).toEqual(before);
      await checkInvariants(alice, world.databasePath);
    },
  );

  // /operations/edit-member/edited
  // /operations/general/own-association
  it("accepts the name of another association's member", async () => {
    const alice = await signedInAs("alice", ALICE);
    const carol = await signedInAs("carol", CAROL);
    await add(carol, "Paul Tremblay");
    await add(alice, "Marie Dupont");
    const rosemont = association(ROSEMONT);
    const marie = idOf(PLATEAU, "Marie Dupont");
    const answer = await alice.post(`/members/${marie}/edit`, {
      name: "Paul Tremblay",
      contact: "",
    });
    expect(answer.status).toBe(200);
    expect(membersOf(PLATEAU).map((m) => m.name)).toEqual(["Paul Tremblay"]);
    expect(association(ROSEMONT)).toEqual(rosemont);
    await checkInvariants(alice, world.databasePath);
  });
});

// /operations/general/refused
it("answers a 404 refusal with a page holding a message, in the display language", async () => {
  const alice = await signedInAs("alice", ALICE);
  await choose(alice, "en");
  const id = association(PLATEAU).nextMemberId;
  for (const [method, url] of [
    ["GET", `/members/${id}`],
    ["POST", `/members/${id}/edit`],
    ["GET", `/members/${id}/delete`],
    ["POST", `/members/${id}/delete`],
  ] as const) {
    const answer =
      method === "GET"
        ? await alice.get(url)
        : await alice.post(
            url,
            url.endsWith("/edit") ? { name: "Sophie Roy", contact: "" } : {},
          );
    expect(answer.status, url).toBe(404);
    expectHtml(answer);
    expect(lang(answer)).toBe("en");
    expect(mainText(answer).trim()).not.toBe("");
  }
  await checkInvariants(alice, world.databasePath);
});

describe("Show member deletion", () => {
  // /operations/show-member-deletion/result
  it("answers 200 with the Member deletion page of a member of the association", async () => {
    const alice = await signedInAs("alice", ALICE);
    await add(alice, "Marie Dupont");
    await add(alice, "Paul Tremblay");
    const before = state(world);
    const answer = await alice.get(
      `/members/${idOf(PLATEAU, "Marie Dupont")}/delete`,
    );
    expect(answer.status).toBe(200);
    expectHtml(answer);
    expect(title(answer)).toBe(DELETION_TITLE);
    expect(mainText(answer)).toContain("Marie Dupont");
    expect(mainText(answer)).not.toContain("Paul Tremblay");
    expect(state(world).associations).toEqual(before.associations);
    await checkInvariants(alice, world.databasePath);
  });

  // /operations/show-member-deletion/unknown
  // /operations/general/own-association
  it("answers 404 for the id of another association's member, of a deleted member, or of no member", async () => {
    const alice = await signedInAs("alice", ALICE);
    const carol = await signedInAs("carol", CAROL);
    await add(carol, "Paul Tremblay");
    await add(alice, "Marie Dupont");
    const marie = idOf(PLATEAU, "Marie Dupont");
    expect((await alice.post(`/members/${marie}/delete`, {})).status).toBe(200);
    const before = state(world);
    for (const id of [
      idOf(ROSEMONT, "Paul Tremblay"),
      marie,
      association(PLATEAU).nextMemberId,
    ]) {
      const answer = await alice.get(`/members/${id}/delete`);
      expect(answer.status, `id ${id}`).toBe(404);
      expect(mainText(answer)).not.toContain("Paul Tremblay");
    }
    expect(state(world)).toEqual(before);
    await checkInvariants(alice, world.databasePath);
  });
});

describe("Delete member", () => {
  // /operations/delete-member/deleted
  it("deletes the member, keeps the others: 200 with the Members page", async () => {
    const alice = await signedInAs("alice", ALICE);
    const carol = await signedInAs("carol", CAROL);
    await add(carol, "Marie Dupont");
    await add(alice, "Marie Dupont", "514 555-0123");
    await add(alice, "Paul Tremblay", "paul@example.org");
    const marie = idOf(PLATEAU, "Marie Dupont");
    const paul = idOf(PLATEAU, "Paul Tremblay");
    const before = association(PLATEAU);
    const rosemont = association(ROSEMONT);
    const answer = await alice.post(`/members/${marie}/delete`, {});
    expect(answer.status).toBe(200);
    expectMembersPage(answer);
    expect(membersOf(PLATEAU)).toEqual([
      { id: paul, name: "Paul Tremblay", contact: "paul@example.org" },
    ]);
    expect(association(PLATEAU).nextMemberId).toBe(before.nextMemberId);
    expect(association(ROSEMONT)).toEqual(rosemont);
    await checkInvariants(alice, world.databasePath);
  });

  // /operations/delete-member/unknown
  // /operations/general/own-association
  it("answers 404 for the id of another association's member, of a deleted member, or of no member, nothing changes", async () => {
    const alice = await signedInAs("alice", ALICE);
    const carol = await signedInAs("carol", CAROL);
    await add(carol, "Paul Tremblay");
    await add(alice, "Marie Dupont");
    await add(alice, "Sophie Roy");
    const sophie = idOf(PLATEAU, "Sophie Roy");
    expect((await alice.post(`/members/${sophie}/delete`, {})).status).toBe(
      200,
    );
    const before = state(world);
    for (const id of [
      idOf(ROSEMONT, "Paul Tremblay"),
      sophie,
      association(PLATEAU).nextMemberId,
    ]) {
      const answer = await alice.post(`/members/${id}/delete`, {});
      expect(answer.status, `id ${id}`).toBe(404);
    }
    expect(state(world)).toEqual(before);
    await checkInvariants(alice, world.databasePath);
  });
});

describe("General, for the members' operations", () => {
  /** The requests of the members' operations, on the member `id`. */
  function requests(id: number): [string, string, Record<string, string>?][] {
    return [
      ["GET", "/members"],
      ["POST", "/members/add", { name: "Sophie Roy", contact: "" }],
      ["GET", `/members/${id}`],
      ["POST", `/members/${id}/edit`, { name: "Sophie Roy", contact: "" }],
      ["GET", `/members/${id}/delete`],
      ["POST", `/members/${id}/delete`, {}],
    ];
  }

  // /operations/general/volunteers-only
  it("answers 303 to /sign-in without a signed-in volunteer, and changes nothing", async () => {
    const alice = await signedInAs("alice", ALICE);
    await add(alice, "Marie Dupont");
    const marie = idOf(PLATEAU, "Marie Dupont");
    const v = new Visitor(world.app);
    const before = state(world);
    for (const [method, url, form] of requests(marie)) {
      const answer =
        method === "GET" ? await v.get(url) : await v.post(url, form ?? {});
      expect(answer.status, `${method} ${url}`).toBe(303);
      expect(answer.headers.location).toBe("/sign-in");
    }
    // Malformed requests too: the session is checked first.
    for (const [url, form] of [
      ["/members/add", "name=Sophie"],
      [`/members/${marie}/edit`, ""],
      ["/members/abc/edit", "name=Sophie&contact="],
      ["/members/abc/delete", ""],
    ] as const) {
      const answer = await v.post(url, form);
      expect(answer.status, url).toBe(303);
      expect(answer.headers.location).toBe("/sign-in");
    }
    for (const url of ["/members/abc", "/members/abc/delete"]) {
      const answer = await v.get(url);
      expect(answer.status, url).toBe(303);
      expect(answer.headers.location).toBe("/sign-in");
    }
    expect(state(world)).toEqual(before);
    await checkInvariants(v, world.databasePath);
  });

  // /operations/general/origin
  it.each([
    ["no Origin", null],
    ["another origin", "https://evil.example.com"],
  ])("refuses each POST with %s: 403, nothing changes", async (_l, origin) => {
    const alice = await signedInAs("alice", ALICE);
    await add(alice, "Marie Dupont");
    const marie = idOf(PLATEAU, "Marie Dupont");
    const before = state(world);
    for (const [method, url, form] of requests(marie)) {
      if (method !== "POST") continue;
      expect((await alice.post(url, form ?? {}, origin)).status, url).toBe(403);
    }
    expect(state(world)).toEqual(before);
    await checkInvariants(alice, world.databasePath);
  });

  // /operations/general/malformed
  it("refuses an input missing, repeated, or not of its type: 400, nothing changes", async () => {
    const alice = await signedInAs("alice", ALICE);
    await add(alice, "Marie Dupont");
    const marie = idOf(PLATEAU, "Marie Dupont");
    const before = state(world);
    for (const [url, form] of [
      ["/members/add", "name=Sophie+Roy"],
      ["/members/add", "contact=x"],
      ["/members/add", "name=Sophie+Roy&name=Paul&contact="],
      ["/members/add", "name=Sophie+Roy&contact=a&contact=b"],
      [`/members/${marie}/edit`, "name=Sophie+Roy"],
      [`/members/${marie}/edit`, "contact=x"],
      [`/members/${marie}/edit`, "name=A&name=B&contact="],
      ["/members/abc/edit", "name=Sophie+Roy&contact="],
      ["/members/1.5/edit", "name=Sophie+Roy&contact="],
      ["/members/abc/delete", ""],
      ["/members/1.5/delete", ""],
    ] as const) {
      expect((await alice.post(url, form)).status, `${url} ${form}`).toBe(400);
    }
    for (const url of [
      "/members/abc",
      "/members/1.5",
      "/members/abc/delete",
      "/members/1.5/delete",
    ]) {
      expect((await alice.get(url)).status, url).toBe(400);
    }
    expect(state(world)).toEqual(before);
    await checkInvariants(alice, world.databasePath);
  });

  // /operations/general/activity
  it("sets lastUsed after an answer that is not refused, and only then", async () => {
    const alice = await signedInAs("alice", ALICE);
    await add(alice, "Marie Dupont");
    const marie = idOf(PLATEAU, "Marie Dupont");
    const lastUsed = () => state(world).sessions[0]?.lastUsed.getTime();
    const signedAt = lastUsed();

    world.clock.advance(MINUTE);
    expect4xx(await alice.post("/members/add", { name: "", contact: "" }));
    expect4xx(
      await alice.post(`/members/${marie}/edit`, { name: "", contact: "" }),
    );
    expect((await alice.get(`/members/${marie + 1000}`)).status).toBe(404);
    expect(lastUsed()).toBe(signedAt);

    expect((await alice.get(`/members/${marie}`)).status).toBe(200);
    expect(lastUsed()).toBe(world.clock.time);
    await checkInvariants(alice, world.databasePath);
  });
});

/** The schema of a database stored before members existed. */
const SCHEMA_BEFORE_MEMBERS = `
  CREATE TABLE associations (
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
  );
  PRAGMA user_version = 1;
`;

describe("Migrate members", () => {
  // /operations/migrate-members/no-member
  it("gives every association of a database stored before members existed no member, and nextMemberId 1", async () => {
    const databasePath = tempDatabase();
    const old = new DatabaseSync(databasePath);
    old.exec(SCHEMA_BEFORE_MEMBERS);
    const insertAssociation = old.prepare(
      "INSERT INTO associations (id, name) VALUES (?, ?)",
    );
    const insertVolunteer = old.prepare(
      "INSERT INTO volunteers (association_id, login, password_hash, failures) VALUES (?, ?, ?, ?)",
    );
    insertAssociation.run(1, PLATEAU);
    insertAssociation.run(2, ROSEMONT);
    insertVolunteer.run(1, "alice", await hashPassword(ALICE), 2);
    insertVolunteer.run(2, "carol", await hashPassword(CAROL), 0);
    old.close();

    const clock = new Clock();
    const app = buildApp({
      publicOrigin: ORIGIN,
      databasePath,
      now: clock.now,
    });
    try {
      await app.ready();
      expect(state({ databasePath })).toEqual({
        associations: [
          {
            name: PLATEAU,
            volunteers: [{ login: "alice", failures: 2, lock: null }],
            members: [],
            nextMemberId: 1,
          },
          {
            name: ROSEMONT,
            volunteers: [{ login: "carol", failures: 0, lock: null }],
            members: [],
            nextMemberId: 1,
          },
        ],
        sessions: [],
      });
      checkState(state({ databasePath }));

      const alice = new Visitor(app);
      await signIn(alice, "alice", ALICE);
      const answer = await alice.get("/members");
      expect(answer.status).toBe(200);
      expectMembersPage(answer);
      await add(alice, "Marie Dupont");
      await checkInvariants(alice, databasePath);
    } finally {
      await app.close();
    }
  });

  // /operations/migrate-members
  it("does not run again at a later start", async () => {
    const alice = await signedInAs("alice", ALICE);
    await add(alice, "Marie Dupont", "514 555-0123");
    await add(alice, "Paul Tremblay");
    const before = state(world);
    await world.app.close();
    world.app = buildApp({
      publicOrigin: ORIGIN,
      databasePath: world.databasePath,
      now: world.clock.now,
    });
    await world.app.ready();
    expect(state(world)).toEqual(before);
    expect(membersOf(PLATEAU)).toHaveLength(2);
    checkState(state(world));
  });
});
