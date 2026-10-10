const TV_CONFIG = {
  spreadsheetId: '',
  mediaFolderId: '',
  timezone: 'Asia/Jakarta',
  refreshSeconds: 60,
  slideSeconds: 10000,
  videoSlideSeconds: 60000,
  sheetNames: {
    sales: 'COPAS S2',
    targets: 'TARGET',
    departments: 'TV DEPARTEMEN',
    receipts: 'TV RECEIPT',
    products: 'INSENTIF BOOMSALE',
  },
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('AZKO TV Display')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
}

function getTvDisplayData() {
  if (!TV_CONFIG.spreadsheetId) {
    throw new Error('Isi TV_CONFIG.spreadsheetId di Code.gs dengan ID Spreadsheet sumber.')
  }

  const spreadsheet = SpreadsheetApp.openById(TV_CONFIG.spreadsheetId)
  const now = new Date()
  const salesRows = readSheet_(spreadsheet, TV_CONFIG.sheetNames.sales, true)
  const targetRows = readSheet_(spreadsheet, TV_CONFIG.sheetNames.targets, true)
  const departmentRows = readSheet_(spreadsheet, TV_CONFIG.sheetNames.departments, false)
  const receiptRows = readSheet_(spreadsheet, TV_CONFIG.sheetNames.receipts, false)
  const productRows = readSheet_(spreadsheet, TV_CONFIG.sheetNames.products, false)
  const rankings = buildRankings_(salesRows, targetRows, now)

  return {
    generatedAt: Utilities.formatDate(now, TV_CONFIG.timezone, "yyyy-MM-dd'T'HH:mm:ssXXX"),
    todayLabel: Utilities.formatDate(now, TV_CONFIG.timezone, 'yyyy-MM-dd'),
    refreshSeconds: TV_CONFIG.refreshSeconds,
    slideSeconds: TV_CONFIG.slideSeconds,
    videoSlideSeconds: TV_CONFIG.videoSlideSeconds,
    rankings: rankings.periods,
    departments: mapDepartmentRows_(departmentRows),
    receipts: mapReceiptRows_(receiptRows),
    products: mapEligibleProducts_(productRows, rankings.articleQty),
    media: listDriveMedia_(),
  }
}

function readSheet_(spreadsheet, name, required) {
  const sheet = spreadsheet.getSheetByName(name)
  if (!sheet) {
    if (required) throw new Error('Tab Spreadsheet wajib tidak ditemukan: "' + name + '".')
    return []
  }
  return sheet.getDataRange().getValues()
}

