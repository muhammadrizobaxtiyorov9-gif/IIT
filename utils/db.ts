
import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, query, orderBy, where, documentId,
  enableIndexedDbPersistence, runTransaction, setLogLevel,
  DocumentSnapshot, QuerySnapshot, DocumentData
} from 'firebase/firestore';
import { DailyReport, AppSettings, Wagon, Station, MapPoint, MtuRegion, AdminUser } from '../types';
import { logger } from './logger'; // Import logger

// --- CONFIGURATION FROM .ENV ---
const API_URL = process.env.VITE_API_URL || 'http://localhost:3001/api';
const USE_LOCAL_BACKEND = process.env.VITE_USE_LOCAL_BACKEND === 'true';

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDa0NpM85dNSHiV8Bc_7Zhk94zwf-_6Vjk",
  authDomain: "railway-app-95390.firebaseapp.com",
  projectId: "railway-app-95390",
  storageBucket: "railway-app-95390.firebasestorage.app",
  messagingSenderId: "397194105094",
  appId: "1:397194105094:web:43b168e5aa0532c2f70e87",
  measurementId: "G-3KLPST7J1E"
};

// Initialize Firebase Conditionally
let app: any = null;
let db: any = null;

if (!USE_LOCAL_BACKEND) {
  try {
    // Suppress Firestore warnings (fixes circular JSON crashes in some console wrappers and hides deprecation warnings)
    setLogLevel('error');

    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("[Firebase] Initialized successfully. Backend is active.");

    // Legacy persistence initialization (Compatible with gstatic imports)
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Persistence failed: Multiple tabs open');
      } else if (err.code === 'unimplemented') {
        console.warn('Persistence failed: Browser not supported');
      }
    });
  } catch (e) {
    // Only log the message string to avoid circular error in logger
    console.warn("Firebase initialization failed (Offline mode active):", String(e));
  }
}

// --- HELPER: ROBUST DEEP CLEAN (Sanitizes data for DB/Storage) ---
const deepClean = (obj: any, visited = new WeakSet()): any => {
  // 1. Primitives
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // 2. Dates
  if (obj instanceof Date) {
    if (isNaN(obj.getTime())) return null;
    return obj.toISOString();
  }

  // Handle Firestore Timestamps if they somehow leak in
  if (obj && typeof obj === 'object' && typeof obj.toDate === 'function') {
    return obj.toDate().toISOString();
  }

  // 3. Circular Reference Check
  if (visited.has(obj)) {
    return null;
  }
  visited.add(obj);

  // 4. Arrays
  if (Array.isArray(obj)) {
    return obj.map(item => deepClean(item, visited));
  }

  // 5. Complex Object Filtering (Firestore internals, DOM nodes, etc.)
  // We strictly allow only plain Objects (constructor.name === 'Object' or null prototype).
  if (obj.constructor && obj.constructor.name !== 'Object') {
    return undefined;
  }

  // Specific checks for DOM or Leaflet just in case constructor check was bypassed
  if (obj._leaflet_id !== undefined || (obj.nodeType && typeof obj.cloneNode === 'function')) {
    return undefined;
  }

  // 6. Plain Object Copy
  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (key.startsWith('_') || key.startsWith('$')) continue; // Skip internal keys
      const val = deepClean(obj[key], visited);
      if (val !== undefined) {
        result[key] = val;
      }
    }
  }
  return result;
};

const safeStringify = (data: any): string => {
  try {
    const cleaned = deepClean(data);
    const str = JSON.stringify(cleaned);
    return str === undefined ? "{}" : str;
  } catch (e) {
    console.warn("JSON Stringify Failed:", String(e));
    return "{}";
  }
};

// --- INTERNAL EVENT BUS ---
type EventType = 'reports' | 'settings' | 'admins';
const listeners: Record<EventType, Array<() => void>> = {
  reports: [],
  settings: [],
  admins: []
};

const notifyChange = (type: EventType) => {
  listeners[type].forEach(cb => cb());
};

const subscribeToLocalChanges = (type: EventType, callback: () => void) => {
  listeners[type].push(callback);
  return () => {
    listeners[type] = listeners[type].filter(cb => cb !== callback);
  };
};

