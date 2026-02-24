
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
    enableDistrictPriority: boolean = false,
    enableQuota: boolean = false
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
              let matchedPlanName = planName;
              
              // If not exact match, try to find a lenient match
              if (planQuotas[matchedPlanName] === undefined) {
                  const lenientMatch = Object.keys(planQuotas).find(k => {
                      const cleanK = k.toLowerCase().replace(/\s+/g, '');
                      let cleanP = planName.toLowerCase().replace(/\s+/g, '');
                      // Strip leading numbers and dots (e.g., "1.Gift" -> "Gift")
                      cleanP = cleanP.replace(/^\d+\.?/, '');
                      if (!cleanP) return false;
                      return cleanK === cleanP || cleanK.includes(cleanP) || cleanP.includes(cleanK);
                  });
                  if (lenientMatch) {
                      matchedPlanName = lenientMatch;
                  }
              }

              if (planQuotas[matchedPlanName] !== undefined) {
                  // Check if seat is available
                  if (currentUsage[matchedPlanName] < planQuotas[matchedPlanName]) {
                      assigned = matchedPlanName;
                      currentUsage[matchedPlanName]++;
                      break; // Got a seat, stop checking
                  }
              }
          }
      }
      assignmentMap.set(student.id, assigned);
  };

  // --- SEAT ALLOCATION LOGIC ---
  let pool = [...allStudents];

  // 1. Quota Students (Highest Priority)
  if (enableQuota) {
      const quotaGroup = pool.filter(s => s.isQuota);
      const others = pool.filter(s => !s.isQuota);
      
      // Sort Quota group by score
      quotaGroup.sort((a, b) => compareByScore(a, b, subjects));
      
      // Assign seats
      quotaGroup.forEach(s => tryAssignSeat(s));
      
      pool = others; // Remaining pool for next steps
  }

  // 2. District Priority (Second Priority)
  if (enableDistrictPriority) {
      const localGroup = pool.filter(s => s.residence === 'IN_DISTRICT');
      const generalGroup = pool.filter(s => s.residence !== 'IN_DISTRICT');

      localGroup.sort((a, b) => compareByScore(a, b, subjects));
      generalGroup.sort((a, b) => compareByScore(a, b, subjects));

      localGroup.forEach(s => tryAssignSeat(s));
      generalGroup.forEach(s => tryAssignSeat(s));
  } else {
      // 3. Standard Competition (Score Only)
      pool.sort((a, b) => compareByScore(a, b, subjects));
      pool.forEach(s => tryAssignSeat(s));
  }

  // =========================================================
  // PHASE 2: FINAL RANKING (Display Order)
  // =========================================================

  allStudents.sort((a, b) => {
      // Check admission status
      const aQualified = assignmentMap.get(a.id) !== null && assignmentMap.get(a.id) !== undefined;
      const bQualified = assignmentMap.get(b.id) !== null && assignmentMap.get(b.id) !== undefined;

      // Rule 1: Qualified > Waiting List
      if (aQualified !== bQualified) return aQualified ? -1 : 1;

      // Rule 2: Hierarchy (Quota > District > General) - ONLY if BOTH are WAITLISTED
      if (!aQualified && !bQualified) {
          if (enableQuota) {
              const aQuota = !!a.isQuota;
              const bQuota = !!b.isQuota;
              if (aQuota !== bQuota) return aQuota ? -1 : 1;
          }
          if (enableDistrictPriority) {
               const aLocal = a.residence === 'IN_DISTRICT';
               const bLocal = b.residence === 'IN_DISTRICT';
               if (aLocal !== bLocal) return aLocal ? -1 : 1;
          }
      }

      // Rule 3: Score
      return compareByScore(a, b, subjects);
  });

  // 2. Assign Rank Numbers & Attach Allocation Results
  return allStudents.map((s, index) => ({
      ...s,
      rank: index + 1,
      qualifiedStream: assignmentMap.get(s.id) || null
  }));
};
