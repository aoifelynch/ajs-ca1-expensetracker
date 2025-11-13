import createApp from "../../app.js";
import request from "supertest";
import User from "../../models/user.js";
import mongoose from "mongoose";

// Helper function to create a user
const createUser = async (email, password = "Password123!", role = "user", name = "Test User") => {
  const passwordHash = await User.hashPassword(password);
  const user = await User.create({ email, name, passwordHash, role });
  return { user, email, password };
};

describe("Public API - Essential Tests", () => {
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

  // User Registration Test
  test("should register a new user", async () => {
    const userData = {
      email: "test@example.com",
      password: "Password123!",
      name: "Test User"
    };

    const response = await request(app)
      .post("/api/auth/register")
      .send(userData);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("user");
    expect(response.body.user.email).toBe("test@example.com");
    expect(response.body.user.name).toBe("Test User");
    expect(response.body.user.role).toBe("user");
    expect(response.body.user).not.toHaveProperty("passwordHash");
  });

  // User Login/Logout Test
  test("should handle user authentication lifecycle", async () => {
    const { email, password } = await createUser("test@example.com", "Password123!");
    const agent = request.agent(app);

    // Test login
    const loginResponse = await agent
      .post("/api/auth/login")
      .send({ email, password });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toHaveProperty("user");
    expect(loginResponse.body.user.email).toBe("test@example.com");

    // Test logout
    const logoutResponse = await agent.post("/api/auth/logout");
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body).toHaveProperty("message", "Logout successful");

    // Verify user can't access protected routes after logout
    const protectedResponse = await agent.get("/api/expenses");
    expect(protectedResponse.status).toBe(401);
  });

  // Validation Tests
  test("should validate user registration input", async () => {
    // Test missing email
    const missingEmailResponse = await request(app)
      .post("/api/auth/register")
      .send({ password: "Password123!", name: "Test" });
    expect(missingEmailResponse.status).toBe(400);

    // Test invalid email format
    const invalidEmailResponse = await request(app)
      .post("/api/auth/register")
      .send({ email: "invalid-email", password: "Password123!", name: "Test" });
    expect(invalidEmailResponse.status).toBe(400);

    // Test duplicate email
    await createUser("existing@example.com", "Password123!");
    const duplicateResponse = await request(app)
      .post("/api/auth/register")
      .send({ email: "existing@example.com", password: "Password123!", name: "Test" });
    expect(duplicateResponse.status).toBe(400);
  });

  test("should validate login credentials", async () => {
    await createUser("test@example.com", "Password123!");

    // Test wrong password
    const wrongPasswordResponse = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "wrongpassword" });
    expect(wrongPasswordResponse.status).toBe(401);

    // Test non-existent user
    const noUserResponse = await request(app)
      .post("/api/auth/login")
      .send({ email: "nonexistent@example.com", password: "Password123!" });
    expect(noUserResponse.status).toBe(401);

    // Test missing credentials
    const missingCredsResponse = await request(app)
      .post("/api/auth/login")
      .send({});
    expect(missingCredsResponse.status).toBe(400);
  });

  // Public Stats Check Test
  test("should respond to public stats endpoint", async () => {
    // Create some test data first
    await createUser("test1@example.com");
    await createUser("test2@example.com");

    const response = await request(app).get("/api/public/stats");
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("success", true);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toHaveProperty("totalUsers");
    expect(response.body.data).toHaveProperty("totalCategories");
    expect(response.body.data).toHaveProperty("totalExpenses");
    expect(response.body.data).toHaveProperty("popularCategories");
    expect(response.body.data).toHaveProperty("applicationInfo");
    expect(response.body.data.applicationInfo).toHaveProperty("name", "Expense Tracker");
    expect(response.body.data.totalUsers).toBeGreaterThanOrEqual(2);
  });
});