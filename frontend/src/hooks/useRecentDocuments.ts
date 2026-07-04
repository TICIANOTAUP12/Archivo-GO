import { useEffect, useState } from 'react';
import { listRecentDocuments } from '../api/endpoints';
import type { RecentDocument } from '../types';

type UseRecentDocumentsResult = {
  recentDocuments: RecentDocument[];
  isRefreshing: boolean;
  refreshError: string | null;
  refreshRecentDocuments: () => Promise<void>;
};

export function useRecentDocuments(): UseRecentDocumentsResult {
  const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  async function refreshRecentDocuments(): Promise<void> {
    setIsRefreshing(true);
    setRefreshError(null);

    try {
      const response = await listRecentDocuments();
      setRecentDocuments(response);
    } catch (error) {
      setRecentDocuments([]);
      setRefreshError(error instanceof Error ? error.message : 'No pudimos cargar los documentos recientes.');
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void refreshRecentDocuments();
  }, []);

  return { recentDocuments, isRefreshing, refreshError, refreshRecentDocuments };
}
