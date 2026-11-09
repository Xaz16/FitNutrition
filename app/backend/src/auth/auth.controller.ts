import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { credentialsSchema, type Credentials } from './auth.schemas.js';
import { CurrentUserId, Public } from './auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body({ schema: credentialsSchema }) body: Credentials) {
    return this.auth.register(body);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body({ schema: credentialsSchema }) body: Credentials) {
    return this.auth.login(body);
  }

  @Get('me')
  me(@CurrentUserId() userId: string) {
    return this.auth.me(userId);
  }
}
