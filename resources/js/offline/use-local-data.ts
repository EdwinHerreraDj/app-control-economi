import { useEffect, useState } from 'react';
import { loadLocalData, useSyncState } from '@/offline/sync';
import type { OfflineSnapshot, PendingOperation } from '@/offline/types';

/** Datos guardados en el dispositivo; se recargan con cada cambio. */
export function useLocalData(userId: number | null): {
    loading: boolean;
    snapshot: OfflineSnapshot | null;
    operations: PendingOperation[];
} {
    const { revision } = useSyncState();
    const [data, setData] = useState<{
        loading: boolean;
        snapshot: OfflineSnapshot | null;
        operations: PendingOperation[];
    }>({ loading: true, snapshot: null, operations: [] });

    useEffect(() => {
        let active = true;

        if (userId === null) {
            setData({ loading: false, snapshot: null, operations: [] });

            return;
        }

        loadLocalData(userId)
            .then((loaded) => {
                if (active) {
                    setData({ loading: false, ...loaded });
                }
            })
            .catch(() => {
                if (active) {
                    setData({ loading: false, snapshot: null, operations: [] });
                }
            });

        return () => {
            active = false;
        };
    }, [userId, revision]);

    return data;
}
