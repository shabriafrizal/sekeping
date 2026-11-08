/**
 * UI translation. Keys are the Indonesian source strings, so a missing
 * translation falls back to the original instead of a blank label.
 */
export type Language = 'id' | 'en';

function initialLanguage(): Language {
  try {
    const raw = localStorage.getItem('sekeping.state.v1');
    if (raw) {
      const value = JSON.parse(raw)?.settings?.language;
      if (value === 'en' || value === 'id') return value;
    }
  } catch {
    /* first run */
  }
  return 'id';
}

let current: Language = initialLanguage();

export function setLanguage(language: Language): void {
  current = language;
}

export function getLanguage(): Language {
  return current;
}

const EN: Record<string, string> = {
  "Batal": "Cancel",
  "Batalkan": "Cancel",
  "Hapus": "Delete",
  "Simpan": "Save",
  "Ubah": "Edit",
  "Tambah": "Add",
  "+ Tambah": "+ Add",
  "Tutup": "Close",
  "Kembali": "Back",
  "Selesai": "Done",
  "Kelola": "Manage",
  "Lihat semua": "View all",
  "Lihat transaksi": "View transactions",
  "Mulai": "Start",
  "Aktifkan": "Enable",
  "Pulihkan": "Restore",
  "Cadangkan JSON": "Back up JSON",
  "Muat data contoh": "Load sample data",
  "Unduh contoh": "Download sample",
  "Gunakan teks ini": "Use this text",
  "Tebak ulang": "Detect again",
  "Lewati": "Skip",
  "Lewati sekali": "Skip once",
  "Lewati duplikat": "Skip duplicates",
  "Pasang PIN": "Set PIN",
  "Hapus PIN": "Remove PIN",
  "Kunci sekarang": "Lock now",
  "Reset filter": "Reset filters",
  "Cari transaksi": "Search transactions",
  "Masukkan PIN": "Enter PIN",
  "PIN baru": "New PIN",
  "Ulangi PIN": "Repeat PIN",
  "Kata sandi": "Password",
  "Ulangi kata sandi": "Repeat password",
  "Aktif": "Active",
  "Nonaktif": "Inactive",
  "Opsional": "Optional",
  "Total": "Total",
  "Status": "Status",
  "Jenis": "Type",
  "Ringkasan": "Overview",
  "Transaksi": "Transactions",
  "Laporan": "Reports",
  "Utang": "Debt",
  "Piutang": "Receivable",
  "Utang & Piutang": "Debt & Receivable",
  "Anggaran": "Budgets",
  "Rutin & langganan": "Recurring & subscriptions",
  "Rutin": "Recurring",
  "Impor CSV": "CSV import",
  "Pengaturan": "Settings",
  "Perencanaan": "Planning",
  "Akun": "Account",
  "Menu": "Menu",
  "Pintasan": "Shortcuts",
  "Pintasan keyboard": "Keyboard shortcuts",
  "Pintasan keyboard (?)": "Keyboard shortcuts (?)",
  "Tur antarmuka": "Interface tour",
  "Tentang Sekeping": "About Sekeping",
  "Profil": "Profile",
  "Preferensi": "Preferences",
  "Keamanan": "Security",
  "Data": "Data",
  "Rencana": "Plan",
  "Riwayat": "History",
  "Analisis": "Analysis",
  "Keuangan": "Finance",
  "Rekening": "Account",
  "Kategori": "Category",
  "Catatan": "Note",
  "Jumlah": "Amount",
  "Tanggal": "Date",
  "Waktu · opsional": "Time · optional",
  "Jenis transaksi": "Transaction type",
  "Jenis kategori": "Category type",
  "Jenis catatan": "Record type",
  "Jenis laporan": "Report type",
  "Jenis bawaan": "Default type",
  "Pengeluaran": "Expense",
  "Pendapatan": "Income",
  "Transfer": "Transfer",
  "Saldo awal": "Opening balance",
  "Biaya admin": "Admin fee",
  "Ke": "To",
  "Ke rekening": "To account",
  "Rekening bawaan": "Default account",
  "Kategori tanpa anggaran": "Categories without a budget",
  "Langganan": "Subscription",
  "Jatuh tempo": "Due date",
  "Jatuh tempo berikutnya": "Next due date",
  "Tanggal mulai": "Start date",
  "Total saldo": "Total balance",
  "Total transaksi": "Total transactions",
  "Masuk bulan ini": "In this month",
  "Keluar bulan ini": "Out this month",
  "Sisa bulan ini": "Left this month",
  "Sisa": "Remaining",
  "Tingkat tabungan": "Saving rate",
  "Terpakai": "Used",
  "Terbesar": "Largest",
  "Dana tersedia": "Available funds",
  "Batas per bulan": "Limit per month",
  "Batas pengeluaran bulanan": "Monthly spending limit",
  "Bulan ini": "This month",
  "Bulan sebelumnya": "Previous month",
  "Bulan berikutnya": "Next month",
  "Mulai bulan": "Start of month",
  "7 hari terakhir": "Last 7 days",
  "Tren 6 bulan": "6-month trend",
  "Komposisi kategori": "Category breakdown",
  "Paling boros": "Top spending",
  "Transaksi terakhir": "Recent transactions",
  "Pengingat": "Reminders",
  "Menunggu dicatat": "Waiting to be recorded",
  "Belum mulai": "Not started",
  "Jadwal aktif": "Active schedules",
  "Jadwal berulang": "Recurring schedule",
  "Ulangi setiap": "Repeat every",
  "Semua jadwal": "All schedules",
  "Saring jadwal": "Filter schedules",
  "Nama jadwal": "Schedule name",
  "Nama": "Name",
  "Nama kategori": "Category name",
  "Nama rekening": "Account name",
  "Nama panggilan": "Display name",
  "Kunci PIN": "PIN lock",
  "Bahasa": "Language",
  "Mata uang": "Currency",
  "Format tanggal": "Date format",
  "Opsi": "Options",
  "Otomatis": "Automatic",
  "Baris": "Row",
  "Berkas": "File",
  "Teks CSV": "CSV text",
  "Atau tempel teks CSV": "Or paste CSV text",
  "Pilih berkas CSV": "Choose CSV file",
  "1. Pilih berkas": "1. Choose file",
  "2. Petakan kolom": "2. Map columns",
  "Pratinjau impor, dapat digulir": "Import preview, scrollable",
  "Duplikat": "Duplicates",
  "Siap": "Ready",
  "Impor berkas lain": "Import another file",
  "Arah dari tanda angka": "Direction from the sign",
  "Rollover": "Rollover",
  "Rollover bulanan": "Monthly rollover",
  "Rollover terkumpul": "Accumulated rollover",
  "Anggaran per kategori": "Budget per category",
  "Buat anggaran": "Create budget",
  "Tambah jadwal": "Add schedule",
  "Catat": "Record",
  "Catat sekarang": "Record now",
  "Catat di rekening sekarang": "Record in account now",
  "Data masuk": "Imported data",
  "Kembali ke transaksi": "Back to transactions",
  "Ekspor CSV": "Export CSV",
  "Ekspor terenkripsi": "Encrypted export",
  "Buka cadangan terenkripsi": "Open encrypted backup",
  "Cadangan JSON yang dikunci kata sandi": "Password-locked JSON backup",
  "Pilih bulan anggaran": "Choose budget month",
  "Rentang tanggal laporan": "Report date range",
  "Dari tanggal": "From date",
  "Sampai tanggal": "To date",
  "Mulai dari kosong": "Start empty",
  "Lihat data contoh": "View sample data",
  "Data tersimpan di perangkatmu sendiri.": "Your data stays on this device.",
  "Tempat uangmu disimpan": "Where your money lives",
  "Kelompokkan transaksimu": "Group your transactions",
  "Cash, BCA, GoPay…": "Cash, BCA, GoPay…",
  "Netflix, sewa kos, gaji…": "Netflix, rent, salary…",
  "Cari catatan, kategori, atau rekening…": "Search notes, categories, or accounts…",
  "Tidak ada transaksi": "No transactions",
  "Belum ada transaksi": "No transactions yet",
  "Mulai catat pengeluaran pertamamu.": "Start by recording your first expense.",
  "Coba ubah filter atau catat transaksi baru.": "Try changing filters or add a new transaction.",
  "Belum ada pengeluaran bulan ini.": "No spending this month yet.",
  "Belum ada data pada periode ini.": "No data for this period.",
  "Belum ada anggaran": "No budgets yet",
  "Bekerja tanpa mouse": "Works without a mouse",
  "Pintasan nonaktif saat kamu mengetik di kolom isian. Dialog selalu bisa ditutup dengan Esc.": "Shortcuts are off while typing in a field. Dialogs always close with Esc.",
  "Mulai tanpa data. Data contoh hanya dimuat jika kamu memilihnya.": "Starts without data. Sample data is only loaded if you choose it.",
  "Catatan keuangan yang tenang.": "A calm money journal.",
  "Sekeping terkunci di perangkat ini.": "Sekeping is locked on this device.",
  "PIN salah, coba lagi.": "Wrong PIN, try again.",
  "4 angka, hanya di perangkat ini": "4 digits, on this device only",
  "Tindakan ini tidak bisa dibatalkan": "This action cannot be undone",
  "Hapus semua data?": "Delete all data?",
  "Hapus semua": "Delete all",
  "Semua transaksi, rekening, kategori, anggaran, jadwal rutin dan utang di perangkat ini akan dihapus. Cadangkan JSON dulu bila ragu.": "All transactions, accounts, categories, budgets, schedules and debts on this device will be deleted. Back up to JSON first if unsure.",
  "PIN hanya tersimpan di perangkat ini, bukan di server. Ini pengaman layar, bukan enkripsi data — untuk cadangan yang terkunci, gunakan Ekspor terenkripsi di bagian Data.": "PIN is stored on this device only, not on a server. It guards the screen, not the data — for locked backups use Encrypted export in the Data section.",
  "Masukkan kata sandi yang dipakai saat mengekspor. Kata sandi tidak disimpan di mana pun.": "Enter the password used when exporting. The password is not stored anywhere.",
  "Kata sandi (min. 8 karakter)": "Password (min. 8 characters)",
  "Kategori ini sudah punya anggaran. Ubah yang sudah ada agar rollover-nya tetap benar.": "This category already has a budget. Edit the existing one so rollover stays correct.",
  "Pilih kategori untuk menetapkan batas bulanannya.": "Pick a category to set its monthly limit.",
  "Anggaran nonaktif disembunyikan dari daftar dan ringkasan.": "Inactive budgets are hidden from the list and summary.",
  "Jadwal nonaktif tidak membuat transaksi baru.": "Inactive schedules create no new transactions.",
  "Rekening tidak aktif disembunyikan saat mencatat transaksi.": "Inactive accounts are hidden when recording a transaction.",
  "Kategori tidak aktif disembunyikan saat mencatat transaksi.": "Inactive categories are hidden when recording a transaction.",
  "Tandai sebagai langganan berbayar untuk ringkasan biaya bulanan.": "Mark as a paid subscription for the monthly cost summary.",
  "Sisa anggaran yang tidak terpakai ditambahkan ke jatah bulan berikutnya.": "Unused budget rolls into next month's allowance.",
  "Tetapkan batas bulanan untuk kategori yang paling sering kamu pakai.": "Set a monthly limit for the categories you use most.",
  "Transaksi ini otomatis masuk ke buku saat aplikasi dibuka. Kamu juga bisa mencatatnya sekarang.": "This transaction posts automatically when the app opens. You can also record it now.",
  "Saat aplikasi dibuka pada atau setelah tanggal itu, transaksi dibuat otomatis. Tanggal yang terlewat dicatat sekaligus.": "When the app opens on or after that date the transaction is created automatically. Missed dates are caught up at once.",
  "Semua baris yang valid sudah masuk ke buku. Baris duplikat dan bermasalah dilewati.": "All valid rows are in the ledger. Duplicate and invalid rows were skipped.",
  "Baris dengan tanggal, jenis, jumlah, dan catatan yang sama tidak diimpor ulang.": "Rows with the same date, type, amount and note are not imported twice.",
  "Nama yang belum ada ditambahkan otomatis, bukan dibuang.": "Unknown names are created automatically rather than dropped.",
  "Tanggal dan jumlah wajib dipetakan sebelum bisa diimpor.": "Date and amount must be mapped before importing.",
  "Petakan kolom dari bank atau aplikasi lain, lalu periksa sebelum menyimpan.": "Map columns from your bank or another app, then review before saving.",
  "Tanggal,Jenis,Kategori,Rekening,Jumlah,Catatan…": "Date,Type,Category,Account,Amount,Note…",
  "Sekeping adalah aplikasi pencatat keuangan pribadi untuk web. Semua perhitungan berjalan di browser dan datanya tetap di perangkatmu — tidak ada akun, tidak ada unggahan.": "Sekeping is a personal finance app for the web. Everything runs in your browser and your data stays on this device — no account, no uploads.",
  "Versi 1.1 · dibuat sebagai penerapan ulang mandiri dengan antarmuka dan kode sendiri.": "Version 1.1 · an independent rebuild with its own interface and code.",
  "Ketuk angka atau ketik di keyboard": "Tap a number or type on the keyboard",
  "Papan angka": "Keypad",
  "Jumlah cepat": "Quick amounts",
  "Hapus satu angka": "Delete one digit",
  "Hapus semua data": "Delete all data",
  "Pindah antar kontrol": "Move between controls",
  "Pindah antar item menu": "Move between menu items",
  "Langsung ke halaman (urutan menu)": "Jump to a page (menu order)",
  "Buka atau tutup daftar pintasan ini": "Open or close this shortcut list",
  "Tutup dialog": "Close dialog",
  "Catat pengeluaran baru": "Record a new expense",
  "Jatuh tempo hari ini": "Due today",
  "Jatuh tempo besok": "Due tomorrow",
  "Sisa {n} hari": "{n} days left",
  "{n} transaksi berulang dicatat otomatis": "{n} recurring transactions posted automatically",
  "Tagihan & langganan jatuh tempo dalam 7 hari. Tandai selesai untuk mencatatnya hari ini.": "Bills & subscriptions due within 7 days. Mark one done to record it today.",
  "Tagihan & langganan": "Bills & subscriptions",
  "Sebelumnya": "Previous",
  "Berikutnya": "Next",
  "Lanjut": "Next",
  "Saldo semua rekening": "Balance across accounts",
  "Angka ini berubah setiap kali kamu mencatat transaksi. Di bawahnya, uang masuk dan keluar bulan ini.": "This changes with every transaction. Below it, this month's money in and out.",
  "Rekeningmu": "Your accounts",
  "Dompet, bank, dan dompet digital. Tiap rekening menghitung saldonya sendiri.": "Cash, bank and e-wallets. Each account tracks its own balance.",
  "Catat transaksi": "Record a transaction",
  "Tekan di sini untuk pengeluaran, pemasukan, atau transfer antar rekening.": "Use this for expenses, income or transfers between accounts.",
  "Tingkat tabungan, pola belanja tujuh hari, dan kategori paling boros.": "Saving rate, seven-day spending and top categories.",
  "Semua ada di sini": "Everything is here",
  "Transaksi, laporan, utang dan piutang. Pengaturan berisi ekspor dan cadangan.": "Transactions, reports, debts and receivables. Settings holds export and backup.",
  "Hari ini": "Today",
  "Kemarin": "Yesterday",
  "Semua": "All",
  "Rentang": "Range",
  "Bulan lalu": "Last month",
  "3 bulan": "3 months",
  "Tahun ini": "This year",
  "1 tahun": "1 year",
  "7 hari": "7 days",
  "30 hari": "30 days",
  "Rata-rata / hari": "Average / day",
  "Rata-rata / bulan": "Average / month",
  "Dari": "From",
  "Sampai": "To",
  "Total pengeluaran": "Total spending",
  "Total pendapatan": "Total income",
  "Selisih": "Net",
  "Masuk": "In",
  "Keluar": "Out"
};

