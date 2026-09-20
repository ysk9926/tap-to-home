import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { bootstrapMaster, resetMasterPassword, disableMaster } from "./master";
import { getAdminAuth } from "./server";
import { getAdmin } from "./current-admin";
import { consumeAdminLogin, handleAdminAuth } from "./handler";

const name = `am_${randomUUID().slice(0, 8)}`;
const userId = randomUUID();
const password = "Master-test-only-password-739!";
const ordinaryPassword = "Ordinary-test-password-638!";
let adminCookie = "";
let userCookie = "";
let createdMaster = false;
const previousSecret = process.env.ADMIN_AUTH_SECRET;

function cookies(response: Response) {
  return response.headers.getSetCookie().map((v) => v.split(";")[0]).join("; ");
}
function request(path: string, method = "GET", cookie = "", body?: object) {
  return new Request(`http://localhost:3000/api/admin/auth/${path}`, {
    method, headers: { origin: "http://localhost:3000", cookie, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

beforeAll(async () => {
  process.env.ADMIN_AUTH_SECRET = "isolated-admin-test-secret-with-more-than-32-characters";
  if (await prisma.adminUser.findUnique({ where: { id: "master" } })) {
    throw new Error("Auth tests need a local test database without a provisioned master");
  }
  await prisma.user.create({ data: {
    id: userId, name: "일반 회원", username: name, email: `${name}@test.local`,
    accounts: { create: { id: randomUUID(), accountId: userId, providerId: "credential", password: await hashPassword(ordinaryPassword) } },
  } });
});
afterAll(async () => {
  if (createdMaster) await prisma.adminUser.deleteMany({ where: { id: "master", username: name } });
  await prisma.user.deleteMany({ where: { id: userId } });
  if (createdMaster) await prisma.adminLoginAttempt.deleteMany({ where: { key: "master-login" } });
  if (previousSecret === undefined) delete process.env.ADMIN_AUTH_SECRET;
  else process.env.ADMIN_AUTH_SECRET = previousSecret;
});

describe("isolated master authentication", () => {
  it("keeps ordinary signup and immediate login working", async () => {
    const signupName = `su_${randomUUID().slice(0, 8)}`;
    const response = await auth.api.signUpEmail({
      body: { username: signupName, name: "신규 회원", email: `${signupName}@test.local`, password: ordinaryPassword }, asResponse: true,
    });
    try {
      expect(response.status).toBe(200);
      expect(await getCurrentUser(new Headers({ cookie: cookies(response) }))).toMatchObject({ username: signupName });
    } finally { await prisma.user.deleteMany({ where: { username: signupName } }); }
  });
  it("provisions once and never overwrites an existing master", async () => {
    createdMaster = await bootstrapMaster(name, password);
    expect(createdMaster).toBe(true);
    expect(await bootstrapMaster("another_master", "Another-test-password-123!")).toBe(false);
    expect((await prisma.adminUser.findUniqueOrThrow({ where: { id: "master" } })).username).toBe(name);
  });
  it("uses a separate credential store even for identical usernames", async () => {
    const wrong = await handleAdminAuth(request("sign-in/username", "POST", "", { username: name, password: ordinaryPassword }));
    expect(wrong.ok).toBe(false);
    const admin = await handleAdminAuth(request("sign-in/username", "POST", "", { username: name, password }));
    expect(admin.status).toBe(200);
    adminCookie = cookies(admin);
    expect(adminCookie).toContain("tth-admin.");
    expect(await getAdmin(new Headers({ cookie: adminCookie }))).toMatchObject({ id: "master", username: name });
    const normal = await auth.api.signInUsername({ body: { username: name, password: ordinaryPassword }, asResponse: true });
    expect(normal.status).toBe(200);
    userCookie = cookies(normal);
    expect(await getCurrentUser(new Headers({ cookie: userCookie }))).toMatchObject({ id: userId });
  });
  it("never authorizes either realm with the other realm's cookie", async () => {
    expect(await getAdmin(new Headers({ cookie: userCookie }))).toBeNull();
    expect(await getCurrentUser(new Headers({ cookie: adminCookie }))).toBeNull();
  });
  it("rejects signup, password-reset and unknown authentication endpoints", async () => {
    for (const path of ["sign-up/email", "request-password-reset", "update-user", "sign-in/email"]) {
      expect((await handleAdminAuth(request(path, "POST", adminCookie, {}))).status).toBe(404);
    }
    expect((await handleAdminAuth(request("sign-out", "GET", adminCookie))).status).toBe(405);
  });
  it("rejects cross-origin writes without changing the session", async () => {
    const req = request("sign-out", "POST", adminCookie, {});
    req.headers.set("origin", "https://untrusted.example");
    expect((await handleAdminAuth(req)).status).toBe(403);
    expect(await getAdmin(new Headers({ cookie: adminCookie }))).not.toBeNull();
  });
  it("logging out the master leaves the ordinary session active", async () => {
    const response = await handleAdminAuth(request("sign-out", "POST", `${adminCookie}; ${userCookie}`, {}));
    expect(response.status).toBe(200);
    expect(await getAdmin(new Headers({ cookie: adminCookie }))).toBeNull();
    expect(await getCurrentUser(new Headers({ cookie: userCookie }))).not.toBeNull();
  });
  it("password rotation revokes every old admin session", async () => {
    const login = await getAdminAuth().api.signInUsername({ body: { username: name, password }, asResponse: true });
    const oldCookie = cookies(login);
    await resetMasterPassword("Changed-test-password-638!");
    expect(await getAdmin(new Headers({ cookie: oldCookie }))).toBeNull();
    expect(await prisma.adminSession.count()).toBe(0);
  });
  it("expires a master session after eight hours", async () => {
    const response = await getAdminAuth().api.signInUsername({ body: { username: name, password: "Changed-test-password-638!" }, asResponse: true });
    const cookie = cookies(response);
    const session = await prisma.adminSession.findFirstOrThrow({ where: { userId: "master" } });
    expect(session.expiresAt.getTime() - session.createdAt.getTime()).toBeGreaterThanOrEqual(8 * 3600_000 - 1000);
    expect(session.expiresAt.getTime() - session.createdAt.getTime()).toBeLessThanOrEqual(8 * 3600_000 + 1000);
    await prisma.adminSession.update({ where: { id: session.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await getAdmin(new Headers({ cookie }))).toBeNull();
  });
  it("disabling master blocks creation of a new session", async () => {
    await disableMaster();
    const response = await handleAdminAuth(request("sign-in/username", "POST", "", { username: name, password: "Changed-test-password-638!" }));
    expect(response.ok).toBe(false);
    expect(await prisma.adminSession.count()).toBe(0);
  });
  it("suspended and deleted ordinary accounts cannot obtain new sessions", async () => {
    for (const data of [{ suspendedAt: new Date() }, { suspendedAt: null, deletedAt: new Date() }]) {
      await prisma.user.update({ where: { id: userId }, data });
      const response = await auth.api.signInUsername({ body: { username: name, password: ordinaryPassword }, asResponse: true });
      expect(response.ok).toBe(false);
      expect(await getCurrentUser(new Headers({ cookie: userCookie }))).toBeNull();
    }
  });
  it("limits concurrent login attempts in shared storage and reopens after the window", async () => {
    await prisma.adminLoginAttempt.deleteMany({ where: { key: "master-login" } });
    const now = new Date("2020-01-01T00:00:00Z");
    const allowed = await Promise.all(Array.from({ length: 12 }, () => consumeAdminLogin(now)));
    expect(allowed.filter(Boolean)).toHaveLength(10);
    expect(await consumeAdminLogin(new Date("2020-01-01T00:00:59Z"))).toBe(false);
    expect(await consumeAdminLogin(new Date("2020-01-01T00:01:00Z"))).toBe(true);
  });
});
