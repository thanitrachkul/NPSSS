
import { Classroom, Student, StudyPlan, ExamSubject, AdminUser, AdmissionCriteria } from '../types';
import { storage } from './storage';

const getApiUrl = () => {
    const config = storage.getConfig();
    return config.scriptUrl;
};

// Unified POST Request Handler
const sendPostRequest = async (action: string, data: any = {}) => {
    const config = storage.getConfig();
    const API_URL = config.scriptUrl ? config.scriptUrl.trim() : '';
    
    // Improved Validation: Just check if empty or is a placeholder text
    if (!API_URL || API_URL.includes('วาง_URL') || API_URL === '') {
        throw new Error('ไม่พบ Web App URL กรุณาตั้งค่าในเมนู System Admin');
    }

    const separator = API_URL.includes('?') ? '&' : '?';
    const url = `${API_URL}${separator}action=${action}`;

    const payload = {
        ...data,
        action,
        sheetId: config.sheetId ? config.sheetId.trim() : ''
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            redirect: 'follow',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8', 
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }
        
        const jsonResponse = await response.json();
        
        if (jsonResponse.status === 'error') {
            throw new Error(jsonResponse.message || 'Unknown server error');
        }

        return jsonResponse;
    } catch (error: any) {
        // Suppress console error for background polling to reduce noise
        if (action !== 'getClassroomTimestamp' && action !== 'getOnlineUsers' && action !== 'heartbeat') {
            console.error(`API Error (${action}):`, error);
        }
        
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
            throw new Error('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ (Network Error) กรุณาตรวจสอบ URL หรือการเชื่อมต่ออินเทอร์เน็ต');
        }
        throw error;
    }
};

const api = {
  async getClassrooms(): Promise<Classroom[]> {
    try {
      const result = await sendPostRequest('getClassrooms');
      return Array.isArray(result?.data) ? result.data : [];
    } catch (error) {
      console.warn('Error fetching classrooms:', error);
      throw error;
    }
  },

  async saveClassroom(classroom: Classroom): Promise<void> {
    await sendPostRequest('saveClassroom', classroom);
  },

  async deleteClassroom(id: string): Promise<void> {
    await sendPostRequest('deleteClassroom', { id });
  },

  async getDashboardData(classroomId: string): Promise<{ students: Student[], plans: StudyPlan[] | null, subjects: ExamSubject[] | null, criteria: AdmissionCriteria | null, updatedAt?: string }> {
    try {
      const result = await sendPostRequest('getDashboardData', { classroomId });
      
      return { 
          students: Array.isArray(result?.students) ? result.students : [], 
          plans: Array.isArray(result?.plans) ? result.plans : null, 
          subjects: Array.isArray(result?.subjects) ? result.subjects : null,
          criteria: result.criteria || null, 
          updatedAt: result.updatedAt
      };
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw error;
    }
  },

  // NEW: Lightweight polling function
  async getLastUpdate(classroomId: string): Promise<string | null> {
    try {
        const result = await sendPostRequest('getClassroomTimestamp', { classroomId });
        return result.updatedAt;
    } catch (error) {
        // Silently fail for polling
        return null; 
    }
  },

  async saveStudent(classroomId: string, student: Student): Promise<void> {
    await sendPostRequest('saveStudent', {
        classroomId,
        student
    });
  },

  async saveStudents(classroomId: string, students: Student[]): Promise<void> {
    await sendPostRequest('saveStudents', {
        classroomId,
        students
    });
  },

  async deleteStudent(classroomId: string, studentId: string): Promise<void> {
    await sendPostRequest('deleteStudent', {
        classroomId,
        studentId
    });
  },

  async deleteStudents(classroomId: string, studentIds: string[]): Promise<void> {
    await sendPostRequest('deleteStudents', {
        classroomId,
        studentIds
    });
  },

  async saveSettings(classroomId: string, type: 'PLANS' | 'SUBJECTS' | 'CRITERIA', data: any[]): Promise<void> {
    await sendPostRequest('saveSettings', {
        classroomId,
        type,
        data
    });
  },

  async setupDatabase(): Promise<void> {
    await sendPostRequest('setup');
  },

  // --- User Management APIs ---
  
  async getUsers(): Promise<AdminUser[]> {
    try {
      const result = await sendPostRequest('getUsers');
      return Array.isArray(result?.data) ? result.data : [];
    } catch (error) {
      console.warn('Error fetching users:', error);
      throw error;
    }
  },

  // New: Heartbeat to tell server I'm alive
  async heartbeat(userId: string): Promise<void> {
    try {
        await sendPostRequest('heartbeat', { userId });
    } catch (error) {
        // Silently fail, it's just a heartbeat
    }
  },

  // New: Get list of active users
  async getOnlineUsers(): Promise<AdminUser[]> {
    try {
        const result = await sendPostRequest('getOnlineUsers');
        return Array.isArray(result?.data) ? result.data : [];
    } catch (error) {
        // Silently fail
        return [];
    }
  },

  async saveUser(user: AdminUser): Promise<void> {
    await sendPostRequest('saveUser', { user });
  },

  async deleteUser(userId: string): Promise<void> {
    await sendPostRequest('deleteUser', { userId });
  },

  async login(username: string, password: string): Promise<AdminUser> {
    const result = await sendPostRequest('login', { username, password });
    if (!result.user) {
        throw new Error('Invalid response from server');
    }
    return result.user;
  }
};

export default api;
