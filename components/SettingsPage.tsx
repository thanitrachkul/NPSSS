
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { StudyPlan, ExamSubject, AdmissionCriteria } from '../types';
import Button from './Button';
import { Plus, Trash2, Save, Info, Pencil, X, AlertTriangle, Loader2, MapPin, Lock, Check } from 'lucide-react';

interface SettingsPageProps {
  plans: StudyPlan[];
  subjects: ExamSubject[];
  criteria?: AdmissionCriteria;
  onUpdatePlans: (plans: StudyPlan[]) => void;
  onUpdateSubjects: (subjects: ExamSubject[]) => void;
  onUpdateCriteria: (criteria: AdmissionCriteria) => void;
  onResetData: () => void;
}

type EditMode = 'NONE' | 'PLANS' | 'SUBJECTS';

const SettingsPage: React.FC<SettingsPageProps> = ({ 
    plans, 
    subjects, 
    criteria, 
    onUpdatePlans, 
    onUpdateSubjects, 
    onUpdateCriteria,
    onResetData 
}) => {
  const [editMode, setEditMode] = useState<EditMode>('NONE');
  
  // Temporary state for editing
  const [tempPlans, setTempPlans] = useState<StudyPlan[]>([]);
  const [tempSubjects, setTempSubjects] = useState<ExamSubject[]>([]);
  
  // Criteria State - Default to FALSE (OFF)
  const [enableDistrictPriority, setEnableDistrictPriority] = useState(false);
  const [enableQuota, setEnableQuota] = useState(false);

  // Confirmation state
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Pending Toggle State
  const [pendingDistrictToggle, setPendingDistrictToggle] = useState<boolean | null>(null);
  const [pendingQuotaToggle, setPendingQuotaToggle] = useState<boolean | null>(null);
  
  // Focus ref for confirmation input
  const confirmInputRef = useRef<HTMLInputElement>(null);

  // Calculations
  const viewTotalMaxScore = useMemo(() => subjects.reduce((sum, s) => sum + s.maxScore, 0), [subjects]);
  const tempTotalMaxScore = useMemo(() => tempSubjects.reduce((sum, s) => sum + s.maxScore, 0), [tempSubjects]);

  // Sync prop to local state
  useEffect(() => {
      // FIX: Respect the saved state from database (props). 
      // Only default to false if criteria is undefined (new data).
      if (criteria) {
          setEnableDistrictPriority(criteria.enableDistrictPriority);
          setEnableQuota(!!criteria.enableQuota);
      }
  }, [criteria]);

  // Auto-focus input when modal opens
  useEffect(() => {
      if (showConfirm && confirmInputRef.current) {
          setTimeout(() => {
              confirmInputRef.current?.focus();
          }, 100);
      }
  }, [showConfirm]);

  // Initialize temp state when opening modal
  const handleOpenEditPlans = () => {
    setTempPlans(JSON.parse(JSON.stringify(plans)));
    setEditMode('PLANS');
  };

  const handleOpenEditSubjects = () => {
    setTempSubjects(JSON.parse(JSON.stringify(subjects)));
    setEditMode('SUBJECTS');
  };

  const handleClose = () => {
    setEditMode('NONE');
    setShowConfirm(false);
    setDeleteConfirmation('');
    setPendingDistrictToggle(null);
    setPendingQuotaToggle(null);
  };

  const handleRequestSave = () => {
    setDeleteConfirmation('');
    setShowConfirm(true);
  };
  
  // Logic to handle toggling the district priority switch
  const handleToggleDistrict = () => {
      const targetState = !enableDistrictPriority;
      setPendingDistrictToggle(targetState);
      setDeleteConfirmation(''); // Reset confirmation text
      setShowConfirm(true); // Open confirmation immediately
  };

  const handleToggleQuota = () => {
      const targetState = !enableQuota;
      setPendingQuotaToggle(targetState);
      setDeleteConfirmation('');
      setShowConfirm(true);
  };

  const handleConfirmSave = async () => {
    // Check for strict delete confirmation
    if (deleteConfirmation !== 'delete') {
        return;
    }

    setIsSaving(true);
    try {
        // CASE 1: Toggling District Priority Mode
        if (pendingDistrictToggle !== null) {
             const newMode = pendingDistrictToggle;
             
             // 1. Update Criteria
             await onUpdateCriteria({ 
                 enableDistrictPriority: newMode,
                 enableQuota: enableQuota
             });
             setEnableDistrictPriority(newMode);

             // 2. Logic: If turning ON -> Force Single Plan 'ปกติ'
             if (newMode === true) {
                 const totalQuota = plans.reduce((acc, p) => acc + p.quota, 0) || 100;
                 const singlePlan: StudyPlan[] = [{
                     id: `PLAN-${Date.now()}`,
                     name: 'ปกติ',
                     quota: totalQuota
                 }];
                 await onUpdatePlans(singlePlan);
             } 
             // If turning OFF -> We leave the plans as is

             // 3. Reset Data (Required because rules changed)
             onResetData();
        } 
        // CASE 2: Toggling Quota Mode
        else if (pendingQuotaToggle !== null) {
             const newMode = pendingQuotaToggle;
             
             // 1. Update Criteria
             await onUpdateCriteria({ 
                 enableDistrictPriority: enableDistrictPriority,
                 enableQuota: newMode
             });
             setEnableQuota(newMode);

             // 2. Logic: If turning ON -> Force Single Plan 'ห้องเรียนพิเศษ'
             if (newMode === true) {
                const totalQuota = plans.reduce((acc, p) => acc + p.quota, 0) || 36;
                const singlePlan: StudyPlan[] = [{
                    id: `PLAN-${Date.now()}`,
                    name: 'ห้องเรียนพิเศษ',
                    quota: totalQuota
                }];
                await onUpdatePlans(singlePlan);
            }

             // 3. Reset Data
             onResetData();
        }
        // CASE 3: Normal Editing (Plans/Subjects)
        else {
            if (editMode === 'PLANS') {
                await onUpdatePlans(tempPlans);
            } else if (editMode === 'SUBJECTS') {
                await onUpdateSubjects(tempSubjects);
            }
            // Clear all student data
            onResetData();
        }

        handleClose();
    } catch (err) {
        alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
        setIsSaving(false);
    }
  };

  // --- Handlers for Temp Plans ---
  const handleAddTempPlan = () => {
    if (enableDistrictPriority || enableQuota) return; // Prevent adding if restricted
    const newId = `PLAN-${Date.now()}`;
    setTempPlans([...tempPlans, { id: newId, name: 'แผนการเรียนใหม่', quota: 10 }]);
  };

  const handleChangeTempPlan = (id: string, field: keyof StudyPlan, value: string | number) => {
    setTempPlans(tempPlans.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleDeleteTempPlan = (id: string) => {
    if (enableDistrictPriority || enableQuota) return; // Prevent deleting if restricted
    setTempPlans(tempPlans.filter(p => p.id !== id));
  };

  // --- Handlers for Temp Subjects ---
  const handleAddTempSubject = () => {
    const newId = `SUBJ-${Date.now()}`;
    setTempSubjects([...tempSubjects, { id: newId, name: 'วิชาใหม่', maxScore: 100 }]);
  };

  const handleChangeTempSubject = (id: string, field: keyof ExamSubject, value: string | number) => {
    setTempSubjects(tempSubjects.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleDeleteTempSubject = (id: string) => {
    setTempSubjects(tempSubjects.filter(s => s.id !== id));
  };

  return (
    <div className="space-y-10 animate-fade-in relative pb-20">
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-6">
        
        {/* Part 1: Study Plans (View Mode) */}
        <div className="space-y-5">
             <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">1</span>
                    ข้อมูลแผนการเรียน
                </h3>
                <Button size="sm" variant="outline" onClick={handleOpenEditPlans} className="text-sm">
                    <Pencil className="w-4 h-4 mr-2" /> แก้ไขแผนการเรียน
                </Button>
             </div>
             <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase">ลำดับ</th>
                            <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase">ชื่อแผนการเรียน</th>
                            <th className="px-5 py-4 text-center text-xs font-bold text-gray-500 uppercase w-28">จำนวนรับ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {plans.map((plan, index) => (
                            <tr key={plan.id} className="hover:bg-gray-50/50">
                                <td className="px-5 py-4 text-base text-gray-400 font-medium">{index + 1}</td>
                                <td className="px-5 py-4 text-base font-medium text-gray-900">{plan.name}</td>
                                <td className="px-5 py-4 text-center">
                                     <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                        {plan.quota}
                                     </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
             <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-sm text-blue-700 flex gap-3">
                <Info className="w-5 h-5 flex-shrink-0" />
                <p>จำนวนรับรวมทั้งหมด: <span className="font-bold">{plans.reduce((acc, p) => acc + p.quota, 0)}</span> ที่นั่ง</p>
             </div>
        </div>

        {/* Part 2: Subjects (View Mode) */}
        <div className="space-y-5">
             <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-bold">2</span>
                    วิชาที่สอบและเกณฑ์คะแนน
                </h3>
                 <Button size="sm" variant="outline" onClick={handleOpenEditSubjects} className="text-sm">
                    <Pencil className="w-4 h-4 mr-2" /> แก้ไขรายวิชา
                 </Button>
             </div>
             <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase">วิชา</th>
                            <th className="px-5 py-4 text-center text-xs font-bold text-gray-500 uppercase w-36">คะแนนเต็ม</th>
                            <th className="px-5 py-4 text-right text-xs font-bold text-gray-500 uppercase w-20">ลบ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {subjects.map((subj) => (
                            <tr key={subj.id} className="hover:bg-gray-50/50">
                                <td className="px-5 py-4 text-base font-medium text-gray-900">{subj.name}</td>
                                <td className="px-5 py-4 text-center text-base text-gray-600">{subj.maxScore}</td>
                                <td className="px-5 py-4 text-right text-base text-gray-500">
                                    {viewTotalMaxScore > 0 ? ((subj.maxScore / viewTotalMaxScore) * 100).toFixed(0) : 0}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                        <tr>
                            <td className="px-5 py-4 text-base font-bold text-gray-900 text-right">คะแนนรวมเต็ม</td>
                            <td className="px-5 py-4 text-base font-bold text-gray-900 text-center bg-green-50 text-green-700 rounded-lg mx-2">{viewTotalMaxScore}</td>
                            <td className="px-5 py-4 text-right text-base font-bold text-gray-900">100%</td>
                        </tr>
                    </tfoot>
                </table>
             </div>
             <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 text-sm text-orange-800">
                <p className="flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5" />
                    <span>ลำดับของวิชาในตาราง จะถูกใช้เป็นเกณฑ์ตัดสิน (Tie-Breaker) หากคะแนนรวมเท่ากัน โดยวิชาที่อยู่บนสุดจะมีความสำคัญสูงสุด</span>
                </p>
             </div>
        </div>

      </div>

      {/* Part 3: Admission Rules */}
      <div className="mt-10">
           <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-bold">3</span>
                        การคัดเลือกตามเขตพื้นที่ (District Priority)
                </h3>
           </div>
           
           <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col md:flex-row gap-8 items-start shadow-sm">
              <div className="flex-1">
                  <div className="flex items-center gap-4 mb-6 select-none relative z-10">
                      <div className={`p-3 rounded-2xl transition-colors duration-300 ${enableDistrictPriority ? 'bg-purple-500 text-white shadow-lg shadow-purple-200' : 'bg-gray-100 text-gray-400'}`}>
                          <MapPin className="w-8 h-8" />
                      </div>
                      
                      {/* FIXED TOGGLE BUTTON - REAL BUTTON ELEMENT */}
                      <button 
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleToggleDistrict();
                        }} 
                        className="flex-1 flex items-center gap-4 cursor-pointer group p-2 -ml-2 rounded-xl hover:bg-gray-50 transition-colors select-none text-left focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      >
                           {/* Switch Track */}
                           <div className={`w-16 h-9 rounded-full relative transition-colors duration-300 flex-shrink-0 ${enableDistrictPriority ? 'bg-purple-600' : 'bg-gray-300'}`}>
                                {/* Switch Thumb */}
                                <div className={`absolute top-1 left-1 w-7 h-7 rounded-full bg-white shadow-sm transition-transform duration-300 ${enableDistrictPriority ? 'translate-x-7' : 'translate-x-0'}`} />
                           </div>
                           
                           <div className="flex flex-col">
                                <span className={`text-lg font-bold transition-colors ${enableDistrictPriority ? 'text-purple-700' : 'text-gray-500'}`}>
                                    {enableDistrictPriority ? 'เปิดใช้งาน: ระบบโควตาในเขตพื้นที่ (สำหรับ ม.1)' : 'ปิดใช้งาน (โหมดปกติ)'}
                                </span>
                                <span className="text-xs text-gray-400 font-medium group-hover:text-gray-600">
                                    คลิกเพื่อ{enableDistrictPriority ? 'ปิด' : 'เปิด'}ใช้งาน
                                </span>
                           </div>
                      </button>
                  </div>
                  
                  <div className="space-y-3 text-sm text-gray-600 pl-4 border-l-2 border-gray-100 ml-4">
                      <p className={`flex items-start gap-3 transition-opacity duration-300 ${enableDistrictPriority ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                          <span className="font-bold bg-black text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">1</span>
                          <span>ระบบจะปรับแผนการเรียนเป็น <strong>"ปกติ" (1 แผน)</strong> โดยอัตโนมัติ</span>
                      </p>
                      <p className={`flex items-start gap-3 transition-opacity duration-300 ${enableDistrictPriority ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                          <span className="font-bold bg-black text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">2</span>
                          <span>ระบบจะจัดสรรที่นั่งให้นักเรียน <strong>"ในเขตพื้นที่"</strong> ก่อนจนครบโควตาหรือหมดจำนวนผู้สมัคร</span>
                      </p>
                      <p className={`flex items-start gap-3 transition-opacity duration-300 ${enableDistrictPriority ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                          <span className="font-bold bg-black text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">3</span>
                          <span>ที่นั่งที่เหลือจะถูกนำมาจัดสรรให้นักเรียน <strong>"นอกเขตพื้นที่"</strong> โดยอัตโนมัติ</span>
                      </p>
                  </div>
              </div>
              
              <div className="w-full md:w-1/3 bg-gray-50 rounded-xl p-5 border border-gray-100 text-sm">
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" /> คำเตือน
                  </h4>
                  <p className="text-gray-500 leading-relaxed mb-3">
                      การเปิด/ปิด ฟังก์ชันนี้ จะทำให้ <strong>ข้อมูลนักเรียนทั้งหมดถูกลบ</strong> และแผนการเรียนจะถูกรีเซต
                  </p>
                  <p className="text-gray-500 leading-relaxed">
                      เหมาะสำหรับการรับนักเรียนระดับชั้น ม.1 ที่มีแผนการเรียนเดียว
                  </p>
              </div>
           </div>

           {/* Part 4: Quota System (New) */}
           <div className="flex items-center justify-between mb-5 mt-10">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center text-sm font-bold">4</span>
                        ระบบสำรองที่นั่ง (Quota Reservation)
                </h3>
           </div>
           
           <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col md:flex-row gap-8 items-start shadow-sm">
              <div className="flex-1">
                  <div className="flex items-center gap-4 mb-6 select-none relative z-10">
                      <div className={`p-3 rounded-2xl transition-colors duration-300 ${enableQuota ? 'bg-pink-500 text-white shadow-lg shadow-pink-200' : 'bg-gray-100 text-gray-400'}`}>
                          <Check className="w-8 h-8" />
                      </div>
                      
                      <button 
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleToggleQuota();
                        }} 
                        className="flex-1 flex items-center gap-4 cursor-pointer group p-2 -ml-2 rounded-xl hover:bg-gray-50 transition-colors select-none text-left focus:outline-none focus:ring-2 focus:ring-pink-500/20"
                      >
                           {/* Switch Track */}
                           <div className={`w-16 h-9 rounded-full relative transition-colors duration-300 flex-shrink-0 ${enableQuota ? 'bg-pink-600' : 'bg-gray-300'}`}>
                                {/* Switch Thumb */}
                                <div className={`absolute top-1 left-1 w-7 h-7 rounded-full bg-white shadow-sm transition-transform duration-300 ${enableQuota ? 'translate-x-7' : 'translate-x-0'}`} />
                           </div>
                           
                           <div className="flex flex-col">
                                <span className={`text-lg font-bold transition-colors ${enableQuota ? 'text-pink-700' : 'text-gray-500'}`}>
                                    {enableQuota ? 'เปิดใช้งาน: ระบบสำรองที่นั่ง (Quota)' : 'ปิดใช้งาน'}
                                </span>
                                <span className="text-xs text-gray-400 font-medium group-hover:text-gray-600">
                                    คลิกเพื่อ{enableQuota ? 'ปิด' : 'เปิด'}ใช้งาน
                                </span>
                           </div>
                      </button>
                  </div>
                  
                  <div className="space-y-3 text-sm text-gray-600 pl-4 border-l-2 border-gray-100 ml-4">
                      <p className={`flex items-start gap-3 transition-opacity duration-300 ${enableQuota ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                          <span className="font-bold bg-black text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">1</span>
                          <span>ระบบจะปรับแผนการเรียนเป็น <strong>"ห้องเรียนพิเศษ" (1 แผน)</strong> โดยอัตโนมัติ</span>
                      </p>
                      <p className={`flex items-start gap-3 transition-opacity duration-300 ${enableQuota ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                          <span className="font-bold bg-black text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">2</span>
                          <span>ระบบจะจัดสรรที่นั่งให้นักเรียนกลุ่ม <strong>"โควตา"</strong> เป็นลำดับแรก (เรียงตามคะแนน)</span>
                      </p>
                      <p className={`flex items-start gap-3 transition-opacity duration-300 ${enableQuota ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                          <span className="font-bold bg-black text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">3</span>
                          <span>หลังจากนั้นจะจัดสรรที่นั่งให้นักเรียนกลุ่ม <strong>"ปกติ"</strong> ตามลำดับคะแนน</span>
                      </p>
                  </div>
              </div>
              
              <div className="w-full md:w-1/3 bg-gray-50 rounded-xl p-5 border border-gray-100 text-sm">
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" /> คำเตือน
                  </h4>
                  <p className="text-gray-500 leading-relaxed mb-3">
                      การเปิด/ปิด ฟังก์ชันนี้ จะทำให้ <strong>ข้อมูลนักเรียนทั้งหมดถูกลบ</strong> เพื่อป้องกันความผิดพลาดในการจัดลำดับ
                  </p>
              </div>
           </div>
      </div>

      {/* --- STANDALONE CONFIRMATION MODAL (For Toggle) --- */}
      {showConfirm && editMode === 'NONE' && createPortal(
         <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-all" onClick={() => setShowConfirm(false)}></div>
             
             <div className="bg-white border border-gray-100 shadow-2xl rounded-2xl p-8 max-w-sm text-center transform scale-100 animate-in fade-in zoom-in duration-200 relative z-10">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                     {isSaving ? <Loader2 className="w-8 h-8 text-red-600 animate-spin" /> : <AlertTriangle className="w-8 h-8 text-red-600" />}
                  </div>
                  <h4 className="text-xl font-bold text-gray-900 mb-3">คำเตือน: การกระทำนี้จะล้างข้อมูล</h4>
                  <p className="text-base text-gray-500 mb-6 leading-relaxed">
                     <span>การเปลี่ยนโหมดเขตพื้นที่ จะทำให้ <span className="text-red-600 font-bold">แผนการเรียนถูกรีเซต</span> และข้อมูลนักเรียนทั้งหมดจะถูกลบ</span>
                  </p>
                  
                  <div className="mb-6">
                     <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">พิมพ์คำว่า 'delete' เพื่อยืนยัน</label>
                     <input 
                         ref={confirmInputRef}
                         type="text" 
                         value={deleteConfirmation}
                         onChange={(e) => setDeleteConfirmation(e.target.value)}
                         placeholder="delete"
                         className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center font-mono text-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                     />
                  </div>

                  <div className="flex gap-4 justify-center">
                     <Button variant="secondary" size="md" onClick={() => setShowConfirm(false)} className="text-sm">ยกเลิก</Button>
                     <Button 
                         size="md" 
                         onClick={handleConfirmSave} 
                         className={`text-sm text-white transition-all ${deleteConfirmation === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-300 cursor-not-allowed'}`}
                         disabled={deleteConfirmation !== 'delete' || isSaving}
                     >
                         {isSaving ? 'กำลังบันทึก...' : 'ลบข้อมูลและบันทึก'}
                     </Button>
                  </div>
             </div>
         </div>,
         document.body
      )}

      {/* --- EDIT MODALS --- */}
      {editMode !== 'NONE' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-all" onClick={handleClose}></div>
            
            <div className="bg-white rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.15)] border border-gray-100 w-full max-w-4xl relative z-10 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                        {editMode === 'PLANS' && 'แก้ไขข้อมูลแผนการเรียน'}
                        {editMode === 'SUBJECTS' && 'แก้ไขรายวิชาสอบ'}
                    </h3>
                    <button onClick={handleClose} className="p-2.5 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-8 overflow-y-auto">
                    {editMode === 'PLANS' && (
                        <div className="space-y-5">
                            {(enableDistrictPriority || enableQuota) && (
                                <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl flex items-start gap-3 mb-4">
                                    <Lock className="w-5 h-5 text-purple-600 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-purple-800">โหมดพิเศษเปิดใช้งานอยู่</p>
                                        <p className="text-xs text-purple-600">
                                            ในโหมดนี้ ระบบบังคับให้มีแผนการเรียนเดียว คุณสามารถแก้ไขชื่อและจำนวนรับได้ แต่ไม่สามารถเพิ่มหรือลบแผนได้
                                        </p>
                                    </div>
                                </div>
                            )}

                            <table className="min-w-full divide-y divide-gray-100">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase">ชื่อแผนการเรียน</th>
                                        <th className="px-5 py-4 text-center text-xs font-bold text-gray-500 uppercase w-36">จำนวนรับ</th>
                                        <th className="px-5 py-4 text-right text-xs font-bold text-gray-500 uppercase w-20">ลบ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {tempPlans.map((plan) => (
                                        <tr key={plan.id}>
                                            <td className="px-5 py-3">
                                                <input 
                                                    type="text" 
                                                    value={plan.name}
                                                    onChange={(e) => handleChangeTempPlan(plan.id, 'name', e.target.value)}
                                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-base text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                                />
                                            </td>
                                            <td className="px-5 py-3">
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    value={plan.quota}
                                                    onChange={(e) => handleChangeTempPlan(plan.id, 'quota', Number(e.target.value))}
                                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-center text-base font-bold text-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                                />
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <button 
                                                    onClick={() => handleDeleteTempPlan(plan.id)} 
                                                    disabled={enableDistrictPriority || enableQuota}
                                                    className={`p-3 rounded-xl transition-colors ${(enableDistrictPriority || enableQuota) ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {!enableDistrictPriority && !enableQuota && (
                                <Button variant="outline" size="md" onClick={handleAddTempPlan} className="w-full border-dashed border-gray-300 text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 py-3 text-sm">
                                    <Plus className="w-5 h-5 mr-2" /> เพิ่มแผนการเรียนใหม่
                                </Button>
                            )}
                        </div>
                    )}

                    {editMode === 'SUBJECTS' && (
                        <div className="space-y-5">
                            <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                💡 <strong>Tip:</strong> เรียงลำดับวิชาตามความสำคัญในการตัดสิน (Tie-Breaker) โดยวิชาแรกจะถูกนำมาพิจารณาก่อน
                            </p>
                            <table className="min-w-full divide-y divide-gray-100">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase">ชื่อวิชา</th>
                                        <th className="px-5 py-4 text-center text-xs font-bold text-gray-500 uppercase w-36">คะแนนเต็ม</th>
                                        <th className="px-5 py-4 text-right text-xs font-bold text-gray-500 uppercase w-20">ลบ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {tempSubjects.map((subj) => (
                                        <tr key={subj.id}>
                                            <td className="px-5 py-3">
                                                <input 
                                                    type="text" 
                                                    value={subj.name}
                                                    onChange={(e) => handleChangeTempSubject(subj.id, 'name', e.target.value)}
                                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-base text-gray-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                                                />
                                            </td>
                                            <td className="px-5 py-3">
                                                <input 
                                                    type="number" 
                                                    min="0" 
                                                    value={subj.maxScore}
                                                    onChange={(e) => handleChangeTempSubject(subj.id, 'maxScore', Number(e.target.value))}
                                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-center text-base font-bold text-gray-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                                                />
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <button onClick={() => handleDeleteTempSubject(subj.id)} className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-50">
                                     <tr>
                                        <td className="px-5 py-4 text-base font-bold text-gray-900 text-right">คะแนนรวมเต็ม</td>
                                        <td className="px-5 py-4 text-center">
                                            <span className="inline-block px-4 py-1.5 bg-green-100 text-green-700 rounded-lg text-base font-bold">{tempTotalMaxScore}</span>
                                        </td>
                                        <td></td>
                                     </tr>
                                </tfoot>
                            </table>
                            <Button variant="outline" size="md" onClick={handleAddTempSubject} className="w-full border-dashed border-gray-300 text-gray-500 hover:text-orange-600 hover:border-orange-300 hover:bg-orange-50 py-3 text-sm">
                                <Plus className="w-5 h-5 mr-2" /> เพิ่มวิชาสอบใหม่
                            </Button>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="px-8 py-6 border-t border-gray-100 flex justify-end gap-4 bg-gray-50 rounded-b-2xl">
                    <Button variant="secondary" onClick={handleClose} size="lg" className="text-base">ยกเลิก</Button>
                    <Button onClick={handleRequestSave} size="lg" className="text-base">
                        <Save className="w-5 h-5 mr-2" /> บันทึกข้อมูล
                    </Button>
                </div>
                
                {/* Confirmation Overlay (Destructive) - Nested for Edit Mode */}
                {showConfirm && (
                     <div className="absolute inset-0 bg-white/95 backdrop-blur-none z-20 flex items-center justify-center rounded-2xl p-6">
                        <div className="bg-white border border-gray-100 shadow-2xl rounded-2xl p-8 max-w-sm text-center transform scale-100 animate-in fade-in zoom-in duration-200">
                             <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                {isSaving ? <Loader2 className="w-8 h-8 text-red-600 animate-spin" /> : <AlertTriangle className="w-8 h-8 text-red-600" />}
                             </div>
                             <h4 className="text-xl font-bold text-gray-900 mb-3">คำเตือน: การกระทำนี้จะล้างข้อมูล</h4>
                             <p className="text-base text-gray-500 mb-6 leading-relaxed">
                                {pendingDistrictToggle !== null 
                                    ? <span>การเปลี่ยนโหมดเขตพื้นที่ จะทำให้ <span className="text-red-600 font-bold">แผนการเรียนถูกรีเซต</span> และข้อมูลนักเรียนทั้งหมดจะถูกลบ</span>
                                    : <span>การแก้ไขโครงสร้างนี้ จำเป็นต้อง <span className="text-red-600 font-bold">ลบข้อมูลนักเรียนทั้งหมด</span> เพื่อป้องกันความผิดพลาด</span>
                                }
                             </p>
                             
                             <div className="mb-6">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">พิมพ์คำว่า 'delete' เพื่อยืนยัน</label>
                                <input 
                                    ref={confirmInputRef}
                                    type="text" 
                                    value={deleteConfirmation}
                                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                                    placeholder="delete"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center font-mono text-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                                />
                             </div>

                             <div className="flex gap-4 justify-center">
                                <Button variant="secondary" size="md" onClick={() => setShowConfirm(false)} className="text-sm">ยกเลิก</Button>
                                <Button 
                                    size="md" 
                                    onClick={handleConfirmSave} 
                                    className={`text-sm text-white transition-all ${deleteConfirmation === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-300 cursor-not-allowed'}`}
                                    disabled={deleteConfirmation !== 'delete' || isSaving}
                                >
                                    {isSaving ? 'กำลังบันทึก...' : 'ลบข้อมูลและบันทึก'}
                                </Button>
                             </div>
                        </div>
                     </div>
                )}
            </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default SettingsPage;
