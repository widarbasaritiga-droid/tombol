const monthNames = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const quarterNames = ["I", "II", "III", "IV"];
const monthSelect = document.querySelector("#report-month");
const yearSelect = document.querySelector("#report-year");
const villageSelect = document.querySelector("#report-village");
const reportTypeSelect = document.querySelector("#report-type");
const reportTypePlaceholder = reportTypeSelect.querySelector('option[value=""]');
const reportTypeOptions = {
  budget: reportTypeSelect.querySelector('option[value="budget"]'),
  photos: reportTypeSelect.querySelector('option[value="photos"]')
};
const reportTypeLabels = {
  budget: "Rincian dukungan anggaran",
  photos: "Dokumentasi foto"
};
const printModeSelect = document.querySelector("#print-mode");
const printButton = document.querySelector("#print-button");
const photoStatus = document.querySelector("#photo-status");
const welcomeScreen = document.querySelector("#welcome-screen");
const welcomeForm = document.querySelector("#welcome-form");
const welcomeVillageSelect = document.querySelector("#welcome-village");
const photoSlots = Array.from(document.querySelectorAll(".photo-slot"));
const reportDocument = document.querySelector(".document");
const budgetDocument = document.querySelector("#budget-document");
const yearControl = document.querySelector("#year-control");
const localFolderInput = document.querySelector("#local-folder-input");
const photoFilesInput = document.querySelector("#photo-files-input");
const budgetTextInput = document.querySelector("#budget-text-input");
const photoSourceDialog = document.querySelector("#photo-source-dialog");
const selectionWarningDialog = document.querySelector("#selection-warning-dialog");
const now = new Date();
const currentYear = now.getFullYear();
const imageExtensions = ["png", "jpg", "jpeg", "webp", "svg"];
const signatureExtensions = ["png", "jpg", "jpeg", "webp"];
let photoLoadVersion = 0;
let zipLoadVersion = 0;
let localFiles = new Map();
let localFolderName = "";
let zipPhotosByNumber = new Map();
let photoSourceName = "";
let zipPhotoMessage = "";
let selectedPhotoSource = "";
let selectedReportType = "budget";

function updateReportTypeLabel(type, successCount, resultName) {
  const resultLabel = `${reportTypeLabels[type]} (${successCount} ${resultName} berhasil)`;
  reportTypeOptions[type].textContent = resultLabel;
  reportTypePlaceholder.textContent = resultLabel;
}

function resetReportTypeLabel(type) {
  reportTypeOptions[type].textContent = reportTypeLabels[type];
}

function normalizeLocalPath(path) {
  if (typeof path !== "string") return "";
  let decodedPath = path;
  try {
    decodedPath = decodeURIComponent(path);
  } catch {
    // Keep literal path names that contain an invalid percent-escape.
  }
  return decodedPath
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "")
    .toLocaleLowerCase("id-ID");
}

function getFileRelativePath(file) {
  return file && (file.webkitRelativePath || file.name) ? (file.webkitRelativePath || file.name) : "";
}

function findLocalFile(path) {
  return localFiles.get(normalizeLocalPath(path));
}

function makeLocalObjectUrl(image, file) {
  if (image.dataset.objectUrl) URL.revokeObjectURL(image.dataset.objectUrl);
  const objectUrl = URL.createObjectURL(file);
  image.dataset.objectUrl = objectUrl;
  return objectUrl;
}

function getLocalImageCandidates(paths) {
  return paths.map((path) => findLocalFile(path)).filter(Boolean);
}

function fitDocumentToViewport() {
  const bodyStyle = getComputedStyle(document.body);
  const horizontalPadding =
    Number.parseFloat(bodyStyle.paddingLeft) +
    Number.parseFloat(bodyStyle.paddingRight);
  const availableWidth = Math.max(1, window.innerWidth - horizontalPadding);
  const pageWidth = 297 * 96 / 25.4;
  const zoom = String(Math.min(1, availableWidth / pageWidth));
  document.querySelectorAll(".report-canvas").forEach((canvas) => {
    canvas.style.zoom = zoom;
  });
}

window.addEventListener("resize", fitDocumentToViewport);
fitDocumentToViewport();

