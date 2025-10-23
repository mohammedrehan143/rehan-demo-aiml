// Demo setup script - creates sample data for testing
const mongoose = require('mongoose');

// Sample data for demo
const sampleUsers = [
  {
    email: 'admin@college.edu',
    password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password: password
    college: 'Demo College',
    role: 'admin'
  },
  {
    email: 'student@college.edu',
    password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password: password
    college: 'Demo College',
    role: 'user'
  }
];

const sampleFeedbacks = [
  {
    title: 'WiFi Issues in Library',
    message: 'The WiFi connection in the main library is very slow and keeps dropping.',
    priority: 'high',
    college: 'Demo College',
    passkey: '1234567890',
    status: 'pending'
  },
  {
    title: 'Cafeteria Food Quality',
    message: 'The food quality in the cafeteria has been declining recently.',
    priority: 'mid',
    college: 'Demo College',
    passkey: '0987654321',
    status: 'in_progress'
  }
];

const sampleNetworkData = [
  {
    location: { latitude: 40.7128, longitude: -74.0060 },
    networkQuality: 4,
    crowdDensity: 3,
    college: 'Demo College'
  },
  {
    location: { latitude: 40.7130, longitude: -74.0058 },
    networkQuality: 5,
    crowdDensity: 2,
    college: 'Demo College'
  }
];

async function setupDemoData() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/college-feedback', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // 5 second timeout
    });

    console.log('✅ Connected to MongoDB');

    // Import models
    const User = mongoose.model('User', new mongoose.Schema({
      email: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      college: { type: String, required: true },
      role: { type: String, enum: ['user', 'admin'], default: 'user' },
      subscription: {
        active: { type: Boolean, default: false },
        plan: { type: String, enum: ['basic', 'premium'], default: 'basic' },
        expiresAt: Date
      },
      createdAt: { type: Date, default: Date.now }
    }));

    const Feedback = mongoose.model('Feedback', new mongoose.Schema({
      title: { type: String, required: true },
      message: { type: String, required: true },
      priority: { type: String, enum: ['low', 'mid', 'high'], required: true },
      college: { type: String, required: true },
      passkey: { type: String, required: true, unique: true },
      status: { type: String, enum: ['pending', 'in_progress', 'resolved', 'rejected'], default: 'pending' },
      adminNotes: String,
      submittedAt: { type: Date, default: Date.now },
      resolvedAt: Date,
      location: {
        latitude: Number,
        longitude: Number,
        networkQuality: Number
      }
    }));

    const NetworkData = mongoose.model('NetworkData', new mongoose.Schema({
      location: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true }
      },
      networkQuality: { type: Number, required: true, min: 1, max: 5 },
      crowdDensity: { type: Number, required: true, min: 1, max: 5 },
      timestamp: { type: Date, default: Date.now },
      college: { type: String, required: true }
    }));

    // Clear existing data
    await User.deleteMany({});
    await Feedback.deleteMany({});
    await NetworkData.deleteMany({});

    // Insert sample data
    await User.insertMany(sampleUsers);
    await Feedback.insertMany(sampleFeedbacks);
    await NetworkData.insertMany(sampleNetworkData);

    console.log('✅ Demo data created successfully!');
    console.log('📧 Demo accounts:');
    console.log('   Admin: admin@college.edu / password');
    console.log('   Student: student@college.edu / password');
    console.log('🔑 Sample feedback passkeys: 1234567890, 0987654321');

  } catch (error) {
    console.log('⚠️  MongoDB not available, skipping demo data setup');
    console.log('   The app will work with in-memory storage');
  }
}

setupDemoData();
