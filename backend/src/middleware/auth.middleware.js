const { verifyToken } = require('../utils/jwt');
const userRepository = require('../repositories/user.repository');
const AppError = require('../utils/app-error');
const asyncHandler = require('../utils/async-handler');

const authenticate = asyncHandler(async (req, res, next) => {
  const authorization = req.get('authorization');
  const bearerToken = authorization && authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
  const token = req.cookies.gm_access || bearerToken;
  if (!token) throw new AppError('Authentication is required.', 401, 'UNAUTHENTICATED');

  const payload = verifyToken(token, 'access');
  const user = await userRepository.findAuthUserById(payload.sub);
  if (!user || user.status !== 'ACTIVE' || user.tokenVersion !== payload.ver) {
    throw new AppError('Your session has expired. Please sign in again.', 401, 'INVALID_SESSION');
  }

  req.user = { id: user.id, email: user.email, username: user.username, roles: user.roles, accountMode: user.accountMode, tokenVersion: user.tokenVersion };
  return next();
});

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.roles.some((role) => allowedRoles.includes(role))) {
      return next(new AppError('You do not have permission to perform this action.', 403, 'FORBIDDEN'));
    }
    return next();
  };
}

module.exports = { authenticate, authorize };
