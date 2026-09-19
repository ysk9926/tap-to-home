import type { FriendError } from "./friends";

/** FriendError.code → HTTP status. route handler 들이 공유한다 */
export const FRIEND_ERROR_STATUS: Record<FriendError["code"], number> = {
  self: 400,
  not_found: 404,
  already: 409,
  requested: 409,
  blocked: 403,
  no_request: 404,
};