// --- LOCAL STORAGE HELPERS ---
const LS = {
  SETTINGS: 'uty_map_config',
  ADMINS: 'uty_admins_list',

  saveSettings: (data: any) => {
    try {
      localStorage.setItem(LS.SETTINGS, safeStringify(data));
    } catch (e) { }
  },
  getSettings: () => {
    try {
      const d = localStorage.getItem(LS.SETTINGS);
      if (d) return JSON.parse(d);
      return null;
    } catch (e) { return null; }
  },

  getAdmins: () => {
    try {
      const d = localStorage.getItem(LS.ADMINS);
      return d ? JSON.parse(d) : [];
    } catch (e) { return []; }
  },

  saveAdmin: (user: any) => {
    try {
      const admins = LS.getAdmins();
      const filtered = admins.filter((a: any) => a.username !== user.username);
      filtered.push(user);
      localStorage.setItem(LS.ADMINS, safeStringify(filtered));
    } catch (e) { }
  },

  deleteAdmin: (username: string) => {
    try {
      const admins = LS.getAdmins().filter((a: any) => a.username !== username);
      localStorage.setItem(LS.ADMINS, safeStringify(admins));
    } catch (e) { }
  },

  saveReport: (date: string, data: DailyReport) => {
    try {
      localStorage.setItem(`report_${date}`, safeStringify(data));
    } catch (e) { }
  },

  getReport: (date: string, userContext?: AdminUser): DailyReport | null => {
    try {
      const raw = localStorage.getItem(`report_${date}`);
      if (raw) {
        const data = JSON.parse(raw) as DailyReport;
        if (userContext && userContext.role === 'user') {
          return (data.uploadedBy === userContext.username) ? data : null;
        }
        return data;
      }
      return null;
    } catch (e) { return null; }
  },

  deleteReport: (date: string) => {
    try {
      localStorage.removeItem(`report_${date}`);
    } catch (e) { }
  }
};

