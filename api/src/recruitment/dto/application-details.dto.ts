import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from "class-validator";

/** Optional fields from the supplied application-form reference. */
export class ApplicationDetailsDto {
  @IsOptional() @IsString() @MaxLength(120) preferredSite?: string;
  @IsOptional() @IsDateString() ukEntryDate?: string;
  @IsOptional() @IsString() @MaxLength(100) town?: string;
  @IsOptional() @IsString() @MaxLength(100) cityOfBirth?: string;
  @IsOptional() @IsString() @MaxLength(100) countryOfBirth?: string;
  @IsOptional() @Matches(/^\d{10}$/) utr?: string;
  @IsOptional() @IsIn(["UK", "EU", "OTHER"]) licenceType?: string;
  @IsOptional() @IsDateString() licenceValidFrom?: string;
  @IsOptional() @IsString() @MaxLength(1000) pointsDetails?: string;
  @IsOptional() @IsIn(["yes", "no"]) deliveryExperience?: string;
  @IsOptional() @IsString() @MaxLength(200) previousCompany?: string;
  @IsOptional() @IsString() @MaxLength(100) experienceDuration?: string;
  @IsOptional() @IsDateString() availableFrom?: string;
  @IsOptional() @IsIn(["yes", "no"]) ownVan?: string;
  @IsOptional() @IsString() @MaxLength(150) vanMakeModel?: string;
  @IsOptional() @IsIn(["yes", "no"]) courierInsurance?: string;
  @IsOptional() @IsIn(["yes", "no"]) hireVan?: string;
  @IsOptional() @IsString() @MaxLength(150) referredBy?: string;
}
