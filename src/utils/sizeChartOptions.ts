import type { SizeChart, SizeChartCategory } from '../types';

export const SIZE_CHART_CATEGORY_LABELS: Record<SizeChartCategory, string> = {
  kids: 'ΠΑΙΔΙΚΟ',
  men: 'ΑΝΔΡΙΚΟ',
  women: 'ΓΥΝΑΙΚΕΙΟ',
};

const CATEGORIES: SizeChartCategory[] = ['kids', 'men', 'women'];

/** Flat unique sizes from μεγεθολόγιο (for filters / simple selects). */
export function flattenSizeChart(chart: SizeChart | undefined | null): string[] {
  if (!chart) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const category of CATEGORIES) {
    for (const size of chart[category] ?? []) {
      const value = size.trim();
      if (!value) continue;
      const key = value.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(value);
    }
  }
  return result;
}

/** Optgroups από Ρυθμίσεις → Μεγεθολόγιο. */
export function sizeChartOptGroups(chart: SizeChart | undefined | null) {
  if (!chart) return [];
  return CATEGORIES.map((category) => ({
    category,
    label: SIZE_CHART_CATEGORY_LABELS[category],
    sizes: (chart[category] ?? []).map((s) => s.trim()).filter(Boolean),
  })).filter((group) => group.sizes.length > 0);
}
