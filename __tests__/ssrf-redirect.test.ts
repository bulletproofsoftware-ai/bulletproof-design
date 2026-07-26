import * as http from "node:http";
import type { AddressInfo } from "node:net";
import { fetchNoRebind } from "../src/api/lib/sanitize";
import { validateSearchQuery } from "../src/api/lib/validation";

describe("fetchNoRebind re-validates redirect hops", () => {
  let server: http.Server;
  let port = 0;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === "/rebind") {
        // A permitted host bouncing us at loopback — the classic bypass of a
        // guard that only ever saw the URL the caller passed in.
        res.writeHead(302, { Location: "http://127.0.0.1:1/internal" });
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("refuses a loopback target outright", async () => {
    await expect(fetchNoRebind(`http://127.0.0.1:${port}/ok`)).rejects.toThrow(
      /Invalid URL/,
    );
  });

  it("refuses a redirect that lands on loopback", async () => {
    await expect(
      fetchNoRebind(`http://127.0.0.1:${port}/rebind`),
    ).rejects.toThrow(/Invalid URL/);
  });

  it("refuses a non-http scheme", async () => {
    await expect(fetchNoRebind("file:///etc/passwd")).rejects.toThrow(
      /Invalid URL/,
    );
  });

  it("refuses embedded credentials", async () => {
    await expect(
      fetchNoRebind("http://user:pass@example.com/"),
    ).rejects.toThrow(/Invalid URL/);
  });
});

describe("validateSearchQuery rejects non-string input", () => {
  it("accepts a normal query", () => {
    expect(validateSearchQuery("button")).toBe(true);
  });

  it("rejects an over-long query", () => {
    expect(validateSearchQuery("x".repeat(201))).toBe(false);
  });

  it("rejects control characters", () => {
    expect(validateSearchQuery(`a${String.fromCharCode(1)}b`)).toBe(false);
  });

  it("rejects an array that would otherwise slip past the length check", () => {
    // ?q=<150 chars>&q=<150 chars> arrives as an array whose .length is 2,
    // so the 200-character cap passed while 300 characters of text got through.
    const repeated = ["x".repeat(150), "y".repeat(150)] as unknown as string;
    expect(validateSearchQuery(repeated)).toBe(false);
  });
});
