-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."RouteType" ADD VALUE 'OSM_RATE';
ALTER TYPE "public"."RouteType" ADD VALUE 'OSM_COVER';
ALTER TYPE "public"."RouteType" ADD VALUE 'HELPER_FLEET';
ALTER TYPE "public"."RouteType" ADD VALUE 'SWEEPER';
ALTER TYPE "public"."RouteType" ADD VALUE 'HELPER';
ALTER TYPE "public"."RouteType" ADD VALUE 'ROUTE_9H';
ALTER TYPE "public"."RouteType" ADD VALUE 'LEAD_DRIVER';
ALTER TYPE "public"."RouteType" ADD VALUE 'RESCUE_2';
ALTER TYPE "public"."RouteType" ADD VALUE 'RESCUE_6';
