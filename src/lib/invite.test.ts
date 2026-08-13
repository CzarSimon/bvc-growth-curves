import { describe, expect, it } from "vitest";
import { hashInviteToken, isPlausibleToken, newInviteToken, readableHost } from "./invite";

describe("invite tokens", () => {
  it("are long enough that guessing one is not an attack", () => {
    // 16 random bytes, base64url. The length is the whole defence: the design's
    // six-character code would be sweepable.
    const token = newInviteToken();
    expect(token).toHaveLength(22);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(newInviteToken()).not.toBe(token);
  });

  it("are stored only as a sha256", () => {
    const hash = hashInviteToken("WpM-DAK7J5ysyC5XWuDDPg");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Stable, or every existing link would die on deploy.
    expect(hash).toBe(hashInviteToken("WpM-DAK7J5ysyC5XWuDDPg"));
    expect(hash).not.toBe(hashInviteToken("WpM-DAK7J5ysyC5XWuDDPq"));
  });

  it("rejects anything not shaped like one before it reaches the database", () => {
    expect(isPlausibleToken(newInviteToken())).toBe(true);
    expect(isPlausibleToken("abc123")).toBe(false);
    expect(isPlausibleToken("not a token")).toBe(false);
    expect(isPlausibleToken("a".repeat(65))).toBe(false);
    expect(isPlausibleToken("../../etc/passwd")).toBe(false);
  });
});

describe("the host in a link a person reads", () => {
  it("shows the IDN as its own name, not as punycode", () => {
    expect(readableHost("xn--barntillvxt-t8a.com")).toBe("barntillväxt.com");
    expect(readableHost("www.xn--barntillvxt-t8a.com")).toBe("www.barntillväxt.com");
    expect(readableHost("xn--barntillvxt-t8a.se")).toBe("barntillväxt.se");
  });

  it("leaves every ordinary host alone", () => {
    expect(readableHost("localhost:3000")).toBe("localhost:3000");
    expect(readableHost("bvc-growth-curves-pink.vercel.app")).toBe(
      "bvc-growth-curves-pink.vercel.app",
    );
    expect(readableHost("[::1]:3000")).toBe("[::1]:3000");
  });

  it("keeps the port", () => {
    expect(readableHost("xn--barntillvxt-t8a.com:8443")).toBe("barntillväxt.com:8443");
  });

  it("hands back anything it cannot decode rather than mangling it", () => {
    expect(readableHost("xn--")).toBe("xn--");
    expect(readableHost("xn--a.xn--")).toBe("xn--a.xn--");
  });
});
