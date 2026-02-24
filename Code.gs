

const SHEETS = {
  CLASSROOMS: 'DB_Classrooms',
  STUDENTS: 'DB_Students',
  SETTINGS: 'DB_Settings',
  USERS: 'DB_Users' // NEW: Users Sheet
};

// Helper to get the correct spreadsheet
function getDB(sheetId) {
  try {
    if (sheetId && typeof sheetId === 'string' && sheetId.length > 10) {
      return SpreadsheetApp.openById(sheetId);
    }
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    console.error('Error opening spreadsheet by ID, falling back to active:', e);
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function setup(sheetId) {
  const ss = getDB(sheetId);
  
  // Create Classrooms Sheet
  if (!ss.getSheetByName(SHEETS.CLASSROOMS)) {
    ss.insertSheet(SHEETS.CLASSROOMS).appendRow(['id', 'data', 'updated_at', 'deleted_at']);
  }
  
  // Create Students Sheet
  if (!ss.getSheetByName(SHEETS.STUDENTS)) {
    ss.insertSheet(SHEETS.STUDENTS).appendRow(['classroom_id', 'student_id', 'data', 'updated_at']);
  }

  // Create Settings Sheet
  if (!ss.getSheetByName(SHEETS.SETTINGS)) {
    ss.insertSheet(SHEETS.SETTINGS).appendRow(['classroom_id', 'type', 'data', 'updated_at']);
  }

  // NEW: Create Users Sheet
  if (!ss.getSheetByName(SHEETS.USERS)) {
    const sheet = ss.insertSheet(SHEETS.USERS);
    // Added last_heartbeat column
    sheet.appendRow(['id', 'username', 'password', 'name', 'role', 'updated_at', 'last_heartbeat']);
    // Add Default Super Admin
    const now = new Date().toISOString();
    sheet.appendRow(['admin-001', 'Admin', '@Np123456', 'ผู้ดูแลระบบหลัก', 'SUPER_ADMIN', now, now]);
  } else {
    // Check if last_heartbeat column exists, if not add it (Migration)
    const sheet = ss.getSheetByName(SHEETS.USERS);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (headers.length < 7) {
       sheet.getRange(1, 7).setValue('last_heartbeat');
    }
  }
}

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    let action = e.parameter.action;
    let body = {};
    if (e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        console.error('JSON Parse Error:', jsonErr);
      }
    }
    
    if (!action && body.action) {
      action = body.action;
    }

    const sheetId = body.sheetId || e.parameter.sheetId;
    let result = { status: 'error', message: 'Unknown action: ' + action };

    if (action === 'getClassrooms') {
      result = getClassrooms(sheetId);
    } else if (action === 'saveClassroom') {
      result = saveClassroom(body, sheetId);
    } else if (action === 'deleteClassroom') {
      result = deleteClassroom(body.id, sheetId);
    } else if (action === 'getDashboardData') {
      result = getDashboardData(body.classroomId || e.parameter.classroomId, sheetId);
    } else if (action === 'getClassroomTimestamp') { 
      result = getClassroomTimestamp(body.classroomId || e.parameter.classroomId, sheetId);
    } else if (action === 'saveStudent') {
      result = saveStudent(body, sheetId);
    } else if (action === 'saveStudents') {
      result = saveStudents(body, sheetId);
    } else if (action === 'deleteStudent') {
      result = deleteStudent(body.classroomId, body.studentId, sheetId);
    } else if (action === 'deleteStudents') {
      result = deleteStudents(body.classroomId, body.studentIds, sheetId);
    } else if (action === 'saveSettings') {
      result = saveSettings(body, sheetId);
    } else if (action === 'setup') {
      setup(sheetId); 
      result = { status: 'success', message: 'Setup completed successfully' };
    } 
    // User Management Actions
    else if (action === 'getUsers') {
      result = getUsers(sheetId);
    } else if (action === 'saveUser') {
      result = saveUser(body, sheetId);
    } else if (action === 'deleteUser') {
      result = deleteUser(body.userId, sheetId);
    } else if (action === 'login') {
      result = login(body, sheetId);
    } else if (action === 'heartbeat') { // NEW
      result = heartbeat(body, sheetId);
    } else if (action === 'getOnlineUsers') { // NEW
      result = getOnlineUsers(sheetId);
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'error', 
      message: error.toString(),
      stack: error.stack
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// --- User Functions ---

function getUsers(sheetId) {
  const ss = getDB(sheetId);
  const sheet = ss.getSheetByName(SHEETS.USERS);
  if (!sheet) return { status: 'success', data: [] };

  const data = sheet.getDataRange().getValues();
  const users = [];
  
  // Skip header
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0]).trim();
    if (id) {
      users.push({
        id: id,
        username: data[i][1],
        password: data[i][2], 
        name: data[i][3],
        role: data[i][4]
      });
    }
  }
  return { status: 'success', data: users };
}

