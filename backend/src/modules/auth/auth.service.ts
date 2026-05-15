import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { prisma } from '../../lib/prisma'
import { env } from '../../config/env'
import { ApiError } from '../../shared/ApiError'
import { LoginDto } from './auth.schemas'

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function generateAccessToken(payload: { sub: string; login: string; role: string; canRentEquipment: boolean; canOrder: boolean; canPrepare: boolean }) {
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpires as jwt.SignOptions['expiresIn'],
  })
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex')
}

export async function login(dto: LoginDto) {
  const user = await prisma.user.findUnique({
    where: { login: dto.login },
    include: { role: true },
  })

  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Nieprawidłowy login lub hasło')
  }

  const valid = await bcrypt.compare(dto.password, user.passwordHash)
  if (!valid) {
    throw ApiError.unauthorized('Nieprawidłowy login lub hasło')
  }

  const accessToken = generateAccessToken({
    sub: user.id,
    login: user.login,
    role: user.role.name,
    canRentEquipment: user.canRentEquipment,
    canOrder: user.canOrder,
    canPrepare: user.canPrepare,
  })

  const refreshToken = generateRefreshToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await prisma.$transaction([
    prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
  ])

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      login: user.login,
      fullName: user.fullName,
      role: user.role.name,
      canRentEquipment: user.canRentEquipment,
      canOrder: user.canOrder,
      canPrepare: user.canPrepare,
    },
  }
}

export async function refresh(token: string) {
  const tokenHash = hashToken(token)

  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash, expiresAt: { gt: new Date() } },
    include: { user: { include: { role: true } } },
  })

  if (!stored || !stored.user.isActive) {
    throw ApiError.unauthorized('Nieprawidłowy token odświeżania')
  }

  // Rotacja tokenu
  await prisma.refreshToken.delete({ where: { id: stored.id } })

  const accessToken = generateAccessToken({
    sub: stored.user.id,
    login: stored.user.login,
    role: stored.user.role.name,
    canRentEquipment: stored.user.canRentEquipment,
    canOrder: stored.user.canOrder,
    canPrepare: stored.user.canPrepare,
  })

  const newRefreshToken = generateRefreshToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await prisma.refreshToken.create({
    data: {
      userId: stored.user.id,
      tokenHash: hashToken(newRefreshToken),
      expiresAt,
    },
  })

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: {
      id: stored.user.id,
      login: stored.user.login,
      fullName: stored.user.fullName,
      role: stored.user.role.name,
      canRentEquipment: stored.user.canRentEquipment,
      canOrder: stored.user.canOrder,
      canPrepare: stored.user.canPrepare,
    },
  }
}

export async function logout(token: string) {
  const tokenHash = hashToken(token)
  await prisma.refreshToken.deleteMany({ where: { tokenHash } })
}
