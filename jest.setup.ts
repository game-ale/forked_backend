// Provide dummy required environment variables for Zod parsing during unit tests
process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_ANON_KEY = 'dummy-anon-key';
process.env.SUPABASE_JWT_SECRET = 'dummy-jwt-secret';
process.env.AUTH_DEVICE_TOKEN_PEPPER = 'dummy-pepper';
