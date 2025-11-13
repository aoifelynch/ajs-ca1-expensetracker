# Expense Tracker API - Design Document

## Project Overview

The Expense Tracker API is a RESTful web service designed to help users manage their personal expenses through a comprehensive category-based system. Built with Node.js, Express, and MongoDB, the application provides secure user authentication, expense management, and administrative oversight capabilities.

### Core Functionality
- **User Management**: Registration, authentication, and role-based access control
- **Expense Tracking**: Full CRUD operations for personal expense records
- **Category Management**: Organized expense categorization system
- **Administrative Dashboard**: Complete system oversight for administrators
- **Data Validation**: Comprehensive input validation and error handling

## Database Design

### Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│      User       │       │    Category     │       │    Expense      │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ _id: ObjectId   │◄─────┐│ _id: ObjectId   │◄─────┐│ _id: ObjectId   │
│ email: String   │      ││ name: String    │      ││ amount: Number  │
│ name: String    │      ││ user: ObjectId  │      ││ currency: String│
│ passwordHash    │      │└─────────────────┘      ││ date: Date      │
│ role: String    │      │                         ││ note: String    │
│ createdAt       │      │                         ││ user: ObjectId  │
│ updatedAt       │      │                         ││ category: ObjectId│
└─────────────────┘      │                         ││ createdAt       │
                         │                         ││ updatedAt       │
                         └─────────────────────────┘└─────────────────┘

Relationships:
• User (1) ←→ (N) Category [One user owns many categories]
• User (1) ←→ (N) Expense  [One user owns many expenses]
• Category (1) ←→ (N) Expense [One category contains many expenses]
```

### Schema Design Decisions

#### User Schema
```javascript
{
  email: String (required, unique),     // Primary identifier
  name: String (required),              // Display name
  passwordHash: String (required),      // bcrypt hashed password
  role: String (enum: ['user', 'admin'], default: 'user')
}
```

**Design Rationale:**
- Email as unique identifier (common user expectation)
- Separate display name for personalization
- Role-based access control with enum constraint
- Password hashing for security compliance

#### Category Schema
```javascript
{
  name: String (required),              // Category name
  user: ObjectId (ref: 'User', required) // Category owner
}
// Compound index: (name, user) - prevents duplicate categories per user
```

**Design Rationale:**
- User-owned categories for personalization
- Compound unique index prevents duplicate categories per user
- Simple structure allows for future extension (colors, icons, etc.)

#### Expense Schema
```javascript
{
  user: ObjectId (ref: 'User', required),     // Expense owner
  category: ObjectId (ref: 'Category', required), // Categorization
  amount: Number (required, min: 0),          // Expense amount
  currency: String (default: 'EUR'),          // Currency code
  date: Date (default: Date.now),             // Expense date
  note: String (optional, max: 1000)          // Optional description
}
```

**Design Rationale:**
- Dual foreign keys ensure data integrity
- Flexible currency support for international users
- Optional note field for detailed tracking
- Date field with sensible default

### Data Integrity Considerations
- **Referential Integrity**: Mongoose population ensures valid relationships
- **Validation**: Schema-level validation prevents invalid data
- **Indexing Strategy**: Compound indexes on frequently queried fields
- **Cascading Deletes**: Protected - categories with expenses cannot be deleted

## API Design Choices

### RESTful Architecture

**Resource-Based URL Design:**
```
/api/auth/*           - Authentication operations
/api/expenses/*       - User expense management
/api/categories/*     - Category operations  
/api/admin/*          - Administrative operations
```

### HTTP Method Conventions
- **GET**: Retrieve resources
- **POST**: Create new resources
- **PUT**: Update existing resources 
- **DELETE**: Remove resources

### Middleware Architecture

**Layered Middleware Approach:**
1. **Security Layer**: Helmet, CORS protection
2. **Authentication Layer**: Session-based authentication
3. **Authorization Layer**: Role-based access control
4. **Validation Layer**: Input validation and sanitization
5. **Business Logic Layer**: Route handlers
6. **Error Handling Layer**: Centralized error management

## Security Considerations

### Authentication & Authorization

**Session-Based Authentication:**
- Server-side session control (instant revocation)
- Reduced client-side security burden
- Built-in Express.js ecosystem support

**Role-Based Access Control:**
- **User Role**: Access only personal resources
- **Admin Role**: System-wide access with oversight capabilities
- **Middleware Enforcement**: Authorization checks at route level

### Password Security

**bcrypt Implementation:**
- Salt rounds: 10 (balance of security vs performance)
- No password storage - only hashed versions
- Password strength requirements enforced

### Data Protection

**Input Validation:**
- **express-validator**: Comprehensive input sanitization
- **Mongoose Schema Validation**: Database-level constraints
- **Type Safety**: Strict typing prevents injection attacks

**Output Sanitization:**
```javascript
// Sensitive data exclusion:
userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.passwordHash;  // Never expose password hashes
    delete ret.__v;           // Remove Mongoose version key
  }
});
```

### Security Headers & Session Protection
- **Helmet.js**: Content Security Policy, XSS protection, clickjacking prevention
- **Secure cookies**: HTTPS-only in production

## Future Improvements

### 2. Advanced Features
- **Budget Management**: Spending limits and alerts
- **File Attachments**: Receipt image uploads
- **Multi-Currency Exchange**: Real-time currency conversion
- **Company-specific Data**: Create users assigned to an admin to create companies within the application

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

## Default Users (After Seeding)

| Role | Email | Password | Description |
|------|-------|----------|-------------|
| Admin | `admin@example.com` | `Admin123!` | Full system access |
| User | `user@example.com` | `User123!` | Standard user with sample expenses |

## API Documentation

### Base URL

http://localhost:3001/api


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