const TEMPLATES: Record<string, string> = {
  "{n} transaksi bulan ini.": "{n} transactions this month.",
  "{n} catatan · masuk {in} · keluar {out}": "{n} records · in {in} · out {out}",
  "Jatuh tempo dalam {n} hari": "Due in {n} days",
  "Terlambat {n} hari": "{n} days overdue",
  "Lewat {n} hari": "{n} days late",
  "Dari {income} pemasukan, {flow} tersisa.": "Of {income} income, {flow} is left.",
  "Pengeluaran melebihi pemasukan sebesar {amount}.": "Spending exceeds income by {amount}.",
  "Rata-rata {amount} per hari bulan ini.": "Average {amount} per day this month.",
  "Langkah {n} dari {m}": "Step {n} of {m}"
};


Object.assign(EN, {
  "Tambah transaksi": "Add transaction",
  "+ Pengeluaran": "+ Expense",
  "+ Pendapatan": "+ Income",
  "Semua rekening": "All accounts",
  "Semua kategori": "All categories",
  "Bulanan": "Monthly",
  "Mingguan": "Weekly",
  "Tahunan": "Yearly",
  "Harian": "Daily",
  "Catat utang": "Record debt",
  "Catat piutang": "Record receivable",
  "Sisa yang harus kamu bayar": "Left to pay",
  "Sisa yang harus kamu tagih": "Left to collect",
  "Keluar per bulan": "Out per month",
  "Total pengeluaran": "Total spending",
  "Total pendapatan": "Total income",
  "Rata-rata / hari": "Average / day",
  "Rata-rata / bulan": "Average / month",
  "Lunas": "Paid",
  "Berjalan": "Ongoing",
  "Tanpa kategori": "Uncategorized",
  "Lainnya": "Other",
  "Semua transaksi": "All transactions",
  "Masuk": "In",
  "Keluar": "Out",
  "Selamat pagi": "Good morning",
  "Selamat siang": "Good afternoon",
  "Selamat sore": "Good evening",
  "Selamat malam": "Good night",
  "Belum ada pemasukan bulan ini.": "No income this month yet.",
  "Belum ada transaksi": "No transactions yet",
  "aktif": "active",
  "nonaktif": "inactive",
  "catatan": "records",
  "hari": "days",
  "bulan": "months",
  "Pemasukan": "Income",
  "Jadwal aktif": "Active schedules",
  "Menunggu dicatat": "Waiting to be recorded",
  "Per bulan": "Per month",
  "Rata-rata": "Average",
  "Total": "Total"
});
Object.assign(TEMPLATES, {
  "Rata-rata {amount} per bulan dalam 6 bulan terakhir.": "Average {amount} per month over the last 6 months.",
  "{n} jadwal aktif · {m} menunggu dicatat": "{n} active schedules · {m} waiting to be recorded",
  "Jatuh tempo {date}": "Due {date}",
  "{n} hari": "{n} days"
});


