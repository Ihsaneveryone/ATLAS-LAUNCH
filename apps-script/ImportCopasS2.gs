function doGet(e) {
  try {

    // ── Menu config (dari admin panel ATLAS) ──────────────────────
    if (e.parameter.action === 'menuConfig') {

      var key = e.parameter.key;
      var val = e.parameter.val;

      var ss2 = SpreadsheetApp.openById(
        '1mNGKDPFNnF1Ca0CtNzyriwTE8zjuwdJei0RafXxna38'
      );

      var sett = ss2.getSheetByName('SETTING');

      if (sett) {

        var rows = sett.getDataRange().getValues();
        var found = false;

        for (var i = 0; i < rows.length; i++) {

          if (rows[i][0] === 'CONFIG' && rows[i][1] === key) {

            sett.getRange(i + 1, 3)
              .setValue(val === 'true' ? 'TRUE' : 'FALSE');

            found = true;
            break;
          }
        }

        if (!found) {

          sett.appendRow([
            'CONFIG',
            key,
            val === 'true' ? 'TRUE' : 'FALSE',
            'Diset dari admin panel'
          ]);

        }
      }

      return out({
        ok: true,
        action: 'menuConfig',
        key: key,
        val: val
      });
    }


    // ── Login tracker ─────────────────────────────────────────────
    var nik = e.parameter.nik || '';
    var nama = e.parameter.nama || '';

    if (!nik) {
      return out({
        error: 'no nik'
      });
    }

    recordLogin(nik, nama);

    return out({
      ok: true
    });


  } catch (err) {

    return out({
      error: String(err)
    });

  }
}



// ================================================================
// RECORD LOGIN
// ================================================================

function recordLogin(nik, nama) {

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheet = ss.getSheetByName('DATA LOGIN');

  if (!sheet) {
    sheet = ss.insertSheet('DATA LOGIN');
  }


  var today = Utilities.formatDate(
    new Date(),
    'Asia/Jakarta',
    'dd/MM/yyyy'
  );


  // Header
  if (!sheet.getRange(1, 1).getValue()) {

    sheet.getRange(1, 1).setValue('NIK');
    sheet.getRange(1, 2).setValue('NAMA');

  }


  var lastCol = Math.max(
    sheet.getLastColumn(),
    2
  );


  // Cari kolom tanggal hari ini
  var todayCol = -1;


  if (lastCol >= 3) {

    var headers = sheet
      .getRange(
        1,
        3,
        1,
        lastCol - 2
      )
      .getValues()[0];


    for (var i = 0; i < headers.length; i++) {

      var cellDate =
        headers[i] instanceof Date
          ? Utilities.formatDate(
              headers[i],
              'Asia/Jakarta',
              'dd/MM/yyyy'
            )
          : String(headers[i]).trim();


      if (cellDate === today) {

        todayCol = i + 3;
        break;

      }

    }

  }


  // Kalau tanggal belum ada
  if (todayCol === -1) {

    todayCol = lastCol + 1;

    sheet
      .getRange(1, todayCol)
      .setValue(today);

    sheet
      .getRange(1, todayCol)
      .setNumberFormat('@');

  }


  // Cari NIK
  var lastRow = Math.max(
    sheet.getLastRow(),
    1
  );

  var nikRow = -1;


  if (lastRow >= 2) {

    var niks = sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        1
      )
      .getValues();


    for (var j = 0; j < niks.length; j++) {

      if (
        String(niks[j][0]).trim() ===
        String(nik).trim()
      ) {

        nikRow = j + 2;
        break;

      }

    }

  }


  // NIK baru
  if (nikRow === -1) {

    nikRow = lastRow + 1;

    sheet
      .getRange(nikRow, 1)
      .setValue(nik);

    sheet
      .getRange(nikRow, 2)
      .setValue(nama);

  }


  // Tambah jumlah login
  var cell = sheet.getRange(
    nikRow,
    todayCol
  );

  cell.setValue(
    (Number(cell.getValue()) || 0) + 1
  );

}



// ================================================================
// IMPORT REPORT - COPAS S2
// ================================================================