// NEW: Heartbeat to signal "I'm alive"
function heartbeat(payload, sheetId) {
  const ss = getDB(sheetId);
  const sheet = ss.getSheetByName(SHEETS.USERS);
  if (!sheet) return { status: 'error' };

  const userId = String(payload.userId).trim();
  const now = new Date().toISOString();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === userId) {
      // Update Column 7 (last_heartbeat)
      // If col 7 doesn't exist in range, setValue still works if sheet has cols, 
      // but to be safe we use getRange row, col.
      sheet.getRange(i + 1, 7).setValue(now);
      return { status: 'success' };
    }
  }
  return { status: 'success', message: 'User not found, ignored' };
}

// NEW: Get Online Users (Active within last 2 minutes)
function getOnlineUsers(sheetId) {
  const ss = getDB(sheetId);
  const sheet = ss.getSheetByName(SHEETS.USERS);
  if (!sheet) return { status: 'success', data: [] };

  const data = sheet.getDataRange().getValues();
  const onlineUsers = [];
  const now = new Date().getTime();
  const threshold = 2 * 60 * 1000; // 2 Minutes

  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0]).trim();
    if (id) {
      const lastHeartbeatStr = data[i][6]; // Column 7
      if (lastHeartbeatStr) {
        const lastHeartbeatTime = new Date(lastHeartbeatStr).getTime();
        if (now - lastHeartbeatTime < threshold) {
             onlineUsers.push({
                id: id,
                name: data[i][3],
                role: data[i][4]
             });
        }
      }
    }
  }
  return { status: 'success', data: onlineUsers };
}

function saveUser(payload, sheetId) {
  const ss = getDB(sheetId);
  let sheet = ss.getSheetByName(SHEETS.USERS);
  
  if (!sheet) {
    setup(sheetId);
    sheet = ss.getSheetByName(SHEETS.USERS);
  }

  const data = sheet.getDataRange().getValues();
  const user = payload.user;
  const id = String(user.id).trim();
  const now = new Date().toISOString();

  let found = false;
  // Update
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() == id) {
      sheet.getRange(i + 1, 2).setValue(user.username);
      sheet.getRange(i + 1, 3).setValue(user.password);
      sheet.getRange(i + 1, 4).setValue(user.name);
      sheet.getRange(i + 1, 5).setValue(user.role);
      sheet.getRange(i + 1, 6).setValue(now);
      found = true;
      break;
    }
  }

  // Insert
  if (!found) {
    sheet.appendRow([id, user.username, user.password, user.name, user.role, now, now]);
  }
  
  return { status: 'success' };
}

function deleteUser(userId, sheetId) {
  const ss = getDB(sheetId);
  const sheet = ss.getSheetByName(SHEETS.USERS);
  if (!sheet) return { status: 'error', message: 'Users DB not found' };
  
  const targetId = String(userId).trim();
  const data = sheet.getDataRange().getValues();
  
  // Prevent deleting Default Admin-001 via API (double check)
  if (targetId === 'admin-001') {
      return { status: 'error', message: 'Cannot delete default Super Admin' };
  }

  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]).trim() === targetId) {
      sheet.deleteRow(i + 1);
      return { status: 'success' };
    }
  }
  return { status: 'success', message: 'User not found' };
}