if (!window.reportData) {
  throw new Error("Data laporan tidak ditemukan. Pastikan data/report-data.js tersedia.");
}

const villageNames = window.reportData.villageOrder ||
  [...window.reportData.desaList, ...window.reportData.kelurahanList];
const villagePlaceholder = document.createElement("option");
villagePlaceholder.value = "";
villagePlaceholder.textContent = "-Pilih desa/kelurahan-";
villagePlaceholder.disabled = true;
villagePlaceholder.selected = true;
villageSelect.append(villagePlaceholder);

villageNames.forEach((village) => {
  const option = document.createElement("option");
  option.value = village;
  option.textContent = village;
  villageSelect.append(option);

  const welcomeOption = document.createElement("option");
  welcomeOption.value = village;
  welcomeOption.textContent = village;
  welcomeVillageSelect.append(welcomeOption);
});

welcomeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!welcomeForm.reportValidity()) return;

  villageSelect.value = welcomeVillageSelect.value;
  welcomeScreen.hidden = true;
  document.body.classList.add("app-started");
  villageSelect.dispatchEvent(new Event("change", { bubbles: true }));
});

monthNames.forEach((month, index) => {
  const option = document.createElement("option");
  option.value = index;
  option.textContent = month;
  monthSelect.append(option);
});

for (let year = currentYear - 5; year <= currentYear + 5; year++) {
  const option = document.createElement("option");
  option.value = year;
  option.textContent = year;
  yearSelect.append(option);
}

monthSelect.value = String(now.getMonth());
yearSelect.value = String(currentYear);
yearControl.hidden = false;

function updateReportPeriod() {
  if (!monthSelect.value || !yearSelect.value) {
    document.querySelector("#attachment-period").textContent = "";
    document.querySelector("#title-period").textContent = "";
    document.querySelector("#signature-date").textContent = "";
    document.querySelectorAll(".budget-attachment-period, .budget-title-period, .signature-date")
      .forEach((element) => { element.textContent = ""; });
    return;
  }

  const monthIndex = Number(monthSelect.value);
  const year = Number(yearSelect.value);
  const month = monthNames[monthIndex];
  const quarter = quarterNames[Math.floor(monthIndex / 3)];
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();

  document.querySelector("#attachment-period").textContent =
    `Bulan ${month} Triwulan ${quarter} TA ${year}`;
  document.querySelector("#title-period").textContent =
    `${month.toUpperCase()} TRIWULAN ${quarter} TA ${year}`;
  document.querySelector("#signature-date").textContent =
    `${lastDay} ${month} ${year}`;
  document.querySelectorAll(".budget-attachment-period")
    .forEach((element) => { element.textContent = `${month} Triwulan ${quarter} TA ${year}`; });
  document.querySelectorAll(".budget-title-period")
    .forEach((element) => { element.textContent = `${month.toUpperCase()} TRIWULAN ${quarter} TA ${year}`; });
  document.querySelectorAll(".signature-date")
    .forEach((element) => { element.textContent = `${lastDay} ${month} ${year}`; });
}

function updateReportType(reportType = selectedReportType) {
  selectedReportType = reportType;
  const showBudgetReport = selectedReportType === "budget";
  reportDocument.hidden = showBudgetReport;
  budgetDocument.hidden = !showBudgetReport;
  updateSelectionStyles();
}

function updateSelectionStyles() {
  [monthSelect, yearSelect, villageSelect].forEach((select) => {
    select.classList.toggle("has-selection", Boolean(select.value));
  });
  reportTypeSelect.classList.toggle("has-selection", Boolean(reportTypeSelect.value));
  printModeSelect.classList.toggle("has-selection", Boolean(printModeSelect.value));
}

function hasReportSelection() {
  return Boolean(monthSelect.value && yearSelect.value && villageSelect.value);
}

function showSelectionWarning(action) {
  const missingSelections = [];
  if (!monthSelect.value) missingSelections.push("bulan");
  if (!yearSelect.value) missingSelections.push("tahun");
  if (!villageSelect.value) missingSelections.push("desa/kelurahan");

  document.querySelector("#selection-warning-title").textContent = "Lengkapi periode laporan";
  document.querySelector("#selection-warning-message").textContent =
    `Pilih ${missingSelections.join(", ")} terlebih dahulu sebelum ${action}.`;
  selectionWarningDialog.showModal();
}

