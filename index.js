import mongoose from 'mongoose';
import createApp from './app.js';

const MONGO_DEFAULT = 'mongodb://127.0.0.1:27017/expense-tracker';

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || MONGO_DEFAULT;
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    await connectDB();
    console.log('Database connected');
    const app = createApp();
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('Shutting down server...');
      server.close(async () => {
        await mongoose.disconnect();
        console.log('MongoDB disconnected');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
};

startServer();