function buildRankings_(salesRows, targetRows, now) {
  if (salesRows.length < 2) throw new Error('Tab "' + TV_CONFIG.sheetNames.sales + '" belum berisi transaksi.')
  const salesHeaders = salesRows[0].map(normalizeHeader_)
  const targetHeaders = (targetRows[0] || []).map(normalizeHeader_)
  const salesIndex = {
    nik: findHeader_(salesHeaders, [/^NIK$/], 0),
    name: findHeader_(salesHeaders, [/^NAMA$/, /^NAME$/], 1),
    receipt: findHeader_(salesHeaders, [/RECEIPT/], 3),
    article: findHeader_(salesHeaders, [/ARTIKEL/, /^SKU$/], 4),
    qty: findHeader_(salesHeaders, [/^(QTY|QUANTITY)$/, /^(QTY ACTUAL|ACTUAL QTY|QTY SOLD|SOLD QTY)$/], 7),
    value: findHeader_(salesHeaders, [/TOTAL VALUE/, /SALES VALUE/, /^VALUE$/, /NILAI PENJUALAN/], 11),
    date: findHeader_(salesHeaders, [/TANGGAL/, /^DATE$/, /TRANSACTION DATE/], 13),
  }
  const targetIndex = {
    nik: findHeader_(targetHeaders, [/^NIK$/], 0),
    name: findHeader_(targetHeaders, [/^NAMA$/, /^NAME$/], 1),
    daily: findHeader_(targetHeaders, [/TARGET SALES DAILY/, /TARGET HARIAN/], 2),
    monthly: findHeader_(targetHeaders, [/TARGET SALES BULAN/, /TARGET SATU BULAN/, /TARGET MONTH/], 3),
    mtd: findHeader_(targetHeaders, [/TARGET MTD KARYAWAN/, /TARGET MTD/], 9),
    job: findHeader_(targetHeaders, [/JOB TITLE/, /JABATAN/], 8),
  }

  const employees = new Map()
  for (const row of targetRows.slice(1)) {
    const nik = cell_(row, targetIndex.nik)
    const name = cell_(row, targetIndex.name)
    if (!nik && !name) continue
    const key = normalizePersonKey_(nik || name)
    employees.set(key, {
      nik: String(nik || ''),
      name: String(name || nik || 'Nama belum tersedia'),
      jobTitle: String(cell_(row, targetIndex.job) || ''),
      dailyTarget: toNumber_(row[targetIndex.daily]),
      monthlyTarget: toNumber_(row[targetIndex.monthly]),
      mtdTarget: toNumber_(row[targetIndex.mtd]),
      today: 0,
      mtd: 0,
    })
  }

  let previousNik = ''
  let previousName = ''
  const articleQty = new Map()
  const todayKey = Utilities.formatDate(now, TV_CONFIG.timezone, 'yyyy-MM-dd')
  for (const row of salesRows.slice(1)) {
    const nikValue = cell_(row, salesIndex.nik)
    const nameValue = cell_(row, salesIndex.name)
    if (nikValue) previousNik = String(nikValue)
    if (nameValue) previousName = String(nameValue)
    const nik = previousNik
    const name = previousName
    if (!nik && !name) continue

    const date = parseDate_(row[salesIndex.date])
    if (!date) continue
    const dateKey = Utilities.formatDate(date, TV_CONFIG.timezone, 'yyyy-MM-dd')

    const key = normalizePersonKey_(nik || name)
    if (!employees.has(key)) {
      employees.set(key, {
        nik: nik,
        name: name || nik,
        jobTitle: '',
        dailyTarget: 0,
        monthlyTarget: 0,
        mtdTarget: 0,
        today: 0,
        mtd: 0,
      })
    }
    const employee = employees.get(key)
    const salesValue = toNumber_(row[salesIndex.value])
    employee.mtd += salesValue
    if (dateKey === todayKey) employee.today += salesValue

    const article = normalizeArticle_(cell_(row, salesIndex.article))
    if (article) articleQty.set(article, (articleQty.get(article) || 0) + toNumber_(row[salesIndex.qty]))
  }

  const [year, month] = todayKey.slice(0, 7).split('-').map(Number)
  const monthDays = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const elapsedDays = Number(todayKey.slice(8, 10))
  const toRanking = function (period) {
    return Array.from(employees.values())
      .filter(function (employee) { return employee.today || employee.mtd || employee.dailyTarget || employee.monthlyTarget })
      .map(function (employee) {
        const actual = period === 'today' ? employee.today : employee.mtd
        let target = period === 'today' ? employee.dailyTarget : employee.monthlyTarget
        if (period === 'mtd') {
          target = employee.mtdTarget || (employee.monthlyTarget ? employee.monthlyTarget * elapsedDays / monthDays : 0)
        }
        if (period === 'fullmonth') target = employee.monthlyTarget
        return {
          nik: employee.nik,
          nama: employee.name,
          jobTitle: employee.jobTitle,
          value: actual,
          target: target,
          achievement: target > 0 ? actual / target * 100 : 0,
        }
      })
      .sort(function (left, right) {
        return right.achievement - left.achievement || right.value - left.value || left.nama.localeCompare(right.nama)
      })
      .map(function (employee, index) {
        employee.rank = index + 1
        return employee
      })
  }

  const plainArticleQty = {}
  articleQty.forEach(function (qty, article) { plainArticleQty[article] = qty })
  return {
    periods: {
      today: toRanking('today'),
      mtd: toRanking('mtd'),
      fullMonth: toRanking('fullmonth'),
    },
    articleQty: plainArticleQty,
  }
}

