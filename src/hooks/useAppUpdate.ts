/**
 * src/hooks/useAppUpdate.ts
 *
 * Custom React hook for handling APK Auto-Updates seamlessly across the app.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { updateService, UpdateCheckResult } from '@/services/update/updateService';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'verifying'
  | 'ready'
  | 'error';

export interface UseAppUpdateReturn {
  status: UpdateStatus;
  updateInfo: UpdateCheckResult | null;
  downloadProgress: number; // 0 to 1
  writtenBytes: number;
  totalBytes: number;
  isMandatory: boolean;
  errorMessage: string | null;
  checkForUpdates: (force?: boolean) => Promise<void>;
  startUpdate: () => Promise<void>;
  dismissUpdate: () => void;
  isDismissed: boolean;
}

export function useAppUpdate(): UseAppUpdateReturn {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [writtenBytes, setWrittenBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const checkForUpdates = useCallback(async (force = false) => {
    try {
      setStatus('checking');
      setErrorMessage(null);
      const res = await updateService.checkForUpdates(force);

      if (!isMountedRef.current) return;

      if (res && res.hasUpdate) {
        setUpdateInfo(res);
        setStatus('available');
      } else {
        setStatus('idle');
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setStatus('idle');
      setErrorMessage(err?.message || 'Failed to check for updates');
    }
  }, []);

  // Initial check on mount after short deferral
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  const startUpdate = useCallback(async () => {
    if (!updateInfo) return;

    try {
      setStatus('downloading');
      setDownloadProgress(0);
      setErrorMessage(null);

      const success = await updateService.downloadAndInstall(
        updateInfo,
        (progress, written, total) => {
          if (!isMountedRef.current) return;
          setDownloadProgress(progress);
          setWrittenBytes(written);
          setTotalBytes(total);
        }
      );

      if (!isMountedRef.current) return;

      if (success) {
        setStatus('ready');
      } else {
        setStatus('available');
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setStatus('error');
      setErrorMessage(err?.message || 'Failed to install update');
    }
  }, [updateInfo]);

  const dismissUpdate = useCallback(() => {
    if (updateInfo?.mandatory) return; // Cannot dismiss mandatory updates
    setIsDismissed(true);
  }, [updateInfo]);

  return {
    status,
    updateInfo,
    downloadProgress,
    writtenBytes,
    totalBytes,
    isMandatory: Boolean(updateInfo?.mandatory),
    errorMessage,
    checkForUpdates,
    startUpdate,
    dismissUpdate,
    isDismissed,
  };
}
