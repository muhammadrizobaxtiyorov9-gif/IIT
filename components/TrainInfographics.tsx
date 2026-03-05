import React, { useMemo, useState } from 'react';
import { Wagon, Station, Language } from '../types';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    AreaChart, Area, Legend, PieChart, Pie, Cell, LabelList
} from 'recharts';
import {
    TrainFront, MapPin, Activity, ArrowRight, TrendingUp, Info, CheckCircle2,
    CalendarDays, BarChart3, PieChart as PieIcon, Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { normalizeMgspName } from '../utils/stationUtils';

interface TrainInfographicsProps {
    wagons: Wagon[];
    stations: Station[];
    lang: Language;
    dateRange?: any;
    onDateRangeChange?: (range: any) => void;
}

const PALETTE = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#eab308',
    '#10b981', '#0ea5e9', '#f43f5e', '#a855f7', '#14b8a6',
    '#3b82f6', '#84cc16', '#06b6d4', '#ef4444', '#cbd5e1'
];

type ViewMode = 'current' | 'dynamics';
type PeriodType = 'day' | 'month';

interface StikRecord {
    idx: string;
    fromCode: string;
    toCode: string;
    mgsp: string;
    reportDate: string; // The injected 18:00 strict reporting date
    wagons: number;
    destName: string;
}

const resolveStation = (code: string, stations: Station[]): string => {
    if (!code) return code;
    const prefix = code.substring(0, 4);
    const found = stations.find(s => s.fullCode?.startsWith(prefix) || s.id?.startsWith(prefix));
    return found ? found.name : code;
};

// Extracted the custom Label outside so Recharts doesn't get confused
const CustomBarLabel = (props: any) => {
    const { x, y, width, value } = props;
    if (!value || value === 0) return null;
    return (
        <text
            x={x + width / 2}
            y={y - 12}
            fill="#475569"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="14"
            fontWeight="900"
        >
            {value}
        </text>
    );
};

