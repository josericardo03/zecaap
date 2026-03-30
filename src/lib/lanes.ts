import { role_type } from "@/generated/prisma/enums";

/** Ordem fixa para UI (1 = mais preferida) */
export const LANE_OPTIONS: { value: (typeof role_type)[keyof typeof role_type]; label: string }[] = [
  { value: role_type.TOP, label: "TOP" },
  { value: role_type.JUNGLE, label: "JG" },
  { value: role_type.MID, label: "MID" },
  { value: role_type.ADC, label: "ADC" },
  { value: role_type.SUPPORT, label: "SUP" },
];

export function roleLabel(role: string): string {
  return LANE_OPTIONS.find((o) => o.value === role)?.label ?? role;
}