Object.assign(EN, {"Kewajiban": "Liabilities", "Semua waktu": "All time", "transfer antar rekening tidak dihitung": "transfers between accounts are excluded", "dari": "of", "mulai": "since", "Bayar": "Pay", "Terima": "Receive", "Ubah": "Edit", "Tandai selesai": "Mark done", "Tandai": "Mark", "Hapus": "Delete", "Pemasukan": "Income", "Pengeluaran": "Expense", "Total": "Total", "Belum ada data": "No data yet", "Lanjut": "Next", "Sebelumnya": "Previous", "Selesai": "Done", "Hari ini": "Today", "Kemarin": "Yesterday", "Bulan ini": "This month", "Semua": "All"});
Object.assign(TEMPLATES, {" · {n} hari": " · {n} days", "{left} dari {total}": "{left} of {total}", "· mulai {date}": "· since {date}", "Dalam {n} hari": "In {n} days"});


Object.assign(EN, {"Detail transaksi": "Transaction detail", "Detail transfer": "Transfer detail", "Belum ada jadwal": "No schedules yet", "Tidak ada yang cocok": "Nothing matches", "Tambahkan gaji, sewa, atau langganan agar tercatat otomatis.": "Add salary, rent or a subscription so it records automatically.", "Utang & piutang": "Debt & receivables", "Cicilan dan pinjaman": "Instalments and loans", "Profil, data, dan keamanan": "Profile, data and security", "Jadwal transaksi otomatis": "Automatic transaction schedule", "Batas bulanan per kategori": "Monthly limit per category", "Pemetaan kolom dari bank": "Column mapping from your bank"});


