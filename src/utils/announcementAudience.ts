import { getUsers } from '../auth/auth';
import type {
  Announcement,
  AnnouncementAudienceRole,
  AnnouncementRecipient,
} from '../types';

type AudienceAnnouncement = Pick<
  Announcement,
  'audienceRoles' | 'classIds' | 'recipientIds' | 'status'
>;

function recipientsOf(
  item: AudienceAnnouncement,
  kind: AnnouncementRecipient['kind'],
): string[] {
  return (item.recipientIds ?? []).filter((r) => r.kind === kind).map((r) => r.id);
}

function rolesOf(item: AudienceAnnouncement): AnnouncementAudienceRole[] {
  return item.audienceRoles ?? [];
}

/** Whether announcement is visible to a given athlete (portal / filtering). */
export function announcementVisibleToAthlete(
  item: AudienceAnnouncement,
  athleteId: string,
  athleteClassId?: string | null,
): boolean {
  if (item.status === 'draft') return false;
  const roles = rolesOf(item);
  const athleteRecipients = recipientsOf(item, 'athlete');
  const classIds = item.classIds ?? [];

  const roleOk = roles.length === 0 || roles.includes('athletes');
  if (!roleOk && athleteRecipients.length === 0) return false;

  if (athleteRecipients.length > 0) {
    return athleteRecipients.includes(athleteId);
  }

  if (classIds.length > 0) {
    return Boolean(athleteClassId && classIds.includes(athleteClassId));
  }

  return roleOk || roles.length === 0;
}

/** Whether announcement is visible to a coach. */
export function announcementVisibleToCoach(
  item: AudienceAnnouncement,
  coachId: string,
): boolean {
  if (item.status === 'draft') return false;
  const roles = rolesOf(item);
  const coachRecipients = recipientsOf(item, 'coach');

  if (coachRecipients.length > 0) {
    return coachRecipients.includes(coachId);
  }

  return roles.length === 0 || roles.includes('coaches');
}

/** Whether announcement is visible to a parent user. */
export function announcementVisibleToParent(
  item: AudienceAnnouncement,
  parentUserId: string,
  linkedAthleteIds: string[],
  linkedClassIds: string[],
): boolean {
  if (item.status === 'draft') return false;
  const roles = rolesOf(item);
  const parentRecipients = recipientsOf(item, 'parent');
  const athleteRecipients = recipientsOf(item, 'athlete');
  const classIds = item.classIds ?? [];

  if (parentRecipients.length > 0) {
    return parentRecipients.includes(parentUserId);
  }

  const roleOk = roles.length === 0 || roles.includes('parents') || roles.includes('athletes');
  if (!roleOk) return false;

  if (athleteRecipients.length > 0) {
    return linkedAthleteIds.some((id) => athleteRecipients.includes(id));
  }

  if (classIds.length > 0) {
    return linkedClassIds.some((id) => classIds.includes(id));
  }

  return true;
}

export function listParentRecipients(): Array<{ id: string; label: string; email: string }> {
  const users = getUsers().filter((u) => u.role === 'parent' && u.active);
  return users
    .map((u) => ({
      id: u.id,
      label: u.fullName || u.email,
      email: u.email,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'el'));
}