function updateVillageLabels(village) {
  document.querySelectorAll(".signature-village").forEach((element) => {
    element.textContent = village;
  });
}

function setImageFromCandidates(image, candidates) {
  image.hidden = true;
  image.removeAttribute("src");
  if (image.dataset.objectUrl) URL.revokeObjectURL(image.dataset.objectUrl);
  delete image.dataset.objectUrl;
  const className = image.classList.contains("stamp-image") ? "has-stamp-image" : "has-signature-image";
  image.parentElement.classList.remove(className);

  let candidateIndex = 0;
  const tryNextCandidate = () => {
    if (candidateIndex >= candidates.length) return;
    const candidate = candidates[candidateIndex++];
    const localFile = findLocalFile(candidate);
    image.src = localFile ? makeLocalObjectUrl(image, localFile) : candidate;
  };

  image.onload = () => {
    image.hidden = false;
    image.parentElement.classList.add(className);
  };
  image.onerror = () => {
    tryNextCandidate();
  };
  tryNextCandidate();
}

function imagePaths(folder, names) {
  const encodedFolder = folder.split("/").map(encodeURIComponent).join("/");
  return names.flatMap((name) => signatureExtensions.map((extension) => {
    const encodedName = name.split("/").map(encodeURIComponent);
    encodedName[encodedName.length - 1] += `.${extension}`;
    return `${encodedFolder}/${encodedName.join("/")}`;
  }));
}

function updateBabinsa() {
  const village = villageSelect.value;
  const babinsa = window.reportData.babinsaByVillage[village] || { name: "", rank: "", nrp: "" };
  updateVillageLabels(village);
  document.querySelectorAll(".babinsa-name").forEach((element) => { element.textContent = babinsa.name; });
  document.querySelectorAll(".babinsa-rank").forEach((element) => { element.textContent = babinsa.rank; });
  document.querySelectorAll(".babinsa-nrp").forEach((element) => { element.textContent = babinsa.nrp; });

  const candidates = babinsa.nrp ? [
    ...imagePaths("data/tanda tangan/Babinsa", [babinsa.nrp, `tanda tangan ${babinsa.nrp}`]),
    ...imagePaths(`data/tanda tangan/${village}`, [babinsa.nrp, `tanda tangan ${babinsa.nrp}`]),
    ...imagePaths("data/tanda tangan", [`${village}/${babinsa.nrp}`, `tanda tangan ${babinsa.nrp}`, babinsa.nrp])
  ] : [];
  document.querySelectorAll(".babinsa-signature-space").forEach((signatureSpace) => {
    let signature = signatureSpace.querySelector(".signature-image");
    if (!signature) {
      signature = document.createElement("img");
      signature.className = "signature-image";
      signature.hidden = true;
      signatureSpace.append(signature);
    }
    signature.alt = `Tanda tangan ${babinsa.name || "Babinsa"}`;
    signature.classList.toggle("sukasada-signature", village === "Sukasada");
    signature.classList.toggle("pegayaman-signature", village === "Pegayaman");
    signature.classList.toggle("ambengan-signature", village === "Ambengan");
    signature.classList.toggle("pegadungan-signature", village === "Pegadungan");
    setImageFromCandidates(signature, candidates);
  });
}

function createBudgetRow(number) {
  const row = document.createElement("tr");
  const values = [
    { text: `${number}.`, editable: false, label: `Nomor ${number}` },
    { text: "", editable: true, label: `Hari dan tanggal kegiatan ${number}` },
    { text: "", editable: true, label: `Uraian kegiatan ${number}` },
    { text: "Rp. 100.000,-", editable: true, label: `Penggunaan dana kegiatan ${number}` },
    { text: "Kegiatan berjalan dengan tertib, aman dan lancar.", editable: true, label: `Keterangan kegiatan ${number}` }
  ];

  values.forEach(({ text, editable, label }) => {
    const cell = document.createElement("td");
    cell.textContent = text;
    cell.setAttribute("aria-label", label);
    if (editable) {
      cell.contentEditable = "true";
      cell.spellcheck = false;
    }
    row.append(cell);
  });
  return row;
}

