// src/middleware/passport.ts
import type { PassportStatic } from "passport";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
// import bcrypt from "bcryptjs";

type JWTPayload = {
  userId: number | string; // number for INT PK, string for UUID
  iat?: number;
  exp?: number;
};

export const configurePassport = (passport: PassportStatic): void => {
  // ---- JWT Strategy (with active check) ----
  passport.use(
    "jwt",
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: process.env.JWT_SECRET || "your-secret-key",
        passReqToCallback: false,
      },
      async (payload: JWTPayload, done) => {
        try {
          console.log("JWT Strategy: Verifying token for userId:", payload.userId);
          // Find by primary key (works for numeric or UUID)
          const user = await User.findByPk(payload.userId as any, {
            attributes: { exclude: ["password"] }, // do not expose password
          });

          if (!user) {
            console.log("JWT Strategy: User not found for userId:", payload.userId);
            return done(null, false, { message: "User not found" });
          }

          // Optional: block inactive users if your model has isActive
          if ((user as any).isActive === false) {
            console.log("JWT Strategy: User is inactive for userId:", payload.userId);
            return done(null, false, { message: "User is inactive" });
          }

          console.log("JWT Strategy: User authenticated successfully:", user.id);
          return done(null, user);
        } catch (err: any) {
          console.error("JWT Strategy Error:", err);
          console.error("Error details:", err.message);
          console.error("Error SQL:", err.sql);
          // Don't pass the error to done, pass null and false to indicate authentication failure
          return done(null, false, { message: err.message || "Authentication failed" });
        }
      }
    )
  );

  // ---- JWT Strategy (allow inactive users - for profile completion) ----
  passport.use(
    "jwt-allow-inactive",
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: process.env.JWT_SECRET || "your-secret-key",
        passReqToCallback: false,
      },
      async (payload: JWTPayload, done) => {
        try {
          console.log("JWT Strategy (allow-inactive): Verifying token for userId:", payload.userId);
          // Find by primary key (works for numeric or UUID)
          const user = await User.findByPk(payload.userId as any, {
            attributes: { exclude: ["password"] }, // do not expose password
          });

          if (!user) {
            console.log("JWT Strategy (allow-inactive): User not found for userId:", payload.userId);
            return done(null, false, { message: "User not found" });
          }

          // Don't check isActive - allow inactive users to complete profile
          console.log("JWT Strategy (allow-inactive): User authenticated successfully:", user.id);
          return done(null, user);
        } catch (err: any) {
          console.error("JWT Strategy (allow-inactive) Error:", err);
          console.error("Error details:", err.message);
          console.error("Error SQL:", err.sql);
          // Don't pass the error to done, pass null and false to indicate authentication failure
          return done(null, false, { message: err.message || "Authentication failed" });
        }
      }
    )
  );

  // ---- Local Strategy (email/password) ----
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
        session: false, // JWT-based, no sessions
      },
      async (email, password, done) => {
        try {
          const normalizedEmail = email.toLowerCase().trim();

          const user = await User.findOne({
            where: { email: normalizedEmail },
          });

          if (!user) {
            return done(null, false, { message: "Invalid credentials" });
          }

          // If you added an instance method (e.g., user.comparePassword), use that.
          // Otherwise, compare directly with bcrypt:
          const ok = await bcrypt.compare(password, (user as any).password);
          if (!ok) {
            return done(null, false, { message: "Invalid credentials" });
          }

          // Optional: block inactive users
          if ((user as any).isActive === false) {
            return done(null, false, { message: "User is blocked" });
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  // If you were using sessions (not typical with JWT), you could add:
  // passport.serializeUser((user: any, done) => done(null, user.id));
  // passport.deserializeUser(async (id: number | string, done) => {
  //   try {
  //     const user = await User.findByPk(id, { attributes: { exclude: ["password"] } });
  //     done(null, user || false);
  //   } catch (err) {
  //     done(err, false);
  //   }
  // });
};
