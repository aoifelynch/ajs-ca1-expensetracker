import createApp from "../../app.js";
import request from "supertest";
import User from "../../models/user.js";
import Category from "../../models/category.js";
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

describe("Category API - Essential Tests", () => {
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
    await Category.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.db.collection("sessions").deleteMany({});
  });

  // Authentication Test 
  test("should require authentication for category expenses", async () => {
    const response = await request(app).get("/api/categories/123/expenses");
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("error");
  });

  // Basic Category Viewing Test
  test("should list public categories", async () => {
    // First create some categories through admin
    const admin = await createUser("admin@example.com", "Password123!", "admin");
    const user = await createUser("user@example.com", "Password123!", "user");
    const adminAgent = await createAuthenticatedAgent(app, admin.email, admin.password);

    // Admin creates categories
    await adminAgent.post("/api/admin/categories").send({
      name: "Food",
      userId: user.user._id
    });

    // Anyone can view categories (for public stats page)
    const response = await request(app).get("/api/categories");
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].name).toBe("Food");
  });

  // User Isolation Test for Category Expenses
  test("should isolate category expenses between users", async () => {
    const user1 = await createUser("user1@example.com", "Password123!");
    const user2 = await createUser("user2@example.com", "Password123!");
    const admin = await createUser("admin@example.com", "Password123!", "admin");
    const agent1 = await createAuthenticatedAgent(app, user1.email, user1.password);
    const agent2 = await createAuthenticatedAgent(app, user2.email, user2.password);
    const adminAgent = await createAuthenticatedAgent(app, admin.email, admin.password);

    // Admin creates a category
    const categoryResponse = await adminAgent.post("/api/admin/categories").send({
      name: "Food",
      userId: user1.user._id
    });
    const categoryId = categoryResponse.body.category.id;

    // Create expenses for each user in this category
    await agent1.post("/api/expenses").send({
      categoryId: categoryId,
      amount: 25.50,
      currency: "EUR",
      note: "User 1 expense"
    });
    
    await agent2.post("/api/expenses").send({
      categoryId: categoryId,
      amount: 30.00,
      currency: "EUR", 
      note: "User 2 expense"
    });

    // User 1 can only see their own expenses in the category
    const user1Response = await agent1.get(`/api/categories/${categoryId}/expenses`);
    expect(user1Response.status).toBe(200);
    expect(user1Response.body.success).toBe(true);
    expect(user1Response.body.data).toHaveLength(1);
    expect(user1Response.body.data[0].note).toBe("User 1 expense");

    // User 2 can only see their own expenses in the category
    const user2Response = await agent2.get(`/api/categories/${categoryId}/expenses`);
    expect(user2Response.status).toBe(200);
    expect(user2Response.body.success).toBe(true);
    expect(user2Response.body.data).toHaveLength(1);
    expect(user2Response.body.data[0].note).toBe("User 2 expense");
  });

  // Category Retrieval Test
  test("should retrieve individual category and handle not found", async () => {
    const admin = await createUser("admin@example.com", "Password123!", "admin");
    const user = await createUser("user@example.com", "Password123!", "user");
    const adminAgent = await createAuthenticatedAgent(app, admin.email, admin.password);

    // Admin creates category
    const createResponse = await adminAgent.post("/api/admin/categories").send({
      name: "Food",
      userId: user.user._id
    });
    const categoryId = createResponse.body.category.id;

    // Anyone can get category by ID
    const getResponse = await request(app).get(`/api/categories/${categoryId}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.success).toBe(true);
    expect(getResponse.body.data.name).toBe("Food");

    // Test invalid category ID
    const invalidId = new mongoose.Types.ObjectId();
    const notFoundResponse = await request(app).get(`/api/categories/${invalidId}`);
    expect(notFoundResponse.status).toBe(404);
  });

  // Error Handling Test
  test("should handle invalid category IDs for expenses", async () => {
    const { user, email, password } = await createUser("test@example.com", "Password123!");
    const agent = await createAuthenticatedAgent(app, email, password);

    const invalidId = new mongoose.Types.ObjectId();

    // Test accessing expenses of non-existent category
    const expensesResponse = await agent.get(`/api/categories/${invalidId}/expenses`);
    expect(expensesResponse.status).toBe(404);
  });
});
