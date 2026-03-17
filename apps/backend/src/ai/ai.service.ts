import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { buildLabExplanationPrompt, MEDICAL_DISCLAIMER } from "./prompt";
import type { LabInputDto } from "./dto/analyze-labs.dto";

@Injectable()
export class AiService {
  private readonly openai: OpenAI;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("OPENAI_API_KEY");
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required");
    }
    this.openai = new OpenAI({ apiKey });
  }

  async analyzeLabs(params: { userId: string; labs: LabInputDto[] }) {
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

    const summary =
      completion.choices[0]?.message?.content?.trim() ??
      "No explanation could be generated at this time.";

    await this.saveInsightIfConfigured(params.userId, summary);

    return {
      summary,
      disclaimer: MEDICAL_DISCLAIMER
    };
  }

  private async saveInsightIfConfigured(userId: string, text: string) {
    const url = this.config.get<string>("SUPABASE_URL");
    const key = this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      return;
    }
    const supabase = createClient(url, key);
    await supabase.from("ai_insights").insert({
      user_id: userId,
      source_type: "lab_results",
      insight_text: text
    });
  }
}