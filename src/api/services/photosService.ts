import { apiClient } from '../apiClient';
import { createId, mutateData } from '../../data/repository';
import { resolveActiveClubId } from '../../data/store';
import { galleryPhotoSchema, type GalleryPhotoInput } from '../../schemas';
import type { GalleryPhoto } from '../../types';
import { localDateTimeIso } from '../../utils/dates';
import { uploadClubPhotoBlob } from './sessionService';

export async function createPhoto(input: GalleryPhotoInput) {
  return apiClient(async () => {
    const parsed = galleryPhotoSchema.parse(input);
    let imageUrl = parsed.imageUrl;
    const clubId = resolveActiveClubId();

    // Prefer cloud Blob for data-URLs so mirrors stay small.
    if (clubId && imageUrl.startsWith('data:')) {
      const contentType =
        imageUrl.slice(5, imageUrl.indexOf(';')) || 'image/jpeg';
      const uploaded = await uploadClubPhotoBlob({
        clubId,
        fileName: parsed.fileName.trim() || 'photo.jpg',
        contentType,
        dataBase64: imageUrl,
      });
      if (uploaded.success && uploaded.data?.url) {
        imageUrl = uploaded.data.url;
      }
    }

    const photo: GalleryPhoto = {
      id: createId('photo'),
      imageUrl,
      caption: parsed.caption.trim(),
      fileName: parsed.fileName.trim(),
      album: (parsed.album ?? '').trim(),
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
