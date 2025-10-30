-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('SUPER_ADMIN', 'OWNER', 'DIRECTOR', 'MANAGER_FINANCIAL', 'MANAGER_FLEET', 'MANAGER_ONSITE', 'MANAGER_RECRUITMENT', 'DRIVER');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING');

-- CreateEnum
CREATE TYPE "public"."RouteType" AS ENUM ('FULL_ROUTE', 'HIDE_ALONG', 'TRAINING_DAY', 'SAME_DAY', 'NURSERY_ROUTE', 'EXTRAS', 'ORDT_EXTRA_LARGE_CARGO_VAN', 'STANDARD_PARCEL_MEDIUM_VAN', 'NURSERY_ROUTE_LEVEL_1', 'NURSERY_ROUTE_LEVEL_2', 'NURSERY_ROUTE_LEVEL_3', 'NURSERY_ROUTE_LEVEL_4', 'STANDARD_PARCEL', 'STANDARD_PARCEL_LOW_EMISSION_VEHICLE_LARGE', 'STANDARD_PARCEL_WITH_HELPER', 'STANDARD_PARCEL_RIDE_ALONG_IRONHIDE_MEDIUM_VAN', 'STANDARD_PARCEL_RIDE_ALONG_MENTEE_IRONHIDE_MEDIUM_VAN');

