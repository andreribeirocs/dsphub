import { Candidate, Prisma } from "@prisma/client";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { RecruitmentWorkflowService } from "./recruitment-workflow.service";
import {
  documentFlags,
  documentsReady,
  recruitmentReview,
  workflowWhere,
} from "./recruitment-workflow";
import { TenantContext } from "../../tenancy/tenant-context";
import { RecruitmentService } from "../recruitment.service";
import { CompleteRegistrationDto } from "../dto/complete-registration.dto";

jest.mock("better-auth/crypto", () => ({ hashPassword: jest.fn() }));

const approval = {
  status: "approved",
  reason: "",
  reviewedAt: "2026-01-01",
  reviewedBy: "reviewer",
};
const requiredDocuments = () => ({
  driverLicenseImage: "bGljZW5jZQ==",
  insuranceImage: "bmluby==",
  addressProofImage: "YWRkcmVzcw==",
});
const future = () => new Date(Date.now() + 86400000);

function setup(overrides: Partial<Candidate> = {}) {
  const candidate = {
    id: "candidate-1",
    name: "Test Candidate",
    phoneNumber: "+447700900123",
    email: "candidate@example.com",
    organizationId: "org-1",
    userId: null,
    status: "DOCUMENTS_UPLOADED",
    documents: requiredDocuments(),
    updatedAt: new Date(),
    ...overrides,
  } as Candidate;
  const tx = {
    candidate: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    candidate: {
      findUnique: jest.fn().mockResolvedValue(candidate),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue(candidate),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    tenantTransaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx)
    ),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const recruitment = {
    getCandidateById: jest.fn().mockResolvedValue(candidate),
    convertToDriver: jest.fn(),
  };
  const email = {
    isEmailServiceConfigured: jest.fn().mockReturnValue(false),
    sendEmail: jest.fn().mockResolvedValue({ success: true }),
  };
  const messaging = {
    isConfigured: jest.fn().mockReturnValue(false),
    send: jest.fn().mockResolvedValue({ success: true }),
  };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const service = new RecruitmentWorkflowService(
    prisma as never,
    audit as never,
    recruitment as never,
    email as never,
    config as never,
    messaging as never
  );
  const registration = new RecruitmentService(
    prisma as never,
    messaging as never,
    config as never,
    audit as never
  );
  return {
    service,
    candidate,
    prisma,
    audit,
    recruitment,
    email,
    messaging,
    tx,
    registration,
  };
}

