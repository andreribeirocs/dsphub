import { readFileSync } from "fs";
import { join } from "path";
import {
  parseServiceReport,
  parsePlannedDuration,
  headerMatches,
} from "./service-report.parser";
import {
  buildShifts,
  buildRouteAssignments,
  unattributedByDate,
  serviceTypeUsage,
} from "./service-report.rules";

/**
 * The fixture is a real Service Details Report, unedited apart from being cut
 * down to a few days. Testing against Amazon's actual output is the point: the
 * empty cells and the inconsistent name casing are the hard part, and a
 * hand-written fixture would quietly tidy them away.
 */
const CSV = readFileSync(
  join(__dirname, "__fixtures__", "service-details.sample.csv"),
  "utf8"
);

describe("parseServiceReport", () => {
  const report = parseServiceReport(CSV);

  it("reads Amazon's export, BOM and all, without complaints", () => {
    expect(report.problems).toEqual([]);
    expect(report.rows.length).toBeGreaterThan(40);
    expect(report.dates).toEqual(["2025-02-23", "2025-02-24", "2025-02-26"]);
  });

  it("recognises the expected header and rejects a changed one", () => {
    expect(headerMatches(CSV.split("\n")[0])).toBe(true);
    expect(headerMatches("Date,Station,Something Else")).toBe(false);
  });

  it("flags a changed export instead of importing it silently", () => {
    const changed = parseServiceReport("Date,Station\n2025-02-23,Portsmouth");
    expect(changed.problems[0].reason).toMatch(/Header does not match/);
  });

  it("keeps an empty distance as null, never as zero", () => {
    // Kieran helped Farayi on CA_A177: Amazon left his distance blank.
    // Reading that as 0 would turn "no mileage recorded" into "drove nothing"
    // and break the rule that identifies helpers.
    const helper = report.rows.find(
      (r) => r.date === "2025-02-23" && r.route === "CA_A177" && r.deliveryAssociate === "Kieran moonan"
    )!;
    expect(helper.distancePlanned).toBeNull();
    expect(helper.deliveriesPerformed).toBe(26);
  });

  it("keeps the driver name exactly as Amazon spelled it", () => {
    // Lower-case surname in the source; normalising here would hide the very
    // messiness that the name-matching step has to cope with.
    expect(
      report.rows.some((r) => r.deliveryAssociate === "Kieran moonan")
    ).toBe(true);
  });

  it("reads a Training Day row that names nobody", () => {
    const training = report.rows.find((r) => r.serviceType === "Training Day")!;
    expect(training.deliveryAssociate).toBe("");
    expect(training.route).toBe("1BFU0C1RXK"); // not the CA_Annn shape
  });

  it("parses planned duration in both shapes Amazon uses", () => {
    expect(parsePlannedDuration("9 hr")).toBe(540);
    expect(parsePlannedDuration("9 hr 15 min")).toBe(555);
    expect(parsePlannedDuration("")).toBeNull();
  });
});