Object.assign(EN, {"Ubah rekening": "Edit account", "Tambah rekening": "Add account", "Ubah kategori": "Edit category", "Tambah kategori": "Add category", "Ubah catatan": "Edit record", "Pilih ikon": "Choose icon", "Berakhir (opsional)": "Ends (optional)", "Transaksi berulang & langganan": "Recurring transactions & subscriptions", "Tambahkan pemasukan sebesar pinjaman ke rekening.": "Add an income for the loan amount to the account.", "Tambahkan pengeluaran sebesar pinjaman ke rekening.": "Add an expense for the loan amount to the account.", "Saat aplikasi dibuka pada atau setelah tanggal itu, transaksi dibuat otomatis. Tanggal yang terlewat dicatat sekaligus.": "When the app opens on or after that date the transaction is created automatically. Missed dates are caught up at once."});


Object.assign(EN, {"PIN hanya tersimpan di perangkat ini, bukan di server. Ini pengaman layar, bukan enkripsi data — untuk cadangan yang terkunci, gunakan": "PIN is stored on this device only, not on a server. It guards the screen, not the data — for locked backups use", "di bagian Data.": "in the Data section.", "Ekspor terenkripsi memakai AES-GCM dengan kunci dari kata sandimu (PBKDF2). Tanpa kata sandi, berkas tidak bisa dibuka — simpan baik-baik.": "Encrypted export uses AES-GCM with a key from your password (PBKDF2). Without the password the file cannot be opened — keep it safe.", "Sekeping adalah aplikasi pencatat keuangan pribadi untuk web. Semua perhitungan berjalan di browser dan datanya tetap di perangkatmu — tidak ada akun, tidak ada unggahan.": "Sekeping is a personal finance app for the web. Everything runs in your browser and your data stays on this device — no account, no uploads.", "+ Kategori cepat": "+ Quick category", "Aktif": "Active"});
Object.assign(TEMPLATES, {"{n} jadwal aktif · transaksi otomatis": "{n} active schedules · automatic transactions", "{n} kategori dengan batas bulanan": "{n} categories with a monthly limit", "Saldo awal {amount}": "Opening balance {amount}"});


