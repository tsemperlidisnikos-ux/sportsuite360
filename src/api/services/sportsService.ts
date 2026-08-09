import { apiClient } from '../apiClient';
import { createId, mutateData } from '../../data/repository';
import { sportItemSchema, type SportItemInput } from '../../schemas';
import type { SportItem } from '../../types';

export async function createSport(input: SportItemInput) {
  return apiClient(() => {
    const parsed = sportItemSchema.parse(input);
    const sport: SportItem = {
      ...parsed,
      id: createId('sport'),
    };
    mutateData((data) => {
      data.sports.push(sport);
    });
    return sport;
  });
}

export async function updateSport(id: string, input: SportItemInput) {
  return apiClient(() => {
    const parsed = sportItemSchema.parse(input);
    let updated: SportItem | undefined;
    mutateData((data) => {
      const index = data.sports.findIndex((s) => s.id === id);
      if (index === -1) throw new Error('Το άθλημα δεν βρέθηκε');
      updated = { ...data.sports[index], ...parsed };
      data.sports[index] = updated;
    });
    return updated!;
  });
}

export async function deleteSport(id: string) {
  return apiClient(() => {
    mutateData((data) => {
      data.sports = data.sports.filter((s) => s.id !== id);
    });
    return { id };
  });
}
