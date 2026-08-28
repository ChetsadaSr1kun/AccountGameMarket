const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./config/env');
const authRoutes = require('./routes/auth.routes');
const chatRoutes = require('./routes/chat.routes');
const adminDashboardRoutes = require('./routes/admin-dashboard.routes');
const adminModerationRoutes = require('./routes/admin-moderation.routes');
const adminUserRoutes = require('./routes/admin-user.routes');
const adminProductRoutes = require('./routes/admin-product.routes');
const userRoutes = require('./routes/user.routes');
const gameRoutes = require('./routes/game.routes');
const productRoutes = require('./routes/product.routes');
const publicProductRoutes = require('./routes/public-product.routes');
const sellerVerificationRoutes = require('./routes/seller-verification.routes');
const orderRoutes = require('./routes/order.routes');
const walletRoutes = require('./routes/wallet.routes');
const walletTopupRoutes = require('./routes/wallet-topup.routes');
const walletAdminRoutes = require('./routes/wallet-admin.routes');
const reviewRoutes = require('./routes/review.routes');
const reviewReportRoutes = require('./routes/review-report.routes');
const sellerProfileRoutes = require('./routes/seller-profile.routes');
const transactionReportRoutes = require('./routes/transaction-report.routes');
const { globalLimit } = require('./middleware/rate-limit.middleware');
const { notFound, errorHandler } = require('./middleware/error-handler.middleware');

const app = express();
const projectRoot = path.resolve(__dirname, '../..');
const allowedOrigins = config.frontendOrigin.split(',').map((origin) => origin.trim());

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({
  // The existing frontend still uses inline event handlers. Enable a strict CSP
  // after moving those handlers into assets/js/script.js in the frontend module.
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Idempotency-Key'],
}));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/api', globalLimit);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'GameMarket API is running', timestamp: new Date().toISOString() });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/admin/dashboard', adminDashboardRoutes);
app.use('/api/v1/admin/moderation', adminModerationRoutes);
app.use('/api/v1/admin/users', adminUserRoutes);
app.use('/api/v1/admin/products', adminProductRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/games', gameRoutes);
app.use('/api/v1/user/products', productRoutes);
app.use('/api/v1/products', publicProductRoutes);
app.use('/api/v1/seller-verification', sellerVerificationRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/wallet/topup', walletTopupRoutes);
app.use('/api/v1/admin/wallet', walletAdminRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/review-reports', reviewReportRoutes);
app.use('/api/v1/sellers', sellerProfileRoutes);
app.use('/api/v1/transaction-reports', transactionReportRoutes);

app.get('/', (req, res) => res.sendFile(path.join(projectRoot, 'index.html')));
app.use('/assets', express.static(path.join(projectRoot, 'assets'), { index: false }));
app.use('/uploads/avatars', express.static(path.join(projectRoot, 'uploads', 'avatars'), { dotfiles: 'deny', fallthrough: false, index: false, redirect: false }));
app.use('/uploads/products', express.static(path.join(projectRoot, 'uploads', 'products'), { dotfiles: 'deny', fallthrough: false, index: false, redirect: false }));

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;

