// Shared helpers for showing risk consistently everywhere

export const LEVELS = {
  low: { label: "Low risk", color: "#0F8A7E", soft: "bg-calm-soft text-calm", ring: "ring-calm/30" },
  moderate: { label: "Moderate risk", color: "#D98A1C", soft: "bg-warn-soft text-warn", ring: "ring-warn/30" },
  high: { label: "Elevated risk", color: "#E5484D", soft: "bg-pulse-soft text-pulse", ring: "ring-pulse/30" },
};

export const pct = (p, digits = 1) => `${(p * 100).toFixed(p < 0.01 ? 1 : digits)}%`;

// "About 12 in 100" — easier to understand than a percentage
export const inHundred = (p) => {
  const n = p * 100;
  if (n < 1) return `fewer than 1 in 100`;
  return `about ${Math.round(n)} in 100`;
};

export const DEFAULT_FORM = {
  age: 45,
  gender: "Female",
  ever_married: "Yes",
  Residence_type: "Urban",
  work_type: "Private",
  hypertension: 0,
  heart_disease: 0,
  avg_glucose_level: 100,
  bmi: 24,
  smoking_status: "never smoked",
};

export const glucoseBand = (g) =>
  g < 100 ? { label: "Normal", cls: "text-calm" } : g < 126 ? { label: "Prediabetic range", cls: "text-warn" } : { label: "Diabetic range", cls: "text-pulse" };

export const bmiBand = (b) =>
  b == null ? null : b < 18.5 ? { label: "Underweight", cls: "text-warn" } : b < 25 ? { label: "Healthy", cls: "text-calm" } : b < 30 ? { label: "Overweight", cls: "text-warn" } : { label: "Obese", cls: "text-pulse" };

const RESULT_KEY = "nc_last_result";
export const saveLastResult = (r) => sessionStorage.setItem(RESULT_KEY, JSON.stringify(r));
export const loadLastResult = () => {
  try {
    return JSON.parse(sessionStorage.getItem(RESULT_KEY));
  } catch {
    return null;
  }
};