const withTimeout = <T>(promise: Promise<T>, ms: number = 3000): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Firestore operation timed out after ${ms}ms`));
    }, ms);
    promise.then(v => { clearTimeout(timer); resolve(v); }).catch(r => { clearTimeout(timer); reject(r); });
  });
};

// --- API FUNCTIONS (HYBRID STRATEGY WITH TRANSACTION) ---

// Generates a cryptographically random immutable user UID.
// Falls back to a timestamp+random combo if crypto API is unavailable.
const generateUid = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {}
  return Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 12);
};


// Helper: builds the Firestore doc ID for a user-scoped report
// Uses immutable uid when available so renames don't break data links.
// Admin uploads use date__uid; legacy/no-uid fallback uses date__username.
const getDocId = (date: string, uploadedBy?: string, uid?: string): string => {
  if (!uploadedBy) return date; // backwards compat
  if (uid) return `${date}__${uid}`;
  return `${date}__${uploadedBy}`; // fallback
};

const unMinifyReport = (cleanDate: string, finalData: any): DailyReport => {
  const sections = finalData.sections || [];
  const unMinifiedWagons = (finalData.wagons || []).map((w: any) => ({
    sequence: w.s ?? w.sequence ?? 0,
    number: w.n ?? w.number ?? "",
    operationCode: w.o ?? w.operationCode ?? "",
    cargoWeight: w.w ?? w.cargoWeight ?? 0,
    stationCode: w.st ?? w.stationCode ?? "",
    cargoCode: w.c ?? w.cargoCode ?? "",
    entryPointId: w.ep ?? w.entryPointId ?? null,
    trainIndex: w.ti ?? w.trainIndex ?? "",
    rawBlock: w.rb ?? (w.si !== undefined ? sections[w.si] : ""),
    arrivalDate: w.ad || w.arrivalDate || undefined
  }));
  return {
    date: finalData.date || cleanDate,
    rawData: finalData.rawData || "",
    wagons: unMinifiedWagons,
    sections,
    stations: [],
    timestamp: finalData.timestamp || Date.now(),
    uploadedBy: finalData.uploadedBy
  };
};

export const getReportByDate = async (date: string, userContext?: AdminUser): Promise<DailyReport | null> => {
  const cleanDate = date.trim();
  const isUser = userContext?.role === 'user';

  // --- Firestore fetch ---
  try {
    if (USE_LOCAL_BACKEND) {
      // Local backend: fetch by date and filter client-side if needed
      const res = await fetch(`${API_URL}/reports/${cleanDate}`);
      if (res.ok) {
        const finalData = await res.json();
        if (isUser && finalData.uploadedBy !== userContext!.username) return null;
        const report = unMinifyReport(cleanDate, finalData);
        LS.saveReport(cleanDate, report);
        return report;
      }
    } else if (db) {
      if (isUser) {
        // Fetch user-scoped doc directly: prefer date__uid, fallback to date__username
        const userUid = userContext!.uid;
        const docId = userUid
          ? getDocId(cleanDate, userContext!.username, userUid)
          : getDocId(cleanDate, userContext!.username);
        const docSnap = await withTimeout(getDoc(doc(db, "reports", docId))) as DocumentSnapshot<DocumentData>;
        if (docSnap.exists()) {
          const report = unMinifyReport(cleanDate, docSnap.data());
          LS.saveReport(cleanDate, report);
          return report;
        }
        // Fallback: try the other format (uid-less)
        if (userUid) {
          const fallbackId = getDocId(cleanDate, userContext!.username);
          const fallbackSnap = await withTimeout(getDoc(doc(db, "reports", fallbackId))) as DocumentSnapshot<DocumentData>;
          if (fallbackSnap.exists()) {
            const data = fallbackSnap.data();
            if (data.uploadedBy === userContext!.username) {
              const report = unMinifyReport(cleanDate, data);
              LS.saveReport(cleanDate, report);
              return report;
            }
          }
        }
        // Also try legacy date-only doc (migration compatibility)
        const legacySnap = await withTimeout(getDoc(doc(db, "reports", cleanDate))) as DocumentSnapshot<DocumentData>;
        if (legacySnap.exists()) {
          const data = legacySnap.data();
          if (data.uploadedBy === userContext!.username) {
            const report = unMinifyReport(cleanDate, data);
            LS.saveReport(cleanDate, report);
            return report;
          }
        }
      } else {
        // Admin/superadmin: query all docs whose ID starts with cleanDate
        // MUST use documentId() sentinel — NOT the string "__name__"
        const coll = collection(db, "reports");
        const q = query(
          coll,
          orderBy(documentId()),
          where(documentId(), ">=", cleanDate),
          where(documentId(), "<=", cleanDate + "\uf8ff")
        );
        const snap = await withTimeout(getDocs(q)) as QuerySnapshot<DocumentData>;
        if (!snap.empty) {
          // Merge all docs for that date into one combined report (admin view)
          const combined: any = { date: cleanDate, wagons: [], rawData: "", sections: [], timestamp: 0, uploadedBy: undefined };
          snap.docs.forEach(d => {
            const data = d.data();
            combined.wagons = [...combined.wagons, ...(data.wagons || [])];
            combined.rawData += (data.rawData ? `\n--- [${data.uploadedBy}] ---\n${data.rawData}` : '');
            combined.sections = [...combined.sections, ...(data.sections || [])];
            if (data.timestamp > combined.timestamp) combined.timestamp = data.timestamp;
          });
          return unMinifyReport(cleanDate, combined);
        }
      }
    }
  } catch (error) {
    console.warn(`[Load Info] Backend load failed for ${cleanDate}.`);
  }

  // Local fallback
  try {
    const localReport = LS.getReport(cleanDate, userContext);
    if (localReport) return localReport;
  } catch (e) { }

  return null;
};

export const getReportsInRange = async (startDate: string, endDate: string, userContext?: AdminUser): Promise<DailyReport[]> => {
  const reports: DailyReport[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Fast parallel fetching for the entire date range
  const datesToFetch: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    datesToFetch.push(d.toISOString().split('T')[0]);
  }

  const fetchedReports = await Promise.all(datesToFetch.map(dateStr => getReportByDate(dateStr, userContext)));

  fetchedReports.forEach(report => {
    if (report) reports.push(report);
  });

  return reports;
};

export const getReportDates = async (userContext?: AdminUser): Promise<string[]> => {
  const dates = new Set<string>();
  const isUser = userContext?.role === 'user';

  // Get Backend Dates
  try {
    if (USE_LOCAL_BACKEND) {
      const res = await fetch(`${API_URL}/reports`);
      if (res.ok) {
        const list = await res.json();
        list.forEach((item: any) => {
          if (!isUser || item.uploadedBy === userContext!.username) {
            dates.add(item.date);
          }
        });
      }
    } else if (db) {
      // For regular users: query by uploadedBy field
      // For admins: get all docs in reports collection
      let q: any = collection(db, "reports");
      if (isUser) {
        q = query(q, where("uploadedBy", "==", userContext!.username));
      }
      const snapshot = await withTimeout(getDocs(q)) as QuerySnapshot<DocumentData>;
      snapshot.docs.forEach(docSnap => {
        const rawId = docSnap.id; // may be "2026-03-08" or "2026-03-08__alice"
        // Extract just the date part (before any "__" separator)
        const dateOnly = rawId.includes('__') ? rawId.split('__')[0] : rawId;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
          dates.add(dateOnly);
        }
      });
    }

    // Harden backend endpoint fetching client-side too:
    // If backend didn't filter, we filter manually here.
  } catch (error) {
    console.warn("Backend date fetch failed.");
  }

  // Double check manual enforcement if fallback or proxy
  if (userContext && userContext.role === 'user') {
    const verifiedDates = new Set<string>();
    // Since getReportDates just gets dates from backend, we might be leaking if the backend endpoint '/reports'
    // doesn't filter by user. To be absolutely safe without changing the backend right now,
    // the UI will only see dates, but when parsing occurs, `getReportByDate` will block unauthorized payloads.
    // However, to stop them from even seeing the date dots in the calendar:
    for (const d of Array.from(dates)) {
      const report = LS.getReport(d, userContext); // Check local storage for user-specific data
      if (report) {
        verifiedDates.add(d);
      } else {
        // If not in local storage, try fetching from backend to verify
        const backendReport = await getReportByDate(d, userContext);
        if (backendReport) {
          verifiedDates.add(d);
        }
      }
    }
    dates.clear();
    verifiedDates.forEach(d => dates.add(d));
  }

  return Array.from(dates).sort().reverse();
};

export const getAllReports = async (userContext?: AdminUser): Promise<DailyReport[]> => {
  const reportsMap = new Map<string, DailyReport>();

  // Load Backend Reports
  try {
    if (USE_LOCAL_BACKEND) {
      const res = await fetch(`${API_URL}/reports`);
      if (res.ok) {
        const list = await res.json();
        list.forEach((l: any) => {
          reportsMap.set(l.date, {
            date: l.date,
            timestamp: l.timestamp || Date.now(),
            wagons: [],
            rawData: "",
            sections: [],
            stations: [],
            wagonCount: l.wagonCount || 0,
            uploadedBy: l.uploadedBy,
            totalWeight: 0
          });
        });
      }
    } else if (db) {
      const coll = collection(db, "reports");
      let q = query(coll, orderBy("date", "desc"));
      if (userContext && userContext.role === 'user') {
        q = query(coll, where("uploadedBy", "==", userContext.username), orderBy("date", "desc"));
      }
      const snapshot = await withTimeout(getDocs(q)) as QuerySnapshot<DocumentData>;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        reportsMap.set(doc.id, {
          date: doc.id,
          timestamp: data.timestamp || Date.now(),
          wagons: [],
          rawData: "",
          sections: [],
          stations: [],
          wagonCount: data.wagons?.length || 0,
          uploadedBy: data.uploadedBy,
          totalWeight: 0
        });
      });
    }

    // Client-side fallback filtering if needed (works for both backend and naive firestore fetches)
    if (userContext && userContext.role === 'user') {
      for (const [key, val] of Array.from(reportsMap.entries())) {
        if (val.uploadedBy !== userContext.username) {
          reportsMap.delete(key);
        }
      }
    }
  } catch (error) {
    // Silent fail
  }

  return Array.from(reportsMap.values()).sort((a, b) => b.date.localeCompare(a.date));
};

export const subscribeToReports = (onUpdate: (reports: DailyReport[]) => void, userContext?: AdminUser): () => void => {
  const refresh = () => getAllReports(userContext).then(onUpdate);
  const unsubscribeLocal = subscribeToLocalChanges('reports', refresh);

  refresh();
  const interval = setInterval(refresh, 5000);
  const unsubscribeRemote = () => clearInterval(interval);

  return () => { unsubscribeLocal(); unsubscribeRemote(); };
};

export const deleteTrainFromReport = async (date: string, trainIndex: string, deletedBy?: string): Promise<{ success: boolean, message?: string }> => {
  const cleanDate = date.trim();
  const normalize = (s: string) => (s || "").trim();
  const targetIndex = normalize(trainIndex);

  try {
    if (USE_LOCAL_BACKEND) {
      const res = await fetch(`${API_URL}/reports/${cleanDate}`);
      if (res.ok) {
        const data = await res.json();
        const updatedWagons = (data.wagons || []).filter((w: any) => normalize(w.ti || w.trainIndex) !== targetIndex);
        await fetch(`${API_URL}/reports/${cleanDate}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: safeStringify({ ...data, wagons: updatedWagons })
        });
      }
    } else if (db) {
      const docRef = doc(db, "reports", cleanDate);
      await withTimeout(runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(docRef);
        if (sfDoc.exists()) {
          const data = sfDoc.data();
          const updatedWagons = (data.wagons || []).filter((w: any) => normalize(w.ti || w.trainIndex) !== targetIndex);
          transaction.update(docRef, { wagons: updatedWagons });
        }
      }), 10000);
    }
    if (deletedBy) {
      logSystemAction('DATA_DELETE', deletedBy, `Deleted train ${targetIndex} from report for date ${cleanDate}`);
    }
    // Invalidate local cache so stale data isn't served on next load
    LS.deleteReport(cleanDate);
    notifyChange('reports');
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

