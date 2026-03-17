import { Inject, Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { buildLabExplanationPrompt, MEDICAL_DISCLAIMER } from "./prompt";
import type { LabInputDto } from "./dto/analyze-labs.dto";

@Injectable()
export class AiService {
  private readonly openai: OpenAI | null;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("OPENAI_API_KEY");
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
  }

  async analyzeLabs(params: { userId: string; labs: LabInputDto[] }) {
    const mockMode = this.isMockModeEnabled();

    let summary: string;
    if (mockMode || !this.openai) {
      summary = this.buildMockSummary(params.labs);
    } else {
      const model = this.config.get<string>("OPENAI_MODEL", "gpt-4.1-mini");
      const prompt = buildLabExplanationPrompt(params.labs);

      const completion = await this.openai.chat.completions.create({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You provide careful educational explanations about health data. Never provide a diagnosis."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      });

      summary =
        completion.choices[0]?.message?.content?.trim() ??
        "No explanation could be generated at this time.";
    }

    await this.saveInsightIfConfigured(params.userId, summary);

    return {
      summary,
      disclaimer: MEDICAL_DISCLAIMER
    };
  }

  private isMockModeEnabled(): boolean {
    const raw = this.config.get<string>("AI_MOCK_MODE", "false");
    return raw.toLowerCase() === "true";
  }

  private buildMockSummary(labs: LabInputDto[]): string {
    const lines = labs.slice(0, 8).map((lab) => {
      const range = lab.referenceRange ? ` (reference: ${lab.referenceRange})` : "";
      return `- ${lab.testName}: ${lab.value} ${lab.unit}${range}`;
    });

    return [
      "Mock AI mode is active, so this is an educational template summary.",
      "Your recent lab values:",
      ...lines,
      "If any value is outside your expected range, discuss it with your clinician and compare against previous trends."
    ].join("\n");
  }

  private async saveInsightIfConfigured(userId: string, text: string) {
    const url = this.config.get<string>("SUPABASE_URL");
    const key = this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      return;
    }
    const supabase = createClient(url, key);
    const { error } = await supabase.from("ai_insights").insert({
      user_id: userId,
      source_type: "lab_results",
      insight_text: text
    });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}