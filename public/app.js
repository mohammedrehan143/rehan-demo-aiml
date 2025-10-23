// Global variables
let currentUser = null;
let socket = null;
let stripe = null;
let elements = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

function initializeApp() {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            currentUser = {
                userId: payload.userId,
                email: payload.email,
                role: payload.role,
                college: payload.college
            };
            showDashboard();
        } catch (error) {
            localStorage.removeItem('token');
        }
    }

    // Initialize Stripe
    if (typeof Stripe !== 'undefined') {
        stripe = Stripe('pk_test_51234567890abcdefghijklmnopqrstuvwxyz1234567890'); // Test key for demo
    }

    // Initialize Socket.io
    socket = io();
}

function setupEventListeners() {
    // Navigation
    document.getElementById('loginBtn').addEventListener('click', showLogin);
    document.getElementById('registerBtn').addEventListener('click', showRegister);
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Auth forms
    document.getElementById('showRegister').addEventListener('click', showRegisterForm);
    document.getElementById('showLogin').addEventListener('click', showLoginForm);
    document.getElementById('loginFormElement').addEventListener('submit', handleLogin);
    document.getElementById('registerFormElement').addEventListener('submit', handleRegister);

    // Feedback
    document.getElementById('feedbackForm').addEventListener('submit', handleFeedbackSubmit);
    document.getElementById('checkStatus').addEventListener('click', checkFeedbackStatus);

    // Network analysis
    document.getElementById('getLocation').addEventListener('click', analyzeNetwork);

    // Subscription
    document.getElementById('subscribeBtn').addEventListener('click', showPaymentModal);
    document.getElementById('confirmPayment').addEventListener('click', processPayment);
    document.getElementById('cancelPayment').addEventListener('click', hidePaymentModal);
}

// Authentication functions
function showLogin() {
    document.getElementById('welcomeSection').classList.add('hidden');
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
}

function showRegister() {
    document.getElementById('welcomeSection').classList.add('hidden');
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
    document.getElementById('loginForm').classList.add('hidden');
}

function showLoginForm() {
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
}

function showRegisterForm() {
    document.getElementById('registerForm').classList.remove('hidden');
    document.getElementById('loginForm').classList.add('hidden');
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<div class="loading"></div> Logging in...';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            showToast('Login successful!', 'success');
            // Clear form fields
            document.getElementById('loginEmail').value = '';
            document.getElementById('loginPassword').value = '';
            showDashboard();
        } else {
            showToast(data.message, 'error');
            // Clear password field on error
            document.getElementById('loginPassword').value = '';
        }
    } catch (error) {
        showToast('Login failed. Please try again.', 'error');
    } finally {
        // Restore button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const college = document.getElementById('registerCollege').value;
    const role = document.getElementById('registerRole').value;
    
    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<div class="loading"></div> Creating account...';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password, college, role })
        });

        const data = await response.json();
        
        if (response.ok) {
            showToast('Registration successful! Please login.', 'success');
            // Clear form fields
            document.getElementById('registerEmail').value = '';
            document.getElementById('registerPassword').value = '';
            document.getElementById('registerCollege').value = '';
            document.getElementById('registerRole').value = 'user';
            showLoginForm();
        } else {
            showToast(data.message, 'error');
            // Clear password field on error
            document.getElementById('registerPassword').value = '';
        }
    } catch (error) {
        showToast('Registration failed. Please try again.', 'error');
    } finally {
        // Restore button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function logout() {
    localStorage.removeItem('token');
    currentUser = null;
    document.getElementById('welcomeSection').classList.remove('hidden');
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('userDashboard').classList.add('hidden');
    document.getElementById('adminDashboard').classList.add('hidden');
    document.getElementById('loginBtn').classList.remove('hidden');
    document.getElementById('registerBtn').classList.remove('hidden');
    document.getElementById('logoutBtn').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('welcomeSection').classList.add('hidden');
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('loginBtn').classList.add('hidden');
    document.getElementById('registerBtn').classList.add('hidden');
    document.getElementById('logoutBtn').classList.remove('hidden');

    if (currentUser.role === 'admin') {
        document.getElementById('adminDashboard').classList.remove('hidden');
        loadAdminFeedbacks();
    } else {
        document.getElementById('userDashboard').classList.remove('hidden');
        showUserHomePage();
        loadUserData();
    }

    // Join college room for real-time updates
    if (socket) {
        socket.emit('join-college', currentUser.college);
        
        // Listen for new feedback notifications (for admin)
        if (currentUser.role === 'admin') {
            socket.on('new-feedback', (data) => {
                console.log('New feedback received:', data);
                showToast(`New feedback submitted: ${data.feedback.title}`, 'info');
                // Reload admin feedbacks to show the new one
                loadAdminFeedbacks();
            });
        }
    }
}

