import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type MpesaPollStatus = 'idle' | 'polling' | 'confirmed' | 'failed' | 'timeout';

interface UseMpesaPollResult {
    mpesaReceiptNumber: string;
    pollStatus: MpesaPollStatus;
    isPollActive: boolean;
    startPolling: (checkoutRequestId: string) => void;
    stopPolling: () => void;
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120000; // 2 minutes

export function useMpesaPoll(): UseMpesaPollResult {
    const [mpesaReceiptNumber, setMpesaReceiptNumber] = useState('');
    const [pollStatus, setPollStatus] = useState<MpesaPollStatus>('idle');
    const [checkoutId, setCheckoutId] = useState('');
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);

    const cleanup = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const stopPolling = useCallback(() => {
        cleanup();
        setCheckoutId('');
    }, [cleanup]);

    const poll = useCallback(async (cid: string) => {
        try {
            const { data, error } = await supabase
                .from('mpesa_transactions' as any)
                .select('mpesa_receipt_number, status, result_code')
                .eq('checkout_request_id', cid)
                .maybeSingle();

            if (error || !data || !mountedRef.current) return;

            const row = data as any;
            if (row.status === 'completed' && row.mpesa_receipt_number) {
                setMpesaReceiptNumber(row.mpesa_receipt_number);
                setPollStatus('confirmed');
                cleanup();
            } else if (row.status === 'failed') {
                setPollStatus('failed');
                cleanup();
            }
        } catch {
            // Silently ignore transient network errors during polling
        }
    }, [cleanup]);

    const startPolling = useCallback((checkoutRequestId: string) => {
        // Reset state
        cleanup();
        setMpesaReceiptNumber('');
        setPollStatus('polling');
        setCheckoutId(checkoutRequestId);

        // Start polling interval
        intervalRef.current = setInterval(() => {
            poll(checkoutRequestId);
        }, POLL_INTERVAL_MS);

        // Set timeout
        timeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
                setPollStatus(prev => (prev === 'polling' ? 'timeout' : prev));
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            }
        }, POLL_TIMEOUT_MS);

        // Do an immediate first poll
        poll(checkoutRequestId);
    }, [cleanup, poll]);

    // Cleanup on unmount
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            cleanup();
        };
    }, [cleanup]);

    return {
        mpesaReceiptNumber,
        pollStatus,
        isPollActive: pollStatus === 'polling',
        startPolling,
        stopPolling,
    };
}
