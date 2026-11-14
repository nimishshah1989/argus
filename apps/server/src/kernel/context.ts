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
  /**
   * Set when the caller is one of our own staff under a customer-approved grant (D29), not a sign-in of the
   * plant. `loginId` is then the admin who approved the grant, because rows need a login; this field is what
   * says who really called.
   */
  supportGrantId?: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}
