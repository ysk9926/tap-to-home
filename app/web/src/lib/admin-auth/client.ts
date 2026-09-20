"use client";
import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

export const adminAuthClient = createAuthClient({
  basePath: "/api/admin/auth", plugins: [usernameClient()],
});
