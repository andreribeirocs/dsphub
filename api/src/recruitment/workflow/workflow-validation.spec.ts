import { Logger } from "@nestjs/common";
import { EnhancedValidationPipe } from "../../shared/pipes/validation.pipe";
import {
  BulkContactDto,
  ImportLeadsDto,
  ScheduleRideAlongDto,
} from "../dto/workflow.dto";

describe("Workflow request validation", () => {
  const pipe = new EnhancedValidationPipe();
  beforeEach(() =>
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined)
  );
  afterEach(() => jest.restoreAllMocks());

  it("does not bypass validation for JSON that imitates a file upload", async () => {
    await expect(
      pipe.transform(
        {
          fieldname: "upload",
          originalname: "file",
          mimetype: "text/plain",
          buffer: "fake",
          candidateIds: ["candidate-1"],
          channel: "unapproved-channel",
        },
        { type: "body", metatype: BulkContactDto }
      )
    ).rejects.toThrow();
  });
  it("rejects missing scheduling dates, oversized batches and invalid nested leads", async () => {
    await expect(
      pipe.transform(
        { homeDepotId: "depot-1", transporterId: "ABC" },
        { type: "body", metatype: ScheduleRideAlongDto }
      )
    ).rejects.toThrow();
    await expect(
      pipe.transform(
        {
          channel: "email",
          candidateIds: Array.from({ length: 101 }, (_, i) => `${i}`),
        },
        { type: "body", metatype: BulkContactDto }
      )
    ).rejects.toThrow();
    await expect(
      pipe.transform(
        {
          source: "Indeed",
          leads: [
            {
              name: "Test",
              phoneNumber: "+447700900123",
              email: "not-an-email",
            },
          ],
        },
        { type: "body", metatype: ImportLeadsDto }
      )
    ).rejects.toThrow();
  });
  it("preserves real upload buffers", async () => {
    const upload = {
      fieldname: "file",
      originalname: "document.png",
      mimetype: "image/png",
      buffer: Buffer.from("example"),
    };
    expect(
      await pipe.transform(upload, { type: "custom", metatype: Object })
    ).toBe(upload);
  });
});
