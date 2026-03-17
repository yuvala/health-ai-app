import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { jwtVerify } from "jose";

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const secret = this.configService.get<string>("SUPABASE_JWT_SECRET");

    if (!secret) {
      throw new UnauthorizedException("SUPABASE_JWT_SECRET is not configured");
    }

    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
        algorithms: ["HS256"]
      });
      req.user = {
        id: String(payload.sub),
        email: payload.email ? String(payload.email) : undefined
      };
      return true;
    } catch {
      throw new UnauthorizedException("Invalid access token");
    }
  }
}