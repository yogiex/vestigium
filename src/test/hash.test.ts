/**
 * test/hash.test.ts — Vektor FIPS/NIST untuk SHA-256
 * Ref: CC-40, CC-41
 */

import { describe, it, expect } from "vitest";
import { compute, entryHash, selfTest, isValidHashFormat } from "../lib/hash";

describe("SHA-256 FIPS/NIST Test Vectors", () => {
  it("empty string", async () => {
    const hash = await compute("");
    expect(hash).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("'abc' (NIST FIPS 180-2)", async () => {
    const hash = await compute("abc");
    expect(hash).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("448-bit message (NIST FIPS 180-2)", async () => {
    const hash = await compute(
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"
    );
    expect(hash).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
    );
  });

  it("always returns 64 hex characters", async () => {
    const hash = await compute("test");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("entryHash", () => {
  it("produces consistent hash for same input", async () => {
    const entry = {
      id: "test-001",
      at: "2024-01-01T00:00:00.000Z",
      actor: "examiner",
      action: "CREATED",
      target: "CASE-20240101-001",
      detail: "Kasus dibuat",
      prevHash: "",
    };

    const hash1 = await entryHash(entry);
    const hash2 = await entryHash(entry);
    expect(hash1).toBe(hash2);
  });

  it("produces different hash for different input", async () => {
    const entry1 = {
      id: "test-001",
      at: "2024-01-01T00:00:00.000Z",
      actor: "examiner",
      action: "CREATED",
      target: "CASE-20240101-001",
      detail: "Kasus dibuat",
      prevHash: "",
    };

    const entry2 = {
      ...entry1,
      detail: "Kasus dibuat (versi 2)",
    };

    const hash1 = await entryHash(entry1);
    const hash2 = await entryHash(entry2);
    expect(hash1).not.toBe(hash2);
  });
});

describe("selfTest", () => {
  it("passes all FIPS/NIST vectors", async () => {
    const result = await selfTest();
    expect(result.passed).toBe(true);
    expect(result.results.every((r) => r.passed)).toBe(true);
  });
});

describe("isValidHashFormat", () => {
  it("validates 64 hex characters", () => {
    expect(
      isValidHashFormat(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      )
    ).toBe(true);
  });

  it("rejects invalid formats", () => {
    expect(isValidHashFormat("")).toBe(false);
    expect(isValidHashFormat("abc")).toBe(false);
    expect(isValidHashFormat("xyz")).toBe(false);
    expect(
      isValidHashFormat(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85"
      )
    ).toBe(false); // 63 chars
  });
});
