import { Type } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateLabResultDto {
  @IsString()
  @MaxLength(100)
  test_name!: string;

  @Type(() => Number)
  @IsNumber()
  value!: number;

  @IsString()
  @MaxLength(40)
  unit!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference_range?: string;

  @IsDateString()
  measured_at!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}