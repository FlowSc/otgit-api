const jwt = require('jsonwebtoken');

const JWT_SECRET = 'otgit_super_secure_jwt_secret_key_2025_production_ready_for_dating_app_authentication_system';

const payload = {
  sub: 'test-user-123',
  name: 'Test User',
  email: 'test@example.com',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (60 * 30) // 30분 후 만료
};

const token = jwt.sign(payload, JWT_SECRET);
console.log('Generated test JWT token:');
console.log(token);