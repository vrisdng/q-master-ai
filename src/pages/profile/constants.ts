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

export const STUDY_SET_LABEL_COLORS = [
  { name: "Ocean", value: "#2563EB" },
  { name: "Forest", value: "#16A34A" },
  { name: "Sunset", value: "#EA580C" },
  { name: "Lavender", value: "#9333EA" },
  { name: "Rose", value: "#DB2777" },
  { name: "Sky", value: "#0EA5E9" },
  { name: "Slate", value: "#64748B" },
] as const;

export const STUDY_MODES = [
  {
    id: "summary",
    label: "Summary Mode",
    description: "Generate key points, draft summaries, and get instant feedback.",
  },
  {
    id: "test",
    label: "Test Mode",
    description: "Build a mock exam with mixed question types and performance feedback.",
  },
  {
    id: "elaboration",
    label: "Elaboration Mode",
    description: "Expand core ideas with why/how prompts and instant AI coaching.",
  },
  {
    id: "self-explanation",
    label: "Self-Explanation Mode",
    description: "Practice explaining concepts in your own words to deepen understanding (coming soon).",
  },
  {
    id: "feynman",
    label: "Feynman Mode",
    description: "Teach the concept simply and identify knowledge gaps (coming soon).",
  },
] as const;

export type StudyMode = (typeof STUDY_MODES)[number]["id"];
