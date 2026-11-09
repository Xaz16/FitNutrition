import { Module } from '@nestjs/common';
import { AI_ADVISOR } from '../ai/ai-advisor.js';
import { StubAiAdvisor, UnavailableAiAdvisor } from '../ai/stub-ai-advisor.js';
import { PlanContextService } from './plan-context.service.js';
import { PlanInsightsService } from './plan-insights.service.js';
import { PlansController } from './plans.controller.js';
import { PlansService } from './plans.service.js';

@Module({
  controllers: [PlansController],
  providers: [
    PlanContextService,
    PlansService,
    PlanInsightsService,
    {
      provide: AI_ADVISOR,
      useFactory: () => (process.env.AI_ADVISOR_MODE === 'unavailable' ? new UnavailableAiAdvisor() : new StubAiAdvisor()),
    },
  ],
})
export class PlansModule {}