// New navigation functions
function showUserHomePage() {
    document.getElementById('userHomePage').classList.remove('hidden');
    document.getElementById('feedbackPage').classList.add('hidden');
    document.getElementById('trackingPage').classList.add('hidden');
    document.getElementById('networkPage').classList.add('hidden');
    loadMyFeedbacks();
}

function showFeedbackPage() {
    document.getElementById('userHomePage').classList.add('hidden');
    document.getElementById('feedbackPage').classList.remove('hidden');
    document.getElementById('trackingPage').classList.add('hidden');
    document.getElementById('networkPage').classList.add('hidden');
}

function showTrackingPage() {
    document.getElementById('userHomePage').classList.add('hidden');
    document.getElementById('feedbackPage').classList.add('hidden');
    document.getElementById('trackingPage').classList.remove('hidden');
    document.getElementById('networkPage').classList.add('hidden');
}

function showNetworkPage() {
    document.getElementById('userHomePage').classList.add('hidden');
    document.getElementById('feedbackPage').classList.add('hidden');
    document.getElementById('trackingPage').classList.add('hidden');
    document.getElementById('networkPage').classList.remove('hidden');
}

// Feedback functions
async function handleFeedbackSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('feedbackTitle').value;
    const message = document.getElementById('feedbackMessage').value;
    const priority = document.querySelector('input[name="priority"]:checked').value;

    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<div class="loading"></div> Submitting...';
    submitBtn.disabled = true;

    // Get user location
    let location = null;
    if (navigator.geolocation) {
        try {
            const position = await getCurrentPosition();
            location = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };
        } catch (error) {
            console.log('Location access denied');
        }
    }

    try {
        const response = await fetch('/api/feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ title, message, priority, location })
        });

        const data = await response.json();
        
        if (response.ok) {
            showToast(`✅ Feedback submitted successfully! Your passkey is: ${data.passkey}`, 'success');
            document.getElementById('feedbackForm').reset();
            // Redirect to home page and show the new feedback
            showUserHomePage();
            loadMyFeedbacks();
        } else if (response.status === 402) {
            showToast('Subscription required for high priority feedback', 'error');
            showPaymentModal();
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        showToast('Failed to submit feedback. Please try again.', 'error');
    } finally {
        // Restore button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

async function checkFeedbackStatus() {
    const passkey = document.getElementById('statusPasskey').value;
    if (!passkey || passkey.length !== 10) {
        showToast('Please enter a valid 10-digit passkey', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/feedback/status/${passkey}`);
        const data = await response.json();
        
        if (response.ok) {
            displayStatusResult(data);
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        showToast('Failed to check status. Please try again.', 'error');
    }
}

function displayStatusResult(feedback) {
    const statusResult = document.getElementById('statusResult');
    const statusClass = `status-${feedback.status.replace('_', '')}`;
    
    statusResult.innerHTML = `
        <div class="bg-white p-4 rounded-lg border-l-4 ${getPriorityClass(feedback.priority)}">
            <h4 class="font-semibold text-lg">${feedback.title}</h4>
            <p class="text-gray-600 mb-2">${feedback.message}</p>
            <div class="flex justify-between items-center">
                <span class="text-sm ${statusClass} font-medium">Status: ${feedback.status.replace('_', ' ').toUpperCase()}</span>
                <span class="text-sm text-gray-500">Submitted: ${new Date(feedback.submittedAt).toLocaleDateString()}</span>
            </div>
            ${feedback.adminNotes ? `<p class="text-sm text-gray-600 mt-2"><strong>Admin Notes:</strong> ${feedback.adminNotes}</p>` : ''}
        </div>
    `;
    statusResult.classList.remove('hidden');
}

// Network analysis functions
async function analyzeNetwork() {
    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by this browser', 'error');
        return;
    }

    try {
        const position = await getCurrentPosition();
        const { latitude, longitude } = position.coords;
        
        // Record current network quality (simulated)
        const networkQuality = Math.floor(Math.random() * 5) + 1;
        const crowdDensity = Math.floor(Math.random() * 5) + 1;
        
        // Submit network data
        await fetch('/api/network-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                location: { latitude, longitude },
                networkQuality,
                crowdDensity,
                college: currentUser.college
            })
        });

        // Get network analysis
        const response = await fetch(`/api/network-analysis/${currentUser.college}?lat=${latitude}&lng=${longitude}`);
        const analysis = await response.json();
        
        displayNetworkResults(analysis);
    } catch (error) {
        showToast('Failed to analyze network. Please try again.', 'error');
    }
}

function displayNetworkResults(analysis) {
    const networkResults = document.getElementById('networkResults');
    
    if (analysis.length === 0) {
        networkResults.innerHTML = '<p class="text-gray-500">No network data available yet.</p>';
        return;
    }

    const topLocations = analysis.slice(0, 5);
    networkResults.innerHTML = topLocations.map((location, index) => `
        <div class="p-3 bg-gray-50 rounded-lg">
            <div class="flex justify-between items-center">
                <span class="text-sm font-medium">Location ${index + 1}</span>
                <div class="flex items-center">
                    <span class="text-yellow-500 mr-1">★</span>
                    <span class="text-sm">${location.averageQuality.toFixed(1)}</span>
                </div>
            </div>
            <p class="text-xs text-gray-500">Crowd: ${location.averageCrowdDensity.toFixed(1)}/5</p>
        </div>
    `).join('');
}

// Payment functions
function showPaymentModal() {
    document.getElementById('paymentModal').classList.remove('hidden');
    initializeStripeElements();
}

function hidePaymentModal() {
    document.getElementById('paymentModal').classList.add('hidden');
}

async function initializeStripeElements() {
    if (!stripe) {
        showToast('Stripe not initialized', 'error');
        return;
    }

    try {
        const response = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ amount: 9.99 })
        });

        const { clientSecret } = await response.json();
        
        elements = stripe.elements({
            clientSecret: clientSecret
        });

        const cardElement = elements.create('card');
        cardElement.mount('#card-element');
    } catch (error) {
        showToast('Failed to initialize payment', 'error');
    }
}

async function processPayment() {
    if (!stripe || !elements) {
        showToast('Payment system not ready', 'error');
        return;
    }

    try {
        const { error, paymentIntent } = await stripe.confirmCardPayment(
            elements._clientSecret,
            {
                payment_method: {
                    card: elements.getElement('card')
                }
            }
        );

        if (error) {
            showToast(error.message, 'error');
        } else if (paymentIntent.status === 'succeeded') {
            // Activate subscription
            await fetch('/api/activate-subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ plan: 'premium' })
            });

            showToast('Subscription activated successfully!');
            hidePaymentModal();
            loadUserData();
        }
    } catch (error) {
        showToast('Payment failed. Please try again.', 'error');
    }
}

// Admin functions
async function loadAdminFeedbacks() {
    try {
        const response = await fetch('/api/admin/feedback', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        const feedbacks = await response.json();
        displayAdminFeedbacks(feedbacks);
    } catch (error) {
        showToast('Failed to load feedbacks', 'error');
    }
}

function displayAdminFeedbacks(feedbacks) {
    const adminFeedbacks = document.getElementById('adminFeedbacks');
    
    if (feedbacks.length === 0) {
        adminFeedbacks.innerHTML = '<p class="text-gray-500">No feedbacks available.</p>';
        return;
    }

    adminFeedbacks.innerHTML = feedbacks.map(feedback => `
        <div class="border rounded-lg p-4 ${getPriorityClass(feedback.priority)}">
            <div class="flex justify-between items-start mb-2">
                <h4 class="font-semibold">${feedback.title}</h4>
                <span class="text-sm ${getStatusClass(feedback.status)}">${feedback.status.replace('_', ' ').toUpperCase()}</span>
            </div>
            <p class="text-gray-600 mb-3">${feedback.message}</p>
            <div class="flex justify-between items-center mb-3">
                <span class="text-sm text-gray-500">Passkey: ${feedback.passkey}</span>
                <span class="text-sm text-gray-500">${new Date(feedback.submittedAt).toLocaleDateString()}</span>
            </div>
            <div class="flex space-x-2">
                <select class="px-3 py-1 border border-gray-300 rounded text-sm" onchange="updateFeedbackStatus('${feedback._id}', this.value)">
                    <option value="pending" ${feedback.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="in_progress" ${feedback.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                    <option value="resolved" ${feedback.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                    <option value="rejected" ${feedback.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                </select>
                <input type="text" placeholder="Admin notes" class="px-3 py-1 border border-gray-300 rounded text-sm flex-1" 
                       onchange="updateAdminNotes('${feedback._id}', this.value)" value="${feedback.adminNotes || ''}">
            </div>
        </div>
    `).join('');
}

async function updateFeedbackStatus(feedbackId, status) {
    try {
        const response = await fetch(`/api/admin/feedback/${feedbackId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ status })
        });

        if (response.ok) {
            showToast('Status updated successfully');
            loadAdminFeedbacks();
        } else {
            showToast('Failed to update status', 'error');
        }
    } catch (error) {
        showToast('Failed to update status', 'error');
    }
}

async function updateAdminNotes(feedbackId, notes) {
    try {
        const response = await fetch(`/api/admin/feedback/${feedbackId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ adminNotes: notes })
        });

        if (response.ok) {
            showToast('Notes updated successfully');
        } else {
            showToast('Failed to update notes', 'error');
        }
    } catch (error) {
        showToast('Failed to update notes', 'error');
    }
}

// User data functions
async function loadUserData() {
    // Load subscription status and other user data
    // This would typically fetch from a user profile endpoint
    const subscriptionStatus = document.getElementById('subscriptionStatus');
    if (subscriptionStatus) {
        subscriptionStatus.innerHTML = '<p class="text-gray-600">Basic plan - Upgrade for high priority feedback</p>';
    }
}

// Load user's submitted feedbacks
async function loadMyFeedbacks() {
    try {
        // Get user's own feedbacks
        const response = await fetch('/api/user/feedbacks', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            const feedbacks = await response.json();
            displayMyFeedbacks(feedbacks);
        } else {
            console.log('Failed to load user feedbacks');
            displayMyFeedbacks([]);
        }
    } catch (error) {
        console.log('Failed to load feedbacks:', error);
        displayMyFeedbacks([]);
    }
}

function displayMyFeedbacks(feedbacks) {
    const myFeedbacks = document.getElementById('myFeedbacks');
    
    if (feedbacks.length === 0) {
        myFeedbacks.innerHTML = '<p class="text-gray-500 text-center py-4">No feedbacks submitted yet. Click "Submit Feedback" to get started!</p>';
        return;
    }

    // Sort by submission date (newest first)
    feedbacks.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    myFeedbacks.innerHTML = feedbacks.map((feedback, index) => `
        <div class="bg-gray-50 p-4 rounded-lg border-l-4 ${getPriorityClass(feedback.priority)}">
            <div class="flex justify-between items-start mb-2">
                <div class="flex-1">
                    <h4 class="font-semibold text-lg">Feedback ${index + 1}: ${feedback.title}</h4>
                    <p class="text-gray-600 text-sm mt-1">${feedback.message}</p>
                </div>
                <div class="text-right ml-4">
                    <div class="text-sm ${getStatusClass(feedback.status)} font-medium mb-1">
                        ${feedback.status.replace('_', ' ').toUpperCase()}
                    </div>
                    <div class="text-xs text-gray-500">
                        ${new Date(feedback.submittedAt).toLocaleDateString()}
                    </div>
                </div>
            </div>
            <div class="flex justify-between items-center">
                <div class="text-sm text-gray-600">
                    <span class="font-medium">Passkey:</span> 
                    <span class="font-mono bg-gray-200 px-2 py-1 rounded">${feedback.passkey}</span>
                </div>
                <div class="text-sm ${getPriorityClass(feedback.priority)} font-medium">
                    ${feedback.priority.toUpperCase()} Priority
                </div>
            </div>
            ${feedback.adminNotes ? `
                <div class="mt-3 p-3 bg-blue-50 rounded border-l-2 border-blue-400">
                    <div class="text-sm font-medium text-blue-800">Admin Response:</div>
                    <div class="text-sm text-blue-700 mt-1">${feedback.adminNotes}</div>
                </div>
            ` : ''}
        </div>
    `).join('');
}

// Utility functions
function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
    });
}

function getPriorityClass(priority) {
    return `priority-${priority}`;
}

function getStatusClass(status) {
    return `status-${status.replace('_', '')}`;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    
    // Set colors and icons based on type
    let bgColor, icon;
    if (type === 'error') {
        bgColor = 'bg-red-500';
        icon = '❌';
    } else if (type === 'success') {
        bgColor = 'bg-green-500';
        icon = '✅';
    } else {
        bgColor = 'bg-blue-500';
        icon = 'ℹ️';
    }
    
    toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${bgColor} text-white slide-up`;
    toast.innerHTML = `
        <div class="flex items-center">
            <span class="mr-2">${icon}</span>
            <span id="toastMessage">${message}</span>
        </div>
    `;
    
    toast.classList.remove('hidden');
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

// Make functions globally available for inline event handlers
window.updateFeedbackStatus = updateFeedbackStatus;
window.updateAdminNotes = updateAdminNotes;
window.showUserHomePage = showUserHomePage;
window.showFeedbackPage = showFeedbackPage;
window.showTrackingPage = showTrackingPage;
window.showNetworkPage = showNetworkPage;
