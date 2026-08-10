import { apiClient } from '../apiClient';
import { createId, mutateData } from '../../data/repository';
import { warehouseProductSchema, type WarehouseProductInput } from '../../schemas';
import type { WarehouseProduct } from '../../types';
import { localDateTimeIso } from '../../utils/dates';

export async function createProduct(input: WarehouseProductInput) {
  return apiClient(() => {
    const parsed = warehouseProductSchema.parse(input);
    const product: WarehouseProduct = {
      ...parsed,
      id: createId('product'),
      createdAt: localDateTimeIso(),
    };
    mutateData((data) => {
      if (!data.products) data.products = [];
      data.products.push(product);
    });
    return product;
  });
}

export async function updateProduct(id: string, input: WarehouseProductInput) {
  return apiClient(() => {
    const parsed = warehouseProductSchema.parse(input);
    let updated: WarehouseProduct | undefined;
    mutateData((data) => {
      if (!data.products) data.products = [];
      const index = data.products.findIndex((p) => p.id === id);
      if (index === -1) throw new Error('Το προϊόν δεν βρέθηκε');
      updated = { ...data.products[index], ...parsed };
      data.products[index] = updated;
    });
    return updated!;
  });
}

export async function deleteProduct(id: string) {
  return apiClient(() => {
    mutateData((data) => {
      data.products = (data.products ?? []).filter((p) => p.id !== id);
    });
    return { id };
  });
}
