# Rodada B.1 — Scaffolds & Implementation Checklist

Generated: 2026-09-17 10:45 UTC
Scheduled auto-run: 2026-09-17T22:00:00Z (tonight at 23:00 UK time)

---

## Overview

**Rodada B.1** covers three interconnected features:
1. **Candidate pipeline tracking** — new status fields in Candidate model
2. **Driver corporate email** — new field in Driver model  
3. **Candidate → Driver conversion** — single endpoint that creates Driver + User (role DRIVER) + marks candidate converted

This document lists all scaffolds created, where to place them, and implementation notes.

---

## Files Created (Scaffolds)

### 1. Migrations

#### `20260917050000_candidate_pipeline_fields.sql`
**Location:** `api/prisma/migrations/20260917050000_candidate_pipeline_fields/`
**Action:** Create folder, copy file as `migration.sql`

Fields added:
- `contato_inicial` (BOOLEAN, default FALSE)
- `mini_entrevista_resultado` (TEXT, nullable)
- `teste_treinamento_resultado` (TEXT, nullable)

Indices created for filtering performance.

#### `20260917051000_driver_corporate_email.sql`
**Location:** `api/prisma/migrations/20260917051000_driver_corporate_email/`
**Action:** Create folder, copy file as `migration.sql`

Fields added:
- `corporateEmail` (TEXT, nullable)

---

### 2. Backend DTOs

#### `candidate.dto.ts.scaffold`
**Location:** Merge into `api/src/recruitment/dto/candidate.dto.ts`
**Action:** Add the three new fields to `CreateCandidateDto`, `UpdateCandidateDto`, and `CandidateResponseDto`

Changes:
- Add `@IsOptional() @IsBoolean() contato_inicial?: boolean;`
- Add `@IsOptional() @IsString() mini_entrevista_resultado?: string;`
- Add `@IsOptional() @IsString() teste_treinamento_resultado?: string;`

#### `driver.dto.ts.scaffold`
**Location:** Merge into `api/src/drivers/dto/driver.dto.ts`
**Action:** Add the new field to `CreateDriverDto`, `UpdateDriverDto`, and `DriverResponseDto`

Changes:
- Add `@IsOptional() @IsEmail() corporateEmail?: string;`

#### `convert-to-driver.dto.scaffold.ts`
**Location:** Create as `api/src/recruitment/dto/convert-to-driver.dto.ts`
**Action:** New file

Exports:
- `ConvertToDrivierDto` (request: `depot_id`)
- `ConvertToDrivierResponseDto` (response: `{ success, driverId, userId, email, message }`)

---

### 3. Backend Endpoints & Logic

#### `convert-to-driver.endpoint.scaffold.ts`
**Location:** Add to `api/src/recruitment/recruitment.controller.ts`
**Action:** Add the new POST `/recruitment/convert-to-driver/:candidateId` endpoint

Logic outline (implement in `recruitment.service.ts`):
```
POST /recruitment/convert-to-driver/:candidateId
  1. Validate candidate exists in this DSP (organizationId check)
  2. Validate depot_id exists and belongs to this DSP (active check)
  3. Create Driver record:
     - homeDepotId: from request.depot_id
     - organizationId: from candidate
     - firstName, lastName, email: from candidate
     - status: ACTIVE
  4. Create User record:
     - role: DRIVER
     - driverId: link to created driver
     - organizationId: same DSP
     - email: auto-generated or from candidate
     - Set temporary password (notify via email)
  5. Update Candidate:
     - status: CONVERTED (or new enum value)
     - Or soft-delete (is_archived: true)
  6. Create audit log entry
  7. Return { success: true, driverId, userId, email }
```

Validations:
- Candidate must exist and belong to this DSP (RLS enforced by Prisma extension)
- Depot must be active
- Candidate should not be already converted (check status)
- Email conflict check (if user with same email exists)

Error codes:
- 404: Candidate not found (or belongs to different DSP)
- 400: Invalid depot_id, already converted, or email conflict
- 500: Database error

---

## Frontend Changes Required

### `candidate-detail.component.ts` / `.html`
**Location:** `front/src/app/recruitment/candidate-detail.component.*`

Changes:
1. Add form inputs for the three new Candidate fields:
   - Checkbox: `contato_inicial`
   - Textarea: `mini_entrevista_resultado`
   - Textarea: `teste_treinamento_resultado`

2. Add **"Contratar" (Hire)** button:
   - Visible only for candidates with `status: CANDIDATE` (not yet hired)
   - Requires selection of `depot_id` (dropdown or selection)
   - On click:
     - Show confirmation dialog: "Confirm hiring this candidate as driver?"
     - Call `POST /recruitment/convert-to-driver/:candidateId { depot_id }`
     - On success: redirect to `/drivers` and show toast "Driver created successfully"
     - On error: show error toast with message from API

### `candidate-list.component.ts` / `.html`
**Location:** `front/src/app/recruitment/candidate-list.component.*`

Changes (optional, but recommended):
1. Add column to list showing:
   - `contato_inicial` status (badge or checkmark)
   - `teste_treinamento_resultado` (text or link to detail)
2. Add filter by `contato_inicial` status

---

## Tests Required

### Unit Tests

**Location:** `api/src/recruitment/recruitment.service.spec.ts`