function mapDepartmentRows_(rows) {
  if (rows.length < 2) return []
  const headers = rows[0].map(normalizeHeader_)
  const index = {
    name: findHeader_(headers, [/^DEPARTMENT$/, /^DEPARTEMEN$/, /^NAMA DEPARTEMEN$/], 0),
    zone: findHeader_(headers, [/^ZONE$/, /^ZONA$/], 1),
    today: findHeader_(headers, [/SALES TODAY/, /PENJUALAN HARI INI/, /^TODAY$/], 2),
    todayTarget: findHeader_(headers, [/TARGET TODAY/, /TARGET HARIAN/], 3),
    mtd: findHeader_(headers, [/SALES MTD/, /PENJUALAN MTD/, /^MTD$/], 4),
    mtdTarget: findHeader_(headers, [/TARGET MTD/], 5),
  }
  return rows.slice(1).filter(function (row) { return cell_(row, index.name) }).map(function (row) {
    const today = toNumber_(row[index.today])
    const todayTarget = toNumber_(row[index.todayTarget])
    const mtd = toNumber_(row[index.mtd])
    const mtdTarget = toNumber_(row[index.mtdTarget])
    return {
      name: String(cell_(row, index.name)),
      zone: String(cell_(row, index.zone) || ''),
      today: today,
      todayTarget: todayTarget,
      todayAchievement: todayTarget > 0 ? today / todayTarget * 100 : 0,
      mtd: mtd,
      mtdTarget: mtdTarget,
      mtdAchievement: mtdTarget > 0 ? mtd / mtdTarget * 100 : 0,
    }
  }).sort(function (a, b) { return b.mtdAchievement - a.mtdAchievement })
}

function mapReceiptRows_(rows) {
  if (rows.length < 2) return []
  const headers = rows[0].map(normalizeHeader_)
  const index = {
    nik: findHeader_(headers, [/^NIK$/], 0),
    name: findHeader_(headers, [/^NAMA$/, /^NAME$/], 1),
    qualifying: findHeader_(headers, [/QUALIFYING RECEIPT/, /^RECEIPT$/], 2),
    minimum: findHeader_(headers, [/TARGET MINIMAL CAIR/, /MINIMUM RECEIPT/], 3),
    progress: findHeader_(headers, [/PROGRESS/], 4),
    value: findHeader_(headers, [/TOTAL VALUE RECEIPT/, /RECEIPT VALUE/], 5),
    incentivePerReceipt: findHeader_(headers, [/INSENTIF PER RECEIPT/, /INCENTIVE PER RECEIPT/], 6),
    totalIncentive: findHeader_(headers, [/TOTAL INSENTIF/, /TOTAL INCENTIVE/], 7),
    status: findHeader_(headers, [/^STATUS$/], 8),
  }
  return rows.slice(1).filter(function (row) { return cell_(row, index.name) || cell_(row, index.nik) }).map(function (row) {
    const qualifying = toNumber_(row[index.qualifying])
    const minimum = toNumber_(row[index.minimum])
    const rawProgress = toNumber_(row[index.progress])
    const progressValue = rawProgress >= 0 && rawProgress <= 1 ? rawProgress * 100 : rawProgress
    return {
      nik: String(cell_(row, index.nik) || ''),
      nama: String(cell_(row, index.name) || ''),
      qualifyingReceipt: qualifying,
      targetMinimalCair: minimum,
      progress: Math.min(100, progressValue || (minimum > 0 ? qualifying / minimum * 100 : 0)),
      totalValueReceipt: toNumber_(row[index.value]),
      incentivePerReceipt: toNumber_(row[index.incentivePerReceipt]),
      totalIncentive: toNumber_(row[index.totalIncentive]),
      status: String(cell_(row, index.status) || ''),
    }
  }).sort(function (a, b) { return b.qualifyingReceipt - a.qualifyingReceipt })
}