for (let number = 1; number <= 9; number++) {
  const target = number <= 5
    ? document.querySelector("#budget-rows-first")
    : document.querySelector("#budget-rows-second");
  target.append(createBudgetRow(number));
}

function parseBudgetText(text) {
  const rows = [];
  const invalidLines = [];

  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const [date = "", ...narrativeParts] = line.split("\t");
    const narrative = narrativeParts.join("\t").trim();
    if (!date.trim() || !narrative) {
      invalidLines.push(index + 1);
      return;
    }
    rows.push({ date: date.trim(), narrative });
  });

  if (invalidLines.length) {
    throw new Error(`Format baris ${invalidLines.join(", ")} tidak valid. Setiap baris harus berisi tanggal dan narasi yang dipisahkan Tab.`);
  }
  if (!rows.length) {
    throw new Error("File TXT tidak berisi baris tanggal dan narasi kegiatan.");
  }
  if (rows.length > 9) {
    throw new Error(`File berisi ${rows.length} kegiatan; maksimal 9 kegiatan agar sesuai dengan 9 slot foto.`);
  }

  return rows;
}

function showBudgetTextError(message) {
  document.querySelector("#selection-warning-title").textContent = "File TXT tidak dapat dimuat";
  document.querySelector("#selection-warning-message").textContent = message;
  selectionWarningDialog.showModal();
}

async function loadBudgetTextFile() {
  const file = budgetTextInput.files && budgetTextInput.files[0];
  if (!file) return;

  if (!/\.txt$/i.test(file.name)) {
    showBudgetTextError("Pilih file berformat .txt yang berisi tanggal dan narasi kegiatan.");
    return;
  }

  try {
    const rows = parseBudgetText(await file.text());
    const tableRows = Array.from(budgetDocument.querySelectorAll(".budget-table tbody tr"));
    tableRows.forEach((row, index) => {
      row.cells[1].textContent = rows[index]?.date || "";
      row.cells[2].textContent = rows[index]?.narrative || "";
    });
    updateReportTypeLabel("budget", rows.length, "kegiatan");
  } catch (error) {
    showBudgetTextError(`TXT gagal dimuat: ${error.message}`);
  }
}

function openReportFilePicker() {
  photoSourceDialog.showModal();
}

function openBudgetTextPicker() {
  budgetTextInput.value = "";
  budgetTextInput.click();
}

function clearPhotoPreview(preview, slot) {
  if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
  delete preview.dataset.objectUrl;
  preview.removeAttribute("src");
  preview.hidden = true;
  slot.classList.remove("has-image");
}

function photoPathCandidates(number) {
  const folderParts = [
    String(yearSelect.value),
    monthNames[Number(monthSelect.value)],
    villageSelect.value
  ];
  const names = [`foto-${number}`, `foto${number}`, String(number)];
  const folders = [
    ["LAPORAN BABINSA", ...folderParts],
    folderParts,
    ["Dukops Babinsa", ...folderParts],
    folderParts.slice(1),
    folderParts.slice(2)
  ];
  return names.flatMap((name) => imageExtensions.flatMap((extension) =>
    folders.map((folder) => ({
      path: `${folder.join("/")}/${name}.${extension}`,
      url: `${folder.map(encodeURIComponent).join("/")}/${encodeURIComponent(`${name}.${extension}`)}`
    }))
  ));
}

function localPhotosForSelection() {
  const expectedFolders = [
    normalizeLocalPath(String(yearSelect.value)),
    normalizeLocalPath(monthNames[Number(monthSelect.value)]),
    normalizeLocalPath(villageSelect.value)
  ];
  const selectedVillageFolder = normalizeLocalPath(localFolderName) === expectedFolders[2];
  const entries = [...new Set(localFiles.values())]
    .filter((file) => imageExtensions.includes(file.name.split(".").pop().toLowerCase()))
    .filter((file) => {
      if (selectedVillageFolder) return true;
      const path = normalizeLocalPath(file.webkitRelativePath || file.name).split("/");
      return path.some((part, index) =>
        expectedFolders.every((folder, folderIndex) => path[index + folderIndex] === folder)
      );
    })
    .map((file) => ({
      name: file.name,
      path: file.webkitRelativePath || file.name,
      blob: file
    }));

  return window.ZipImageReader.mapPhotoEntries(entries, photoSlots.length).photosByNumber;
}

