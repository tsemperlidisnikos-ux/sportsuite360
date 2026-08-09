import { apiClient } from '../apiClient';
import { getData, mutateData } from '../../data/repository';
import type { SizeChart } from '../../types';

export async function getSizeChart() {
  return apiClient(() => getData().sizeChart);
}

export async function saveSizeChart(chart: SizeChart) {
  return apiClient(() => {
    mutateData((data) => {
      data.sizeChart = {
        kids: [...chart.kids],
        men: [...chart.men],
        women: [...chart.women],
      };
    });
    return getData().sizeChart;
  });
}
