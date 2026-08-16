import type { Student } from '../types';
import { sportsMatch } from './coachScope';

export type StudentSportRef = Pick<Student, 'sport' | 'sports'>;

/** Όλα τα αθλήματα του αθλητή (χωρίς διπλότυπα). */
export function studentSports(student: StudentSportRef): string[] {
  const values = [
    ...(student.sports ?? []),
    ...(student.sport?.trim() ? [student.sport.trim()] : []),
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(value);
  }
  return unique;
}

export function studentHasSport(
  student: StudentSportRef,
  sport: string | null | undefined,
): boolean {
  if (!sport?.trim()) return false;
  return studentSports(student).some((s) => sportsMatch(s, sport));
}

export function normalizeStudentSports(
  sports: string[] | undefined | null,
  sport?: string | null,
): { sport: string; sports: string[] } {
  const list = studentSports({
    sports: sports ?? [],
    sport: sport ?? '',
  });
  const primary =
    sport?.trim() && list.some((s) => sportsMatch(s, sport))
      ? list.find((s) => sportsMatch(s, sport))!
      : list[0] ?? '';
  return { sport: primary, sports: list };
}
