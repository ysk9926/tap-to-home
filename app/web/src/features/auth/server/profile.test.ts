import { afterAll, expect, it } from "vitest";
import { createTestUser, deleteTestUsers } from "../../../../test/db";
import { getProfile } from "./profile";

const userIds: string[] = [];
afterAll(async () => { await deleteTestUsers(userIds); });

it("shows the top friend rails by default for a new account", async () => {
  const user = await createTestUser("rails");
  userIds.push(user.id);
  expect(await getProfile(user.id)).toHaveProperty("showTopFriendRails", true);
});