function loadPhotosFromSelectedVillage() {
  const version = ++photoLoadVersion;
  let loadedCount = 0;
  let completedCount = 0;
  resetReportTypeLabel("photos");

  if (!villageSelect.value) {
    photoSlots.forEach((slot) => {
      const preview = slot.querySelector(".photo-preview");
      if (preview) clearPhotoPreview(preview, slot);
    });
    photoStatus.textContent = zipPhotoMessage || "Pilih desa/kelurahan untuk memuat foto.";
    return;
  }

  photoStatus.textContent = `Memuat foto ${villageSelect.value}, ${monthNames[Number(monthSelect.value)]} ${yearSelect.value}…`;
  const localPhotos = localPhotosForSelection();

  photoSlots.forEach((slot, index) => {
    const number = index + 1;
    let preview = slot.querySelector(".photo-preview");
    if (!preview) {
      preview = document.createElement("img");
      preview.className = "photo-preview";
      preview.alt = `Foto kegiatan ${number}`;
      preview.hidden = true;
      slot.prepend(preview);
    }

    clearPhotoPreview(preview, slot);
    const zipPhoto = zipPhotosByNumber.get(number);
    const localPhoto = localPhotos.get(number);
    const selectedPhoto = zipPhoto || localPhoto;
    if (selectedPhoto) {
      preview.onload = () => {
        if (version !== photoLoadVersion) return;
        preview.hidden = false;
        slot.classList.add("has-image");
        loadedCount++;
        completedCount++;
        updatePhotoStatus();
      };
      preview.onerror = () => {
        if (version !== photoLoadVersion) return;
        completedCount++;
        zipPhotoMessage = `Gambar ${selectedPhoto.path} gagal ditampilkan.`;
        updatePhotoStatus();
      };
      preview.src = makeLocalObjectUrl(preview, selectedPhoto.blob);
      return;
    }

    const candidates = photoPathCandidates(number);
    const localCandidates = getLocalImageCandidates(candidates.map((candidate) => candidate.path));
    let localCandidateIndex = 0;
    let remoteCandidateIndex = 0;
    const tryNextCandidate = () => {
      if (version !== photoLoadVersion) return;
      if (localCandidateIndex < localCandidates.length) {
        preview.src = makeLocalObjectUrl(preview, localCandidates[localCandidateIndex++]);
        return;
      }
      if (remoteCandidateIndex >= candidates.length) {
        completedCount++;
        updatePhotoStatus();
        return;
      }
      const candidate = candidates[remoteCandidateIndex++];
      preview.src = candidate.url;
    };

    preview.onload = () => {
      if (version !== photoLoadVersion) return;
      preview.hidden = false;
      slot.classList.add("has-image");
      loadedCount++;
      completedCount++;
      updatePhotoStatus();
    };
    preview.onerror = () => {
      tryNextCandidate();
    };
    tryNextCandidate();
  });

  function updatePhotoStatus() {
    if (version !== photoLoadVersion || completedCount !== photoSlots.length) return;
    const folderLabel = localFolderName ? ` (folder: ${localFolderName})` : "";
    const sourceLabel = photoSourceName ? ` (sumber: ${photoSourceName})` : "";
    const zipMessage = zipPhotoMessage ? ` ${zipPhotoMessage}` : "";
    const resultDetails = loadedCount
      ? `${loadedCount}/9 foto dimuat — ${villageSelect.value}, ${monthNames[Number(monthSelect.value)]} ${yearSelect.value}${folderLabel}${sourceLabel}.${zipMessage}`
      : `Foto untuk ${villageSelect.value}, ${monthNames[Number(monthSelect.value)]} ${yearSelect.value} tidak ditemukan${localFolderName ? ` di folder ${localFolderName} maupun lokasi laporan` : " pada lokasi laporan"}.${zipMessage}`;
    photoStatus.textContent = resultDetails;
    if (loadedCount > 0) {
      updateReportTypeLabel("photos", loadedCount, "foto");
    }
  }
}

