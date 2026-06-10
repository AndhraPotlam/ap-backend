import { test, expect } from '@playwright/test';

test.describe('Auth API Integration Tests', () => {
  // Generate random credentials to avoid conflicts across test runs
  const randomSuffix = Math.floor(Math.random() * 1000000);
  const testEmail = `testuser_${randomSuffix}@example.com`;
  // Needs to be 10 digits
  const testPhone = Math.floor(1000000000 + Math.random() * 9000000000).toString();
  const testPassword = 'Password123!';

  test('should successfully register a new user', async ({ request }) => {
    const response = await request.post('users/register', {
      data: {
        firstName: 'Test',
        lastName: 'User',
        email: testEmail,
        phoneNumber: testPhone,
        password: testPassword,
        role: 'user'
      }
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toHaveProperty('message', 'Registration successful');
    expect(body).toHaveProperty('user');
    expect(body.user).toHaveProperty('email', testEmail.toLowerCase());
  });

  test('should fail to register with the same email', async ({ request }) => {
    // Attempt with the same email
    const response = await request.post('users/register', {
      data: {
        firstName: 'Test',
        lastName: 'User2',
        email: testEmail,
        phoneNumber: testPhone,
        password: testPassword,
        role: 'user'
      }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('message', 'Validation failed');
  });

  test('should successfully log in and return a JWT token', async ({ request }) => {
    const response = await request.post('users/login', {
      data: {
        email: testEmail,
        password: testPassword
      }
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('message', 'Login successful');
    expect(body).toHaveProperty('token');
    expect(body).toHaveProperty('user');
    expect(body.user).toHaveProperty('email', testEmail.toLowerCase());
    
    // Store token for next tests
    process.env.TEST_JWT_TOKEN = body.token;
  });

  test('should fetch user details using authorization header', async ({ request }) => {
    const token = process.env.TEST_JWT_TOKEN;
    expect(token).toBeDefined();

    const response = await request.get('users/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('email', testEmail.toLowerCase());
    expect(body).toHaveProperty('role', 'user');
  });

  test('should fail to fetch user details with invalid token', async ({ request }) => {
    const response = await request.get('users/me', {
      headers: {
        'Authorization': 'Bearer invalid_token_here'
      }
    });

    expect(response.status()).toBe(401);
  });
});