describe("Recruitment document and stage decisions", () => {
  it("requires a new review after replacing a rejected optional document", async () => {
    const { service, tx } = setup({
      documents: {
        ...requiredDocuments(),
        passportImage: "old",
        _recruitment: {
          documentReviews: {
            passportImage: { ...approval, status: "rejected" },
          },
          documentsStatus: "rejected",
        },
      },
    });
    const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]).toString(
      "base64"
    );
    await service.replaceDocument(
      "candidate-1",
      { document: "passportImage", image },
      "reviewer"
    );
    const data = tx.candidate.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe("DOCUMENTS_UPLOADED");
    expect(documentFlags(data.documents)).toEqual([]);
    expect(
      recruitmentReview(data.documents).documentReviews.passportImage
    ).toBeUndefined();
    expect(documentsReady(data.documents)).toBe(false);
  });

  it("rejects non-image replacements", async () => {
    const { service, tx } = setup();
    await expect(
      service.replaceDocument(
        "candidate-1",
        {
          document: "passportImage",
          image: Buffer.from("<script>example</script>").toString("base64"),
        },
        "reviewer"
      )
    ).rejects.toThrow(/PNG, JPEG/);
    expect(tx.candidate.updateMany).not.toHaveBeenCalled();
  });

  it("flags a rejected document without advancing the candidate", async () => {
    const { service, tx, audit } = setup();
    await service.reviewDocument(
      "candidate-1",
      {
        document: "driverLicenseImage",
        decision: "rejected",
        reason: "Unreadable expiry",
      },
      "reviewer"
    );
    const data = tx.candidate.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe("DOCUMENTS_UPLOADED");
    expect(documentFlags(data.documents)).toEqual(["driverLicenseImage"]);
    expect(
      recruitmentReview(data.documents).documentReviews.driverLicenseImage
        ?.reason
    ).toBe("Unreadable expiry");
    expect(audit.record.mock.calls[0][1]).toBe(tx);
  });

  it("requires a reason and an existing image for rejection", async () => {
    const { service, tx } = setup();
    await expect(
      service.reviewDocument(
        "candidate-1",
        { document: "driverLicenseImage", decision: "rejected" },
        "reviewer"
      )
    ).rejects.toThrow(/Explain why/);
    await expect(
      service.reviewDocument(
        "candidate-1",
        { document: "passportImage", decision: "approved" },
        "reviewer"
      )
    ).rejects.toThrow(/not been uploaded/);
    expect(tx.candidate.updateMany).not.toHaveBeenCalled();
  });

  it("advances only when every required and supplied optional document is approved", async () => {
    const documents = {
      ...requiredDocuments(),
      _recruitment: {
        documentReviews: {
          driverLicenseImage: approval,
          insuranceImage: approval,
        },
      },
    };
    const { service, tx } = setup({ documents });
    await service.reviewDocument(
      "candidate-1",
      { document: "addressProofImage", decision: "approved" },
      "reviewer"
    );
    const data = tx.candidate.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe("BACKGROUND_CHECK");
    expect(documentsReady(data.documents)).toBe(true);
    expect(
      documentsReady({ ...data.documents, passportImage: "cGFzc3BvcnQ=" })
    ).toBe(false);
  });

  it("does not lose another review when a concurrent change is detected", async () => {
    const { service, tx, audit } = setup();
    tx.candidate.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.reviewDocument(
        "candidate-1",
        { document: "driverLicenseImage", decision: "approved" },
        "reviewer"
      )
    ).rejects.toThrow(ConflictException);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("blocks background and classroom actions before prerequisites", async () => {
    const { service, tx } = setup();
    await expect(
      service.reviewBackground(
        "candidate-1",
        { decision: "approved" },
        "reviewer"
      )
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.scheduleClassroom(
        "candidate-1",
        future().toISOString(),
        "reviewer"
      )
    ).rejects.toThrow(BadRequestException);
    expect(tx.candidate.updateMany).not.toHaveBeenCalled();
  });

  it("records a rejection reason and allows a rejected background check to be reopened", async () => {
    const { service, tx, candidate } = setup({ status: "BACKGROUND_CHECK" });
    await service.reviewBackground(
      candidate.id,
      { decision: "rejected", reason: "Review required" },
      "reviewer"
    );
    const data = tx.candidate.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe("REJECTED");
    candidate.status = "REJECTED";
    candidate.documents = data.documents as Prisma.JsonValue;
    await service.reviewBackground(
      candidate.id,
      { decision: "pending" },
      "reviewer"
    );
    expect(tx.candidate.updateMany.mock.calls[1][0].data.status).toBe(
      "BACKGROUND_CHECK"
    );
  });

  it("does not complete future classroom bookings", async () => {
    const { service, candidate, tx } = setup({
      status: "CLASSROOM_SCHEDULED",
      classroomDate: future(),
    });
    await expect(
      service.completeClassroom(candidate.id, "reviewer")
    ).rejects.toThrow(/not started/);
    candidate.classroomDate = new Date(Date.now() - 86400000);
    await service.completeClassroom(candidate.id, "reviewer");
    expect(tx.candidate.updateMany.mock.calls[0][0].data.status).toBe(
      "CLASSROOM_COMPLETED"
    );
  });

  it("protects archived candidates from workflow changes", async () => {
    const { service, tx } = setup({
      status: "ACTIVE_DRIVER",
      userId: "driver-user",
    });
    await expect(
      service.reviewDocument(
        "candidate-1",
        { document: "driverLicenseImage", decision: "approved" },
        "reviewer"
      )
    ).rejects.toThrow(/archived/);
    expect(tx.candidate.updateMany).not.toHaveBeenCalled();
  });

  it("keeps archived applications out of the default candidate list", async () => {
    const { registration, prisma } = setup();
    await registration.getAllCandidates({ page: 0, pageSize: 10 });
    expect(prisma.candidate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { not: "ACTIVE_DRIVER" } } })
    );
    expect(workflowWhere("archived")).toEqual({
      status: { in: ["ACTIVE_DRIVER"] },
    });
  });
});