Object.assign(EN, {"Uang yang kamu pinjam": "Money you borrowed", "Uang yang kamu pinjamkan": "Money you lent"});


Object.assign(EN, {"Rollover hanya meneruskan sisa positif ke bulan berikutnya; kelebihan tidak mengurangi jatah bulan depan.": "Rollover only carries a positive remainder into next month; overspending never reduces next month's allowance.", "File tetap diproses di perangkat ini; tidak ada yang diunggah.": "The file is processed on this device; nothing is uploaded.", "semua dalam batas": "all within limit"});
Object.assign(TEMPLATES, {"{n} melewati batas": "{n} over the limit", "{n} kategori · {status}": "{n} categories · {status}"});


Object.assign(EN, {"Belum ada utang": "No debts yet", "Belum ada piutang": "No receivables yet"});


Object.assign(EN, {"Makan & Minum": "Food & Drink", "Tagihan": "Bills", "Belanja": "Shopping", "Rumah": "Home", "Kesehatan": "Health", "Hiburan": "Entertainment", "Pendidikan": "Education", "Hadiah": "Gifts", "Gaji": "Salary", "Hasil Investasi": "Investment returns", "Pemasukan Lain": "Other income", "Internet rumah": "Home internet", "Pinjaman motor": "Motorbike loan", "Dipinjam Rani": "Lent to Rani", "Gaji bulanan": "Monthly salary", "Proyek desain lepas": "Freelance design project", "Bonus proyek sampingan": "Side project bonus", "Dividen reksa dana": "Mutual fund dividend", "Top up saldo": "Balance top-up", "Cicilan ke-3": "Instalment 3", "Cicilan ke-2": "Instalment 2", "Cicilan pertama": "First instalment", "Langganan Netflix": "Netflix subscription"});


