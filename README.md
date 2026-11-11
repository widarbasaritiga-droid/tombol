# Pelaporan Duops Koramil 05 Sukasada

Aplikasi web untuk membuat Lampiran A (rincian dukungan anggaran) dan Lampiran B (dokumentasi foto), memilih desa/periode, menampilkan data Babinsa, serta mencetak laporan atau menyimpannya sebagai PDF.

## Penggunaan

1. Buka aplikasi melalui HTTPS (misalnya GitHub Pages) atau localhost, lalu pilih desa/kelurahan.
2. Tekan **Pilih folder proyek** dan pilih satu folder lokal yang berisi aset dan lampiran.
3. Nama file yang disarankan:

   ```text
   stempel.png
   ttd.png
   <NRP-Babinsa>.png
   lampiran-a.txt
   foto-1.png ... foto-9.png
   ```

   Nama aset tanda tangan dibaca dari konfigurasi `tajuk/KORAMIL.json` dan `tajuk/BABINSA.json`. TXT Lampiran A berisi satu kegiatan per baris, tanggal dan uraian dipisahkan Tab. Foto B menggunakan nama seperti `foto-1.png`, `foto2.jpg`, `gambar-3.png`, atau `1.png`.
4. Pilih Lampiran A, B, atau A+B, lalu tekan **Cetak / Simpan PDF**.

Folder yang dipilih hanya dibaca di browser dan tidak diunggah ke GitHub. Browser hanya memberi akses folder setelah pengguna memilihnya. Jika sebuah aset tidak ditemukan, gambar terkait tidak tampil; laporan tetap dapat digunakan.

## PWA

PWA bisa dipasang di browser/perangkat yang mendukung install, dengan situs disajikan melalui HTTPS. Tombol install meminta prompt browser saat tersedia; bila tidak, ikuti petunjuk menu browser untuk memasang ke layar utama.

Service worker menyimpan app shell untuk akses offline dan memeriksa versi baru saat aplikasi dibuka atau kembali aktif. Jika update sudah diunduh, tombol update tersedia untuk mengaktifkan versi baru dan memuat ulang aplikasi. File lokal yang dipilih pengguna tidak dimasukkan ke cache PWA.

## Data

- `data/report-data.js`: daftar wilayah, kode, dan data Babinsa aktif.
- `data/babinsa.csv`: berkas referensi.
- `tajuk/KORAMIL.json` dan `tajuk/BABINSA.json`: konfigurasi path dan penempatan tanda tangan/stempel.
- `tajuk/lampiran-folder.js`: pemuatan TXT dan foto dari folder proyek yang dipilih.
- `sw.js`, `pwa.js`, dan `manifest.webmanifest`: dukungan PWA/install/update.

Laporan dicetak melalui dialog cetak browser. Pilih **Simpan sebagai PDF** untuk menyimpan berkas PDF.
