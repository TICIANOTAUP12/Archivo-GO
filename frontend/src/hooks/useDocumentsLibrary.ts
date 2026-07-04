import { useEffect, useMemo, useState } from 'react';
import { listDocuments } from '../api/endpoints';
import type { DocumentStatus, RecentDocument } from '../types';

export type DocumentFilter = DocumentStatus | 'all';

type UseDocumentsLibraryResult = {
  documents: RecentDocument[];
  activeFilter: DocumentFilter;
  isLoadingDocuments: boolean;
  documentsError: string | null;
  totalsByStatus: Record<DocumentStatus, number>;
  setActiveFilter: (filter: DocumentFilter) => void;
  refreshDocuments: () => Promise<void>;
};

const documentStatuses: DocumentStatus[] = ['pending', 'processing', 'indexed', 'needs_review', 'failed'];

export function useDocumentsLibrary(isBackendReady: boolean): UseDocumentsLibraryResult {
  const [allDocuments, setAllDocuments] = useState<RecentDocument[]>([]);
  const [activeFilter, setActiveFilter] = useState<DocumentFilter>('all');
  const [isLoadingDocuments, setIsLoadingDocuments] = useState<boolean>(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);

  useEffect(() => {
    if (!isBackendReady) return;
    void refreshDocuments();
  }, [isBackendReady]);

  const documents = useMemo(() => {
    if (activeFilter === 'all') return allDocuments;
    return allDocuments.filter((document) => document.status === activeFilter);
  }, [activeFilter, allDocuments]);

  const totalsByStatus = useMemo(() => {
    return documentStatuses.reduce<Record<DocumentStatus, number>>(
      (totals, status) => ({
        ...totals,
        [status]: allDocuments.filter((document) => document.status === status).length,
      }),
      {
        pending: 0,
        processing: 0,
        indexed: 0,
        needs_review: 0,
        failed: 0,
      },
    );
  }, [allDocuments]);

  async function refreshDocuments(): Promise<void> {
    setIsLoadingDocuments(true);
    setDocumentsError(null);

    try {
      const response = await listDocuments('all');
      setAllDocuments(response);
    } catch (error) {
      setAllDocuments([]);
      setDocumentsError(null);
    } finally {
      setIsLoadingDocuments(false);
    }
  }

  return {
    documents,
    activeFilter,
    isLoadingDocuments,
    documentsError,
    totalsByStatus,
    setActiveFilter,
    refreshDocuments,
  };
}
