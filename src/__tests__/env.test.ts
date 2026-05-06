import { describe, expect, it, jest } from '@jest/globals';

jest.mock('dotenv', () => ({ config: jest.fn() }));

delete process.env.SUPABASE_DB_URL;
process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_ANON_KEY = 'dummy-anon-key';
process.env.AUTH_DEVICE_TOKEN_PEPPER = 'dummy-pepper';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { env } = require('../config/env') as typeof import('../config/env');

describe('env config', () => {
  it('exports all required fields', () => {
    expect(env).toHaveProperty('appName');
    expect(env).toHaveProperty('appEnv');
    expect(env).toHaveProperty('host');
    expect(env).toHaveProperty('port');
    expect(env).toHaveProperty('prismaConfigured');
  });

  it('defaults port to 8000 when neither APP_PORT nor PORT is set', () => {
    expect(env.port).toBe(8000);
  });

  it('defaults host to 0.0.0.0', () => {
    expect(env.host).toBe('0.0.0.0');
  });

  it('defaults appName to Fuel-Aware Backend', () => {
    expect(env.appName).toBe('Fuel-Aware Backend');
  });

  it('sets prismaConfigured to false when SUPABASE_DB_URL is absent', () => {
    expect(env.prismaConfigured).toBe(false);
  });
});