describe("buildShifts", () => {
  const { rows } = parseServiceReport(CSV);
  const shifts = buildShifts(rows);

  it("counts a sweeper's day once, not once per route swept", () => {
    // Salvyn Kisitu swept CA_A215, CA_A219 and CA_A221 on 2025-02-24 with a
    // single 15:10 -> 18:16 shift. Summing per row would bill ~9 hours for a
    // 3-hour day, and this is exactly the figure an Amazon audit looks at.
    const sweeper = shifts.filter(
      (s) => s.date === "2025-02-24" && s.deliveryAssociate === "Salvyn Kisitu"
    );
    expect(sweeper).toHaveLength(1);
    expect(sweeper[0].rows).toHaveLength(3);
    expect(sweeper[0].source).toBe("recorded");
    expect(sweeper[0].workedMinutes).toBe(186); // 15:10:27 -> 18:16:22, ~3h06
    // ...and emphatically not the ~9h that summing the three rows would give
    expect(sweeper[0].workedMinutes).toBeLessThan(4 * 60);
  });

  it("estimates from the planned duration when the driver never signed off", () => {
    const shift = shifts.find(
      (s) => s.date === "2025-02-23" && s.deliveryAssociate === "Kieran moonan"
    )!;
    expect(shift.logIn).not.toBeNull();
    expect(shift.logOut).toBeNull();
    expect(shift.source).toBe("estimated_from_planned");
    expect(shift.workedMinutes).toBe(540);
  });

  it("refuses to invent hours when there is no sign-in at all", () => {
    const shift = shifts.find(
      (s) => s.date === "2025-02-23" && s.deliveryAssociate === "Zavon Blackman"
    )!;
    expect(shift.source).toBe("missing");
    expect(shift.workedMinutes).toBeNull();
  });

  it("leaves rows that name nobody out of the shift list", () => {
    expect(shifts.every((s) => s.deliveryAssociate !== "")).toBe(true);
  });

  it("reports how much of the file still needs a human", () => {
    const bySource = {
      recorded: shifts.filter((s) => s.source === "recorded").length,
      estimated: shifts.filter((s) => s.source === "estimated_from_planned").length,
      missing: shifts.filter((s) => s.source === "missing").length,
    };
    // Not an assertion about good data - a guard so that if a future change
    // starts silently filling gaps, this number moves and someone notices.
    expect(bySource.recorded + bySource.estimated + bySource.missing).toBe(
      shifts.length
    );
    expect(bySource.missing).toBeGreaterThan(0);
  });
});

describe("buildRouteAssignments", () => {
  const { rows } = parseServiceReport(CSV);
  const assignments = buildRouteAssignments(rows);

  it("finds one primary driver and the helpers on every shared route", () => {
    const shared = assignments.filter((a) => a.helpers.length > 0);
    expect(shared.length).toBeGreaterThan(0);
    for (const a of shared) {
      expect(a.primary).not.toBeNull();
      expect(a.primary!.distancePlanned).not.toBeNull();
      expect(a.helpers.every((h) => h.distancePlanned === null)).toBe(true);
    }
  });

  it("identifies the help that has to move money between two drivers", () => {
    const route = assignments.find(
      (a) => a.date === "2025-02-23" && a.route === "CA_A177"
    )!;
    expect(route.primary!.deliveryAssociate).toBe("Farayi Muchemenyi");
    expect(route.helpers.map((h) => h.deliveryAssociate)).toEqual([
      "Kieran moonan",
    ]);
    expect(route.irregular).toBe(false);
  });

  it("does not treat a lone flat-rate row as somebody's helper", () => {
    // Training Day has no distance and no colleague: it is paid on its own.
    const training = assignments.find((a) => a.route === "1BFU0C1RXK")!;
    expect(training.helpers).toEqual([]);
    expect(training.irregular).toBe(false);
  });

  it("marks anything outside the one-primary shape instead of guessing", () => {
    const irregular = assignments.filter((a) => a.irregular);
    expect(irregular).toEqual([]); // true for this report; a flag, not a silent fix
  });
});

describe("unattributedByDate", () => {
  const { rows } = parseServiceReport(CSV);

  it("counts what Amazon paid without naming anyone, so it can be claimed", () => {
    // Amazon pays the training day but leaves the associate blank. The only
    // way to check it is by date and count against the recruitment records:
    // three people in the classroom and one line paid means two are owed.
    const open = unattributedByDate(rows);
    expect(open).toEqual([
      { date: "2025-02-26", serviceType: "Training Day", count: 1 },
    ]);
  });
});

describe("serviceTypeUsage", () => {
  const { rows } = parseServiceReport(CSV);

  it("lists the service types so new ones can be spotted on import", () => {
    const usage = serviceTypeUsage(rows);
    const names = usage.map((u) => u.serviceType);
    expect(names).toContain("Standard Parcel Medium Van");
    expect(names).toContain("Standard Parcel Ride Along (Ironhide) - Medium Van");
    expect(names).toContain("Training Day");
    expect(names).toContain("Nursery Route Level 1");
  });
});
