export function achievementColor(value: number): string {
  if (value >= 100) return "#2563eb"

  if (value >= 95) return "#16a34a"

  if (value >= 90) return "#ca8a04"

  if (value >= 80) return "#db2777"

  return "#dc2626"
}
