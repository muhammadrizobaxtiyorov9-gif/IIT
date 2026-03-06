import React, { useMemo, useState } from 'react';
import { Wagon, Language, Station } from '../types';
import { getCargoNameTranslated, getTranslation } from '../utils/translations';
import { PackageOpen, TrendingUp, BarChart3, Weight, Box, ChevronDown, ChevronUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area, LabelList } from 'recharts';
import { motion } from 'framer-motion';

interface CargoInfographicsProps {
    wagons: Wagon[];
    stations: Station[];
    lang: Language;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/95 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-white/20 text-xs text-slate-800">
                <p className="font-extrabold text-sm mb-2 pb-2 border-b border-slate-100">{payload[0].name}</p>
                <div className="flex justify-between items-center gap-6 mb-1">
                    <span className="text-slate-500 font-medium">Вагоны:</span>
                    <span className="font-bold bg-slate-100 px-2 py-0.5 rounded-md">{payload[0].payload.wagons} ед.</span>
                </div>
                <div className="flex justify-between items-center gap-6">
                    <span className="text-slate-500 font-medium">Вес:</span>
                    <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{payload[0].value.toLocaleString()} т</span>
                </div>
            </div>
        );
    }
    return null;
};

const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/95 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-white/20 text-xs">
                <p className="font-extrabold text-slate-800 text-sm mb-3 pb-2 border-b border-slate-100">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center justify-between gap-6 mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: entry.color }} />
                            <span className="text-slate-500 font-medium">{entry.name}:</span>
                        </div>
                        <span className="font-bold text-slate-800">{entry.value.toLocaleString()} т</span>
                    </div>
                ))}
                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-slate-500 font-bold">Итого:</span>
                    <span className="font-black text-indigo-600 text-sm">
                        {(payload[0]?.value + (payload[1]?.value || 0)).toLocaleString()} т
                    </span>
                </div>
            </div>
        );
    }
    return null;
};

