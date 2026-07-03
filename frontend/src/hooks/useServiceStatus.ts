import { useEffect, useState } from 'react';
import { getNativeServiceStatus, type ServiceStatus } from '../api/native';

type UseServiceStatusResult = {
  serviceStatus: ServiceStatus | null;
  isCheckingStatus: boolean;
  refreshServiceStatus: () => Promise<void>;
};

export function useServiceStatus(): UseServiceStatusResult {
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);

  useEffect(() => {
    void refreshServiceStatus();
  }, []);

  async function refreshServiceStatus(): Promise<void> {
    setIsCheckingStatus(true);

    try {
      const status = await getNativeServiceStatus();
      setServiceStatus(status);
    } finally {
      setIsCheckingStatus(false);
    }
  }

  return { serviceStatus, isCheckingStatus, refreshServiceStatus };
}