Add test suite: `convertCandidateToDriver()`
- ✅ Should convert valid candidate to driver
- ✅ Should fail if candidate doesn't exist
- ✅ Should fail if depot doesn't exist
- ✅ Should fail if candidate already converted
- ✅ Should fail if email conflict
- ✅ Should create Driver with correct homeDepotId
- ✅ Should create User with role DRIVER
- ✅ Should create audit log entry

### E2E Tests

**Location:** `test/recruitment-convert-to-driver.e2e-spec.ts` (new file)

See `convert-to-driver.e2e.scaffold.ts` for test outline.

Tests:
- ✅ Should convert candidate to driver (happy path)
- ✅ Should reject conversion with invalid depot (400)
- ✅ Should reject cross-DSP conversion (404, RLS barrier)
- ✅ Should reject double conversion (400)
- ✅ Should create User with DRIVER role and correct permissions
- ✅ Should log audit event

---

## Implementation Checklist

### Database
- [ ] Create folder `api/prisma/migrations/20260917050000_candidate_pipeline_fields/`
- [ ] Copy `20260917050000_candidate_pipeline_fields.sql` as `migration.sql`
- [ ] Create folder `api/prisma/migrations/20260917051000_driver_corporate_email/`
- [ ] Copy `20260917051000_driver_corporate_email.sql` as `migration.sql`
- [ ] Run `npx prisma migrate dev` to apply
- [ ] Verify schema update in schema.prisma

### Backend — DTOs
- [ ] Merge candidate.dto.ts.scaffold into `api/src/recruitment/dto/candidate.dto.ts`
- [ ] Merge driver.dto.ts.scaffold into `api/src/drivers/dto/driver.dto.ts`
- [ ] Create `api/src/recruitment/dto/convert-to-driver.dto.ts` from scaffold
- [ ] Export new DTOs from index files

### Backend — Service & Controller
- [ ] Implement `recruitment.service.convertCandidateToDriver()` (full logic)
- [ ] Add `POST /recruitment/convert-to-driver/:candidateId` endpoint to controller
- [ ] Add validations and error handling
- [ ] Implement audit logging
- [ ] Test locally with curl or Postman

### Frontend
- [ ] Add form fields to `candidate-detail.component.*` (3 new fields)
- [ ] Add "Contratar" button with depot selection
- [ ] Implement conversion call and error handling
- [ ] Add redirect to `/drivers` on success
- [ ] Test locally (run `npm run start`)

### Tests
- [ ] Add unit tests to `recruitment.service.spec.ts`
- [ ] Create `test/recruitment-convert-to-driver.e2e-spec.ts`
- [ ] Run `npx jest` (should pass 40+/35)
- [ ] Run `npx jest --config ./test/jest-e2e.json recruitment-convert-to-driver` (should pass 5+)

### Code Review & Cleanup
- [ ] Remove console.log debug statements
- [ ] Review RLS policies (should be transparent — Prisma extension handles it)
- [ ] Check for CORS/security headers
- [ ] Verify audit log format matches A.1 pattern
- [ ] Git status (should show only modified + new files, no deletions)

---

## Quick Integration Steps

1. **Prep** (~2 min)
   ```bash
   cd C:\Users\andre\Desktop\DSPHub00
   git status  # should be clean from Rodada A
   git pull    # optional, get latest main
   ```

2. **Migrations** (~3 min)
   ```bash
   cd api
   cp /path/to/scaffolds/20260917050000_candidate_pipeline_fields.sql \
      prisma/migrations/20260917050000_candidate_pipeline_fields/migration.sql
   cp /path/to/scaffolds/20260917051000_driver_corporate_email.sql \
      prisma/migrations/20260917051000_driver_corporate_email/migration.sql
   npx prisma migrate dev
   npx prisma generate
   ```

3. **DTOs & Logic** (~15 min)
   - Merge DTOs (copy-paste from scaffolds)
   - Implement service method (use scaffold as guide)
   - Add endpoint (copy-paste from scaffold, adjust)

4. **Frontend** (~15 min)
   - Update `candidate-detail.component.*` (add fields + button)
   - Add depot selection logic
   - Test button click

5. **Tests** (~20 min)
   - Copy test scaffold, fill in helper functions
   - Run `npx jest` → should pass
   - Run e2e → should pass

6. **Review & Commit** (~10 min)
   ```bash
   npm run lint  # optional
   git add .
   git commit -m "Rodada B.1 — Candidate pipeline fields, driver corporate email, convert-to-driver endpoint"
   git push origin main
   ```

---

## Token Estimate

- Migrations & DTOs: 2-3k tokens
- Service logic implementation: 8-12k tokens
- Frontend updates: 5-8k tokens
- Tests: 10-15k tokens
- Review & cleanup: 3-5k tokens

**Total B.1: 28-43k tokens** (initial plan was 50-65k for B.1+B.2 combined, so this should be comfortable)

---

## Notes for Rodada B.1 Automated Run

When the scheduled task fires at 23:00 UTC:
1. It will read this checklist
2. Implement each section in order (DB → DTOs → Service → Frontend → Tests)
3. Create a git commit with all B.1 work
4. Push to main
5. Leave notes on what was done and what might need manual review

**Expected output:** 
- ✅ 40+/35 unit tests passing
- ✅ 23+/18 e2e tests passing (18 isolation + 5 B.1-specific)
- ✅ 96 files modified (or new), tsc clean, jest clean
- ✅ One git commit on main with B.1 complete