const CargoInfographics: React.FC<CargoInfographicsProps> = ({ wagons, lang }) => {
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    const t = (key: string) => getTranslation(key, lang);

    // Advanced Cargo Data Computation
    const stats = useMemo(() => {
        let totalWeight = 0;
        let totalWagons = 0;
        let importWeight = 0;
        let transitWeight = 0;

        const cargoMap = new Map<string, {
            code: string;
            name: string;
            totalWagons: number;
            totalWeight: number;
            importWagons: number;
            importWeight: number;
            transitWagons: number;
            transitWeight: number;
        }>();

        wagons.forEach(w => {
            if (!w.cargoWeight || w.cargoWeight <= 0) return;

            const destDor = w.matchedStation?.dor;
            const rName = w.matchedStation?.regionName?.toLowerCase() || '';

            const isKyrgyzstan = destDor === 71 || rName.includes('кирг') || rName.includes('кырг');
            const isTurkmenistan = destDor === 75 || rName.includes('турк');
            const isKazakhstan = (destDor >= 66 && destDor <= 70) && !isKyrgyzstan;
            const isTajikistan = destDor === 74 || rName.includes('тадж') || rName.includes('бек') || rName.includes('куд');
            const isGalaba = w.matchedStation?.name?.toLowerCase().includes('галаба');

            const isImport = destDor === 73 && !isGalaba;
            const isTransit = isKazakhstan || isTurkmenistan || isKyrgyzstan || isTajikistan || isGalaba;

            const cCode = w.cargoCode || 'UNKNOWN';
            const cName = getCargoNameTranslated(cCode, lang);
            const unifiedKey = `${cCode}_${cName}`;

            if (!cargoMap.has(unifiedKey)) {
                cargoMap.set(unifiedKey, {
                    code: cCode,
                    name: cName,
                    totalWagons: 0,
                    totalWeight: 0,
                    importWagons: 0,
                    importWeight: 0,
                    transitWagons: 0,
                    transitWeight: 0
                });
            }

            const cs = cargoMap.get(unifiedKey)!;
            cs.totalWagons += 1;
            cs.totalWeight += w.cargoWeight;

            if (isImport) {
                cs.importWagons += 1;
                cs.importWeight += w.cargoWeight;
                importWeight += w.cargoWeight;
            } else if (isTransit) {
                cs.transitWagons += 1;
                cs.transitWeight += w.cargoWeight;
                transitWeight += w.cargoWeight;
            }

            totalWagons += 1;
            totalWeight += w.cargoWeight;
        });

        const cArray = Array.from(cargoMap.values()).sort((a, b) => b.totalWeight - a.totalWeight);
        return {
            list: cArray,
            totalWeight,
            totalWagons,
            importWeight,
            transitWeight
        };
    }, [wagons, lang]);

    const totalTotalWeight = stats?.totalWeight || 0;
    const totalTotalWagons = stats?.totalWagons || 0;

    // Visual Formats
    const topCargoPie = useMemo(() => {
        if (!stats) return [];
        const top = stats.list.slice(0, 7);
        const others = stats.list.slice(7);

        const mapped = top.map(c => ({
            name: c.name.length > 25 ? c.name.substring(0, 25) + "..." : c.name,
            value: c.totalWeight,
            wagons: c.totalWagons,
            code: c.code
        }));

        if (others.length > 0) {
            mapped.push({
                name: lang === 'uz' ? 'Boshqalar' : 'Прочие',
                value: others.reduce((acc, c) => acc + c.totalWeight, 0),
                wagons: others.reduce((acc, c) => acc + c.totalWagons, 0),
                code: 'OTHER'
            });
        }
        return mapped;
    }, [stats, lang]);

    const barData = useMemo(() => {
        if (!stats) return [];
        return stats.list.slice(0, 10).map(c => ({
            name: c.name.length > 15 ? c.name.substring(0, 15) + "..." : c.name,
            'Импорт': c.importWeight,
            'Транзит': c.transitWeight,
            originalName: c.name,
        }));
    }, [stats]);

    // Compute Extended Features
    const extendedInsights = useMemo(() => {
        if (!wagons || wagons.length === 0) return { wagonTypes: [], dailyDynamics: [], topStations: [] };

        const wTypeMap: Record<string, { weight: number; count: number; nameRu: string; nameUz: string }> = {
            '2': { weight: 0, count: 0, nameRu: 'Крытые', nameUz: 'Yopiq vagonlar' },
            '4': { weight: 0, count: 0, nameRu: 'Платформы', nameUz: 'Platformalar' },
            '6': { weight: 0, count: 0, nameRu: 'Полувагоны', nameUz: 'Yarim vagonlar' },
            '7': { weight: 0, count: 0, nameRu: 'Цистерны', nameUz: 'Sisternalar' },
            '8': { weight: 0, count: 0, nameRu: 'Изотермические', nameUz: 'Izotermik vagonlar' },
            'other': { weight: 0, count: 0, nameRu: 'Прочие', nameUz: 'Boshqalar' }
        };

        const dailyMap = new Map<string, { weight: number; wagons: number }>();
        const stationMap = new Map<string, { weight: number; wagons: number }>();

        wagons.forEach(w => {
            if (!w.cargoWeight || w.cargoWeight <= 0) return;

            // Wagon Type Logic
            const wNum = w.number || '';
            const firstDigit = wNum.charAt(0);
            if (wTypeMap[firstDigit]) {
                wTypeMap[firstDigit].weight += w.cargoWeight;
                wTypeMap[firstDigit].count += 1;
            } else {
                wTypeMap['other'].weight += w.cargoWeight;
                wTypeMap['other'].count += 1;
            }

            // Daily Dynamics Logic
            if (w.arrivalDate) {
                const dateKey = new Date(w.arrivalDate).toISOString().split('T')[0];
                const dayData = dailyMap.get(dateKey) || { weight: 0, wagons: 0 };
                dayData.weight += w.cargoWeight;
                dayData.wagons += 1;
                dailyMap.set(dateKey, dayData);
            }

            // Top Stations Logic
            const stName = w.destinationStation || 'Неизвестно';
            const stData = stationMap.get(stName) || { weight: 0, wagons: 0 };
            stData.weight += w.cargoWeight;
            stData.wagons += 1;
            stationMap.set(stName, stData);
        });

        const sortedWagonTypes = Object.values(wTypeMap)
            .filter(t => t.weight > 0)
            .sort((a, b) => b.weight - a.weight)
            .map(t => ({
                name: lang === 'uz' ? t.nameUz : t.nameRu,
                value: t.weight,
                wagons: t.count
            }));

        const sortedDaily = Array.from(dailyMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, data]) => ({
                date: new Date(date).toLocaleDateString(lang === 'uz' ? 'uz-UZ' : 'ru-RU', { day: '2-digit', month: 'short' }),
                fullDate: date,
                weight: data.weight,
                wagons: data.wagons
            }));

        const sortedStations = Array.from(stationMap.entries())
            .sort((a, b) => b[1].weight - a[1].weight)
            .slice(0, 10)
            .map(([name, data]) => ({
                name: name.length > 20 ? name.substring(0, 20) + "..." : name,
                originalName: name,
                weight: data.weight,
                wagons: data.wagons
            }));

        return { wagonTypes: sortedWagonTypes, dailyDynamics: sortedDaily, topStations: sortedStations };
    }, [wagons, lang]);

    const toggleRow = (code: string) => {
        setExpandedRows(prev => ({ ...prev, [code]: !prev[code] }));
    };

    if (!wagons || wagons.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white/50 backdrop-blur-xl rounded-3xl border border-white/60 shadow-sm animate-in fade-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <PackageOpen className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-700 mb-2">{lang === 'uz' ? "Yuk ma'lumotlari yo'q" : "Нет данных о грузах"}</h3>
                <p className="text-slate-400 font-medium text-center max-w-sm">
                    {lang === 'uz' ? "Bu davr uchun tizimda yuk tashish yozuvlari topilmadi." : "Записи о перевозках грузов за этот период не найдены в системе."}
                </p>
            </div>
        );
    }

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.6,
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, scale: 0.95 },
        visible: { opacity: 1, scale: 1 }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
        >

            {/* Premium Metric Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* Total Weight Card (Gradient) */}
                <motion.div
                    variants={itemVariants}
                    whileHover={{ scale: 1.02, y: -4 }}
                    className="bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden group transition-shadow hover:shadow-2xl hover:shadow-blue-500/30"
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-700"></div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <p className="text-blue-100 text-sm font-bold uppercase tracking-wider mb-2 opacity-90">{lang === 'uz' ? 'Jami Yuk Hajmi' : 'Общий Объем Груза'}</p>
                                <h3 className="text-4xl font-black tracking-tight">{totalTotalWeight.toLocaleString()} <span className="text-xl font-bold text-blue-200">т</span></h3>
                            </div>
                            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md shadow-inner">
                                <Weight className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10 inline-flex items-center gap-2 w-fit">
                            <Box className="w-4 h-4 text-blue-200" />
                            <p className="text-sm text-blue-50 font-medium">
                                В <span className="text-white font-bold">{totalTotalWagons.toLocaleString()}</span> вагонах
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Top Cargo Card */}
                <motion.div
                    variants={itemVariants}
                    whileHover={{ scale: 1.02, y: -4 }}
                    className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col justify-between group transition-shadow hover:shadow-2xl hover:shadow-slate-200/50 relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-2xl -mr-10 -mt-10"></div>
                    <div className="relative z-10 flex justify-between items-start mb-4">
                        <div>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{lang === 'uz' ? 'Top Yuk' : 'Топ Груз'}</p>
                            <h3 className="text-xl font-black text-slate-800 leading-tight pr-4">
                                {stats.list[0]?.name || '-'}
                            </h3>
                        </div>
                        <div className="p-3 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-2xl shadow-sm border border-emerald-100 shrink-0">
                            <TrendingUp className="w-5 h-5 text-emerald-600" />
                        </div>
                    </div>
                    <div className="relative z-10 font-bold text-emerald-700 bg-emerald-50/80 border border-emerald-100 px-4 py-2.5 rounded-xl inline-flex items-center justify-between shadow-sm">
                        <span>{stats.list[0]?.totalWeight.toLocaleString()} т</span>
                        <span className="bg-white px-2 py-0.5 rounded-md text-emerald-600 shadow-sm text-xs">{(stats.list[0]?.totalWeight / totalTotalWeight * 100).toFixed(1)}%</span>
                    </div>
                </motion.div>

                {/* Import Card */}
                <motion.div
                    variants={itemVariants}
                    whileHover={{ scale: 1.02, y: -4 }}
                    className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col justify-between group transition-shadow hover:shadow-2xl hover:shadow-slate-200/50 relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-2xl -mr-10 -mt-10"></div>
                    <div className="relative z-10 flex justify-between items-start mb-4">
                        <div>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{t('import')}</p>
                            <h3 className="text-3xl font-black text-slate-800 tracking-tight">
                                {stats.importWeight.toLocaleString()} <span className="text-lg text-slate-400 font-bold">т</span>
                            </h3>
                        </div>
                        <div className="p-3 bg-gradient-to-br from-indigo-100 to-indigo-50 rounded-2xl shadow-sm border border-indigo-100 shrink-0">
                            <PackageOpen className="w-5 h-5 text-indigo-600" />
                        </div>
                    </div>
                    <div className="relative z-10 w-full mt-2">
                        <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
                            <span>Доля</span>
                            <span className="text-indigo-600">{((stats.importWeight / totalTotalWeight) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden shadow-inner p-0.5">
                            <div className="bg-gradient-to-r from-indigo-500 to-indigo-400 h-full rounded-full w-0 animate-[growWidth_1.5s_ease-out_forwards]" style={{ '--target-width': `${(stats.importWeight / totalTotalWeight) * 100}%` } as any}></div>
                        </div>
                    </div>
                </motion.div>

                {/* Transit Card */}
                <motion.div
                    variants={itemVariants}
                    whileHover={{ scale: 1.02, y: -4 }}
                    className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col justify-between group transition-shadow hover:shadow-2xl hover:shadow-slate-200/50 relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full blur-2xl -mr-10 -mt-10"></div>
                    <div className="relative z-10 flex justify-between items-start mb-4">
                        <div>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{t('transit')}</p>
                            <h3 className="text-3xl font-black text-slate-800 tracking-tight">
                                {stats.transitWeight.toLocaleString()} <span className="text-lg text-slate-400 font-bold">т</span>
                            </h3>
                        </div>
                        <div className="p-3 bg-gradient-to-br from-amber-100 to-amber-50 rounded-2xl shadow-sm border border-amber-100 shrink-0">
                            <PackageOpen className="w-5 h-5 text-amber-600" />
                        </div>
                    </div>
                    <div className="relative z-10 w-full mt-2">
                        <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
                            <span>Доля</span>
                            <span className="text-amber-600">{((stats.transitWeight / totalTotalWeight) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden shadow-inner p-0.5">
                            <div className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full w-0 animate-[growWidth_1.5s_ease-out_forwards]" style={{ '--target-width': `${(stats.transitWeight / totalTotalWeight) * 100}%` } as any}></div>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Injected custom animation keyframes for the progress bars */}
            <style>{`
                @keyframes growWidth {
                    from { width: 0%; }
                    to { width: var(--target-width); }
                }
            `}</style>

            {/* Visual Charts Row */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Donut Chart: Cargo Breakdown */}
                <div className="col-span-1 bg-white/90 backdrop-blur-xl rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-200/40 relative">
                    <h3 className="text-lg font-black text-slate-800 mb-2 relative z-10">{lang === 'uz' ? 'Yuk turlari taqsimoti' : 'Распределение грузов (по весу)'}</h3>
                    <div className="h-[280px] relative z-10">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={topCargoPie}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={110}
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                    cornerRadius={6}
                                >
                                    {topCargoPie.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 1000 }} />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Metric */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-4">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Всего</span>
                            <span className="text-xl font-black text-slate-800">{(totalTotalWeight / 1000).toFixed(1)}k</span>
                            <span className="text-xs font-bold text-slate-500">тонн</span>
                        </div>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-2 justify-center relative z-10">
                        {topCargoPie.map((entry, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs bg-slate-50/80 px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm transition-transform hover:scale-105 cursor-default">
                                <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                <span className="text-slate-600 font-semibold truncate max-w-[110px]" title={entry.name}>{entry.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Stacked Bar Chart: Import vs Transit for Top Cargo */}
                <div className="col-span-1 lg:col-span-2 bg-white/90 backdrop-blur-xl rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-black text-slate-800">{lang === 'uz' ? 'Top yuklar dinamikasi (Tranzit / Import)' : 'Динамика топ-грузов (Транзит / Импорт)'}</h3>
                        <div className="flex gap-4 border border-slate-100 bg-slate-50 p-1.5 rounded-xl text-xs font-bold">
                            <div className="flex items-center gap-2 px-3 py-1 rounded-lg">
                                <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-sm"></div>
                                <span className="text-slate-600">Импорт</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1 rounded-lg">
                                <div className="w-3 h-3 rounded-full bg-amber-400 shadow-sm"></div>
                                <span className="text-slate-600">Транзит</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 min-h-[300px] w-full mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }} barSize={32}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                                    axisLine={false}
                                    tickLine={false}
                                    angle={-35}
                                    textAnchor="end"
                                    dy={15}
                                />
                                <YAxis
                                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(val) => `${val / 1000}k`}
                                />
                                <RechartsTooltip content={<CustomBarTooltip />} cursor={{ fill: '#f8fafc', radius: 8 }} wrapperStyle={{ zIndex: 1000 }} />
                                <Bar dataKey="Импорт" stackId="a" fill="#6366f1" radius={[0, 0, 8, 8]}>
                                    <LabelList dataKey="Импорт" position="center" fill="#ffffff" fontSize={11} fontWeight="bold" formatter={(val: number) => val > 0 ? `${(val / 1000).toFixed(0)}k` : ''} />
                                </Bar>
                                <Bar dataKey="Транзит" stackId="a" fill="#fbbf24" radius={[8, 8, 0, 0]}>
                                    <LabelList dataKey="Транзит" position="center" fill="#ffffff" fontSize={11} fontWeight="bold" formatter={(val: number) => val > 0 ? `${(val / 1000).toFixed(0)}k` : ''} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </motion.div>

            {/* Extended Visual Charts Row */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Daily Arrival Dynamics Area Chart & Top Stations */}
                <div className="col-span-1 lg:col-span-3 grid grid-rows-2 gap-6">

                    {/* Area Chart: Timeline */}
                    <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-black text-slate-800">{lang === 'uz' ? 'Kunlik kelib tushish dinamikasi' : 'Временная динамика поступления'}</h3>
                        </div>
                        <div className="flex-1 w-full min-h-[160px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={extendedInsights.dailyDynamics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                                        axisLine={false}
                                        tickLine={false}
                                        dy={10}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                                    />
                                    <RechartsTooltip
                                        wrapperStyle={{ zIndex: 1000 }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                return (
                                                    <div className="bg-white/95 backdrop-blur-xl p-3 rounded-xl shadow-xl border border-white/20 text-xs">
                                                        <p className="font-extrabold text-slate-800 mb-2 border-b border-slate-100 pb-1">{payload[0].payload.fullDate}</p>
                                                        <div className="flex justify-between gap-4 mb-1">
                                                            <span className="text-slate-500">Вагоны:</span>
                                                            <span className="font-bold">{payload[0].payload.wagons} шт</span>
                                                        </div>
                                                        <div className="flex justify-between gap-4">
                                                            <span className="text-slate-500">Вес:</span>
                                                            <span className="font-bold text-blue-600">{payload[0].value.toLocaleString()} т</span>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Area type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorWeight)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Top Stations List */}
                    <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col overflow-hidden">
                        <h3 className="text-lg font-black text-slate-800 mb-4">{lang === 'uz' ? 'Top manzil stansiyalari (Yuk hajmi bo\'yicha)' : 'Топ станций назначения (по весу)'}</h3>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="space-y-3">
                                {extendedInsights.topStations.map((st, i) => (
                                    <div key={i} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-3 w-1/2">
                                            <span className="w-5 font-black text-slate-300 text-right text-xs">{i + 1}.</span>
                                            <span className="font-bold text-slate-700 text-sm truncate group-hover:text-blue-600 transition-colors" title={st.originalName}>{st.name}</span>
                                        </div>
                                        <div className="w-1/2 flex items-center justify-end gap-3">
                                            <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden flex justify-end">
                                                <div className="bg-emerald-400 h-full rounded-full transition-all" style={{ width: `${(st.weight / (extendedInsights.topStations[0]?.weight || 1)) * 100}%` }}></div>
                                            </div>
                                            <span className="font-black text-slate-800 text-sm min-w-[60px] text-right">{(st.weight / 1000).toFixed(1)}<span className="text-[10px] text-slate-400 font-bold ml-0.5">k т</span></span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            </motion.div>

            {/* Premium Data Matrix Table */}
            <motion.div variants={itemVariants} className="bg-white/90 backdrop-blur-xl rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-wrap justify-between items-center bg-white/50">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 mb-1">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                                <BarChart3 className="w-5 h-5" />
                            </div>
                            {lang === 'uz' ? 'Yuklar matritsasi va detallar' : 'Главная матрица грузов'}
                        </h3>
                        <p className="text-sm text-slate-500 font-medium ml-12">Детальная повагонная раскладка по типам груза</p>
                    </div>
                    <span className="text-xs font-black text-slate-600 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 shadow-sm mt-4 md:mt-0">
                        {stats.list.length} {lang === 'uz' ? 'xil reyestr' : 'уникальных записей'}
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-800">
                        <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                            <tr>
                                <th className="px-8 py-5 border-b border-slate-100">{t('cargo_col')}</th>
                                <th className="px-6 py-5 border-b border-slate-100 text-center">{lang === 'uz' ? 'Vagonlar' : 'Вагоны (Общ.)'}</th>
                                <th className="px-6 py-5 border-b border-slate-100 text-center">{lang === 'uz' ? 'Import (t)' : 'Импорт'}</th>
                                <th className="px-6 py-5 border-b border-slate-100 text-center">{lang === 'uz' ? 'Tranzit (t)' : 'Транзит'}</th>
                                <th className="px-8 py-5 border-b border-slate-100 text-right">{t('total_weight')} / Доля</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {stats.list.map((c, idx) => {
                                const isExpanded = expandedRows[c.code];
                                const pct = (c.totalWeight / totalTotalWeight) * 100;

                                return (
                                    <React.Fragment key={c.code + '_' + idx}>
                                        <tr
                                            onClick={() => toggleRow(c.code)}
                                            className={`transition-all duration-200 cursor-pointer group ${isExpanded ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}
                                        >
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    <button className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${isExpanded ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                    </button>
                                                    <div className="flex flex-col">
                                                        <span className="font-extrabold text-slate-800 text-sm">{c.name}</span>
                                                        <span className="text-[10px] text-slate-400 font-mono font-bold mt-0.5 bg-slate-100 px-1.5 py-0.5 rounded w-fit">{c.code}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <span className="inline-flex items-center justify-center min-w-[3rem] bg-slate-100 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs border border-slate-200/50 shadow-sm">
                                                    {c.totalWagons}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <span className={`font-bold inline-block px-3 py-1.5 rounded-xl text-xs shadow-sm ${c.importWeight > 0 ? 'bg-indigo-50 text-indigo-700 border border-indigo-100/50' : 'text-slate-300 bg-transparent'}`}>
                                                    {c.importWeight > 0 ? c.importWeight.toLocaleString() + ' т' : '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <span className={`font-bold inline-block px-3 py-1.5 rounded-xl text-xs shadow-sm ${c.transitWeight > 0 ? 'bg-amber-50 text-amber-700 border border-amber-100/50' : 'text-slate-300 bg-transparent'}`}>
                                                    {c.transitWeight > 0 ? c.transitWeight.toLocaleString() + ' т' : '-'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-right w-64">
                                                <div className="flex flex-col justify-end items-end gap-1.5">
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-black text-slate-900 text-base">{c.totalWeight.toLocaleString()} <span className="text-slate-400 text-xs font-bold">т</span></span>
                                                        <span className="text-[10px] font-black w-10 text-right text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">{pct.toFixed(1)}%</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex justify-end">
                                                        <div className="bg-blue-500 h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%` }}></div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Sub-row expansion */}
                                        {isExpanded && (
                                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                                <td colSpan={5} className="px-8 py-6">
                                                    <div className="flex flex-wrap gap-6 pl-14 animate-in slide-in-from-top-2 duration-300 pb-2">
                                                        <div className="bg-white p-4 rounded-2xl border border-indigo-100/50 shadow-sm min-w-[200px] relative overflow-hidden">
                                                            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                                                            <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mb-3 flex justify-between items-center">
                                                                <span>Импорт</span>
                                                                <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md">{c.importWagons} ваг.</span>
                                                            </p>
                                                            {c.importWagons === 0 ?
                                                                <span className="text-slate-400 italic text-xs font-medium">Потоков из КЗ в РУз нет</span> :
                                                                <span className="font-black text-2xl text-indigo-700">{c.importWeight.toLocaleString()} <span className="text-sm font-bold text-indigo-300">т</span></span>
                                                            }
                                                        </div>
                                                        <div className="bg-white p-4 rounded-2xl border border-amber-100/50 shadow-sm min-w-[200px] relative overflow-hidden">
                                                            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                                                            <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mb-3 flex justify-between items-center">
                                                                <span>Транзит</span>
                                                                <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md">{c.transitWagons} ваг.</span>
                                                            </p>
                                                            {c.transitWagons === 0 ?
                                                                <span className="text-slate-400 italic text-xs font-medium">Транзитных потоков нет</span> :
                                                                <span className="font-black text-2xl text-amber-600">{c.transitWeight.toLocaleString()} <span className="text-sm font-bold text-amber-300">т</span></span>
                                                            }
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </motion.div >
        </motion.div >
    );
};

export default CargoInfographics;
