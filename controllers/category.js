import { Router } from 'express';
import { validate } from '../middleware/validateRequest.js';
import { categoryIdParam } from '../utils/validators.js';
import Category from '../models/category.js';
import Expense from '../models/expense.js';
import { HttpError, NOT_FOUND } from '../utils/HttpError.js';
import { requireAuth } from '../middleware/auth.js';

const categoriesRouter = Router();

// Public: list categories
categoriesRouter.get('/', async (_req, res) => {
  const cats = await Category.find().sort({ name: 1 }).exec();
  res.status(200).json({
    success: true,
    data: cats,
    message: 'Categories retrieved successfully'
  });
});

// Get single category
categoriesRouter.get('/:id', validate(categoryIdParam), async (req, res) => {
  const cat = await Category.findById(req.params.id).exec();
  if (!cat) throw new HttpError(NOT_FOUND, 'Category not found');
  res.status(200).json({
    success: true,
    data: cat,
    message: 'Category retrieved successfully'
  });
});

// List expenses within a category. Auth required.
categoriesRouter.get('/:id/expenses', requireAuth, validate(categoryIdParam), async (req, res) => {
  const catId = req.params.id;
  const category = await Category.findById(catId).exec();
  if (!category) throw new HttpError(NOT_FOUND, 'Category not found');

  // If admin, return all expenses in category; otherwise only the user's
  if (req.user.role === 'admin') {
    const expenses = await Expense.find({ category: catId }).populate('user category').sort({ date: -1 }).exec();
    res.status(200).json({
      success: true,
      data: expenses,
      message: 'Category expenses retrieved successfully (admin view)'
    });
  } else {
    const expenses = await Expense.find({ category: catId, user: req.user._id }).populate('category').sort({ date: -1 }).exec();
    res.status(200).json({
      success: true,
      data: expenses,
      message: 'Category expenses retrieved successfully'
    });
  }
});

export default categoriesRouter;
