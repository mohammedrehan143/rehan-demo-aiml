console.log('🚀 Loading College Feedback System...');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database Models
const UserSchema = new mongoose.Schema({
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
});

const FeedbackSchema = new mongoose.Schema({
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
});

const NetworkDataSchema = new mongoose.Schema({
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  networkQuality: { type: Number, required: true, min: 1, max: 5 },
  crowdDensity: { type: Number, required: true, min: 1, max: 5 },
  timestamp: { type: Date, default: Date.now },
  college: { type: String, required: true }
});

const User = mongoose.model('User', UserSchema);
const Feedback = mongoose.model('Feedback', FeedbackSchema);
const NetworkData = mongoose.model('NetworkData', NetworkDataSchema);

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'college-feedback-super-secret-jwt-key-2024', (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Generate 10-digit passkey
const generatePasskey = () => {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

// Routes

// Authentication routes
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, college, role } = req.body;
    
    if (useInMemoryStorage) {
      // Check if user exists in memory
      const existingUser = inMemoryData.users.find(u => u.email === email);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = {
        _id: Date.now().toString(),
        email,
        password: hashedPassword,
        college,
        role: role || 'user',
        subscription: {
          active: false,
          plan: 'basic',
          expiresAt: null
        },
        createdAt: new Date()
      };

      inMemoryData.users.push(newUser);
      res.status(201).json({ message: 'User created successfully' });
    } else {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({
        email,
        password: hashedPassword,
        college,
        role: role || 'user'
      });

      await user.save();
      res.status(201).json({ message: 'User created successfully' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (useInMemoryStorage) {
      const user = inMemoryData.users.find(u => u.email === email);
      
      if (!user || !await bcrypt.compare(password, user.password)) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { userId: user._id, email: user.email, role: user.role, college: user.college },
        process.env.JWT_SECRET || 'college-feedback-super-secret-jwt-key-2024',
        { expiresIn: '24h' }
      );

      res.json({ token, user: { email: user.email, role: user.role, college: user.college } });
    } else {
      const user = await User.findOne({ email });
      
      if (!user || !await bcrypt.compare(password, user.password)) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { userId: user._id, email: user.email, role: user.role, college: user.college },
        process.env.JWT_SECRET || 'college-feedback-super-secret-jwt-key-2024',
        { expiresIn: '24h' }
      );

      res.json({ token, user: { email: user.email, role: user.role, college: user.college } });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Feedback routes
app.post('/api/feedback', authenticateToken, async (req, res) => {
  try {
    const { title, message, priority, location } = req.body;
    
    if (useInMemoryStorage) {
      // Check if user has subscription for high priority
      if (priority === 'high') {
        const user = inMemoryData.users.find(u => u._id === req.user.userId);
        if (!user || !user.subscription.active) {
          return res.status(402).json({ 
            message: 'Subscription required for high priority feedback',
            requiresPayment: true 
          });
        }
      }

      const passkey = generatePasskey();
      const newFeedback = {
        _id: Date.now().toString(),
        title,
        message,
        priority,
        college: req.user.college,
        userId: req.user.userId, // Add user ID to track who submitted
        passkey,
        status: 'pending',
        adminNotes: null,
        submittedAt: new Date(),
        resolvedAt: null,
        location
      };

      inMemoryData.feedbacks.push(newFeedback);
      
      // Notify admin in real-time about new feedback
      io.to(req.user.college).emit('new-feedback', {
        feedback: newFeedback,
        message: 'New feedback submitted'
      });
      
      res.status(201).json({ 
        message: 'Feedback submitted successfully',
        passkey,
        feedbackId: newFeedback._id
      });
    } else {
      // Check if user has subscription for high priority
      if (priority === 'high') {
        const user = await User.findById(req.user.userId);
        if (!user.subscription.active) {
          return res.status(402).json({ 
            message: 'Subscription required for high priority feedback',
            requiresPayment: true 
          });
        }
      }

      const passkey = generatePasskey();
      const feedback = new Feedback({
        title,
        message,
        priority,
        college: req.user.college,
        passkey,
        location
      });

      await feedback.save();
      res.status(201).json({ 
        message: 'Feedback submitted successfully',
        passkey,
        feedbackId: feedback._id
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get feedback status by passkey
app.get('/api/feedback/status/:passkey', async (req, res) => {
  try {
    if (useInMemoryStorage) {
      const feedback = inMemoryData.feedbacks.find(f => f.passkey === req.params.passkey);
      if (!feedback) {
        return res.status(404).json({ message: 'Feedback not found' });
      }
      res.json(feedback);
    } else {
      const feedback = await Feedback.findOne({ passkey: req.params.passkey });
      if (!feedback) {
        return res.status(404).json({ message: 'Feedback not found' });
      }
      res.json(feedback);
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's own feedbacks
app.get('/api/user/feedbacks', authenticateToken, async (req, res) => {
  try {
    if (useInMemoryStorage) {
      const userFeedbacks = inMemoryData.feedbacks
        .filter(f => f.userId === req.user.userId)
        .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
      res.json(userFeedbacks);
    } else {
      const userFeedbacks = await Feedback.find({ userId: req.user.userId })
        .sort({ submittedAt: -1 });
      res.json(userFeedbacks);
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin routes
app.get('/api/admin/feedback', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    if (useInMemoryStorage) {
      // Admin should see ALL feedbacks for their college, not filtered by userId
      const feedbacks = inMemoryData.feedbacks
        .filter(f => f.college === req.user.college)
        .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
      console.log(`Admin loading ${feedbacks.length} feedbacks for college: ${req.user.college}`);
      res.json(feedbacks);
    } else {
      const feedbacks = await Feedback.find({ college: req.user.college })
        .sort({ submittedAt: -1 });
      res.json(feedbacks);
    }
  } catch (error) {
    console.error('Admin feedback loading error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.put('/api/admin/feedback/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { status, adminNotes } = req.body;

    if (useInMemoryStorage) {
      const feedbackIndex = inMemoryData.feedbacks.findIndex(f => f._id === req.params.id);
      if (feedbackIndex === -1) {
        return res.status(404).json({ message: 'Feedback not found' });
      }

      inMemoryData.feedbacks[feedbackIndex].status = status;
      inMemoryData.feedbacks[feedbackIndex].adminNotes = adminNotes;
      inMemoryData.feedbacks[feedbackIndex].resolvedAt = status === 'resolved' ? new Date() : null;

      res.json(inMemoryData.feedbacks[feedbackIndex]);
    } else {
      const feedback = await Feedback.findByIdAndUpdate(
        req.params.id,
        { 
          status, 
          adminNotes,
          resolvedAt: status === 'resolved' ? new Date() : null
        },
        { new: true }
      );

      if (!feedback) {
        return res.status(404).json({ message: 'Feedback not found' });
      }

      res.json(feedback);
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Network analyzer routes
app.post('/api/network-data', async (req, res) => {
  try {
    const { location, networkQuality, crowdDensity, college } = req.body;
    
    if (useInMemoryStorage) {
      const newNetworkData = {
        _id: Date.now().toString(),
        location,
        networkQuality,
        crowdDensity,
        college,
        timestamp: new Date()
      };

      inMemoryData.networkData.push(newNetworkData);
      res.status(201).json({ message: 'Network data recorded successfully' });
    } else {
      const networkData = new NetworkData({
        location,
        networkQuality,
        crowdDensity,
        college
      });

      await networkData.save();
      res.status(201).json({ message: 'Network data recorded successfully' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/network-analysis/:college', async (req, res) => {
  try {
    const { college } = req.params;
    const { lat, lng } = req.query;
    
    if (useInMemoryStorage) {
      // Get network data for the college
      const networkData = inMemoryData.networkData
        .filter(data => data.college === college)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 100);

      // Calculate average network quality by location
      const locationQuality = {};
      networkData.forEach(data => {
        const key = `${data.location.latitude.toFixed(4)},${data.location.longitude.toFixed(4)}`;
        if (!locationQuality[key]) {
          locationQuality[key] = { total: 0, count: 0, crowdDensity: 0 };
        }
        locationQuality[key].total += data.networkQuality;
        locationQuality[key].count += 1;
        locationQuality[key].crowdDensity += data.crowdDensity;
      });

      // Convert to array and calculate averages
      const analysis = Object.entries(locationQuality).map(([location, data]) => {
        const [lat, lng] = location.split(',');
        return {
          location: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
          averageQuality: data.total / data.count,
          averageCrowdDensity: data.crowdDensity / data.count,
          sampleCount: data.count
        };
      }).sort((a, b) => b.averageQuality - a.averageQuality);

      res.json(analysis);
    } else {
      // Get network data for the college
      const networkData = await NetworkData.find({ college })
        .sort({ timestamp: -1 })
        .limit(100);

      // Calculate average network quality by location
      const locationQuality = {};
      networkData.forEach(data => {
        const key = `${data.location.latitude.toFixed(4)},${data.location.longitude.toFixed(4)}`;
        if (!locationQuality[key]) {
          locationQuality[key] = { total: 0, count: 0, crowdDensity: 0 };
        }
        locationQuality[key].total += data.networkQuality;
        locationQuality[key].count += 1;
        locationQuality[key].crowdDensity += data.crowdDensity;
      });

      // Convert to array and calculate averages
      const analysis = Object.entries(locationQuality).map(([location, data]) => {
        const [lat, lng] = location.split(',');
        return {
          location: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
          averageQuality: data.total / data.count,
          averageCrowdDensity: data.crowdDensity / data.count,
          sampleCount: data.count
        };
      }).sort((a, b) => b.averageQuality - a.averageQuality);

      res.json(analysis);
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Payment routes
app.post('/api/create-payment-intent', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Convert to cents
      currency: 'usd',
      metadata: {
        userId: req.user.userId,
        college: req.user.college
      }
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ message: 'Payment error', error: error.message });
  }
});

app.post('/api/activate-subscription', authenticateToken, async (req, res) => {
  try {
    const { plan } = req.body;
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1); // 1 month subscription

    if (useInMemoryStorage) {
      const userIndex = inMemoryData.users.findIndex(u => u._id === req.user.userId);
      if (userIndex !== -1) {
        inMemoryData.users[userIndex].subscription.active = true;
        inMemoryData.users[userIndex].subscription.plan = plan;
        inMemoryData.users[userIndex].subscription.expiresAt = expiresAt;
      }
      res.json({ message: 'Subscription activated successfully' });
    } else {
      await User.findByIdAndUpdate(req.user.userId, {
        'subscription.active': true,
        'subscription.plan': plan,
        'subscription.expiresAt': expiresAt
      });

      res.json({ message: 'Subscription activated successfully' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Serve static files

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-college', (college) => {
    socket.join(college);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Database connection with fallback to in-memory storage
let useInMemoryStorage = false;

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/college-feedback', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB');
  useInMemoryStorage = false;
  startServer();
})
.catch(err => {
  console.log('⚠️  MongoDB not available, using in-memory storage for demo');
  console.log('   To use MongoDB: install and start MongoDB service');
  useInMemoryStorage = true;
  setupInMemoryStorage();
  startServer();
});

// In-memory storage fallback
let inMemoryData = {
  users: [],
  feedbacks: [],
  networkData: []
};

function setupInMemoryStorage() {
  console.log('📝 Using in-memory storage for demo purposes');
  
  // Add some sample data for demo
  const sampleUsers = [
    {
      _id: '1',
      email: 'admin@college.edu',
      password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password: password
      college: 'bmsit', // Changed to match admin's college
      role: 'admin',
      subscription: { active: true, plan: 'premium', expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      createdAt: new Date()
    },
    {
      _id: '2',
      email: 'student@college.edu',
      password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password: password
      college: 'bmsit', // Changed to match admin's college
      role: 'user',
      subscription: { active: false, plan: 'basic', expiresAt: null },
      createdAt: new Date()
    }
  ];

  const sampleFeedbacks = [
    {
      _id: '1',
      title: 'WiFi Issues in Library',
      message: 'The WiFi connection in the main library is very slow and keeps dropping.',
      priority: 'high',
      college: 'bmsit', // Changed to match admin's college
      userId: '2', // Associate with student user
      passkey: '1234567890',
      status: 'pending',
      adminNotes: null,
      submittedAt: new Date(),
      resolvedAt: null,
      location: { latitude: 40.7128, longitude: -74.0060 }
    },
    {
      _id: '2',
      title: 'Cafeteria Food Quality',
      message: 'The food quality in the cafeteria has been declining recently.',
      priority: 'mid',
      college: 'bmsit', // Changed to match admin's college
      userId: '2', // Associate with student user
      passkey: '0987654321',
      status: 'in_progress',
      adminNotes: 'Looking into this issue with the food service provider.',
      submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      resolvedAt: null,
      location: { latitude: 40.7130, longitude: -74.0058 }
    }
  ];

  const sampleNetworkData = [
    {
      _id: '1',
      location: { latitude: 40.7128, longitude: -74.0060 },
      networkQuality: 4,
      crowdDensity: 3,
      college: 'bmsit', // Changed to match admin's college
      timestamp: new Date()
    },
    {
      _id: '2',
      location: { latitude: 40.7130, longitude: -74.0058 },
      networkQuality: 5,
      crowdDensity: 2,
      college: 'bmsit', // Changed to match admin's college
      timestamp: new Date()
    }
  ];

  inMemoryData.users = sampleUsers;
  inMemoryData.feedbacks = sampleFeedbacks;
  inMemoryData.networkData = sampleNetworkData;

  console.log('📊 Sample data loaded:');
  console.log('   👤 Demo accounts: admin@college.edu / password, student@college.edu / password');
  console.log('   🔑 Sample feedback passkeys: 1234567890, 0987654321');
}

function startServer() {
  console.log('🔧 Starting server...');
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 College Feedback System running on:`);
    console.log(`   💻 Local: http://localhost:${PORT}`);
    console.log(`   🌐 Network: http://192.168.0.4:${PORT}`);
    console.log(`📱 Open your browser and navigate to any URL above`);
    console.log(`👥 Register as a student or admin to get started`);
    console.log(`📱 To access from other devices, use the Network URL`);
  });
}