function login(payload, sheetId) {
  const ss = getDB(sheetId);
  const sheet = ss.getSheetByName(SHEETS.USERS);
  
  // If sheet missing, try setup or fail
  if (!sheet) {
      // If no sheet, implies no users. But maybe setup wasn't run.
      return { status: 'error', message: 'System not initialized. Please setup database.' };
  }

  const username = String(payload.username).trim();
  const password = String(payload.password).trim();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    // Check case-sensitive or insensitive? Let's do Case Sensitive for password, Insensitive for username
    if (String(data[i][1]).toLowerCase() === username.toLowerCase() && String(data[i][2]) === password) {
      const user = {
        id: data[i][0],
        username: data[i][1],
        // Do not return password in login response
        name: data[i][3],
        role: data[i][4]
      };
      return { status: 'success', user: user };
    }
  }

  return { status: 'error', message: 'Invalid username or password' };
}

// --- Classroom Functions ---

function updateClassroomTimestamp(classroomId, ss) {
  const sheet = ss.getSheetByName(SHEETS.CLASSROOMS);
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const id = String(classroomId).trim();
  const now = new Date().toISOString();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() == id) {
      sheet.getRange(i + 1, 3).setValue(now);
      break;
    }
  }
}

function getClassrooms(sheetId) {
  const ss = getDB(sheetId);
  const sheet = ss.getSheetByName(SHEETS.CLASSROOMS);
  if (!sheet) return { status: 'success', data: [] };
  const data = sheet.getDataRange().getValues();
  const classrooms = [];
  
  // 1. Get Plan Counts
  const setSheet = ss.getSheetByName(SHEETS.SETTINGS);
  const planCounts = {};
  if (setSheet) {
    const setData = setSheet.getDataRange().getValues();
    for (let i = 1; i < setData.length; i++) {
       const cId = String(setData[i][0]).trim();
       if (setData[i][1] === 'PLANS') {
         try {
           const plans = JSON.parse(setData[i][2]);
           planCounts[cId] = Array.isArray(plans) ? plans.length : 0;
         } catch(e) {}
       }
    }
  }

  // 2. Get Student Counts (NEW LOGIC: Real-time count from DB_Students)
  const stuSheet = ss.getSheetByName(SHEETS.STUDENTS);
  const studentCounts = {};
  if (stuSheet) {
    const stuData = stuSheet.getDataRange().getValues();
    // Start from 1 to skip header
    // Structure: ['classroom_id', 'student_id', 'data', 'updated_at']
    for (let i = 1; i < stuData.length; i++) {
       const cId = String(stuData[i][0]).trim();
       if (cId) {
         studentCounts[cId] = (studentCounts[cId] || 0) + 1;
       }
    }
  }

  // 3. Construct Response
  for (let i = 1; i < data.length; i++) {
    const json = data[i][1];
    const updatedAt = data[i][2];
    const deletedAt = data[i][3];
    if (json) {
       try {
         const obj = JSON.parse(json);
         if (deletedAt) obj.deletedAt = deletedAt;
         if (updatedAt) obj.updatedAt = updatedAt;
         const objId = String(obj.id).trim();
         
         // Inject Plan Count
         if (planCounts.hasOwnProperty(objId)) {
             obj.planCount = planCounts[objId];
         } else {
             obj.planCount = (obj.planCount !== undefined) ? obj.planCount : 0;
         }

         // Inject Student Count (Override JSON value with real-time count)
         if (studentCounts.hasOwnProperty(objId)) {
             obj.studentCount = studentCounts[objId];
         } else {
             obj.studentCount = 0;
         }

         classrooms.push(obj);
       } catch (e) {}
    }
  }
  return { status: 'success', data: classrooms };
}

// NEW Lightweight function for polling
function getClassroomTimestamp(classroomId, sheetId) {
  const ss = getDB(sheetId);
  const sheet = ss.getSheetByName(SHEETS.CLASSROOMS);
  if (!sheet) return { status: 'success', updatedAt: null };
  
  const id = String(classroomId).trim();
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() == id) {
      return { status: 'success', updatedAt: data[i][2] }; // Col 3 is updated_at
    }
  }
  return { status: 'success', updatedAt: null };
}