async function loadZipFiles(files, zipName, version) {
  zipPhotosByNumber = new Map();
  photoSourceName = zipName;
  zipPhotoMessage = "";

  if (!files.length) {
    loadPhotosFromSelectedVillage();
    return;
  }

  photoStatus.textContent = `Membaca ${files.length} arsip ZIP…`;

  try {
    const entries = [];
    let totalExpandedSize = 0;
    for (const file of files) {
      const archiveEntries = await window.ZipImageReader.readImageEntries(file);
      if (version !== zipLoadVersion) return;
      archiveEntries.forEach((entry) => {
        totalExpandedSize += entry.blob.size;
        if (totalExpandedSize > 150 * 1024 * 1024) {
          throw new Error("Total ukuran PNG dari semua ZIP melebihi batas aman 150 MB.");
        }
        entries.push({
          ...entry,
          path: `${file.webkitRelativePath || file.name}/${entry.path}`
        });
      });
    }

    if (version !== zipLoadVersion) return;
    if (!entries.length) {
      zipPhotoMessage = "ZIP tidak berisi file PNG/JPG/JPEG.";
    } else {
      const { photosByNumber, duplicateNumbers, ignoredCount } =
        window.ZipImageReader.mapPhotoEntries(entries, photoSlots.length);
      zipPhotosByNumber = photosByNumber;
      const messages = [];
      if (duplicateNumbers.size) {
        messages.push(`Nomor PNG duplikat (${[...duplicateNumbers].sort().join(", ")}) dialihkan ke slot kosong.`);
      }
      if (ignoredCount) {
        messages.push(`${ignoredCount} PNG tambahan tidak ditampilkan karena slot hanya 9.`);
      }
      zipPhotoMessage = messages.join(" ");
    }
  } catch (error) {
    if (version !== zipLoadVersion) return;
    zipPhotoMessage = `ZIP gagal dibaca: ${error.message}`;
  }

  loadPhotosFromSelectedVillage();
}

function loadSelectedImages() {
  void loadSelectedPhotoFiles();
}

async function loadSelectedPhotoFiles() {
  const files = Array.from(photoFilesInput.files || []);
  const version = ++zipLoadVersion;
  zipPhotosByNumber = new Map();
  zipPhotoMessage = "";

  if (!files.length) {
    photoSourceName = "";
    loadPhotosFromSelectedVillage();
    return;
  }

  const photoFiles = files.filter((file) => file.type.startsWith("image/"));
  const zipFiles = files.filter((file) => /\.zip$/i.test(file.name));
  const unsupportedFiles = files.filter((file) =>
    !file.type.startsWith("image/") && !/\.zip$/i.test(file.name)
  );
  const totalSize = photoFiles.reduce((total, file) => total + file.size, 0);
  if (totalSize > 150 * 1024 * 1024) {
    photoSourceName = `${files.length} file`;
    zipPhotoMessage = "Total ukuran gambar melebihi batas aman 150 MB.";
    loadPhotosFromSelectedVillage();
    return;
  }

  const entries = photoFiles
    .map((file) => ({
      name: file.name,
      path: file.webkitRelativePath || file.name,
      blob: file
    }));

  let totalExpandedSize = 0;
  for (const file of zipFiles) {
    try {
      const archiveEntries = await window.ZipImageReader.readImageEntries(file);
      if (version !== zipLoadVersion) return;
      archiveEntries.forEach((entry) => {
        totalExpandedSize += entry.blob.size;
        if (totalExpandedSize > 150 * 1024 * 1024) {
          throw new Error("Total ukuran PNG dari semua ZIP melebihi batas aman 150 MB.");
        }
        entries.push({
          ...entry,
          path: `${file.name}/${entry.path}`
        });
      });
    } catch (error) {
      zipPhotoMessage = `ZIP ${file.name} gagal dibaca: ${error.message}`;
      if (version !== zipLoadVersion) return;
    }
  }

  if (version !== zipLoadVersion) return;
  const { photosByNumber, duplicateNumbers, ignoredCount } =
    window.ZipImageReader.mapPhotoEntries(entries, photoSlots.length);
  zipPhotosByNumber = photosByNumber;
  photoSourceName = `${photoFiles.length} gambar${zipFiles.length ? ` dan ${zipFiles.length} ZIP` : ""}`;

  const messages = [];
  if (unsupportedFiles.length) {
    messages.push(`${unsupportedFiles.length} file bukan gambar atau ZIP diabaikan.`);
  }
  if (duplicateNumbers.size) {
    messages.push(`Nomor foto duplikat (${[...duplicateNumbers].sort().join(", ")}) dialihkan ke slot kosong.`);
  }
  if (ignoredCount) {
    messages.push(`${ignoredCount} foto tambahan tidak ditampilkan karena slot hanya 9.`);
  }
  if (zipPhotoMessage) messages.push(zipPhotoMessage);
  zipPhotoMessage = messages.join(" ");
  loadPhotosFromSelectedVillage();
}

