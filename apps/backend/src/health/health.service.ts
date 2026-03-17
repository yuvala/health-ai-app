import { Inject, Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";
import type { CreateLabResultDto } from "./dto/create-lab-result.dto";

@Injectable()
export class HealthService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  private client() {
    const url = this.config.get<string>("SUPABASE_URL");
    const key = this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      throw new InternalServerErrorException("Missing Supabase service role configuration");
    }
    return createClient(url, key);
  }

  async listLabResults(userId: string) {
    const supabase = this.client();
    const { data, error } = await supabase
      .from("lab_results")
      .select("*")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data ?? [];
  }

  async createLabResult(userId: string, dto: CreateLabResultDto) {
    const supabase = this.client();
    const { data, error } = await supabase
      .from("lab_results")
      .insert({ ...dto, user_id: userId })
      .select("*")
      .single();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data;
  }
}