const TrainInfographics: React.FC<TrainInfographicsProps> = ({ wagons, stations, lang, dateRange, onDateRangeChange }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('current');
    const [selectedMgsp, setSelectedMgsp] = useState<string | null>(null);
    const [period, setPeriod] = useState<PeriodType>('day');
    const [search, setSearch] = useState('');

    // ── Build Stiks using Strictly Database Dates (reportDate) ──
    const stikList = useMemo((): StikRecord[] => {
        const map = new Map<string, StikRecord>();
        wagons.forEach(w => {
            const key = (w.trainIndex || '').trim();
            if (!key) return;

            // Strict use of the injected report date. If missing somehow, stringify arrival
            const defaultDateStr = w.arrivalDate ? w.arrivalDate.toISOString().slice(0, 10) : 'unknown';
            const rDate = w.reportDate || defaultDateStr;

            // Strict use of trainIndex only, so counts perfectly match the global dataset.
            const uniqueKey = key;

            if (map.has(uniqueKey)) {
                const ex = map.get(uniqueKey)!;
                ex.wagons++;
                return;
            }

            let searchArea = key;
            const parenMatch = key.match(/\((.*?)\)/);
            if (parenMatch) searchArea = parenMatch[1];

            let toCode = '';
            const parts = searchArea.match(/\d{4,5}/g);
            if (parts && parts.length > 1) {
                toCode = parts[parts.length - 1];
            }

            let rawMgsp = normalizeMgspName(w.entryPoint, key);
            let mgsp = rawMgsp === 'ПРОЧИЕ' ? 'Неизвестно' : rawMgsp;

            let destName = toCode ? resolveStation(toCode, stations) : '';
            if (!destName || destName === toCode) destName = w.matchedStation?.name || w.destinationStation || '';
            if (!destName) destName = (lang === 'uz' ? 'Nomaʼlum st.' : 'Неизвестная ст.');

            map.set(uniqueKey, { idx: key, fromCode: '', toCode, mgsp, destName, reportDate: rDate, wagons: 1 });
        });
        return Array.from(map.values());
    }, [wagons, stations, lang]);

    // ── MGSP Panel ──
    const mgspList = useMemo(() => {
        const cnt = new Map<string, number>();
        stikList.forEach(s => cnt.set(s.mgsp, (cnt.get(s.mgsp) || 0) + 1));
        return Array.from(cnt.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, count }));
    }, [stikList]);

    const effectiveMgsp = selectedMgsp ?? mgspList[0]?.name ?? null;
    const mgspStiks = useMemo(() => stikList.filter(s => s.mgsp === effectiveMgsp), [stikList, effectiveMgsp]);

    // ── CURRENT VIEW (Joriy Holat) LOGIC ──
    const currentViewData = useMemo(() => {
        const c = new Map<string, number>();
        mgspStiks.forEach(s => c.set(s.destName, (c.get(s.destName) || 0) + 1));
        const arr = Array.from(c.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
        return arr;
    }, [mgspStiks]);

    // ── DYNAMICS VIEW (Taqqoslash) LOGIC ──
    const dynamicsUniqueDests = useMemo(() => {
        const c = new Set<string>();
        mgspStiks.forEach(s => c.add(s.destName));
        return Array.from(c);
    }, [mgspStiks]);

    const dynamicsData = useMemo(() => {
        if (!mgspStiks.length) return [];

        // Build continuous timeline array bridging min and max purely from string bounds!
        let allDates = mgspStiks.map(s => s.reportDate).filter(d => d !== 'unknown').sort();
        if (allDates.length === 0) return [];

        let startStr = allDates[0];
        let endStr = allDates[allDates.length - 1];

        // Format rules based on period requested
        const formatStr = (dStr: string, p: PeriodType) => p === 'day' ? dStr : dStr.substring(0, 7);

        const tm = new Map<string, Record<string, number>>();

        // If 'day', build every single day
        if (period === 'day') {
            let curr = new Date(startStr + 'T12:00:00Z');
            const end = new Date(endStr + 'T12:00:00Z');
            // padding if only one day to show a dynamic peak
            if (curr.getTime() === end.getTime()) {
                curr.setDate(curr.getDate() - 1);
                end.setDate(end.getDate() + 1);
            }
            while (curr <= end) {
                const k = curr.toISOString().slice(0, 10);
                if (!tm.has(k)) tm.set(k, {});
                curr.setDate(curr.getDate() + 1);
            }
        } else {
            // If 'month', build every month
            let [y1, m1] = startStr.substring(0, 7).split('-').map(Number);
            let [y2, m2] = endStr.substring(0, 7).split('-').map(Number);

            // pad if single month
            if (y1 === y2 && m1 === m2) {
                m1--; if (m1 < 1) { m1 = 12; y1--; }
                m2++; if (m2 > 12) { m2 = 1; y2++; }
            }

            let cy = y1; let cm = m1;
            while (cy < y2 || (cy === y2 && cm <= m2)) {
                const k = `${cy}-${cm.toString().padStart(2, '0')}`;
                if (!tm.has(k)) tm.set(k, {});
                cm++;
                if (cm > 12) { cm = 1; cy++; }
            }
        }

        mgspStiks.forEach(s => {
            if (s.reportDate === 'unknown') return;
            const k = formatStr(s.reportDate, period);
            const e = tm.get(k) || {};
            e[s.destName] = (e[s.destName] || 0) + 1; // Count STICKS not wagons
            tm.set(k, e);
        });

        return Array.from(tm.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, vals]) => {
            // Fill missing destinations with 0 for Area graphs so color smoothly floors out
            const obj: any = { key, ...vals };
            dynamicsUniqueDests.forEach(d => {
                if (obj[d] === undefined) obj[d] = 0;
            });
            // Human readable label
            if (period === 'day') {
                const [y, m, d] = key.split('-');
                obj.label = `${d}.${m}.${y}`;
            } else {
                const [y, m] = key.split('-');
                const uzMonths = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
                const ruMonths = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
                obj.label = `${lang === 'uz' ? uzMonths[parseInt(m) - 1] : ruMonths[parseInt(m) - 1]} ${y}`;
            }
            return obj;
        });
    }, [mgspStiks, period, dynamicsUniqueDests, lang]);

    const filteredMgsp = search.trim() ? mgspList.filter(m => m.name.toLowerCase().includes(search.toLowerCase())) : mgspList;

    if (!wagons.length) return <div className="p-20 flex flex-col items-center justify-center text-slate-400 font-bold"><Layers className="w-16 h-16 opacity-20 mb-4" />{lang === 'uz' ? 'Ma\'lumot yo\'q' : 'Нет данных'}</div>;

    // ── Shared Tooltip ──
    const CustomSharedTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        // Total sum
        const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);

        return (
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.15)] border border-slate-100 p-5 min-w-[260px] relative z-50">
                <p className="font-black text-slate-800 text-lg mb-4 pb-3 border-b border-slate-100 flex items-center justify-between">
                    <span>{label}</span>
                    <span className="text-xs bg-slate-100 px-2.5 py-1 rounded-lg text-slate-500">{total} {lang === 'uz' ? 'poezd' : 'шт'}</span>
                </p>
                <div className="space-y-3">
                    {[...payload].sort((a, b) => b.value - a.value).filter(p => viewMode === 'current' || p.value > 0).map((p: any, i: number) => (
                        <div key={i} className="flex justify-between items-center group">
                            <div className="flex items-center gap-3">
                                <span className="w-3 h-3 rounded-full flex-shrink-0 shadow-inner" style={{ backgroundColor: p.fill || p.color }} />
                                <span className="font-bold text-slate-600 truncate max-w-[160px] cursor-default" title={p.name}>{p.name}</span>
                            </div>
                            <span className="font-black text-slate-900 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">{p.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col xl:flex-row gap-6">
            {/* ══ LEFT SIDEBAR (Ultra Modern) ══ */}
            <div className="w-full xl:w-[320px] flex-shrink-0 flex flex-col gap-6">
                <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 rounded-[2rem] p-7 shadow-2xl shadow-indigo-500/30 text-white relative overflow-hidden group">
                    <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
                    <div className="absolute right-4 bottom-4 w-24 h-24 bg-indigo-500/30 rounded-full blur-2xl"></div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-indigo-200 mb-4 bg-indigo-900/40 w-max px-3 py-1.5 rounded-xl border border-indigo-400/20 backdrop-blur-md">
                            <Layers className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">{lang === 'uz' ? 'Jami Tizimda' : 'Всего в системе'}</span>
                        </div>
                        <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-6xl font-black tracking-tight">{stikList.length}</span>
                            <span className="text-indigo-300 font-bold">{lang === 'uz' ? 'poezd' : 'шт'}</span>
                        </div>
                        <p className="text-indigo-200 text-xs font-bold leading-relaxed opacity-80">
                            {lang === 'uz' ? 'Tanlangan muddat bo\'yicha barcha "Отчет" sanalaridagi jami stiklar.' : 'Все стики во всем диапазоне дат выгрузки.'}
                        </p>
                    </div>
                </div>

                <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-xl shadow-slate-200/50 flex flex-col flex-1 h-[600px] overflow-hidden">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <h3 className="font-black text-slate-800 flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-indigo-500" />
                            {lang === 'uz' ? 'MGSP Kirish' : 'Точки Входа'}
                        </h3>
                        <div className="bg-indigo-100 text-indigo-700 w-7 h-7 flex items-center justify-center rounded-full font-black text-xs">
                            {mgspList.length}
                        </div>
                    </div>
                    <div className="p-4 border-b border-slate-100">
                        <input
                            value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full bg-slate-100 border-none px-5 py-3 rounded-2xl text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder={lang === 'uz' ? 'Izlash...' : 'Поиск...'}
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {filteredMgsp.map((m, i) => {
                            const act = m.name === effectiveMgsp;
                            return (
                                <button key={m.name} onClick={() => setSelectedMgsp(m.name)}
                                    className={`group relative w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-300 overflow-hidden
                                        ${act ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-[1.02] border-transparent'
                                            : m.name === 'Неизвестно' ? 'bg-rose-50 border border-rose-100 text-rose-700 hover:bg-rose-100'
                                                : 'bg-white border border-slate-100 hover:border-slate-300 hover:shadow-md text-slate-700 hover:bg-slate-50'}`}>
                                    {act && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 translate-x-[-100%] group-hover:animate-shimmer"></div>}
                                    <div className="flex items-center gap-3 relative z-10">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-colors ${act ? 'bg-white/20 text-white' : m.name === 'Неизвестно' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}`}>{i + 1}</div>
                                        <span className="font-black text-sm">{m.name}</span>
                                    </div>
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl relative z-10 transition-colors ${act ? 'bg-black/20 text-white' : m.name === 'Неизвестно' ? 'bg-rose-100/80 text-rose-600' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}`}>
                                        <span className="font-black text-sm">{m.count}</span>
                                        <TrainFront className="w-4 h-4 opacity-70" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ══ RIGHT PANEL (Analytics Hub) ══ */}
            <div className="flex-1 min-w-0 flex flex-col gap-6">

                {/* Top Segmentation Control & Header Info */}
                <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-xl shadow-slate-200/50 p-6 flex flex-col items-center justify-between gap-6 xl:flex-row">
                    <div className="flex items-center gap-4 w-full xl:w-auto">
                        <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shadow-inner flex-shrink-0">
                            <TrainFront className="w-8 h-8" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">{lang === 'uz' ? 'Tanlangan MGSP' : 'Выбранный МГСП'}</span>
                            </p>
                            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight truncate">{effectiveMgsp}</h2>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
                        {/* Inline Inline Date Controls */}
                        {dateRange && onDateRangeChange && (
                            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-[1.25rem] border border-slate-200 shadow-sm w-full sm:w-auto justify-center">
                                {viewMode === 'current' ? (
                                    <div className="relative flex items-center">
                                        <CalendarDays className="w-4 h-4 text-indigo-500 absolute left-4 pointer-events-none" />
                                        <input
                                            type="date"
                                            className="bg-white border text-sm border-slate-200 text-slate-700 font-bold rounded-xl py-2 pl-10 pr-4 focus:ring-2 focus:ring-indigo-500 outline-none w-full sm:w-40 font-mono shadow-sm"
                                            value={dateRange.endDate}
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    onDateRangeChange({ startDate: e.target.value, endDate: e.target.value });
                                                }
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <input
                                            type="date"
                                            className="bg-white border text-sm border-slate-200 text-slate-700 font-bold rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none w-full sm:w-36 font-mono shadow-sm"
                                            value={dateRange.startDate}
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    onDateRangeChange({ ...dateRange, startDate: e.target.value });
                                                }
                                            }}
                                        />
                                        <span className="text-slate-400 font-bold">-</span>
                                        <input
                                            type="date"
                                            className="bg-white border text-sm border-slate-200 text-slate-700 font-bold rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none w-full sm:w-36 font-mono shadow-sm"
                                            value={dateRange.endDate}
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    onDateRangeChange({ ...dateRange, endDate: e.target.value });
                                                }
                                            }}
                                        />
                                    </>
                                )}
                            </div>
                        )}

                        {/* Mode Switcher */}
                        <div className="flex bg-slate-100 p-1.5 rounded-[1.25rem] border border-slate-200 shadow-inner w-full sm:w-auto">
                            <button
                                onClick={() => setViewMode('current')}
                                className={`flex flex-1 sm:flex-none items-center justify-center gap-2 px-6 py-2.5 rounded-[1rem] transition-all font-black text-sm capitalize ${viewMode === 'current' ? 'bg-white shadow-md text-indigo-600 ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                            >
                                <PieIcon className="w-4 h-4" />
                                {lang === 'uz' ? 'Joriy' : 'Текущие'}
                            </button>
                            <button
                                onClick={() => setViewMode('dynamics')}
                                className={`flex flex-1 sm:flex-none items-center justify-center gap-2 px-6 py-2.5 rounded-[1rem] transition-all font-black text-sm capitalize ${viewMode === 'dynamics' ? 'bg-white shadow-md text-indigo-600 ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                            >
                                <Activity className="w-4 h-4" />
                                {lang === 'uz' ? 'Dinamika' : 'Динамика'}
                            </button>
                        </div>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {/* ========================================================= */}
                    {/* ==================== CURRENT VIEW ======================= */}
                    {/* ========================================================= */}
                    {viewMode === 'current' && (
                        <motion.div key="current" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="flex flex-col gap-6 w-full">

                            {/* Summary Totals Row */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {currentViewData.map((d, i) => (
                                    <div key={d.name} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-lg shadow-slate-200/50 flex flex-col justify-between group hover:-translate-y-1 transition-transform cursor-default">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner" style={{ backgroundColor: `${PALETTE[i % PALETTE.length]}15`, color: PALETTE[i % PALETTE.length] }}>
                                                <TrendingUp className="w-6 h-6" />
                                            </div>
                                            <span className="text-[10px] uppercase tracking-wider font-black text-slate-400 px-2 py-1 bg-slate-50 rounded-lg">{d.count} {lang === 'uz' ? 'ta' : 'шт'}</span>
                                        </div>
                                        <div className="mb-1">
                                            <h4 className="text-3xl font-black text-slate-800">{d.count}</h4>
                                        </div>
                                        <span className="text-xs font-bold text-slate-500 truncate" title={d.name}>{d.name}</span>
                                        {/* Micro progress bar relative to total */}
                                        <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(d.count / mgspStiks.length) * 100}%`, backgroundColor: PALETTE[i % PALETTE.length] }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Main Bar Chart */}
                            <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-xl shadow-slate-200/50 p-8 min-h-[500px] flex flex-col">
                                <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight mb-2">
                                    <BarChart3 className="w-6 h-6 text-indigo-500" />
                                    {lang === 'uz' ? 'Yo\'nalishlar bo\'yicha jami stiklar (Vaqtsiz)' : 'Итоговое распределение по направлениям'}
                                </h3>
                                <p className="text-sm font-bold text-slate-400 mb-8">{lang === 'uz' ? 'Ushbu grafik barcha tanlangan kunlardagi ma\'lumotlarni umumlashtirib bitta oson tahliliy ko\'rinishda beradi.' : 'Этот график агрегирует данные за весь выбранный период для наглядного сравнения станций назначения.'}</p>

                                {currentViewData.length > 0 ? (
                                    <div className="flex-1 w-full min-h-[400px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={currentViewData} margin={{ top: 30, right: 30, left: -20, bottom: 40 }} barCategoryGap="20%">
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13, fontWeight: 800, fill: '#64748b' }} dy={15} />
                                                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 13, fontWeight: 800, fill: '#cbd5e1' }} />
                                                <RechartsTooltip content={<CustomSharedTooltip />} cursor={{ fill: '#f8fafc', opacity: 0.8 }} wrapperStyle={{ zIndex: 1000 }} />
                                                <Bar dataKey="count" name={lang === 'uz' ? 'Poezdlar' : 'Поезда'} radius={[12, 12, 0, 0]}>
                                                    {currentViewData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                                                    ))}
                                                    <LabelList dataKey="count" content={(props: any) => {
                                                        const { x, y, width, value } = props;
                                                        if (!value) return null;
                                                        return (
                                                            <text x={x + width / 2} y={y - 14} fill="#000" opacity={0.6} textAnchor="middle" dominantBaseline="middle" fontSize="16" fontWeight="900">
                                                                {value}
                                                            </text>
                                                        )
                                                    }} />
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                                        <Info className="w-16 h-16 opacity-20 mb-4" />
                                        <p className="font-bold text-xl">{lang === 'uz' ? 'Ma\'lumot topilmadi' : 'Нет данных'}</p>
                                    </div>
                                )}
                            </div>

                        </motion.div>
                    )}

                    {/* ========================================================= */}
                    {/* =================== DYNAMICS VIEW ======================= */}
                    {/* ========================================================= */}
                    {viewMode === 'dynamics' && (
                        <motion.div key="dynamics" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="bg-white rounded-[2rem] border border-slate-200/60 shadow-xl shadow-slate-200/50 p-8 flex-1 min-h-[600px] flex flex-col">

                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 pb-6 border-b border-slate-100 gap-4">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight mb-2">
                                        <CalendarDays className="w-6 h-6 text-indigo-500" />
                                        {lang === 'uz' ? 'Sana kesimida o\'sish va kamayish dinamikasi' : 'Частотная динамика по датам (Отчетный период)'}
                                    </h3>
                                    <p className="text-sm font-bold text-slate-400">
                                        {lang === 'uz' ? 'Diqqat: Ushbu sanalar aynan "Отчет" tabidagi 18:00 dan 18:00 gacha hisoblangan logikaga asoslangan.' : 'Внимание: Эти даты строго синхронизированы с логикой отчетов (с 18:00 до 18:00 следующего дня).'}
                                    </p>
                                </div>
                                <div className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-inner">
                                    <button onClick={() => setPeriod('day')} className={`px-5 py-2 rounded-lg text-sm font-black transition-all ${period === 'day' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>{lang === 'uz' ? 'Kunlik' : 'По Дням'}</button>
                                    <button onClick={() => setPeriod('month')} className={`px-5 py-2 rounded-lg text-sm font-black transition-all ${period === 'month' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>{lang === 'uz' ? 'Oylik' : 'По Месяцам'}</button>
                                </div>
                            </div>

                            {dynamicsData.length > 0 && dynamicsUniqueDests.length > 0 ? (
                                <div className="flex-1 w-full relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={dynamicsData} margin={{ top: 20, right: 30, left: -20, bottom: 40 }}>
                                            <defs>
                                                {dynamicsUniqueDests.map((dest, i) => (
                                                    <linearGradient key={`colorUv-${i}`} id={`colorUv-${i}`} x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.6} />
                                                        <stop offset="95%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0} />
                                                    </linearGradient>
                                                ))}
                                            </defs>
                                            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 13, fontWeight: 800, fill: '#64748b' }} dy={15} />
                                            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 13, fontWeight: 800, fill: '#cbd5e1' }} />
                                            <RechartsTooltip content={<CustomSharedTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 2, strokeDasharray: '5 5' }} wrapperStyle={{ zIndex: 1000 }} />
                                            <Legend iconType="circle" iconSize={12} wrapperStyle={{ paddingTop: 40 }} formatter={v => <span style={{ fontSize: '14px', fontWeight: 800, color: '#334155' }}>{v}</span>} />

                                            {dynamicsUniqueDests.map((dest, i) => (
                                                <Area
                                                    key={dest}
                                                    type="monotone"
                                                    dataKey={dest}
                                                    name={dest}
                                                    stroke={PALETTE[i % PALETTE.length]}
                                                    strokeWidth={4}
                                                    fillOpacity={1}
                                                    fill={`url(#colorUv-${i})`}
                                                    activeDot={{ r: 8, strokeWidth: 0, fill: PALETTE[i % PALETTE.length], stroke: '#fff' }}
                                                />
                                            ))}
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                                    <Activity className="w-16 h-16 opacity-20 mb-4" />
                                    <p className="font-bold text-xl">{lang === 'uz' ? 'Taqqoslash uchun yetarli ma\'lumot yo\'q' : 'Недостаточно данных для сравнения'}</p>
                                </div>
                            )}

                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    );
};

export default TrainInfographics;
