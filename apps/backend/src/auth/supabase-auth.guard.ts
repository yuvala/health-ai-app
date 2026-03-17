import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private supabaseClient: SupabaseClient | null = null;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const supabase = this.getSupabaseClient();

    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) {
        throw new UnauthorizedException("Invalid access token");
      }

      req.user = {
        id: data.user.id,
        email: data.user.email
      };

      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }

      throw new InternalServerErrorException(
        `Supabase auth validation failed due to connectivity/config issue: ${err instanceof Error ? err.message : "unknown error"}`
      );
    }
  }

  private getSupabaseClient(): SupabaseClient {
    if (this.supabaseClient) {
      return this.supabaseClient;
    }

    const url = this.configService.get<string>("SUPABASE_URL");
    const serviceRoleKey = this.configService.get<string>("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !serviceRoleKey || this.isPlaceholderValue(url) || this.isPlaceholderValue(serviceRoleKey)) {
      throw new InternalServerErrorException(
        "Invalid Supabase auth configuration. Set real SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in apps/backend/.env."
      );
    }

    this.supabaseClient = createClient(url, serviceRoleKey);
    return this.supabaseClient;
  }

  private isPlaceholderValue(value: string): boolean {
    const normalized = value.toLowerCase();
    return normalized.includes("your_project_ref") || normalized.includes("your_supabase_service_role_key");
  }
}
