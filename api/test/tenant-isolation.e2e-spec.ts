/**
 * End-to-end proof that one DSP cannot read or change another DSP's data.
 *
 * Runs against a live API (default http://127.0.0.1:3000) with the local test
 * DSPs created by:
 *   npx prisma migrate deploy && npx prisma db seed
 *   npx ts-node scripts/dev-setup-tenants.ts
 *   npm run start:dev            (in another terminal)
 *   npm run test:e2e -- tenant-isolation
 *
 * DSP A is reached through Host "localhost", DSP B through Host "127.0.0.1".
 */
import { request as httpRequest } from "http";

const API = new URL(process.env.E2E_API_URL ?? "http://127.0.0.1:3000");

type Session = { host: string; cookie: string };
type Reply = { status: number; json: any; setCookie: string[] };

/** node:http is used because fetch does not allow overriding the Host header */
function send(
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: unknown
): Promise<Reply> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: API.hostname,
        port: API.port,
        method,
        path,
        headers: {
          ...headers,
          ...(payload
            ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
            : {}),
        },
      },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (text += chunk));
        res.on("end", () => {
          let json: any = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = text;
          }
          const raw = res.headers["set-cookie"];
          resolve({ status: res.statusCode ?? 0, json, setCookie: raw ?? [] });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function signIn(host: string, email: string, password = "admin123456"): Promise<Session> {
  const res = await send(
    "POST",
    "/api/auth/sign-in/email",
    { Host: host, Origin: `http://${host}:4200` },
    { email, password }
  );
  expect(res.status).toBe(200);
  const cookie = res.setCookie
    .map((c) => c.split(";")[0])
    .filter((c) => c.startsWith("better-auth.session_token="))
    .join("; ");
  expect(cookie).not.toBe("");
  return { host, cookie };
}

function call(session: Session, method: string, path: string, body?: unknown): Promise<Reply> {
  return send(method, `/api/${path}`, { Host: session.host, Cookie: session.cookie }, body);
}

const idsOf = (payload: any): string[] => {
  const list = Array.isArray(payload) ? payload : (payload?.data ?? payload?.items ?? []);
  return Array.isArray(list) ? list.map((item: any) => item.id).filter(Boolean) : [];
};

describe("DSP data isolation (e2e)", () => {
  let a: Session;
  let b: Session;

  beforeAll(async () => {
    a = await signIn("localhost", "admin@dsphub.com");
    b = await signIn("127.0.0.1", "admin@dsp-b.test");
  });

  it("rejects a domain that is not linked to any DSP", async () => {
    const res = await send("GET", "/api/drivers", { Host: "not-a-dsp.test" });
    expect(res.status).toBe(404);
  });

  it("does not accept DSP B's session on DSP A's domain", async () => {
    const res = await call({ host: a.host, cookie: b.cookie }, "GET", "drivers");
    expect(res.status).toBe(403);
  });

  const LISTS = [
    "drivers",
    "vans",
    "depots",
    "contracts",
    "parts",
    "maintenance",
    "invoices",
    "recruitment/candidates",
    "users",
  ];

  it.each(LISTS)("lists of %s never overlap between DSPs", async (path) => {
    const [ra, rb] = await Promise.all([call(a, "GET", path), call(b, "GET", path)]);
    expect(ra.status).toBeLessThan(300);
    expect(rb.status).toBeLessThan(300);
    const idsA = new Set(idsOf(ra.json));
    for (const id of idsOf(rb.json)) {
      expect(idsA.has(id)).toBe(false);
    }
  });

  it("DSP A cannot read, change or delete DSP B's driver", async () => {
    const [driverB] = idsOf((await call(b, "GET", "drivers")).json);
    expect(driverB).toBeDefined();

    expect((await call(a, "GET", `drivers/${driverB}`)).status).toBe(404);
    expect((await call(a, "PUT", `drivers/${driverB}`, { name: "hacked" })).status).toBe(404);
    expect((await call(a, "DELETE", `drivers/${driverB}`)).status).toBe(404);

    const still = await call(b, "GET", `drivers/${driverB}`);
    expect(still.json.name).not.toBe("hacked");
    expect(still.json.status).not.toBe("INACTIVE");
  });

  it("DSP A cannot read or change DSP B's van", async () => {
    const [vanB] = idsOf((await call(b, "GET", "vans")).json);
    expect(vanB).toBeDefined();
    expect((await call(a, "GET", `vans/${vanB}`)).status).toBe(404);
    expect((await call(a, "PUT", `vans/${vanB}`, { comments: "hacked" })).status).toBe(404);
  });

  it("new records land in the DSP of the domain, whatever the body says", async () => {
    const depotsA = idsOf((await call(a, "GET", "depots")).json);
    const vanNumber = `E2E${Date.now() % 100000}`;

    // Using a depot of DSP A while logged in on DSP B is refused
    const foreignDepot = await call(b, "POST", "vans", {
      vanNumber,
      registration: `E2E ${vanNumber}`,
      make: "Ford",
      model: "Transit",
      depotId: depotsA[0],
    });
    expect(foreignDepot.status).toBe(400);

    const created = await call(b, "POST", "vans", {
      vanNumber,
      registration: `E2E ${vanNumber}`,
      make: "Ford",
      model: "Transit",
    });
    expect(created.status).toBe(201);
    expect(idsOf((await call(a, "GET", "vans")).json)).not.toContain(created.json.id);
    expect(idsOf((await call(b, "GET", "vans")).json)).toContain(created.json.id);
  });

  it("a user of DSP B does not exist for DSP A", async () => {
    const usersB = idsOf((await call(b, "GET", "users?limit=100")).json);
    for (const id of usersB) {
      expect((await call(a, "GET", `users/${id}`)).status).toBe(404);
    }
  });

  it("dashboards only count their own DSP", async () => {
    const statsB = await call(b, "GET", "drivers/stats");
    expect(statsB.status).toBe(200);
    expect(statsB.json.total).toBeLessThan((await call(a, "GET", "drivers/stats")).json.total);
  });

  it("a manager limited to one depot only sees that depot, and can log in with a password set by the admin", async () => {
    const depots = (await call(a, "GET", "depots")).json as Array<{ id: string; code: string }>;
    const depot = depots[0];
    const email = `manager.e2e.${Date.now()}@dsphub.test`;

    const created = await call(a, "POST", "users", {
      email,
      name: "Manager E2E",
      password: "Manager#12345",
      role: "MANAGER_ONSITE",
    });
    expect(created.status).toBe(201);

    const limited = await call(a, "PUT", `depots/members/${created.json.id}`, {
      depotIds: [depot.id],
    });
    expect(limited.status).toBe(200);
    expect(limited.json.allDepots).toBe(false);

    const manager = await signIn("localhost", email, "Manager#12345");
    const drivers = (await call(manager, "GET", "drivers")).json as Array<{ homeDepotId: string }>;
    expect(drivers.length).toBeGreaterThan(0);
    expect(drivers.every((driver) => driver.homeDepotId === depot.id)).toBe(true);

    const visibleDepots = idsOf((await call(manager, "GET", "depots")).json);
    expect(visibleDepots).toEqual([depot.id]);

    // Managers cannot see drivers of other depots by id either
    const other = (await call(a, "GET", "drivers")).json.find(
      (driver: { homeDepotId: string }) => driver.homeDepotId !== depot.id
    );
    if (other) {
      expect((await call(manager, "GET", `drivers/${other.id}`)).status).toBe(404);
    }

    // Cleanup: remove the test manager from the DSP
    expect((await call(a, "DELETE", `users/${created.json.id}`)).status).toBeLessThan(300);
  });

  it("uploads are not publicly served", async () => {
    const res = await send("GET", "/uploads/avatars/anything.png", { Host: "localhost" });
    expect(res.status).toBe(404);
  });
});