function importReport() {

  // ==============================================================
  // LOCK
  // Mencegah trigger 1 menit berjalan bersamaan
  // ==============================================================

  var lock = LockService.getScriptLock();


  if (!lock.tryLock(1000)) {

    Logger.log(
      'Import sebelumnya masih berjalan. SKIP.'
    );

    return;

  }


  try {

    // ============================================================
    // ID SPREADSHEET
    // ============================================================

    var SOURCE_ID =
      '1CBz9oPc9FMiEu545NX-wJZl_fzUsX_rqggtVwaAlM7k';

    var DEST_ID =
      '1mNGKDPFNnF1Ca0CtNzyriwTE8zjuwdJei0RafXxna38';


    var SOURCE_SHEET =
      'SALES_DATA';

    var DEST_SHEET =
      'COPAS S2';


    // ============================================================
    // BUKA SHEET
    // ============================================================

    var sourceSS =
      SpreadsheetApp.openById(SOURCE_ID);

    var destSS =
      SpreadsheetApp.openById(DEST_ID);


    var sourceSheet =
      sourceSS.getSheetByName(SOURCE_SHEET);

    var destSheet =
      destSS.getSheetByName(DEST_SHEET);


    // ============================================================
    // VALIDASI SHEET
    // ============================================================

    if (!sourceSheet) {

      throw new Error(
        'Sheet source COPAS S2 tidak ditemukan.'
      );

    }


    if (!destSheet) {

      throw new Error(
        'Sheet destination COPAS S2 tidak ditemukan.'
      );

    }


    // ============================================================
    // UKURAN DATA SOURCE
    // ============================================================

    var lastRow =
      sourceSheet.getLastRow();

    var lastCol =
      sourceSheet.getLastColumn();


    Logger.log(
      'Source Last Row : ' + lastRow
    );

    Logger.log(
      'Source Last Col : ' + lastCol
    );


    if (
      lastRow < 2 ||
      lastCol < 5
    ) {

      Logger.log(
        'Data source tidak mencukupi.'
      );

      return;

    }


    // ============================================================
    // AMBIL DATA SOURCE
    // ============================================================

    var sourceData =
      sourceSheet
        .getRange(
          1,
          1,
          lastRow,
          lastCol
        )
        .getDisplayValues();


    if (
      !sourceData ||
      sourceData.length === 0
    ) {

      Logger.log(
        'Source data kosong.'
      );

      return;

    }


    var header =
      sourceData[0];

    var dataSource =
      sourceData.slice(1);


    if (
      !header ||
      header.length === 0
    ) {

      throw new Error(
        'Header source tidak ditemukan.'
      );

    }


    Logger.log(
      'Jumlah Data Source : ' +
      dataSource.length
    );


    // ============================================================
    // DATA DESTINATION
    // ============================================================

    var destLastRow =
      destSheet.getLastRow();

    var destData = [];


    if (
      destLastRow >= 2
    ) {

      destData =
        destSheet
          .getRange(
            2,
            1,
            destLastRow - 1,
            lastCol
          )
          .getDisplayValues();

    }


    Logger.log(
      'Jumlah Data Destination : ' +
      destData.length
    );


    // ============================================================
    // FUNGSI KEY
    //
    // D = kolom 4 = index 3
    // E = kolom 5 = index 4
    //
    // D + E digunakan sebagai ID data
    // ============================================================

    function getKey(row) {

      if (
        !row ||
        row.length < 5
      ) {

        return '||';

      }


      var kolomD =
        String(
          row[3] === undefined ||
          row[3] === null
            ? ''
            : row[3]
        ).trim();


      var kolomE =
        String(
          row[4] === undefined ||
          row[4] === null
            ? ''
            : row[4]
        ).trim();


      if (
        kolomD === '' &&
        kolomE === ''
      ) {

        return '||';

      }


      return (
        kolomD +
        '||' +
        kolomE
      );

    }


    // ============================================================
    // BUAT INDEX DATA DESTINATION
    //
    // Semua duplicate key disimpan.
    // Tidak hanya index pertama.
    // ============================================================

    var destIndex = {};


    for (
      var i = 0;
      i < destData.length;
      i++
    ) {

      var destRow =
        destData[i];


      if (
        !destRow
      ) {

        continue;

      }


      var key =
        getKey(destRow);


      if (
        key !== '||'
      ) {

        if (
          destIndex[key] === undefined
        ) {

          destIndex[key] = [];

        }

        destIndex[key].push(i);

      }

    }


    Logger.log(
      'Jumlah Key Destination : ' +
      Object.keys(destIndex).length
    );


    // ============================================================
    // COUNTER
    // ============================================================

    var newRows = [];

    var updateCount = 0;

    var skipCount = 0;

    var invalidCount = 0;

    var duplicateSourceCount = 0;


    // ============================================================
    // TRACK DESTINATION ROW YANG SUDAH DIGUNAKAN
    //
    // Jika ada duplicate D+E:
    //
    // SOURCE:
    // A B 10
    // A B 20
    // A B 30
    //
    // DEST:
    // A B 10
    // A B 20
    //
    // Maka source ketiga tetap akan ditambahkan.
    // ============================================================

    var usedDestRows = {};


    // ============================================================
    // PROSES SOURCE
    // ============================================================

    for (
      var i = 0;
      i < dataSource.length;
      i++
    ) {

      var sourceRow =
        dataSource[i];


      // ==========================================================
      // VALIDASI ROW
      // ==========================================================

      if (
        !sourceRow ||
        sourceRow.length < 5
      ) {

        invalidCount++;

        continue;

      }


      // ==========================================================
      // KEY
      // ==========================================================

      var key =
        getKey(sourceRow);


      // ==========================================================
      // SKIP JIKA KEY KOSONG
      // ==========================================================

      if (
        key === '||'
      ) {

        invalidCount++;

        continue;

      }


      // ==========================================================
      // CARI DATA DENGAN KEY YANG SAMA
      // ==========================================================

      var matchingRows =
        destIndex[key] || [];


      var destIndexRow = -1;


      // Cari destination row yang belum dipakai
      for (
        var m = 0;
        m < matchingRows.length;
        m++
      ) {

        var candidate =
          matchingRows[m];


        if (
          !usedDestRows[candidate]
        ) {

          destIndexRow =
            candidate;

          break;

        }

      }


      // ==========================================================
      // DATA SUDAH ADA DI DESTINATION
      // ==========================================================

      if (
        destIndexRow !== -1
      ) {

        usedDestRows[destIndexRow] = true;


        // ========================================================
        // SAFETY CHECK
        // ========================================================

        if (
          destIndexRow < 0 ||
          destIndexRow >= destData.length ||
          !destData[destIndexRow]
        ) {

          Logger.log(
            'WARNING: Index destination tidak valid: ' +
            key
          );

          continue;

        }


        var berbeda =
          false;


        // ========================================================
        // BANDINGKAN SELURUH KOLOM
        // ========================================================

        for (
          var c = 0;
          c < lastCol;
          c++
        ) {

          var destValue =
            destData[destIndexRow][c];


          var sourceValue =
            sourceRow[c];


          destValue =
            destValue === undefined ||
            destValue === null
              ? ''
              : String(destValue);


          sourceValue =
            sourceValue === undefined ||
            sourceValue === null
              ? ''
              : String(sourceValue);


          if (
            destValue !== sourceValue
          ) {

            berbeda = true;

            break;

          }

        }


        // ========================================================
        // DATA BERUBAH → UPDATE
        // ========================================================

        if (
          berbeda
        ) {

          destData[destIndexRow] =
            sourceRow;

          updateCount++;

        }


        // ========================================================
        // DATA SAMA → SKIP
        // ========================================================

        else {

          skipCount++;

        }

      }


      // ==========================================================
      // DATA BELUM ADA
      //
      // ATAU JUMLAH DUPLICATE SOURCE LEBIH BANYAK
      //
      // TETAP TAMBAHKAN.
      // ==========================================================

      else {

        newRows.push(
          sourceRow
        );


        // Hanya sebagai informasi log.
        // Tidak digunakan untuk menghapus data.
        if (
          matchingRows.length > 0
        ) {

          duplicateSourceCount++;

        }

      }

    }


    // ============================================================
    // SINKRONKAN DESTINATION PENUH DENGAN SOURCE
    //
    // Polanya seperti IMPORTRANGE: setiap import, isi COPAS S2
    // diganti dengan seluruh isi SALES_DATA saat ini.
    // ============================================================

    destSheet.clearContents();

    destSheet
      .getRange(
        1,
        1,
        sourceData.length,
        lastCol
      )
      .setValues(
        sourceData
      );

    Logger.log(
      'COPAS S2 disinkronkan: ' +
      sourceData.length +
      ' baris dari SALES_DATA.'
    );


    // ============================================================
    // LOG
    // ============================================================

    Logger.log(
      '===================================='
    );

    Logger.log(
      'IMPORT COPAS S2 SELESAI'
    );

    Logger.log(
      'Source Row       : ' +
      dataSource.length
    );

    Logger.log(
      'Data Baru        : ' +
      newRows.length
    );

    Logger.log(
      'Data Update      : ' +
      updateCount
    );

    Logger.log(
      'Data Sama        : ' +
      skipCount
    );

    Logger.log(
      'Invalid Data     : ' +
      invalidCount
    );

    Logger.log(
      'Duplicate Source : ' +
      duplicateSourceCount
    );

    Logger.log(
      '===================================='
    );


  } catch (err) {

    Logger.log(
      'ERROR IMPORT REPORT: ' +
      String(err)
    );

    throw err;


  } finally {

    // ==========================================================
    // LEPAS LOCK
    // ==========================================================

    lock.releaseLock();

  }

}