describe("Recruitment invitations and import", () => {
  it("does not create a token, send or advance when no provider is configured", async () => {
    const { service, prisma, email, messaging } = setup({ status: "LEAD" });
    const result = await service.contact(
      { channel: "whatsapp", candidateIds: ["candidate-1"] },
      "reviewer"
    );
    expect(result.sent).toBe(0);
    expect(result.results[0].message).toMatch(/not configured/);
    expect(prisma.candidate.updateMany).not.toHaveBeenCalled();
    expect(email.sendEmail).not.toHaveBeenCalled();
    expect(messaging.send).not.toHaveBeenCalled();
  });

  it("honours email preference, reuses a valid link and escapes email HTML", async () => {
    const { service, email, messaging, prisma } = setup({
      status: "LEAD",
      name: "<b>Test</b>",
      smsToken: "existing-token",
      tokenExpiry: future(),
      documents: { additionalData: { contactPreference: "email" } },
    });
    email.isEmailServiceConfigured.mockReturnValue(true);
    const result = await service.contact(
      { channel: "preferred", candidateIds: ["candidate-1"] },
      "reviewer"
    );
    expect(result.sent).toBe(1);
    expect(email.sendEmail.mock.calls[0][0].html).toContain(
      "&lt;b&gt;Test&lt;/b&gt;"
    );
    expect(email.sendEmail.mock.calls[0][0].text).toContain(
      "/register/existing-token"
    );
    expect(prisma.candidate.updateMany).toHaveBeenCalledTimes(1);
    expect(messaging.send).not.toHaveBeenCalled();
  });

  it("does not mark failed delivery as contacted", async () => {
    const { service, email, prisma } = setup({
      status: "LEAD",
      smsToken: "existing-token",
      tokenExpiry: future(),
    });
    email.isEmailServiceConfigured.mockReturnValue(true);
    email.sendEmail.mockResolvedValueOnce({ success: false });
    expect(
      (
        await service.contact(
          { channel: "email", candidateIds: ["candidate-1"] },
          "reviewer"
        )
      ).sent
    ).toBe(0);
    expect(prisma.candidate.updateMany).not.toHaveBeenCalled();
  });

  it("does not send to missing candidates or candidates who already submitted", async () => {
    const { service, prisma, messaging } = setup();
    messaging.isConfigured.mockReturnValue(true);
    prisma.candidate.findUnique.mockResolvedValueOnce(null);
    const result = await service.contact(
      { channel: "whatsapp", candidateIds: ["unavailable", "candidate-1"] },
      "reviewer"
    );
    expect(result.sent).toBe(0);
    expect(messaging.send).not.toHaveBeenCalled();
  });

  it("normalizes imported phones and skips duplicates and invalid rows", async () => {
    const { service, prisma } = setup();
    prisma.candidate.findFirst.mockResolvedValueOnce({ id: "existing" });
    const result = await TenantContext.runForOrganization("org-1", () =>
      service.importLeads(
        {
          source: "Indeed",
          leads: [
            { name: "Duplicate", phoneNumber: "07123 456789" },
            {
              name: "New Lead",
              phoneNumber: "0044 7123 456788",
              email: "new@example.com",
            },
            { name: "Invalid", phoneNumber: "123" },
          ],
        },
        "reviewer"
      )
    );
    expect(result.imported).toBe(1);
    expect(result.results.map((row) => row.status)).toEqual([
      "duplicate",
      "imported",
      "invalid",
    ]);
    expect(prisma.candidate.create.mock.calls[0][0].data).toMatchObject({
      phoneNumber: "+447123456788",
      organizationId: "org-1",
      status: "LEAD",
    });
  });
});

describe("Application submission", () => {
  it("saves emergency contacts inside application metadata and forbids manual stage skipping", async () => {
    const { registration, prisma } = setup();
    await registration.updateCandidate("candidate-1", {
      emergencyContactName: "Emergency Contact",
      emergencyContactPhone: "+447123456789",
      emergencyContactRelationship: "Friend",
      licenceExpiry: "2030-01-01",
    });
    const data = prisma.candidate.update.mock.calls[0][0].data;
    expect(data.emergencyContactName).toBeUndefined();
    expect(data.documents.additionalData.emergencyContact).toMatchObject({
      name: "Emergency Contact",
      relationship: "Friend",
    });
    expect(data.licenceExpiry).toEqual(new Date("2030-01-01"));
    prisma.candidate.update.mockClear();
    await expect(
      registration.updateCandidate("candidate-1", { status: "ACTIVE_DRIVER" })
    ).rejects.toThrow(/workflow/);
    expect(prisma.candidate.update).not.toHaveBeenCalled();
  });

  const application = {
    token: "valid-token",
    dateOfBirth: "1990-01-01",
    contactPreference: "email",
    email: "candidate@example.com",
    applicationDetails: { deliveryExperience: "yes", ownVan: "no" },
    ...requiredDocuments(),
  } as CompleteRegistrationDto;

  it("stores contact preference and application answers, consumes the link and awaits review", async () => {
    const { registration, prisma, candidate } = setup({
      status: "SMS_SENT",
      formCompleted: false,
    });
    prisma.candidate.findFirst.mockResolvedValue(candidate);
    await registration.completeRegistration(application);
    const data = prisma.candidate.update.mock.calls[0][0].data;
    expect(data).toMatchObject({
      status: "DOCUMENTS_UPLOADED",
      formCompleted: true,
      smsToken: null,
      tokenExpiry: null,
    });
    expect(data.documents.additionalData).toMatchObject({
      contactPreference: "email",
      applicationDetails: { deliveryExperience: "yes", ownVan: "no" },
    });
    expect(data.documents._recruitment).toBeUndefined();
  });

  it("rejects reused submissions and email preference without an address", async () => {
    const { registration, prisma, candidate } = setup({
      status: "SMS_SENT",
      formCompleted: true,
    });
    prisma.candidate.findFirst.mockResolvedValue(candidate);
    await expect(
      registration.completeRegistration(application)
    ).rejects.toThrow(/already been submitted/);
    candidate.formCompleted = false;
    candidate.email = null;
    await expect(
      registration.completeRegistration({ ...application, email: undefined })
    ).rejects.toThrow(/email address/);
    expect(prisma.candidate.update).not.toHaveBeenCalled();
  });
});
