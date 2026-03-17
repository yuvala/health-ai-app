import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
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

  @Post("documents/:documentId/process")
  queueDocumentForProcessing(
    @CurrentUser() user: AuthUser,
    @Param("documentId", new ParseUUIDPipe({ version: "4" })) documentId: string
  ) {
    return this.healthService.enqueueDocumentExtraction(user.id, documentId);
  }

  @Get("documents/extractions")
  listDocumentExtractions(@CurrentUser() user: AuthUser) {
    return this.healthService.listDocumentExtractions(user.id);
  }
}
