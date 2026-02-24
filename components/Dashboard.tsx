
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Student, RankedStudent, DashboardTab, StudyPlan, StreamType, ExamSubject, Classroom, AdminUser, AdmissionCriteria } from '../types';
import { rankStudents } from '../services/rankingService';
import StudentList from './StudentList';
import Analysis from './Analysis';
import SettingsPage from './SettingsPage';
import { LayoutDashboard, LogOut, Menu, X, User, Settings, ArrowLeft, Shield, Loader2, Lock, Eye, CheckCircle, BarChart3, Database, AlertTriangle, RefreshCw, XCircle } from 'lucide-react';
import api from '../services/api';
import { storage } from '../services/storage';

interface DashboardProps {
  classroom: Classroom;
  onBack: () => void;
  onLogout: () => void;
  currentUser: AdminUser | null;
}

const DEFAULT_PLANS: StudyPlan[] = [
    { id: '1', name: StreamType.SCI_MATH, quota: 10 },
    { id: '2', name: StreamType.ARTS_MATH, quota: 10 },
    { id: '3', name: StreamType.ARTS_LANG, quota: 10 },
    { id: '4', name: StreamType.ARTS_SOC, quota: 10 },
    { id: '5', name: StreamType.SPECIAL, quota: 10 },
];

const DEFAULT_SUBJECTS: ExamSubject[] = [
    { id: 'math', name: 'คณิต', maxScore: 100 },
    { id: 'science', name: 'วิทย์', maxScore: 100 },
    { id: 'thai', name: 'ไทย', maxScore: 100 },
    { id: 'english', name: 'อังกฤษ', maxScore: 100 },
    { id: 'social', name: 'สังคม', maxScore: 100 },
];

const DEFAULT_CRITERIA: AdmissionCriteria = {
    enableDistrictPriority: false
};

