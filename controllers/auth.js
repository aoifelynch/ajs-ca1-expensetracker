import express from "express";
import User from "../models/user.js";
import Expense from "../models/expense.js";
import Category from "../models/category.js";
import {
  HttpError,
  BAD_REQUEST,
  UNAUTHORIZED,
  INTERNAL_SERVER_ERROR,
} from "../utils/HttpError.js";
import { registerSchema, loginSchema, updateProfileSchema, deleteAccountSchema } from "../utils/validators.js";
import { validate } from "../middleware/validateRequest.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// User registration
router.post("/register", validate(registerSchema), async (req, res) => {
  const { email, password, name } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new HttpError(BAD_REQUEST, "Email already exists");
  }

  // Hash password and create user
  const passwordHash = await User.hashPassword(password);
  const user = await User.create({
    email,
    name,
    passwordHash,
  });

  // Set session
  req.session.userId = user._id.toString();

  res.status(201).json({
    message: "User created successfully",
    user,
  });
});

// User login
router.post("/login", validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  // Find user by email
  const user = await User.findOne({ email });
  if (!user) {
    throw new HttpError(UNAUTHORIZED, "Invalid credentials");
  }

  // Verify password
  const passwordCorrect = await user.verifyPassword(password);
  if (!passwordCorrect) {
    throw new HttpError(UNAUTHORIZED, "Invalid credentials");
  }

  // Set session
  req.session.userId = user._id.toString();

  res.status(200).json({
    message: "Login successful",
    user,
  });
});

// Logout endpoint
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      throw new HttpError(INTERNAL_SERVER_ERROR, "Could not log out");
    }
    res.clearCookie("sessionId"); 
    res.status(200).json({ message: "Logout successful" });
  });
});

// Check authentication status
router.get("/me", async (req, res) => {
  if (req.session && req.session.userId) {
    const user = await User.findById(req.session.userId);
    if (user) {
      res.status(200).json({
        success: true,
        data: { authenticated: true, user },
        message: "User authenticated"
      });
    } else {
      res.status(401).json({ 
        success: false,
        data: { authenticated: false },
        message: "User not found"
      });
    }
  } else {
    res.status(401).json({ 
      success: false,
      data: { authenticated: false },
      message: "Not authenticated"
    });
  }
});

// Update user profile
router.put("/profile", requireAuth, validate(updateProfileSchema), async (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body;
  const userId = req.user._id;

  // Find the user
  const user = await User.findById(userId);
  if (!user) {
    throw new HttpError(UNAUTHORIZED, "User not found");
  }

  const updates = {};

  // Update name if provided
  if (name !== undefined) {
    updates.name = name;
  }

  // Update email if provided
  if (email !== undefined) {
    // Check if email is already taken by another user
    const existingUser = await User.findOne({ email, _id: { $ne: userId } });
    if (existingUser) {
      throw new HttpError(BAD_REQUEST, "Email already exists");
    }
    updates.email = email;
  }

  // Update password if provided
  if (newPassword !== undefined) {
    if (!currentPassword) {
      throw new HttpError(BAD_REQUEST, "Current password is required to change password");
    }

    // Verify current password
    const passwordCorrect = await user.verifyPassword(currentPassword);
    if (!passwordCorrect) {
      throw new HttpError(UNAUTHORIZED, "Current password is incorrect");
    }

    // Hash new password
    updates.passwordHash = await User.hashPassword(newPassword);
  }

  // Update user
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    updates,
    { new: true, runValidators: true }
  );

  res.status(200).json({
    message: "Profile updated successfully",
    user: updatedUser
  });
});

// Delete user account
router.delete("/profile", requireAuth, validate(deleteAccountSchema), async (req, res) => {
  const { password } = req.body;
  const userId = req.user._id;

  // Find the user
  const user = await User.findById(userId);
  if (!user) {
    throw new HttpError(UNAUTHORIZED, "User not found");
  }

  // Verify password
  const passwordCorrect = await user.verifyPassword(password);
  if (!passwordCorrect) {
    throw new HttpError(UNAUTHORIZED, "Invalid password");
  }

  // Delete user's expenses and categories (cascade delete)
  await Promise.all([
    User.findByIdAndDelete(userId),
    Expense.deleteMany({ user: userId }),
    Category.deleteMany({ user: userId })
  ]);

  // Clear session
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
    }
  });

  res.status(200).json({
    message: "Account deleted successfully"
  });
});

export default router;
