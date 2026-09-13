/**
 * lib/hash.ts — SHA-256 streaming dengan self-test FIPS/NIST
 * Ref: CC-24, FEATURE.md §4.7, DATA.md §7
 *
 * Mesin hash ini SAKRAL. Perubahan wajib:
 * 1. Lulus self-test vektor resmi saat startup
 * 2. Menyebut alasan di commit message
 * 3. Tidak mengubah format output
 */

const ALGORITHM = "SHA-256";

// ─── Vektor Self-Test FIPS/NIST ──────────────────────────────────────
// Ref: CC-24 — hash wajib self-test saat startup
const FIPS_TEST_VECTORS = [
  {
    input: "",
    expected: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    description: "SHA-256 of empty string",
  },
  {
    input: "abc",
    expected: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    description: "SHA-256 of 'abc' (NIST FIPS 180-2)",
  },
  {
    input: "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
    expected: "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    description: "SHA-256 of 448-bit message (NIST FIPS 180-2)",
  },
];

// ─── State ───────────────────────────────────────────────────────────
let selfTestPassed = false;
let selfTestError: string | null = null;

// ─── Core API ────────────────────────────────────────────────────────

/**
 * Hitung SHA-256 dari string, kembalikan hex lowercase.
 * Ref: DATA.md §7 — format: SHA-256:<hex64>
 */
export async function compute(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest(ALGORITHM, encoder.encode(data));
  return bufferToHex(buffer);
}

/**
 * Hitung SHA-256 dari ArrayBuffer (untuk file/image).
 */
export async function computeBuffer(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(ALGORITHM, buffer);
  return bufferToHex(hashBuffer);
}

/**
 * Bentuk hash entry untuk audit chain.
 * Ref: DATA.md §7 — entryHash = SHA-256(payload|prevHash)
 */
export async function entryHash(entry: {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
  prevHash: string;
}): Promise<string> {
  const payload = [
    entry.id,
    entry.at,
    entry.actor,
    entry.action,
    entry.target,
    entry.detail,
    entry.prevHash,
  ].join("|");
  return compute(payload);
}

/**
 * Verifikasi hash sumber vs image.
 * Ref: FEATURE.md §4.6 — hash sumber ≠ hash image: simpan apa adanya
 */
export function verifyHash(
  sourceHash: string,
  imageHash: string
): { match: boolean; warning?: string } {
  if (!sourceHash && !imageHash) {
    return { match: false, warning: "Kedua hash kosong" };
  }
  if (!sourceHash) {
    return { match: false, warning: "Hash sumber tidak ada" };
  }
  if (!imageHash) {
    return { match: false, warning: "Hash image tidak ada" };
  }
  if (sourceHash === imageHash) {
    return { match: true };
  }
  // Hash berbeda — ini valid untuk live acquisition
  return {
    match: false,
    warning:
      "Hash sumber dan image berbeda. Ini normal untuk live acquisition karena original berubah.",
  };
}

// ─── Self-Test ───────────────────────────────────────────────────────

/**
 * Jalankan self-test vektor FIPS/NIST.
 * Harus dipanggil sekali saat aplikasi dimulai.
 * Ref: CC-24 — self-test wajib, hasil terlihat di UI
 */
export async function selfTest(): Promise<{
  passed: boolean;
  results: Array<{ description: string; passed: boolean }>;
  error?: string;
}> {
  const results: Array<{ description: string; passed: boolean }> = [];

  for (const vector of FIPS_TEST_VECTORS) {
    const hash = await compute(vector.input);
    const passed = hash === vector.expected;
    results.push({ description: vector.description, passed });
  }

  selfTestPassed = results.every((r) => r.passed);
  if (!selfTestPassed) {
    selfTestError = "Self-test SHA-256 gagal — salah satu vektor FIPS/NIST tidak cocok";
  }

  return {
    passed: selfTestPassed,
    results,
    error: selfTestError ?? undefined,
  };
}

/**
 * Status self-test untuk UI.
 */
export function getSelfTestStatus(): {
  passed: boolean;
  error?: string;
} {
  return {
    passed: selfTestPassed,
    error: selfTestError ?? undefined,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Validasi format hash.
 */
export function isValidHashFormat(hash: string): boolean {
  return /^[a-f0-9]{64}$/.test(hash);
}

/**
 * Format hash untuk tampilan (tambah prefix).
 */
export function formatHash(hash: string): string {
  return `SHA-256:${hash}`;
}
