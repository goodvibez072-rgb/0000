declare module 'passport-discord' {
  import { Strategy as PassportStrategy } from 'passport-strategy';
  
  export interface Profile {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    email?: string;
    verified?: boolean;
    locale?: string;
    mfa_enabled?: boolean;
    provider: string;
  }

  export interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
  }

  export type VerifyFunction = (
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (error: any, user?: any) => void
  ) => void;

  export class Strategy extends PassportStrategy {
    constructor(options: StrategyOptions, verify: VerifyFunction);
    name: string;
  }
}
