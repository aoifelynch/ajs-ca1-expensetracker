import { Router } from 'express';
import { validate } from '../middleware/validateRequest.js';
import { expenseSchema, expenseIdParam } from '../utils/validators.js';
import Expense from '../models/expense.js';
import Category from '../models/category.js';
import User from '../models/user.js';
import { HttpError, NOT_FOUND, FORBIDDEN } from '../utils/HttpError.js';
import { requireAuth } from '../middleware/auth.js';

const SUCCESS_NO_CONTENT = 204;

const expensesRouter = Router();

// All routes here require authentication
expensesRouter.use(requireAuth);

// GET - list the authenticated user's expenses 
expensesRouter.get('/', async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.categoryId) {
    filter.category = req.query.categoryId;
  }
  const expenses = await Expense.find(filter).populate('category').sort({ date: -1 }).exec();
  res.status(200).json({
    success: true,
    data: expenses,
    message: 'Expenses retrieved successfully'
  });
});

// GET with ID - return the expense if it belongs to the user or the user is admin
expensesRouter.get('/:id', validate(expenseIdParam), async (req, res) => {
  const expense = await Expense.findById(req.params.id).populate('category').exec();
  if (!expense) throw new HttpError(NOT_FOUND, 'Could not find expense');

  // owner or admin may view
  if (expense.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new HttpError(FORBIDDEN, 'Forbidden');
  }

  res.status(200).json({
    success: true,
    data: expense,
    message: 'Expense retrieved successfully'
  });
});

// POST - create an expense assigned to a category
expensesRouter.post('/', validate(expenseSchema), async (req, res) => {
  const { categoryId, amount, currency, date, note, description } = req.body;

  // ensure category exists
  const category = await Category.findById(categoryId).exec();
  if (!category) throw new HttpError(NOT_FOUND, 'Category not found');

  const expense = await Expense.create({
    user: req.user._id,
    category: category._id,
    amount: Number(amount),
    currency: currency || 'EUR',
    date: date ? new Date(date) : undefined,
    note: note || description, 
    description: description || note, 
  });

  res.status(201).json({
    success: true,
    data: expense,
    message: 'Expense created successfully'
  });
});

// DELETE with ID - owner or admin can delete
expensesRouter.delete('/:id', validate(expenseIdParam), async (req, res) => {
  const expense = await Expense.findById(req.params.id).exec();
  if (!expense) throw new HttpError(NOT_FOUND, 'Could not find expense');

  if (expense.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new HttpError(FORBIDDEN, 'Forbidden');
  }

  await Expense.findByIdAndDelete(req.params.id).exec();
  res.status(200).json({ 
    success: true,
    data: { id: req.params.id },
    message: 'Expense deleted successfully'
  });
});

// PUT with ID - update an expense (owner or admin)
expensesRouter.put('/:id', validate(expenseIdParam), validate(expenseSchema), async (req, res) => {
  const { categoryId, amount, currency, date, note, description } = req.body;
  
  // Find the existing expense
  const expense = await Expense.findById(req.params.id).exec();
  if (!expense) throw new HttpError(NOT_FOUND, 'Could not find expense');

  // Check ownership or admin privileges
  if (expense.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new HttpError(FORBIDDEN, 'Forbidden');
  }

  // Validate the new category if provided
  const category = await Category.findById(categoryId).exec();
  if (!category) throw new HttpError(NOT_FOUND, 'Category not found');

  // Update the expense
  const updatedExpense = await Expense.findByIdAndUpdate(
    req.params.id,
    {
      category: category._id,
      amount: Number(amount),
      currency: currency || expense.currency,
      date: date ? new Date(date) : expense.date,
      note: note !== undefined ? note : (description !== undefined ? description : expense.note),
      description: description !== undefined ? description : (note !== undefined ? note : expense.description),
    },
    { new: true, runValidators: true }
  ).populate('category').exec();

  res.status(200).json({
    success: true,
    data: updatedExpense,
    message: 'Expense updated successfully'
  });
});

export default expensesRouter;
