import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CandidateStatus } from "@prisma/client";
import { RecruitmentService } from "./recruitment.service";
import { TenantContext } from "../tenancy/tenant-context";

jest.mock("better-auth/crypto", () => ({
  hashPassword: jest.fn().mockResolvedValue("hashed-password"),
}));

const ORG = "org-1";
const DEPOT = { id: "depot-1", name: "Bracknell", isActive: true };

/** A candidate with every field the Driver record requires */
const completeCandidate = {
  id: "cand-1",
  organizationId: ORG,
  name: "John Doe",
  email: "John.Doe@example.com",
  phoneNumber: "+447123456789",
  status: CandidateStatus.APPROVED as CandidateStatus,
  userId: null as string | null,
  address: "1 High Street",
  age: 34,
  citizenship: "British",
  licenceExpiry: new Date("2030-01-01"),
  passportVisaExpiry: new Date("2031-01-01"),
  rtwExpiry: new Date("2032-01-01"),
  driverLicense: "DL123",
  insuranceNumber: "NI123",
  points: 3,
  documents: null,
  lastCheck: null as Date | null,
};

type Candidate = typeof completeCandidate;

function buildService(overrides: {
  candidate?: Partial<Candidate> | null;
  depot?: typeof DEPOT | null;
  existingUser?: { id: string } | null;
  duplicateTransporter?: { id: string } | null;
}) {
  const candidate =
    overrides.candidate === null
      ? null
      : { ...completeCandidate, ...overrides.candidate };

  const tx = {
    user: { create: jest.fn().mockResolvedValue({ id: "user-1" }) },
    account: { create: jest.fn().mockResolvedValue({}) },
    member: { create: jest.fn().mockResolvedValue({}) },
    driver: { create: jest.fn().mockResolvedValue({ id: "driver-1" }) },
    candidate: { update: jest.fn().mockResolvedValue({}) },
  };

  const prisma = {
    candidate: { findUnique: jest.fn().mockResolvedValue(candidate) },
    depot: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          overrides.depot === undefined ? DEPOT : overrides.depot
        ),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(overrides.existingUser ?? null),
    },
    driver: {
      findFirst: jest
        .fn()
        .mockResolvedValue(overrides.duplicateTransporter ?? null),
    },
    tenantTransaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };

  const service = new RecruitmentService(
    prisma as never,
    { sendMessage: jest.fn() } as never,
    { get: jest.fn() } as never
  );

  return { service, prisma, tx };
}

const validDto = { homeDepotId: DEPOT.id, transporterId: "A1B2C3" };

const run = <T>(fn: () => Promise<T>) =>
  TenantContext.runForOrganization(ORG, fn);

describe("RecruitmentService.convertToDriver", () => {
  it("creates the login, the driver and closes the candidate out", async () => {
    const { service, tx } = buildService({});

    const result = await run(() =>
      service.convertToDriver("cand-1", validDto)
    );

    expect(result.success).toBe(true);
    expect(result.driverId).toBe("driver-1");
    expect(result.userId).toBe("user-1");

    // Login is created with the DRIVER role and the candidate's identity
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "john.doe@example.com", // normalised
          name: "John Doe",
          role: "DRIVER",
        }),
      })
    );
    expect(tx.account.create).toHaveBeenCalledTimes(1);
    expect(tx.member.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: ORG, role: "member" }),
      })
    );

    // Driver carries the depot on both the relation and the legacy column
    const driverData = tx.driver.create.mock.calls[0][0].data;
    expect(driverData.homeDepotId).toBe(DEPOT.id);
    expect(driverData.depot).toBe(DEPOT.name);
    expect(driverData.organizationId).toBe(ORG);
    expect(driverData.transporterId).toBe("A1B2C3");

    // nextCheck is six months after joinDate
    const months =
      (driverData.nextCheck.getFullYear() - driverData.joinDate.getFullYear()) *
        12 +
      (driverData.nextCheck.getMonth() - driverData.joinDate.getMonth());
    expect(months).toBe(6);

    // Candidate leaves the pipeline, linked to the new login
    expect(tx.candidate.update).toHaveBeenCalledWith({
      where: { id: "cand-1" },
      data: { userId: "user-1", status: CandidateStatus.ACTIVE_DRIVER },
    });
  });

  it("generates a password when none is supplied, and returns it once", async () => {
    const { service } = buildService({});
    const result = await run(() => service.convertToDriver("cand-1", validDto));
    expect(typeof result.generatedPassword).toBe("string");
    expect(result.generatedPassword!.length).toBeGreaterThan(8);
  });

  it("does not return a password when the caller supplied one", async () => {
    const { service } = buildService({});
    const result = await run(() =>
      service.convertToDriver("cand-1", { ...validDto, password: "chosen-pass" })
    );
    expect(result.generatedPassword).toBeNull();
  });

  it("404s for a candidate that does not exist in this DSP", async () => {
    const { service } = buildService({ candidate: null });
    await expect(
      run(() => service.convertToDriver("cand-1", validDto))
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("refuses a candidate that already has a login", async () => {
    const { service, tx } = buildService({ candidate: { userId: "user-9" } });
    await expect(
      run(() => service.convertToDriver("cand-1", validDto))
    ).rejects.toThrow(/already been hired/);
    expect(tx.driver.create).not.toHaveBeenCalled();
  });

  it("refuses a candidate already marked as an active driver", async () => {
    const { service } = buildService({
      candidate: { status: CandidateStatus.ACTIVE_DRIVER },
    });
    await expect(
      run(() => service.convertToDriver("cand-1", validDto))
    ).rejects.toThrow(/already been hired/);
  });

  it("refuses an inactive depot", async () => {
    const { service } = buildService({
      depot: { ...DEPOT, isActive: false },
    });
    await expect(
      run(() => service.convertToDriver("cand-1", validDto))
    ).rejects.toThrow(/depot not found or inactive/i);
  });

  it("refuses a depot that does not exist", async () => {
    const { service } = buildService({ depot: null });
    await expect(
      run(() => service.convertToDriver("cand-1", validDto))
    ).rejects.toThrow(/depot not found or inactive/i);
  });

  it("lists every missing field instead of inventing values", async () => {
    const { service, tx } = buildService({
      candidate: { address: null as never, citizenship: null as never, age: null as never },
    });

    await expect(
      run(() => service.convertToDriver("cand-1", validDto))
    ).rejects.toThrow(/address.*age.*citizenship/s);
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it("refuses when the email already belongs to a user on any DSP", async () => {
    const { service } = buildService({ existingUser: { id: "user-existing" } });
    await expect(
      run(() => service.convertToDriver("cand-1", validDto))
    ).rejects.toThrow(/email already exists/);
  });

  it("refuses a Transporter ID already used by another driver", async () => {
    const { service } = buildService({
      duplicateTransporter: { id: "driver-existing" },
    });
    await expect(
      run(() => service.convertToDriver("cand-1", validDto))
    ).rejects.toThrow(/Transporter ID/);
  });

  it("fails closed when no organization is in context", async () => {
    const { service } = buildService({});
    await expect(
      service.convertToDriver("cand-1", validDto)
    ).rejects.toThrow(/Organization context is missing/);
  });

  it("rejects an empty candidate id", async () => {
    const { service } = buildService({});
    await expect(
      run(() => service.convertToDriver("", validDto))
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
