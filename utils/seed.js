import mongoose from "mongoose";
import User from "../models/user.js";
import Category from "../models/category.js";
import Expense from "../models/expense.js";

let userExpenses = [
  {
    note: "Grocery shopping at supermarket",
    amount: 45.67,
    category: "Food",
  },
  {
    note: "Lunch at restaurant",
    amount: 18.50,
    category: "Food",
  },
  {
    note: "Monthly electricity bill",
    amount: 89.23,
    category: "Bills",
  },
  {
    note: "Internet service payment",
    amount: 55.00,
    category: "Bills",
  },
  {
    note: "Flight ticket to Madrid",
    amount: 245.80,
    category: "Travel",
  },
  {
    note: "Hotel booking for weekend",
    amount: 120.00,
    category: "Travel",
  },
  {
    note: "Monthly bus pass",
    amount: 75.00,
    category: "Transport",
  },
  {
    note: "Taxi fare to airport",
    amount: 32.50,
    category: "Transport",
  },
  {
    note: "Movie tickets for two",
    amount: 24.00,
    category: "Entertainment",
  },
  {
    note: "Concert ticket",
    amount: 65.00,
    category: "Entertainment",
  },
];

let categories = ["Food", "Bills", "Travel", "Transport", "Entertainment"];

const MONGO_DEFAULT = 'mongodb://127.0.0.1:27017/expense-tracker';
const uri = process.env.MONGODB_URI || MONGO_DEFAULT;

mongoose.connect(uri).then(async () => {
  // Delete any already existing data
  await Expense.deleteMany({}).exec();
  await Category.deleteMany({}).exec();
  await User.deleteMany({}).exec();

  // Create admin user
  const passwordHashAdmin = await User.hashPassword("Admin123!");
  const adminUser = await User.create({
    email: "admin@example.com",
    name: "Admin",
    passwordHash: passwordHashAdmin,
    role: "admin",
  });

  console.log("Created admin user:", adminUser.email);

  // Create regular user
  const passwordHashUser = await User.hashPassword("User123!");
  const regularUser = await User.create({
    email: "user@example.com",
    name: "Regular User",
    passwordHash: passwordHashUser,
    role: "user",
  });

  console.log("Created user:", regularUser.email);

  // Create categories (owned by admin)
  const categoryPromises = categories.map((categoryName) => {
    return Category.create({
      name: categoryName,
      user: adminUser._id,
    });
  });

  const createdCategories = await Promise.all(categoryPromises);
  console.log(`Created ${categories.length} categories`);

  // Create a map of category names to category objects for easy lookup
  const categoryMap = {};
  createdCategories.forEach((cat) => {
    categoryMap[cat.name] = cat;
  });

  // Create expenses for the regular user
  const expensePromises = userExpenses.map((expenseData) => {
    const category = categoryMap[expenseData.category];
    return Expense.create({
      note: expenseData.note,
      amount: expenseData.amount,
      currency: "EUR",
      date: new Date(),
      category: category._id,
      user: regularUser._id,
    });
  });

  // Close connection once all expenses have been added
  await Promise.all(expensePromises);
  console.log(`Created ${userExpenses.length} expenses for ${regularUser.email}`);
  mongoose.connection.close();
});
