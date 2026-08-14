import { apiClient } from '../apiClient';
import { createId, getData, mutateData } from '../../data/repository';
import type { AmkaAccessAction, AmkaAccessLog } from '../../types';
import { pruneAmkaAccessLogs } from '../../utils/amkaAccess';

export async function recordAmkaAccess(input: {
  userId: string;
  userName: string;
  athleteId: string;
  athleteName: string;
  action: AmkaAccessAction;
}) {
  return apiClient(() => {
    const entry: AmkaAccessLog = {
      id: createId('amka_log'),
      at: new Date().toISOString(),
      userId: input.userId,
      userName: input.userName,
      athleteId: input.athleteId,
      athleteName: input.athleteName,
      action: input.action,
    };
    mutateData((data) => {
      const next = pruneAmkaAccessLogs([...(data.amkaAccessLogs ?? []), entry]);
      data.amkaAccessLogs = next;
    });
    return entry;
  });
}

export async function listAmkaAccessLogs() {
  return apiClient(() => pruneAmkaAccessLogs(getData().amkaAccessLogs ?? []));
}
