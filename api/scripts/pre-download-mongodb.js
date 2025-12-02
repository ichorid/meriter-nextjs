const { MongoBinary } = require('mongodb-memory-server');

async function preDownloadMongoDB() {
  try {
    console.log('Pre-downloading MongoDB binary for tests...');
    // Get the MongoDB binary path - this will trigger download if not already cached
    const mongodPath = await MongoBinary.getPath();
    console.log(`MongoDB binary pre-downloaded successfully to: ${mongodPath}`);
  } catch (error) {
    console.error('Failed to pre-download MongoDB binary:', error);
    console.error('Installation will fail to prevent test timeouts.');
    process.exit(1);
  }
}

preDownloadMongoDB();