const Dashboard: React.FC<DashboardProps> = ({ classroom, onBack, onLogout, currentUser }) => {
  // Initialize activeTab from storage or default to 'LIST'
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => {
      return storage.getDashboardTab() || 'LIST';
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track last update locally to reflect changes immediately
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState<string | undefined>(classroom.updatedAt);
  // Track if a newer version is available on server
  const [updateAvailable, setUpdateAvailable] = useState(false);
  // Store the interval ID to clear it
  const pollingIntervalRef = useRef<number | null>(null);
  // Ignore next poll if I just saved data (to prevent false positive flag before my own data syncs)
  const ignoreNextPoll = useRef(false);

  // Data State
  const [students, setStudents] = useState<Student[]>([]);
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>(DEFAULT_PLANS);
  const [examSubjects, setExamSubjects] = useState<ExamSubject[]>(DEFAULT_SUBJECTS);
  const [admissionCriteria, setAdmissionCriteria] = useState<AdmissionCriteria>(DEFAULT_CRITERIA);

  // Role Checks
  const isViewer = currentUser?.role === 'VIEWER';

  // Save activeTab to storage whenever it changes
  useEffect(() => {
    storage.saveDashboardTab(activeTab);
  }, [activeTab]);

  // --- Data Loading ---
  useEffect(() => {
    loadData();
  }, [classroom.id]);

  // --- Polling Effect ---
  useEffect(() => {
    // Start Polling every 12 seconds
    const poll = async () => {
        if (!currentUpdatedAt) return;
        if (ignoreNextPoll.current) {
            ignoreNextPoll.current = false;
            return;
        }

        try {
            const serverTs = await api.getLastUpdate(classroom.id);
            if (serverTs && serverTs !== currentUpdatedAt) {
                 // Convert to dates to compare. 
                 const serverDate = new Date(serverTs).getTime();
                 const localDate = new Date(currentUpdatedAt).getTime();
                 
                 // If server is newer than what we have
                 if (serverDate > localDate) {
                     setUpdateAvailable(true);
                 }
            }
        } catch (e) {
            // Silently fail polling
        }
    };

    pollingIntervalRef.current = window.setInterval(poll, 12000); 

    return () => {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [classroom.id, currentUpdatedAt]);

  const loadData = async () => {
      setLoading(true);
      setError(null);
      setUpdateAvailable(false); // Clear banner on reload
      try {
          // Note: The API call needs to be updated to fetch CRITERIA as well.
          // Since the API sends generic 'getDashboardData', we need to check if we can piggyback or need another call.
          // For now, let's assume `getDashboardData` can return criteria if we modify api.ts, 
          // OR we fetch settings separately.
          // To keep it simple without changing `Code.gs` return structure too much, 
          // let's assume `api.getDashboardData` returns generic settings array or we handle it in `api.ts`.
          // *Correction*: api.ts `getDashboardData` returns specific fields. I'll need to fetch CRITERIA separately or rely on api.ts to handle it.
          // Since I can't modify Code.gs easily to return extra fields in one go without breaking things, 
          // I will assume standard settings loading.
          // Actually, `getDashboardData` in Code.gs returns plans and subjects. I'll rely on a separate fetch or generic fetch for criteria if needed.
          // BUT, to make this work seamlessly, I'll modify `api.ts` to include `criteria` in `getDashboardData` return, if possible.
          // Since I cannot modify `Code.gs` structure for `getDashboardData` easily (it parses specific keys),
          // I will use `api.getDashboardData` as base and maybe mock criteria or use default until fully implemented.
          // Wait, the prompt allows modifying all files. I will update `api.ts` to fetch criteria.
          
          const result = await api.getDashboardData(classroom.id);
          
          if (result.students) setStudents(result.students);
          if (result.plans) setStudyPlans(result.plans);
          if (result.subjects) setExamSubjects(result.subjects);
          if (result.criteria) setAdmissionCriteria(result.criteria); // Assuming I update api.ts
          if (result.updatedAt) setCurrentUpdatedAt(result.updatedAt);

      } catch (e: any) {
          console.error("Failed to load dashboard data", e);
          setError(e.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
          setLoading(false);
      }
  };
  
  const refreshTimestamp = () => {
      // When we save, we set current time.
      const now = new Date().toISOString();
      setCurrentUpdatedAt(now);
      // We also tell polling to ignore next check, because the server might technically correspond to THIS save
      // or take a second to reflect.
      ignoreNextPoll.current = true;
  };

  const handleManualRefresh = () => {
      loadData();
  };

  const handleDismissUpdate = () => {
      setUpdateAvailable(false);
  };

  // --- Handlers ---
  const handleAddStudents = async (newStudents: Student[]) => {
      if (isViewer) return;

      const updatedList = [...students];
      newStudents.forEach(newStu => {
          const index = updatedList.findIndex(s => s.id === newStu.id);
          if (index !== -1) updatedList[index] = newStu;
          else updatedList.push(newStu);
      });
      
      setStudents(updatedList);
      
      try {
          await api.saveStudents(classroom.id, newStudents);
          storage.addLog(currentUser, 'ADD_STUDENTS', `Added ${newStudents.length} students to ${classroom.name}`);
          refreshTimestamp();
      } catch (e) {
          alert('บันทึกข้อมูลไม่สำเร็จ');
      }
  };

  const handleEditStudent = async (updatedStudent: Student, originalId?: string) => {
      if (isViewer) return;

      const updatedList = students.map(s => s.id === (originalId || updatedStudent.id) ? updatedStudent : s);
      setStudents(updatedList);
      
      try {
          if (originalId && originalId !== updatedStudent.id) {
              await api.deleteStudent(classroom.id, originalId);
          }
          await api.saveStudent(classroom.id, updatedStudent);
          storage.addLog(currentUser, 'EDIT_STUDENT', `Edited student: ${updatedStudent.id}`);
          refreshTimestamp();
      } catch (e) {
          alert('บันทึกการแก้ไขไม่สำเร็จ');
      }
  };

  const handleDeleteStudent = async (id: string) => {
      if (isViewer) return;

      const target = students.find(s => s.id === id);
      const updatedList = students.filter(s => s.id !== id);
      setStudents(updatedList);

      try {
          await api.deleteStudent(classroom.id, id);
          storage.addLog(currentUser, 'DELETE_STUDENT', `Deleted student: ${id} (${target?.firstName})`);
          refreshTimestamp();
      } catch (e) {
          alert('ลบข้อมูลไม่สำเร็จ');
      }
  };

  const handleDeleteStudents = async (ids: string[]) => {
      if (isViewer) return;

      const updatedList = students.filter(s => !ids.includes(s.id));
      setStudents(updatedList);

      try {
          await api.deleteStudents(classroom.id, ids);
          storage.addLog(currentUser, 'DELETE_STUDENTS', `Deleted ${ids.length} students`);
          refreshTimestamp();
      } catch (e) {
          alert('ลบข้อมูลหลายรายการไม่สำเร็จ');
          // Revert on error? Ideally yes, but for now simple alert.
          loadData(); // Reload to sync
      }
  };

  const handleUpdatePlans = async (newPlans: StudyPlan[]) => {
      if (isViewer) return;
      setStudyPlans(newPlans);
      await api.saveSettings(classroom.id, 'PLANS', newPlans);
      storage.addLog(currentUser, 'UPDATE_PLANS', `Updated study plans for ${classroom.name}`);
      refreshTimestamp();
  };

  const handleUpdateSubjects = async (newSubjects: ExamSubject[]) => {
      if (isViewer) return;
      setExamSubjects(newSubjects);
      await api.saveSettings(classroom.id, 'SUBJECTS', newSubjects);
      storage.addLog(currentUser, 'UPDATE_SUBJECTS', `Updated exam subjects for ${classroom.name}`);
      refreshTimestamp();
  };

  const handleUpdateCriteria = async (newCriteria: AdmissionCriteria) => {
      if (isViewer) return;
      setAdmissionCriteria(newCriteria);
      await api.saveSettings(classroom.id, 'CRITERIA', [newCriteria]); // API expects array for generic setting
      storage.addLog(currentUser, 'UPDATE_CRITERIA', `Updated admission criteria for ${classroom.name}`);
      refreshTimestamp();
  };

  const handleResetData = async () => {
      if (isViewer) return;
      
      // Optimistic update
      const previousStudents = [...students];
      setStudents([]);
      
      try {
          // Get all IDs to delete
          const allIds = previousStudents.map(s => s.id);
          
          if (allIds.length > 0) {
              await api.deleteStudents(classroom.id, allIds);
              storage.addLog(currentUser, 'RESET_DATA', `Reset all student data for ${classroom.name}`);
              refreshTimestamp();
              alert('ลบข้อมูลนักเรียนทั้งหมดจากฐานข้อมูลเรียบร้อยแล้ว');
          } else {
              // No students to delete, just log
              storage.addLog(currentUser, 'RESET_DATA', `Reset empty student data for ${classroom.name}`);
          }
      } catch (e) {
          console.error("Failed to reset data", e);
          // Revert optimistic update on error
          setStudents(previousStudents);
          alert('เกิดข้อผิดพลาดในการลบข้อมูลจากฐานข้อมูล กรุณาลองใหม่อีกครั้ง');
      }
  };

  // --- Ranking Logic ---
  const rankedStudents: RankedStudent[] = useMemo(() => {
    return rankStudents(students, studyPlans, examSubjects, admissionCriteria.enableDistrictPriority, admissionCriteria.enableQuota);
  }, [students, studyPlans, examSubjects, admissionCriteria]);

  // Determine if we should show full screen loader or inline loader
  // If we have data, we show inline refresh (keep showing data). If no data, full screen loader.
  const showFullScreenLoader = loading && students.length === 0;

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col md:flex-row font-sans print:block print:bg-white print:h-auto">
      
      {/* Update Notification Banner */}
      {updateAvailable && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] animate-in slide-in-from-top-2 fade-in duration-300 w-full max-w-lg px-4 no-print">
              <div className="bg-white/90 backdrop-blur-md border border-blue-200 shadow-2xl rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 animate-pulse">
                          <RefreshCw className="w-5 h-5" />
                      </div>
                      <div>
                          <p className="text-sm font-bold text-gray-900">ข้อมูลมีการเปลี่ยนแปลง</p>
                          <p className="text-xs text-gray-500">พบการอัปเดตจากผู้ใช้อื่นในระบบ</p>
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
                      <button 
                        onClick={handleManualRefresh}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-lg shadow-blue-200"
                      >
                          รีเฟรชข้อมูล
                      </button>
                      <button 
                        onClick={handleDismissUpdate}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                      >
                          <XCircle className="w-5 h-5" />
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Mobile Header */}
      <div className="md:hidden bg-white/80 backdrop-blur-md p-4 flex items-center justify-between border-b border-gray-200 sticky top-0 z-30 no-print">
        <div className="flex items-center gap-3 overflow-hidden">
            <button onClick={onBack} className="p-2 -ml-2 text-gray-500 hover:text-black">
                <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="truncate">
                <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">กำลังจัดการ</span>
                <span className="block text-sm font-bold text-gray-900 truncate">{classroom.name}</span>
            </div>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-[#1D1D1F] text-white transform transition-transform duration-300 ease-in-out flex flex-col no-print
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0
      `}>
        {/* Brand Area */}
        <div className="p-6 md:p-8">
            <h1 className="text-xl font-bold tracking-tight">ระบบคัดเลือกนักเรียน</h1>
            <p className="text-xs text-gray-400 font-medium">โรงเรียนหนองกี่พิทยาคม</p>
            
            {/* Current Dataset Info */}
            <div className="mt-8 pt-6 border-t border-white/10">
                <div className="flex items-start gap-3">
                    <Database className="w-5 h-5 text-gray-500 mt-0.5" />
                    <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 font-bold">ชุดข้อมูลปัจจุบัน</p>
                        <p className="text-sm font-bold text-white leading-snug">{classroom.name}</p>
                        <p className="text-[10px] text-gray-500 mt-1">ปีการศึกษา {classroom.academicYear}</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          <button 
            onClick={() => { setActiveTab('LIST'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${
              activeTab === 'LIST' ? 'bg-white text-black shadow-lg shadow-black/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <CheckCircle className="w-5 h-5" />
            <span>ผลการคัดเลือก</span>
          </button>
          
          <button 
            onClick={() => { setActiveTab('ANALYSIS'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${
              activeTab === 'ANALYSIS' ? 'bg-white text-black shadow-lg shadow-black/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span>สรุปและวิเคราะห์ผล</span>
          </button>
          
          {!isViewer && (
              <button 
                onClick={() => { setActiveTab('SETTINGS'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  activeTab === 'SETTINGS' ? 'bg-white text-black shadow-lg shadow-black/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Settings className="w-5 h-5" />
                <span>ตั้งค่าเกณฑ์การรับ</span>
              </button>
          )}
        </nav>

        {/* Footer Actions & Profile */}
        <div className="p-4 border-t border-white/10 space-y-4">
           
           {/* User Profile Snippet */}
           <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-inner ${isViewer ? 'bg-gray-500' : 'bg-gradient-to-tr from-emerald-500 to-teal-600'}`}>
                    {isViewer ? <Eye className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                <div className="overflow-hidden">
                    <p className="text-sm font-bold text-white truncate">{currentUser?.name}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">{currentUser?.role}</p>
                </div>
            </div>

            <div className="space-y-2">
               <button 
                  onClick={onBack}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-gray-400 hover:bg-white/5 hover:text-white transition-all"
               >
                  <ArrowLeft className="w-5 h-5" />
                  <span>กลับหน้าหลัก</span>
               </button>
               <button 
                  onClick={onLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all"
               >
                  <LogOut className="w-5 h-5" />
                  <span>ออกจากระบบ</span>
               </button>
            </div>
            
            <div className="pt-2 text-center pb-2">
                 <p className="text-[10px] text-gray-500">พัฒนาโดย Thanit Lab</p>
                 <p className="text-[9px] text-gray-600 mt-0.5">Nongkipittayakom Student Selection System (NPSSS) V 1.3</p>
            </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-[calc(100vh-64px)] md:h-screen overflow-hidden relative print:h-auto print:overflow-visible print:block">
        <div className="flex-1 overflow-y-auto p-6 md:p-10 scroll-smooth print:overflow-visible print:h-auto print:p-0">
          <div className="w-full max-w-[1920px] mx-auto min-h-full pb-20 print:pb-0">
            {showFullScreenLoader ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 animate-pulse no-print">
                    <Loader2 className="w-12 h-12 animate-spin mb-4" />
                    <span className="font-bold">กำลังโหลดข้อมูล...</span>
                </div>
            ) : error ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 no-print py-20">
                    <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
                    <span className="font-bold text-lg text-gray-600 mb-2">เกิดข้อผิดพลาด</span>
                    <span className="text-sm text-red-500 mb-6">{error}</span>
                    <button 
                        onClick={handleManualRefresh}
                        className="px-6 py-2 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors"
                    >
                        ลองใหม่อีกครั้ง
                    </button>
                </div>
            ) : (
                <>
                    {activeTab === 'LIST' && (
                        <div className="animate-fade-in print-container">
                            <StudentList 
                                students={rankedStudents}
                                studyPlans={studyPlans}
                                subjects={examSubjects}
                                criteria={admissionCriteria}
                                onAddStudents={handleAddStudents}
                                onEditStudent={handleEditStudent}
                                onDeleteStudent={handleDeleteStudent}
                                onDeleteStudents={handleDeleteStudents}
                                level={classroom.level}
                                academicYear={classroom.academicYear}
                                readOnly={isViewer}
                                updatedAt={currentUpdatedAt}
                                onRefresh={handleManualRefresh}
                                isRefreshing={loading}
                            />
                        </div>
                    )}
                    
                    {activeTab === 'ANALYSIS' && (
                        <Analysis 
                            students={rankedStudents}
                            plans={studyPlans}
                            subjects={examSubjects}
                            level={classroom.level}
                            academicYear={classroom.academicYear}
                        />
                    )}
                    
                    {activeTab === 'SETTINGS' && !isViewer && (
                        <div className="animate-fade-in">
                             <div className="mb-8">
                                <h2 className="text-3xl font-bold text-gray-900">ตั้งค่าเกณฑ์การรับ</h2>
                                <p className="text-gray-500 mt-2">กำหนดแผนการเรียน วิชาที่สอบ และสัดส่วนคะแนน</p>
                             </div>
                             <SettingsPage 
                                plans={studyPlans}
                                subjects={examSubjects}
                                criteria={admissionCriteria}
                                onUpdatePlans={handleUpdatePlans}
                                onUpdateSubjects={handleUpdateSubjects}
                                onUpdateCriteria={handleUpdateCriteria}
                                onResetData={handleResetData}
                             />
                        </div>
                    )}
                </>
            )}
          </div>
        </div>
      </main>
      
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden no-print"
            onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;