Object.assign(TEMPLATES, {"Jatuh tempo dalam {n} hari": "Due in {n} days", "{n} transaksi berulang dicatat otomatis": "{n} recurring transactions posted automatically", "Rata-rata {amount} per bulan dalam 6 bulan terakhir.": "Average {amount} per month over the last 6 months.", "{n} jadwal aktif · {m} menunggu dicatat": "{n} active schedules · {m} waiting to be recorded", "{n} catatan · masuk {in} · keluar {out}": "{n} records · in {in} · out {out}", "{n} transaksi bulan ini.": "{n} transactions this month.", "Dari {income} pemasukan, {flow} tersisa.": "Of {income} income, {flow} is left.", "Pengeluaran melebihi pemasukan sebesar {amount}.": "Spending exceeds income by {amount}.", "Rata-rata {amount} per hari bulan ini.": "Average {amount} per day this month.", " · {n} hari": " · {n} days", "{left} dari {total}": "{left} of {total}", "Saldo awal {amount}": "Opening balance {amount}", "{n} kategori · {status}": "{n} categories · {status}", "{n} melewati batas": "{n} over the limit", "{n} jadwal aktif · transaksi otomatis": "{n} active schedules · automatic transactions", "{n} kategori dengan batas bulanan": "{n} categories with a monthly limit"});


