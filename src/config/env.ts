import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  APP_NAME: z.string().default('Fuel-Aware Backend'),
  APP_ENV: z.string().default('development'),
  APP_HOST: z.string().optional(),
  HOST: z.string().optional(),
  APP_PORT: z.coerce.number().int().positive().optional(),
  PORT: z.coerce.number().int().positive().optional(),
  SUPABASE_DB_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  AUTH_DEVICE_TOKEN_PEPPER: z.string().min(1),
});

const parsedEnv = envSchema.parse(process.env);

export const env = {
  appName: parsedEnv.APP_NAME,
  appEnv: parsedEnv.APP_ENV,
  host: parsedEnv.APP_HOST ?? parsedEnv.HOST ?? '0.0.0.0',
  port: parsedEnv.APP_PORT ?? parsedEnv.PORT ?? 8000,
  supabaseDbUrl: parsedEnv.SUPABASE_DB_URL,
  prismaConfigured: Boolean(parsedEnv.SUPABASE_DB_URL),
  supabaseUrl: parsedEnv.SUPABASE_URL,
  supabaseAnonKey: parsedEnv.SUPABASE_ANON_KEY,
  authDeviceTokenPepper: parsedEnv.AUTH_DEVICE_TOKEN_PEPPER,
} as const;
