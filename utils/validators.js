import mongoose from 'mongoose';

// User validators
export const registerSchema = {
  email: {
    in: ['body'],
    notEmpty: { errorMessage: "'email' field is required" },
    isEmail: { errorMessage: "'email' must be a valid email address" },
  },
  name: {
    in: ['body'],
    notEmpty: { errorMessage: "'name' field is required" },
    isString: { errorMessage: "'name' must be a string" },
  },
  password: {
    in: ['body'],
    notEmpty: { errorMessage: "'password' field is required" },
    isStrongPassword: {
      options: { minLength: 8, minNumbers: 1, minUppercase: 1, minSymbols: 0 },
      errorMessage:
        "'password' must be at least 8 characters, include a number and an uppercase letter",
    },
  },
};

export const updateProfileSchema = {
  name: {
    in: ['body'],
    optional: true,
    isString: { errorMessage: "'name' must be a string" },
    isLength: { options: { min: 1, max: 100 }, errorMessage: "'name' must be 1-100 chars" },
    trim: true,
  },
  email: {
    in: ['body'],
    optional: true,
    isEmail: { errorMessage: "'email' must be a valid email address" },
  },
  currentPassword: {
    in: ['body'],
    optional: true,
    isString: { errorMessage: "'currentPassword' must be a string" },
  },
  newPassword: {
    in: ['body'],
    optional: true,
    isStrongPassword: {
      options: { minLength: 8, minNumbers: 1, minUppercase: 1, minSymbols: 0 },
      errorMessage: "'newPassword' must be at least 8 characters, include a number and an uppercase letter",
    },
  },
};

export const deleteAccountSchema = {
  password: {
    in: ['body'],
    notEmpty: { errorMessage: "'password' field is required" },
    isString: { errorMessage: "'password' must be a string" },
  },
};

export const loginSchema = {
  email: {
    in: ['body'],
    notEmpty: { errorMessage: "'email' field is required" },
    isEmail: { errorMessage: "'email' must be a valid email address" },
  },
  password: {
    in: ['body'],
    notEmpty: { errorMessage: "'password' field is required" },
    isString: { errorMessage: "'password' must be a string" },
  },
};

// Category validators
export const categorySchema = {
  name: {
    in: ['body'],
    notEmpty: { errorMessage: "'name' field is required" },
    isString: { errorMessage: "'name' must be a string" },
    isLength: { options: { min: 1, max: 100 }, errorMessage: "'name' must be 1-100 chars" },
    trim: true,
  },
};

export const categoryIdParam = {
  id: {
    in: ['params'],
    custom: {
      options: (value) => mongoose.Types.ObjectId.isValid(value),
      errorMessage: "Category ID 'id' parameter must be a valid ObjectId",
    },
  },
};

// Expense validators
export const expenseSchema = {
  categoryId: {
    in: ['body'],
    notEmpty: { errorMessage: "'categoryId' is required" },
    custom: {
      options: (value) => mongoose.Types.ObjectId.isValid(value),
      errorMessage: "'categoryId' must be a valid ObjectId",
    },
  },
  amount: {
    in: ['body'],
    notEmpty: { errorMessage: "'amount' is required" },
    isFloat: { options: { min: 0 }, errorMessage: "'amount' must be a non-negative number" },
  },
  currency: {
    in: ['body'],
    optional: true,
    isString: { errorMessage: "'currency' must be a string" },
    isLength: { options: { min: 3, max: 6 }, errorMessage: "'currency' must be 3-6 chars" },
  },
  date: {
    in: ['body'],
    optional: true,
    isISO8601: { errorMessage: "'date' must be an ISO8601 date" },
  },
  note: {
    in: ['body'],
    optional: true,
    isString: { errorMessage: "'note' must be a string" },
    isLength: { options: { max: 1000 }, errorMessage: "'note' max length is 1000 chars" },
  },
  description: {
    in: ['body'], 
    optional: true,
    isString: { errorMessage: "'description' must be a string" },
    isLength: { options: { max: 1000 }, errorMessage: "'description' max length is 1000 chars" },
  },
};

export const expenseIdParam = {
  id: {
    in: ['params'],
    custom: {
      options: (value) => mongoose.Types.ObjectId.isValid(value),
      errorMessage: "Expense ID 'id' parameter must be a valid ObjectId",
    },
  },
};

// Reusable ObjectId validator for any param name
export const objectIdParam = (paramName = 'id') => ({
  [paramName]: {
    in: ['params'],
    custom: {
      options: (value) => mongoose.Types.ObjectId.isValid(value),
      errorMessage: `Parameter '${paramName}' must be a valid ObjectId`,
    },
  },
});

// Admin-specific expense schema (allows userId to assign expense to any user)
export const adminExpenseSchema = {
  ...expenseSchema,
  userId: {
    in: ['body'],
    optional: true, 
    custom: {
      options: (value) => !value || mongoose.Types.ObjectId.isValid(value),
      errorMessage: "'userId' must be a valid ObjectId",
    },
  },
};

// Admin-specific category schema (allows userId to assign category to any user)
export const adminCategorySchema = {
  ...categorySchema,
  userId: {
    in: ['body'],
    optional: true, // if not provided, admin becomes owner
    custom: {
      options: (value) => !value || mongoose.Types.ObjectId.isValid(value),
      errorMessage: "'userId' must be a valid ObjectId",
    },
  },
};
