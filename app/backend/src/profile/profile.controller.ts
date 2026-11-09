import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUserId } from '../auth/auth.guard.js';
import { ProfileService } from './profile.service.js';
import { memberSchema, profileSchema, type MemberInput, type ProfileInput } from './profile.schemas.js';

const memberId = z.uuid();

@Controller()
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Get('profile')
  get(@CurrentUserId() userId: string) {
    return this.profiles.get(userId);
  }

  @Put('profile')
  save(@CurrentUserId() userId: string, @Body({ schema: profileSchema }) body: ProfileInput) {
    return this.profiles.save(userId, body);
  }

  @Post('household/members')
  add(@CurrentUserId() userId: string, @Body({ schema: memberSchema }) body: MemberInput) {
    return this.profiles.addMember(userId, body);
  }

  @Put('household/members/:id')
  update(
    @CurrentUserId() userId: string,
    @Param('id', { schema: memberId }) id: string,
    @Body({ schema: memberSchema }) body: MemberInput,
  ) {
    return this.profiles.updateMember(userId, id, body);
  }

  @Delete('household/members/:id')
  remove(@CurrentUserId() userId: string, @Param('id', { schema: memberId }) id: string) {
    return this.profiles.removeMember(userId, id);
  }
}
