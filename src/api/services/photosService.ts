import { apiClient } from '../apiClient';
import { createId, mutateData } from '../../data/repository';
import { galleryPhotoSchema, type GalleryPhotoInput } from '../../schemas';
import type { GalleryPhoto } from '../../types';
import { localDateTimeIso } from '../../utils/dates';

export async function createPhoto(input: GalleryPhotoInput) {
  return apiClient(() => {
    const parsed = galleryPhotoSchema.parse(input);
    const photo: GalleryPhoto = {
      id: createId('photo'),
      imageUrl: parsed.imageUrl,
      caption: parsed.caption.trim(),
      fileName: parsed.fileName.trim(),
      createdAt: localDateTimeIso(),
    };
    mutateData((data) => {
      if (!data.photos) data.photos = [];
      data.photos.unshift(photo);
    });
    return photo;
  });
}

export async function deletePhoto(id: string) {
  return apiClient(() => {
    mutateData((data) => {
      data.photos = (data.photos ?? []).filter((item) => item.id !== id);
    });
    return { id };
  });
}