function saveClassroom(payload, sheetId) {
  const ss = getDB(sheetId);
  let sheet = ss.getSheetByName(SHEETS.CLASSROOMS);
  if (!sheet) { setup(sheetId); sheet = ss.getSheetByName(SHEETS.CLASSROOMS); }
  const data = sheet.getDataRange().getValues();
  const id = String(payload.id).trim();
  const safePayload = { ...payload };
  delete safePayload.action;
  delete safePayload.sheetId;
  const json = JSON.stringify(safePayload);
  const now = new Date().toISOString();
  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() == id) {
      sheet.getRange(i + 1, 2).setValue(json);
      sheet.getRange(i + 1, 3).setValue(now);
      if (payload.deletedAt === undefined) sheet.getRange(i + 1, 4).setValue('');
      else sheet.getRange(i + 1, 4).setValue(payload.deletedAt);
      found = true;
      break;
    }
  }
  if (!found) sheet.appendRow([id, json, now, payload.deletedAt || '']);
  return { status: 'success' };
}

function deleteClassroom(id, sheetId) {
  const ss = getDB(sheetId);
  const sheet = ss.getSheetByName(SHEETS.CLASSROOMS);
  if (!sheet) return { status: 'error', message: 'Sheet DB_Classrooms not found' };
  const targetId = String(id).trim();
  const data = sheet.getDataRange().getValues();
  let deleted = false;
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]).trim() === targetId) {
      sheet.deleteRow(i + 1);
      deleted = true;
      break; 
    }
  }
  if (!deleted) return { status: 'error', message: 'Classroom ID not found' };
  const stuSheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (stuSheet) {
    const stuData = stuSheet.getDataRange().getValues();
    for (let i = stuData.length - 1; i >= 1; i--) {
      if (String(stuData[i][0]).trim() === targetId) stuSheet.deleteRow(i + 1);
    }
  }
  const setSheet = ss.getSheetByName(SHEETS.SETTINGS);
  if (setSheet) {
    const setData = setSheet.getDataRange().getValues();
    for (let i = setData.length - 1; i >= 1; i--) {
      if (String(setData[i][0]).trim() === targetId) setSheet.deleteRow(i + 1);
    }
  }
  return { status: 'success' };
}

function getDashboardData(classroomId, sheetId) {
  const ss = getDB(sheetId);
  const cid = String(classroomId).trim();
  const stuSheet = ss.getSheetByName(SHEETS.STUDENTS);
  let students = [];
  if (stuSheet) {
    const stuData = stuSheet.getDataRange().getValues();
    for (let i = 1; i < stuData.length; i++) {
      if (String(stuData[i][0]).trim() == cid) {
        try { students.push(JSON.parse(stuData[i][2])); } catch (e) {}
      }
    }
  }
  const setSheet = ss.getSheetByName(SHEETS.SETTINGS);
  let plans = null;
  let subjects = null;
  let criteria = null;
  if (setSheet) {
    const setData = setSheet.getDataRange().getValues();
    for (let i = 1; i < setData.length; i++) {
      if (String(setData[i][0]).trim() == cid) {
         try {
           if (setData[i][1] === 'PLANS') plans = JSON.parse(setData[i][2]);
           if (setData[i][1] === 'SUBJECTS') subjects = JSON.parse(setData[i][2]);
           if (setData[i][1] === 'CRITERIA') {
              const parsed = JSON.parse(setData[i][2]);
              criteria = Array.isArray(parsed) ? parsed[0] : parsed;
           }
         } catch (e) {}
      }
    }
  }
  
  // Get Timestamp for Dashboard as well
  const roomSheet = ss.getSheetByName(SHEETS.CLASSROOMS);
  let updatedAt = new Date().toISOString();
  if (roomSheet) {
      const rData = roomSheet.getDataRange().getValues();
      for(let i=1; i<rData.length; i++) {
          if(String(rData[i][0]).trim() == cid) {
              updatedAt = rData[i][2];
              break;
          }
      }
  }

  return { status: 'success', students, plans, subjects, criteria, updatedAt };
}

