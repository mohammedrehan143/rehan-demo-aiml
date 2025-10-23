# College Feedback System

An anonymous feedback system designed for college students with priority-based submission, network analysis, and admin management features.

## Features

### For Students
- **Anonymous Feedback Submission**: Submit feedback with 10-digit passkey tracking
- **Priority Levels**: Choose between Low, Mid, and High priority
- **Subscription System**: High priority requires premium subscription
- **Network Analysis**: Find locations with good network based on crowd data
- **Status Tracking**: Check feedback status using passkey

### For Admins
- **Feedback Management**: View and manage all college feedback
- **Status Updates**: Change feedback status (pending, in-progress, resolved, rejected)
- **Admin Notes**: Add notes to feedback for internal communication
- **Real-time Updates**: Live updates when feedback status changes

### Technical Features
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Real-time Communication**: Socket.io for live updates
- **Payment Integration**: Stripe for subscription payments
- **Location Services**: GPS-based network analysis
- **Secure Authentication**: JWT-based user authentication

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd college-feedback-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```
   MONGODB_URI=mongodb://localhost:27017/college-feedback
   JWT_SECRET=your-super-secret-jwt-key-here
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
   STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
   PORT=3000
   ```

4. **Set up MongoDB**
   - Install MongoDB locally or use MongoDB Atlas
   - Update the MONGODB_URI in your .env file

5. **Set up Stripe (for payments)**
   - Create a Stripe account
   - Get your API keys from the Stripe dashboard
   - Update the Stripe keys in your .env file
   - Update the publishable key in `public/app.js`

6. **Start the application**
   ```bash
   npm start
   ```

   For development with auto-restart:
   ```bash
   npm run dev
   ```

## Usage

### For Students

1. **Register/Login**: Create an account or login with existing credentials
2. **Submit Feedback**: 
   - Fill out the feedback form
   - Choose priority level (High requires subscription)
   - Submit and receive a 10-digit passkey
3. **Check Status**: Use the passkey to check feedback status
4. **Network Analysis**: Click "Analyze Current Location" to find good network spots
5. **Subscribe**: Purchase premium subscription for high priority feedback

### For Admins

1. **Login**: Use admin credentials to access admin dashboard
2. **Manage Feedback**: View all feedback from your college
3. **Update Status**: Change feedback status and add admin notes
4. **Real-time Updates**: See live updates as students submit feedback

## API Endpoints

### Authentication
- `POST /api/register` - Register new user
- `POST /api/login` - Login user

### Feedback
- `POST /api/feedback` - Submit feedback
- `GET /api/feedback/status/:passkey` - Check feedback status

### Admin
- `GET /api/admin/feedback` - Get all feedback for college
- `PUT /api/admin/feedback/:id` - Update feedback status/notes

### Network Analysis
- `POST /api/network-data` - Submit network quality data
- `GET /api/network-analysis/:college` - Get network analysis

### Payments
- `POST /api/create-payment-intent` - Create Stripe payment intent
- `POST /api/activate-subscription` - Activate user subscription

## Database Schema

### Users
- email, password, college, role, subscription

### Feedback
- title, message, priority, college, passkey, status, adminNotes, location

### NetworkData
- location, networkQuality, crowdDensity, timestamp, college

## Technologies Used

- **Backend**: Node.js, Express.js, MongoDB, Socket.io
- **Frontend**: HTML5, CSS3, JavaScript, Tailwind CSS
- **Payments**: Stripe
- **Authentication**: JWT, bcryptjs
- **Real-time**: Socket.io

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- CORS protection
- Input validation
- Secure payment processing

## Deployment

1. **Environment Setup**: Configure production environment variables
2. **Database**: Set up production MongoDB instance
3. **Stripe**: Configure production Stripe keys
4. **Server**: Deploy to your preferred hosting platform (Heroku, AWS, etc.)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details
