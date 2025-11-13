// Mock the User model so tests can replace its static methods with jest mocks
jest.mock("../../../models/user.js");

import { requireAuth, requireRole, requireAdmin } from "../../../middleware/auth.js";
import User from "../../../models/user.js";
import mongoose from "mongoose";

describe("Auth Middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("requireAuth", () => {
    test("should call next() and attach user if authenticated", async () => {
      const userId = new mongoose.Types.ObjectId();
      const user = { 
        _id: userId, 
        email: "test@example.com",
        name: "Test User",
        role: "user"
      };
      
      User.findById.mockResolvedValue(user);

      const req = { session: { userId: userId.toString() } };
      const res = {};
      const next = jest.fn();

      await requireAuth(req, res, next);

      expect(User.findById).toHaveBeenCalledWith(userId.toString());
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBe(user);
    });

    test("should throw UNAUTHORIZED if no session", async () => {
      const req = { session: null };
      const res = {};
      const next = jest.fn();
      
      await expect(requireAuth(req, res, next)).rejects.toThrow(
        "Authentication required"
      );
      
      expect(next).not.toHaveBeenCalled();
      expect(User.findById).not.toHaveBeenCalled();
    });

    test("should throw UNAUTHORIZED if no userId in session", async () => {
      const req = { session: {} };
      const res = {};
      const next = jest.fn();
      
      await expect(requireAuth(req, res, next)).rejects.toThrow(
        "Authentication required"
      );
      
      expect(next).not.toHaveBeenCalled();
      expect(User.findById).not.toHaveBeenCalled();
    });

    test("should throw UNAUTHORIZED if user not found in database", async () => {
      const userId = new mongoose.Types.ObjectId();
      User.findById.mockResolvedValue(null);

      const req = { session: { userId: userId.toString() } };
      const res = {};
      const next = jest.fn();

      await expect(requireAuth(req, res, next)).rejects.toThrow(
        "User not found"
      );

      expect(User.findById).toHaveBeenCalledWith(userId.toString());
      expect(next).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    test("should handle database errors gracefully", async () => {
      const userId = new mongoose.Types.ObjectId();
      User.findById.mockRejectedValue(new Error("Database error"));

      const req = { session: { userId: userId.toString() } };
      const res = {};
      const next = jest.fn();

      await expect(requireAuth(req, res, next)).rejects.toThrow(
        "Database error"
      );

      expect(User.findById).toHaveBeenCalledWith(userId.toString());
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("requireRole", () => {
    test("should allow access for user with correct role", async () => {
      const userId = new mongoose.Types.ObjectId();
      const user = { 
        _id: userId, 
        email: "admin@example.com",
        name: "Admin User",
        role: "admin"
      };
      
      User.findById.mockResolvedValue(user);
      const middleware = requireRole("admin");

      const req = { session: { userId: userId.toString() } };
      const res = {};
      const next = jest.fn();

      await middleware(req, res, next);

      expect(User.findById).toHaveBeenCalledWith(userId.toString());
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBe(user);
    });

    test("should allow access for user with one of multiple roles", async () => {
      const userId = new mongoose.Types.ObjectId();
      const user = { 
        _id: userId, 
        email: "user@example.com",
        name: "Regular User",
        role: "user"
      };
      
      User.findById.mockResolvedValue(user);
      const middleware = requireRole("admin", "user");

      const req = { session: { userId: userId.toString() } };
      const res = {};
      const next = jest.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBe(user);
    });

    test("should throw FORBIDDEN for user with incorrect role", async () => {
      const userId = new mongoose.Types.ObjectId();
      const user = { 
        _id: userId, 
        email: "user@example.com",
        name: "Regular User",
        role: "user"
      };
      
      User.findById.mockResolvedValue(user);
      const middleware = requireRole("admin");

      const req = { session: { userId: userId.toString() } };
      const res = {};
      const next = jest.fn();

      await expect(middleware(req, res, next)).rejects.toThrow(
        "Forbidden: Insufficient permissions"
      );

      expect(User.findById).toHaveBeenCalledWith(userId.toString());
      expect(next).not.toHaveBeenCalled();
    });

    test("should throw UNAUTHORIZED if no session", async () => {
      const middleware = requireRole("admin");

      const req = { session: null };
      const res = {};
      const next = jest.fn();
      
      await expect(middleware(req, res, next)).rejects.toThrow(
        "Authentication required"
      );
      
      expect(next).not.toHaveBeenCalled();
      expect(User.findById).not.toHaveBeenCalled();
    });

    test("should throw UNAUTHORIZED if user not found", async () => {
      const userId = new mongoose.Types.ObjectId();
      User.findById.mockResolvedValue(null);
      const middleware = requireRole("admin");

      const req = { session: { userId: userId.toString() } };
      const res = {};
      const next = jest.fn();

      await expect(middleware(req, res, next)).rejects.toThrow(
        "User not found"
      );

      expect(User.findById).toHaveBeenCalledWith(userId.toString());
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("requireAdmin", () => {
    test("should allow access for admin user", async () => {
      const userId = new mongoose.Types.ObjectId();
      const user = { 
        _id: userId, 
        email: "admin@example.com",
        name: "Admin User",
        role: "admin"
      };
      
      User.findById.mockResolvedValue(user);

      const req = { session: { userId: userId.toString() } };
      const res = {};
      const next = jest.fn();

      await requireAdmin(req, res, next);

      expect(User.findById).toHaveBeenCalledWith(userId.toString());
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBe(user);
    });

    test("should reject non-admin user", async () => {
      const userId = new mongoose.Types.ObjectId();
      const user = { 
        _id: userId, 
        email: "user@example.com",
        name: "Regular User",
        role: "user"
      };
      
      User.findById.mockResolvedValue(user);

      const req = { session: { userId: userId.toString() } };
      const res = {};
      const next = jest.fn();

      await expect(requireAdmin(req, res, next)).rejects.toThrow(
        "Forbidden: Insufficient permissions"
      );

      expect(User.findById).toHaveBeenCalledWith(userId.toString());
      expect(next).not.toHaveBeenCalled();
    });

    test("should reject unauthenticated request", async () => {
      const req = { session: null };
      const res = {};
      const next = jest.fn();

      await expect(requireAdmin(req, res, next)).rejects.toThrow(
        "Authentication required"
      );

      expect(next).not.toHaveBeenCalled();
      expect(User.findById).not.toHaveBeenCalled();
    });
  });
});
