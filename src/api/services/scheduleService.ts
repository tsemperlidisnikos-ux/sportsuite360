import { apiClient } from '../apiClient';
import { createId, getData, mutateData } from '../../data/repository';
import { scheduleSlotSchema, type ScheduleSlotInput } from '../../schemas';
import type { ScheduleSlot } from '../../types';

export async function getSchedule() {
  return apiClient(() => getData().schedule);
}

export async function createScheduleSlot(input: ScheduleSlotInput) {
  return apiClient(() => {
    const parsed = scheduleSlotSchema.parse(input);
    const slot: ScheduleSlot = {
      ...parsed,
      id: createId('sch'),
    };
    mutateData((data) => {
      data.schedule.push(slot);
    });
    return slot;
  });
}

export async function deleteScheduleSlot(id: string) {
  return apiClient(() => {
    mutateData((data) => {
      data.schedule = data.schedule.filter((s) => s.id !== id);
    });
    return { id };
  });
}
