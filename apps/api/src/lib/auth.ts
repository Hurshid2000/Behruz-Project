export const ROLES = ["admin", "operator", "viewer"] as const;
export type RoleType = (typeof ROLES)[number];
