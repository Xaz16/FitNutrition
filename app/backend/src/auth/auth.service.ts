import { ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Credentials } from './auth.schemas.js';

export const BCRYPT_COST = 12;
export const MAX_FAILED_LOGINS = 5;
export const FAILURE_WINDOW_MS = 15 * 60_000;
export const LOCK_DURATION_MS = 15 * 60_000;

export interface AuthResult {
  accessToken: string;
  user: { id: string; email: string; hasProfile: boolean };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register({ email, password }: Credentials): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'Пользователь с таким email уже зарегистрирован' });
    }
    const user = await this.prisma.user.create({
      data: { email, passwordHash: await bcrypt.hash(password, BCRYPT_COST) },
    });
    return this.issue(user.id, user.email, false);
  }

  async login({ email, password }: Credentials): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email }, include: { settings: true } });
    const now = new Date();
    if (user?.lockedUntil && user.lockedUntil > now) {
      throw new HttpException(
        { code: 'LOGIN_LOCKED', message: 'Слишком много неудачных попыток. Вход временно заблокирован', lockedUntil: user.lockedUntil },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      if (user) {
        await this.registerFailure(user.id, user.failedLogins, user.firstFailedAt, now);
      }
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Неверные учётные данные' });
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, firstFailedAt: null, lockedUntil: null },
    });
    return this.issue(user.id, user.email, user.settings !== null);
  }

  async me(userId: string): Promise<AuthResult['user']> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { settings: true } });
    return { id: user.id, email: user.email, hasProfile: user.settings !== null };
  }

  private async registerFailure(userId: string, failedLogins: number, firstFailedAt: Date | null, now: Date) {
    const windowExpired = !firstFailedAt || now.getTime() - firstFailedAt.getTime() > FAILURE_WINDOW_MS;
    const attempts = windowExpired ? 1 : failedLogins + 1;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLogins: attempts >= MAX_FAILED_LOGINS ? 0 : attempts,
        firstFailedAt: attempts >= MAX_FAILED_LOGINS ? null : windowExpired ? now : firstFailedAt,
        lockedUntil: attempts >= MAX_FAILED_LOGINS ? new Date(now.getTime() + LOCK_DURATION_MS) : null,
      },
    });
  }

  private async issue(id: string, email: string, hasProfile: boolean): Promise<AuthResult> {
    return { accessToken: await this.jwt.signAsync({ sub: id }), user: { id, email, hasProfile } };
  }
}
