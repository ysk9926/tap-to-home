import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { createTestUser, deleteTestUsers } from "../../../test/db";
import { getProfile } from "./server/profile";
import { updateRaceDisplayAction } from "./actions";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: vi.fn() }));

let me: CurrentUser;
let other: CurrentUser;
beforeAll(async () => {
  me = await createTestUser("rails_a");
  other = await createTestUser("rails_b");
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(me);
});
afterAll(async () => { await deleteTestUsers([me.id, other.id]); });

it("persists only the authenticated user's display preference and refreshes both pages", async () => {
  const data = new FormData();
  data.set("userId", other.id);
  await updateRaceDisplayAction(data);
  expect(await getProfile(me.id)).toMatchObject({
    showTopFriendRails: false, notifySignal: true, notifySettlement: true,
  });
  expect(await getProfile(other.id)).toHaveProperty("showTopFriendRails", true);
  expect(revalidatePath).toHaveBeenCalledWith("/");
  expect(revalidatePath).toHaveBeenCalledWith("/my");

  data.set("showTopFriendRails", "on");
  await updateRaceDisplayAction(data);
  expect(await getProfile(me.id)).toHaveProperty("showTopFriendRails", true);
});

it("rejects an expired session without changing the saved preference", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  await expect(updateRaceDisplayAction(new FormData())).rejects.toThrow("NEXT_REDIRECT");
  expect(await getProfile(me.id)).toHaveProperty("showTopFriendRails", true);
  expect(revalidatePath).not.toHaveBeenCalled();
});

it("keeps the display preference when reading a fresh account profile", async () => {
  await prisma.user.update({ where: { id: other.id }, data: { showTopFriendRails: false } });
  expect(await getProfile(other.id)).toHaveProperty("showTopFriendRails", false);
  expect(await getProfile(me.id)).toHaveProperty("showTopFriendRails", true);
});
