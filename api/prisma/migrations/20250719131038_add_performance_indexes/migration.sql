-- CreateIndex
CREATE INDEX "Candidate_phoneNumber_idx" ON "Candidate"("phoneNumber");

-- CreateIndex
CREATE INDEX "Candidate_email_idx" ON "Candidate"("email");

-- CreateIndex
CREATE INDEX "Candidate_status_idx" ON "Candidate"("status");

-- CreateIndex
CREATE INDEX "Candidate_smsToken_idx" ON "Candidate"("smsToken");

-- CreateIndex
CREATE INDEX "Candidate_tokenExpiry_idx" ON "Candidate"("tokenExpiry");

-- CreateIndex
CREATE INDEX "Candidate_createdAt_idx" ON "Candidate"("createdAt");

-- CreateIndex
CREATE INDEX "Candidate_status_createdAt_idx" ON "Candidate"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Candidate_classroomDate_idx" ON "Candidate"("classroomDate");

-- CreateIndex
CREATE INDEX "Candidate_rideAlongDate_idx" ON "Candidate"("rideAlongDate");

-- CreateIndex
CREATE INDEX "Driver_status_idx" ON "Driver"("status");

-- CreateIndex
CREATE INDEX "Driver_depot_idx" ON "Driver"("depot");

-- CreateIndex
CREATE INDEX "Driver_email_idx" ON "Driver"("email");

-- CreateIndex
CREATE INDEX "Driver_phone_idx" ON "Driver"("phone");

-- CreateIndex
CREATE INDEX "Driver_passportExpiry_idx" ON "Driver"("passportExpiry");

-- CreateIndex
CREATE INDEX "Driver_licenseExpiry_idx" ON "Driver"("licenseExpiry");

-- CreateIndex
CREATE INDEX "Driver_rtwExpiry_idx" ON "Driver"("rtwExpiry");

-- CreateIndex
CREATE INDEX "Driver_nextCheck_idx" ON "Driver"("nextCheck");

-- CreateIndex
CREATE INDEX "Driver_joinDate_idx" ON "Driver"("joinDate");

-- CreateIndex
CREATE INDEX "Driver_createdAt_idx" ON "Driver"("createdAt");

-- CreateIndex
CREATE INDEX "Driver_status_depot_idx" ON "Driver"("status", "depot");

-- CreateIndex
CREATE INDEX "Driver_depot_status_idx" ON "Driver"("depot", "status");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_lastLogin_idx" ON "User"("lastLogin");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "driver_schedules_date_idx" ON "driver_schedules"("date");

-- CreateIndex
CREATE INDEX "driver_schedules_status_idx" ON "driver_schedules"("status");

-- CreateIndex
CREATE INDEX "driver_schedules_driverId_date_idx" ON "driver_schedules"("driverId", "date");

-- CreateIndex
CREATE INDEX "driver_schedules_date_status_idx" ON "driver_schedules"("date", "status");
