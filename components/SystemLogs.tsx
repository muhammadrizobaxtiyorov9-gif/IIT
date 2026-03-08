import React, { useEffect, useState, useMemo } from 'react';
import { Language, AdminUser } from '../types';
import { getSystemLogs } from '../utils/db';
import {
    Activity, Upload, Trash2, LogIn, ShieldCheck, RefreshCw,
    UserCircle2, Clock, ChevronDown, Search, FilterX, CalendarIcon
} from 'lucide-react';

interface SystemLogsProps {
    lang: Language;
    t: (key: string) => string;
    currentUser: AdminUser;
}

type ActionMeta = {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    labelRu: string;
    labelUz: string;
};

const ACTION_META: Record<string, ActionMeta> = {
    DATA_UPLOAD: { icon: Upload, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10 border-emerald-500/20', labelRu: 'Загрузка данных', labelUz: "Ma'lumot yuklash" },
    DATA_DELETE: { icon: Trash2, color: 'text-red-400', bgColor: 'bg-red-500/10 border-red-500/20', labelRu: 'Удаление данных', labelUz: "Ma'lumot o'chirish" },
    DATA_UPDATE: { icon: Activity, color: 'text-blue-400', bgColor: 'bg-blue-500/10 border-blue-500/20', labelRu: 'Обновление данных', labelUz: "Ma'lumot yangilash" },
    LOGIN: { icon: LogIn, color: 'text-indigo-400', bgColor: 'bg-indigo-500/10 border-indigo-500/20', labelRu: 'Вход / Выход', labelUz: 'Kirish / Chiqish' },
    ADMIN_ADD: { icon: ShieldCheck, color: 'text-amber-400', bgColor: 'bg-amber-500/10 border-amber-500/20', labelRu: 'Добавление польз.', labelUz: "Foydalanuvchi qo'sh" },
    ADMIN_DELETE: { icon: ShieldCheck, color: 'text-rose-400', bgColor: 'bg-rose-500/10 border-rose-500/20', labelRu: 'Удаление польз.', labelUz: "Foydalanuvchi o'ch" },
    ADMIN_UPDATE: { icon: UserCircle2, color: 'text-sky-400', bgColor: 'bg-sky-500/10 border-sky-500/20', labelRu: 'Изменение польз.', labelUz: "Foydalanuvchi o'zg" },
};

const FB = (): ActionMeta => ({
    icon: Activity, color: 'text-slate-400',
    bgColor: 'bg-slate-700/30 border-slate-600/20',
    labelRu: 'Действие', labelUz: 'Amal'
});

/** roles visible to regular admins (not superadmin) */
const ADMIN_VISIBLE_ROLES = ['user', 'admin', 'unknown'];
/** actions shown for non-superadmin viewers */
const USER_ACTIONS = ['DATA_UPLOAD', 'DATA_DELETE', 'DATA_UPDATE', 'LOGIN'];

const toDateStr = (ts: number) => new Date(ts).toISOString().split('T')[0];

const formatTs = (ts: number, lang: Language) => {
    const d = new Date(ts);
    if (lang === 'uz') {
        const m = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
        return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    }
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const today = () => new Date().toISOString().split('T')[0];

const SystemLogs: React.FC<SystemLogsProps> = ({ lang, currentUser }) => {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterAction, setFilterAction] = useState('all');
    const [filterDate, setFilterDate] = useState(today());
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [sortDesc, setSortDesc] = useState(true);

    const isSuperAdmin = currentUser.role === 'superadmin';
    const ul = lang === 'uz';

    const fetchLogs = async (showSpinner = false) => {
        if (showSpinner) setLoading(true);
        try {
            const all = await getSystemLogs();
            setLogs(all);
        } catch {
            if (showSpinner) setLogs([]);
        } finally {
            if (showSpinner) setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs(true); // initial load: show spinner
        const iv = setInterval(() => fetchLogs(false), 30000); // silent background refresh
        return () => clearInterval(iv);
    }, []);

    /** Role-filtered base set */
    const rolePassed = useMemo(() => {
        if (isSuperAdmin) return logs; // superadmin sees everything
        // Admin sees only user/admin actions (not superadmin system moves)
        return logs.filter(l =>
            USER_ACTIONS.includes(l.action) &&
            ADMIN_VISIBLE_ROLES.includes(l.userRole ?? 'unknown')
        );
    }, [logs, isSuperAdmin]);

    const filteredLogs = useMemo(() => {
        let res = [...rolePassed];
        // Date filter
        if (filterDate) res = res.filter(l => toDateStr(l.timestamp) === filterDate);
        // Action filter
        if (filterAction !== 'all') res = res.filter(l => l.action === filterAction);
        // Search
        if (search.trim()) {
            const q = search.toLowerCase();
            res = res.filter(l =>
                l.username?.toLowerCase().includes(q) ||
                l.details?.toLowerCase().includes(q) ||
                l.action?.toLowerCase().includes(q)
            );
        }
        res.sort((a, b) => sortDesc ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);
        return res;
    }, [rolePassed, filterDate, filterAction, search, sortDesc]);

    // Stats based on role-filtered + selected date
    const dayLogs = useMemo(() =>
        rolePassed.filter(l => toDateStr(l.timestamp) === filterDate),
        [rolePassed, filterDate]);

    const uploadCount = dayLogs.filter(l => l.action === 'DATA_UPLOAD').length;
    const deleteCount = dayLogs.filter(l => l.action === 'DATA_DELETE').length;
    const uniqueUsers = new Set(dayLogs.map((l: any) => l.username)).size;

    const statCards = [
        { label: ul ? 'Jami yozuvlar' : 'Всего за день', value: dayLogs.length, icon: Activity, grad: 'from-slate-700 to-slate-800' },
        { label: ul ? 'Yuklamalar' : 'Загрузок', value: uploadCount, icon: Upload, grad: 'from-emerald-500 to-emerald-600' },
        { label: ul ? "O'chirishlar" : 'Удалений', value: deleteCount, icon: Trash2, grad: 'from-red-500 to-red-600' },
        { label: ul ? 'Foydalanuvchilar' : 'Пользователей', value: uniqueUsers, icon: UserCircle2, grad: 'from-indigo-500 to-blue-600' },
    ];

    const availableActions = isSuperAdmin
        ? Object.keys(ACTION_META)
        : USER_ACTIONS;

    return (
        <div className="min-h-full bg-[#F8FAFC] p-6 lg:p-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="mb-8 flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl shadow-lg shadow-indigo-500/30">
                    <Activity className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                        {ul ? 'Tizim Tarixi' : 'История системы'}
                    </h1>
                    <p className="text-slate-400 text-sm font-medium">
                        {ul ? 'Foydalanuvchilar faoliyati jurnali' : 'Журнал активности пользователей'}
                    </p>
                </div>
                {isSuperAdmin && (
                    <span className="ml-auto px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-600 rounded-full border border-purple-200">
                        Super Admin
                    </span>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {statCards.map((c, i) => (
                    <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
                        <div className={`p-3 bg-gradient-to-br ${c.grad} rounded-xl shadow-md`}>
                            <c.icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 leading-tight">{c.label}</p>
                            <p className="text-2xl font-black text-slate-800 tabular-nums">{c.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Controls */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
                {/* Date Picker */}
                <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 pointer-events-none" />
                    <input
                        type="date"
                        value={filterDate}
                        onChange={e => setFilterDate(e.target.value)}
                        className="pl-10 pr-4 py-2.5 text-sm bg-indigo-50 border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-indigo-700 font-bold cursor-pointer appearance-none"
                    />
                </div>

                {/* Search */}
                <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder={ul ? 'Qidirish...' : 'Поиск...'}
                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-700 font-medium"
                    />
                </div>

                {/* Action filter */}
                <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
                    className="px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-700 font-medium cursor-pointer">
                    <option value="all">{ul ? 'Barcha amallar' : 'Все действия'}</option>
                    {availableActions.map(a => {
                        const m = ACTION_META[a] || FB();
                        return <option key={a} value={a}>{ul ? m.labelUz : m.labelRu}</option>;
                    })}
                </select>

                {/* Sort */}
                <button onClick={() => setSortDesc(!sortDesc)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-600 font-bold transition-colors">
                    <Clock className="w-4 h-4" />
                    {sortDesc
                        ? (ul ? 'Yangi - Eski' : 'Новые - Старые')
                        : (ul ? 'Eski - Yangi' : 'Старые - Новые')}
                </button>

                {/* Today shortcut */}
                <button onClick={() => setFilterDate(today())}
                    className="px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-600 font-bold transition-colors">
                    {ul ? 'Bugun' : 'Сегодня'}
                </button>

                {/* Refresh */}
                <button onClick={() => fetchLogs(true)} disabled={loading}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 font-bold transition-colors disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    {ul ? 'Yangilash' : 'Обновить'}
                </button>
            </div>

            {/* Selected date badge */}
            {filterDate && (
                <div className="mb-4 flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {ul ? 'Tanlangan sana:' : 'Выбранная дата:'}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black border border-indigo-200">
                        {new Date(filterDate + 'T00:00:00').toLocaleDateString(ul ? 'uz-UZ' : 'ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">— {filteredLogs.length} {ul ? 'ta yozuv' : 'записей'}</span>
                </div>
            )}

            {/* Log rows */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-20 flex flex-col items-center gap-4 text-slate-400">
                        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                        <p className="text-sm font-bold">{ul ? 'Yuklanmoqda...' : 'Загрузка...'}</p>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="p-20 flex flex-col items-center gap-3 text-slate-400">
                        <FilterX className="w-10 h-10 opacity-30" />
                        <p className="font-bold text-sm">{ul ? 'Yozuvlar topilmadi' : 'Записей не найдено'}</p>
                        <p className="text-xs opacity-60">{ul ? 'Boshqa sanani tanlang yoki filtrni tozalang' : 'Выберите другую дату или сбросьте фильтры'}</p>
                        {(search || filterAction !== 'all') && (
                            <button onClick={() => { setSearch(''); setFilterAction('all'); }}
                                className="text-xs text-indigo-500 font-bold hover:underline mt-1">
                                {ul ? 'Filtrni tozalash' : 'Сбросить фильтры'}
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {filteredLogs.map((log: any, idx: number) => {
                            const meta = ACTION_META[log.action] || FB();
                            const Icon = meta.icon;
                            const isExpanded = expandedId === log.id;
                            const roleLabel = log.userRole === 'superadmin' ? 'SuperAdmin' : log.userRole === 'admin' ? 'Admin' : log.userRole === 'user' ? 'User' : '';

                            // Parse train indexes from details for DATA_UPLOAD
                            // Expected format: "... (Poezdlar: 3002 (7571+014+7453))"
                            let trainIndexes: string[] = [];
                            let wagonCount = '';
                            if (log.action === 'DATA_UPLOAD' && log.details) {
                                // Extract wagon count
                                const wagonMatch = log.details.match(/(\d+)\s*vagon/i);
                                if (wagonMatch) wagonCount = wagonMatch[1];

                                // Extract train list — content inside first set of parens after "Poezdlar:"
                                const poezdMatch = log.details.match(/Poezdlar[:\s]+([^\)]+)\(([^\)]+)\)/i);
                                if (poezdMatch) {
                                    // poezdMatch[1] is main train index, poezdMatch[2] is sub-indexes
                                    const mainTrain = poezdMatch[1].trim();
                                    const subTrains = poezdMatch[2].split('+').map((s: string) => s.trim()).filter(Boolean);
                                    trainIndexes = [mainTrain, ...subTrains].filter(Boolean);
                                } else {
                                    // Fallback: try simpler "(Poezdlar: X, Y, Z)" pattern
                                    const simpleMatch = log.details.match(/Poezdlar[:\s]+([^\)]+)/i);
                                    if (simpleMatch) {
                                        trainIndexes = simpleMatch[1].split(/[,+]/).map((s: string) => s.trim()).filter(Boolean);
                                    }
                                }
                            }

                            return (
                                <div key={log.id || idx}
                                    className="p-4 hover:bg-slate-50/70 transition-colors cursor-pointer"
                                    onClick={() => setExpandedId(isExpanded ? null : log.id)}>
                                    <div className="flex items-center gap-4">
                                        <div className={`flex-none p-2.5 rounded-xl border ${meta.bgColor}`}>
                                            <Icon className={`w-4 h-4 ${meta.color}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                                <span className="text-sm font-black text-slate-800">
                                                    {ul ? meta.labelUz : meta.labelRu}
                                                </span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.bgColor} ${meta.color}`}>
                                                    {log.action}
                                                </span>
                                                {isSuperAdmin && roleLabel && (
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${log.userRole === 'superadmin' ? 'bg-purple-100 text-purple-600 border-purple-200' :
                                                            log.userRole === 'admin' ? 'bg-blue-100 text-blue-600 border-blue-200' :
                                                                'bg-slate-100 text-slate-500 border-slate-200'
                                                        }`}>
                                                        {roleLabel}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
                                                <span className="flex items-center gap-1">
                                                    <UserCircle2 className="w-3 h-3" />
                                                    <span className="font-bold text-slate-600">{log.username}</span>
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {formatTs(log.timestamp, lang)}
                                                </span>
                                                {wagonCount && (
                                                    <span className="text-slate-400 font-bold">
                                                        {wagonCount} vagon
                                                    </span>
                                                )}
                                            </div>
                                            {/* Inline train badges for DATA_UPLOAD */}
                                            {trainIndexes.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {trainIndexes.map((train, ti) => (
                                                        <span key={ti}
                                                            className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[10px] font-mono font-black text-emerald-700">
                                                            🚂 {train}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <ChevronDown className={`flex-none w-4 h-4 text-slate-300 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                    </div>
                                    {isExpanded && log.details && (
                                        <div className="mt-3 ml-[52px] p-4 bg-slate-800 rounded-xl text-xs font-mono text-green-400 leading-relaxed whitespace-pre-wrap animate-in slide-in-from-top-2 fade-in duration-200">
                                            {log.details}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                {filteredLogs.length > 0 && (
                    <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-400 font-bold text-right">
                        {ul
                            ? `${filteredLogs.length} ta yozuv ko'rsatilmoqda`
                            : `Показано ${filteredLogs.length} записей`}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SystemLogs;
