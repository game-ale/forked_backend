export type AppRole = 'admin' | 'driver' | 'viewer';
export type TokenType = 'user' | 'device' | 'service';

export type AuthContext = {
  subject: string;
  role: AppRole;
  email: string | null;
  vehicleIds: string[];
  tokenType: TokenType;
};