// ================================================================
// IMPORT MEMBER
// ================================================================

function importMember() {

  var DEST_ID =
    '1mNGKDPFNnF1Ca0CtNzyriwTE8zjuwdJei0RafXxna38';

  var DEST_SHEET =
    'MEMBER';


  var dest =
    SpreadsheetApp
      .openById(DEST_ID)
      .getSheetByName(DEST_SHEET);


  // Bersihkan isi sheet
  dest.clearContents();


  // ============================================================
  // A:F
  // ============================================================

  var source1 =
    SpreadsheetApp
      .openById(
        '1EjEMtkc_QYRr0u12xb8mfwJRJwClXLSo-cR3hD2Jotg'
      )
      .getSheetByName(
        'JULI 2026'
      );


  var data1 =
    source1
      .getDataRange()
      .getValues();


  dest
    .getRange(
      1,
      1,
      data1.length,
      data1[0].length
    )
    .setValues(
      data1
    );


  // ============================================================
  // H:M
  // ============================================================

  var source2 =
    SpreadsheetApp
      .openById(
        '1HoFwFzSStsucIRTthPVMs0fSYeK1cKnz_W_elTvbRXg'
      )
      .getSheetByName(
        'Form Responses 4'
      );


  var data2 =
    source2
      .getDataRange()
      .getValues();


  // Mulai dari kolom H
  dest
    .getRange(
      1,
      8,
      data2.length,
      data2[0].length
    )
    .setValues(
      data2
    );


  Logger.log(
    'Import MEMBER selesai.'
  );

}



