
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
    sheet.appendRow(['id', 'username', 'password', 'name', 'role', 'updated_at']);
    // Add Default Super Admin
    const now = new Date().toISOString();
    sheet.appendRow(['admin-001', 'Admin', '@Np123456', 'ผู้ดูแลระบบหลัก', 'SUPER_ADMIN', now]);
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
    } else if (action === 'saveStudent') {
      result = saveStudent(body, sheetId);
    } else if (action === 'saveStudents') {
      result = saveStudents(body, sheetId);
    } else if (action === 'deleteStudent') {
      result = deleteStudent(body.classroomId, body.studentId, sheetId);
    } else if (action === 'saveSettings') {
      result = saveSettings(body, sheetId);
    } else if (action === 'setup') {
      setup(sheetId); 
      result = { status: 'success', message: 'Setup completed successfully' };
    } 
    // NEW: User Management Actions
    else if (action === 'getUsers') {
      result = getUsers(sheetId);
    } else if (action === 'saveUser') {
      result = saveUser(body, sheetId);
    } else if (action === 'deleteUser') {
      result = deleteUser(body.userId, sheetId);
    } else if (action === 'login') {
      result = login(body, sheetId);
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
        password: data[i][2], // In a real app, do not return password! But for this simple app we do.
        name: data[i][3],
        role: data[i][4]
      });
    }
  }
  return { status: 'success', data: users };
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
    sheet.appendRow([id, user.username, user.password, user.name, user.role, now]);
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
      // Setup default admin if needed logic could be here, but let's assume setup was run.
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
// (Existing logic below remains same, simplified helper updateClassroomTimestamp used)

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
         if (planCounts.hasOwnProperty(objId)) {
             obj.planCount = planCounts[objId];
         } else {
             obj.planCount = (obj.planCount !== undefined) ? obj.planCount : 0;
         }
         classrooms.push(obj);
       } catch (e) {}
    }
  }
  return { status: 'success', data: classrooms };
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
  if (setSheet) {
    const setData = setSheet.getDataRange().getValues();
    for (let i = 1; i < setData.length; i++) {
      if (String(setData[i][0]).trim() == cid) {
         try {
           if (setData[i][1] === 'PLANS') plans = JSON.parse(setData[i][2]);
           if (setData[i][1] === 'SUBJECTS') subjects = JSON.parse(setData[i][2]);
         } catch (e) {}
      }
    }
  }
  return { status: 'success', students, plans, subjects };
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
