const TV_MEDIA_FOLDER_ID = '164ITV_OLwMXw9LtWYY6Fo_JmmfzFQMda'

function doGet(event) {
  const callback = String(event.parameter.callback || '')
  if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService.createTextOutput('Invalid callback').setMimeType(ContentService.MimeType.TEXT)
  }

  try {
    return jsonp_(callback, { data: listTvMedia_() })
  } catch (error) {
    return jsonp_(callback, { error: error instanceof Error ? error.message : String(error) })
  }
}

function authorizeTvMediaAccess() {
  return listTvMedia_()
}

function listTvMedia_() {
  const folder = DriveApp.getFolderById(TV_MEDIA_FOLDER_ID)

  const files = folder.getFiles()
  const media = []
  while (files.hasNext()) {
    const file = files.next()
    const mimeType = file.getMimeType()
    const isImage = mimeType.indexOf('image/') === 0
    const isPdf = mimeType === 'application/pdf'
    if (!isImage && !isPdf) continue

    const id = file.getId()
    media.push({
      id: id,
      name: file.getName(),
      mimeType: mimeType,
      updatedAt: file.getLastUpdated().toISOString(),
      url: isPdf
        ? 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/preview'
        : 'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(id),
    })
  }

  return media.sort(function (left, right) {
    return left.name.localeCompare(right.name)
  })
}

function jsonp_(callback, payload) {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c')
  return ContentService.createTextOutput(callback + '(' + json + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT)
}
