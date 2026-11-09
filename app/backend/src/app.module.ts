import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { CatalogController } from './catalog/catalog.controller.js';
import { PlansModule } from './plans/plans.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProfileController } from './profile/profile.controller.js';
import { ProfileService } from './profile/profile.service.js';

@Module({
  imports: [PrismaModule, AuthModule, PlansModule],
  controllers: [ProfileController, CatalogController],
  providers: [ProfileService],
})
export class AppModule {}
