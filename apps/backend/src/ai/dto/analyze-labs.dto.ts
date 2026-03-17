import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from "class-validator";

export class LabInputDto {
  @IsString()
  @MaxLength(100)
  testName!: string;

  @Type(() => Number)
  @IsNumber()
  value!: number;

  @IsString()
  @MaxLength(40)
  unit!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceRange?: string;

  @IsDateString()
  measuredAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class AnalyzeLabsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LabInputDto)
  results!: LabInputDto[];
}