function loadSelectedLocalFolder() {
  const files = Array.from(localFolderInput.files || []);
  localFiles = new Map();
  const firstFilePath = files[0] ? getFileRelativePath(files[0]) : "";
  localFolderName = firstFilePath ? firstFilePath.split("/").filter(Boolean)[0] || "" : "";

  files.forEach((file) => {
    const relativePath = getFileRelativePath(file);
    const normalizedPath = normalizeLocalPath(relativePath);
    localFiles.set(normalizedPath, file);
    const pathParts = normalizedPath.split("/");
    if (pathParts.length > 1) {
      localFiles.set(pathParts.slice(1).join("/"), file);
    }
  });

  photoFilesInput.value = "";
  setImageFromCandidates(document.querySelector("#unit-stamp-image"), ["data/stempel/stempel.png"]);
  setImageFromCandidates(document.querySelector("#budget-unit-stamp-image"), ["data/stempel/stempel.png"]);
  setImageFromCandidates(document.querySelector("#commander-signature-image"), imagePaths("data/tanda tangan", [
    "Koramil/ttd1", "3910357550170", "Koramil/3910357550170"
  ]));
  setImageFromCandidates(document.querySelector("#budget-commander-signature-image"), imagePaths("data/tanda tangan", [
    "Koramil/ttd1", "3910357550170", "Koramil/3910357550170"
  ]));
  updateBabinsa();
  const zipFiles = files.filter((file) => /\.zip$/i.test(file.name));
  const version = ++zipLoadVersion;
  const zipName = zipFiles.length
    ? `${zipFiles.length} ZIP dari folder ${localFolderName}`
    : "";
  if (!zipFiles.length) {
    zipPhotosByNumber = new Map();
    photoSourceName = "";
    zipPhotoMessage = "";
    photoStatus.textContent = files.length
      ? `Folder proyek "${localFolderName}" dimuat (${files.length} file).`
      : "Folder proyek belum dipilih.";
  }
  void loadZipFiles(zipFiles, zipName, version);
}

photoSlots.forEach((slot, index) => {
  const number = index + 1;
  const preview = document.createElement("img");
  const input = document.createElement("input");
  const label = document.createElement("label");

  preview.className = "photo-preview";
  preview.alt = `Foto kegiatan ${number}`;
  preview.hidden = true;
  input.className = "image-input";
  input.type = "file";
  input.accept = "image/*";
  input.id = `photo-input-${number}`;
  input.setAttribute("aria-label", `Pilih foto kegiatan ${number}`);
  label.className = "image-picker";
  label.htmlFor = input.id;
  label.textContent = "Pilih / ganti foto";
  slot.append(preview, input, label);

  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    clearPhotoPreview(preview, slot);
    const objectUrl = URL.createObjectURL(file);
    preview.dataset.objectUrl = objectUrl;
    preview.onload = () => {
      preview.hidden = false;
      slot.classList.add("has-image");
      const loadedCount = photoSlots.filter((photoSlot) => photoSlot.classList.contains("has-image")).length;
      if (loadedCount > 0) updateReportTypeLabel("photos", loadedCount, "foto");
    };
    preview.src = objectUrl;
  });
});

