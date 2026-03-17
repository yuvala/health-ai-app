import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { AnalyzeLabsDto } from "./dto/analyze-labs.dto";
import { AiService } from "./ai.service";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";

@Controller("ai")
@UseGuards(SupabaseAuthGuard)
export class AiController {
  constructor(@Inject(AiService) private readonly aiService: AiService) {}

  @Post("analyze-labs")
  analyzeLabs(@CurrentUser() user: AuthUser, @Body() body: AnalyzeLabsDto) {
    return this.aiService.analyzeLabs({ userId: user.id, labs: body.results });
  }
}