-- CreateEnum
CREATE TYPE "public"."CandidateStatus" AS ENUM ('LEAD', 'SMS_SENT', 'FORM_COMPLETED', 'DOCUMENTS_UPLOADED', 'BACKGROUND_CHECK', 'APPROVED', 'CLASSROOM_SCHEDULED', 'CLASSROOM_COMPLETED', 'RIDE_ALONG_SCHEDULED', 'RIDE_ALONG_COMPLETED', 'ACTIVE_DRIVER', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."ScheduleStatus" AS ENUM ('FULL_ROUTE', 'OFF', 'HOLIDAY', 'RIDE_ALONG', 'TRAINING_DAY', 'SAME_DAY', 'NURSERY_ROUTE');

-- CreateEnum
CREATE TYPE "public"."VanStatus" AS ENUM ('BOOKED', 'DELIVERED', 'TBC', 'AVAILABLE', 'MAINTENANCE', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "public"."VanCondition" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'NEEDS_ATTENTION');

-- CreateEnum
CREATE TYPE "public"."ContractStatus" AS ENUM ('ACTIVE', 'REMOVED', 'BROKEN_DOWN', 'SUSPENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."MaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "public"."MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SENT', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'DRIVER',
    "status" "public"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "phoneNumber" TEXT,
    "lastLogin" TIMESTAMP(3),
    "avatar" TEXT,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activeOrganizationId" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "country" TEXT DEFAULT 'United Kingdom',
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "taxId" TEXT,
    "registrationNumber" TEXT,
    "logoBase64" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "bankSortCode" TEXT,
    "iban" TEXT,
    "swiftCode" TEXT,
    "termsAndConditions" TEXT,
    "footerText" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."member" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "inviterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."route_prices" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "routeType" "public"."RouteType" NOT NULL,
    "dailyRate" DECIMAL(8,2) NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payment_history" (
    "id" TEXT NOT NULL,
    "routePriceId" TEXT NOT NULL,
    "routeType" "public"."RouteType" NOT NULL,
    "oldRate" DECIMAL(8,2),
    "newRate" DECIMAL(8,2) NOT NULL,
    "changeReason" TEXT,
    "changedBy" TEXT NOT NULL,
    "changeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Driver" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contractType" TEXT,
    "licenseNumber" TEXT,
    "licenseExpiry" TIMESTAMP(3) NOT NULL,
    "insuranceNumber" TEXT,
    "address" TEXT NOT NULL,
    "documents" JSONB,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "backgroundCheckDone" BOOLEAN NOT NULL DEFAULT false,
    "classroomComplete" BOOLEAN NOT NULL DEFAULT false,
    "rideAlongDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "age" INTEGER NOT NULL,
    "citizenship" TEXT NOT NULL,
    "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dbsStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "depot" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hasEndorsements" BOOLEAN NOT NULL DEFAULT false,
    "joinDate" TIMESTAMP(3) NOT NULL,
    "lastCheck" TIMESTAMP(3) NOT NULL,
    "licenseStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "medicalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "name" TEXT NOT NULL,
    "nextCheck" TIMESTAMP(3) NOT NULL,
    "passportExpiry" TIMESTAMP(3) NOT NULL,
    "passportStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "phone" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rtwExpiry" TIMESTAMP(3) NOT NULL,
    "rtwStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalTrips" INTEGER NOT NULL DEFAULT 0,
    "transporterId" TEXT NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."driver_payments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "routeType" "public"."RouteType" NOT NULL,
    "dailyRate" DECIMAL(8,2) NOT NULL,
    "hoursWorked" DECIMAL(4,2),
    "totalPaid" DECIMAL(8,2) NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidDate" TIMESTAMP(3),
    "paidBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deductionAmount" DECIMAL(8,2),
    "extraAmount" DECIMAL(8,2),
    "routeCode" TEXT,
    "sourceSheet" TEXT,
    "vanCharge" DECIMAL(8,2),
    "isHelper" BOOLEAN NOT NULL DEFAULT false,
    "helperFor" TEXT,

    CONSTRAINT "driver_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Candidate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "status" "public"."CandidateStatus" NOT NULL DEFAULT 'LEAD',
    "source" TEXT,
    "notes" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "age" INTEGER,
    "citizenship" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "documentNumber" TEXT,
    "insuranceNumber" TEXT,
    "driverLicense" TEXT,
    "passportVisaExpiry" TIMESTAMP(3),
    "rtwExpiry" TIMESTAMP(3),
    "licenceExpiry" TIMESTAMP(3),
    "points" INTEGER DEFAULT 0,
    "nextDVLA" TIMESTAMP(3),
    "lastCheck" TIMESTAMP(3),
    "lastCheckOn" TIMESTAMP(3),
    "sla" TEXT,
    "account" TEXT,
    "formCompleted" BOOLEAN DEFAULT false,
    "documents" JSONB,
    "userId" TEXT,
    "smsToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "classroomDate" TIMESTAMP(3),
    "rideAlongDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."driver_schedules" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "public"."ScheduleStatus" NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."login_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "location" TEXT,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskFactors" JSONB,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."suspicious_logins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "location" TEXT,
    "sessionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "investigatedBy" TEXT,
    "investigatedAt" TIMESTAMP(3),
    "notes" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suspicious_logins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."security_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "endpoint" TEXT,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignedTo" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vans" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "vanNumber" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "status" "public"."VanStatus" NOT NULL DEFAULT 'AVAILABLE',
    "condition" "public"."VanCondition" NOT NULL DEFAULT 'GOOD',
    "motExpiry" TIMESTAMP(3),
    "motReminder" BOOLEAN NOT NULL DEFAULT true,
    "contractId" TEXT,
    "monthlyRental" DECIMAL(8,2),
    "vin" TEXT,
    "engineNumber" TEXT,
    "fuelType" TEXT,
    "capacity" TEXT,
    "depot" TEXT,
    "assignedDriver" TEXT,
    "mileage" INTEGER DEFAULT 0,
    "lastService" TIMESTAMP(3),
    "nextService" TIMESTAMP(3),
    "comments" TEXT,
    "insuranceDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."contracts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "depot" TEXT NOT NULL,
    "hireName" TEXT NOT NULL,
    "rentalRate" DECIMAL(8,2) NOT NULL,
    "status" "public"."ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "hasInsurance" BOOLEAN NOT NULL DEFAULT false,
    "supplier" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "description" TEXT,
    "terms" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."maintenance_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "vanId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "public"."MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "priority" "public"."MaintenancePriority" NOT NULL DEFAULT 'MEDIUM',
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "estimatedCost" DECIMAL(8,2),
    "actualCost" DECIMAL(8,2),
    "workshop" TEXT,
    "workshopContact" TEXT,
    "partsUsed" JSONB,
    "laborHours" DECIMAL(4,2),
    "notes" TEXT,
    "invoiceNumber" TEXT,
    "warrantyUntil" TIMESTAMP(3),
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "isOverdue" BOOLEAN NOT NULL DEFAULT false,
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."parts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "fordPrice" DECIMAL(8,2),
    "mercedesPrice" DECIMAL(8,2),
    "peugeotPrice" DECIMAL(8,2),
    "partNumber" TEXT,
    "supplier" TEXT,
    "description" TEXT,
    "stockLevel" INTEGER NOT NULL DEFAULT 0,
    "minStockLevel" INTEGER NOT NULL DEFAULT 0,
    "maxStockLevel" INTEGER NOT NULL DEFAULT 100,
    "weight" DECIMAL(8,3),
    "dimensions" TEXT,
    "warrantyDays" INTEGER DEFAULT 365,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."driver_invoices" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "weekStartDate" DATE NOT NULL,
    "weekEndDate" DATE NOT NULL,
    "status" "public"."InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "notes" TEXT,
    "pdfUrl" TEXT,
    "sentAt" TIMESTAMP(3),
    "sentBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentId" TEXT,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "routeType" "public"."RouteType" NOT NULL,
    "routeCode" TEXT,
    "amount" DECIMAL(8,2) NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "public"."user"("email");

-- CreateIndex
CREATE INDEX "user_role_idx" ON "public"."user"("role");

-- CreateIndex
CREATE INDEX "user_status_idx" ON "public"."user"("status");

-- CreateIndex
CREATE INDEX "user_lastLogin_idx" ON "public"."user"("lastLogin");

-- CreateIndex
CREATE INDEX "user_createdAt_idx" ON "public"."user"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "public"."session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "public"."session"("userId");

-- CreateIndex
CREATE INDEX "session_token_idx" ON "public"."session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "public"."account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "public"."account"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_identifier_value_key" ON "public"."verification"("identifier", "value");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "public"."organization"("slug");

-- CreateIndex
CREATE INDEX "organization_slug_idx" ON "public"."organization"("slug");

-- CreateIndex
CREATE INDEX "organization_isActive_idx" ON "public"."organization"("isActive");

-- CreateIndex
CREATE INDEX "member_userId_idx" ON "public"."member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "member_organizationId_userId_key" ON "public"."member"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "invitation_email_idx" ON "public"."invitation"("email");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_organizationId_email_key" ON "public"."invitation"("organizationId", "email");

-- CreateIndex
CREATE INDEX "route_prices_organizationId_idx" ON "public"."route_prices"("organizationId");

-- CreateIndex
CREATE INDEX "route_prices_routeType_idx" ON "public"."route_prices"("routeType");

-- CreateIndex
CREATE INDEX "route_prices_lastUpdated_idx" ON "public"."route_prices"("lastUpdated");

-- CreateIndex
CREATE INDEX "route_prices_updatedBy_idx" ON "public"."route_prices"("updatedBy");

-- CreateIndex
CREATE UNIQUE INDEX "route_prices_organizationId_routeType_key" ON "public"."route_prices"("organizationId", "routeType");

-- CreateIndex
CREATE INDEX "payment_history_routePriceId_idx" ON "public"."payment_history"("routePriceId");

-- CreateIndex
CREATE INDEX "payment_history_routeType_idx" ON "public"."payment_history"("routeType");

-- CreateIndex
CREATE INDEX "payment_history_changeDate_idx" ON "public"."payment_history"("changeDate");

-- CreateIndex
CREATE INDEX "payment_history_changedBy_idx" ON "public"."payment_history"("changedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_userId_key" ON "public"."Driver"("userId");

-- CreateIndex
CREATE INDEX "Driver_organizationId_idx" ON "public"."Driver"("organizationId");

-- CreateIndex
CREATE INDEX "Driver_organizationId_userId_idx" ON "public"."Driver"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "Driver_status_idx" ON "public"."Driver"("status");

-- CreateIndex
CREATE INDEX "Driver_depot_idx" ON "public"."Driver"("depot");

-- CreateIndex
CREATE INDEX "Driver_email_idx" ON "public"."Driver"("email");

-- CreateIndex
CREATE INDEX "Driver_phone_idx" ON "public"."Driver"("phone");

-- CreateIndex
CREATE INDEX "Driver_transporterId_idx" ON "public"."Driver"("transporterId");

-- CreateIndex
CREATE INDEX "Driver_passportExpiry_idx" ON "public"."Driver"("passportExpiry");

-- CreateIndex
CREATE INDEX "Driver_licenseExpiry_idx" ON "public"."Driver"("licenseExpiry");

-- CreateIndex
CREATE INDEX "Driver_rtwExpiry_idx" ON "public"."Driver"("rtwExpiry");

-- CreateIndex
CREATE INDEX "Driver_nextCheck_idx" ON "public"."Driver"("nextCheck");

-- CreateIndex
CREATE INDEX "Driver_joinDate_idx" ON "public"."Driver"("joinDate");

-- CreateIndex
CREATE INDEX "Driver_createdAt_idx" ON "public"."Driver"("createdAt");

-- CreateIndex
CREATE INDEX "Driver_status_depot_idx" ON "public"."Driver"("status", "depot");

-- CreateIndex
CREATE INDEX "Driver_depot_status_idx" ON "public"."Driver"("depot", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_organizationId_transporterId_key" ON "public"."Driver"("organizationId", "transporterId");

-- CreateIndex
CREATE INDEX "driver_payments_organizationId_idx" ON "public"."driver_payments"("organizationId");

-- CreateIndex
CREATE INDEX "driver_payments_driverId_idx" ON "public"."driver_payments"("driverId");

-- CreateIndex
CREATE INDEX "driver_payments_workDate_idx" ON "public"."driver_payments"("workDate");

-- CreateIndex
CREATE INDEX "driver_payments_routeType_idx" ON "public"."driver_payments"("routeType");

-- CreateIndex
CREATE INDEX "driver_payments_isPaid_idx" ON "public"."driver_payments"("isPaid");

-- CreateIndex
CREATE INDEX "driver_payments_paidDate_idx" ON "public"."driver_payments"("paidDate");

-- CreateIndex
CREATE INDEX "driver_payments_paidBy_idx" ON "public"."driver_payments"("paidBy");

-- CreateIndex
CREATE INDEX "driver_payments_workDate_routeType_idx" ON "public"."driver_payments"("workDate", "routeType");

-- CreateIndex
CREATE INDEX "driver_payments_driverId_workDate_idx" ON "public"."driver_payments"("driverId", "workDate");

-- CreateIndex
CREATE INDEX "driver_payments_helperFor_idx" ON "public"."driver_payments"("helperFor");

-- CreateIndex
CREATE INDEX "driver_payments_isHelper_idx" ON "public"."driver_payments"("isHelper");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_userId_key" ON "public"."Candidate"("userId");

-- CreateIndex
CREATE INDEX "Candidate_organizationId_idx" ON "public"."Candidate"("organizationId");

-- CreateIndex
CREATE INDEX "Candidate_phoneNumber_idx" ON "public"."Candidate"("phoneNumber");

-- CreateIndex
CREATE INDEX "Candidate_email_idx" ON "public"."Candidate"("email");

-- CreateIndex
CREATE INDEX "Candidate_status_idx" ON "public"."Candidate"("status");

-- CreateIndex
CREATE INDEX "Candidate_smsToken_idx" ON "public"."Candidate"("smsToken");

-- CreateIndex
CREATE INDEX "Candidate_tokenExpiry_idx" ON "public"."Candidate"("tokenExpiry");

-- CreateIndex
CREATE INDEX "Candidate_createdAt_idx" ON "public"."Candidate"("createdAt");

-- CreateIndex
CREATE INDEX "Candidate_status_createdAt_idx" ON "public"."Candidate"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Candidate_classroomDate_idx" ON "public"."Candidate"("classroomDate");

-- CreateIndex
CREATE INDEX "Candidate_rideAlongDate_idx" ON "public"."Candidate"("rideAlongDate");

-- CreateIndex
CREATE INDEX "Candidate_dateOfBirth_idx" ON "public"."Candidate"("dateOfBirth");

-- CreateIndex
CREATE INDEX "Candidate_citizenship_idx" ON "public"."Candidate"("citizenship");

-- CreateIndex
CREATE INDEX "Candidate_postalCode_idx" ON "public"."Candidate"("postalCode");

-- CreateIndex
CREATE INDEX "Candidate_documentNumber_idx" ON "public"."Candidate"("documentNumber");

-- CreateIndex
CREATE INDEX "Candidate_passportVisaExpiry_idx" ON "public"."Candidate"("passportVisaExpiry");

-- CreateIndex
CREATE INDEX "Candidate_rtwExpiry_idx" ON "public"."Candidate"("rtwExpiry");

-- CreateIndex
CREATE INDEX "Candidate_licenceExpiry_idx" ON "public"."Candidate"("licenceExpiry");

-- CreateIndex
CREATE INDEX "Candidate_nextDVLA_idx" ON "public"."Candidate"("nextDVLA");

-- CreateIndex
CREATE INDEX "Candidate_lastCheck_idx" ON "public"."Candidate"("lastCheck");

-- CreateIndex
CREATE INDEX "driver_schedules_date_idx" ON "public"."driver_schedules"("date");

-- CreateIndex
CREATE INDEX "driver_schedules_status_idx" ON "public"."driver_schedules"("status");

-- CreateIndex
CREATE INDEX "driver_schedules_driverId_date_idx" ON "public"."driver_schedules"("driverId", "date");

-- CreateIndex
CREATE INDEX "driver_schedules_date_status_idx" ON "public"."driver_schedules"("date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "driver_schedules_driverId_date_key" ON "public"."driver_schedules"("driverId", "date");

-- CreateIndex
CREATE INDEX "login_attempts_email_idx" ON "public"."login_attempts"("email");

-- CreateIndex
CREATE INDEX "login_attempts_success_idx" ON "public"."login_attempts"("success");

-- CreateIndex
CREATE INDEX "login_attempts_attemptedAt_idx" ON "public"."login_attempts"("attemptedAt");

-- CreateIndex
CREATE INDEX "login_attempts_ipAddress_idx" ON "public"."login_attempts"("ipAddress");

-- CreateIndex
CREATE INDEX "login_attempts_email_success_attemptedAt_idx" ON "public"."login_attempts"("email", "success", "attemptedAt");

-- CreateIndex
CREATE INDEX "suspicious_logins_userId_idx" ON "public"."suspicious_logins"("userId");

-- CreateIndex
CREATE INDEX "suspicious_logins_status_idx" ON "public"."suspicious_logins"("status");

-- CreateIndex
CREATE INDEX "suspicious_logins_detectedAt_idx" ON "public"."suspicious_logins"("detectedAt");

-- CreateIndex
CREATE INDEX "suspicious_logins_riskScore_idx" ON "public"."suspicious_logins"("riskScore");

-- CreateIndex
CREATE INDEX "suspicious_logins_userId_status_idx" ON "public"."suspicious_logins"("userId", "status");

-- CreateIndex
CREATE INDEX "security_events_eventType_idx" ON "public"."security_events"("eventType");

-- CreateIndex
CREATE INDEX "security_events_severity_idx" ON "public"."security_events"("severity");

-- CreateIndex
CREATE INDEX "security_events_status_idx" ON "public"."security_events"("status");

-- CreateIndex
CREATE INDEX "security_events_occurredAt_idx" ON "public"."security_events"("occurredAt");

-- CreateIndex
CREATE INDEX "security_events_userId_idx" ON "public"."security_events"("userId");

-- CreateIndex
CREATE INDEX "vans_organizationId_idx" ON "public"."vans"("organizationId");

-- CreateIndex
CREATE INDEX "vans_vanNumber_idx" ON "public"."vans"("vanNumber");

-- CreateIndex
CREATE INDEX "vans_registration_idx" ON "public"."vans"("registration");

-- CreateIndex
CREATE INDEX "vans_status_idx" ON "public"."vans"("status");

-- CreateIndex
CREATE INDEX "vans_condition_idx" ON "public"."vans"("condition");

-- CreateIndex
CREATE INDEX "vans_motExpiry_idx" ON "public"."vans"("motExpiry");

-- CreateIndex
CREATE INDEX "vans_contractId_idx" ON "public"."vans"("contractId");

-- CreateIndex
CREATE INDEX "vans_depot_idx" ON "public"."vans"("depot");

-- CreateIndex
CREATE INDEX "vans_status_condition_idx" ON "public"."vans"("status", "condition");

-- CreateIndex
CREATE INDEX "vans_depot_status_idx" ON "public"."vans"("depot", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vans_organizationId_vanNumber_key" ON "public"."vans"("organizationId", "vanNumber");

-- CreateIndex
CREATE UNIQUE INDEX "vans_organizationId_registration_key" ON "public"."vans"("organizationId", "registration");

-- CreateIndex
CREATE UNIQUE INDEX "vans_organizationId_vin_key" ON "public"."vans"("organizationId", "vin");

-- CreateIndex
CREATE INDEX "contracts_organizationId_idx" ON "public"."contracts"("organizationId");

-- CreateIndex
CREATE INDEX "contracts_name_idx" ON "public"."contracts"("name");

-- CreateIndex
CREATE INDEX "contracts_depot_idx" ON "public"."contracts"("depot");

-- CreateIndex
CREATE INDEX "contracts_status_idx" ON "public"."contracts"("status");

-- CreateIndex
CREATE INDEX "contracts_startDate_idx" ON "public"."contracts"("startDate");

-- CreateIndex
CREATE INDEX "contracts_endDate_idx" ON "public"."contracts"("endDate");

-- CreateIndex
CREATE INDEX "contracts_depot_status_idx" ON "public"."contracts"("depot", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_organizationId_name_key" ON "public"."contracts"("organizationId", "name");

-- CreateIndex
CREATE INDEX "maintenance_records_organizationId_idx" ON "public"."maintenance_records"("organizationId");

-- CreateIndex
CREATE INDEX "maintenance_records_vanId_idx" ON "public"."maintenance_records"("vanId");

-- CreateIndex
CREATE INDEX "maintenance_records_status_idx" ON "public"."maintenance_records"("status");

-- CreateIndex
CREATE INDEX "maintenance_records_priority_idx" ON "public"."maintenance_records"("priority");

-- CreateIndex
CREATE INDEX "maintenance_records_scheduledDate_idx" ON "public"."maintenance_records"("scheduledDate");

-- CreateIndex
CREATE INDEX "maintenance_records_type_idx" ON "public"."maintenance_records"("type");

-- CreateIndex
CREATE INDEX "maintenance_records_vanId_status_idx" ON "public"."maintenance_records"("vanId", "status");

-- CreateIndex
CREATE INDEX "maintenance_records_scheduledDate_status_idx" ON "public"."maintenance_records"("scheduledDate", "status");

-- CreateIndex
CREATE INDEX "parts_organizationId_idx" ON "public"."parts"("organizationId");

-- CreateIndex
CREATE INDEX "parts_name_idx" ON "public"."parts"("name");

-- CreateIndex
CREATE INDEX "parts_category_idx" ON "public"."parts"("category");

-- CreateIndex
CREATE INDEX "parts_partNumber_idx" ON "public"."parts"("partNumber");

-- CreateIndex
CREATE INDEX "parts_isActive_idx" ON "public"."parts"("isActive");

-- CreateIndex
CREATE INDEX "parts_stockLevel_idx" ON "public"."parts"("stockLevel");

-- CreateIndex
CREATE INDEX "parts_category_isActive_idx" ON "public"."parts"("category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "driver_invoices_invoiceNumber_key" ON "public"."driver_invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "driver_invoices_organizationId_idx" ON "public"."driver_invoices"("organizationId");

-- CreateIndex
CREATE INDEX "driver_invoices_driverId_idx" ON "public"."driver_invoices"("driverId");

-- CreateIndex
CREATE INDEX "driver_invoices_weekStartDate_weekEndDate_idx" ON "public"."driver_invoices"("weekStartDate", "weekEndDate");

-- CreateIndex
CREATE INDEX "driver_invoices_status_idx" ON "public"."driver_invoices"("status");

-- CreateIndex
CREATE INDEX "driver_invoices_invoiceNumber_idx" ON "public"."driver_invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "driver_invoices_sentAt_idx" ON "public"."driver_invoices"("sentAt");

-- CreateIndex
CREATE INDEX "invoice_items_invoiceId_idx" ON "public"."invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_items_paymentId_idx" ON "public"."invoice_items"("paymentId");

-- CreateIndex
CREATE INDEX "invoice_items_date_idx" ON "public"."invoice_items"("date");

-- AddForeignKey
ALTER TABLE "public"."session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."member" ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."route_prices" ADD CONSTRAINT "route_prices_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."route_prices" ADD CONSTRAINT "route_prices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payment_history" ADD CONSTRAINT "payment_history_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payment_history" ADD CONSTRAINT "payment_history_routePriceId_fkey" FOREIGN KEY ("routePriceId") REFERENCES "public"."route_prices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Driver" ADD CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Driver" ADD CONSTRAINT "Driver_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."driver_payments" ADD CONSTRAINT "driver_payments_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."driver_payments" ADD CONSTRAINT "driver_payments_paidBy_fkey" FOREIGN KEY ("paidBy") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."driver_payments" ADD CONSTRAINT "driver_payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Candidate" ADD CONSTRAINT "Candidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Candidate" ADD CONSTRAINT "Candidate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."driver_schedules" ADD CONSTRAINT "driver_schedules_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."login_attempts" ADD CONSTRAINT "login_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."suspicious_logins" ADD CONSTRAINT "suspicious_logins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vans" ADD CONSTRAINT "vans_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "public"."contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vans" ADD CONSTRAINT "vans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contracts" ADD CONSTRAINT "contracts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."maintenance_records" ADD CONSTRAINT "maintenance_records_vanId_fkey" FOREIGN KEY ("vanId") REFERENCES "public"."vans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."maintenance_records" ADD CONSTRAINT "maintenance_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."parts" ADD CONSTRAINT "parts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."driver_invoices" ADD CONSTRAINT "driver_invoices_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."driver_invoices" ADD CONSTRAINT "driver_invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."driver_invoices" ADD CONSTRAINT "driver_invoices_sentBy_fkey" FOREIGN KEY ("sentBy") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."driver_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoice_items" ADD CONSTRAINT "invoice_items_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."driver_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
