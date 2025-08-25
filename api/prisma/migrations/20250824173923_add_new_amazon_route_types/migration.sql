-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."RouteType" ADD VALUE 'ORDT_EXTRA_LARGE_CARGO_VAN';
ALTER TYPE "public"."RouteType" ADD VALUE 'STANDARD_PARCEL_MEDIUM_VAN';
ALTER TYPE "public"."RouteType" ADD VALUE 'NURSERY_ROUTE_LEVEL_1';
ALTER TYPE "public"."RouteType" ADD VALUE 'NURSERY_ROUTE_LEVEL_2';
ALTER TYPE "public"."RouteType" ADD VALUE 'NURSERY_ROUTE_LEVEL_3';
ALTER TYPE "public"."RouteType" ADD VALUE 'STANDARD_PARCEL';
ALTER TYPE "public"."RouteType" ADD VALUE 'STANDARD_PARCEL_LOW_EMISSION_VEHICLE_LARGE';
ALTER TYPE "public"."RouteType" ADD VALUE 'STANDARD_PARCEL_WITH_HELPER';
ALTER TYPE "public"."RouteType" ADD VALUE 'STANDARD_PARCEL_RIDE_ALONG_IRONHIDE_MEDIUM_VAN';
ALTER TYPE "public"."RouteType" ADD VALUE 'STANDARD_PARCEL_RIDE_ALONG_MENTEE_IRONHIDE_MEDIUM_VAN';

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "avatar" TEXT;
