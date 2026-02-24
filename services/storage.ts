
import { AdminUser, SystemConfig, ActivityLog, ViewState, Classroom, DashboardTab } from '../types';

const STORAGE_KEYS = {
  CONFIG: 'APP_SYSTEM_CONFIG',
  LOGS: 'APP_ACTIVITY_LOGS',
  SESSION: 'APP_ACTIVE_SESSION',
  NAVIGATION: 'APP_NAVIGATION_STATE',
  DASHBOARD_TAB: 'APP_DASHBOARD_TAB'
};

// Default admin for bootstrap/fallback ONLY
export const FALLBACK_ADMIN: AdminUser = {
  id: 'admin-001',
  username: 'Admin',
  password: '@Np123456',
  name: 'ผู้ดูแลระบบหลัก (Offline)',
  role: 'SUPER_ADMIN'
};

// Default configuration (Updated with hardcoded URL)
const DEFAULT_CONFIG: SystemConfig = {
  scriptUrl: 'https://script.google.com/macros/s/AKfycbwsZBfYEHQBfW3xB_hbZvZRqdEpO7CIHvkSWeE4xJuttxZV82JUQQ0J9aN1O2XyCann/exec',
  sheetId: '',
  driveId: ''
};

export const storage = {
  // --- Session Management (Handles "Stay Logged In" feature) ---
  saveSession(user: AdminUser) {
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
  },

  getSession(): AdminUser | null {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSION);
    return stored ? JSON.parse(stored) : null;
  },

  clearSession() {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  },

  // --- Navigation & State Persistence (NEW) ---
  saveNavigation(view: ViewState, selectedClassroom: Classroom | null) {
    const state = { view, selectedClassroom };
    localStorage.setItem(STORAGE_KEYS.NAVIGATION, JSON.stringify(state));
  },

  getNavigation(): { view: ViewState, selectedClassroom: Classroom | null } | null {
    const stored = localStorage.getItem(STORAGE_KEYS.NAVIGATION);
    return stored ? JSON.parse(stored) : null;
  },

  clearNavigation() {
    localStorage.removeItem(STORAGE_KEYS.NAVIGATION);
    localStorage.removeItem(STORAGE_KEYS.DASHBOARD_TAB);
  },

  saveDashboardTab(tab: DashboardTab) {
    localStorage.setItem(STORAGE_KEYS.DASHBOARD_TAB, tab);
  },

  getDashboardTab(): DashboardTab | null {
    const stored = localStorage.getItem(STORAGE_KEYS.DASHBOARD_TAB);
    return stored ? (stored as DashboardTab) : null;
  },

  // --- Local User Helper (Bootstrap) ---
  validateLocalFallback(username: string, password: string): AdminUser | null {
     if (username === FALLBACK_ADMIN.username && password === FALLBACK_ADMIN.password) {
         return FALLBACK_ADMIN;
     }
     return null;
  },

  // --- System Configuration ---
  getConfig(): SystemConfig {
    const stored = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (!stored) {
        return DEFAULT_CONFIG;
    }
    
    try {
        const parsed = JSON.parse(stored);
        // If the stored URL is empty, fall back to the hardcoded default URL
        return {
            ...DEFAULT_CONFIG,
            ...parsed,
            scriptUrl: (parsed.scriptUrl && parsed.scriptUrl.trim() !== '') 
                ? parsed.scriptUrl 
                : DEFAULT_CONFIG.scriptUrl
        };
    } catch (e) {
        return DEFAULT_CONFIG;
    }
  },

  saveConfig(config: SystemConfig) {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  },

  // --- Activity Logs ---
  getLogs(): ActivityLog[] {
    const stored = localStorage.getItem(STORAGE_KEYS.LOGS);
    return stored ? JSON.parse(stored) : [];
  },

  addLog(user: AdminUser | null, action: string, details: string) {
    if (!user) return;
    
    const logs = this.getLogs();
    const newLog: ActivityLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action,
        details,
        timestamp: new Date().toISOString()
    };
    
    const updatedLogs = [newLog, ...logs].slice(0, 100);
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(updatedLogs));
  }
};
