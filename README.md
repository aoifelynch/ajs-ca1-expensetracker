# Expense Tracker REST API

Advanced Javascript CA1 - A comprehensive expense tracking REST API built with Node.js, Express, and MongoDB.

## 📋 Application Overview

This expense tracker application provides a full-featured REST API for managing personal expenses with role-based access control. Users can track their spending by categories, while administrators have full system oversight.

**Key Features:**
- **User Management**: Registration, login, and session-based authentication
- **Expense Tracking**: Create, read, update, and delete personal expenses
- **Category Management**: Organize expenses by customizable categories
- **Admin Dashboard**: Administrative oversight of all users, expenses, and categories
- **Data Validation**: Comprehensive input validation and error handling
- **Role-Based Access**: User and admin roles with appropriate permissions

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v16 or higher)
- **Docker** (for MongoDB)
- **Git**

### 1. Clone and Install

```bash
git clone https://github.com/aoifelynch/ajs-ca1-expensetracker.git
cd ajs-ca1-expensetracker
npm install
```

### 2. Start MongoDB with Docker

```bash
# Start MongoDB container
docker run -d --name mongodb -p 27017:27017 mongo:latest

# Verify MongoDB is running
docker ps
```

### 3. Seed the Database

```bash
# Populate with sample data (admin user, regular user, categories, and expenses)
npm run seed
```

### 4. Start the API Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The API will be available at: **http://localhost:3001**

## 🔐 Default Users (After Seeding)

| Role | Email | Password | Description |
|------|-------|----------|-------------|
| Admin | `admin@example.com` | `Admin123!` | Full system access |
| User | `user@example.com` | `User123!` | Standard user with sample expenses |

## 📚 API Documentation

### Base URL
```
http://localhost:3001/api
```

### Authentication Endpoints
| Method | Endpoint | Description | Body Required |
|--------|----------|-------------|---------------|
| `POST` | `/auth/register` | Register new user | `{email, password, name}` |
| `POST` | `/auth/login` | Login user | `{email, password}` |
| `POST` | `/auth/logout` | Logout user | None |
| `GET` | `/auth/me` | Get current user info | None |

### User Expense Endpoints (Authentication Required)
| Method | Endpoint | Description | Body Required |
|--------|----------|-------------|---------------|
| `GET` | `/expenses` | Get user's expenses | None |
| `POST` | `/expenses` | Create new expense | `{categoryId, amount, currency?, date?, note?}` |
| `GET` | `/expenses/:id` | Get specific expense | None |
| `PUT` | `/expenses/:id` | Update expense | `{categoryId, amount, currency?, date?, note?}` |
| `DELETE` | `/expenses/:id` | Delete expense | None |

### Category Endpoints
| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| `GET` | `/categories` | List all categories | Public |
| `GET` | `/categories/:id` | Get specific category | Public |
| `GET` | `/categories/:id/expenses` | Get expenses in category | Authenticated |

### Admin Endpoints (Admin Role Required)
| Method | Endpoint | Description | Body Required |
|--------|----------|-------------|---------------|
| **Users** |
| `GET` | `/admin/users` | List all users | None |
| **Expenses** |
| `GET` | `/admin/expenses` | List all expenses | None |
| `POST` | `/admin/expenses` | Create expense for any user | `{userId, categoryId, amount, currency?, date?, note?}` |
| `PUT` | `/admin/expenses/:id` | Update any expense | `{userId?, categoryId, amount, currency?, date?, note?}` |
| `DELETE` | `/admin/expenses/:id` | Delete any expense | None |
| **Categories** |
| `GET` | `/admin/categories` | List all categories | None |
| `POST` | `/admin/categories` | Create new category | `{name, userId?}` |
| `PUT` | `/admin/categories/:id` | Update category | `{name?, userId?}` |
| `DELETE` | `/admin/categories/:id` | Delete category | None |

## 📝 Example Usage

### 1. Register a New User
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test User"}'
```

### 2. Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"User123!"}' \
  -c cookies.txt
```

### 3. Create an Expense
```bash
curl -X POST http://localhost:3001/api/expenses \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"categoryId":"CATEGORY_ID","amount":25.50,"note":"Coffee and pastry"}'
```

### 4. Get User's Expenses
```bash
curl -X GET http://localhost:3001/api/expenses -b cookies.txt
```

## 🛠 Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start development server |
| `npm run seed` | Populate database with sample data |
| `npm test` | Run test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

## 🏗 Technical Architecture

- **Runtime**: Node.js with ES Modules
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Express sessions with MongoDB store
- **Validation**: express-validator
- **Security**: Helmet, bcrypt password hashing
- **Testing**: Jest

## 🔧 Environment Configuration

Create a `.env` file (optional - fallback values are provided):

```env
MONGODB_URI=mongodb://127.0.0.1:27017/expense-tracker
SESSION_SECRET=your-secret-key-here
NODE_ENV=development
PORT=3001
```

## 🗃 Database Schema

### User Model
- `email` (String, required, unique)
- `name` (String, required)
- `passwordHash` (String, required)
- `role` (String, enum: ['user', 'admin'], default: 'user')

### Category Model
- `name` (String, required)
- `user` (ObjectId, ref: 'User', required)
- Unique index on (`name`, `user`)

### Expense Model
- `user` (ObjectId, ref: 'User', required)
- `category` (ObjectId, ref: 'Category', required)
- `amount` (Number, required, min: 0)
- `currency` (String, default: 'EUR')
- `date` (Date, default: now)
- `note` (String, optional)

## 🚨 Troubleshooting

### MongoDB Connection Issues
```bash
# Check if Docker is running
docker ps

# Restart MongoDB container
docker restart mongodb

# View MongoDB logs
docker logs mongodb
```

### Port Already in Use
```bash
# Check what's using port 3001
netstat -ano | findstr :3001

# Kill the process (Windows)
taskkill /PID <PID> /F
```

### Session/Authentication Issues
- Ensure cookies are enabled in your HTTP client
- Clear browser cookies if testing in browser
- Verify session middleware is properly configured

## 📄 License

This project is for educational purposes as part of Advanced JavaScript coursework.