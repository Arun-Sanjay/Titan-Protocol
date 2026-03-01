import { db, type BodyProfileRecord } from "./db";
import { validateBodyProfile } from "./schemas";

export type BodyProfileInput = Omit<BodyProfileRecord, "id" | "created_at" | "updated_at" | "createdAt">;

export async function getLatestBodyProfile(): Promise<BodyProfileRecord | null> {
  return (await db.body_profiles.orderBy("updated_at").last()) ?? null;
}

export async function upsertBodyProfile(profile: BodyProfileInput): Promise<BodyProfileRecord> {
  const now = Date.now();
  const latest = await getLatestBodyProfile();

  if (latest?.id) {
    const payload = validateBodyProfile({
      ...profile,
      updated_at: now,
      created_at: latest.created_at,
      createdAt: latest.createdAt ?? new Date(latest.created_at).toISOString(),
    }) as BodyProfileRecord;
    await db.body_profiles.put({
      ...payload,
      id: latest.id,
    });
    const updated = await db.body_profiles.get(latest.id);
    if (!updated) throw new Error("Failed to update body profile");
    return updated;
  }

  const payload = validateBodyProfile({
    ...profile,
    created_at: now,
    updated_at: now,
    createdAt: new Date().toISOString(),
  }) as BodyProfileRecord;
  const id = await db.body_profiles.add(payload);
  const created = await db.body_profiles.get(id);
  if (!created) throw new Error("Failed to create body profile");
  return created;
}
