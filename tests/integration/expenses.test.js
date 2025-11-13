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

describe("Expense API - Essential Tests", () => {
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

  // Essential CRUD Operations Test
  test("should handle complete expense lifecycle", async () => {
    const { user, email, password } = await createUser("test@example.com", "Password123");
    const agent = await createAuthenticatedAgent(app, email, password);
    const category = await createCategory("Food", user._id);

    // Create expense
    const createResponse = await agent.post("/api/expenses").send({
      categoryId: category._id,
      amount: 25.50,
      currency: "EUR",
      note: "Lunch expense"
    });
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.amount).toBe(25.50);
    expect(createResponse.body.data.note).toBe("Lunch expense");
    const expenseId = createResponse.body.data.id;

    // Read expenses
    const readResponse = await agent.get("/api/expenses");
    expect(readResponse.status).toBe(200);
    expect(readResponse.body.success).toBe(true);
    expect(readResponse.body.data).toHaveLength(1);
    expect(readResponse.body.data[0].amount).toBe(25.50);

    // Update expense
    const updateResponse = await agent.put(`/api/expenses/${expenseId}`).send({
      categoryId: category._id,
      amount: 30.00,
      note: "Updated lunch expense"
    });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.success).toBe(true);
    expect(updateResponse.body.data.amount).toBe(30.00);
    expect(updateResponse.body.data.amount).toBe(30.00);

    // Delete expense
    const deleteResponse = await agent.delete(`/api/expenses/${expenseId}`);
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toHaveProperty("message", "Expense deleted successfully");

    // Verify deletion
    const verifyResponse = await agent.get("/api/expenses");
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.success).toBe(true);
    expect(verifyResponse.body.data).toHaveLength(0);
  });

  // Authentication Requirements Test
  test("should require authentication for all expense operations", async () => {
    const endpoints = [
      { method: "get", path: "/api/expenses" },
      { method: "post", path: "/api/expenses" },
      { method: "put", path: "/api/expenses/123" },
      { method: "delete", path: "/api/expenses/123" }
    ];

    for (const endpoint of endpoints) {
      const response = await request(app)[endpoint.method](endpoint.path).send({});
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
    }
  });

  // User Isolation Test
  test("should isolate expenses between different users", async () => {
    const user1 = await createUser("user1@example.com", "Password123");
    const user2 = await createUser("user2@example.com", "Password123");
    const agent1 = await createAuthenticatedAgent(app, user1.email, user1.password);
    const agent2 = await createAuthenticatedAgent(app, user2.email, user2.password);

    const category1 = await createCategory("Food", user1.user._id);
    const category2 = await createCategory("Transport", user2.user._id);

    // Each user creates an expense
    await agent1.post("/api/expenses").send({
      categoryId: category1._id,
      amount: 25.50,
      currency: "EUR",
      note: "User 1 expense"
    });
    
    await agent2.post("/api/expenses").send({
      categoryId: category2._id,
      amount: 15.00,
      currency: "EUR",
      note: "User 2 expense"
    });

    // User 1 can only see their own expense
    const user1Response = await agent1.get("/api/expenses");
    expect(user1Response.status).toBe(200);
    expect(user1Response.body.success).toBe(true);
    expect(user1Response.body.data).toHaveLength(1);
    expect(user1Response.body.data[0].note).toBe("User 1 expense");

    // User 2 can only see their own expense
    const user2Response = await agent2.get("/api/expenses");
    expect(user2Response.status).toBe(200);
    expect(user2Response.body.success).toBe(true);
    expect(user2Response.body.data).toHaveLength(1);
    expect(user2Response.body.data[0].note).toBe("User 2 expense");
  });

  // Validation Test
  test("should validate expense input", async () => {
    const { user, email, password } = await createUser("test@example.com", "Password123");
    const agent = await createAuthenticatedAgent(app, email, password);

    // Test missing required fields
    const missingFieldsResponse = await agent.post("/api/expenses").send({
      amount: 25.50
      // Missing categoryId and note
    });
    expect(missingFieldsResponse.status).toBe(400);
    expect(missingFieldsResponse.body).toHaveProperty("error");

    // Test invalid amount
    const category = await createCategory("Food", user._id);
    const invalidAmountResponse = await agent.post("/api/expenses").send({
      categoryId: category._id,
      amount: -10, // Negative amount
      note: "Invalid expense"
    });
    expect(invalidAmountResponse.status).toBe(400);
    expect(invalidAmountResponse.body).toHaveProperty("error");
  });
});