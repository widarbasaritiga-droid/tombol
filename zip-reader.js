(function () {
  const maximumExpandedSize = 150 * 1024 * 1024;
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  const jpegSignature = [255, 216, 255];
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const crcTable = new Uint32Array(256);

  for (let index = 0; index < crcTable.length; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    crcTable[index] = value >>> 0;
  }

  function crc32(bytes) {
    let value = 0xffffffff;
    for (const byte of bytes) {
      value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
    }
    return (value ^ 0xffffffff) >>> 0;
  }

  function findEndOfCentralDirectory(view) {
    const minimumOffset = Math.max(0, view.byteLength - 22 - 65535);
    for (let offset = view.byteLength - 22; offset >= minimumOffset; offset--) {
      if (view.getUint32(offset, true) !== 0x06054b50) continue;
      const commentLength = view.getUint16(offset + 20, true);
      if (offset + 22 + commentLength === view.byteLength) return offset;
    }
    throw new Error("Struktur arsip ZIP tidak valid atau tidak lengkap.");
  }

  function decodeFileName(bytes, isUtf8) {
    try {
      return new TextDecoder(isUtf8 ? "utf-8" : "windows-1252", { fatal: true })
        .decode(bytes)
        .replace(/\\/g, "/");
    } catch (error) {
      throw new Error(`Nama file di ZIP tidak dapat dibaca: ${error.message}`);
    }
  }

  async function decompress(method, bytes, name, expectedSize) {
    if (method === 0) return bytes;
    if (method !== 8) {
      throw new Error(`Kompresi ZIP untuk "${name}" tidak didukung (metode ${method}).`);
    }
    if (typeof DecompressionStream === "undefined") {
      throw new Error("Browser ini belum mendukung pembacaan ZIP terkompresi. Coba Chrome atau Edge terbaru.");
    }

    try {
      const stream = new Blob([bytes])
        .stream()
        .pipeThrough(new DecompressionStream("deflate-raw"));
      const reader = stream.getReader();
      const chunks = [];
      let totalSize = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalSize += value.length;
        if (totalSize > expectedSize || totalSize > maximumExpandedSize) {
          await reader.cancel();
          throw new Error("Ukuran hasil ekstraksi melebihi ukuran yang dinyatakan dalam ZIP.");
        }
        chunks.push(value);
      }
      const output = new Uint8Array(totalSize);
      let outputOffset = 0;
      chunks.forEach((chunk) => {
        output.set(chunk, outputOffset);
        outputOffset += chunk.length;
      });
      return output;
    } catch (error) {
      throw new Error(`PNG "${name}" gagal diekstrak dari ZIP: ${error.message}`);
    }
  }

  async function readImageEntries(archive) {
    const bytes = new Uint8Array(await archive.arrayBuffer());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const directoryOffset = findEndOfCentralDirectory(view);
    const diskNumber = view.getUint16(directoryOffset + 4, true);
    const directoryDisk = view.getUint16(directoryOffset + 6, true);
    const entriesOnDisk = view.getUint16(directoryOffset + 8, true);
    const entryCount = view.getUint16(directoryOffset + 10, true);
    const directorySize = view.getUint32(directoryOffset + 12, true);
    const directoryStart = view.getUint32(directoryOffset + 16, true);

    if (diskNumber !== 0 || directoryDisk !== 0 || entriesOnDisk !== entryCount) {
      throw new Error("Arsip ZIP multi-disk tidak didukung.");
    }
    if (entryCount === 0xffff || directorySize === 0xffffffff || directoryStart === 0xffffffff) {
      throw new Error("Arsip ZIP64 belum didukung.");
    }
    if (directoryStart + directorySize > directoryOffset) {
      throw new Error("Indeks file pada ZIP berada di luar batas arsip.");
    }

    const entries = [];
    let offset = directoryStart;
    let expandedSize = 0;

    for (let index = 0; index < entryCount; index++) {
      if (offset + 46 > directoryStart + directorySize || view.getUint32(offset, true) !== 0x02014b50) {
        throw new Error("Indeks file pada ZIP rusak.");
      }

      const flags = view.getUint16(offset + 8, true);
      const method = view.getUint16(offset + 10, true);
      const checksum = view.getUint32(offset + 16, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const uncompressedSize = view.getUint32(offset + 24, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localHeaderOffset = view.getUint32(offset + 42, true);
      const entryEnd = offset + 46 + nameLength + extraLength + commentLength;

      if (entryEnd > directoryStart + directorySize) {
        throw new Error("Entri file pada ZIP terpotong.");
      }

      const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLength);
      const name = decodeFileName(nameBytes, Boolean(flags & 0x0800));
      offset = entryEnd;

      if (name.endsWith("/") || !/\.(?:png|jpe?g)$/i.test(name)) continue;
      if (flags & 0x0001) {
        throw new Error(`File PNG "${name}" terenkripsi dan tidak dapat dibaca.`);
      }
      if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
        throw new Error(`File PNG "${name}" memakai ZIP64 yang belum didukung.`);
      }

      expandedSize += uncompressedSize;
      if (expandedSize > maximumExpandedSize) {
        throw new Error("Total ukuran PNG setelah diekstrak melebihi batas aman 150 MB.");
      }

      if (localHeaderOffset + 30 > bytes.length || view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
        throw new Error(`Header file "${name}" pada ZIP rusak.`);
      }

      const localNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > directoryStart || dataEnd > bytes.length) {
        throw new Error(`Isi file "${name}" pada ZIP terpotong.`);
      }

      const imageBytes = await decompress(method, bytes.subarray(dataStart, dataEnd), name, uncompressedSize);
      if (imageBytes.length !== uncompressedSize || crc32(imageBytes) !== checksum) {
        throw new Error(`PNG "${name}" rusak atau tidak lolos pemeriksaan integritas.`);
      }
      const isPng = /\.png$/i.test(name) &&
        pngSignature.every((byte, signatureIndex) => imageBytes[signatureIndex] === byte);
      const isJpeg = /\.jpe?g$/i.test(name) &&
        jpegSignature.every((byte, signatureIndex) => imageBytes[signatureIndex] === byte);
      if (!isPng && !isJpeg) {
        throw new Error(`File "${name}" bukan gambar yang valid sesuai ekstensinya.`);
      }

      entries.push({
        name: name.split("/").pop(),
        path: name,
        blob: new Blob([imageBytes], { type: isPng ? "image/png" : "image/jpeg" })
      });
    }

    return entries;
  }

  function photoNumber(path) {
    const baseName = path.split("/").pop().replace(/\.(?:png|jpe?g|webp|gif|bmp|svg)$/i, "");
    const match = baseName.match(/^(?:foto|photo)[-_ ]?([1-9])$/i) || baseName.match(/^([1-9])$/);
    return match ? Number(match[1]) : null;
  }

  function dateFromPhotoFilename(fileName) {
    const name = fileName.toLocaleLowerCase("id-ID");
    const monthPattern = monthNames.join("|").toLocaleLowerCase("id-ID");
    const namedDate = name.match(new RegExp(`(?:^|\\D)(\\d{1,2})\\s+(${monthPattern})\\s+(\\d{4})(?:\\D|$)`, "i"));
    if (namedDate) {
      const monthIndex = monthNames.findIndex((month) =>
        month.toLocaleLowerCase("id-ID") === namedDate[2]
      );
      return validPhotoDate(Number(namedDate[3]), monthIndex + 1, Number(namedDate[1]));
    }

    const numericPatterns = [
      /(?:^|\D)(\d{1,2})[-_. ](\d{1,2})[-_. ](\d{4})(?:\D|$)/,
      /(?:^|\D)(\d{4})[-_. ](\d{1,2})[-_. ](\d{1,2})(?:\D|$)/,
      /(?:^|\D)(\d{2})(\d{2})(\d{4})(?:\D|$)/,
      /(?:^|\D)(\d{4})(\d{2})(\d{2})(?:\D|$)/
    ];

    for (const [index, pattern] of numericPatterns.entries()) {
      const match = name.match(pattern);
      if (!match) continue;
      const [first, second, third] = match.slice(1).map(Number);
      const [year, month, day] = index === 1 || index === 3
        ? [first, second, third]
        : [third, second, first];
      const date = validPhotoDate(year, month, day);
      if (date) return date;
    }
    return null;
  }

  function validPhotoDate(year, month, day) {
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
      ? date
      : null;
  }

  function mapPhotoEntries(entries, slotCount) {
    const sortedEntries = [...entries].sort((first, second) =>
      first.path.localeCompare(second.path, "id", { numeric: true, sensitivity: "base" })
    );
    const photosByNumber = new Map();
    const overflowEntries = [];
    const duplicateNumbers = new Set();
    const datedEntries = sortedEntries
      .map((entry) => ({ entry, date: dateFromPhotoFilename(entry.name || entry.path.split("/").pop()) }))
      .filter(({ date }) => date)
      .sort((first, second) =>
        first.date.getTime() - second.date.getTime() ||
        first.entry.path.localeCompare(second.entry.path, "id", { numeric: true, sensitivity: "base" })
      );

    datedEntries.slice(0, slotCount).forEach(({ entry }, index) => {
      photosByNumber.set(index + 1, entry);
    });
    const datedEntrySet = new Set(datedEntries.map(({ entry }) => entry));

    sortedEntries.forEach((entry) => {
      if (datedEntrySet.has(entry)) return;
      const number = photoNumber(entry.path);
      if (number === null) {
        overflowEntries.push(entry);
      } else if (photosByNumber.has(number)) {
        duplicateNumbers.add(number);
        overflowEntries.push(entry);
      } else {
        photosByNumber.set(number, entry);
      }
    });

    let nextSlot = 1;
    overflowEntries.forEach((entry) => {
      while (photosByNumber.has(nextSlot) && nextSlot <= slotCount) nextSlot++;
      if (nextSlot <= slotCount) photosByNumber.set(nextSlot++, entry);
    });

    return {
      photosByNumber,
      duplicateNumbers,
      ignoredCount: Math.max(0, entries.length - photosByNumber.size)
    };
  }

  window.ZipImageReader = { readImageEntries, mapPhotoEntries, dateFromPhotoFilename };
})();
