import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Student from "../models/Student.js";
import Referrer from "../models/Referrer.js";


import type { UserRole } from "../models/User.js";

type Role = UserRole | 'REFERRER';

interface JWTPayload {
  id: number;
  role: UserRole | 'REFERRER';
  email: string;
  iat?: number;
  exp?: number;
}

export const authenticateJWT: RequestHandler = async (req, res, next) => {
  try {
    const header = req.header("Authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) return res.status(401).json({ message: "Access denied. No token provided." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    if (decoded.role === 'STUDENT') {
      const student = await Student.findByPk(decoded.student_id || decoded.id, {
        attributes: ["id", "roll_number", "full_name", "phone_number", "is_active"],
        raw: true,
      });

      if (!student) return res.status(401).json({ message: "Student not found or invalid token." });
      if (student.is_active === false) {
        return res.status(403).json({ message: "Your student account is inactive. Please contact institute administration." });
      }

      const studentUser = {
        id: student.id,
        userId: student.id,
        studentId: student.id,
        student_id: student.id,
        role: 'STUDENT' as Role,
        name: student.full_name,
      };

      (req as any).user = studentUser;
      (req as any).student = student;

      return next();
    }

    if (decoded.role === 'REFERRER') {
      const referrer = await Referrer.findByPk(decoded.referrer_id || decoded.id, {
        attributes: ["id", "name", "mobile_number", "email", "relation_or_role", "is_active"],
        raw: true,
      });

      if (!referrer) return res.status(401).json({ message: "Referrer not found or invalid token." });
      if (referrer.is_active === false) {
        return res.status(403).json({ message: "Your referrer account is inactive. Please contact institute administration." });
      }

      const referrerUser = {
        id: referrer.id,
        userId: referrer.id,
        referrerId: referrer.id,
        referrer_id: referrer.id,
        role: 'REFERRER' as Role,
        name: referrer.name,
      };

      (req as any).user = referrerUser;
      (req as any).referrer = referrer;

      return next();
    }

    const authUser = await User.findByPk(decoded.id, {
      attributes: ["id", "role", "isBlocked", "is_active"],
      raw: true,
    });

    if (!authUser) return res.status(401).json({ message: "Invalid token." });

    if (authUser.isBlocked || authUser.is_active === false) {
      return res.status(403).json({ message: "Your account is blocked or inactive. Please contact support." });
    }

    (req as any).user = {
      id: authUser.id,
      userId: authUser.id,
      role: authUser.role as Role,
    };

    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token." });
  }
};

/** Generic role guard — use after authenticateJWT */
export const requireRole =
  (...allowed: Role[]): RequestHandler =>
    (req, res, next) => {
      const user = (req as any).user as { role?: Role } | undefined;
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      if (!user.role || !allowed.includes(user.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      next();
    };

/** Optional authentication - does not block if no token, but sets req.user if present */
export const optionalAuthenticateJWT: RequestHandler = async (req, res, next) => {
  try {
    const header = req.header("Authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    if (decoded.role === 'STUDENT') {
      const student = await Student.findByPk(decoded.student_id || decoded.id, {
        attributes: ["id", "roll_number", "full_name", "phone_number", "is_active"],
        raw: true,
      });
      if (student && student.is_active !== false) {
        const studentUser = {
          id: student.id,
          userId: student.id,
          studentId: student.id,
          student_id: student.id,
          role: 'STUDENT' as Role,
          name: student.full_name,
        };
        (req as any).user = studentUser;
        (req as any).student = student;
      }
      return next();
    }

    const authUser = await User.findByPk(decoded.id, {
      attributes: ["id", "role", "isBlocked", "is_active"],
      raw: true,
    });

    if (authUser && !authUser.isBlocked && authUser.is_active !== false) {
      (req as any).user = {
        userId: authUser.id,
        role: authUser.role as Role,
      };
    }
  } catch (err) {
    // Ignore invalid tokens for optional auth
  }
  next();
};

/** Convenience guards */
export const adminProtected: RequestHandler[] = [authenticateJWT, requireRole("SUPER_ADMIN", "admin")];
export const teacherProtected: RequestHandler[] = [authenticateJWT, requireRole("SUPER_ADMIN", "TEACHER", "admin")];
export const staffProtected: RequestHandler[] = [authenticateJWT, requireRole("SUPER_ADMIN", "TEACHER", "SCAN_OPERATOR", "admin", "user")];
export const userProtected: RequestHandler[] = [authenticateJWT, requireRole("SUPER_ADMIN", "TEACHER", "SCAN_OPERATOR", "admin", "user")];
export const studentProtected: RequestHandler[] = [authenticateJWT, requireRole("STUDENT", "SUPER_ADMIN", "admin")];
export const referrerProtected: RequestHandler[] = [authenticateJWT, requireRole("REFERRER" as any, "SUPER_ADMIN", "admin")];