function saveStudent(payload, sheetId) {
  const ss = getDB(sheetId);
  let sheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sheet) { setup(sheetId); sheet = ss.getSheetByName(SHEETS.STUDENTS); }
  const data = sheet.getDataRange().getValues();
  const classroomId = String(payload.classroomId).trim();
  const student = payload.student;
  const studentId = String(student.id).trim();
  const json = JSON.stringify(student);
  const now = new Date().toISOString();
  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() == classroomId && String(data[i][1]).trim() == studentId) {
      sheet.getRange(i + 1, 3).setValue(json);
      sheet.getRange(i + 1, 4).setValue(now);
      found = true;
      break;
    }
  }
  if (!found) sheet.appendRow([classroomId, studentId, json, now]);
  updateClassroomTimestamp(classroomId, ss);
  return { status: 'success' };
}

function saveStudents(payload, sheetId) {
  const ss = getDB(sheetId);
  let sheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sheet) { setup(sheetId); sheet = ss.getSheetByName(SHEETS.STUDENTS); }
  const classroomId = String(payload.classroomId).trim();
  const students = payload.students;
  const now = new Date().toISOString();
  const data = sheet.getDataRange().getValues();
  const indexMap = new Map();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() == classroomId) {
      indexMap.set(String(data[i][1]).trim(), i);
    }
  }
  const newRows = [];
  students.forEach(student => {
     const studentId = String(student.id).trim();
     const json = JSON.stringify(student);
     if (indexMap.has(studentId)) {
        const rowIndex = indexMap.get(studentId);
        sheet.getRange(rowIndex + 1, 3).setValue(json);
        sheet.getRange(rowIndex + 1, 4).setValue(now);
     } else {
        newRows.push([classroomId, studentId, json, now]);
     }
  });
  if (newRows.length > 0) sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 4).setValues(newRows);
  updateClassroomTimestamp(classroomId, ss);
  return { status: 'success', count: students.length };
}

function deleteStudent(classroomId, studentId, sheetId) {
   const ss = getDB(sheetId);
   const sheet = ss.getSheetByName(SHEETS.STUDENTS);
   if (!sheet) return { status: 'success' };
   const data = sheet.getDataRange().getValues();
   const cid = String(classroomId).trim();
   const sid = String(studentId).trim();
   for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() == cid && String(data[i][1]).trim() == sid) {
      sheet.deleteRow(i + 1);
      updateClassroomTimestamp(classroomId, ss);
      return { status: 'success' };
    }
  }
  return { status: 'success' };
}

function deleteStudents(classroomId, studentIds, sheetId) {
   const ss = getDB(sheetId);
   const sheet = ss.getSheetByName(SHEETS.STUDENTS);
   if (!sheet) return { status: 'success' };
   
   const data = sheet.getDataRange().getValues();
   const cid = String(classroomId).trim();
   // Convert to Set for faster lookup
   const idsToDelete = {};
   studentIds.forEach(id => { idsToDelete[String(id).trim()] = true; });
   
   // Delete from bottom up to maintain indices
   let deletedCount = 0;
   for (let i = data.length - 1; i >= 1; i--) {
     const rowCid = String(data[i][0]).trim();
     const rowSid = String(data[i][1]).trim();
     
     if (rowCid === cid && idsToDelete[rowSid]) {
       sheet.deleteRow(i + 1);
       deletedCount++;
     }
   }
   
   if (deletedCount > 0) {
       updateClassroomTimestamp(classroomId, ss);
   }
   
   return { status: 'success', deletedCount: deletedCount };
}

function saveSettings(payload, sheetId) {
  const ss = getDB(sheetId);
  let sheet = ss.getSheetByName(SHEETS.SETTINGS);
  if (!sheet) { setup(sheetId); sheet = ss.getSheetByName(SHEETS.SETTINGS); }
  const data = sheet.getDataRange().getValues();
  const classroomId = String(payload.classroomId).trim();
  const type = payload.type;
  const json = JSON.stringify(payload.data);
  const now = new Date().toISOString();
  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() == classroomId && data[i][1] == type) {
      sheet.getRange(i + 1, 3).setValue(json);
      sheet.getRange(i + 1, 4).setValue(now);
      found = true;
      break;
    }
  }
  if (!found) sheet.appendRow([classroomId, type, json, now]);
  updateClassroomTimestamp(classroomId, ss);
  return { status: 'success' };
}