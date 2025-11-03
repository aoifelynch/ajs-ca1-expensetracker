import mongoose from 'mongoose';
import User from './models/user.js';
import Category from './models/category.js';

const MONGO_DEFAULT = 'mongodb://127.0.0.1:27017/expense-tracker';
const uri = process.env.MONGODB_URI || MONGO_DEFAULT;

async function main() {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB for seeding');

  const adminEmail = 'admin@example.com';
  const adminPassword = 'Admin123!';
  const adminName = 'Admin';

  let admin = await User.findOne({ email: adminEmail }).exec();
  if (!admin) {
    const passwordHash = await User.hashPassword(adminPassword);
    admin = await User.create({ email: adminEmail, name: adminName, passwordHash, role: 'admin' });
    console.log('Created admin user:', admin.email);
  } else {
    console.log('Admin user already exists:', admin.email);
  }

  const categories = ['Food', 'Bills', 'Travel', 'Transport', 'Entertainment'];
  for (const name of categories) {
    const exists = await Category.findOne({ name, user: admin._id }).exec();
    if (!exists) {
      const cat = await Category.create({ name, user: admin._id });
      console.log('Created category:', cat.name);
    } else {
      console.log('Category exists:', name);
    }
  }

  await mongoose.disconnect();
  console.log('Seeding complete');
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
