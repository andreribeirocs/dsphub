-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('DIRECTOR', 'MANAGER_FINANCIAL', 'MANAGER_FLEET', 'MANAGER_ONSITE', 'MANAGER_RECRUITMENT', 'DRIVER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('LEAD', 'SMS_SENT', 'FORM_COMPLETED', 'DOCUMENTS_UPLOADED', 'BACKGROUND_CHECK', 'APPROVED', 'CLASSROOM_SCHEDULED', 'CLASSROOM_COMPLETED', 'RIDE_ALONG_SCHEDULED', 'RIDE_ALONG_COMPLETED', 'ACTIVE_DRIVER', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "phoneNumber" TEXT,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "refreshToken" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "licenseNumber" TEXT,
    "licenseExpiry" TIMESTAMP(3),
    "insuranceNumber" TEXT,
    "address" TEXT,
    "documents" JSONB,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "backgroundCheckDone" BOOLEAN NOT NULL DEFAULT false,
    "classroomComplete" BOOLEAN NOT NULL DEFAULT false,
    "rideAlongDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "status" "CandidateStatus" NOT NULL DEFAULT 'LEAD',
    "source" TEXT,
    "notes" TEXT,
    "address" TEXT,
    "insuranceNumber" TEXT,
    "driverLicense" TEXT,
    "userId" TEXT,
    "documents" JSONB,
    "smsToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "classroomDate" TIMESTAMP(3),
    "rideAlongDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_userId_key" ON "Driver"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_userId_key" ON "Candidate"("userId");

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
