import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";
import { HealthService } from "./health.service";
import { CreateLabResultDto } from "./dto/create-lab-result.dto";

@Controller("health")
@UseGuards(SupabaseAuthGuard)
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get("lab-results")
  listLabResults(@CurrentUser() user: AuthUser) {
    return this.healthService.listLabResults(user.id);
  }

  @Post("lab-results")
  createLabResult(@CurrentUser() user: AuthUser, @Body() dto: CreateLabResultDto) {
    return this.healthService.createLabResult(user.id, dto);
  }
}