export const deleteReport = async (date: string, username?: string): Promise<{ success: boolean, message?: string }> => {
  const cleanDate = date.trim();

  try {
    if (USE_LOCAL_BACKEND) {
      const res = await fetch(`${API_URL}/reports/${cleanDate}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Backend delete failed");
    } else if (db) {
      await withTimeout(deleteDoc(doc(db, "reports", cleanDate)));
    }
    if (username) {
      logSystemAction('DATA_DELETE', username, `Deleted report for date ${cleanDate}`);
    }
    // Invalidate local cache to keep LS in sync with backend
    LS.deleteReport(cleanDate);
    notifyChange('reports');
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

// --- SETTINGS & ADMIN ---
export const saveMapSettings = async (mapPoints: MapPoint[], mtuRegions: MtuRegion[]) => {
  const cleanPoints = mapPoints.map(p => ({
    id: String(p.id),
    name: String(p.name),
    lat: Number(p.lat),
    lng: Number(p.lng),
    region: String(p.region)
  }));
  const cleanRegions = mtuRegions.map(r => ({
    id: String(r.id),
    name: String(r.name),
    color: String(r.color),
    points: (r.points || []).map((pt: any) => {
      let lat, lng;
      if (Array.isArray(pt)) { lat = pt[0]; lng = pt[1]; }
      else if (typeof pt === 'object' && pt !== null) { lat = pt.lat; lng = pt.lng; }
      return { lat: Number(lat), lng: Number(lng) };
    }).filter(pt => !isNaN(pt.lat) && !isNaN(pt.lng))
  }));

  const payload = { id: 'map_config', mapPoints: cleanPoints, mtuRegions: cleanRegions };
  LS.saveSettings(payload);
  notifyChange('settings');

  try {
    const cleanPayload = deepClean(payload);
    if (USE_LOCAL_BACKEND) {
      await fetch(`${API_URL}/settings`, { method: 'POST', body: safeStringify(cleanPayload) });
    } else if (db) {
      setDoc(doc(db, "settings", "map_config"), cleanPayload).catch(() => { });
    }
  } catch (e: any) { }
  return true;
};

export const loadMapSettings = async (): Promise<AppSettings | undefined> => {
  let data: AppSettings | undefined = undefined;
  try {
    if (USE_LOCAL_BACKEND) {
      const res = await fetch(`${API_URL}/settings`);
      if (res.ok) data = await res.json();
    } else if (db) {
      const docSnap = await withTimeout(getDoc(doc(db, "settings", "map_config"))) as DocumentSnapshot<DocumentData>;
      if (docSnap.exists()) data = docSnap.data() as AppSettings;
    }
  } catch (e) { }

  if (!data) data = LS.getSettings();
  if (data) {
    const sanitizePoints = (points: any[]) => (points || []).map((p: any) => [Number(p[0] || p.lat), Number(p[1] || p.lng)] as [number, number]).filter((p: number[]) => !isNaN(p[0]) && !isNaN(p[1]));
    data.mapPoints = (data.mapPoints || []).filter((p: any) => !isNaN(Number(p.lat)) && !isNaN(Number(p.lng)));
    data.mtuRegions = (data.mtuRegions || []).map((r: any) => ({ ...r, points: sanitizePoints(r.points) }));
    return data;
  }
  return undefined;
};

export const subscribeToSettings = (onUpdate: (settings: AppSettings) => void): () => void => {
  const refresh = () => loadMapSettings().then(s => s && onUpdate(s));
  const unsubscribeLocal = subscribeToLocalChanges('settings', refresh);

  refresh();
  const interval = setInterval(refresh, 5000);
  const unsubscribeRemote = () => clearInterval(interval);

  return () => { unsubscribeLocal(); unsubscribeRemote(); };
};

const DEFAULT_ADMIN: AdminUser = { username: 'admin', role: 'superadmin', name: 'Super Admin', addedAt: Date.now(), deviceInfo: 'System', lastLogin: Date.now() };

export const verifyAdmin = async (username: string, pass: string, deviceInfo: string): Promise<AdminUser | null> => {
  if (USE_LOCAL_BACKEND) {
    const localAdmins = LS.getAdmins();
    const found = localAdmins.find((a: any) => a.username === username && a.password === pass);
    if (found) {
      if (username === 'admin' && found.role !== 'superadmin') {
        found.role = 'superadmin';
        LS.saveAdmin(found);
      }
      return found;
    }
    if (username === 'admin' && pass === 'admin' && localAdmins.length === 0) return DEFAULT_ADMIN;
    return null;
  }

  try {
    if (db) {
      const docRef = doc(db, "admins", username);
      const docSnap = await withTimeout(getDoc(docRef), 3000) as DocumentSnapshot<DocumentData>;
      if (docSnap.exists() && docSnap.data()?.password === pass) {
        const data = docSnap.data() as AdminUser;
        if (username === 'admin' && data.role !== 'superadmin') {
          data.role = 'superadmin';
          await setDoc(docRef, { role: 'superadmin' }, { merge: true }).catch(() => { });
        }
        // AUTO-MIGRATE: assign immutable uid if user doesn't have one yet
        if (!data.uid) {
          data.uid = generateUid();
          await setDoc(docRef, { uid: data.uid }, { merge: true }).catch(() => { });
        }
        await setDoc(docRef, { lastLogin: Date.now(), deviceInfo }, { merge: true }).catch(() => { });
        return data;
      } else if (username === 'admin' && pass === 'admin') {
        const adminsSnap = await getDocs(collection(db, "admins"));
        if (adminsSnap.empty) {
          await setDoc(docRef, { ...DEFAULT_ADMIN, password: 'admin' });
          return DEFAULT_ADMIN;
        }
      }
    } else {
      const localAdmins = LS.getAdmins();
      const found = localAdmins.find((a: any) => a.username === username && a.password === pass);
      if (found) {
        if (username === 'admin' && found.role !== 'superadmin') {
          found.role = 'superadmin';
          LS.saveAdmin(found);
        }
        return found;
      }
      if (username === 'admin' && pass === 'admin' && localAdmins.length === 0) return DEFAULT_ADMIN;
    }
  } catch (e) { }
  return null;
};

// --- ADMIN MANAGEMENT ---

export const getAdmins = async (): Promise<AdminUser[]> => {
  if (!USE_LOCAL_BACKEND && db) {
    try {
      const snapshot = await withTimeout(getDocs(collection(db, "admins"))) as QuerySnapshot<DocumentData>;
      if (!snapshot.empty) {
        return snapshot.docs.map(d => {
          const data = d.data() as AdminUser;
          if (data.username === 'admin') data.role = 'superadmin';
          return data;
        });
      }
    } catch (e) { }
  }
  const local = LS.getAdmins();
  if (local.length > 0) {
    return local.map((a: any) => {
      if (a.username === 'admin') a.role = 'superadmin';
      return a;
    });
  }
  return [DEFAULT_ADMIN];
};

export const subscribeToAdmins = (onUpdate: (admins: AdminUser[]) => void): () => void => {
  const refresh = () => getAdmins().then(onUpdate);
  const unsubscribeLocal = subscribeToLocalChanges('admins', refresh);

  refresh();
  const interval = setInterval(refresh, 5000);
  const unsubscribeRemote = () => clearInterval(interval);

  return () => { unsubscribeLocal(); unsubscribeRemote(); };
};

export const addAdmin = async (admin: AdminUser, pass: string, creator?: string): Promise<boolean> => {
  // Ensure every new user has an immutable uid
  const uid = admin.uid || generateUid();
  const newAdmin = { ...admin, uid, password: pass, createdBy: creator };
  LS.saveAdmin(newAdmin);
  notifyChange('admins');

  if (creator) {
    logSystemAction('ADMIN_ADD', creator, `Added admin: ${admin.username}`);
  }

  if (!USE_LOCAL_BACKEND && db) {
    try { await withTimeout(setDoc(doc(db, "admins", admin.username), newAdmin)); } catch (e) { }
  }
  return true;
};

export const deleteAdmin = async (username: string, deleter?: string): Promise<boolean> => {
  LS.deleteAdmin(username);
  notifyChange('admins');

  if (deleter) {
    logSystemAction('ADMIN_DELETE', deleter, `Deleted admin: ${username}`);
  }

  if (!USE_LOCAL_BACKEND && db) {
    try { await withTimeout(deleteDoc(doc(db, "admins", username))); } catch (e) { }
  }
  return true;
};

export const updateAdmin = async (username: string, updates: Partial<AdminUser>, updater?: string): Promise<boolean> => {
  // Local Storage Update
  const admins = LS.getAdmins();
  const idx = admins.findIndex((a: any) => a.username === username);
  if (idx >= 0) {
    admins[idx] = { ...admins[idx], ...updates };
    localStorage.setItem(LS.ADMINS, safeStringify(admins));
  }
  notifyChange('admins');

  if (updater) {
    logSystemAction('ADMIN_UPDATE', updater, `Updated admin: ${username}`);
  }

  if (!USE_LOCAL_BACKEND && db) {
    try { await withTimeout(setDoc(doc(db, "admins", username), updates, { merge: true })); } catch (e) { }
  }
  return true;
};

export const changeUserCredentials = async (username: string, oldPass: string, newPass?: string, newName?: string, newUsername?: string): Promise<{ success: boolean; message: string; newUserObj?: AdminUser }> => {
  try {
    const admins = await getAdmins();
    const targetUser = admins.find(a => a.username === username);

    if (!targetUser) {
      return { success: false, message: "Foydalanuvchi topilmadi" };
    }

    // Verify old password
    const verifiedUser = await verifyAdmin(username, oldPass, 'system_update_check');
    if (!verifiedUser) {
      return { success: false, message: "Eski parol noto'g'ri" };
    }

    const updates: Partial<AdminUser> = {};
    if (newPass && newPass.trim() !== "") updates.password = newPass;
    if (newName && newName.trim() !== "") updates.name = newName;

    const changingUsername = newUsername && newUsername.trim() !== "" && newUsername.trim() !== username;

    if (changingUsername) {
      // Check if new username already exists
      const exists = admins.find(a => a.username === newUsername.trim());
      if (exists) {
        return { success: false, message: "Ushbu login band. Boshqa login tanlang." };
      }
    }

    if (Object.keys(updates).length > 0 || changingUsername) {

      if (changingUsername) {
        const finalUsername = newUsername!.trim();
        const newDocData = { ...targetUser, ...updates, username: finalUsername };

        // Add to local DB under new name
        await addAdmin(newDocData, newDocData.password || oldPass, targetUser.username);

        // Delete old
        await deleteAdmin(username, targetUser.username);

        return { success: true, message: "Login va ma'lumotlar muvaffaqiyatli saqlandi", newUserObj: newDocData };
      } else {
        await updateAdmin(username, updates, username);
        return { success: true, message: "Ma'lumotlar muvaffaqiyatli saqlandi", newUserObj: { ...targetUser, ...updates } };
      }
    }

    return { success: false, message: "O'zgarishlar kiritilmadi" };
  } catch (error) {
    console.error("Credentials update error:", error);
    return { success: false, message: "Tizim xatosi yuz berdi" };
  }
};

export const logSystemAction = async (
  action: 'LOGIN' | 'DATA_UPLOAD' | 'DATA_DELETE' | 'ADMIN_ADD' | 'ADMIN_DELETE' | 'ADMIN_UPDATE' | 'DATA_UPDATE',
  username: string,
  details: string,
  userRole?: string
) => {
  const logEntry: any = {
    id: String(Date.now()) + Math.random().toString(36).substr(2, 9),
    timestamp: Date.now(),
    action,
    username,
    details,
    userRole: userRole || 'unknown'
  };

  try {
    if (USE_LOCAL_BACKEND) {
      // In a real local backend, we would POST to /logs
    } else if (db) {
      await setDoc(doc(db, "logs", logEntry.id), logEntry);
    }
  } catch (e) {
    console.warn("Failed to save log", e);
  }
};

export const getSystemLogs = async (): Promise<any[]> => {
  try {
    if (db) {
      const q = query(collection(db, "logs"), orderBy("timestamp", "desc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => d.data());
    }
  } catch (e) { }
  return [];
};

// Updated saveDailyReport to include user logging
export const saveDailyReport = async (
  date: string,
  wagons: Wagon[],
  rawData: string,
  sections: any[],
  staticStations: any[],
  uploadedBy: string,
  trainIdentifiers?: string[]
): Promise<{ success: boolean, backendSaved: boolean, report?: any, message?: string }> => {
  const cleanDate = date.trim();
  const timestamp = Date.now();

  // Log the action
  const wagonCount = wagons.length;
  const uniqueTrains = Array.from(new Set(wagons.map(w => w.trainIndex?.trim()).filter(Boolean)));
  const trainListStr = uniqueTrains.length > 0 ? ` (Poezdlar: ${uniqueTrains.join(', ')})` : '';
  logSystemAction('DATA_UPLOAD', uploadedBy, `Yuklandi: ${wagonCount} vagon, sana: ${cleanDate}${trainListStr}`);

  // Deduplicate raw blocks into a section pool to save massive space
  const sectionPool: string[] = [];
  const sectionMap = new Map<string, number>();

  const getSectionIndex = (rb: string | undefined) => {
    if (!rb) return undefined;
    if (sectionMap.has(rb)) return sectionMap.get(rb);
    const idx = sectionPool.length;
    sectionPool.push(rb);
    sectionMap.set(rb, idx);
    return idx;
  };

  // Helper to ensure consistent minification
  const toMinified = (w: any) => {
    const rb = w.rb ?? w.rawBlock;
    const si = w.si ?? getSectionIndex(rb);

    return {
      s: w.s ?? w.sequence ?? 0,
      n: w.n ?? w.number ?? "",
      o: w.o ?? w.operationCode ?? "",
      w: w.w ?? w.cargoWeight ?? 0,
      st: w.st ?? w.stationCode ?? "",
      c: w.c ?? w.cargoCode ?? "",
      ep: w.ep ?? w.entryPointId ?? (w.entryPoint ? (w.entryPoint.fullCode || w.entryPoint.id) : null),
      ti: w.ti ?? w.trainIndex ?? "",
      ad: w.ad ?? w.arrivalDate ?? undefined,
      si: si // Store index instead of full string
    };
  };

  const minifiedNewWagons = wagons.map(toMinified);

  const fullPayload: any = {
    date: cleanDate,
    rawData: rawData || "",
    wagons: minifiedNewWagons,
    sections: sectionPool,
    timestamp,
    uploadedBy
  };

  // Improved Merge Logic: Composite Key to preserve history/movements
  // AND enforces minification on all wagons
  const mergeWagons = (oldWagons: any[], newWagonsArray: any[], oldSections: string[] = []) => {
    const map = new Map<string, any>();
    const getKey = (w: any) => w.n;

    // When merging, we need to handle section indices carefully
    // 1. Add old wagons (they already have indices pointing to oldSections)
    oldWagons.forEach(w => {
      const rb = w.rb ?? (w.si !== undefined ? oldSections[w.si] : "");
      const si = getSectionIndex(rb);
      const min = { ...toMinified(w), si };
      if (min.n) map.set(getKey(min), min);
    });

    // 2. Add new wagons
    newWagonsArray.forEach(w => {
      const rb = w.rb ?? w.rawBlock;
      const si = getSectionIndex(rb);
      const min = { ...toMinified(w), si };
      if (min.n) map.set(getKey(min), min);
    });

    return Array.from(map.values());
  };

  const mergeRawData = (oldRaw: string, newRaw: string) => {
    if (!oldRaw) return newRaw;
    if (!newRaw) return oldRaw;

    // Normalize to check for duplicates
    const normalizedNew = newRaw.trim();
    if (oldRaw.includes(normalizedNew)) {
      return oldRaw;
    }

    return oldRaw + "\n\n--- MERGED [" + new Date().toLocaleTimeString() + "] ---\n" + newRaw;
  };

  // --- PRIMARY SAVE STRATEGY: BACKEND ---
  let backendSaved = false;
  let finalReport: any = fullPayload;
  let errorMessage = "";

  try {
    if (USE_LOCAL_BACKEND) {
      let existingData: any = {};
      try {
        const res = await fetch(`${API_URL}/reports/${cleanDate}`);
        if (res.ok) existingData = await res.json();
      } catch (e) { }

      const mergedWagons = mergeWagons(existingData.wagons || [], minifiedNewWagons, existingData.sections || []);

      const mergedPayload: any = {
        date: cleanDate,
        rawData: mergeRawData(existingData.rawData || "", rawData),
        wagons: mergedWagons,
        sections: sectionPool,
        timestamp,
        uploadedBy // Preserve newest uploadership
      };

      const res = await fetch(`${API_URL}/reports/${cleanDate}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: safeStringify(mergedPayload)
      });

      if (!res.ok) throw new Error("Local Server Error");

      backendSaved = true;
      finalReport = mergedPayload;

    } else if (db) {
      // Use composite doc ID for data isolation per user
      // Prefer uid-based key for immutability; fall back to username for legacy
      const userUid = uploadedBy ? await (async () => {
        try {
          if (db) {
            const uSnap = await getDoc(doc(db, "admins", uploadedBy));
            if (uSnap.exists()) return uSnap.data()?.uid as string | undefined;
          }
        } catch {}
        return undefined;
      })() : undefined;
      const docId = getDocId(cleanDate, uploadedBy, userUid);
      const docRef = doc(db, "reports", docId);

      try {
        await withTimeout(runTransaction(db, async (transaction) => {
          const sfDoc = await transaction.get(docRef);

          let finalWagons = minifiedNewWagons;
          let finalRawData = rawData;
          let finalSections = sectionPool;

          if (sfDoc.exists()) {
            const data = sfDoc.data();
            finalWagons = mergeWagons(data.wagons || [], minifiedNewWagons, data.sections || []);
            finalRawData = mergeRawData(data.rawData || "", rawData);
            finalSections = sectionPool;
          }

          const cleanPayload: any = deepClean({
            date: cleanDate,
            rawData: finalRawData,
            wagons: finalWagons,
            sections: finalSections,
            timestamp,
            uploadedBy
          });

          transaction.set(docRef, cleanPayload);
          finalReport = cleanPayload;
        }), 10000);

        backendSaved = true;
      } catch (txError) {
        errorMessage = String(txError);

        // Fallback
        try {
          const docSnap = await getDoc(docRef);

          let finalWagons = minifiedNewWagons;
          let finalRawData = rawData;
          let finalSections = sectionPool;

          if (docSnap.exists()) {
            const serverData = docSnap.data();
            finalWagons = mergeWagons(serverData.wagons || [], minifiedNewWagons, serverData.sections || []);
            finalRawData = mergeRawData(serverData.rawData || "", rawData);
            finalSections = sectionPool;
          }

          const mergedPayload = deepClean({
            ...fullPayload,
            wagons: finalWagons,
            rawData: finalRawData,
            sections: finalSections,
            timestamp: Date.now(),
            uploadedBy
          });

          await setDoc(docRef, mergedPayload);
          finalReport = mergedPayload;
          backendSaved = true;

        } catch (fallbackError) {
          await setDoc(docRef, deepClean(fullPayload));
          backendSaved = true;
        }
      }
    }
  } catch (error) {
    const safeErrorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`[Save Error] ${safeErrorMsg}`);
    errorMessage = safeErrorMsg;
    backendSaved = false;
  }

  notifyChange('reports');
  return {
    success: true,
    backendSaved,
    report: finalReport,
    message: backendSaved ? undefined : `Saved locally. Backend sync failed: ${errorMessage}`
  };
};
