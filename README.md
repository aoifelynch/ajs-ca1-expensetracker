# Expense Tracker REST API

Advanced Javascript CA1 - A comprehensive expense tracking REST API built with Node.js, Express, and MongoDB.

## Setup Instructions

### Prerequisites
- **Node.js** (v16 or higher)
- **Docker** (for MongoDB)
- **Git**

### 1. Clone and Install

git clone https://github.com/aoifelynch/ajs-ca1-expensetracker.git
cd ajs-ca1-expensetracker
npm install

### 2. Start MongoDB with Docker

# Start MongoDB container
docker run -d --name mongodb -p 27017:27017 mongo:latest

### 3. Seed the Database

npm run seed


### 4. Start the API Server

npm run dev


**The API will be available at: http://localhost:3001**

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start development server |
| `npm run seed` | Populate database with sample data |
| `npm test` | Run test suite |

## Default Users (After Seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@example.com` | `Admin123!` |
| User | `user@example.com` | `User123!` |

## Environment Configuration (Optional)

Create a `.env` file (copy .env.example and rename .env):

MONGODB_URI=mongodb://127.0.0.1:27017/expense-tracker
SESSION_SECRET=your-secret-key-here
NODE_ENV=development
PORT=3001

For detailed project documentation, API endpoints, and design decisions, see [DESIGN.md](DESIGN.md).