const MGB_SPREADSHEET_ID = '1fb5npFi1sEBYH5GleyP8FNj9W5bqq2AQU6cbyIsnoRM'
const MGB_SHEET_GID = 1811367346
const MGB_DEPARTMENT_SHEET_NAME = 'DEPARTEMEN'
const MGB_TIME_ZONE = 'Asia/Jakarta'
const MGB_PHOTO_THUMBNAIL_SIZE = 240

function doGet(event) {
  const callback = String(event.parameter.callback || '')
  if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService.createTextOutput('Invalid callback').setMimeType(ContentService.MimeType.TEXT)
  }

  try {
    const nik = normalizeNik_(event.parameter.nik || '')
    if (!nik) throw new Error('NIK wajib diisi.')
    const data = getYesterdayDepartmentReviews_(nik)
    return jsonp_(callback, { data: data })
  } catch (error) {
    return jsonp_(callback, { error: error instanceof Error ? error.message : String(error) })
  }
}

function getYesterdayDepartmentReviews_(requestedNik) {
  const spreadsheet = SpreadsheetApp.openById(MGB_SPREADSHEET_ID)
  const sheet = spreadsheet.getSheets().find(item => item.getSheetId() === MGB_SHEET_GID)
  if (!sheet) throw new Error('Sheet ONE DAY TWO SECTION tidak ditemukan.')
  const departmentSheet = spreadsheet.getSheetByName(MGB_DEPARTMENT_SHEET_NAME)
  if (!departmentSheet) throw new Error('Sheet DEPARTEMEN tidak ditemukan.')

  const departmentLastRow = departmentSheet.getLastRow()
  if (departmentLastRow === 0) throw new Error('Sheet DEPARTEMEN belum berisi data.')
  const departmentRows = departmentSheet.getRange(1, 1, departmentLastRow, 3).getDisplayValues()
  const department = departmentRows
    .find(row => normalizeNik_(row[0]) === requestedNik && String(row[2] || '').trim())
  if (!department) throw new Error('NIK tidak ditemukan di kolom A sheet DEPARTEMEN.')
  const userDepartment = String(department[2]).trim()

  const yesterday = Utilities.formatDate(new Date(Date.now() - 24 * 60 * 60 * 1000), MGB_TIME_ZONE, 'yyyy-MM-dd')
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return []
  const dateValues = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues()
  const yesterdayRowNumbers = []
  dateValues.forEach((row, index) => {
    if (dateKey_(row[0], row[0]) === yesterday) yesterdayRowNumbers.push(index + 2)
  })
  if (!yesterdayRowNumbers.length) return []

  const firstRow = yesterdayRowNumbers[0]
  const finalRow = yesterdayRowNumbers[yesterdayRowNumbers.length - 1]
  const yesterdayRange = sheet.getRange(firstRow, 1, finalRow - firstRow + 1, 17)
  const values = yesterdayRange.getValues()
  const formulas = yesterdayRange.getFormulas()
  const displayValues = yesterdayRange.getDisplayValues()
  const reviews = []
  values.forEach((row, index) => {
    if (dateKey_(row[0], displayValues[index][0]) !== yesterday) return
    if (normalizeText_(row[3]) !== normalizeText_(userDepartment)) return

    const reviewed = row[9] || row[10] || row[11] || row[12] || row[13] || row[14] || row[15] || row[16]
    if (!reviewed) return
    const mgbPhotos = [4, 5, 6].map(column => imageUrl_(row[column], formulas[index][column]))
    const checkerPhotos = [11, 12, 13].map(column => imageUrl_(row[column], formulas[index][column]))

    reviews.push({
      date: displayValues[index][0],
      nik: String(row[1] || '').trim(),
      name: String(row[2] || '').trim(),
      department: String(row[3] || '').trim(),
      mgbPhotos: mgbPhotos,
      checkerPhotos: checkerPhotos,
      score: String(row[14] || '').trim(),
      category: String(row[15] || '').trim(),
      note: String(row[16] || '').trim(),
    })
  })

  return reviews
}

function imageUrl_(value, formula) {
  let url = ''
  if (value && typeof value.getContentUrl === 'function') {
    url = value.getContentUrl()
  } else if (typeof formula === 'string') {
    const imageFormula = formula.match(/^=IMAGE\(\s*"([^"]+)"/i)
    if (imageFormula) url = imageFormula[1]
  } else if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
    url = value.trim()
  }
  if (!url) return ''

  if (/^https?:\/\/(?:[^/]+\.)?googleusercontent\.com(?:\/|$)/i.test(url)) {
    const parts = url.match(/^([^?#]+)(\?[^#]*)?(#.*)?$/)
    if (parts) {
      const path = parts[1].replace(/=(?:s|w|h)\d+(?:-[a-z0-9-]+)*$/i, '')
      url = path + '=s' + MGB_PHOTO_THUMBNAIL_SIZE + (parts[2] || '') + (parts[3] || '')
    }
  }
  return url
}

function dateKey_(value, displayValue) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, MGB_TIME_ZONE, 'yyyy-MM-dd')
  }

  const text = String(displayValue || value || '').trim()
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (match) return match[1] + '-' + pad2_(match[2]) + '-' + pad2_(match[3])
  match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (match) return match[3] + '-' + pad2_(match[2]) + '-' + pad2_(match[1])
  return ''
}

function normalizeNik_(value) {
  return String(value || '').trim().toUpperCase()
}

function normalizeText_(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function pad2_(value) {
  return ('0' + value).slice(-2)
}

function jsonp_(callback, payload) {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c')
  return ContentService.createTextOutput(callback + '(' + json + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT)
}
