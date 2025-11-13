import createApp from "../../app.js";
import request from "supertest";
import User from "../../models/user.js";
import Category from "../../models/category.js";
import Expense from "../../models/expense.js";
import mongoose from "mongoose";

// Helper function to create a user and return credentials
const createUser = async (email, password = "Password123!", role = "user", name = "Test User") => {
  const passwordHash = await User.hashPassword(password);
  const user = await User.create({ email, name, passwordHash, role });
  return { user, email, password };
};

// Helper function to create an authenticated agent (with session)
const createAuthenticatedAgent = async (app, email, password) => {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password });
  return agent;
};

// Helper function to create a category for testing
const createCategory = async (name, userId) => {
  return await Category.create({ name, user: userId });
};

describe("Admin API - Essential Tests", () => {
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
    await Expense.deleteMany({});
    await Category.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.db.collection("sessions").deleteMany({});
  });

  // Authentication and Authorization Tests
  test("should require authentication for admin endpoints", async () => {
    const endpoints = [
      { method: "get", path: "/api/admin/users" },
      { method: "get", path: "/api/admin/expenses" },
      { method: "post", path: "/api/admin/expenses" },
      { method: "get", path: "/api/admin/categories" },
      { method: "get", path: "/api/admin/report" }
    ];

    for (const endpoint of endpoints) {
      const response = await request(app)[endpoint.method](endpoint.path).send({});
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
    }
  });

  test("should require admin role for admin endpoints", async () => {
    const { user, email, password } = await createUser("user@example.com", "Password123!", "user");
    const userAgent = await createAuthenticatedAgent(app, email, password);

    const endpoints = [
      { method: "get", path: "/api/admin/users" },
      { method: "get", path: "/api/admin/expenses" },
      { method: "post", path: "/api/admin/expenses" },
      { method: "get", path: "/api/admin/categories" }
    ];

    for (const endpoint of endpoints) {
      const response = await userAgent[endpoint.method](endpoint.path).send({});
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty("error", "Forbidden: Insufficient permissions");
    }
  });

  // Admin User Management
  test("should list all users for admin", async () => {
    const admin = await createUser("admin@example.com", "Password123!", "admin");
    const user = await createUser("user@example.com", "Password123!", "user");
    const adminAgent = await createAuthenticatedAgent(app, admin.email, admin.password);

    const response = await adminAgent.get("/api/admin/users");
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body.some(u => u.email === "admin@example.com")).toBe(true);
    expect(response.body.some(u => u.email === "user@example.com")).toBe(true);
  });

  // Admin Expense Management
  test("should manage expenses across all users", async () => {
    const admin = await createUser("admin@example.com", "Password123!", "admin");
    const user = await createUser("user@example.com", "Password123!", "user");
    const category = await createCategory("Food", user.user._id);
    const adminAgent = await createAuthenticatedAgent(app, admin.email, admin.password);

    // Admin creates expense for any user
    const createResponse = await adminAgent.post("/api/admin/expenses").send({
      userId: user.user._id,
      categoryId: category._id,
      amount: 25.50,
      currency: "EUR",
      note: "Admin created expense"
    });
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.expense.amount).toBe(25.50);
    const expenseId = createResponse.body.expense.id;

    // Admin can view all expenses
    const listResponse = await adminAgent.get("/api/admin/expenses");
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(1);

    // Admin can update any expense
    const updateResponse = await adminAgent.put(`/api/admin/expenses/${expenseId}`).send({
      userId: user.user._id,
      categoryId: category._id,
      amount: 30.00,
      note: "Updated by admin"
    });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.expense.amount).toBe(30.00);

    // Admin can delete any expense
    const deleteResponse = await adminAgent.delete(`/api/admin/expenses/${expenseId}`);
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toHaveProperty("message", "Expense deleted successfully (admin)");
  });

  // Admin Category Management
  test("should manage categories for all users", async () => {
    const admin = await createUser("admin@example.com", "Password123!", "admin");
    const user = await createUser("user@example.com", "Password123!", "user");
    const adminAgent = await createAuthenticatedAgent(app, admin.email, admin.password);

    // Admin creates category for user
    const createResponse = await adminAgent.post("/api/admin/categories").send({
      name: "Admin Category",
      userId: user.user._id
    });
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.category.name).toBe("Admin Category");
    const categoryId = createResponse.body.category.id;

    // Admin can view all categories
    const listResponse = await adminAgent.get("/api/admin/categories");
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(1);

    // Admin can delete categories
    const deleteResponse = await adminAgent.delete(`/api/admin/categories/${categoryId}`);
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toHaveProperty("message", "Category deleted successfully");
  });

  // Validation Tests
  test("should validate admin expense creation", async () => {
    const admin = await createUser("admin@example.com", "Password123!", "admin");
    const adminAgent = await createAuthenticatedAgent(app, admin.email, admin.password);

    // Test missing required fields
    const response = await adminAgent.post("/api/admin/expenses").send({
      amount: 25.50
      // Missing userId, categoryId, note
    });
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
  });

  // Admin Reports
  test("should generate admin reports", async () => {
    const admin = await createUser("admin@example.com", "Password123!", "admin");
    const adminAgent = await createAuthenticatedAgent(app, admin.email, admin.password);

    const response = await adminAgent.get("/api/admin/dashboard");
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("dashboard");
    expect(response.body.dashboard).toHaveProperty("summary");
    expect(response.body.dashboard.summary).toHaveProperty("overallStats");
    expect(response.body.dashboard.summary.overallStats).toHaveProperty("totalUsers");
    expect(response.body.dashboard.summary.overallStats).toHaveProperty("totalExpenses");
  });
});
