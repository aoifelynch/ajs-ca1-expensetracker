import User from "../../../models/user.js";
import mongoose from "mongoose";

describe("User Model", () => {
  describe("Schema validation", () => {
    test("should create user with valid data", () => {
      const userData = {
        email: "test@example.com",
        name: "Test User",
        passwordHash: "hashedpassword123",
      };

      const user = new User(userData);
      const error = user.validateSync();

      expect(error).toBeUndefined();
      expect(user.email).toBe("test@example.com");
      expect(user.name).toBe("Test User");
      expect(user.role).toBe("user"); // default role
    });

    test("should require email", () => {
      const userData = {
        name: "Test User",
        passwordHash: "hashedpassword123",
      };

      const user = new User(userData);
      const error = user.validateSync();

      expect(error).toBeDefined();
      expect(error.errors.email).toBeDefined();
      expect(error.errors.email.message).toContain("required");
    });

    test("should require name", () => {
      const userData = {
        email: "test@example.com",
        passwordHash: "hashedpassword123",
      };

      const user = new User(userData);
      const error = user.validateSync();

      expect(error).toBeDefined();
      expect(error.errors.name).toBeDefined();
      expect(error.errors.name.message).toContain("required");
    });

    test("should require passwordHash", () => {
      const userData = {
        email: "test@example.com",
        name: "Test User",
      };

      const user = new User(userData);
      const error = user.validateSync();

      expect(error).toBeDefined();
      expect(error.errors.passwordHash).toBeDefined();
      expect(error.errors.passwordHash.message).toContain("required");
    });

    test("should accept valid role values", () => {
      const userData = {
        email: "admin@example.com",
        name: "Admin User",
        passwordHash: "hashedpassword123",
        role: "admin",
      };

      const user = new User(userData);
      const error = user.validateSync();

      expect(error).toBeUndefined();
      expect(user.role).toBe("admin");
    });

    test("should reject invalid role values", () => {
      const userData = {
        email: "test@example.com",
        name: "Test User",
        passwordHash: "hashedpassword123",
        role: "superuser", // invalid role
      };

      const user = new User(userData);
      const error = user.validateSync();

      expect(error).toBeDefined();
      expect(error.errors.role).toBeDefined();
      expect(error.errors.role.message).toContain("not a valid enum value");
    });

    test("should default role to 'user'", () => {
      const userData = {
        email: "test@example.com",
        name: "Test User",
        passwordHash: "hashedpassword123",
      };

      const user = new User(userData);
      expect(user.role).toBe("user");
    });
  });

  describe("JSON transformation", () => {
    test("should remove sensitive fields from JSON output", () => {
      const userData = {
        email: "test@example.com",
        name: "Test User",
        passwordHash: "hashedpassword123",
        role: "user",
      };

      const user = new User(userData);
      const json = user.toJSON();

      expect(json).toHaveProperty("email", "test@example.com");
      expect(json).toHaveProperty("name", "Test User");
      expect(json).toHaveProperty("role", "user");
      expect(json).toHaveProperty("id");
      
      // Should not contain sensitive/internal fields
      expect(json).not.toHaveProperty("passwordHash");
      expect(json).not.toHaveProperty("_id");
      expect(json).not.toHaveProperty("__v");
      expect(json).not.toHaveProperty("createdAt");
      expect(json).not.toHaveProperty("updatedAt");
    });

    test("should convert _id to id string", () => {
      const userData = {
        email: "test@example.com",
        name: "Test User",
        passwordHash: "hashedpassword123",
      };

      const user = new User(userData);
      user._id = new mongoose.Types.ObjectId();
      const json = user.toJSON();

      expect(json.id).toBe(user._id.toString());
      expect(typeof json.id).toBe("string");
    });
  });

  describe("hashPassword static method", () => {
    test("should hash a password", async () => {
      const password = "MyPassword123";
      const hash = await User.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(typeof hash).toBe("string");
      expect(hash.length).toBeGreaterThan(0);
    });

    test("should generate different hashes for the same password", async () => {
      const password = "MyPassword123";
      const hash1 = await User.hashPassword(password);
      const hash2 = await User.hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    test("should hash different passwords differently", async () => {
      const password1 = "MyPassword123";
      const password2 = "DifferentPassword456";
      const hash1 = await User.hashPassword(password1);
      const hash2 = await User.hashPassword(password2);

      expect(hash1).not.toBe(hash2);
    });

    test("should produce bcrypt-compatible hash", async () => {
      const password = "TestPassword123";
      const hash = await User.hashPassword(password);

      expect(hash).toMatch(/^\$2b\$/);
      expect(hash.length).toBe(60);
    });

    test("should handle special characters in password", async () => {
      const password = "P@ssw0rd!#$%^&*()";
      const hash = await User.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(typeof hash).toBe("string");
    });

    test("should handle empty string", async () => {
      const password = "";
      const hash = await User.hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
    });
  });

  describe("verifyPassword instance method", () => {
    test("should verify correct password", async () => {
      const password = "MyPassword123";
      const passwordHash = await User.hashPassword(password);

      const user = new User({
        email: "test@example.com",
        name: "Test User",
        passwordHash,
      });

      const isValid = await user.verifyPassword(password);
      expect(isValid).toBe(true);
    });

    test("should reject incorrect password", async () => {
      const correctPassword = "MyPassword123";
      const incorrectPassword = "WrongPassword456";
      const passwordHash = await User.hashPassword(correctPassword);

      const user = new User({
        email: "test@example.com",
        name: "Test User",
        passwordHash,
      });

      const isValid = await user.verifyPassword(incorrectPassword);
      expect(isValid).toBe(false);
    });

    test("should reject empty password", async () => {
      const password = "MyPassword123";
      const passwordHash = await User.hashPassword(password);

      const user = new User({
        email: "test@example.com",
        name: "Test User",
        passwordHash,
      });

      const isValid = await user.verifyPassword("");
      expect(isValid).toBe(false);
    });

    test("should reject null password", async () => {
      const password = "MyPassword123";
      const passwordHash = await User.hashPassword(password);

      const user = new User({
        email: "test@example.com",
        name: "Test User",
        passwordHash,
      });

      const isValid = await user.verifyPassword(null);
      expect(isValid).toBe(false);
    });

    test("should reject undefined password", async () => {
      const password = "MyPassword123";
      const passwordHash = await User.hashPassword(password);

      const user = new User({
        email: "test@example.com",
        name: "Test User",
        passwordHash,
      });

      const isValid = await user.verifyPassword(undefined);
      expect(isValid).toBe(false);
    });

    test("should handle special characters in verification", async () => {
      const password = "P@ssw0rd!#$%^&*()";
      const passwordHash = await User.hashPassword(password);

      const user = new User({
        email: "test@example.com",
        name: "Test User",
        passwordHash,
      });

      const isValid = await user.verifyPassword(password);
      expect(isValid).toBe(true);
    });

    test("should be case sensitive", async () => {
      const password = "MyPassword123";
      const wrongCase = "mypassword123";
      const passwordHash = await User.hashPassword(password);

      const user = new User({
        email: "test@example.com",
        name: "Test User",
        passwordHash,
      });

      const isValid = await user.verifyPassword(wrongCase);
      expect(isValid).toBe(false);
    });
  });
});
