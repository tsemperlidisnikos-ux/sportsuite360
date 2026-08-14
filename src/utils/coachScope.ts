import type { AcademyClass, Coach, Student } from '../types';
import { normalizeSportKey } from './sport';

type SessionLike = {
  role?: string | null;
  coachId?: string | null;
} | null;

export function resolveCoachRecord(
  coaches: Coach[] | undefined,
  coachId: string | null | undefined,
): Coach | null {
  if (!coachId) return null;
  return (coaches ?? []).find((c) => c.id === coachId && c.active) ?? null;
}

/** Τμήματα ορατά στον προπονητή: ίδιο άθλημα με το προφίλ προπονητή. */
export function visibleClassesForSession(
  classes: AcademyClass[] | undefined,
  coaches: Coach[] | undefined,
  session: SessionLike,
): AcademyClass[] {
  const list = classes ?? [];
  if (session?.role !== 'coach') return list;
  const coach = resolveCoachRecord(coaches, session.coachId);
  if (!coach) return [];
  const sportKey = normalizeSportKey(coach.sport);
  if (!sportKey) return [];
  return list.filter((c) => normalizeSportKey(c.sport) === sportKey);
}

export function classIdsOf(classes: AcademyClass[]): Set<string> {
  return new Set(classes.map((c) => c.id));
}

export function visibleStudentsForSession(
  students: Student[] | undefined,
  allowedClassIds: Set<string>,
  session: SessionLike,
): Student[] {
  const list = students ?? [];
  if (session?.role !== 'coach') return list;
  return list.filter((s) => Boolean(s.classId && allowedClassIds.has(s.classId)));
}

export function isClassInCoachScope(
  classId: string | null | undefined,
  allowedClassIds: Set<string>,
  isCoach: boolean,
): boolean {
  if (!isCoach) return true;
  if (!classId) return false;
  return allowedClassIds.has(classId);
}

export function sportsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ka = normalizeSportKey(a);
  const kb = normalizeSportKey(b);
  return Boolean(ka && kb && ka === kb);
}
