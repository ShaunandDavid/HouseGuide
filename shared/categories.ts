// Single source of truth for note categories
export const CATEGORY_VALUES = [
  "work_school",
  "demeanor",
  "sponsor",
  "medical",
  "chores",
  "general",
] as const;

export type Category = typeof CATEGORY_VALUES[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  work_school: "Work/School",
  demeanor: "Demeanor",
  sponsor: "Sponsor/Recovery",
  medical: "Medical",
  chores: "Chores",
  general: "General",
};

export const CATEGORY_ICON: Record<Category, string> = {
  work_school: "💼",
  demeanor: "😊",
  sponsor: "🤝",
  medical: "🏥",
  chores: "🧹",
  general: "📝",
};