// ================================================================
// IMPORT PENCAPAIAN TOKO
// ================================================================

function importPencapaianToko() {

  var SOURCE_ID =
    '1CBz9oPc9FMiEu545NX-wJZl_fzUsX_rqggtVwaAlM7k';

  var DEST_ID =
    '1mNGKDPFNnF1Ca0CtNzyriwTE8zjuwdJei0RafXxna38';


  var SOURCE_SHEET =
    'DAILY';

  var DEST_SHEET =
    'PENCAPAIAN TOKO';


  var sourceSheet =
    SpreadsheetApp
      .openById(SOURCE_ID)
      .getSheetByName(SOURCE_SHEET);


  var destSheet =
    SpreadsheetApp
      .openById(DEST_ID)
      .getSheetByName(DEST_SHEET);


  var lastRow =
    sourceSheet.getLastRow();

  var lastCol =
    sourceSheet.getLastColumn();


  if (
    lastRow < 1 ||
    lastCol < 1
  ) {

    Logger.log(
      'Tidak ada data.'
    );

    return;

  }


  var data =
    sourceSheet
      .getRange(
        1,
        1,
        lastRow,
        lastCol
      )
      .getValues();


  destSheet.clearContents();


  destSheet
    .getRange(
      1,
      1,
      data.length,
      data[0].length
    )
    .setValues(
      data
    );


  Logger.log(
    'Import PENCAPAIAN TOKO selesai.'
  );

}



// ================================================================
// IMPORT INSENTIF BERSYARAT
// ================================================================

function importInsentifBersyarat() {

  var SOURCE_ID =
    '16mlGw6Bt74Rd81g1U89BZE0S6D5Bw3z3PJaXTBTsNBM';

  var DEST_ID =
    '1mNGKDPFNnF1Ca0CtNzyriwTE8zjuwdJei0RafXxna38';


  var SOURCE_SHEET =
    'INSENTIF';

  var DEST_SHEET =
    'INSENTIF BERSYARAT';


  var sourceSheet =
    SpreadsheetApp
      .openById(SOURCE_ID)
      .getSheetByName(
        SOURCE_SHEET
      );


  var destSheet =
    SpreadsheetApp
      .openById(DEST_ID)
      .getSheetByName(
        DEST_SHEET
      );


  var lastRow =
    sourceSheet.getLastRow();

  var lastCol =
    sourceSheet.getLastColumn();


  if (
    lastRow < 1
  ) {

    Logger.log(
      'Tidak ada data.'
    );

    return;

  }


  var data =
    sourceSheet
      .getRange(
        1,
        1,
        lastRow,
        lastCol
      )
      .getValues();


  destSheet.clearContents();


  destSheet
    .getRange(
      1,
      1,
      data.length,
      data[0].length
    )
    .setValues(
      data
    );


  Logger.log(
    'Import INSENTIF BERSYARAT selesai.'
  );

}



// ================================================================
// OUTPUT JSON
// ================================================================

function out(data) {

  return ContentService
    .createTextOutput(
      JSON.stringify(data)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );

}