/**
 * Address-range coverage for sanitizeUrl's SSRF guard.
 *
 * CodeQL alert #125 (js/request-forgery, critical) was dismissed citing this
 * guard, so a range it fails to recognise silently invalidates that dismissal.
 * These tests drive sanitizeUrl through a stubbed resolver so every range can
 * be exercised without depending on real DNS.
 *
 * Two behaviours are pinned here:
 *   - the ranges isPrivateIp must reject, including the ones it previously
 *     missed (CGNAT, IPv4-mapped IPv6, benchmarking, multicast, reserved)
 *   - that *every* answer is checked, not just the first, so a host publishing
 *     both a public and a private record cannot pass on the public one
 */
import { jest } from "@jest/globals";

const lookupMock = jest.fn();

jest.unstable_mockModule("node:dns/promises", () => ({
  lookup: lookupMock,
}));

const { sanitizeUrl } = await import("../src/api/lib/sanitize");

/** Shape a dns.lookup({all:true}) answer. */
function answers(...addresses: string[]) {
  return addresses.map((address) => ({
    address,
    family: address.includes(":") ? 6 : 4,
  }));
}

beforeEach(() => {
  lookupMock.mockReset();
});

describe("sanitizeUrl rejects internal address ranges", () => {
  const blocked: Array<[string, string]> = [
    ["loopback", "127.0.0.1"],
    ["RFC1918 10/8", "10.0.0.1"],
    ["RFC1918 172.16/12", "172.16.0.1"],
    ["RFC1918 192.168/16", "192.168.1.1"],
    ["this-network 0/8", "0.0.0.1"],
    ["link-local / cloud metadata", "169.254.169.254"],
    ["CGNAT lower bound", "100.64.0.1"],
    ["CGNAT upper bound", "100.127.255.254"],
    ["benchmarking 198.18/15", "198.18.0.1"],
    ["multicast 224/4", "224.0.0.1"],
    ["reserved 240/4", "240.0.0.1"],
    ["broadcast", "255.255.255.255"],
    ["IPv6 loopback", "::1"],
    ["IPv6 unspecified", "::"],
    ["IPv6 unique-local", "fc00::1"],
    ["IPv6 link-local", "fe80::1"],
    ["IPv4-mapped loopback", "::ffff:127.0.0.1"],
    ["IPv4-mapped metadata", "::ffff:169.254.169.254"],
  ];

  it.each(blocked)("rejects %s (%s)", async (_label, address) => {
    lookupMock.mockResolvedValue(answers(address));
    await expect(sanitizeUrl("https://attacker.test/x")).rejects.toThrow(
      /Invalid URL/,
    );
  });
});

describe("sanitizeUrl allows public addresses", () => {
  const allowed: Array<[string, string]> = [
    ["public IPv4", "93.184.216.34"],
    ["public resolver", "8.8.8.8"],
    // 100.63 and 100.128 sit just outside 100.64.0.0/10 and must not be caught
    // by the CGNAT pattern.
    ["just below CGNAT", "100.63.255.255"],
    ["just above CGNAT", "100.128.0.1"],
    ["public IPv6", "2606:4700::1111"],
  ];

  it.each(allowed)("allows %s (%s)", async (_label, address) => {
    lookupMock.mockResolvedValue(answers(address));
    await expect(sanitizeUrl("https://example.com/x")).resolves.toContain(
      "example.com",
    );
  });
});

describe("sanitizeUrl checks every resolved address", () => {
  it("rejects when a later answer is internal", async () => {
    // The single-address form of dns.lookup would have returned only the
    // public answer here and let the request through.
    lookupMock.mockResolvedValue(answers("93.184.216.34", "127.0.0.1"));
    await expect(sanitizeUrl("https://split-horizon.test/x")).rejects.toThrow(
      /private or reserved/,
    );
  });

  it("rejects when the resolver returns no addresses at all", async () => {
    lookupMock.mockResolvedValue([]);
    await expect(sanitizeUrl("https://empty.test/x")).rejects.toThrow(
      /Invalid URL/,
    );
  });

  it("requests all addresses rather than just the first", async () => {
    lookupMock.mockResolvedValue(answers("93.184.216.34"));
    await sanitizeUrl("https://example.com/x");
    expect(lookupMock).toHaveBeenCalledWith("example.com", { all: true });
  });
});
