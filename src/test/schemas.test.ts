/**
 * test/schemas.test.ts — Test Zod schemas
 * Ref: CC-41
 */

import { describe, it, expect } from "vitest";
import {
  caseSchema,
  evidenceItemSchema,
  collectionSchema,
  acquisitionSchema,
  custodyTransferSchema,
} from "../lib/schemas";

describe("caseSchema", () => {
  it("accepts valid case", () => {
    const result = caseSchema.safeParse({
      title: "Kasus Tes",
      authorization: "SUR-2024/001",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = caseSchema.safeParse({
      title: "",
      authorization: "SUR-2024/001",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty authorization", () => {
    const result = caseSchema.safeParse({
      title: "Kasus Tes",
      authorization: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("evidenceItemSchema", () => {
  it("accepts valid evidence item", () => {
    const result = evidenceItemSchema.safeParse({
      caseNo: "CASE-20240101-001",
      label: "Laptop Dell",
      sourceCategory: "computer",
      powerState: "off",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty label", () => {
    const result = evidenceItemSchema.safeParse({
      caseNo: "CASE-20240101-001",
      label: "",
      sourceCategory: "computer",
      powerState: "off",
    });
    expect(result.success).toBe(false);
  });
});

describe("collectionSchema", () => {
  it("accepts valid collection", () => {
    const result = collectionSchema.safeParse({
      itemNo: "EV-20240101-001",
      at: "2024-01-01T10:00:00.000Z",
      collector: "Budi",
      witnesses: ["Andi"],
      packaging: "Kantong antistatis",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty witnesses", () => {
    const result = collectionSchema.safeParse({
      itemNo: "EV-20240101-001",
      at: "2024-01-01T10:00:00.000Z",
      collector: "Budi",
      witnesses: [],
      packaging: "Kantong antistatis",
    });
    expect(result.success).toBe(false);
  });
});

describe("acquisitionSchema", () => {
  it("accepts valid bit-stream acquisition", () => {
    const result = acquisitionSchema.safeParse({
      itemNo: "EV-20240101-001",
      at: "2024-01-01T10:00:00.000Z",
      method: "bit-stream",
      tool: "FTK Imager",
      toolVersion: "4.7.1",
      sourceHash: "a".repeat(64),
      imageHash: "b".repeat(64),
    });
    expect(result.success).toBe(true);
  });

  it("rejects live acquisition without justification", () => {
    const result = acquisitionSchema.safeParse({
      itemNo: "EV-20240101-001",
      at: "2024-01-01T10:00:00.000Z",
      method: "live",
      tool: "Belkaim",
      toolVersion: "1.0",
      sourceHash: "a".repeat(64),
      imageHash: "b".repeat(64),
    });
    expect(result.success).toBe(false);
  });

  it("accepts live acquisition with justification", () => {
    const result = acquisitionSchema.safeParse({
      itemNo: "EV-20240101-001",
      at: "2024-01-01T10:00:00.000Z",
      method: "live",
      tool: "Belkaim",
      toolVersion: "1.0",
      sourceHash: "a".repeat(64),
      imageHash: "b".repeat(64),
      justification: "RAM harus diamankan sebelum shutdown",
    });
    expect(result.success).toBe(true);
  });
});

describe("custodyTransferSchema", () => {
  it("accepts valid transfer", () => {
    const result = custodyTransferSchema.safeParse({
      itemNo: "EV-20240101-001",
      at: "2024-01-01T10:00:00.000Z",
      from: "Budi",
      to: "Andi",
      reason: "Transfer ke lab analisis",
    });
    expect(result.success).toBe(true);
  });

  it("rejects same sender and receiver", () => {
    const result = custodyTransferSchema.safeParse({
      itemNo: "EV-20240101-001",
      at: "2024-01-01T10:00:00.000Z",
      from: "Budi",
      to: "Budi",
      reason: "Transfer ke lab analisis",
    });
    expect(result.success).toBe(false);
  });
});
