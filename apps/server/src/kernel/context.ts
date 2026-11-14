export interface AuthContext {
  token: string;
  tenantId: string;
  loginId: string;
  username: string;
  role: string;
  shared: boolean;
  personId: string | null;
  personName: string | null;
  personTitle: string | null;
  mustChangePassword: boolean;
  /** The cell of this login, null when it has none. */
  cell: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}
