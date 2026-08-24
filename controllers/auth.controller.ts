import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
// import { User } from "../models/index.js";
// import { signToken } from "../middlewares/jwt.js";
import User from "../models/User.js";
// import Lab from "../models/Lab.js";
// import Plan from "../models/Plan.js";
import { signToken } from "../middlewares/jwt.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Register a new user
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, mobileNumber, password, role } = req.body;

    if (!email || !password || !mobileNumber) {
      res.status(400).json({ success: false, message: "Email, mobile number, and password are required" });
      return;
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      res.status(400).json({ success: false, message: "User already exists with this email" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      mobileNumber,
      password: hashedPassword,
      role: role || 'user',
    });

    const token = signToken({ id: user.id, role: user.role, email: user.email });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: user.id,
        email: user.email,
        mobileNumber: user.mobileNumber,
        role: user.role,
        // labId: user.labId,
      },
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

/**
 * Login user
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: "Email and password are required" });
      return;
    }

    const user = await User.findOne({ where: { email } });
    console.log('Login attempt for:', email);
    if (!user) {
      console.log('User not found in DB');
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    if (user.isBlocked) {
      res.status(403).json({ success: false, message: "Your account is blocked. Please contact support." });
      return;
    }

    if (!user.password) {
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('Password valid:', isPasswordValid);
    if (!isPasswordValid) {
      console.log('Bcrypt comparison failed');
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    const token = signToken({ id: user.id, role: user.role, email: user.email });

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        mobileNumber: user.mobileNumber,
        role: user.role,
        // labId: user.labId,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

/**
 * Google Login
 */
export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      res.status(400).json({ success: false, message: "ID Token is required" });
      return;
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID || "",
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(400).json({ success: false, message: "Invalid Google token" });
      return;
    }

    const { email, sub: googleId } = payload;

    let user = await User.findOne({ where: { email } });

    if (!user) {
      user = await User.create({
        email,
        mobileNumber: `G-${googleId.slice(0, 10)}`, // Placeholder mobile number
        password: await bcrypt.hash(googleId, 10), // Placeholder password
        role: 'user',
      });
    }

    if (user.isBlocked) {
      res.status(403).json({ success: false, message: "Your account is blocked. Please contact support." });
      return;
    }

    const token = signToken({ id: user.id, role: user.role, email: user.email });

    res.json({
      success: true,
      message: "Google login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        mobileNumber: user.mobileNumber,
        role: user.role,
        // labId: user.labId,
      },
    });
  } catch (error: any) {
    console.error("Google Login error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

/**
 * Admin: Get all users
 */
export const getAllUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.findAll({
      where: { role: 'user' },
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Get single user by ID with Lab and Plan
 */
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id as string, {
      attributes: { exclude: ['password'] },

    });

    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    res.json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Update user details
 */
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { email, mobileNumber, role, isBlocked, labName, labPhone, labAddress, planId } = req.body;

    const user = await User.findByPk(id as string);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    await user.update({
      email,
      mobileNumber,
      role,
      ...(isBlocked !== undefined && { isBlocked })
    });



    res.json({ success: true, message: "User and Lab updated successfully", user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Block user
 */
export const blockUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id as string);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    await user.update({ isBlocked: true });
    res.json({ success: true, message: "User blocked successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Unblock user
 */
export const unblockUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id as string);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    await user.update({ isBlocked: false });
    res.json({ success: true, message: "User unblocked successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get current user profile
 */
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    res.json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
