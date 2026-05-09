/**
 * Represents the role a user has within the application context.
 * - `admin`: Has full access to all resources and profiles.
 * - `driver`: Has limited access, specifically to their assigned vehicle.
 * - `viewer`: Read-only access or default unassigned state.
 */
export type AppRole = 'admin' | 'driver' | 'viewer';

export const APP_ROLES: readonly AppRole[] = ['admin', 'driver', 'viewer'] as const;

export function isAppRole(value: string): value is AppRole {
  return APP_ROLES.includes(value as AppRole);
}

/**
 * Indicates the type of token used for authentication.
 * - `user`: A standard JWT issued by Supabase Auth for human users.
 * - `device`: A hardware token issued for telemetry ingestion.
 * - `service`: An internal service-to-service token.
 */
export type TokenType = 'user' | 'device' | 'service';

/**
 * Context object injected into the Express Request after successful authentication.
 * Contains the identity, role, and vehicle access scope for the current request.
 */
export type AuthContext = {
  subject: string;
  role: AppRole;
  profileResolved: boolean;
  email: string | null;
  vehicleIds: string[];
  tokenType: TokenType;
};
