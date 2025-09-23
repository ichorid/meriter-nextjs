import mongoose from 'mongoose';

module.exports = async () => {
  if ((global as any).__MONGO_INSTANCE__) {
    await (global as any).__MONGO_INSTANCE__.stop();
  }
  await mongoose.connection.close();
};
