export const AVATAR_COLORS = [
  { name: "Ocean", value: "#2563EB" },
  { name: "Forest", value: "#16A34A" },
  { name: "Sunset", value: "#EA580C" },
  { name: "Lavender", value: "#9333EA" },
  { name: "Rose", value: "#DB2777" },
  { name: "Sky", value: "#0EA5E9" },
] as const;

export const AVATAR_COLOR_VALUES = AVATAR_COLORS.map((option) => `color:${option.value}`);
export const AVATAR_COLOR_VALUE_SET = new Set(AVATAR_COLOR_VALUES);
export const DEFAULT_AVATAR = `color:${AVATAR_COLORS[0].value}`;

export const FOLDER_NAME_REGEX = /^[A-Za-z0-9 _-]+$/;
