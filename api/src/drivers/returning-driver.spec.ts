import {
  normaliseNin,
  isPlausibleNin,
  findReturningDriver,
  type KnownDriver,
} from "./returning-driver";
import {
  codeForAmazonLabel,
  mapLabels,
  INTERNAL_ONLY_CODES,
} from "../amazon-import/service-type-map";

const driver = (over: Partial<KnownDriver> = {}): KnownDriver => ({
  id: "driver-1",
  name: "Kieran Moonan",
  insuranceNumber: "AB123456C",
  status: "OFFBOARDED",
  stints: [
    {
      startDate: new Date("2023-05-02"),
      endDate: new Date("2025-03-14"),
      exitReason: "PERSONAL",
      exitNotes: "Moved back to Ireland for family reasons",
      transporterId: "A1B2C3",
    },
  ],
  ...over,
});

describe("normaliseNin", () => {
  it("treats spacing and case as noise", () => {
    expect(normaliseNin("ab 12 34 56 c")).toBe("AB123456C");
    expect(normaliseNin("AB-123456-C")).toBe("AB123456C");
    expect(normaliseNin("")).toBeNull();
    expect(normaliseNin(null)).toBeNull();
  });
});

describe("isPlausibleNin", () => {
  it("accepts a well-formed number", () => {
    expect(isPlausibleNin("AB123456C")).toBe(true);
    expect(isPlausibleNin("ab 12 34 56 a")).toBe(true);
  });

  it("rejects shapes that cannot be a NIN", () => {
    expect(isPlausibleNin("AB12345C")).toBe(false); // five digits
    expect(isPlausibleNin("AB123456E")).toBe(false); // suffix past D
    expect(isPlausibleNin("A1234567C")).toBe(false);
  });

  it("rejects prefixes HMRC never issues, which are usually typos", () => {
    expect(isPlausibleNin("QQ123456A")).toBe(false); // reserved, used in fixtures
    expect(isPlausibleNin("BG123456A")).toBe(false);
    expect(isPlausibleNin("DA123456A")).toBe(false);
  });
});

describe("findReturningDriver", () => {
  it("recognises the same person behind a new email and no transporter ID", () => {
    const [match] = findReturningDriver(
      { name: "Kieran Moonan", insuranceNumber: "ab 12 34 56 c" },
      [driver()]
    );
    expect(match.driverId).toBe("driver-1");
    expect(match.confidence).toBe("nin_exact");
    expect(match.currentlyActive).toBe(false);
    expect(match.reason).toContain("left on 2025-03-14");
    expect(match.reason).toContain("personal");
  });

  it("hands back the prior history so hiring stays a human decision", () => {
    const [match] = findReturningDriver(
      { name: "Kieran Moonan", insuranceNumber: "AB123456C" },
      [driver()]
    );
    expect(match.priorStints).toHaveLength(1);
    expect(match.priorStints[0].exitNotes).toMatch(/family reasons/);
    // Nothing here blocks the hire: the exit reason is a record, not a gate.
    expect(Object.keys(match)).not.toContain("blocked");
  });

  it("warns when the NIN matches but the name does not", () => {
    const [match] = findReturningDriver(
      { name: "Ciaran Mooney", insuranceNumber: "AB123456C" },
      [driver()]
    );
    expect(match.confidence).toBe("nin_exact_name_differs");
    expect(match.reason).toMatch(/name differs/);
  });

  it("treats a differently ordered name as the same name", () => {
    const [match] = findReturningDriver(
      { name: "Moonan Kieran", insuranceNumber: "AB123456C" },
      [driver()]
    );
    expect(match.confidence).toBe("nin_exact");
  });

  it("calls out a duplicate application rather than a return", () => {
    const [match] = findReturningDriver(
      { name: "Kieran Moonan", insuranceNumber: "AB123456C" },
      [driver({ status: "ACTIVE" })]
    );
    expect(match.currentlyActive).toBe(true);
    expect(match.reason).toMatch(/already an active driver/);
  });

  it("stays silent when there is no NIN to match on", () => {
    expect(
      findReturningDriver({ name: "Someone New", insuranceNumber: null }, [driver()])
    ).toEqual([]);
    expect(
      findReturningDriver({ name: "Someone New", insuranceNumber: "" }, [driver()])
    ).toEqual([]);
  });

  it("does not match on name alone", () => {
    expect(
      findReturningDriver(
        { name: "Kieran Moonan", insuranceNumber: "ZZ999999D" },
        [driver()]
      )
    ).toEqual([]);
  });

  it("returns every collision instead of picking one", () => {
    const matches = findReturningDriver(
      { name: "Kieran Moonan", insuranceNumber: "AB123456C" },
      [driver(), driver({ id: "driver-2", name: "K. Moonan" })]
    );
    // Two people on one NIN is itself a problem the recruiter must see.
    expect(matches).toHaveLength(2);
  });
});

describe("service type mapping", () => {
  it("maps the labels seen in a real Amazon report", () => {
    expect(codeForAmazonLabel("Standard Parcel Medium Van")).toBe(
      "STANDARD_PARCEL_MEDIUM_VAN"
    );
    expect(codeForAmazonLabel("Standard Parcel - Low Emission Vehicle (Large)")).toBe(
      "STANDARD_PARCEL_LOW_EMISSION_VEHICLE_LARGE"
    );
    expect(codeForAmazonLabel("Training Day")).toBe("TRAINING_DAY");
    expect(codeForAmazonLabel("Nursery Route Level 1")).toBe("NURSERY_ROUTE_LEVEL_1");
  });

  it("ignores spacing and case, which vary between exports", () => {
    expect(codeForAmazonLabel("  standard   parcel medium van ")).toBe(
      "STANDARD_PARCEL_MEDIUM_VAN"
    );
  });

  it("surfaces an unknown label with its row count instead of dropping it", () => {
    // A label nobody maps is paid work that would otherwise vanish from pay.
    const report = mapLabels([
      "Standard Parcel Medium Van",
      "Cargo Bike Route",
      "Cargo Bike Route",
      "Training Day",
    ]);
    expect(report.mapped.get("Training Day")).toBe("TRAINING_DAY");
    expect(report.unmapped).toEqual([{ label: "Cargo Bike Route", rows: 2 }]);
  });

  it("keeps HALF_ROUTE listed as an internal type Amazon never sends", () => {
    // Two drivers split one route; Amazon still pays it as a single line.
    expect(INTERNAL_ONLY_CODES).toContain("HALF_ROUTE");
    expect(INTERNAL_ONLY_CODES).toContain("SWEEPER");
    expect(codeForAmazonLabel("Half Route")).toBeNull();
  });
});
