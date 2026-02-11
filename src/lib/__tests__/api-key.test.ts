import {
  generateApiKeyValue,
  getApiKeyLast4,
  hashApiKey,
  isLikelyApiKey,
} from "@/lib/api/api-key";

describe("api-key", () => {
  it("generates a high-entropy evk_ key", () => {
    const key = generateApiKeyValue();
    expect(key.startsWith("evk_")).toBe(true);
    expect(isLikelyApiKey(key)).toBe(true);
    expect(getApiKeyLast4(key)).toBe(key.slice(-4));
  });

  it("hashes keys with sha256 hex", () => {
    const h1 = hashApiKey("evk_test_key");
    const h2 = hashApiKey("evk_test_key");
    const h3 = hashApiKey("evk_other_key");
    expect(h1).toHaveLength(64);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });
});

