import { beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ OS: "ios" }));
const secure = vi.hoisted(() => ({ getItemAsync: vi.fn(), setItemAsync: vi.fn() }));

vi.mock("react-native", () => ({ Platform: platform }));
vi.mock("expo-secure-store", () => secure);

import { readPreference, writePreference } from "./preference";

function stubLocalStorage(overrides: Partial<Storage> = {}) {
  const data = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    ...overrides,
  };
  vi.stubGlobal("window", { localStorage });
  return data;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("on a phone", () => {
  beforeEach(() => {
    platform.OS = "ios";
  });

  it("reads and writes through SecureStore", async () => {
    secure.getItemAsync.mockResolvedValue("abc");
    expect(await readPreference("key")).toBe("abc");
    await writePreference("key", "def");
    expect(secure.setItemAsync).toHaveBeenCalledWith("key", "def");
  });

  it("swallows a keychain failure", async () => {
    secure.getItemAsync.mockRejectedValue(new Error("locked"));
    secure.setItemAsync.mockRejectedValue(new Error("locked"));
    expect(await readPreference("key")).toBeNull();
    await expect(writePreference("key", "def")).resolves.toBeUndefined();
  });
});

describe("on the web", () => {
  beforeEach(() => {
    platform.OS = "web";
  });

  it("round-trips through localStorage and never touches SecureStore", async () => {
    stubLocalStorage();
    expect(await readPreference("key")).toBeNull();
    await writePreference("key", "def");
    expect(await readPreference("key")).toBe("def");
    expect(secure.getItemAsync).not.toHaveBeenCalled();
    expect(secure.setItemAsync).not.toHaveBeenCalled();
  });

  it("swallows a blocked localStorage", async () => {
    const blocked = () => {
      throw new Error("blocked");
    };
    stubLocalStorage({ getItem: blocked, setItem: blocked });
    expect(await readPreference("key")).toBeNull();
    await expect(writePreference("key", "def")).resolves.toBeUndefined();
  });
});
