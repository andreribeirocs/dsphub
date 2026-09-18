// Scaffold for test/recruitment-convert-to-driver.e2e-spec.ts
// E2E tests for candidate → driver conversion

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '.../app.module';

describe('Recruitment — Convert Candidate to Driver (e2e)', () => {
  let app: INestApplication;
  let dsp1Token: string;
  let dsp2Token: string;
  let candidateId: string;
  let depotId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Authenticate both DSPs
    dsp1Token = await getToken('admin@dsphub.com', 'admin123456');
    dsp2Token = await getToken('admin@dsp-b.test', 'admin123456');
  });

  afterAll(async () => {
    await app.close();
  });

  it('should convert candidate to driver with valid depot', async () => {
    /**
     * Test: Create candidate, then convert to driver
     * 1. POST /recruitment/candidates (DSP 1)
     * 2. POST /recruitment/convert-to-driver/:candidateId { depot_id: ... }
     * 3. Assert: Driver created, User created with role DRIVER, candidate marked converted
     */
    const response = await request(app.getHttpServer())
      .post('/recruitment/convert-to-driver/:candidateId')
      .set('Authorization', `Bearer ${dsp1Token}`)
      .send({ depot_id: depotId })
      .expect(HttpStatus.CREATED);

    expect(response.body).toHaveProperty('driverId');
    expect(response.body).toHaveProperty('userId');
    expect(response.body.success).toBe(true);
  });

  it('should reject conversion with invalid depot', async () => {
    /**
     * Test: Attempt conversion with non-existent depot_id
     * Assert: 400 Bad Request
     */
    await request(app.getHttpServer())
      .post('/recruitment/convert-to-driver/:candidateId')
      .set('Authorization', `Bearer ${dsp1Token}`)
      .send({ depot_id: 'invalid-uuid' })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('should reject conversion for candidate from different DSP', async () => {
    /**
     * Test: DSP 2 tries to convert candidate from DSP 1
     * Assert: 404 Not Found (RLS barrier)
     */
    await request(app.getHttpServer())
      .post('/recruitment/convert-to-driver/:candidateId')
      .set('Authorization', `Bearer ${dsp2Token}`)
      .send({ depot_id: depotId })
      .expect(HttpStatus.NOT_FOUND);
  });

  it('should reject conversion for already-converted candidate', async () => {
    /**
     * Test: Try to convert same candidate twice
     * Assert: 400 Bad Request (already converted)
     */
    // First conversion succeeds
    await request(app.getHttpServer())
      .post('/recruitment/convert-to-driver/:candidateId')
      .set('Authorization', `Bearer ${dsp1Token}`)
      .send({ depot_id: depotId })
      .expect(HttpStatus.CREATED);

    // Second conversion should fail
    await request(app.getHttpServer())
      .post('/recruitment/convert-to-driver/:candidateId')
      .set('Authorization', `Bearer ${dsp1Token}`)
      .send({ depot_id: depotId })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('should create user with DRIVER role and link to driver', async () => {
    /**
     * Test: After conversion, user should exist with role DRIVER
     * Assert: User can log in with generated credentials
     */
    const response = await request(app.getHttpServer())
      .post('/recruitment/convert-to-driver/:candidateId')
      .set('Authorization', `Bearer ${dsp1Token}`)
      .send({ depot_id: depotId })
      .expect(HttpStatus.CREATED);

    const driverId = response.body.driverId;
    const userId = response.body.userId;

    // Verify User exists with DRIVER role
    const userCheck = await request(app.getHttpServer())
      .get(`/admin/users/${userId}`)
      .set('Authorization', `Bearer ${dsp1Token}`)
      .expect(HttpStatus.OK);

    expect(userCheck.body.role).toBe('DRIVER');
    expect(userCheck.body.driverId).toBe(driverId);
  });
});

// Helper to get auth token
async function getToken(email: string, password: string): Promise<string> {
  // Implementation depends on auth flow
  // Typically: POST /auth/login { email, password } → returns { token: string }
  return '';
}