function mapEligibleProducts_(productRows, articleTotals) {
  if (productRows.length < 2) return []
  const headers = productRows[0].map(normalizeHeader_)
  const index = {
    article: findHeader_(headers, [/ARTIKEL/, /^SKU$/], 2),
    name: findHeader_(headers, [/NAMA PRODUK/, /^PRODUCT NAME$/, /^NAMA$/], 3),
    target: findHeader_(headers, [/QTY PENJUALAN TOKO/, /TARGET QTY/, /TARGET QUANTITY/, /TARGET KUANTITAS/, /^TARGET$/, /QTY TARGET/], 13),
    image: findHeader_(headers, [/IMAGE/, /GAMBAR/, /PHOTO/], 16),
  }
  articleTotals = articleTotals || {}
  return productRows.slice(1).map(function (row) {
    const article = String(cell_(row, index.article) || '')
    const targetQty = toNumber_(row[index.target])
    const actualQty = articleTotals[normalizeArticle_(article)] || 0
    return {
      article: article,
      name: String(cell_(row, index.name) || article),
      targetQty: targetQty,
      actualQty: actualQty,
      imageUrl: String(cell_(row, index.image) || ''),
    }
  }).filter(function (product) {
    return product.article && product.targetQty > 0 && product.actualQty >= product.targetQty
  }).sort(function (a, b) { return b.actualQty - a.actualQty || a.name.localeCompare(b.name) })
}

function listDriveMedia_() {
  if (!TV_CONFIG.mediaFolderId) return []
  const folder = DriveApp.getFolderById(TV_CONFIG.mediaFolderId)
  const files = folder.getFiles()
  const media = []
  while (files.hasNext()) {
    const file = files.next()
    const mimeType = file.getMimeType()
    const isImage = mimeType.indexOf('image/') === 0
    const isVideo = mimeType.indexOf('video/') === 0
    const isPdf = mimeType === 'application/pdf'
    if (!isImage && !isVideo && !isPdf) continue
    const id = file.getId()
    media.push({
      id: id,
      name: file.getName(),
      mimeType: mimeType,
      type: isVideo ? 'video' : isPdf ? 'pdf' : 'image',
      url: isVideo || isPdf
        ? 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/preview'
        : 'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(id),
    })
  }
  return media.sort(function (a, b) { return a.name.localeCompare(b.name) })
}

function normalizeHeader_(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/\s+/g, ' ')
}

function findHeader_(headers, patterns, fallback) {
  for (let i = 0; i < headers.length; i++) {
    if (patterns.some(function (pattern) { return pattern.test(headers[i]) })) return i
  }
  return fallback
}

function cell_(row, index) {
  return index >= 0 && index < row.length ? row[index] : ''
}

function normalizePersonKey_(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function normalizeArticle_(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function toNumber_(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value instanceof Date || value === null || value === '') return 0
  const text = String(value).replace(/Rp\.?\s*/gi, '').replace(/\s/g, '')
  const normalized = text.indexOf(',') >= 0
    ? text.replace(/\./g, '').replace(',', '.')
    : text.replace(/,/g, '')
  const number = Number(normalized)
  return Number.isFinite(number) ? number : 0
}

function parseDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value
  const text = String(value || '').trim()
  if (!text) return null
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (match) return validDate_(Number(match[1]), Number(match[2]), Number(match[3]))
  match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (match) return validDate_(Number(match[3]), Number(match[2]), Number(match[1]))
  match = text.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[-\s](\d{4})$/)
  if (match) {
    const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12, mei: 5, agu: 8, okt: 10, des: 12 }
    const month = months[match[2].toLowerCase()]
    return month ? validDate_(Number(match[3]), month, Number(match[1])) : null
  }
  return null
}

function validDate_(year, month, day) {
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null
}

function doGetDataHealthCheck() {
  return {
    configured: Boolean(TV_CONFIG.spreadsheetId),
    spreadsheetId: TV_CONFIG.spreadsheetId ? 'configured' : 'missing',
    mediaFolderId: TV_CONFIG.mediaFolderId ? 'configured' : 'optional',
  }
}
