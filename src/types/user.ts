export const USER_ROLES = ["admin", "student", "interviewer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["active", "pending", "suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