Object.assign(EN, {"Angka; simbol mata uang dan pemisah ribuan diabaikan": "Number; currency symbols and thousands separators are ignored", "Pengeluaran, Pendapatan atau Transfer": "Expense, Income or Transfer", "Nama kategori; dibuat otomatis bila diizinkan": "Category name; created automatically when allowed", "Nama rekening sumber": "Source account name", "Keterangan transaksi": "Transaction description", "YYYY-MM-DD, DD/MM/YYYY atau MM/DD/YYYY": "YYYY-MM-DD, DD/MM/YYYY or MM/DD/YYYY"});


Object.assign(EN, {"Nasi padang": "Padang rice", "Kopi susu": "Milk coffee", "Belanja bulanan": "Monthly groceries", "Makan malam keluarga": "Family dinner", "Gojek ke kantor": "Ride to the office", "Isi bensin": "Fuel", "Parkir": "Parking", "Listrik & air": "Electricity & water", "Internet fiber": "Fibre internet", "Pulsa & paket data": "Phone credit & data", "Baju kerja": "Work clothes", "Perlengkapan rumah": "Home supplies", "Perbaikan keran": "Faucet repair", "Vitamin & obat": "Vitamins & medicine", "Olahraga": "Sport", "Nonton bioskop": "Cinema", "Langganan musik": "Music subscription", "Kelas online": "Online course", "Kado ulang tahun": "Birthday gift", "Cicilan 12 bulan, tenor ke-4": "12 instalments, 4th payment", "Buat biaya kos": "For rent"});


Object.assign(EN, {"Hapus semua angka": "Clear all", "Ketik angka; dua digit terakhir adalah sen": "Type digits; the last two are the cents"});

export function t(key: string, vars?: Record<string, string | number>): string {
  const source = current === 'en' ? (TEMPLATES[key] ?? EN[key] ?? key) : key;
  if (!vars) return source;
  return source.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

export function isEnglish(): boolean {
  return current === 'en';
}
