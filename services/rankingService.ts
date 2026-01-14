
import { Student, RankedStudent, StudyPlan, ExamSubject } from '../types';

export const calculateTotal = (student: Student, subjects?: string[]): number => {
  // Robust calculation to prevent NaN
  if (subjects && subjects.length > 0) {
      return subjects.reduce((sum, subjId) => {
          const score = student.scores[subjId];
          // Ensure score is treated as a number; default to 0 if undefined/null/NaN
          return sum + (typeof score === 'number' ? score : Number(score) || 0);
      }, 0);
  }

  // Fallback for legacy/default keys if no subjects provided
  const { math, science, thai, english, social } = student.scores;
  return (Number(math)||0) + (Number(science)||0) + (Number(thai)||0) + (Number(english)||0) + (Number(social)||0);
};

// Helper: Comparator function for sorting students by Score
const compareByScore = (a: Student & { totalScore: number }, b: Student & { totalScore: number }, subjects: ExamSubject[]) => {
  // 1. Total Score (Desc)
  if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
  }
  
  // 2. Tie Breaker (Subject Priority)
  if (subjects && subjects.length > 0) {
      for (const subj of subjects) {
          const scoreA = Number(a.scores[subj.id]) || 0;
          const scoreB = Number(b.scores[subj.id]) || 0;
          if (scoreA !== scoreB) {
              return scoreB - scoreA;
          }
      }
  }

  // 3. Fallback Tie Breaker (Standard Subjects)
  const getScore = (s: Student, key: string) => Number(s.scores[key]) || 0;
  if (getScore(a, 'science') !== getScore(b, 'science')) return getScore(b, 'science') - getScore(a, 'science');
  if (getScore(a, 'math') !== getScore(b, 'math')) return getScore(b, 'math') - getScore(a, 'math');
  if (getScore(a, 'english') !== getScore(b, 'english')) return getScore(b, 'english') - getScore(a, 'english');
  if (getScore(a, 'thai') !== getScore(b, 'thai')) return getScore(b, 'thai') - getScore(a, 'thai');
  return getScore(b, 'social') - getScore(a, 'social');
};

export const rankStudents = (
    students: Student[], 
    plans: StudyPlan[], 
    subjects: ExamSubject[],
    enableDistrictPriority: boolean = false
): RankedStudent[] => {
  
  // 1. Pre-calculate totals for everyone (Using subject IDs to be specific)
  const subjectIds = subjects.map(s => s.id);
  const allStudents = students.map(s => ({
    ...s,
    totalScore: calculateTotal(s, subjectIds),
    rank: 0,
    qualifiedStream: null as string | null
  }));

  // =========================================================
  // PHASE 1: SEAT ALLOCATION (Who gets in?)
  // =========================================================
  
  // Setup Quota Tracking
  const planQuotas: Record<string, number> = {};
  const currentUsage: Record<string, number> = {};
  plans.forEach(p => {
      planQuotas[p.name] = p.quota;
      currentUsage[p.name] = 0;
  });

  const assignmentMap = new Map<string, string | null>();

  // Function to try assigning a student to their preferred choices
  const tryAssignSeat = (student: typeof allStudents[0]) => {
      let assigned = null;
      if (student.preferredStreams) {
          for (const planName of student.preferredStreams) {
              if (planQuotas[planName] !== undefined) {
                  // Check if seat is available
                  if (currentUsage[planName] < planQuotas[planName]) {
                      assigned = planName;
                      currentUsage[planName]++;
                      break; // Got a seat, stop checking
                  }
              }
          }
      }
      assignmentMap.set(student.id, assigned);
  };

  if (enableDistrictPriority) {
      // --- FLOWCHART PATH: YES (District Priority ON) ---
      
      // 1. Split Students
      const localStudents = allStudents.filter(s => s.residence === 'IN_DISTRICT');
      const nonLocalStudents = allStudents.filter(s => s.residence !== 'IN_DISTRICT');

      // 2. Sort Groups Internally by Score (To decide who gets first pick within their group)
      localStudents.sort((a, b) => compareByScore(a, b, subjects));
      nonLocalStudents.sort((a, b) => compareByScore(a, b, subjects));

      // 3. "Pre-order seats for LOCAL" (Locals take seats first)
      localStudents.forEach(student => tryAssignSeat(student));

      // 4. "Pick NON_LOCAL" (Non-Locals take remaining seats)
      nonLocalStudents.forEach(student => tryAssignSeat(student));

  } else {
      // --- FLOWCHART PATH: NO (Standard Competition) ---
      
      // 1. Sort Everyone by Score
      const sortedAll = [...allStudents].sort((a, b) => compareByScore(a, b, subjects));

      // 2. Assign strictly by score order
      sortedAll.forEach(student => tryAssignSeat(student));
  }

  // =========================================================
  // PHASE 2: FINAL RANKING (Display Order)
  // Logic: 
  // - If District Priority is ON: Admitted students (Qualified) MUST rank higher than Waiting students,
  //   regardless of score.
  // - Then sort by Score within those groups.
  // =========================================================

  allStudents.sort((a, b) => {
      // Check admission status
      const aQualified = assignmentMap.get(a.id) !== null && assignmentMap.get(a.id) !== undefined;
      const bQualified = assignmentMap.get(b.id) !== null && assignmentMap.get(b.id) !== undefined;

      if (enableDistrictPriority) {
          // Rule: Qualified comes before Not Qualified (Waiting List)
          if (aQualified && !bQualified) return -1; // a comes first (Rank Higher)
          if (!aQualified && bQualified) return 1;  // b comes first (Rank Higher)
      }

      // If qualification status is the same (both admitted OR both waiting),
      // OR if district priority is disabled, sort strictly by Score.
      return compareByScore(a, b, subjects);
  });

  // 2. Assign Rank Numbers & Attach Allocation Results
  return allStudents.map((s, index) => ({
      ...s,
      rank: index + 1,
      qualifiedStream: assignmentMap.get(s.id) || null
  }));
};
