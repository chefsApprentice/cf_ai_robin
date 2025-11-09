import { useRef, useEffect } from 'react';
import { UploadedImage, StatusResponse } from '../types';
import { API_BASE_URL } from '@/app/constant';

export const useStatusPolling = (onStatusUpdate: (image: UploadedImage) => void) => {
  const pollingIntervals = useRef<{ [key: string]: NodeJS.Timeout }>({});

  const pollStatus = async (instanceId: string, fileName: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/?instanceId=${instanceId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.status}`);
      }
      const data = await response.json() as StatusResponse;

      onStatusUpdate({
        fileName,
        status: data.status,
        instanceId,
        aiTags: undefined,
        aiAltText: undefined
      });

      if (data.status === 'complete') {
        await fetchWorkflowRes(instanceId, fileName);
        stopPolling(instanceId);
      } else if (data.error) {
        handleError(instanceId, fileName);
      }
    } catch (error) {
      console.error('Error polling status:', error);
      handleError(instanceId, fileName);
    }
  };

  const fetchWorkflowRes = async (instanceId: string, fileName: string) => {
    try {
      const altTextResponse = await fetch(`${API_BASE_URL}/alttext?instanceId=${instanceId}`);
      if (!altTextResponse.ok) {
        throw new Error(`Failed to fetch tags: ${altTextResponse.status}`);
      }
      const altTextData = await altTextResponse.json() as { altText: string };
      console.log('Tags response:', altTextData);
      const tagsResponse = await fetch(`${API_BASE_URL}/tags?instanceId=${instanceId}`);
      if (!tagsResponse.ok) {
        throw new Error(`Failed to fetch tags: ${tagsResponse.status}`);
      }
      const tagsData = await tagsResponse.json() as { tags: string };

      onStatusUpdate({
        fileName,
        status: 'complete',
        instanceId,
        aiTags: tagsData.tags,
        aiAltText: altTextData.altText
      });
      stopPolling(instanceId);
    } catch (error) {
      console.error('Error fetching AI tags:', error);
      handleError(instanceId, fileName);
    }
  };

  const handleError = (instanceId: string, fileName: string) => {
    onStatusUpdate({
      fileName,
      status: 'error',
      instanceId,
      aiTags: undefined
    });
    stopPolling(instanceId);
  };

  const startPolling = (instanceId: string, fileName: string) => {
    stopPolling(instanceId);
    pollingIntervals.current[instanceId] = setInterval(() => {
      pollStatus(instanceId, fileName);
    }, 3000);
  };

  const stopPolling = (instanceId: string) => {
    if (pollingIntervals.current[instanceId]) {
      clearInterval(pollingIntervals.current[instanceId]);
      delete pollingIntervals.current[instanceId];
    }
  };

  useEffect(() => {
    return () => {
      Object.values(pollingIntervals.current).forEach(interval => {
        clearInterval(interval);
      });
    };
  }, []);

  return { startPolling };
}; 
