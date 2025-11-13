import { Router } from 'express';
import User from '../models/user.js';
import Expense from '../models/expense.js';
import Category from '../models/category.js';
import { requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validateRequest.js';
import { expenseSchema, expenseIdParam, categorySchema, categoryIdParam, adminExpenseSchema, adminCategorySchema } from '../utils/validators.js';
import { HttpError, NOT_FOUND, BAD_REQUEST } from '../utils/HttpError.js';

const adminRouter = Router();

adminRouter.get('/users', async (_req, res) => {
  const users = await User.find().select('-passwordHash').exec();
  res.json(users);
});

// Expenses
adminRouter.get('/expenses', async (req, res) => {
  const filter = {};
  if (req.query.categoryId) filter.category = req.query.categoryId;
  const expenses = await Expense.find(filter).populate('user category').sort({ date: -1 }).exec();
  res.json(expenses);
});

// Create expense for any user (admin only)
adminRouter.post('/expenses', validate(adminExpenseSchema), async (req, res) => {
  const { userId, categoryId, amount, currency, date, note, description } = req.body;
  
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
    note: note || description,
    description: description || note,
  });

  const populatedExpense = await Expense.findById(expense._id).populate('user category').exec();
  
  res.status(201).json({
    message: 'Expense created successfully',
    expense: populatedExpense
  });
});

// Update any expense (admin only)
adminRouter.put('/expenses/:id', validate(expenseIdParam), validate(adminExpenseSchema), async (req, res) => {
  const { userId, categoryId, amount, currency, date, note, description } = req.body;
  
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
      note: note !== undefined ? note : (description !== undefined ? description : expense.note),
      description: description !== undefined ? description : (note !== undefined ? note : expense.description),
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

// Get all categories
adminRouter.get('/categories', async (_req, res) => {
  const cats = await Category.find().populate('user', 'name email').sort({ name: 1 }).exec();
  res.json(cats);
});

// Create new category
adminRouter.post('/categories', validate(adminCategorySchema), async (req, res) => {
  const { name, userId } = req.body;
  
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

// Admin Dashboard
adminRouter.get('/dashboard', async (req, res) => {
  try {
    // Basic counts
    const totalUsers = await User.countDocuments().exec();
    const totalExpenses = await Expense.countDocuments().exec();
    const totalCategories = await Category.countDocuments().exec();

    // User activity statistics
    const userStats = await User.aggregate([
      {
        $lookup: {
          from: 'expenses',
          localField: '_id',
          foreignField: 'user',
          as: 'expenses'
        }
      },
      {
        $project: {
          name: 1,
          email: 1,
          role: 1,
          createdAt: 1,
          expenseCount: { $size: '$expenses' },
          totalSpent: { $sum: '$expenses.amount' }
        }
      },
      {
        $sort: { totalSpent: -1 }
      }
    ]).exec();

    // Expense statistics by category
    const categoryStats = await Expense.aggregate([
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          expenseCount: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      {
        $unwind: '$categoryInfo'
      },
      {
        $project: {
          categoryName: '$categoryInfo.name',
          totalAmount: { $round: ['$totalAmount', 2] },
          expenseCount: 1,
          avgAmount: { $round: ['$avgAmount', 2] }
        }
      },
      {
        $sort: { totalAmount: -1 }
      }
    ]).exec();

    // Monthly expense trends (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlyTrends = await Expense.aggregate([
      {
        $match: {
          date: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          totalAmount: { $sum: '$amount' },
          expenseCount: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      },
      {
        $project: {
          month: {
            $dateToString: {
              format: '%Y-%m',
              date: {
                $dateFromParts: {
                  year: '$_id.year',
                  month: '$_id.month'
                }
              }
            }
          },
          totalAmount: { $round: ['$totalAmount', 2] },
          expenseCount: 1,
          avgAmount: { $round: ['$avgAmount', 2] }
        }
      }
    ]).exec();

    // last 10 expenses
    const recentExpenses = await Expense.find()
      .populate('user', 'name email')
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .limit(10)
      .exec();

    // System overview
    const systemStats = {
      totalUsers,
      totalExpenses,
      totalCategories,
      totalValue: await Expense.aggregate([
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => result[0]?.total || 0),
      avgExpenseValue: await Expense.aggregate([
        { $group: { _id: null, avg: { $avg: '$amount' } } }
      ]).then(result => Math.round((result[0]?.avg || 0) * 100) / 100)
    };

    // Enhanced Summary Section
    const summary = {
      // Users with the most expenses 
      topUsersByExpenseCount: userStats
        .sort((a, b) => b.expenseCount - a.expenseCount)
        .slice(0, 5)
        .map(user => ({
          name: user.name,
          email: user.email,
          expenseCount: user.expenseCount,
          totalSpent: Math.round(user.totalSpent * 100) / 100
        })),

      // Users with the most expenses
      topUsersBySpending: userStats
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 5)
        .map(user => ({
          name: user.name,
          email: user.email,
          expenseCount: user.expenseCount,
          totalSpent: Math.round(user.totalSpent * 100) / 100
        })),

      // Top categories by total amount
      topCategoriesByAmount: categoryStats.slice(0, 5).map(cat => ({
        categoryName: cat.categoryName,
        totalAmount: cat.totalAmount,
        expenseCount: cat.expenseCount,
        avgAmount: cat.avgAmount
      })),

      // Top categories by expense count
      topCategoriesByCount: categoryStats
        .sort((a, b) => b.expenseCount - a.expenseCount)
        .slice(0, 5)
        .map(cat => ({
          categoryName: cat.categoryName,
          totalAmount: cat.totalAmount,
          expenseCount: cat.expenseCount,
          avgAmount: cat.avgAmount
        })),

      // Overall totals
      overallStats: {
        totalExpenses: systemStats.totalExpenses,
        totalValue: Math.round(systemStats.totalValue * 100) / 100,
        averageExpenseValue: systemStats.avgExpenseValue,
        totalUsers: systemStats.totalUsers,
        totalCategories: systemStats.totalCategories,
        activeUsersWithExpenses: userStats.filter(user => user.expenseCount > 0).length
      }
    };

    res.json({
      dashboard: {
        summary, 
        systemStats,
        userStats: userStats.slice(0, 10), 
        categoryStats,
        monthlyTrends,
        recentExpenses
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ 
      error: 'Unable to generate dashboard data',
      message: 'Please try again later'
    });
  }
});

// Detailed financial report
adminRouter.get('/report', async (req, res) => {
  try {
    const { userId, categoryId } = req.query;
    
    // Build filter
    const filter = {};
    if (userId) filter.user = userId;
    if (categoryId) filter.category = categoryId;

    // Get expenses with filter
    const expenses = await Expense.find(filter)
      .populate('user', 'name email')
      .populate('category', 'name')
      .sort({ date: -1 })
      .exec();

    // Generate summary
    const summary = {
      totalExpenses: expenses.length,
      totalValue: expenses.reduce((sum, exp) => sum + exp.amount, 0),
      averageExpense: expenses.length ? expenses.reduce((sum, exp) => sum + exp.amount, 0) / expenses.length : 0,
      currency: 'EUR' // Assuming EUR as default
    };

    res.json({
      summary,
      expenses,
      filters: { userId, categoryId }
    });

  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ 
      error: 'Unable to generate report',
      message: 'Please check your parameters and try again'
    });
  }
});

export default adminRouter;
