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
  const cache = CacheService.getScriptCache()

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
      updatedAt: file.getLastUpdated().toISOString(),
      durationSeconds: isVideo ? getVideoDurationSeconds_(id, cache) : null,
      url: isPdf || isVideo
        ? 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/preview'
        : 'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(id),
    })
  }

  return media.sort(function (left, right) {
    return left.name.localeCompare(right.name)
  })
}

function getVideoDurationSeconds_(fileId, cache) {
  const cacheKey = 'tv-video-duration-' + fileId
  const cachedDuration = cache.get(cacheKey)
  if (cachedDuration !== null) return Number(cachedDuration) || null

  const response = UrlFetchApp.fetch(
    'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '?fields=videoMediaMetadata(durationMillis)',
    {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true,
    },
  )
  if (response.getResponseCode() !== 200) {
    throw new Error('Durasi video Drive tidak bisa dibaca (HTTP ' + response.getResponseCode() + '). Pastikan izin Drive API tersedia dan video sudah diproses.')
  }

  const metadata = JSON.parse(response.getContentText())
  const durationMillis = Number(metadata.videoMediaMetadata && metadata.videoMediaMetadata.durationMillis)
  if (!Number.isFinite(durationMillis) || durationMillis <= 0) {
    cache.put(cacheKey, '0', 300)
    return null
  }

  const durationSeconds = Math.ceil(durationMillis / 1000)
  cache.put(cacheKey, String(durationSeconds), 21600)
  return durationSeconds
}

function jsonp_(callback, payload) {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c')
  return ContentService.createTextOutput(callback + '(' + json + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT)
}
