import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseConfig, isSupabaseConfigured, resetSupabaseClientForTests } from "@/lib/supabase/client";

const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const oldKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

afterEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = oldKey;
  resetSupabaseClientForTests();
});

describe("supabase client environment handling", () => {
  it("reports unavailable storage when env vars are missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabaseConfig()).toMatchObject({ configured: false });
  });

  it("reports configured storage when env vars are present", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    expect(isSupabaseConfigured()).toBe(true);
  });
});
