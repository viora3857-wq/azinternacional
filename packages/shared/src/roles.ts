export const ROLES = ['student', 'admin', 'owner'] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_ROLES: readonly Role[] = ['admin', 'owner'];
