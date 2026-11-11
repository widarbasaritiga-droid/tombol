(() => {
  const controls = document.querySelector(".date-controls");
  if (!controls) return;

  // Visually separate file-upload actions from print selection to avoid two similar-looking controls.
  const reportType = document.querySelector("#report-type");
  const projectFolderButton = document.querySelector("#project-folder-button");
  const printMode = document.querySelector("#print-mode");
  const printButton = document.querySelector("#print-button");

  const makeGroup = (className, labelText) => {
    const group = document.createElement("div");
    group.className = `toolbar-group ${className}`;
    const label = document.createElement("span");
    label.className = "toolbar-group-label";
    label.textContent = labelText;
    group.append(label);
    return group;
  };

  if (reportType && projectFolderButton && !reportType.closest(".upload-toolbar-group")) {
    const uploadGroup = makeGroup("upload-toolbar-group", "Unggah lampiran");
    reportType.setAttribute("aria-label", "Pilih lampiran atau berkas yang akan dimuat");
    reportType.title = "Pilih jenis lampiran untuk memuat data; pilihan cetak diatur terpisah.";
    controls.insertBefore(uploadGroup, reportType);
    uploadGroup.append(reportType, projectFolderButton);
  }

  if (printMode && printButton && !printMode.closest(".print-toolbar-group")) {
    const printGroup = makeGroup("print-toolbar-group", "Pengaturan cetak");
    controls.insertBefore(printGroup, printMode);
    printGroup.append(printMode, printButton);
  }

  const toastId = "pwa-toast";
  let toast = document.getElementById(toastId);
  if (!toast) {
    toast = document.createElement("div");
    toast.id = toastId;
    toast.setAttribute("role", "status");
    toast.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:99999;display:none;max-width:min(360px,calc(100vw - 24px));padding:12px 14px;border-radius:8px;background:#1f2d1d;color:#fff;box-shadow:0 10px 24px rgba(0,0,0,.18);font:600 13px/1.4 Arial,Helvetica,sans-serif;";
    document.body.appendChild(toast);
  }

  const buttonStyle = "border:0;border-radius:6px;padding:7px 10px;background:#245c3b;color:#fff;font:700 14px Arial,sans-serif;cursor:pointer;";
  const secondaryButtonStyle = "border:0;border-radius:6px;padding:7px 10px;background:#8b3a16;color:#fff;font:700 14px Arial,sans-serif;cursor:pointer;";
  const messageStyle = "flex-basis:100%;font-size:13px;color:#245c3b;";

  const installButton = document.createElement("button");
  installButton.type = "button";
  installButton.textContent = "Install aplikasi";
  installButton.setAttribute("aria-label", "Install aplikasi ke perangkat");
  installButton.style.cssText = buttonStyle;
  controls.append(installButton);

  const updateButton = document.createElement("button");
  updateButton.type = "button";
  updateButton.textContent = "Update tersedia — muat ulang";
  updateButton.style.cssText = `${secondaryButtonStyle}display:none;`;
  updateButton.hidden = true;
  controls.append(updateButton);

  const message = document.createElement("span");
  message.setAttribute("role", "status");
  message.style.cssText = messageStyle;
  controls.append(message);

  let installPrompt = null;
  let registration = null;
  let reloadingForUpdate = false;
  const standalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  const showToast = (text, duration = 4400) => {
    toast.textContent = text;
    toast.style.display = "block";
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { toast.style.display = "none"; }, duration);
  };

  const updateInstallButton = () => {
    if (standalone()) {
      installButton.hidden = true;
      return;
    }
    installButton.hidden = false;
    if (!installPrompt) {
      message.textContent = "Untuk memasang aplikasi, gunakan menu browser → Tambahkan ke layar utama / Install aplikasi.";
    }
  };

  const triggerInstall = async () => {
    if (!installPrompt) {
      showToast("Browser tidak menyediakan prompt install. Gunakan menu browser → Tambahkan ke layar utama / Install aplikasi.");
      return;
    }
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    showToast(choice.outcome === "accepted" ? "Pemasangan aplikasi dimulai." : "Pemasangan aplikasi dibatalkan.");
    installPrompt = null;
    updateInstallButton();
  };

  const activateUpdate = () => {
    if (!registration?.waiting) {
      showToast("Versi baru sudah tersedia, tetapi pembaruan belum siap.");
      return;
    }
    updateButton.disabled = true;
    updateButton.textContent = "Memperbarui…";
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    showToast("Memulai pembaruan aplikasi…");
  };

  const showUpdate = () => {
    updateButton.hidden = false;
    updateButton.style.display = "inline-block";
    updateButton.disabled = false;
    updateButton.textContent = "Update tersedia — muat ulang";
    message.textContent = "Versi aplikasi baru sudah siap.";
    showToast("Versi baru sudah siap. Klik tombol update untuk memuat ulang aplikasi.");
  };

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = standalone();
    message.textContent = "Aplikasi siap dipasang di perangkat.";
    showToast("Aplikasi siap dipasang ke perangkat.");
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installButton.hidden = true;
    message.textContent = "Aplikasi berhasil dipasang.";
    showToast("Aplikasi berhasil dipasang.");
  });

  installButton.addEventListener("click", triggerInstall);
  updateButton.addEventListener("click", activateUpdate);

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", async () => {
      try {
        registration = await navigator.serviceWorker.register("sw.js", { scope: "./" });
        if (registration.waiting && navigator.serviceWorker.controller) showUpdate();
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) showUpdate();
          });
        });
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (reloadingForUpdate) return;
          reloadingForUpdate = true;
          showToast("Versi baru aktif. Memuat ulang aplikasi…");
          setTimeout(() => window.location.reload(), 600);
        });
        const checkUpdate = () => {
          if (document.visibilityState === "visible") registration.update().catch(() => {});
        };
        window.setInterval(checkUpdate, 60 * 1000);
        document.addEventListener("visibilitychange", checkUpdate);
      } catch (error) {
        message.textContent = `PWA belum aktif: ${error.message}`;
      }
    });
  } else {
    message.textContent = "Install dan pembaruan PWA tersedia saat aplikasi dibuka melalui HTTPS atau localhost.";
  }

  projectFolderButton?.addEventListener("click", () => {
    const input = document.querySelector("#local-folder-input");
    if (!input) return;
    input.value = "";
    input.click();
  });

  updateInstallButton();
})();
