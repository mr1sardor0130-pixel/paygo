import zlib from 'node:zlib'

// Standard CRC32 table
const crcTable: Uint32Array = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  crcTable[n] = c >>> 0
}

export function crc32(buf: Buffer): number {
  let crc = 0 ^ -1
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff]
  }
  return (crc ^ -1) >>> 0
}

export interface ZipEntry {
  filename: string
  content: string | Buffer
  date?: Date
}

/**
 * Creates a standard, fully compatible ZIP archive (.zip) from a list of files
 * using Node.js standard library (zlib) with 0 external dependencies.
 */
export function createZipArchive(entries: ZipEntry[]): Buffer {
  const localHeaders: Buffer[] = []
  const centralHeaders: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const filenameBuf = Buffer.from(entry.filename, 'utf-8')
    const rawContent = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content, 'utf-8')

    const uncompressedSize = rawContent.length
    const fileCrc = crc32(rawContent)

    // Deflate compression
    const compressedData = zlib.deflateRawSync(rawContent, { level: 9 })
    const compressedSize = compressedData.length

    // DOS Date and Time
    const dt = entry.date || new Date()
    const dosTime =
      ((dt.getHours() & 0x1f) << 11) |
      ((dt.getMinutes() & 0x3f) << 5) |
      ((dt.getSeconds() / 2) & 0x1f)
    const dosDate =
      (((dt.getFullYear() - 1980) & 0x7f) << 9) |
      (((dt.getMonth() + 1) & 0x0f) << 5) |
      (dt.getDate() & 0x1f)

    // Local file header (30 bytes + filename length)
    const localHeader = Buffer.alloc(30 + filenameBuf.length)
    localHeader.writeUInt32LE(0x04034b50, 0) // Signature
    localHeader.writeUInt16LE(20, 4) // Version needed (2.0)
    localHeader.writeUInt16LE(0x0800, 6) // Flags (UTF-8)
    localHeader.writeUInt16LE(8, 8) // Compression: Deflate (8)
    localHeader.writeUInt16LE(dosTime, 10)
    localHeader.writeUInt16LE(dosDate, 12)
    localHeader.writeUInt32LE(fileCrc, 14)
    localHeader.writeUInt32LE(compressedSize, 18)
    localHeader.writeUInt32LE(uncompressedSize, 22)
    localHeader.writeUInt16LE(filenameBuf.length, 26)
    localHeader.writeUInt16LE(0, 28) // Extra field length
    filenameBuf.copy(localHeader, 30)

    localHeaders.push(localHeader, compressedData)

    // Central Directory Header (46 bytes + filename length)
    const centralHeader = Buffer.alloc(46 + filenameBuf.length)
    centralHeader.writeUInt32LE(0x02014b50, 0) // Signature
    centralHeader.writeUInt16LE(20, 4) // Version made by (2.0)
    centralHeader.writeUInt16LE(20, 6) // Version needed (2.0)
    centralHeader.writeUInt16LE(0x0800, 8) // Flags (UTF-8)
    centralHeader.writeUInt16LE(8, 10) // Compression: Deflate (8)
    centralHeader.writeUInt16LE(dosTime, 12)
    centralHeader.writeUInt16LE(dosDate, 14)
    centralHeader.writeUInt32LE(fileCrc, 16)
    centralHeader.writeUInt32LE(compressedSize, 20)
    centralHeader.writeUInt32LE(uncompressedSize, 24)
    centralHeader.writeUInt16LE(filenameBuf.length, 28)
    centralHeader.writeUInt16LE(0, 30) // Extra field length
    centralHeader.writeUInt16LE(0, 32) // File comment length
    centralHeader.writeUInt16LE(0, 34) // Disk number start
    centralHeader.writeUInt16LE(0, 36) // Internal file attributes
    centralHeader.writeUInt32LE(0, 38) // External file attributes
    centralHeader.writeUInt32LE(offset, 42) // Relative offset of local header
    filenameBuf.copy(centralHeader, 46)

    centralHeaders.push(centralHeader)

    offset += localHeader.length + compressedData.length
  }

  const centralDirOffset = offset
  const centralDirBuffer = Buffer.concat(centralHeaders)
  const centralDirSize = centralDirBuffer.length

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0) // Signature
  eocd.writeUInt16LE(0, 4) // Disk number
  eocd.writeUInt16LE(0, 6) // Disk where central directory starts
  eocd.writeUInt16LE(entries.length, 8) // Total entries on this disk
  eocd.writeUInt16LE(entries.length, 10) // Total entries
  eocd.writeUInt32LE(centralDirSize, 12) // Size of central directory
  eocd.writeUInt32LE(centralDirOffset, 16) // Offset of central directory
  eocd.writeUInt16LE(0, 20) // Comment length

  return Buffer.concat([...localHeaders, centralDirBuffer, eocd])
}
