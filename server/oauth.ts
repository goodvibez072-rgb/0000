import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as DiscordStrategy } from "passport-discord";
import { storage } from "./storage";
import type { User } from "@shared/schema";

export async function setupOAuth(app: any) {
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUserById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Support production domains via PRODUCTION_URL or REPLIT_DOMAINS
  const callbackURL = process.env.PRODUCTION_URL 
    || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : undefined)
    || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : undefined)
    || 'http://localhost:5000';

  const googleConfig = await storage.getOAuthProviderConfig('google');
  if (googleConfig.enabled && googleConfig.clientId && googleConfig.clientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: googleConfig.clientId,
          clientSecret: googleConfig.clientSecret,
          callbackURL: `${callbackURL}/api/auth/google/callback`,
          scope: ['profile', 'email'],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(new Error('No email provided by Google'), undefined);
            }

            let user = await storage.getUserByEmail(email);

            if (user) {
              await storage.updateUser(user.id, {
                firstName: profile.name?.givenName || user.firstName,
                lastName: profile.name?.familyName || user.lastName,
                profileImageUrl: profile.photos?.[0]?.value || user.profileImageUrl,
                lastLoginAt: new Date().toISOString(),
                loginCount: (user.loginCount || 0) + 1,
              } as any);
              
              user = await storage.getUserById(user.id);
            } else {
              const username = email.split('@')[0] + '_' + Math.random().toString(36).substring(2, 7);
              
              user = await storage.createUser({
                username,
                email,
                firstName: profile.name?.givenName || '',
                lastName: profile.name?.familyName || '',
                profileImageUrl: profile.photos?.[0]?.value,
                emailVerified: 'true',
                emailVerifiedAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
                loginCount: 1,
              } as any);
            }

            return done(null, user);
          } catch (error) {
            return done(error as Error, undefined);
          }
        }
      )
    );
    console.log('[OAuth] Google OAuth configured successfully');
  } else {
    console.log('[OAuth] Google OAuth disabled or not configured');
  }

  const discordConfig = await storage.getOAuthProviderConfig('discord');
  if (discordConfig.enabled && discordConfig.clientId && discordConfig.clientSecret) {
    passport.use(
      new DiscordStrategy(
        {
          clientID: discordConfig.clientId,
          clientSecret: discordConfig.clientSecret,
          callbackURL: `${callbackURL}/api/auth/discord/callback`,
          scope: ['identify', 'email'],
        },
        async (accessToken: string, refreshToken: string, profile: any, done: any) => {
          try {
            const email = profile.email;
            if (!email) {
              return done(new Error('No email provided by Discord'), undefined);
            }

            let user = await storage.getUserByEmail(email);

            if (user) {
              await storage.updateUser(user.id, {
                firstName: profile.username || user.firstName,
                profileImageUrl: profile.avatar 
                  ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
                  : user.profileImageUrl,
                lastLoginAt: new Date().toISOString(),
                loginCount: (user.loginCount || 0) + 1,
              } as any);
              
              user = await storage.getUserById(user.id);
            } else {
              const username = profile.username + '_' + Math.random().toString(36).substring(2, 7);
              
              user = await storage.createUser({
                username,
                email,
                firstName: profile.username || '',
                profileImageUrl: profile.avatar 
                  ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
                  : undefined,
                emailVerified: 'true',
                emailVerifiedAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
                loginCount: 1,
              } as any);
            }

            return done(null, user);
          } catch (error) {
            return done(error as Error, undefined);
          }
        }
      )
    );
    console.log('[OAuth] Discord OAuth configured successfully');
  } else {
    console.log('[OAuth] Discord OAuth disabled or not configured');
  }

  app.use(passport.initialize());
  app.use(passport.session());
}
