/**
 * Represents the role a user has within the application context.
 * - `admin`: Has full access to all resources and profiles.
 * - `driver`: Has limited access, specifically to their assigned vehicle.
 * - `viewer`: Read-only access or default unassigned state.
 */
export type AppRole = 'admin' | 'driver' | 'viewer';

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
  email: string | null;
  vehicleIds: string[];
  tokenType: TokenType;
};
