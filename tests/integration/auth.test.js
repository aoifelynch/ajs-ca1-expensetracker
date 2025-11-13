import createApp from "../../app.js";
import request from "supertest";
import User from "../../models/user.js";
import mongoose from "mongoose";

describe("Auth API", () => {
  let app;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    app = createApp();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  afterEach(async () => {
    await User.deleteMany({});
    await mongoose.connection.db.collection("sessions").deleteMany({});
  });

  describe("POST /api/auth/register", () => {
    test("should register a new user with valid credentials", async () => {
      const response = await request(app).post("/api/auth/register").send({
        email: "newuser@example.com",
        name: "New User",
        password: "SecurePass123",
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty(
        "message",
        "User created successfully"
      );
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("email", "newuser@example.com");
      expect(response.body.user).toHaveProperty("role", "user");
      expect(response.body.user).not.toHaveProperty("passwordHash");
    });

    test("should not register user with duplicate email", async () => {
      // Create first user
      await request(app).post("/api/auth/register").send({
        email: "duplicate@example.com",
        name: "First User",
        password: "Password123",
      });

      // Try to create duplicate
      const response = await request(app).post("/api/auth/register").send({
        email: "duplicate@example.com",
        name: "Second User",
        password: "DifferentPass456",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Email already exists");
    });

    test("should reject registration with invalid email", async () => {
      const response = await request(app).post("/api/auth/register").send({
        email: "not-an-email",
        password: "Password123",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    test("should reject registration with weak password", async () => {
      const response = await request(app).post("/api/auth/register").send({
        email: "weakpass@example.com",
        name: "Weak Pass User",
        password: "weak",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("password");
    });

    test("should reject registration without uppercase in password", async () => {
      const response = await request(app).post("/api/auth/register").send({
        email: "test@example.com",
        password: "alllowercase123",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    test("should reject registration without number in password", async () => {
      const response = await request(app).post("/api/auth/register").send({
        email: "test@example.com",
        password: "NoNumbersHere",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    test("should reject registration with missing fields", async () => {
      const response = await request(app).post("/api/auth/register").send({
        email: "test@example.com",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    test("should set session cookie upon successful registration", async () => {
      const response = await request(app).post("/api/auth/register").send({
        email: "sessiontest@example.com",
        name: "Session User",
        password: "SecurePass123",
      });

      expect(response.status).toBe(201);
      expect(response.headers["set-cookie"]).toBeDefined();
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      // Create a test user before each login test
      await request(app).post("/api/auth/register").send({
        email: "logintest@example.com",
        name: "Login Test User",
        password: "TestPass123",
      });
    });

    test("should login with correct credentials", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: "logintest@example.com",
        password: "TestPass123",
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message", "Login successful");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty(
        "email",
        "logintest@example.com"
      );
      expect(response.body.user).not.toHaveProperty("passwordHash");
      expect(response.headers["set-cookie"]).toBeDefined();
    });

    test("should reject login with incorrect password", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: "logintest@example.com",
        password: "WrongPassword123",
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Invalid credentials");
    });

    test("should reject login with non-existent email", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: "nonexistent@example.com",
        password: "SomePassword123",
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Invalid credentials");
    });

    test("should reject login with missing fields", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: "logintest@example.com",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    test("should reject login with invalid email format", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: "not-an-email",
        password: "TestPass123",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("POST /api/auth/logout", () => {
    test("should logout and clear session cookie", async () => {
      // Register and login
      await request(app).post("/api/auth/register").send({
        email: "logouttest@example.com",
        password: "TestPass123",
      });

      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({
        email: "logouttest@example.com",
        password: "TestPass123",
      });

      // Logout
      const response = await agent.post("/api/auth/logout");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message", "Logout successful");
    });

    test("should allow logout even without session", async () => {
      const response = await request(app).post("/api/auth/logout");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message", "Logout successful");
    });
  });

  describe("GET /api/auth/me", () => {
    test("should return user info when authenticated", async () => {
      // Register and login
      await request(app).post("/api/auth/register").send({
        email: "metest@example.com",
        name: "Me Test User",
        password: "TestPass123",
      });

      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({
        email: "metest@example.com",
        password: "TestPass123",
      });

      // Check auth status
      const response = await agent.get("/api/auth/me");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("authenticated", true);
      expect(response.body.data).toHaveProperty("user");
      expect(response.body.data.user).toHaveProperty("email", "metest@example.com");
    });

    test("should return unauthenticated when no session", async () => {
      const response = await request(app).get("/api/auth/me");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toHaveProperty("authenticated", false);
    });

    test("should return unauthenticated after logout", async () => {
      // Register and login
      await request(app).post("/api/auth/register").send({
        email: "afterlogout@example.com",
        password: "TestPass123",
      });

      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({
        email: "afterlogout@example.com",
        password: "TestPass123",
      });

      // Logout
      await agent.post("/api/auth/logout");

      // Check auth status
      const response = await agent.get("/api/auth/me");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toHaveProperty("authenticated", false);
    });
  });

  describe("Session persistence", () => {
    test("should maintain session across multiple requests", async () => {
      // Register
      await request(app).post("/api/auth/register").send({
        email: "session@example.com",
        name: "Session User",
        password: "TestPass123",
      });

      // Login with agent
      const agent = request.agent(app);
      const loginResponse = await agent.post("/api/auth/login").send({
        email: "session@example.com",
        password: "TestPass123",
      });

      expect(loginResponse.status).toBe(200);

      // Make another request with same agent
      const meResponse = await agent.get("/api/auth/me");

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.success).toBe(true);
      expect(meResponse.body.data).toHaveProperty("authenticated", true);
    });
  });

  describe("PUT /api/auth/profile", () => {
    let agent;

    beforeEach(async () => {
      // Register and login for each profile test
      await request(app).post("/api/auth/register").send({
        email: "profile@example.com",
        password: "TestPass123",
        name: "Test User"
      });

      agent = request.agent(app);
      await agent.post("/api/auth/login").send({
        email: "profile@example.com",
        password: "TestPass123",
      });
    });

    test("should update user name", async () => {
      const response = await agent.put("/api/auth/profile").send({
        name: "Updated Name"
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message", "Profile updated successfully");
      expect(response.body.user).toHaveProperty("name", "Updated Name");
      expect(response.body.user).toHaveProperty("email", "profile@example.com");
    });

    test("should update user email", async () => {
      const response = await agent.put("/api/auth/profile").send({
        email: "newemail@example.com"
      });

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty("email", "newemail@example.com");
    });

    test("should prevent email update to existing email", async () => {
      // Create another user first
      await request(app).post("/api/auth/register").send({
        email: "existing@example.com",
        name: "Existing User",
        password: "TestPass123"
      });

      const response = await agent.put("/api/auth/profile").send({
        email: "existing@example.com"
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Email already exists");
    });

    test("should update password with current password", async () => {
      const response = await agent.put("/api/auth/profile").send({
        currentPassword: "TestPass123",
        newPassword: "NewSecurePass456"
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message", "Profile updated successfully");
      
      // Verify new password works
      await agent.post("/api/auth/logout");
      const loginResponse = await agent.post("/api/auth/login").send({
        email: "profile@example.com",
        password: "NewSecurePass456",
      });

      expect(loginResponse.status).toBe(200);
    });

    test("should reject password update without current password", async () => {
      const response = await agent.put("/api/auth/profile").send({
        newPassword: "NewSecurePass456"
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Current password is required to change password");
    });

    test("should reject password update with incorrect current password", async () => {
      const response = await agent.put("/api/auth/profile").send({
        currentPassword: "WrongPassword",
        newPassword: "NewSecurePass456"
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Current password is incorrect");
    });

    test("should update multiple fields at once", async () => {
      const response = await agent.put("/api/auth/profile").send({
        name: "New Name",
        email: "updated@example.com",
        currentPassword: "TestPass123",
        newPassword: "UpdatedPass456"
      });

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty("name", "New Name");
      expect(response.body.user).toHaveProperty("email", "updated@example.com");
    });

    test("should require authentication", async () => {
      const response = await request(app).put("/api/auth/profile").send({
        name: "New Name"
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Authentication required");
    });

    test("should validate input data", async () => {
      const response = await agent.put("/api/auth/profile").send({
        email: "invalid-email"
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("DELETE /api/auth/profile", () => {
    let agent, user;

    beforeEach(async () => {
      // Register and login for each delete test
      const registerResponse = await request(app).post("/api/auth/register").send({
        email: "deletetest@example.com",
        password: "TestPass123",
        name: "Delete Test User"
      });
      user = registerResponse.body.user;

      agent = request.agent(app);
      await agent.post("/api/auth/login").send({
        email: "deletetest@example.com",
        password: "TestPass123",
      });
    });

    test("should delete user account with correct password", async () => {
      const response = await agent.delete("/api/auth/profile").send({
        password: "TestPass123"
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message", "Account deleted successfully");
      
      // Verify user cannot login anymore
      const loginResponse = await request(app).post("/api/auth/login").send({
        email: "deletetest@example.com",
        password: "TestPass123",
      });

      expect(loginResponse.status).toBe(401);
      expect(loginResponse.body).toHaveProperty("error", "Invalid credentials");
    });

    test("should require password confirmation", async () => {
      const response = await agent.delete("/api/auth/profile").send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "'password' field is required");
    });

    test("should reject incorrect password", async () => {
      const response = await agent.delete("/api/auth/profile").send({
        password: "WrongPassword123"
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Invalid password");
    });

    test("should require authentication", async () => {
      const response = await request(app).delete("/api/auth/profile").send({
        password: "TestPass123"
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Authentication required");
    });

    test("should delete user's expenses and categories", async () => {
      // Import models to create test data
      const Category = (await import("../../models/category.js")).default;
      const Expense = (await import("../../models/expense.js")).default;

      // Create category and expense for the user
      const category = await Category.create({ name: "Test Category", user: user.id });
      await Expense.create({
        user: user.id,
        category: category._id,
        amount: 25.50,
        currency: "EUR",
        note: "Test expense"
      });

      // Verify data exists before deletion
      const expensesBefore = await Expense.find({ user: user.id });
      const categoriesBefore = await Category.find({ user: user.id });
      expect(expensesBefore).toHaveLength(1);
      expect(categoriesBefore).toHaveLength(1);

      // Delete account
      const response = await agent.delete("/api/auth/profile").send({
        password: "TestPass123"
      });

      expect(response.status).toBe(200);

      // Verify all user data is deleted
      const expensesAfter = await Expense.find({ user: user.id });
      const categoriesAfter = await Category.find({ user: user.id });
      expect(expensesAfter).toHaveLength(0);
      expect(categoriesAfter).toHaveLength(0);
    });

    test("should clear session after account deletion", async () => {
      const deleteResponse = await agent.delete("/api/auth/profile").send({
        password: "TestPass123"
      });

      expect(deleteResponse.status).toBe(200);

      // Try to access protected endpoint with same agent
      const meResponse = await agent.get("/api/auth/me");
      expect(meResponse.status).toBe(401);
      expect(meResponse.body.success).toBe(false);
      expect(meResponse.body.data).toHaveProperty("authenticated", false);
    });
  });
});