setImageFromCandidates(document.querySelector("#unit-stamp-image"), ["data/stempel/stempel.png"]);
setImageFromCandidates(document.querySelector("#budget-unit-stamp-image"), ["data/stempel/stempel.png"]);
setImageFromCandidates(document.querySelector("#commander-signature-image"), imagePaths("data/tanda tangan", [
  "3910357550170", "Koramil/3910357550170"
]));
setImageFromCandidates(document.querySelector("#budget-commander-signature-image"), imagePaths("data/tanda tangan", [
  "3910357550170", "Koramil/3910357550170"
]));
localFolderInput.addEventListener("change", loadSelectedLocalFolder);
photoFilesInput.addEventListener("change", loadSelectedImages);
budgetTextInput.addEventListener("change", () => { void loadBudgetTextFile(); });

monthSelect.addEventListener("change", () => {
  updateSelectionStyles();
  updateReportPeriod();
  updateBabinsa();
  loadPhotosFromSelectedVillage();
});
yearSelect.addEventListener("change", () => {
  updateSelectionStyles();
  updateReportPeriod();
  updateBabinsa();
  loadPhotosFromSelectedVillage();
});
villageSelect.addEventListener("change", () => {
  if (!monthSelect.value || !yearSelect.value) {
    villageSelect.value = "";
    showSelectionWarning("memilih wilayah dan memuat foto");
    return;
  }

  updateBabinsa();
  updateSelectionStyles();
  loadPhotosFromSelectedVillage();
});

let originalDocumentTitle = document.title;
printModeSelect.addEventListener("change", updateSelectionStyles);
reportTypeSelect.addEventListener("change", () => {
  const reportType = reportTypeSelect.value;
  if (!reportType) return;

  updateReportType(reportType);
  if (!hasReportSelection()) {
    showSelectionWarning("mengunggah berkas");
    reportTypeSelect.value = "";
    updateSelectionStyles();
    return;
  }

  reportTypeSelect.value = "";
  updateSelectionStyles();
  if (reportType === "budget") {
    openBudgetTextPicker();
  } else {
    openReportFilePicker();
  }
});
photoSourceDialog.querySelectorAll("[data-photo-source]").forEach((button) => {
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => {
    const source = button.dataset.photoSource;
    selectedPhotoSource = source;
    photoSourceDialog.querySelectorAll("[data-photo-source]").forEach((sourceButton) => {
      sourceButton.setAttribute(
        "aria-pressed",
        String(sourceButton.dataset.photoSource === selectedPhotoSource)
      );
    });
    photoSourceDialog.close();
    if (source === "folder") {
      localFolderInput.value = "";
      localFolderInput.click();
      return;
    }

    photoFilesInput.value = "";
    photoFilesInput.accept = source === "zip"
      ? ".zip,application/zip"
      : "image/*";
    photoFilesInput.click();
  });
});
printButton.addEventListener("click", () => {
  if (!hasReportSelection()) {
    showSelectionWarning("mencetak laporan");
    return;
  }

  const safeVillageName = villageSelect.value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-");
  const villageNumber = window.reportData.villageReportNumberByVillage[villageSelect.value];
  const selectedCode = window.reportData.villageCodeByVillage[villageSelect.value];
  const printMode = printModeSelect.value;
  const villageCode = printMode === "a"
    ? selectedCode.replace(/^B/, "A")
    : printMode === "b"
      ? selectedCode
      : "A-B";
  originalDocumentTitle = document.title;
  document.title =
    `${villageNumber}. ${villageCode} ${safeVillageName} ${monthNames[Number(monthSelect.value)].toLocaleLowerCase("id-ID")} ${yearSelect.value}`;
  document.body.classList.remove("printing-a", "printing-b", "printing-both");
  document.body.classList.add(`printing-${printMode}`);
  if (printMode === "both") document.body.insertBefore(budgetDocument, reportDocument);
  window.print();
});

updateSelectionStyles();

window.addEventListener("afterprint", () => {
  document.title = originalDocumentTitle;
  document.body.classList.remove("printing-a", "printing-b", "printing-both");
  document.body.insertBefore(reportDocument, budgetDocument);
});

updateReportPeriod();
updateBabinsa();
updateReportType();
