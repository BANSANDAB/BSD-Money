
/**
 * จัดรูปแบบจำนวนเงิน: ถ้ามีเศษสตางค์ให้แสดงสตางค์ 2 หลักเสมอ
 */
function formatMoneyGAS(val) {
  if (val === undefined || val === null || val === '') return '0';
  var n = Number(String(val).replace(/,/g, ''));
  if (isNaN(n)) return '0';
  if (Math.round(Math.abs(n) * 100) % 100 !== 0) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return n.toLocaleString('en-US');
}
// ==========================================
// การตั้งค่าเชื่อมต่อฐานข้อมูลและโฟลเดอร์ Google Drive
// ==========================================
const SPREADSHEET_ID = '1NTmGmRPlnsOEuRzt4chpBR4AIoYnfVTbJN9x12NTTgA'; // ID Google Sheet ฐานข้อมูลหลัก
const FOLDER_ID = '1xEC5eHs6tKRM37IGZyHNpkl-nzp-jSaO';             // ID Google Drive Folder สำหรับเก็บเอกสาร
const WITHDRAW_DOC_TEMPLATE_ID = '1L_TyO2ySajvyRU1zhC1yxmhspHUyBrhcWiX5d1EgcfQ'; // ID เทมเพลตใบขอเบิก (Google Docs)

/**
 * ฟังก์ชันสำหรับเปิด Spreadsheet ฐานข้อมูล
 */
function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (err) {
    throw new Error('ไม่สามารถเปิด Google Sheet ได้ กรุณาตรวจสอบสิทธิ์การเข้าถึงหรือ Spreadsheet ID: ' + err.toString());
  }
}

/**
 * ฟังก์ชันสำหรับเข้าถึง Folder ปลายทาง
 */
function getTargetFolder() {
  try {
    return DriveApp.getFolderById(FOLDER_ID);
  } catch (err) {
    return DriveApp.getRootFolder();
  }
}

/**
 * เข้าสู่ระบบ Web App (รองรับทั้งเปิดเว็บโดยตรง และรับ GET Request จาก Localhost / คอมพิวเตอร์)
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    return handleApiRequest(e.parameter.action, e.parameter.data ? JSON.parse(e.parameter.data) : null);
  }
  
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('ระบบบริหารงบประมาณ โรงเรียนบ้านสันดาบ')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * รับ POST Request จากการรันบน Localhost / Live Server (127.0.0.1) หรือเว็บภายนอก
 */
