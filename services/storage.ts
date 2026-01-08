
import { AdminUser, SystemConfig, ActivityLog } from '../types';

const STORAGE_KEYS = {
  CONFIG: 'APP_SYSTEM_CONFIG',
  LOGS: 'APP_ACTIVITY_LOGS',
  SESSION: 'APP_ACTIVE_SESSION' 
};

// Default admin for bootstrap/fallback ONLY
export const FALLBACK_ADMIN: AdminUser = {
  id: 'admin-001',
  username: 'Admin',
  password: '@Np123456',
  name: 'ผู้ดูแลระบบหลัก (Offline)',
  role: 'SUPER_ADMIN'
};

// Hardcoded default configuration as requested
const DEFAULT_CONFIG: SystemConfig = {
  scriptUrl: 'https://script.google.com/macros/s/AKfycbwHfcWid0yqs0C2q3nnspJqsBkDdGmH59R02ULSDOIbyPNcfoe_l8ngzelriJJpKdSq/exec',
  sheetId: '1ge8sumS3qX7lsw29cIoBQrsW5vNYI5yfr_BPveAiLmc',
  driveId: '142UYdJGFhP3TtJ_fSJA2WUW3E8iHTIWW'
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
