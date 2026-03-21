import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock jose before importing auth middleware
const mockJwtVerify = vi.fn();
vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn(() => "mock-jwks"),
  jwtVerify: mockJwtVerify,
}));

// Set env before importing middleware (it reads LOGTO_ENDPOINT at module load)
process.env.LOGTO_ENDPOINT = "https://mock-logto.example.com";

function createMockReq(headers: Record<string, string> = {}): any {
  return { headers };
}

function createMockRes(): any {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("verifyLogtoJWT middleware", () => {
  let verifyLogtoJWT: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../middleware/auth.js");
    verifyLogtoJWT = mod.verifyLogtoJWT;
  });

  it("returns 401 when no Authorization header is present", async () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    await verifyLogtoJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Missing or invalid Authorization header",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header does not start with Bearer", async () => {
    const req = createMockReq({ authorization: "Basic abc123" });
    const res = createMockRes();
    const next = vi.fn();

    await verifyLogtoJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Missing or invalid Authorization header",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when token is malformed or invalid", async () => {
    mockJwtVerify.mockRejectedValue(new Error("JWS signature invalid"));

    const req = createMockReq({ authorization: "Bearer invalid-token" });
    const res = createMockRes();
    const next = vi.fn();

    await verifyLogtoJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid or expired token",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() and sets req.auth.userId when token is valid", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: "user-abc-123",
        iss: "https://mock-logto.example.com/oidc",
      },
    });

    const req = createMockReq({ authorization: "Bearer valid-token" });
    const res = createMockRes();
    const next = vi.fn();

    await verifyLogtoJWT(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.auth).toBeDefined();
    expect(req.auth.userId).toBe("user-abc-123");
    expect(req.auth.payload.sub).toBe("user-abc-123");
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 401 when token has no sub claim", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: {
        iss: "https://mock-logto.example.com/oidc",
        // no sub
      },
    });

    const req = createMockReq({ authorization: "Bearer token-no-sub" });
    const res = createMockRes();
    const next = vi.fn();

    await verifyLogtoJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Token missing sub claim",
    });
    expect(next).not.toHaveBeenCalled();
  });
});

describe("health endpoint auth bypass", () => {
  it("health endpoint does not return 401 without Authorization header", async () => {
    // We cannot easily test this with supertest because importing index.ts
    // would require real DB connections. Instead, verify the route definition
    // does not include verifyLogtoJWT by reading the source.
    const fs = await import("fs");
    const path = await import("path");
    const indexPath = path.resolve(
      import.meta.dirname ?? ".",
      "../index.ts",
    );
    const source = fs.readFileSync(indexPath, "utf-8");

    // Find the health route line
    const healthLine = source
      .split("\n")
      .find((line: string) => line.includes('"/health"'));
    expect(healthLine).toBeDefined();
    expect(healthLine).not.toContain("verifyLogtoJWT");
  });
});
