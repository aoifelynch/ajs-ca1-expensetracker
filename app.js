import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';

import User from './models/user.js';
import Expense from './models/expense.js';
import Category from './models/category.js';

function calculateExpenseStats(expenses) {
  const stats = {
    count: expenses.length,
    total: 0,
    byCategory: {},
  };

  for (const e of expenses) {
    const amt = Number(e.amount) || 0;
    stats.total += amt;
    const cat = (e.category && (e.category.name || e.category)) || 'uncategorized';
    stats.byCategory[cat] = (stats.byCategory[cat] || 0) + amt;
  }

  return stats;
}

const createApp = () => {
  const app = express();
  app.use(express.json());

  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        client: mongoose.connection.getClient(),
        touchAfter: 24 * 3600, // lazy session update
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      },
    })
  );

  // Authentication middleware
  const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    next();
  };

  // Register
  app.post('/auth/register', async (req, res) => {
    try {
      const { email, name, password } = req.body;
      if (!email || !name || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const existing = await User.findOne({ email }).exec();
      if (existing) return res.status(400).json({ error: 'Email already registered' });

      const user = new User({ email, name });
      await user.setPassword(password);
      await user.save();

      req.session.userId = user._id.toString();

      res.status(201).json({ id: user._id.toString(), email: user.email, name: user.name });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to register' });
    }
  });

  // Login
  app.post('/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

      const user = await User.findOne({ email }).exec();
      if (!user) return res.status(401).json({ error: 'Invalid email or password' });

      const ok = await user.validatePassword(password);
      if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

      req.session.userId = user._id.toString();

      res.json({ id: user._id.toString(), email: user.email, name: user.name });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to login' });
    }
  });

  // Logout
  app.post('/auth/logout', requireAuth, async (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ error: 'Failed to logout' });
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out successfully' });
    });
  });

  // Expense endpoints
  app.get('/expenses/stats', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const expenses = await Expense.find({ user: userId }).populate('category').exec();
      const stats = calculateExpenseStats(expenses);
      res.json(stats);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to compute stats' });
    }
  });

  app.get('/expenses', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const expenses = await Expense.find({ user: userId }).populate('category').sort({ date: -1 }).exec();
      res.json(expenses);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to list expenses' });
    }
  });

  app.post('/expenses', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const { categoryId, amount, currency, date, note } = req.body;

      if (amount == null || !categoryId) {
        return res.status(400).json({ error: 'Missing required fields: categoryId and amount' });
      }

      // ensure category exists
      const category = await Category.findById(categoryId).exec();
      if (!category) return res.status(400).json({ error: 'Invalid categoryId' });

      const expense = await Expense.create({
        user: userId,
        category: category._id,
        amount: Number(amount),
        currency: currency || 'EURO',
        date: date ? new Date(date) : undefined,
        note,
      });

      res.status(201).json(expense);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create expense' });
    }
  });

  // Fallbacks / error handlers
  const unknownEndpoint = (_req, res) => {
    res.status(404).send({ error: 'Unknown endpoint' });
  };

  app.use(unknownEndpoint);

  const handleError = (error, _req, res, next) => {
    console.error(error && error.message);
    res.status(500).json({ error: 'Internal Server Error' });
    next(error);
  };

  app.use(handleError);

  return app;
};

export default createApp;
