/** Verified identity of the inbound mesh caller. */
export interface ServiceCaller {
  /** Canonical caller app clientId — `act.sub` for delegated tokens, else `sub`. */
  callerAppId: string;
  /** Scopes carried by the token. */
  scopes: string[];
  /** True when the token represents a user on behalf of an app (RFC 8693). */
  isDelegated: boolean;
  /** End-user id when delegated (`sub`); undefined for pure service tokens. */
  userId?: string;
  email?: string;
  role?: string;
  businessId?: string;
  /** Raw verified claims (never persisted or returned to clients). */
  claims: Record<string, unknown>;
}

declare module 'express' {
  interface Request {
    serviceCaller?: ServiceCaller;
  }
}
