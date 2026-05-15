import dotenv from 'dotenv'
dotenv.config()

function required(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Brakująca zmienna środowiskowa: ${key}`)
  return val
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  databaseUrl: required('DATABASE_URL'),
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessExpires: process.env.JWT_ACCESS_EXPIRES ?? '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES ?? '7d',
  },
  cors: {
    origin: process.env.CORS_ORIGIN ?? '*',
  },
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
}