function doPost(e) {
  try {
    let contents;
    if (e && e.postData && e.postData.contents) {
      contents = JSON.parse(e.postData.contents);
    } else if (e && e.parameter && e.parameter.data) {
      contents = JSON.parse(e.parameter.data);
    } else {
      contents = e.parameter || {};
    }
    const action = contents.action;
    const data = contents.data;
    return handleApiRequest(action, data);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ประมวลผลคำขอจาก API ภายนอก
 */
function handleApiRequest(action, data) {
  let result;
  try {
    if (action === 'getAllData') {
      result = getAllData();
    } else if (action === 'ensureSheetsExist') {
      ensureSheetsExist();
      result = getAllData();
    } else if (action === 'testDatabaseConnection') {
      result = { success: true, message: testDatabaseConnection() };
    } else if (action === 'saveBudgetConfig') {
      result = saveBudgetConfig(data);
    } else if (action === 'saveWithdrawalAndGenerateDoc') {
      result = saveWithdrawalAndGenerateDoc(data.wd);
    } else if (action === 'editWithdrawalAndRegenerateDoc') {
      result = editWithdrawalAndRegenerateDoc(data.rowNum, data.wd, data.oldDocUrl);
    } else if (action === 'addProjectData') {
      result = addProjectData(data.projectData);
    } else if (action === 'cloneProjectsForYear') {
      result = cloneProjectsForYear(data.fromYear, data.toYear);
    } else if (action === 'saveRecord') {
      result = saveRecord(data.sheetName, data.rowData);
    } else if (action === 'deleteRowData') {
      result = deleteRowData(data.sheetName, data.rowNum, data.isWd);
    } else if (action === 'updateRecordByRow') {
      result = updateRecordByRow(data.sheetName, data.rowNum, data.updates);
    } else if (action === 'saveEbudgetData') {
      result = saveEbudgetData(data.fy, data.ebudgetData);
    } else {
      result = { success: false, error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { success: false, error: err.toString() };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ตรวจสอบและสร้างชีตที่จำเป็นใน Google Sheets อัตโนมัติหากยังไม่มี (ปรับปรุงความเร็ว)
 */
/**
 * ตรวจสอบและขยาย แถว (Rows) และ คอลัมน์ (Columns) ใน Google Sheet อัตโนมัติ
 * หากแถวหรือคอลัมน์เต็ม หรือใกล้จะเต็ม ระบบจะเพิ่มแถว/คอลัมน์ให้อัตโนมัติทันที
 * ป้องกันปัญหาข้อมูลเต็ม หรือ error เมื่อ getRange / appendRow เกินขอบเขตของชีต
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - ชีตที่ต้องการตรวจสอบ
 * @param {number} [neededRow] - แถวเป้าหมายที่ต้องการเขียน (ถ้าไม่ระบุ จะตรวจสอบจากแถวสุดท้าย + 1)
 * @param {number} [neededCol] - คอลัมน์เป้าหมายที่ต้องการเขียน (ถ้าไม่ระบุ จะตรวจสอบจากคอลัมน์สุดท้าย)
 */
function ensureSheetCapacity(sheet, neededRow, neededCol) {
  if (!sheet) return;
  try {
    const maxRows = sheet.getMaxRows();
    const maxCols = sheet.getMaxColumns();
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    // 1. ตรวจสอบและเพิ่มแถวอัตโนมัติ (Auto-expand Rows)
    const targetRow = neededRow ? Number(neededRow) : (lastRow + 1);
    if (targetRow > maxRows) {
      // หากแถวที่ต้องการเขียน เกินขอบเขตสูงสุด ให้เพิ่มแถวทันทีอย่างน้อย 500 แถว
      const rowsToAdd = Math.max(500, (targetRow - maxRows) + 100);
      sheet.insertRowsAfter(maxRows, rowsToAdd);
    } else if (maxRows - lastRow < 20) {
      // หากแถวคงเหลือเหลือน้อยกว่า 20 แถว ให้ขยายเผื่อล่วงหน้า 500 แถวเสมอ
      sheet.insertRowsAfter(maxRows, 500);
    }

    // 2. ตรวจสอบและเพิ่มคอลัมน์อัตโนมัติ (Auto-expand Columns)
    const targetCol = neededCol ? Number(neededCol) : lastCol;
    if (targetCol > maxCols) {
      // หากคอลัมน์ที่ต้องการเขียน เกินขอบเขตสูงสุด ให้เพิ่มคอลัมน์ทันที
      const colsToAdd = Math.max(10, (targetCol - maxCols) + 5);
      sheet.insertColumnsAfter(maxCols, colsToAdd);
    } else if (maxCols - lastCol < 2 && maxCols < 50) {
      // หากคอลัมน์คงเหลือเหลือน้อยกว่า 2 คอลัมน์ ให้ขยายเผื่อ 5 คอลัมน์
      sheet.insertColumnsAfter(maxCols, 5);
    }
  } catch (err) {
    Logger.log('ensureSheetCapacity notice: ' + err.toString());
  }
}

function ensureSheetsExist() {
  const ss = getSpreadsheet();
  const sheetsNeeded = {
    'ตั้งค่า': [
      'ปีงบประมาณ', 
      'อนุบาล_ไตรมาส1', 'ประถม_ไตรมาส1', 
      'อนุบาล_ไตรมาส2', 'ประถม_ไตรมาส2',
      'กสศ_ไตรมาส1', 'กสศ_ไตรมาส2',
      'ปัจจัยพื้นฐาน_ไตรมาส1', 'ปัจจัยพื้นฐาน_ไตรมาส2',
      'นร_อนุบาล_ประมาณการ', 'นร_ประถม_ประมาณการ',
      'ประมาณการ_รายได้', 'ประมาณการ_อาหารกลางวัน', 'ประมาณการ_ดอกเบี้ย',
      'รายละเอียดการจัดสรร_JSON', 'Ebudget_Data_JSON'
    ],
    'โครงการ': ['วันที่', 'ชื่อโครงการ', 'ผู้ดูแล', 'ฝ่ายงาน', 'แหล่งงบประมาณ', 'งบประมาณโครงการ', 'ลิงก์ไฟล์ PDF (ยกเลิก)', 'รายละเอียดกิจกรรม', 'ปีการศึกษา'],
    'บันทึกขอเบิกงบประมาณ': ['วันที่บันทึก', 'วันที่ขอเบิก', 'โครงการ', 'ผู้ขอเบิก', 'รายละเอียด', 'กิจกรรม', 'แผนงาน', 'แหล่งเงิน', 'จำนวนเงิน', 'ตัวอักษร', 'งบเต็ม', 'เบิกสะสม', 'คงเหลือ', 'ลิงก์เอกสาร'],
    'รายจ่ายโครงการ': ['วันที่บันทึก', 'ชื่อโครงการ', 'รายการ/กิจกรรม', 'จำนวนเงิน', 'วันที่ใช้จ่าย', 'แหล่งเงิน', 'ปีงบประมาณ'],
    'งบรายได้สถานศึกษา': ['วันที่บันทึก', 'ประเภท (รายรับ/รายจ่าย)', 'รายการ', 'จำนวนเงิน', 'วันที่', 'หมวดหมู่', 'โครงการ', 'กิจกรรม', 'แหล่งเงิน'],
    'ทุนนักเรียนยากจน': ['วันที่บันทึก', 'วันที่', 'รายการ', 'ประเภท', 'จำนวนเงิน', 'แหล่งเงิน'],
    'อาหารกลางวัน': ['วันที่บันทึก', 'ประเภท (รายรับ/รายจ่าย)', 'รายการ', 'จำนวนนักเรียน', 'จำนวนเงิน', 'วันที่'],
    'ดอกเบี้ย': ['วันที่บันทึก', 'ประเภทดอกเบี้ย', 'จำนวนเงิน', 'วันที่ได้รับ'],
    'บจ_บค': ['วันที่บันทึก', 'ประเภท', 'เลข', 'วันที่', 'รายการ', 'จำนวนเงิน', 'หมายเหตุ'],
    'จัดซื้อ_จัดจ้าง': ['วันที่บันทึก', 'ประเภท', 'เลข', 'วันที่', 'รายการ', 'จำนวนเงิน', 'หมายเหตุ']
  };

  const existingSheets = ss.getSheets().map(s => s.getName());
  let created = false;
  
  for (let name in sheetsNeeded) {
    const neededCols = sheetsNeeded[name].length;
    if (!existingSheets.includes(name)) {
      let sheet = ss.insertSheet(name);
      ensureSheetCapacity(sheet, 500, neededCols + 5);
      sheet.appendRow(sheetsNeeded[name]); 
      sheet.getRange(1, 1, 1, sheetsNeeded[name].length).setFontWeight("bold").setBackground("#E3F2FD");
      if (name === 'ตั้งค่า') {
        ensureSheetCapacity(sheet, 5, neededCols);
        sheet.appendRow([2569, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); 
      }
      created = true;
    } else {
      let sheet = ss.getSheetByName(name);
      if (sheet) {
        ensureSheetCapacity(sheet, null, neededCols);
      }
    }
  }
  
  // อัปเดตส่วนหัวของตารางรายจ่ายโครงการหากเปิดใช้จากเวอร์ชันเดิมที่ยังไม่มีคอลัมน์ปีงบประมาณ
  try {
    let expSheet = ss.getSheetByName('รายจ่ายโครงการ');
    if (expSheet) {
      ensureSheetCapacity(expSheet, 1, 7);
      if (expSheet.getLastColumn() < 7 || !expSheet.getRange(1, 7).getValue()) {
        expSheet.getRange(1, 7).setValue('ปีงบประมาณ').setFontWeight("bold").setBackground("#E3F2FD");
        created = true;
      }
    }
  } catch (err) {}

  if (created) SpreadsheetApp.flush();
}

/**
 * ดึงข้อมูลทั้งหมดจากทุกตาราง (โหลดเร็ว)
 */
function getAllData() {
  try {
    ensureSheetsExist();
    const ss = getSpreadsheet();
    
    const getSheetData = (name) => {
      let sheet = ss.getSheetByName(name);
      if (!sheet) {
        ensureSheetsExist();
        sheet = ss.getSheetByName(name);
      }
      if (!sheet) return [];
      const data = sheet.getDataRange().getDisplayValues(); 
      if (data.length <= 1) return [];
      let result = [];
      for (let i = 1; i < data.length; i++) {
        let hasData = data[i].some(cell => cell !== null && cell !== undefined && cell.toString().trim() !== '');
        if (!hasData) continue; 
        result.push({ rowNum: i + 1, data: data[i] });
      }
      return result;
    };

    let settingsData = [];
    const settingSheet = ss.getSheetByName('ตั้งค่า');
    if (settingSheet) {
      const sData = settingSheet.getDataRange().getValues();
      for (let i = 1; i < sData.length; i++) {
        if (sData[i][0]) {
          let kg1 = Number(sData[i][1]) || 0;
          let pr1 = Number(sData[i][2]) || 0;
          let kg2 = Number(sData[i][3]) || 0;
          let pr2 = Number(sData[i][4]) || 0;
          let eeef1 = Number(sData[i][5]) || 0;
          let eeef2 = Number(sData[i][6]) || 0;
          let pov1 = Number(sData[i][7]) || 0;
          let pov2 = Number(sData[i][8]) || 0;
          let estKg = sData[i][9] !== undefined && sData[i][9] !== "" ? Number(sData[i][9]) : (kg2 || kg1 || 0);
          let estPr = sData[i][10] !== undefined && sData[i][10] !== "" ? Number(sData[i][10]) : (pr2 || pr1 || 0);
          let estInc = sData[i][11] !== undefined && sData[i][11] !== "" ? Number(sData[i][11]) : 0;
          let estLun = sData[i][12] !== undefined && sData[i][12] !== "" ? Number(sData[i][12]) : 0;
          let estInt = sData[i][13] !== undefined && sData[i][13] !== "" ? Number(sData[i][13]) : 0;
          let allocDetails = null;
          if (sData[i][14]) {
            try { 
              allocDetails = typeof sData[i][14] === 'string' ? JSON.parse(sData[i][14]) : sData[i][14]; 
            } catch(e) {}
          }
          let ebudgetData = null;
          if (sData[i][15]) {
            try { 
              ebudgetData = typeof sData[i][15] === 'string' ? JSON.parse(sData[i][15]) : sData[i][15]; 
            } catch(e) {}
          }

          settingsData.push({ 
            fy: sData[i][0].toString(), 
            kg1: kg1, 
            pr1: pr1, 
            kg2: kg2, 
            pr2: pr2,
            eeef1: eeef1,
            eeef2: eeef2,
            pov1: pov1,
            pov2: pov2,
            estKg: estKg,
            estPr: estPr,
            estInc: estInc,
            estLun: estLun,
            estInt: estInt,
            allocDetails: allocDetails,
            ebudgetData: ebudgetData
          });
        }
      }
    }

    return {
      success: true,
      projects: getSheetData('โครงการ'),
      withdrawals: getSheetData('บันทึกขอเบิกงบประมาณ'),
      expenses: getSheetData('รายจ่ายโครงการ'),
      income: getSheetData('งบรายได้สถานศึกษา'),
      scholarship: getSheetData('ทุนนักเรียนยากจน'),
      lunch: getSheetData('อาหารกลางวัน'),
      interest: getSheetData('ดอกเบี้ย'),
      bjbk: getSheetData('บจ_บค'),
      purchasing: getSheetData('จัดซื้อ_จัดจ้าง'),
      settingsData: settingsData
    };
  } catch (error) { 
    return { success: false, error: error.toString() }; 
  }
}

/**
 * บันทึกค่าจำนวนนักเรียน และเงินประมาณการประจำปี รวมถึงยอดจัดสรรจริงรายรายการ
 */
function saveBudgetConfig(dataOrFy, kg1, pr1, kg2, pr2, eeef1, eeef2, pov1, pov2, estKg, estPr, estInc, estLun, estInt, allocDetails) {
  try {
    let fy, estKgVal, estPrVal, estIncVal, estLunVal, estIntVal;
    let kg1Val, pr1Val, kg2Val, pr2Val, eeef1Val, eeef2Val, pov1Val, pov2Val;
    let allocJson = "";
    
    if (typeof dataOrFy === 'object' && dataOrFy !== null) {
      fy = dataOrFy.fy;
      kg1Val = dataOrFy.kg1 || 0; pr1Val = dataOrFy.pr1 || 0;
      kg2Val = dataOrFy.kg2 || 0; pr2Val = dataOrFy.pr2 || 0;
      eeef1Val = dataOrFy.eeef1 || 0; eeef2Val = dataOrFy.eeef2 || 0;
      pov1Val = dataOrFy.pov1 || 0; pov2Val = dataOrFy.pov2 || 0;
      estKgVal = dataOrFy.estKg !== undefined ? dataOrFy.estKg : (dataOrFy.kg2 || dataOrFy.kg1 || 0);
      estPrVal = dataOrFy.estPr !== undefined ? dataOrFy.estPr : (dataOrFy.pr2 || dataOrFy.pr1 || 0);
      estIncVal = dataOrFy.estInc || 0;
      estLunVal = dataOrFy.estLun || 0;
      estIntVal = dataOrFy.estInt || 0;
      if (dataOrFy.allocDetails) {
        allocJson = typeof dataOrFy.allocDetails === 'object' ? JSON.stringify(dataOrFy.allocDetails) : dataOrFy.allocDetails.toString();
      }
    } else {
      fy = dataOrFy;
      kg1Val = kg1 || 0; pr1Val = pr1 || 0;
      kg2Val = kg2 || 0; pr2Val = pr2 || 0;
      eeef1Val = eeef1 || 0; eeef2Val = eeef2 || 0;
      pov1Val = pov1 || 0; pov2Val = pov2 || 0;
      estKgVal = estKg !== undefined ? estKg : (kg2 || kg1 || 0);
      estPrVal = estPr !== undefined ? estPr : (pr2 || pr1 || 0);
      estIncVal = estInc || 0;
      estLunVal = estLun || 0;
      estIntVal = estInt || 0;
      if (allocDetails) {
        allocJson = typeof allocDetails === 'object' ? JSON.stringify(allocDetails) : allocDetails.toString();
      }
    }

    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName('ตั้งค่า');
    if (!sheet) {
      ensureSheetsExist();
      sheet = ss.getSheetByName('ตั้งค่า');
    }
    const data = sheet.getDataRange().getValues();
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() == fy.toString()) {
        sheet.getRange(i + 1, 2).setValue(kg1Val);
        sheet.getRange(i + 1, 3).setValue(pr1Val);
        sheet.getRange(i + 1, 4).setValue(kg2Val);
        sheet.getRange(i + 1, 5).setValue(pr2Val);
        sheet.getRange(i + 1, 6).setValue(eeef1Val);
        sheet.getRange(i + 1, 7).setValue(eeef2Val);
        sheet.getRange(i + 1, 8).setValue(pov1Val);
        sheet.getRange(i + 1, 9).setValue(pov2Val);
        sheet.getRange(i + 1, 10).setValue(estKgVal);
        sheet.getRange(i + 1, 11).setValue(estPrVal);
        sheet.getRange(i + 1, 12).setValue(estIncVal);
        sheet.getRange(i + 1, 13).setValue(estLunVal);
        sheet.getRange(i + 1, 14).setValue(estIntVal);
        if (allocJson) {
          sheet.getRange(i + 1, 15).setValue(allocJson);
        }
        found = true; 
        break;
      }
    }
    ensureSheetCapacity(sheet, null, 16);
    if (!found) sheet.appendRow([
      fy, 
      kg1Val, pr1Val, 
      kg2Val, pr2Val,
      eeef1Val, eeef2Val,
      pov1Val, pov2Val,
      estKgVal, estPrVal,
      estIncVal, estLunVal, estIntVal,
      allocJson
    ]);
    SpreadsheetApp.flush();
    return getAllData();
  } catch (error) { 
    return { success: false, error: error.toString() }; 
  }
}

/**
 * บันทึกข้อมูลรายงาน Ebudget แยกตามปีงบประมาณ
 */
function saveEbudgetData(fy, ebudgetData) {
  try {
    ensureSheetsExist();
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName('ตั้งค่า');
    if (!sheet) {
      sheet = ss.insertSheet('ตั้งค่า');
    }
    ensureSheetCapacity(sheet, null, 16);
    
    // ตรวจสอบและตั้งชื่อหัวคอลัมน์ที่ 16 ถ้ายังไม่มี
    ensureSheetCapacity(sheet, null, 16);
    if (sheet.getLastColumn() < 16 || !sheet.getRange(1, 16).getValue()) {
      sheet.getRange(1, 16).setValue('Ebudget_Data_JSON').setFontWeight("bold").setBackground("#E3F2FD");
    }

    const data = sheet.getDataRange().getValues();
    let found = false;
    let ebudgetJson = typeof ebudgetData === 'object' ? JSON.stringify(ebudgetData) : (ebudgetData ? ebudgetData.toString() : '');
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() == fy.toString()) {
        sheet.getRange(i + 1, 16).setValue(ebudgetJson);
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([fy, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', ebudgetJson]);
    }
    SpreadsheetApp.flush();
    return getAllData();
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * บันทึกใบเบิกงบประมาณ และสร้างไฟล์ Google Docs ลงใน Folder ที่กำหนด
 */
function saveWithdrawalAndGenerateDoc(wd) {
  try {
    ensureSheetsExist();
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('บันทึกขอเบิกงบประมาณ');
    let docUrl = '';

    try {
      if (typeof WITHDRAW_DOC_TEMPLATE_ID !== 'undefined' && WITHDRAW_DOC_TEMPLATE_ID) {
        const templateFile = DriveApp.getFileById(WITHDRAW_DOC_TEMPLATE_ID);
        const folder = getTargetFolder();

        const newFile = templateFile.makeCopy(`ใบขอเบิก_${wd.project}_${wd.dateThai}`, folder);
        try { 
          newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); 
        } catch (e) {}

        const doc = DocumentApp.openById(newFile.getId());
        const body = doc.getBody();
        body.replaceText('{{dateThai}}', wd.dateThai || '');
        body.replaceText('{{project}}', wd.project || '');
        body.replaceText('{{owner}}', wd.owner || '');
        body.replaceText('{{detail}}', wd.detail || '');
        body.replaceText('{{activity}}', wd.activity || '');
        body.replaceText('{{dept}}', wd.dept || '');
        body.replaceText('{{source}}', wd.source || '');
        body.replaceText('{{amount}}', formatMoneyGAS(wd.amount));
        body.replaceText('{{amountThai}}', wd.amountThai || '');
        body.replaceText('{{fullBudget}}', formatMoneyGAS(wd.fullBudget));
        body.replaceText('{{taken}}', formatMoneyGAS(wd.taken));
        body.replaceText('{{remain}}', formatMoneyGAS(wd.remain));

        doc.saveAndClose();
        docUrl = newFile.getUrl();
      }
    } catch (docErr) {
      Logger.log('Could not generate withdraw doc in Drive: ' + docErr.toString());
    }

    sheet.appendRow([
      new Date().toLocaleString('th-TH'), 
      wd.dateThai, 
      wd.project, 
      wd.owner, 
      wd.detail, 
      wd.activity, 
      wd.dept, 
      wd.source, 
      wd.amount, 
      wd.amountThai, 
      wd.fullBudget, 
      wd.taken, 
      wd.remain, 
      docUrl
    ]);
    SpreadsheetApp.flush();

    let res = getAllData();
    res.url = docUrl;
    return res;
  } catch (error) { 
    return { success: false, error: error.toString() }; 
  }
}

/**
 * แก้ไขรายการขอเบิก ลบไฟล์เดิม และสร้างไฟล์ใหม่ลงใน Folder ที่กำหนด
 */
function editWithdrawalAndRegenerateDoc(rowNum, wd, oldDocUrl) {
  try {
    ensureSheetsExist(); 
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('บันทึกขอเบิกงบประมาณ');
    
    if (oldDocUrl) {
      try {
        let fileIdMatch = oldDocUrl.match(/[-\w]{25,}/); 
        if (fileIdMatch && fileIdMatch[0]) {
          DriveApp.getFileById(fileIdMatch[0]).setTrashed(true);
        }
      } catch (e) {}
    }

    let docUrl = oldDocUrl || '';
    try {
      if (typeof WITHDRAW_DOC_TEMPLATE_ID !== 'undefined' && WITHDRAW_DOC_TEMPLATE_ID) {
        const templateFile = DriveApp.getFileById(WITHDRAW_DOC_TEMPLATE_ID);
        const folder = getTargetFolder();
        const newFile = templateFile.makeCopy(`ใบขอเบิก(แก้ไข)_${wd.project}_${wd.dateThai}`, folder);
        try { 
          newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); 
        } catch (e) {}

        const doc = DocumentApp.openById(newFile.getId());
        const body = doc.getBody();
        body.replaceText('{{dateThai}}', wd.dateThai || '');
        body.replaceText('{{project}}', wd.project || '');
        body.replaceText('{{owner}}', wd.owner || '');
        body.replaceText('{{detail}}', wd.detail || '');
        body.replaceText('{{activity}}', wd.activity || '');
        body.replaceText('{{dept}}', wd.dept || '');
        body.replaceText('{{source}}', wd.source || '');
        body.replaceText('{{amount}}', formatMoneyGAS(wd.amount));
        body.replaceText('{{amountThai}}', wd.amountThai || '');
        body.replaceText('{{fullBudget}}', formatMoneyGAS(wd.fullBudget));
        body.replaceText('{{taken}}', formatMoneyGAS(wd.taken));
        body.replaceText('{{remain}}', formatMoneyGAS(wd.remain));

        doc.saveAndClose();
        docUrl = newFile.getUrl();
      }
    } catch (docErr) {
      Logger.log('Could not regenerate withdraw doc in Drive: ' + docErr.toString());
    }

    let rowValues = [
      wd.dateThai, 
      wd.project, 
      wd.owner, 
      wd.detail, 
      wd.activity, 
      wd.dept, 
      wd.source, 
      wd.amount, 
      wd.amountThai, 
      wd.fullBudget, 
      wd.taken, 
      wd.remain, 
      docUrl
    ];
    ensureSheetCapacity(sheet, rowNum, 14);
    sheet.getRange(rowNum, 2, 1, 13).setValues([rowValues]);
    SpreadsheetApp.flush();

    let res = getAllData();
    res.url = docUrl;
    return res;
  } catch (error) { 
    return { success: false, error: error.toString() }; 
  }
}

/**
 * เพิ่มโครงการใหม่
 */
function addProjectData(projectData) {
  try { 
    ensureSheetsExist();
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName('โครงการ');
    if (!sheet) {
      ensureSheetsExist();
      sheet = ss.getSheetByName('โครงการ');
    }
    const acadYear = projectData.year || projectData.academicYear || '2569';
    ensureSheetCapacity(sheet, null, 9);
    sheet.appendRow([
      new Date().toLocaleString('th-TH'), 
      projectData.name, 
      projectData.teacher, 
      projectData.dept, 
      projectData.source, 
      projectData.budget, 
      '-', 
      projectData.activities,
      acadYear
    ]); 
    SpreadsheetApp.flush(); 
    return getAllData(); 
  } catch (error) { 
    return { success: false, error: error.toString() }; 
  }
}

/**
 * คัดลอกโครงการทั้งหมดจากปีการศึกษาหนึ่ง ไปยังอีกปีการศึกษาหนึ่ง
 */
function cloneProjectsForYear(fromYear, toYear) {
  try {
    ensureSheetsExist();
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName('โครงการ');
    if (!sheet) return { success: false, error: 'ไม่พบชีตโครงการ' };
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: false, error: 'ไม่มีข้อมูลโครงการให้คัดลอก' };

    const fromYearStr = String(fromYear).trim();
    const toYearStr = String(toYear).trim();
    
    let rowsToAppend = [];
    for (let i = 1; i < data.length; i++) {
      let row = data[i];
      let rowYear = (row[8] !== undefined && row[8] !== null && String(row[8]).trim() !== '') 
        ? String(row[8]).trim() 
        : '2569';
      
      if (rowYear === fromYearStr) {
        let newRow = [
          new Date().toLocaleString('th-TH'),
          row[1],
          row[2],
          row[3],
          row[4],
          row[5],
          '-',
          row[7],
          toYearStr
        ];
        rowsToAppend.push(newRow);
      }
    }

    if (rowsToAppend.length === 0) {
      return { success: false, error: 'ไม่พบโครงการของปีการศึกษา ' + fromYear };
    }

    ensureSheetCapacity(sheet, sheet.getLastRow() + rowsToAppend.length + 10, 9);
    rowsToAppend.forEach(r => sheet.appendRow(r));
    SpreadsheetApp.flush();
    return getAllData();
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * บันทึกแถวข้อมูลทั่วไป
 */
function saveRecord(sheetName, rowData) {
  try { 
    ensureSheetsExist();
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      ensureSheetsExist();
      sheet = ss.getSheetByName(sheetName);
    }
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    const colCount = Array.isArray(rowData) ? rowData.length : 10;
    ensureSheetCapacity(sheet, null, colCount);
    sheet.appendRow(rowData); 
    SpreadsheetApp.flush(); 
    return getAllData(); 
  } catch (error) { 
    return { success: false, error: error.toString() }; 
  }
}

/**
 * ลบแถวข้อมูล
 */
function deleteRowData(sheetName, rowNum, isWd) {
  try { 
    ensureSheetsExist();
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, error: 'ไม่พบชีต ' + sheetName };
    
    if (isWd && sheetName === 'บันทึกขอเบิกงบประมาณ') {
      try {
        let docUrl = sheet.getRange(rowNum, 14).getValue();
        if (docUrl) {
          let fileIdMatch = docUrl.toString().match(/[-\w]{25,}/);
          if (fileIdMatch && fileIdMatch[0]) {
            DriveApp.getFileById(fileIdMatch[0]).setTrashed(true);
          }
        }
      } catch (e) {}
    }
    
    sheet.deleteRow(rowNum); 
    SpreadsheetApp.flush(); 
    return getAllData(); 
  } catch (error) { 
    return { success: false, error: error.toString() }; 
  }
}

/**
 * แก้ไขแถวข้อมูลตามคอลัมน์ที่ระบุ
 */
function updateRecordByRow(sheetName, rowNum, updates) {
  try { 
    ensureSheetsExist();
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(sheetName); 
    if (!sheet) return { success: false, error: 'ไม่พบชีต ' + sheetName };
    
    let maxCol = 10;
    if (Array.isArray(updates)) {
      updates.forEach(u => {
        if (u && u.col !== undefined) maxCol = Math.max(maxCol, Number(u.col));
      });
    } else if (typeof updates === 'object' && updates !== null) {
      for (let col in updates) {
        maxCol = Math.max(maxCol, parseInt(col, 10));
      }
    }
    ensureSheetCapacity(sheet, rowNum, maxCol);

    if (Array.isArray(updates)) {
      updates.forEach(u => {
        if (u && u.col !== undefined && u.val !== undefined) {
          sheet.getRange(rowNum, Number(u.col)).setValue(u.val);
        }
      });
    } else if (typeof updates === 'object' && updates !== null) {
      for (let col in updates) {
        sheet.getRange(rowNum, parseInt(col, 10)).setValue(updates[col]);
      }
    }
    SpreadsheetApp.flush(); 
    return getAllData(); 
  } catch (error) { 
    return { success: false, error: error.toString() }; 
  }
}

/**
 * ฟังก์ชันทดสอบการเชื่อมต่อ Google Sheets และ Google Drive Folder
 */
function testDatabaseConnection() {
  try {
    const ss = getSpreadsheet();
    Logger.log('เชื่อมต่อ Google Sheet สำเร็จ: ' + ss.getName());
    const folder = getTargetFolder();
    Logger.log('เชื่อมต่อ Drive Folder สำเร็จ: ' + folder.getName());
    ensureSheetsExist();
    Logger.log('ตรวจสอบโครงสร้างตารางเรียบร้อยพร้อมใช้งาน!');
    return 'เชื่อมต่อสำเร็จ: ' + ss.getName() + ' และโฟลเดอร์: ' + folder.getName();
  } catch (err) {
    Logger.log('เกิดข้อผิดพลาด: ' + err.toString());
    return 'เกิดข้อผิดพลาด: ' + err.toString();
  }
}
