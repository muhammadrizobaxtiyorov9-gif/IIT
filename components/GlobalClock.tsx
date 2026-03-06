import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Language } from '../types';

interface GlobalClockProps {
    lang: Language;
}

export const GlobalClock: React.FC<GlobalClockProps> = ({ lang }) => {
    const [timeStr, setTimeStr] = useState<string>('--:--:--');
    const [dateStr, setDateStr] = useState<string>('');
    const [isSynced, setIsSynced] = useState<boolean>(false);

    useEffect(() => {
        let intervalId: NodeJS.Timeout;
        let serverTimeOffset = 0;

        const fetchNtpTime = async () => {
            try {
                // Fallback to simpler public API if needed, WorldTimeAPI sometimes hits rate limits
                // We'll use local time + an offset calculated from a fast API.
                const start = performance.now();
                const res = await fetch('https://worldtimeapi.org/api/timezone/Asia/Tashkent');
                if (!res.ok) throw new Error('API Error');
                const data = await res.json();

                const end = performance.now();
                const latency = (end - start) / 2;

                const serverTime = new Date(data.utc_datetime).getTime() + latency;
                const localTime = new Date().getTime();

                serverTimeOffset = serverTime - localTime;
                setIsSynced(true);
            } catch (err) {
                console.warn("WorldTimeAPI failed, falling back to local PC clock as secure substitute.", err);
                serverTimeOffset = 0; // Fallback to local
                setIsSynced(false);
            }
        };

        fetchNtpTime();

        // Sync every 5 minutes to prevent drift
        const syncInterval = setInterval(fetchNtpTime, 300000);

        const updateClock = () => {
            const now = new Date(Date.now() + serverTimeOffset);

            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');

            setTimeStr(`${hours}:${minutes}:${seconds}`);

            const options: Intl.DateTimeFormatOptions = {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            };

            const formattedDate = now.toLocaleDateString(lang === 'uz' ? 'uz-UZ' : 'ru-RU', options);
            setDateStr(formattedDate);
        };

        // Update every second immediately
        updateClock();
        intervalId = setInterval(updateClock, 1000);

        return () => {
            clearInterval(intervalId);
            clearInterval(syncInterval);
        };
    }, [lang]);

    return (
        <div className="flex flex-col items-end justify-center px-4">
            <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 ${isSynced ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span className="font-mono text-xl font-bold tracking-widest text-slate-800 dark:text-white filter drop-shadow-sm">
                    {timeStr}
                </span>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {dateStr} {isSynced ? '• GMT+5' : '• LOCAL'}
            </div>
        </div>
    );
};
