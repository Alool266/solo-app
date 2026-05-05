export const EQUIPMENT_TAG_IDS = [
  'barbell',
  'dumbbell',
  'machine',
  'cables',
  'bodyweight',
  'home',
  'hotel',
] as const;

export type EquipmentTagId = (typeof EQUIPMENT_TAG_IDS)[number];

const VALID = new Set<string>(EQUIPMENT_TAG_IDS);

export function normalizeEquipmentTags(raw: unknown): EquipmentTagId[] {
  if (!Array.isArray(raw)) return [];
  const out: EquipmentTagId[] = [];
  for (const x of raw) {
    if (typeof x !== 'string' || !VALID.has(x)) continue;
    const id = x as EquipmentTagId;
    if (!out.includes(id)) out.push(id);
    if (out.length >= 8) break;
  }
  return out;
}
