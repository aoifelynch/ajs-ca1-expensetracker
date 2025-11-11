import { Router } from 'express';
import User from '../models/user.js';
import Expense from '../models/expense.js';
import Category from '../models/category.js';
import { requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validateRequest.js';
import { expenseSchema, expenseIdParam, categorySchema, categoryIdParam, adminExpenseSchema, adminCategorySchema } from '../utils/validators.js';
import { HttpError, NOT_FOUND, BAD_REQUEST } from '../utils/HttpError.js';

const adminRouter = Router();

// Note: the router is mounted with requireAdmin in app.js, but we still
// implement safe operations here.

// === USER MANAGEMENT ===
// Get all users
adminRouter.get('/users', async (_req, res) => {
  const users = await User.find().select('-passwordHash').exec();
  res.json(users);
});

// === EXPENSE MANAGEMENT ===
// Get all expenses (optionally filter by categoryId)
adminRouter.get('/expenses', async (req, res) => {
  const filter = {};
  if (req.query.categoryId) filter.category = req.query.categoryId;
  const expenses = await Expense.find(filter).populate('user category').sort({ date: -1 }).exec();
  res.json(expenses);
});

// Create expense for any user (admin only)
adminRouter.post('/expenses', validate(adminExpenseSchema), async (req, res) => {
  const { userId, categoryId, amount, currency, date, note } = req.body;
  
  // Validate user exists
  const user = await User.findById(userId).exec();
  if (!user) throw new HttpError(NOT_FOUND, 'User not found');
  
  // Validate category exists
  const category = await Category.findById(categoryId).exec();
  if (!category) throw new HttpError(NOT_FOUND, 'Category not found');

  const expense = await Expense.create({
    user: user._id,
    category: category._id,
    amount: Number(amount),
    currency: currency || 'EUR',
    date: date ? new Date(date) : new Date(),
    note,
  });

  const populatedExpense = await Expense.findById(expense._id).populate('user category').exec();
  
  res.status(201).json({
    message: 'Expense created successfully',
    expense: populatedExpense
  });
});

// Update any expense (admin only)
adminRouter.put('/expenses/:id', validate(expenseIdParam), validate(adminExpenseSchema), async (req, res) => {
  const { userId, categoryId, amount, currency, date, note } = req.body;
  
  // Find the expense
  const expense = await Expense.findById(req.params.id).exec();
  if (!expense) throw new HttpError(NOT_FOUND, 'Could not find expense');

  // Validate user if provided
  if (userId) {
    const user = await User.findById(userId).exec();
    if (!user) throw new HttpError(NOT_FOUND, 'User not found');
  }

  // Validate category
  const category = await Category.findById(categoryId).exec();
  if (!category) throw new HttpError(NOT_FOUND, 'Category not found');

  // Update the expense
  const updatedExpense = await Expense.findByIdAndUpdate(
    req.params.id,
    {
      user: userId || expense.user,
      category: category._id,
      amount: Number(amount),
      currency: currency || expense.currency,
      date: date ? new Date(date) : expense.date,
      note: note !== undefined ? note : expense.note,
    },
    { new: true, runValidators: true }
  ).populate('user category').exec();

  res.status(200).json({
    message: 'Expense updated successfully',
    expense: updatedExpense
  });
});

// Delete any expense (admin only)
adminRouter.delete('/expenses/:id', validate(expenseIdParam), async (req, res) => {
  const expense = await Expense.findById(req.params.id).exec();
  if (!expense) throw new HttpError(NOT_FOUND, 'Could not find expense');

  await Expense.findByIdAndDelete(req.params.id).exec();
  res.status(200).json({ 
    message: 'Expense deleted successfully (admin)',
    deletedExpenseId: req.params.id 
  });
});

// === CATEGORY MANAGEMENT ===
// Get all categories
adminRouter.get('/categories', async (_req, res) => {
  const cats = await Category.find().populate('user', 'name email').sort({ name: 1 }).exec();
  res.json(cats);
});

// Create new category
adminRouter.post('/categories', validate(adminCategorySchema), async (req, res) => {
  const { name, userId } = req.body;
  
  // If userId provided, validate it exists; otherwise use admin as owner
  let categoryOwner;
  if (userId) {
    const user = await User.findById(userId).exec();
    if (!user) throw new HttpError(NOT_FOUND, 'User not found');
    categoryOwner = user._id;
  } else {
    // Use the current admin as the owner
    categoryOwner = req.user._id;
  }

  // Check if category already exists for this user
  const existingCategory = await Category.findOne({ name, user: categoryOwner }).exec();
  if (existingCategory) {
    throw new HttpError(BAD_REQUEST, 'Category already exists for this user');
  }

  const category = await Category.create({
    name,
    user: categoryOwner,
  });

  const populatedCategory = await Category.findById(category._id).populate('user', 'name email').exec();

  res.status(201).json({
    message: 'Category created successfully',
    category: populatedCategory
  });
});

// Update category
adminRouter.put('/categories/:id', validate(categoryIdParam), validate(adminCategorySchema), async (req, res) => {
  const { name, userId } = req.body;
  
  // Find the category
  const category = await Category.findById(req.params.id).exec();
  if (!category) throw new HttpError(NOT_FOUND, 'Category not found');

  // Validate user if provided
  let newOwner = category.user;
  if (userId) {
    const user = await User.findById(userId).exec();
    if (!user) throw new HttpError(NOT_FOUND, 'User not found');
    newOwner = user._id;
  }

  // Check for duplicate name with new owner
  if (name !== category.name || newOwner.toString() !== category.user.toString()) {
    const existingCategory = await Category.findOne({ 
      name: name || category.name, 
      user: newOwner,
      _id: { $ne: category._id }
    }).exec();
    
    if (existingCategory) {
      throw new HttpError(BAD_REQUEST, 'Category already exists for this user');
    }
  }

  const updatedCategory = await Category.findByIdAndUpdate(
    req.params.id,
    {
      name: name || category.name,
      user: newOwner,
    },
    { new: true, runValidators: true }
  ).populate('user', 'name email').exec();

  res.status(200).json({
    message: 'Category updated successfully',
    category: updatedCategory
  });
});

// Delete category
adminRouter.delete('/categories/:id', validate(categoryIdParam), async (req, res) => {
  const category = await Category.findById(req.params.id).exec();
  if (!category) throw new HttpError(NOT_FOUND, 'Category not found');

  // Check if category has expenses
  const expenseCount = await Expense.countDocuments({ category: category._id }).exec();
  if (expenseCount > 0) {
    throw new HttpError(BAD_REQUEST, `Cannot delete category: ${expenseCount} expense(s) are assigned to this category`);
  }

  await Category.findByIdAndDelete(req.params.id).exec();
  res.status(200).json({ 
    message: 'Category deleted successfully',
    deletedCategoryId: req.params.id 
  });
});

export default adminRouter;
