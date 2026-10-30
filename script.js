// ===== Tìm Quanh Đây — bản mẫu v2 (demo) =====
// Tài khoản: đăng ký/đăng nhập bằng SỐ ĐIỆN THOẠI + OTP (bản mẫu chưa có cổng SMS thật,
// mã OTP hiện ngay trên màn hình để xem thử).
// Logic thuần (kiểm tra số, OTP, haversine, sinh vị trí, lọc) viết độc lập để kiểm thử bằng Node.

// Vị trí mặc định: khu vực Bến phà Đồng Bài, Cát Hải (dùng khi chưa/không bật định vị)
var VI_TRI_MAC_DINH = { lat: 20.815, lng: 106.887 };
var KHOA_LUU = "tqd_me";            // khóa localStorage: số điện thoại đang đăng nhập
var KHOA_USERS = "tqd_users";       // khóa localStorage: map số điện thoại -> hồ sơ
var KHOA_GUI_OTP = "tqd_otp_gui_luc"; // mốc thời gian gửi OTP gần nhất (chống spam khi tải lại trang)
var KHOA_TOKEN = "tqd_token";       // khóa localStorage: token phiên đăng nhập máy chủ

// ===== CẤU HÌNH MÁY CHỦ (lớp cuối: OTP qua SMS thật, chống gian lận ở máy chủ) =====
// Để RỖNG ("")  -> app chạy y hệt bản v2: mã OTP demo hiện trên màn hình, kết quả là hồ sơ mẫu.
// Điền URL máy chủ (vd "https://app.example.com") -> app gọi API máy chủ trong thư mục server/:
//   OTP gửi qua SMS thật, hồ sơ + vị trí đồng bộ lên máy chủ, "quanh đây" là người dùng thật.
// Trang web chạy HTTPS thì URL máy chủ cũng PHẢI là HTTPS, không thì trình duyệt chặn cuộc gọi.
var TQD_SERVER = "https://api.hialo.vn";

var EMOJI_AVATAR = ["😀","😎","🥰","😺","🐶","🌸","⚽","🎸","📚","☕","🍜","🏍️","🚗","🎤","🎨","🏀","🐱","🦊","🐼","🌻","🍀","🎧","📷","✈️"];

// ===== HỒ SƠ MẪU (DEMO) — bản thật sẽ là người dùng thật tự đăng ký =====
var HO_SO_DEMO = [
  { ten: "Lan Anh",     gioi: "nu",  tuoi: 24, emoji: "🌸" },
  { ten: "Thu Hằng",    gioi: "nu",  tuoi: 31, emoji: "🥰" },
  { ten: "Ngọc Mai",    gioi: "nu",  tuoi: 27, emoji: "😀" },
  { ten: "Thanh Thảo",  gioi: "nu",  tuoi: 22, emoji: "📚" },
  { ten: "Hải Yến",     gioi: "nu",  tuoi: 35, emoji: "☕" },
  { ten: "Phương Linh", gioi: "nu",  tuoi: 29, emoji: "🎤" },
  { ten: "Quỳnh Trang", gioi: "nu",  tuoi: 26, emoji: "🎨" },
  { ten: "Minh Nguyệt", gioi: "nu",  tuoi: 41, emoji: "🐱" },
  { ten: "Tuyết Nhung", gioi: "nu",  tuoi: 33, emoji: "🌻" },
  { ten: "Kim Chi",     gioi: "nu",  tuoi: 19, emoji: "🍀" },
  { ten: "Bảo Châu",    gioi: "nu",  tuoi: 48, emoji: "😎" },
  { ten: "Thủy Tiên",   gioi: "nu",  tuoi: 24, emoji: "🦊" },
  { ten: "Văn Đức",     gioi: "nam", tuoi: 28, emoji: "⚽" },
  { ten: "Hoàng Nam",   gioi: "nam", tuoi: 33, emoji: "🏍️" },
  { ten: "Tuấn Anh",    gioi: "nam", tuoi: 25, emoji: "🎸" },
  { ten: "Minh Quân",   gioi: "nam", tuoi: 30, emoji: "💪" },
  { ten: "Quốc Bảo",    gioi: "nam", tuoi: 38, emoji: "🚗" },
  { ten: "Đức Huy",     gioi: "nam", tuoi: 21, emoji: "🎧" },
  { ten: "Thanh Tùng",  gioi: "nam", tuoi: 45, emoji: "📷" },
  { ten: "Văn Hải",     gioi: "nam", tuoi: 29, emoji: "🐶" },
  { ten: "Ngọc Sơn",    gioi: "nam", tuoi: 52, emoji: "😺" },
  { ten: "Hữu Phước",   gioi: "nam", tuoi: 27, emoji: "✈️" },
  { ten: "Trọng Nghĩa", gioi: "nam", tuoi: 36, emoji: "🍜" },
  { ten: "Xuân Trường", gioi: "nam", tuoi: 23, emoji: "🏀" }
];

// ===== KIỂM TRA SỐ ĐIỆN THOẠI DI ĐỘNG VIỆT NAM =====
// LƯU Ý QUAN TRỌNG: kiểm tra phía client này chỉ là LỚP LỌC ĐẦU SỐ (đúng định dạng 10 số +
// đầu số thuộc danh sách di động VN). Chống số ảo/VoIP/số nước ngoài trá hình ở mức chắc chắn
// phải tra cứu nhà mạng (HLR lookup) qua máy chủ — việc đó thuộc bản máy chủ, không làm ở đây.
var DAU_SO_DI_DONG_VN = [
  "032","033","034","035","036","037","038","039",
  "055","059",
  "070","076","077","078","079",
  "081","082","083","084","085","086","087","088","089",
  "090","091","092","093","094","096","097","098","099"
];

// Trả về { hople: true, so: "0xxxxxxxxx" } hoặc { hople: false, lyDo: "..." }
function kiemTraSoVN(soThoai) {
  if (soThoai === null || soThoai === undefined) soThoai = "";
  // Bỏ khoảng trắng, dấu chấm, dấu gạch ngang, ngoặc
  var s = String(soThoai).replace(/[\s.\-()]/g, "");
  if (!s) return { hople: false, lyDo: "Bạn chưa nhập số điện thoại." };

  if (s.charAt(0) === "+") {
    if (s.indexOf("+84") === 0) {
      s = "0" + s.slice(3); // +84xxxxxxxxx -> 0xxxxxxxxx
    } else {
      return { hople: false, lyDo: "Chỉ chấp nhận số di động Việt Nam (mã nước +84)." };
    }
  } else if (s.indexOf("00") === 0) {
    return { hople: false, lyDo: "Chỉ chấp nhận số di động Việt Nam (mã nước +84)." };
  } else if (s.indexOf("84") === 0 && s.length === 11) {
    s = "0" + s.slice(2); // 84xxxxxxxxx (11 số) -> 0xxxxxxxxx
  }

  if (!/^\d+$/.test(s)) {
    return { hople: false, lyDo: "Số điện thoại chỉ gồm các chữ số, bạn kiểm tra lại nhé." };
  }
  if (s.length !== 10) {
    return { hople: false, lyDo: "Số di động Việt Nam cần đúng 10 số (bạn đang nhập " + s.length + " số)." };
  }
  if (s.indexOf("02") === 0) {
    return { hople: false, lyDo: "Số điện thoại bàn không được đăng ký. Vui lòng dùng số di động cá nhân." };
  }
  var dauSo = s.slice(0, 3);
  if (DAU_SO_DI_DONG_VN.indexOf(dauSo) === -1) {
    return { hople: false, lyDo: "Đầu số không phải số di động Việt Nam (đầu số bạn nhập: " + dauSo + ")." };
  }
  return { hople: true, so: s };
}

// ===== OTP (bản mẫu — chưa có cổng SMS thật) =====
var OTP_HET_HAN_MS = 5 * 60 * 1000;  // mã chỉ sống 5 phút
var OTP_CHO_GUI_LAI_MS = 60 * 1000;  // chờ 60 giây mới được gửi lại mã
var OTP_TOI_DA_SAI = 5;              // nhập sai 5 lần là khóa phiên mã đó

function sinhMaOTP() {
  return String(Math.floor(100000 + Math.random() * 900000)); // luôn đủ 6 chữ số
}

// Một phiên OTP: mã + thời điểm gửi + số lần đã nhập sai + cờ khóa
function taoPhienOTP(ma, guiLuc) {
  return {
    ma: String(ma),
    guiLuc: guiLuc,
    hetHanLuc: guiLuc + OTP_HET_HAN_MS,
    soLanSai: 0,
    biKhoa: false
  };
}

// Kiểm tra mã người dùng nhập. Trả về:
//   { ok: true }
//   { ok: false, lyDo: "chuaGui" | "khoa" | "hetHan" | "sai", conLai: n }
function kiemTraOTP(phien, maNhap, bayGio) {
  if (!phien) return { ok: false, lyDo: "chuaGui" };
  if (phien.biKhoa) return { ok: false, lyDo: "khoa" };
  if (bayGio > phien.hetHanLuc) return { ok: false, lyDo: "hetHan" };
  if (String(maNhap).replace(/\s/g, "") === phien.ma) return { ok: true };
  phien.soLanSai += 1;
  if (phien.soLanSai >= OTP_TOI_DA_SAI) {
    phien.biKhoa = true;
    return { ok: false, lyDo: "khoa", soLanSai: phien.soLanSai };
  }
  return { ok: false, lyDo: "sai", conLai: OTP_TOI_DA_SAI - phien.soLanSai };
}

// Số giây còn phải chờ trước khi gửi lại mã kể từ lần gửi lúc guiLuc (0 = gửi được ngay)
function giayChoGuiLai(guiLuc, bayGio) {
  if (!guiLuc) return 0;
  var conMs = OTP_CHO_GUI_LAI_MS - (bayGio - guiLuc);
  return conMs > 0 ? Math.ceil(conMs / 1000) : 0;
}

// ===== LOGIC THUẦN: KHOẢNG CÁCH / VỊ TRÍ / LỌC (giữ nguyên từ v1) =====

// Khoảng cách đường chim bay (km) giữa 2 tọa độ — công thức haversine
function haversineKm(lat1, lng1, lat2, lng2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Điểm đến khi đi từ (lat,lng) một khoảng km theo hướng bearingDeg (0 = Bắc, 90 = Đông)
function diemDen(lat, lng, km, bearingDeg) {
  var R = 6371;
  var d = km / R;
  var br = bearingDeg * Math.PI / 180;
  var la1 = lat * Math.PI / 180;
  var lo1 = lng * Math.PI / 180;
  var la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(br));
  var lo2 = lo1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(la1),
                             Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return { lat: la2 * 180 / Math.PI, lng: lo2 * 180 / Math.PI };
}

// Sinh vị trí demo cho danh sách hồ sơ: mỗi hồ sơ cách tâm 0,3–25 km, hướng ngẫu nhiên
function taoViTriDemo(danhSach, tamLat, tamLng) {
  return danhSach.map(function (p) {
    var km = 0.3 + Math.random() * (25 - 0.3);
    var huong = Math.random() * 360;
    var d = diemDen(tamLat, tamLng, km, huong);
    var moi = {};
    for (var k in p) moi[k] = p[k];
    moi.lat = d.lat; moi.lng = d.lng;
    return moi;
  });
}

// Lọc + sắp xếp theo khoảng cách tăng dần.
// loc = { gioi: 'nu'|'nam'|'tatca', tuoiTu, tuoiDen, kmTu, kmDen }
function locHoSo(danhSach, viTri, loc) {
  var kq = [];
  for (var i = 0; i < danhSach.length; i++) {
    var p = danhSach[i];
    if (typeof p.lat !== "number" || typeof p.lng !== "number") continue;
    var km = haversineKm(viTri.lat, viTri.lng, p.lat, p.lng);
    if (loc.gioi && loc.gioi !== "tatca" && p.gioi !== loc.gioi) continue;
    if (p.tuoi < loc.tuoiTu || p.tuoi > loc.tuoiDen) continue;
    if (km < loc.kmTu || km > loc.kmDen) continue;
    var moi = {};
    for (var k in p) moi[k] = p[k];
    moi.khoangCach = km;
    kq.push(moi);
  }
  kq.sort(function (a, b) { return a.khoangCach - b.khoangCach; });
  return kq;
}

// Dưới 1 km hiện mét, từ 1 km hiện km với 1 số lẻ
function dinhDangKhoangCach(km) {
  if (km < 1) return Math.round(km * 1000) + " m";
  return km.toFixed(1).replace(".", ",") + " km";
}

// ===== PHẦN TRÌNH DUYỆT =====
if (typeof document !== "undefined") {
  var me = null;               // hồ sơ của số đang đăng nhập (nếu đã tạo)
  var sdtHienTai = null;       // số điện thoại đang đăng nhập
  var tokenMayChu = null;      // token phiên đăng nhập (chỉ khi TQD_SERVER khác rỗng)
  var phienOTP = null;         // phiên OTP đang chờ nhập mã
  var sdtDangCho = null;       // số điện thoại đang chờ xác thực OTP
  var idDemNguoc = null;       // interval đếm ngược gửi lại mã
  var viTri = null;            // {lat, lng, macDinh}
  var hoSoCoViTri = [];        // hồ sơ demo đã sinh vị trí quanh viTri
  var locGioiChon = "tatca";   // bộ lọc giới tính đang chọn
  var daChonLocThuCong = false;
  var emojiChon = EMOJI_AVATAR[0];
  var demToast = null;
  // ===== V5.1: trạng thái trung tâm Cá nhân =====
  var caiDatHT = null;            // toàn bộ cài đặt của tôi (GET /api/cai-dat)
  var trangThaiMe = "";           // dòng trạng thái của tôi
  var khoaPinBatHT = false;       // khóa PIN đang bật hay không
  var trangCaNhanDangMo = "hub";  // trang đang mở trong tab Cá nhân: "hub" | "form" | id trang con
  var nenGoiDenChon = "mac-dinh"; // hStyle: nền màn hình cuộc gọi đến đang chọn
  var nenGoiDenTepChon = "";      // hStyle: tepId ảnh nền cuộc gọi (khi chọn "anh")
  var anhViQRFile = null;         // Ví QR: file ảnh đang chờ thêm vào ví

  function $(id) { return document.getElementById(id); }

  function hienToast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.remove("an");
    if (demToast) clearTimeout(demToast);
    demToast = setTimeout(function () { t.classList.add("an"); }, 3500);
  }

  // --- Lớp máy chủ (chỉ dùng khi TQD_SERVER khác rỗng) ---
  function goiAPI(duongDan, phuongThuc, than, canToken) {
    var headers = { "Content-Type": "application/json" };
    if (canToken && tokenMayChu) headers["Authorization"] = "Bearer " + tokenMayChu;
    return fetch(TQD_SERVER + duongDan, {
      method: phuongThuc,
      headers: headers,
      body: than ? JSON.stringify(than) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, loi: "Máy chủ trả lời không hợp lệ." }; });
    }).catch(function () {
      return { ok: false, loi: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại nhé." };
    });
  }

  function luuToken() {
    try {
      if (tokenMayChu) localStorage.setItem(KHOA_TOKEN, tokenMayChu);
      else localStorage.removeItem(KHOA_TOKEN);
    } catch (e) {}
  }

  // Đồng bộ hồ sơ hiện tại lên máy chủ (khi đang ở chế độ máy chủ + đã đăng nhập)
  function dongBoHoSoLenMayChu() {
    if (!TQD_SERVER || !tokenMayChu || !me) return;
    goiAPI("/api/profile", "POST", {
      nick: me.nick, gioiTinh: me.gioi, tuoi: me.tuoi, emoji: me.emoji,
      hienThi: me.hienThi !== false
    }, true).then(function (kq) {
      if (!kq.ok) hienToast("Chưa đồng bộ được hồ sơ lên máy chủ: " + (kq.loi || "lỗi không rõ"));
      else if (viTri && !viTri.macDinh) dongBoViTriLenMayChu();
    });
  }

  // Đồng bộ vị trí THẬT (không gửi vị trí mặc định) lên máy chủ
  function dongBoViTriLenMayChu() {
    if (!TQD_SERVER || !tokenMayChu || !me || !viTri || viTri.macDinh) return;
    goiAPI("/api/location", "POST", { lat: viTri.lat, lng: viTri.lng }, true);
  }

  // --- Lưu trữ: tqd_users (map số -> hồ sơ), tqd_me (số đang đăng nhập) ---
  function taiUsers() {
    try {
      var s = localStorage.getItem(KHOA_USERS);
      var o = s ? JSON.parse(s) : {};
      return (o && typeof o === "object") ? o : {};
    } catch (e) { return {}; }
  }

  function luuUsers(users) {
    try { localStorage.setItem(KHOA_USERS, JSON.stringify(users)); } catch (e) {}
  }

  function luuMe() {
    if (!sdtHienTai || !me) return;
    var users = taiUsers();
    users[sdtHienTai] = me;
    luuUsers(users);
  }

  function taiPhienDangNhap() {
    try {
      var s = localStorage.getItem(KHOA_LUU);
      // Chỉ nhận đúng dạng số di động 10 số bắt đầu bằng 0 (dữ liệu cũ dạng khác thì bỏ qua)
      return (typeof s === "string" && /^0\d{9}$/.test(s)) ? s : null;
    } catch (e) { return null; }
  }

  function luuPhienDangNhap() {
    try {
      if (sdtHienTai) localStorage.setItem(KHOA_LUU, sdtHienTai);
      else localStorage.removeItem(KHOA_LUU);
    } catch (e) {}
  }

  function khoiPhucDangNhap() {
    sdtHienTai = taiPhienDangNhap();
    me = null;
    if (sdtHienTai) {
      var users = taiUsers();
      me = users[sdtHienTai] || null; // số đã xác thực nhưng chưa tạo hồ sơ thì me vẫn null
    }
    tokenMayChu = null;
    if (TQD_SERVER) {
      try { tokenMayChu = localStorage.getItem(KHOA_TOKEN) || null; } catch (e) {}
      if (!sdtHienTai) tokenMayChu = null;
    }
  }

  function gioiDoiDien(g) { return g === "nam" ? "nu" : "nam"; }

  function datLocGioi(gt) {
    locGioiChon = gt;
    var btns = $("locGioi").querySelectorAll("button");
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle("dangChon", btns[i].getAttribute("data-gt") === gt);
    }
  }

  // --- Điều phối màn hình khu tài khoản ---
  function capNhatManHinh() {
    var daDangNhap = !!sdtHienTai;
    $("manDienThoai").classList.toggle("an", daDangNhap || !!phienOTP);
    $("manOTP").classList.toggle("an", daDangNhap || !phienOTP);
    $("khuSauDangNhap").classList.toggle("an", !daDangNhap);
    if (daDangNhap) veKhuHoSo();
    capNhatKhungTab(); // V4: khung 5 tab kiểu Zalo (chỉ chế độ máy chủ)
  }

  // --- Hồ sơ của tôi (sau khi đã đăng nhập) ---
  // V5.1: thẻ tóm tắt cũ thay bằng THẺ HUB Cá nhân (avatar + tên + trạng thái + SĐT)
  // và hệ thống trang con (Cài đặt, hCloud, hStyle, Tài liệu, Ví QR...).
  function veKhuHoSo() {
    var co = !!me;
    if (co) {
      $("avatarMe").textContent = me.emoji || (me.nick ? me.nick.charAt(0).toUpperCase() : "😀");
      $("loiChao").textContent = me.nick || "Xin chào!";
      $("thongTinMe").textContent =
        (me.gioi === "nu" ? "👩 Nữ" : "🧑 Nam") + " · " + me.tuoi + " tuổi";
      $("sdtMe").textContent = "📱 " + (sdtHienTai || "");
      $("chkHienThi").checked = me.hienThi !== false;
      if (me.trangThai) trangThaiMe = me.trangThai; // bản đồng bộ từ máy chủ lúc đăng nhập
      capNhatBongTrangThai();
      if (!daChonLocThuCong) datLocGioi(gioiDoiDien(me.gioi)); // mặc định tìm khác giới
    }
    apDungTrangCaNhan();
  }

  // Điều hướng trong tab Cá nhân: chỉ hiện đúng 1 "trang" (hub / form hồ sơ / trang con)
  function apDungTrangCaNhan() {
    var co = !!me;
    var ten = co ? trangCaNhanDangMo : "form";
    $("formHoSo").classList.toggle("an", ten !== "form");
    var hub = $("hubCaNhan");
    if (hub) hub.classList.toggle("an", ten !== "hub");
    var trs = document.querySelectorAll("#khuSauDangNhap .trangCon");
    for (var i = 0; i < trs.length; i++) {
      trs[i].classList.toggle("an", trs[i].id !== ten);
    }
  }

  function moTrangCaNhan(ten) {
    trangCaNhanDangMo = ten;
    apDungTrangCaNhan();
    if (ten === "trangTaiLieu") taiDaLuu();
    else if (ten === "trangViQR") taiViQR();
    else if (ten === "trangDuLieu") taiLuuTru();
    else if (ten === "trangHCloud") taiDamMay();
    else if (ten === "trangTaiKhoan") taiThongTinTaiKhoan();
    else if (ten === "trangRiengTu") { taiCaiDat(); taiDsChanCaNhan(); }
    else if (ten === "trangCaiDat" || ten.indexOf("trangCd") === 0 || ten === "trangGiaoDien" || ten === "trangHStyle") taiCaiDat();
  }

  function capNhatBongTrangThai() {
    var b = $("bongTrangThai");
    if (!b) return;
    b.textContent = trangThaiMe ? trangThaiMe : "Trạng thái...";
    b.classList.toggle("coTrangThai", !!trangThaiMe);
  }

  function luuTrangThaiSuKien() {
    var tt = $("inpTrangThai").value.replace(/\s+/g, " ").trim();
    if (!TQD_SERVER || !tokenMayChu) {
      trangThaiMe = tt;
      capNhatBongTrangThai();
      $("hopSuaTrangThai").classList.add("an");
      return;
    }
    goiAPI("/api/trang-thai", "POST", { trangThai: tt }, true).then(function (kq) {
      if (!kq.ok) { hienToast(kq.loi || "Chưa lưu được trạng thái."); return; }
      trangThaiMe = kq.trangThai || "";
      if (me) { me.trangThai = trangThaiMe; luuMe(); }
      capNhatBongTrangThai();
      $("hopSuaTrangThai").classList.add("an");
      hienToast("Đã cập nhật trạng thái ✨");
    });
  }

  function dienFormTuMe() {
    if (!me) return;
    $("inpNick").value = me.nick || "";
    $("inpTuoi").value = me.tuoi || "";
    var radios = document.querySelectorAll('input[name="gioiMe"]');
    for (var i = 0; i < radios.length; i++) radios[i].checked = radios[i].value === me.gioi;
    chonEmoji(me.emoji || EMOJI_AVATAR[0]);
  }

  function chonEmoji(e) {
    emojiChon = e;
    var btns = $("chonEmoji").querySelectorAll(".nutEmoji");
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle("dangChon", btns[i].getAttribute("data-emoji") === e);
    }
  }

  function dungChonEmoji() {
    var hop = $("chonEmoji");
    EMOJI_AVATAR.forEach(function (e) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "nutEmoji";
      b.textContent = e;
      b.setAttribute("data-emoji", e);
      b.addEventListener("click", function () { chonEmoji(e); });
      hop.appendChild(b);
    });
    chonEmoji(emojiChon);
  }

  function luuHoSoSuKien(ev) {
    ev.preventDefault();
    if (!sdtHienTai) return; // chưa đăng nhập thì không lưu được
    var nick = $("inpNick").value.trim();
    var tuoi = parseInt($("inpTuoi").value, 10);
    var g = document.querySelector('input[name="gioiMe"]:checked');
    var loi = "";
    if (!nick) loi = "Bạn chưa nhập nick.";
    else if (!g) loi = "Bạn chưa chọn giới tính.";
    else if (isNaN(tuoi) || tuoi < 18 || tuoi > 99) loi = "Tuổi cần từ 18 đến 99.";
    $("loiForm").textContent = loi;
    if (loi) return;
    me = {
      nick: nick,
      gioi: g.value,
      tuoi: tuoi,
      emoji: emojiChon,
      hienThi: $("chkHienThi").checked
    };
    luuMe(); // lưu vào tqd_users theo số điện thoại đang đăng nhập
    dongBoHoSoLenMayChu(); // chế độ máy chủ: đẩy hồ sơ lên máy chủ (demo thì hàm tự bỏ qua)
    trangCaNhanDangMo = "hub"; // V5.1: lưu xong quay về thẻ hub Cá nhân
    veKhuHoSo();
    hienToast("Đã lưu hồ sơ. Chúc bạn tìm được người hợp ý! 💞");
  }

  function dangXuat() {
    // V5.1: hủy phiên ở MÁY CHỦ trước khi xóa token ở máy (đăng xuất / chuyển tài khoản)
    if (TQD_SERVER && tokenMayChu) {
      goiAPI("/api/dang-xuat", "POST", {}, true); // không chờ kết quả — lỗi mạng cũng vẫn đăng xuất ở máy
    }
    try { sessionStorage.removeItem("tqd_da_mo_khoa"); } catch (e) {}
    trangCaNhanDangMo = "hub";
    var mk = $("manKhoaPin");
    if (mk) mk.classList.add("an");
    dungPollChat(); // V4: dừng tự làm mới chat
    // V5: dọn cuộc gọi + đóng kênh tín hiệu khi đăng xuất
    if (goiHT && goiHT.callId) guiTinHieu({ loaiTin: "ket-thuc", callId: goiHT.callId });
    ketThucGoiCucBo();
    goiDenCho = null;
    anHopGoiDen();
    dongTinHieu();
    chatVoi = null;
    chatSince = 0;
    sdtHienTai = null;
    me = null;
    tokenMayChu = null;
    luuToken();
    phienOTP = null;
    sdtDangCho = null;
    if (idDemNguoc) { clearInterval(idDemNguoc); idDemNguoc = null; }
    luuPhienDangNhap();
    $("inpSdt").value = "";
    $("loiSdt").textContent = "";
    capNhatManHinh();
    hienToast("Đã đăng xuất. Hẹn gặp lại bạn! 👋");
  }

  // --- Luồng OTP ---
  // Chống spam gửi mã ở phía client (đây chỉ là LỚP PHỤ): mỗi lần gửi phải chờ hết đếm ngược
  // 60 giây, và mốc gửi gần nhất được lưu vào localStorage để tải lại trang cũng không gửi
  // dồn ngay được. Lớp chống spam CHÍNH (giới hạn theo số điện thoại/IP/thiết bị, khóa tạm
  // khi gửi quá nhiều) phải nằm ở máy chủ trong bản máy chủ.
  function batDauPhienOTP(sdt) {
    var bayGio = Date.now();
    phienOTP = taoPhienOTP(sinhMaOTP(), bayGio);
    sdtDangCho = sdt;
    try { localStorage.setItem(KHOA_GUI_OTP, String(bayGio)); } catch (e) {}
    $("maDemoHien").textContent = phienOTP.ma;
    $("bannerMaDemo").classList.remove("an");
    $("sdtChoXacThuc").textContent = sdt;
    $("inpOTP").value = "";
    $("loiOTP").textContent = "";
    capNhatManHinh();
    chayDemNguocGuiLai();
    hienToast("Đã tạo mã OTP (demo) cho số " + sdt + " 📩");
  }

  // Chế độ máy chủ: vào màn hình nhập mã (mã đi qua SMS thật, không có banner demo)
  function batDauPhienOTPMayChu(sdt) {
    phienOTP = { guiLuc: Date.now() }; // chỉ cần mốc gửi để chạy đếm ngược gửi lại
    sdtDangCho = sdt;
    $("bannerMaDemo").classList.add("an");
    $("sdtChoXacThuc").textContent = sdt;
    $("inpOTP").value = "";
    $("loiOTP").textContent = "";
    capNhatManHinh();
    chayDemNguocGuiLai();
    hienToast("Đã gửi mã OTP qua SMS tới số " + sdt + " 📩");
  }

  function guiMaOTPMayChu(sdt) {
    goiAPI("/api/otp/request", "POST", { phone: sdt }, false).then(function (kq) {
      if (!kq.ok) { $("loiSdt").textContent = kq.loi || "Không gửi được mã. Thử lại sau nhé."; return; }
      batDauPhienOTPMayChu(sdt);
    });
  }

  function guiMaOTPSuKien() {
    var kt = kiemTraSoVN($("inpSdt").value);
    if (!kt.hople) { $("loiSdt").textContent = kt.lyDo; return; }
    $("loiSdt").textContent = "";
    if (TQD_SERVER) { guiMaOTPMayChu(kt.so); return; } // máy chủ tự chống spam theo số + IP
    var guiLucCuoi = 0;
    try { guiLucCuoi = parseInt(localStorage.getItem(KHOA_GUI_OTP) || "0", 10) || 0; } catch (e) {}
    var cho = giayChoGuiLai(guiLucCuoi, Date.now());
    if (cho > 0) {
      $("loiSdt").textContent = "Bạn vừa gửi mã rồi. Đợi " + cho + " giây nữa mới gửi lại được nhé.";
      return;
    }
    batDauPhienOTP(kt.so);
  }

  function chayDemNguocGuiLai() {
    if (idDemNguoc) clearInterval(idDemNguoc);
    var capNhat = function () {
      var cho = phienOTP ? giayChoGuiLai(phienOTP.guiLuc, Date.now()) : 0;
      var nut = $("btnGuiLai");
      if (cho > 0) {
        nut.disabled = true;
        nut.textContent = "Gửi lại mã (" + cho + "s)";
      } else {
        nut.disabled = false;
        nut.textContent = "Gửi lại mã";
        if (idDemNguoc) { clearInterval(idDemNguoc); idDemNguoc = null; }
      }
    };
    capNhat();
    idDemNguoc = setInterval(capNhat, 1000);
  }

  function guiLaiMaSuKien() {
    if (!sdtDangCho) return;
    var cho = phienOTP ? giayChoGuiLai(phienOTP.guiLuc, Date.now()) : 0;
    if (cho > 0) {
      $("loiOTP").textContent = "Đợi " + cho + " giây nữa mới gửi lại được nhé.";
      return;
    }
    if (TQD_SERVER) { // máy chủ cũng kiểm tra giãn cách — cứ gửi, lỗi sẽ hiện ở đây
      goiAPI("/api/otp/request", "POST", { phone: sdtDangCho }, false).then(function (kq) {
        if (!kq.ok) { $("loiOTP").textContent = kq.loi || "Không gửi lại được mã."; return; }
        batDauPhienOTPMayChu(sdtDangCho);
      });
      return;
    }
    batDauPhienOTP(sdtDangCho); // mã mới, phiên mới (hết khóa/hết hạn của phiên cũ)
    hienToast("Đã gửi mã mới (demo) 📩");
  }

  function doiSoSuKien() {
    phienOTP = null;
    sdtDangCho = null;
    if (idDemNguoc) { clearInterval(idDemNguoc); idDemNguoc = null; }
    capNhatManHinh();
  }

  // Chế độ máy chủ: xác thực mã qua API, nhận token phiên đăng nhập
  function xacNhanOTPMayChu() {
    goiAPI("/api/otp/verify", "POST", { phone: sdtDangCho, code: $("inpOTP").value }, false)
      .then(function (kq) {
        if (!kq.ok) { $("loiOTP").textContent = kq.loi || "Mã chưa đúng. Kiểm tra lại nhé."; return; }
        tokenMayChu = kq.token || null;
        luuToken();
        var sdt = sdtDangCho;
        phienOTP = null;
        sdtDangCho = null;
        if (idDemNguoc) { clearInterval(idDemNguoc); idDemNguoc = null; }
        sdtHienTai = sdt;
        luuPhienDangNhap();
        if (kq.hoSo) { // máy chủ trả hồ sơ của chính mình -> đồng bộ về máy để hiển thị
          var users = taiUsers();
          users[sdt] = kq.hoSo;
          luuUsers(users);
        }
        me = taiUsers()[sdt] || null;
        capNhatManHinh();
        ketNoiTinHieu(); // V5: nối kênh tín hiệu gọi ngay khi có token mới
        kiemTraKhoaPin(); // V5.1: nếu tài khoản bật khóa PIN thì khóa ngay khi vừa đăng nhập
        if (viTri && !viTri.macDinh) dongBoViTriLenMayChu();
        if (me) hienToast("Đăng nhập thành công. Xin chào, " + me.nick + "! 🎉");
        else hienToast("Xác thực số điện thoại xong! Tạo hồ sơ của bạn để bắt đầu nhé ✍️");
      });
  }

  function xacNhanOTPSuKien() {
    if (TQD_SERVER) { xacNhanOTPMayChu(); return; }
    var kq = kiemTraOTP(phienOTP, $("inpOTP").value, Date.now());
    if (!kq.ok) {
      var msg = "";
      if (kq.lyDo === "sai") msg = "Mã chưa đúng. Bạn còn " + kq.conLai + " lần nhập nữa.";
      else if (kq.lyDo === "khoa") msg = "Bạn đã nhập sai 5 lần nên mã này đã bị khóa. Bấm \"Gửi lại mã\" để lấy mã mới nhé.";
      else if (kq.lyDo === "hetHan") msg = "Mã đã hết hạn (mã chỉ dùng trong 5 phút). Bấm \"Gửi lại mã\" để lấy mã mới nhé.";
      else msg = "Chưa có mã nào được gửi. Quay lại nhập số điện thoại để nhận mã nhé.";
      $("loiOTP").textContent = msg;
      return;
    }
    // Đúng mã -> đăng nhập bằng số vừa xác thực
    var sdt = sdtDangCho;
    phienOTP = null;
    sdtDangCho = null;
    if (idDemNguoc) { clearInterval(idDemNguoc); idDemNguoc = null; }
    sdtHienTai = sdt;
    luuPhienDangNhap();
    var users = taiUsers();
    me = users[sdt] || null;
    capNhatManHinh();
    if (me) {
      hienToast("Đăng nhập thành công. Xin chào, " + me.nick + "! 🎉");
    } else {
      hienToast("Xác thực số điện thoại xong! Tạo hồ sơ của bạn để bắt đầu nhé ✍️");
    }
  }

  // --- Vị trí + tìm kiếm (giữ nguyên từ v1) ---
  function datViTri(lat, lng, macDinh, thongBao) {
    viTri = { lat: lat, lng: lng, macDinh: macDinh };
    hoSoCoViTri = taoViTriDemo(HO_SO_DEMO, lat, lng);
    var tt = $("trangThaiViTri");
    tt.textContent = thongBao;
    tt.classList.toggle("macDinh", !!macDinh);
    if (!macDinh) dongBoViTriLenMayChu(); // vị trí thật -> đẩy lên máy chủ (demo thì tự bỏ qua)
  }

  function damBaoViTri() {
    if (!viTri) {
      datViTri(VI_TRI_MAC_DINH.lat, VI_TRI_MAC_DINH.lng, true,
        "⚠️ Đang dùng vị trí mặc định khu vực Cát Hải để xem thử — bấm nút định vị để dùng vị trí thật.");
    }
  }

  function docBoLoc() {
    var tuoiTu = parseInt($("tuoiTu").value, 10);
    var tuoiDen = parseInt($("tuoiDen").value, 10);
    var kmTu = parseFloat($("kmTu").value);
    var kmDen = parseFloat($("kmDen").value);
    if (isNaN(tuoiTu)) tuoiTu = 18;
    if (isNaN(tuoiDen)) tuoiDen = 45;
    if (tuoiTu > tuoiDen) { var t = tuoiTu; tuoiTu = tuoiDen; tuoiDen = t; }
    if (isNaN(kmTu) || kmTu < 0) kmTu = 0;
    if (isNaN(kmDen) || kmDen < kmTu) kmDen = 20;
    return { gioi: locGioiChon, tuoiTu: tuoiTu, tuoiDen: tuoiDen, kmTu: kmTu, kmDen: kmDen };
  }

  function veKetQua(kq) {
    var hop = $("ketQua");
    hop.innerHTML = "";
    $("goiYTrong").classList.toggle("an", kq.length > 0);
    kq.forEach(function (p) {
      var the = document.createElement("div");
      the.className = "theNguoi";

      var av = document.createElement("span");
      av.className = "avatarLon";
      av.textContent = p.emoji;

      var giua = document.createElement("div");
      giua.className = "thongTinNguoi";
      var ten = document.createElement("p");
      ten.className = "tenNguoi";
      ten.textContent = p.ten;
      if (p.vip) { // V4.1: huy hiệu ⭐ cạnh nick của hồ sơ VIP
        var sao = document.createElement("span");
        sao.className = "huyHieuSao";
        sao.textContent = " ⭐";
        ten.appendChild(sao);
      }
      var ct = document.createElement("p");
      ct.className = "chiTietNguoi";
      ct.textContent = (p.gioi === "nu" ? "♀ Nữ" : "♂ Nam") + " · " + p.tuoi + " tuổi";
      giua.appendChild(ten);
      giua.appendChild(ct);

      var phai = document.createElement("div");
      phai.className = "cotPhai";
      var huy = document.createElement("span");
      huy.className = "huyHieuKm";
      huy.textContent = "📍 " + dinhDangKhoangCach(p.khoangCach);
      var nut = document.createElement("button");
      nut.type = "button";
      nut.className = "nutChao";
      nut.textContent = "👋 Gửi lời chào";
      nut.addEventListener("click", function () {
        hienToast("Tính năng nhắn tin sẽ có ở bản máy chủ 💌");
      });
      phai.appendChild(huy);
      phai.appendChild(nut);

      the.appendChild(av);
      the.appendChild(giua);
      the.appendChild(phai);
      hop.appendChild(the);
    });
  }

  function chayTim() {
    damBaoViTri();
    if (TQD_SERVER && tokenMayChu) { // chế độ máy chủ + đã đăng nhập -> người dùng thật
      var loc = docBoLoc();
      var qs = "?lat=" + encodeURIComponent(viTri.lat) + "&lng=" + encodeURIComponent(viTri.lng) +
        "&gioi=" + encodeURIComponent(loc.gioi) +
        "&tuoiTu=" + loc.tuoiTu + "&tuoiDen=" + loc.tuoiDen +
        "&kmTu=" + loc.kmTu + "&kmDen=" + loc.kmDen;
      goiAPI("/api/nearby" + qs, "GET", null, true).then(function (kq) {
        if (!kq.ok) { hienToast(kq.loi || "Không lấy được danh sách từ máy chủ."); veKetQua([]); return; }
        var ds = (kq.ketQua || []).map(function (p) {
          return {
            ten: p.ten || p.nick, gioi: p.gioi || p.gioiTinh,
            tuoi: p.tuoi, emoji: p.emoji, khoangCach: p.khoangCach,
            vip: p.vip === true // V4.1
          };
        });
        // V4.1: hết lượt xem miễn phí trong ngày -> hiện banner mời nâng VIP
        $("bannerHetLuot").classList.toggle("an", !kq.hetLuot);
        veKetQua(ds);
      });
      return;
    }
    veKetQua(locHoSo(hoSoCoViTri, viTri, docBoLoc()));
  }

  function batDinhVi() {
    var tt = $("trangThaiViTri");
    if (!navigator.geolocation) {
      datViTri(VI_TRI_MAC_DINH.lat, VI_TRI_MAC_DINH.lng, true,
        "⚠️ Máy/trình duyệt của bạn không hỗ trợ định vị — đang dùng vị trí mặc định khu vực Cát Hải để xem thử.");
      chayTim();
      return;
    }
    tt.textContent = "⏳ Đang lấy vị trí của bạn…";
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        datViTri(pos.coords.latitude, pos.coords.longitude, false,
          "✅ Đã dùng vị trí thật của bạn để tìm quanh đây.");
        chayTim();
      },
      function () {
        datViTri(VI_TRI_MAC_DINH.lat, VI_TRI_MAC_DINH.lng, true,
          "⚠️ Bạn chưa cấp quyền vị trí (hoặc máy không lấy được) — đang dùng vị trí mặc định khu vực Cát Hải để xem thử.");
        chayTim();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  // ======================================================================
  // ===== V4: KHUNG 5 TAB + TẦNG XÃ HỘI (chỉ bật khi TQD_SERVER có URL) =====
  // ======================================================================
  var CAC_TAB = ["tinnhan", "danhba", "khampha", "tuongnha", "canhan"];
  var ID_TAB = {
    tinnhan: "tabTinNhan", danhba: "tabDanhBa", khampha: "tabKhamPha",
    tuongnha: "tabTuongNha", canhan: "tabCaNhan"
  };
  var tabDangChon = "khampha";       // tab mặc định: Khám phá
  var chatVoi = null;                // { sdt, nick, emoji } đang trò chuyện
  var chatSince = 0;                 // mốc tg tin nhắn mới nhất đã hiện trong màn chat
  var idPollChat = null;             // interval tự làm mới chat mỗi 3 giây
  var daNapDuLieuXaHoi = false;      // đã tải cài đặt + danh sách chặn cho lần đăng nhập này chưa

  function dungPollChat() {
    if (idPollChat) { clearInterval(idPollChat); idPollChat = null; }
  }

  // Quyết định hiện/ẩn thanh tab + từng tab theo chế độ (demo / máy chủ) và trạng thái đăng nhập
  function capNhatKhungTab() {
    var mayChu = !!TQD_SERVER;
    var dangNhap = !!sdtHienTai;
    var hienThanhTab = mayChu && dangNhap;
    $("thanhTab").classList.toggle("an", !hienThanhTab);
    $("khungChinh").classList.toggle("coTab", hienThanhTab);
    CAC_TAB.forEach(function (ten) {
      var el = $(ID_TAB[ten]);
      if (!el) return;
      var hien;
      if (!mayChu) hien = (ten === "canhan" || ten === "khampha"); // demo: xếp chồng như v3
      else if (!dangNhap) hien = (ten === "canhan");               // chưa đăng nhập: chỉ màn tài khoản/OTP
      else hien = (ten === tabDangChon);
      el.classList.toggle("an", !hien);
    });
    var btns = $("thanhTab").querySelectorAll(".tabBtn");
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle("dangChon", hienThanhTab && btns[i].getAttribute("data-tab") === tabDangChon);
    }
    if (!hienThanhTab || tabDangChon !== "tinnhan") dungPollChat();
    if (hienThanhTab && !daNapDuLieuXaHoi) {
      daNapDuLieuXaHoi = true;
      taiCaiDat();
      taiDsChanCaNhan();
      taiTrangThaiVip(); // V4.1
      taiGoiVip();       // V4.1
    }
    if (!dangNhap) daNapDuLieuXaHoi = false;
  }

  function chonTab(ten) {
    tabDangChon = ten;
    if (ten !== "tinnhan") dongManChat(false);
    capNhatKhungTab();
    window.scrollTo(0, 0);
    if (!TQD_SERVER || !sdtHienTai) return;
    if (ten === "tinnhan" && !chatVoi) taiDsTroChuyen();
    if (ten === "danhba") { taiLoiMoi(); taiBanBe(); }
    if (ten === "tuongnha") taiBaiDang();
    if (ten === "canhan") { taiCaiDat(); taiDsChanCaNhan(); taiTrangThaiVip(); }
  }

  function dinhDangGio(tg) {
    var d = new Date(tg);
    var hh = String(d.getHours()); if (hh.length < 2) hh = "0" + hh;
    var mm = String(d.getMinutes()); if (mm.length < 2) mm = "0" + mm;
    return hh + ":" + mm + " · " + d.getDate() + "/" + (d.getMonth() + 1);
  }

  // Tạo một thẻ người (dùng chung cho kết quả tìm SĐT, lời mời, bạn bè, trò chuyện)
  function taoTheNguoi(emoji, nick, chiTiet, nutPhai) {
    var the = document.createElement("div");
    the.className = "theNguoi";
    var av = document.createElement("span");
    av.className = "avatarLon";
    av.textContent = emoji || "😀";
    var giua = document.createElement("div");
    giua.className = "thongTinNguoi";
    var ten = document.createElement("p");
    ten.className = "tenNguoi";
    ten.textContent = nick || "";
    var ct = document.createElement("p");
    ct.className = "chiTietNguoi";
    ct.textContent = chiTiet || "";
    giua.appendChild(ten);
    giua.appendChild(ct);
    the.appendChild(av);
    the.appendChild(giua);
    if (nutPhai) {
      var phai = document.createElement("div");
      phai.className = "cotPhai";
      phai.appendChild(nutPhai);
      the.appendChild(phai);
    }
    return the;
  }

  function taoNutNhan(nhan, lop, onClick, voHieu) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = lop;
    b.textContent = nhan;
    if (voHieu) b.disabled = true;
    else b.addEventListener("click", onClick);
    return b;
  }

  // ---------- Danh bạ: tìm bằng SĐT, lời mời, bạn bè ----------
  function timBangSdtSuKien() {
    var kt = kiemTraSoVN($("inpTimSdt").value);
    $("ketQuaTimSdt").innerHTML = "";
    if (!kt.hople) { $("loiTimSdt").textContent = kt.lyDo; return; }
    $("loiTimSdt").textContent = "";
    napKetQuaTimSdt(kt.so);
  }

  function napKetQuaTimSdt(sdt) {
    goiAPI("/api/tim-sdt?sdt=" + encodeURIComponent(sdt), "GET", null, true).then(function (kq) {
      var hop = $("ketQuaTimSdt");
      hop.innerHTML = "";
      if (!kq.ok) { $("loiTimSdt").textContent = kq.loi || "Tìm không được. Thử lại nhé."; return; }
      if (!kq.timThay) {
        var p = document.createElement("p");
        p.className = "goiY";
        p.textContent = "Không tìm thấy người dùng với số này. Có thể họ chưa cài app này, hoặc đã tắt cho phép tìm bằng số điện thoại.";
        hop.appendChild(p);
        return;
      }
      var nut;
      if (kq.quanHe === "ban") {
        nut = taoNutNhan("💬 Nhắn tin", "nutChinh nho", function () { moChat(sdt, kq.nick, kq.emoji); });
      } else if (kq.quanHe === "da-gui") {
        nut = taoNutNhan("Đã gửi lời mời", "nutPhu nho", null, true);
      } else if (kq.quanHe === "cho-duy") {
        nut = taoNutNhan("✔ Chấp nhận", "nutChinh nho", function () {
          goiAPI("/api/ketban/tra-loi", "POST", { sdt: sdt, chapNhan: true }, true).then(function (kq2) {
            if (!kq2.ok) { hienToast(kq2.loi || "Chưa chấp nhận được."); return; }
            hienToast("Đã thành bạn bè với " + kq.nick + " 🎉");
            napKetQuaTimSdt(sdt);
            taiBanBe();
          });
        });
      } else {
        nut = taoNutNhan("➕ Kết bạn", "nutChinh nho", function () {
          goiAPI("/api/ketban/gui", "POST", { sdt: sdt }, true).then(function (kq2) {
            if (!kq2.ok) { hienToast(kq2.loi || "Chưa gửi được lời mời."); return; }
            hienToast("Đã gửi lời mời kết bạn tới " + kq.nick + " 📩");
            napKetQuaTimSdt(sdt);
          });
        });
      }
      hop.appendChild(taoTheNguoi(kq.emoji, kq.nick,
        (kq.gioiTinh === "nu" ? "♀ Nữ" : "♂ Nam") + " · " + kq.tuoi + " tuổi", nut));
    });
  }

  function taiLoiMoi() {
    if (!TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/ketban/loi-moi", "GET", null, true).then(function (kq) {
      var hop = $("dsLoiMoi");
      hop.innerHTML = "";
      if (!kq.ok) return;
      var ds = kq.loiMoi || [];
      $("trongLoiMoi").classList.toggle("an", ds.length > 0);
      ds.forEach(function (m) {
        var cot = document.createElement("div");
        cot.className = "hangHaiNut";
        cot.appendChild(taoNutNhan("✔ Chấp nhận", "nutChinh nho", function () {
          traLoiKetBan(m.sdt, true);
        }));
        cot.appendChild(taoNutNhan("✖ Từ chối", "nutPhu nho", function () {
          traLoiKetBan(m.sdt, false);
        }));
        hop.appendChild(taoTheNguoi(m.emoji, m.nick,
          (m.gioiTinh === "nu" ? "♀ Nữ" : "♂ Nam") + " · " + m.tuoi + " tuổi", cot));
      });
    });
  }

  function traLoiKetBan(sdt, chapNhan) {
    goiAPI("/api/ketban/tra-loi", "POST", { sdt: sdt, chapNhan: chapNhan }, true).then(function (kq) {
      if (!kq.ok) { hienToast(kq.loi || "Chưa xử lý được lời mời."); return; }
      hienToast(chapNhan ? "Đã chấp nhận kết bạn 🎉" : "Đã từ chối lời mời.");
      taiLoiMoi();
      taiBanBe();
    });
  }

  function taiBanBe() {
    if (!TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/ban-be", "GET", null, true).then(function (kq) {
      var hop = $("dsBanBe");
      hop.innerHTML = "";
      if (!kq.ok) return;
      var ds = kq.banBe || [];
      $("trongBanBe").classList.toggle("an", ds.length > 0);
      ds.forEach(function (b) {
        var huy = null;
        if (b.coViTriMoi) {
          huy = document.createElement("span");
          huy.className = "huyHieuKm";
          huy.textContent = "📍 Đang quanh đây";
        }
        var the = taoTheNguoi(b.emoji, b.nick,
          (b.gioiTinh === "nu" ? "♀ Nữ" : "♂ Nam") + " · " + b.tuoi + " tuổi · 📱 " + b.sdt, huy);
        the.classList.add("bamDuoc");
        the.addEventListener("click", function () { moChat(b.sdt, b.nick, b.emoji); });
        hop.appendChild(the);
      });
    });
  }

  // ---------- Tin nhắn / chat ----------
  function taiDsTroChuyen() {
    if (!TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/tin-nhan/danh-sach", "GET", null, true).then(function (kq) {
      var hop = $("dsTroChuyen");
      hop.innerHTML = "";
      if (!kq.ok) {
        $("trongTroChuyen").textContent = kq.loi || "Không tải được danh sách trò chuyện.";
        $("trongTroChuyen").classList.remove("an");
        return;
      }
      var ds = kq.troChuyen || [];
      $("trongTroChuyen").textContent = "Chưa có cuộc trò chuyện nào. Vào Danh bạ, chọn một người bạn để nhắn tin nhé.";
      $("trongTroChuyen").classList.toggle("an", ds.length > 0);
      ds.forEach(function (c) {
        var phai = document.createElement("div");
        phai.className = "cotPhai";
        var gio = document.createElement("span");
        gio.className = "gioNho";
        gio.textContent = dinhDangGio(c.tinCuoi.tg);
        phai.appendChild(gio);
        if (c.chuaDoc > 0) {
          var cham = document.createElement("span");
          cham.className = "chamChuaDoc";
          cham.textContent = c.chuaDoc;
          phai.appendChild(cham);
        }
        var xemTruoc = (c.tinCuoi.cuaToi ? "Bạn: " : "") + c.tinCuoi.noiDung;
        var the = taoTheNguoi(c.emoji, c.nick, xemTruoc, phai);
        the.classList.add("bamDuoc");
        the.addEventListener("click", function () { moChat(c.sdt, c.nick, c.emoji); });
        hop.appendChild(the);
      });
    });
  }

  function moChat(sdt, nick, emoji) {
    chatVoi = { sdt: sdt, nick: nick || "", emoji: emoji || "😀" };
    chatSince = 0;
    tabDangChon = "tinnhan";
    capNhatKhungTab();
    $("khuDsTroChuyen").classList.add("an");
    $("manChat").classList.remove("an");
    $("avatarChat").textContent = chatVoi.emoji;
    $("tenChat").textContent = chatVoi.nick || chatVoi.sdt;
    $("sdtChat").textContent = "📱 " + chatVoi.sdt;
    $("hopTinNhan").innerHTML = "";
    $("loiChat").textContent = "";
    $("inpTinNhan").value = "";
    taiTinNhanMoi();
    dungPollChat();
    idPollChat = setInterval(taiTinNhanMoi, 3000);
    window.scrollTo(0, 0);
  }

  function dongManChat(napLaiDs) {
    dungPollChat();
    chatVoi = null;
    chatSince = 0;
    var mc = $("manChat");
    if (mc) mc.classList.add("an");
    var ds = $("khuDsTroChuyen");
    if (ds) ds.classList.remove("an");
    if (napLaiDs) taiDsTroChuyen();
  }

  function taiTinNhanMoi() {
    if (!chatVoi || !tokenMayChu) return;
    var dich = chatVoi.sdt;
    goiAPI("/api/tin-nhan?sdt=" + encodeURIComponent(dich) + "&since=" + chatSince, "GET", null, true)
      .then(function (kq) {
        if (!kq.ok || !chatVoi || chatVoi.sdt !== dich) return;
        (kq.tinNhan || []).forEach(function (t) {
          themBongBong(t);
          if (t.tg > chatSince) chatSince = t.tg;
        });
      });
  }

  function themBongBong(t) {
    var hop = $("hopTinNhan");
    var dong = document.createElement("div");
    dong.className = "dongTin " + (t.cuaToi ? "cuaToi" : "cuaHo");
    var bong = document.createElement("div");
    bong.className = "bongBong";
    var kieu = t.kieu || "van-ban";
    if (kieu === "anh" && t.tepId) {
      // V5: tin ảnh — bấm vào mở ảnh lớn
      var img = document.createElement("img");
      img.className = "anhTrongChat";
      img.src = duongDanTep(t.tepId);
      img.alt = t.tenTep || "Ảnh";
      img.addEventListener("click", function () { window.open(duongDanTep(t.tepId), "_blank"); });
      bong.appendChild(img);
    } else if (kieu === "thoai" && t.tepId) {
      // V5: tin nhắn thoại — phát bằng thẻ audio ngay trong bong bóng
      var au = document.createElement("audio");
      au.className = "amTrongChat";
      au.controls = true;
      au.preload = "metadata";
      au.src = duongDanTep(t.tepId);
      bong.appendChild(au);
      if (t.thoiLuong) {
        var mt = document.createElement("span");
        mt.className = "metaTep";
        mt.textContent = "🎤 Tin nhắn thoại • " + dinhDangThoiLuong(t.thoiLuong);
        bong.appendChild(mt);
      }
    } else if (kieu === "tep" && t.tepId && (t.mimeTep || "").indexOf("video/") === 0) {
      // V5: tệp video (mp4/webm...) — phát ngay trong bong bóng bằng thẻ video
      var vd = document.createElement("video");
      vd.className = "videoTrongChat";
      vd.controls = true;
      vd.preload = "metadata";
      vd.src = duongDanTep(t.tepId);
      bong.appendChild(vd);
      var mtv = document.createElement("span");
      mtv.className = "metaTep";
      mtv.textContent = "🎬 " + (t.tenTep || "Video") + " • " + dinhDangKichThuoc(t.kichThuocTep);
      bong.appendChild(mtv);
    } else if (kieu === "tep" && t.tepId) {
      // V5: tệp đính kèm — bấm để tải về
      var a = document.createElement("a");
      a.className = "tepTrongChat";
      a.href = duongDanTep(t.tepId);
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "📎 " + (t.tenTep || "Tệp đính kèm");
      bong.appendChild(a);
      var mt2 = document.createElement("span");
      mt2.className = "metaTep";
      mt2.textContent = dinhDangKichThuoc(t.kichThuocTep) + " — chạm để tải về";
      bong.appendChild(mt2);
    } else if (t.tepDaXoa || (kieu !== "van-ban" && !t.tepId)) {
      // V5.1: tin media mà tệp đã bị người gửi xóa khỏi máy chủ
      var spXoa = document.createElement("span");
      spXoa.className = "metaTep";
      spXoa.textContent = "🗑️ Tệp đã bị xóa khỏi máy chủ";
      bong.appendChild(spXoa);
    } else {
      bong.textContent = t.noiDung;
    }
    var gio = document.createElement("div");
    gio.className = "gioTin";
    gio.textContent = dinhDangGio(t.tg);
    bong.appendChild(gio);
    dong.appendChild(bong);
    // V5.1: nút Lưu dưới mỗi tin -> cất snapshot vào "Tài liệu của tôi"
    if (TQD_SERVER && tokenMayChu) {
      var nutLuu = document.createElement("button");
      nutLuu.type = "button";
      nutLuu.className = "nutLuuTin";
      nutLuu.textContent = "💾 Lưu";
      nutLuu.title = "Lưu vào Tài liệu của tôi";
      nutLuu.addEventListener("click", function () { luuTinNhanVaoTaiLieu(t); });
      dong.appendChild(nutLuu);
    }
    hop.appendChild(dong);
    hop.scrollTop = hop.scrollHeight;
  }

  function guiTinSuKien() {
    if (!chatVoi) return;
    var noiDung = $("inpTinNhan").value.trim();
    if (!noiDung) return;
    var dich = chatVoi;
    goiAPI("/api/tin-nhan", "POST", { sdt: dich.sdt, noiDung: noiDung }, true).then(function (kq) {
      if (!kq.ok) {
        // Gửi bị từ chối (ví dụ bị chặn): hiện ĐÚNG câu lỗi từ máy chủ
        $("loiChat").textContent = kq.loi || "Không gửi được tin nhắn.";
        return;
      }
      $("loiChat").textContent = "";
      $("inpTinNhan").value = "";
      if (chatVoi && chatVoi.sdt === dich.sdt && kq.tin) {
        themBongBong(kq.tin);
        if (kq.tin.tg > chatSince) chatSince = kq.tin.tg;
      }
    });
  }

  function chanTrongChatSuKien() {
    if (!chatVoi) return;
    var dich = chatVoi;
    var ten = dich.nick || dich.sdt;
    if (!window.confirm("Chặn " + ten + "?\n\nNgười này sẽ không nhắn tin cho bạn được nữa, và hai bạn sẽ không còn là bạn bè.")) return;
    goiAPI("/api/chan", "POST", { sdt: dich.sdt }, true).then(function (kq) {
      if (!kq.ok) { hienToast(kq.loi || "Chưa chặn được."); return; }
      hienToast("Đã chặn " + ten + " 🚫");
      dongManChat(true);
    });
  }

  // ================= V5: MEDIA TRONG CHAT (ảnh / tệp / ghi âm) =================
  // Tệp tải qua POST /api/tin-nhan/upload (body thô); tải xuống qua
  // GET /api/tep/<id>?token= (thẻ img/audio không gắn được header).

  function duongDanTep(tepId) {
    return TQD_SERVER + "/api/tep/" + encodeURIComponent(tepId) + "?token=" + encodeURIComponent(tokenMayChu || "");
  }

  function dinhDangKichThuoc(b) {
    b = Number(b) || 0;
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return (b / 1024).toFixed(1).replace(".", ",") + " KB";
    return (b / (1024 * 1024)).toFixed(2).replace(".", ",") + " MB";
  }

  function dinhDangThoiLuong(giay) {
    giay = Math.max(0, Math.round(Number(giay) || 0));
    var p = Math.floor(giay / 60), g = giay % 60;
    return (p < 10 ? "0" : "") + p + ":" + (g < 10 ? "0" : "") + g;
  }

  // Tải lên dùng XMLHttpRequest (fetch không có sự kiện tiến trình tải lên).
  // Tệp được phép tới 200 MB nên phải có thanh tiến trình + nút hủy +
  // báo lỗi rõ ràng khi đứt kết nối giữa chừng (không lỗi im lặng).
  var xhrTaiLen = null;
  function hienThanhTaiLen(phanTram, nhan) {
    var hop = $("hopTaiLen");
    if (!hop) return;
    hop.classList.remove("an");
    $("thanhTienTrinh").style.width = Math.max(0, Math.min(100, phanTram)) + "%";
    $("nhanTaiLen").textContent = nhan || ("Đang tải lên… " + phanTram + "%");
  }
  function anThanhTaiLen() {
    xhrTaiLen = null;
    var hop = $("hopTaiLen");
    if (hop) hop.classList.add("an");
    var thanh = $("thanhTienTrinh");
    if (thanh) thanh.style.width = "0%";
  }
  function huyTaiLenDangChay() { if (xhrTaiLen) { try { xhrTaiLen.abort(); } catch (e) {} } }

  function taiTepLen(blob, loai, tenGoc, thoiLuong) {
    if (!chatVoi || !tokenMayChu) return;
    if (xhrTaiLen) { $("loiChat").textContent = "Đang có một tệp tải lên — chờ xong hoặc bấm ✕ để hủy trước đã."; return; }
    var dich = chatVoi;
    $("loiChat").textContent = "";
    var xhr = new XMLHttpRequest();
    xhrTaiLen = xhr;
    xhr.open("POST", TQD_SERVER + "/api/tin-nhan/upload", true);
    xhr.setRequestHeader("Authorization", "Bearer " + tokenMayChu);
    xhr.setRequestHeader("Content-Type", (blob && blob.type) || "application/octet-stream");
    xhr.setRequestHeader("X-Den-SDT", dich.sdt);
    xhr.setRequestHeader("X-Loai-Tep", loai);
    xhr.setRequestHeader("X-Ten-Tep", encodeURIComponent(tenGoc || ""));
    xhr.setRequestHeader("X-Thoi-Luong", String(thoiLuong || 0));
    xhr.upload.onprogress = function (e) {
      if (e.lengthComputable && e.total > 0) hienThanhTaiLen(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = function () {
      anThanhTaiLen();
      var kq = null;
      try { kq = JSON.parse(xhr.responseText || ""); } catch (e) {}
      if (!kq || !kq.ok) { $("loiChat").textContent = (kq && kq.loi) || "Không gửi được tệp."; return; }
      if (chatVoi && chatVoi.sdt === dich.sdt && kq.tin) {
        themBongBong(kq.tin);
        if (kq.tin.tg > chatSince) chatSince = kq.tin.tg;
      }
    };
    xhr.onerror = function () {
      anThanhTaiLen();
      $("loiChat").textContent = "Tải lên thất bại — kết nối bị ngắt giữa chừng, tệp chưa được gửi. Kiểm tra mạng rồi thử lại nhé.";
    };
    xhr.onabort = function () {
      anThanhTaiLen();
      $("loiChat").textContent = "Đã hủy tải lên.";
    };
    hienThanhTaiLen(0);
    try { xhr.send(blob); }
    catch (e) { anThanhTaiLen(); $("loiChat").textContent = "Không bắt đầu được việc tải tệp lên."; }
  }

  // Ảnh: nén phía client xuống tối đa 1600px, JPEG chất lượng 0.85 rồi mới tải lên
  function guiAnhTuFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type || "")) { $("loiChat").textContent = "Tệp bạn chọn không phải là ảnh."; return; }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      try {
        var MAX = 1600;
        var tiLe = Math.min(1, MAX / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        var w = Math.max(1, Math.round((img.naturalWidth || 1) * tiLe));
        var h = Math.max(1, Math.round((img.naturalHeight || 1) * tiLe));
        var cv = document.createElement("canvas");
        cv.width = w; cv.height = h;
        cv.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        if (cv.toBlob) {
          cv.toBlob(function (blob) {
            if (blob) taiTepLen(blob, "anh", "anh.jpg", 0);
            else $("loiChat").textContent = "Không nén được ảnh này.";
          }, "image/jpeg", 0.85);
        } else {
          $("loiChat").textContent = "Trình duyệt không hỗ trợ nén ảnh.";
        }
      } catch (e) {
        URL.revokeObjectURL(url);
        $("loiChat").textContent = "Không đọc được ảnh này.";
      }
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      $("loiChat").textContent = "Không đọc được ảnh này.";
    };
    img.src = url;
  }

  function guiTepTuFile(file) {
    if (!file) return;
    // Giới hạn 200 MB/tệp (chủ dự án chốt 19:18 30/10 — video và tệp nặng
    // dưới 200 MB đều gửi được); quá giới hạn thì báo rõ ngay tại máy khách.
    if (file.size > 200 * 1024 * 1024) {
      $("loiChat").textContent = "File quá lớn — chỉ gửi được file dưới 200MB (tệp \"" + file.name +
        "\" nặng " + dinhDangKichThuoc(file.size) + ").";
      return;
    }
    taiTepLen(file, "tep", file.name, 0);
  }

  // --- Ghi âm tin nhắn thoại (MediaRecorder): ghi -> nghe thử -> gửi ---
  var mayGhiAm = null, luongGhiAm = null, manhAm = [], amDaGhi = null;
  var giayDaGhi = 0, demGhiAm = null, batDauGhiLuc = 0;

  function dungDemGhiAm() {
    if (demGhiAm) { clearInterval(demGhiAm); demGhiAm = null; }
    var nut = $("btnGhiAm");
    if (nut) { nut.classList.remove("dangGhi"); nut.textContent = "🎤"; nut.title = "Ghi âm tin nhắn thoại"; }
  }

  function batTatGhiAm() {
    if (mayGhiAm && mayGhiAm.state === "recording") { mayGhiAm.stop(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === "undefined") {
      $("loiChat").textContent = "Trình duyệt này không hỗ trợ ghi âm.";
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      luongGhiAm = stream;
      manhAm = [];
      var tuyChon = {};
      if (typeof MediaRecorder.isTypeSupported === "function") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) tuyChon = { mimeType: "audio/webm;codecs=opus" };
        else if (MediaRecorder.isTypeSupported("audio/mp4")) tuyChon = { mimeType: "audio/mp4" };
      }
      try { mayGhiAm = new MediaRecorder(stream, tuyChon); }
      catch (e) { mayGhiAm = new MediaRecorder(stream); }
      mayGhiAm.ondataavailable = function (ev) { if (ev.data && ev.data.size) manhAm.push(ev.data); };
      mayGhiAm.onstop = function () {
        giayDaGhi = Math.max(1, Math.round((Date.now() - batDauGhiLuc) / 1000));
        amDaGhi = new Blob(manhAm, { type: mayGhiAm.mimeType || "audio/webm" });
        if (luongGhiAm) { luongGhiAm.getTracks().forEach(function (tr) { tr.stop(); }); luongGhiAm = null; }
        dungDemGhiAm();
        $("nhanGhiAm").textContent = "🎤 Tin nhắn thoại (" + dinhDangThoiLuong(giayDaGhi) + ") — nghe thử rồi bấm Gửi:";
        $("audioXemTruoc").src = URL.createObjectURL(amDaGhi);
        $("hopGhiAm").classList.remove("an");
      };
      batDauGhiLuc = Date.now();
      mayGhiAm.start();
      $("hopGhiAm").classList.add("an");
      $("loiChat").textContent = "";
      var nut = $("btnGhiAm");
      nut.classList.add("dangGhi");
      nut.textContent = "⏹";
      demGhiAm = setInterval(function () {
        var s = Math.round((Date.now() - batDauGhiLuc) / 1000);
        nut.title = "Đang ghi… " + dinhDangThoiLuong(s) + " — bấm ⏹ để dừng";
      }, 500);
    }, function (e) {
      $("loiChat").textContent = loiQuyenMedia(e, "thoai");
    });
  }

  function guiAmDaGhi() {
    if (!amDaGhi) return;
    var blob = amDaGhi, giay = giayDaGhi;
    huyAmDaGhi();
    taiTepLen(blob, "thoai", "tin-nhan-thoai", giay);
  }

  function huyAmDaGhi() {
    amDaGhi = null;
    giayDaGhi = 0;
    var au = $("audioXemTruoc");
    if (au) { au.removeAttribute("src"); try { au.load(); } catch (e) {} }
    $("hopGhiAm").classList.add("an");
  }

  // ================= V5: GỌI THOẠI / VIDEO 1-1 (WebRTC) =================
  // Tín hiệu qua WebSocket /goi?token=<token phiên>; media chạy thẳng
  // giữa hai trình duyệt. Máy chủ quyết định quyền gọi (bạn bè, hoặc
  // người nhận bật "cho người lạ gọi") và trạng thái bận/ngoại tuyến.
  var wsGoi = null, wsDangKetNoi = false;
  var pcGoi = null, luongLocalGoi = null;
  var goiHT = null;      // cuộc gọi hiện tại { callId, sdt, nick, emoji, cheDo, vaiTro, daKetNoi }
  var goiDenCho = null;  // cuộc gọi đến đang chờ xử lý (kèm offer)
  var iceChoGui = [], iceChoNhan = [];
  var demGioGoi = null, giayDangGoi = 0;
  var amChuong = null, demChuong = null;

  function hoTroGoi() {
    return !!(window.RTCPeerConnection && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function loiQuyenMedia(e, cheDo) {
    var can = cheDo === "video" ? "camera và micro" : "micro";
    if (!e) return "Không mở được " + can + ".";
    if (e.name === "NotAllowedError" || e.name === "SecurityError") {
      return "Bạn chưa cho phép dùng " + can + " — hãy bấm Cho phép trong trình duyệt rồi thử lại nhé.";
    }
    if (e.name === "NotFoundError" || e.name === "OverconstrainedError") {
      return "Không tìm thấy " + can + " trên thiết bị này.";
    }
    if (e.name === "NotReadableError") return "Thiết bị " + can + " đang bận bởi ứng dụng khác.";
    return "Không mở được " + can + ".";
  }

  function ketNoiTinHieu() {
    if (!TQD_SERVER || !tokenMayChu) return;
    if (wsGoi && (wsGoi.readyState === 0 || wsGoi.readyState === 1)) return;
    if (wsDangKetNoi) return;
    wsDangKetNoi = true;
    var ws;
    try {
      var goc = TQD_SERVER.replace(/^http:/i, "ws:").replace(/^https:/i, "wss:");
      ws = new WebSocket(goc + "/goi?token=" + encodeURIComponent(tokenMayChu));
    } catch (e) { wsDangKetNoi = false; return; }
    wsGoi = ws;
    ws.onopen = function () { wsDangKetNoi = false; };
    ws.onmessage = function (ev) {
      var msg = null;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg) xuLyTinHieu(msg);
    };
    ws.onclose = function () {
      wsDangKetNoi = false;
      if (wsGoi === ws) wsGoi = null;
      if (tokenMayChu) setTimeout(ketNoiTinHieu, 4000); // còn đăng nhập thì tự nối lại
    };
    ws.onerror = function () { try { ws.close(); } catch (e) {} };
  }

  function dongTinHieu() {
    if (wsGoi) { try { wsGoi.close(); } catch (e) {} wsGoi = null; }
  }

  function guiTinHieu(obj) {
    if (wsGoi && wsGoi.readyState === 1) { wsGoi.send(JSON.stringify(obj)); return true; }
    return false;
  }

  function taoPC() {
    var pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pc.onicecandidate = function (ev) {
      if (!ev.candidate) return;
      if (goiHT && goiHT.callId) {
        guiTinHieu({ loaiTin: "ice", callId: goiHT.callId, candidate: ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate });
      } else {
        iceChoGui.push(ev.candidate); // chưa có callId (máy chủ chưa trả) -> chờ gửi sau
      }
    };
    pc.ontrack = function (ev) {
      if (ev.streams && ev.streams[0]) $("videoXa").srcObject = ev.streams[0];
    };
    pc.onconnectionstatechange = function () {
      if (pcGoi !== pc) return;
      if (pc.connectionState === "connected") {
        if (goiHT) goiHT.daKetNoi = true;
        datTrangThaiGoi("Đang gọi");
        batDauDemGioGoi();
      } else if (pc.connectionState === "failed") {
        hienToast("Kết nối cuộc gọi thất bại.");
        ketThucGoiCucBo();
      } else if (pc.connectionState === "disconnected") {
        datTrangThaiGoi("Kết nối yếu…");
      }
    };
    return pc;
  }

  function dayIceChoGui() {
    if (!goiHT || !goiHT.callId) return;
    while (iceChoGui.length) {
      var c = iceChoGui.shift();
      guiTinHieu({ loaiTin: "ice", callId: goiHT.callId, candidate: c.toJSON ? c.toJSON() : c });
    }
  }

  function napIceChoNhan() {
    if (!pcGoi || !pcGoi.remoteDescription) return;
    while (iceChoNhan.length) {
      var c = iceChoNhan.shift();
      try { pcGoi.addIceCandidate(new RTCIceCandidate(c)); } catch (e) {}
    }
  }

  function datTrangThaiGoi(chu) {
    var el = $("trangThaiGoi");
    if (el) el.textContent = chu;
  }

  function hienManGoi() {
    if (!goiHT) return;
    $("tenDangGoi").textContent = goiHT.nick || goiHT.sdt;
    var laVideo = goiHT.cheDo === "video";
    $("videoXa").classList.toggle("an", !laVideo);
    $("videoGan").classList.toggle("an", !laVideo);
    $("avatarDangGoi").classList.toggle("an", laVideo);
    $("avatarDangGoi").textContent = goiHT.emoji || "😀";
    $("btnTatCamera").classList.toggle("an", !laVideo);
    $("videoGan").srcObject = luongLocalGoi || null;
    $("videoXa").srcObject = null;
    $("btnTatTieng").classList.remove("tat");
    $("btnTatCamera").classList.remove("tat");
    datTrangThaiGoi("Đang gọi…");
    $("manGoi").classList.remove("an");
  }

  function batDauDemGioGoi() {
    if (demGioGoi) return;
    giayDangGoi = 0;
    demGioGoi = setInterval(function () {
      giayDangGoi++;
      datTrangThaiGoi("Đang gọi • " + dinhDangThoiLuong(giayDangGoi));
    }, 1000);
  }
  function dungDemGioGoi() {
    if (demGioGoi) { clearInterval(demGioGoi); demGioGoi = null; }
    giayDangGoi = 0;
  }

  function batChuongGoi() {
    // V5.1 hStyle: nếu đã chọn nhạc chuông preset thì phát file WAV lặp lại;
    // "Mặc định" hoặc phát lỗi thì quay về tiếng bíp WebAudio như bản V5.
    var nc = (caiDatHT && caiDatHT.nhacChuong) || "mac-dinh";
    if (nc !== "mac-dinh") {
      var a = $("amNhacChuong");
      if (a) {
        try {
          a.loop = true;
          var srcMong = "assets/nhac-" + nc + ".wav";
          if (a.getAttribute("src") !== srcMong) a.src = srcMong;
          a.currentTime = 0;
          var p = a.play();
          if (p && p.catch) p.catch(function () { batBipChuong(); });
          return;
        } catch (e) {}
      }
    }
    batBipChuong();
  }
  function batBipChuong() {
    try {
      if (!amChuong) amChuong = new (window.AudioContext || window.webkitAudioContext)();
      if (amChuong.state === "suspended") amChuong.resume();
      var bip = function () {
        if (!amChuong) return;
        var o = amChuong.createOscillator(), g = amChuong.createGain();
        o.frequency.value = 880;
        o.connect(g); g.connect(amChuong.destination);
        g.gain.setValueAtTime(0.1, amChuong.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, amChuong.currentTime + 0.5);
        o.start(); o.stop(amChuong.currentTime + 0.5);
      };
      bip();
      demChuong = setInterval(bip, 1600);
    } catch (e) {}
  }
  function dungChuongGoi() {
    if (demChuong) { clearInterval(demChuong); demChuong = null; }
    var a = $("amNhacChuong");
    if (a) { try { a.pause(); a.currentTime = 0; } catch (e) {} }
  }
  function anHopGoiDen() {
    dungChuongGoi();
    var h = $("hopGoiDen");
    if (h) h.classList.add("an");
  }

  function ketThucGoiCucBo() {
    dungDemGioGoi();
    dungChuongGoi();
    if (pcGoi) {
      try {
        pcGoi.onicecandidate = null;
        pcGoi.ontrack = null;
        pcGoi.onconnectionstatechange = null;
        pcGoi.close();
      } catch (e) {}
      pcGoi = null;
    }
    if (luongLocalGoi) {
      luongLocalGoi.getTracks().forEach(function (tr) { try { tr.stop(); } catch (e) {} });
      luongLocalGoi = null;
    }
    var vx = $("videoXa"); if (vx) vx.srcObject = null;
    var vg = $("videoGan"); if (vg) vg.srcObject = null;
    var mg = $("manGoi"); if (mg) mg.classList.add("an");
    goiHT = null;
    iceChoGui = [];
    iceChoNhan = [];
  }

  function ketThucGoiTuNut() {
    if (goiHT && goiHT.callId) guiTinHieu({ loaiTin: "ket-thuc", callId: goiHT.callId });
    ketThucGoiCucBo();
  }

  function batTatTieng() {
    if (!luongLocalGoi) return;
    var trs = luongLocalGoi.getAudioTracks();
    if (!trs.length) return;
    var bat = !trs[0].enabled;
    trs.forEach(function (tr) { tr.enabled = bat; });
    $("btnTatTieng").classList.toggle("tat", !bat);
  }

  function batTatCamera() {
    if (!luongLocalGoi) return;
    var trs = luongLocalGoi.getVideoTracks();
    if (!trs.length) return;
    var bat = !trs[0].enabled;
    trs.forEach(function (tr) { tr.enabled = bat; });
    $("btnTatCamera").classList.toggle("tat", !bat);
  }

  function batDauGoi(cheDo) {
    if (!chatVoi) return;
    if (!TQD_SERVER || !tokenMayChu) { hienToast("Cần đăng nhập qua máy chủ mới gọi được."); return; }
    if (!hoTroGoi()) { hienToast("Trình duyệt này không hỗ trợ gọi thoại/video."); return; }
    if (goiHT || goiDenCho) { hienToast("Bạn đang có một cuộc gọi khác."); return; }
    ketNoiTinHieu();
    var dich = chatVoi;
    navigator.mediaDevices.getUserMedia({ audio: true, video: cheDo === "video" }).then(function (stream) {
      luongLocalGoi = stream;
      goiHT = { callId: null, sdt: dich.sdt, nick: dich.nick, emoji: dich.emoji, cheDo: cheDo, vaiTro: "goi-di", daKetNoi: false };
      iceChoGui = [];
      iceChoNhan = [];
      pcGoi = taoPC();
      stream.getTracks().forEach(function (tr) { pcGoi.addTrack(tr, stream); });
      hienManGoi();
      datTrangThaiGoi("Đang gọi…");
      pcGoi.createOffer().then(function (offer) {
        return pcGoi.setLocalDescription(offer);
      }).then(function () {
        if (!guiTinHieu({ loaiTin: "goi-di", den: dich.sdt, cheDo: cheDo, offer: pcGoi.localDescription })) {
          hienToast("Chưa nối được kênh tín hiệu — đợi vài giây rồi thử lại.");
          ketThucGoiCucBo();
        }
      }).catch(function () {
        hienToast("Không tạo được cuộc gọi.");
        ketThucGoiCucBo();
      });
    }, function (e) {
      hienToast(loiQuyenMedia(e, cheDo));
    });
  }

  function coCuocGoiDen(msg) {
    if (goiHT || goiDenCho) { // phía client đang bận (máy chủ đã lọc, đây là lớp dự phòng)
      guiTinHieu({ loaiTin: "tu-choi", callId: msg.callId });
      return;
    }
    goiDenCho = msg;
    $("nhanLoaiGoiDen").textContent = msg.cheDo === "video" ? "📹 Cuộc gọi video đến" : "📞 Cuộc gọi thoại đến";
    $("avatarGoiDen").textContent = msg.emoji || "😀";
    $("tenGoiDen").textContent = msg.nick || msg.tu;
    apNenGoiDenCho(); // V5.1 hStyle: nền cuộc gọi đến + rung theo cài đặt
    $("hopGoiDen").classList.remove("an");
    batChuongGoi();
  }

  function chapNhanGoiDen() {
    var den = goiDenCho;
    if (!den) return;
    goiDenCho = null;
    anHopGoiDen();
    if (!hoTroGoi()) {
      guiTinHieu({ loaiTin: "tu-choi", callId: den.callId });
      hienToast("Trình duyệt này không hỗ trợ gọi thoại/video.");
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true, video: den.cheDo === "video" }).then(function (stream) {
      luongLocalGoi = stream;
      goiHT = { callId: den.callId, sdt: den.tu, nick: den.nick, emoji: den.emoji, cheDo: den.cheDo, vaiTro: "goi-den", daKetNoi: false };
      iceChoGui = [];
      pcGoi = taoPC();
      stream.getTracks().forEach(function (tr) { pcGoi.addTrack(tr, stream); });
      hienManGoi();
      datTrangThaiGoi("Đang kết nối…");
      pcGoi.setRemoteDescription(new RTCSessionDescription(den.offer)).then(function () {
        napIceChoNhan();
        return pcGoi.createAnswer();
      }).then(function (answer) {
        return pcGoi.setLocalDescription(answer);
      }).then(function () {
        guiTinHieu({ loaiTin: "tra-loi", callId: den.callId, answer: pcGoi.localDescription });
        dayIceChoGui();
      }).catch(function () {
        hienToast("Không thiết lập được cuộc gọi.");
        guiTinHieu({ loaiTin: "ket-thuc", callId: den.callId });
        ketThucGoiCucBo();
      });
    }, function (e) {
      guiTinHieu({ loaiTin: "tu-choi", callId: den.callId });
      hienToast(loiQuyenMedia(e, den.cheDo));
    });
  }

  function tuChoiGoiDen() {
    var den = goiDenCho;
    goiDenCho = null;
    anHopGoiDen();
    if (den) guiTinHieu({ loaiTin: "tu-choi", callId: den.callId });
  }

  function xuLyTinHieu(msg) {
    if (msg.loaiTin === "dang-ky-ok") return;
    if (msg.loaiTin === "cuoc-goi-den") { coCuocGoiDen(msg); return; }
    if (msg.loaiTin === "dang-do-chuong") {
      if (goiHT && goiHT.vaiTro === "goi-di") {
        goiHT.callId = msg.callId;
        datTrangThaiGoi("Đang đổ chuông…");
        dayIceChoGui();
      }
      return;
    }
    if (msg.loaiTin === "tra-loi") {
      if (goiHT && pcGoi && msg.callId === goiHT.callId) {
        datTrangThaiGoi("Đang kết nối…");
        pcGoi.setRemoteDescription(new RTCSessionDescription(msg.answer)).then(function () {
          napIceChoNhan();
        }).catch(function () {});
      }
      return;
    }
    if (msg.loaiTin === "ice") {
      if (!msg.candidate) return;
      if (goiHT && msg.callId === goiHT.callId) {
        if (pcGoi && pcGoi.remoteDescription) {
          try { pcGoi.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch (e) {}
        } else {
          iceChoNhan.push(msg.candidate);
        }
      } else if (goiDenCho && msg.callId === goiDenCho.callId) {
        iceChoNhan.push(msg.candidate); // ICE đến trong lúc đang chờ bấm Nghe
      }
      return;
    }
    if (msg.loaiTin === "bi-tu-choi") {
      hienToast("Người kia đã từ chối cuộc gọi.");
      ketThucGoiCucBo();
      return;
    }
    if (msg.loaiTin === "trang-thai-goi") {
      if (msg.trangThai === "ban") hienToast("Người bạn gọi đang bận trong cuộc gọi khác.");
      else if (msg.trangThai === "khong-truc-tuyen") hienToast("Người bạn gọi đang không trực tuyến.");
      ketThucGoiCucBo();
      return;
    }
    if (msg.loaiTin === "het-gio-cho") {
      if (goiDenCho && msg.callId === goiDenCho.callId) {
        goiDenCho = null;
        anHopGoiDen();
        hienToast("Cuộc gọi đến đã hết giờ chờ.");
      }
      if (goiHT && msg.callId === goiHT.callId) {
        hienToast("Không có người bắt máy.");
        ketThucGoiCucBo();
      }
      return;
    }
    if (msg.loaiTin === "ket-thuc") {
      if (goiDenCho && msg.callId === goiDenCho.callId) {
        goiDenCho = null;
        anHopGoiDen();
      }
      if (goiHT) ketThucGoiCucBo();
      return;
    }
    if (msg.loaiTin === "loi") {
      hienToast(msg.loi || "Cuộc gọi gặp lỗi.");
      if (goiHT && !goiHT.daKetNoi) ketThucGoiCucBo();
      return;
    }
  }

  // ---------- Tường nhà ----------
  function taiBaiDang() {
    if (!TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/bai-dang", "GET", null, true).then(function (kq) {
      var hop = $("dsBaiDang");
      hop.innerHTML = "";
      if (!kq.ok) return;
      var ds = kq.baiDang || [];
      $("trongBaiDang").classList.toggle("an", ds.length > 0);
      ds.forEach(function (b) {
        var the = document.createElement("div");
        the.className = "theBaiDang";
        var dau = document.createElement("div");
        dau.className = "dauBaiDang";
        var av = document.createElement("span");
        av.className = "avatarChat";
        av.textContent = b.emoji || "😀";
        var meta = document.createElement("div");
        var ten = document.createElement("p");
        ten.className = "tenNguoi";
        ten.textContent = b.nick || "";
        var gio = document.createElement("p");
        gio.className = "chiTietNguoi";
        gio.textContent = dinhDangGio(b.tg);
        meta.appendChild(ten);
        meta.appendChild(gio);
        dau.appendChild(av);
        dau.appendChild(meta);
        var nd = document.createElement("p");
        nd.className = "noiDungBai";
        nd.textContent = b.noiDung;
        the.appendChild(dau);
        the.appendChild(nd);
        hop.appendChild(the);
      });
    });
  }

  function dangBaiSuKien() {
    var noiDung = $("inpBaiDang").value.trim();
    if (!noiDung) { $("loiBaiDang").textContent = "Bạn chưa viết nội dung bài đăng."; return; }
    goiAPI("/api/bai-dang", "POST", { noiDung: noiDung }, true).then(function (kq) {
      if (!kq.ok) { $("loiBaiDang").textContent = kq.loi || "Chưa đăng được bài."; return; }
      $("loiBaiDang").textContent = "";
      $("inpBaiDang").value = "";
      hienToast("Đã đăng bài lên Tường nhà 📝");
      taiBaiDang();
    });
  }

  // ---------- Cài đặt riêng tư + danh sách chặn (tab Cá nhân) ----------
  // ===== V5.1: CÀI ĐẶT TỔNG (riêng tư + Cài đặt + giao diện + hStyle) =====
  function datRadio(ten, giaTri) {
    var rs = document.querySelectorAll('input[name="' + ten + '"]');
    for (var i = 0; i < rs.length; i++) rs[i].checked = rs[i].value === giaTri;
  }
  function docRadio(ten) {
    var r = document.querySelector('input[name="' + ten + '"]:checked');
    return r ? r.value : "";
  }

  function taiCaiDat() {
    if (!TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/cai-dat", "GET", null, true).then(function (kq) {
      if (!kq.ok || !kq.caiDat) return;
      caiDatHT = kq.caiDat;
      trangThaiMe = kq.trangThai || "";
      khoaPinBatHT = kq.khoaPinBat === true;
      dienCaiDatVaoTrang();
      capNhatBongTrangThai();
      veKhuPin();
    });
  }

  // Đổ toàn bộ cài đặt hiện tại vào MỌI trang con (nhiều trang dùng chung một khóa)
  function dienCaiDatVaoTrang() {
    if (!caiDatHT) return;
    var c = caiDatHT;
    $("chkTimBangSDT").checked = !!c.timBangSDT;
    $("chkTimBangSDTDanhBa").checked = !!c.timBangSDT;
    $("chkLaNhanTin").checked = !!c.laNhanTin;
    $("chkLaGoi").checked = !!c.laGoi;
    $("chkLaGoiCd").checked = !!c.laGoi;
    $("chkEnterGui").checked = c.enterGui !== false;
    $("chkHienGioTin").checked = c.hienGioTin !== false;
    $("chkRungKhiGoiDen").checked = c.rungKhiGoiDen !== false;
    $("chkTuongChiBanBe").checked = c.tuongChiBanBe !== false;
    $("chkTuongChiBanBeRt").checked = c.tuongChiBanBe !== false;
    $("chkTuongThongBao").checked = !!c.tuongThongBao;
    $("selDanhBaSapXep").value = c.danhBaSapXep || "mac-dinh";
    datRadio("giaoDien", c.giaoDien || "sang");
    datRadio("nhacChuong", c.nhacChuong || "mac-dinh");
    nenGoiDenChon = c.nenGoiDen || "mac-dinh";
    nenGoiDenTepChon = c.nenGoiDenTep || "";
    apGiaoDien(c.giaoDien || "sang");
    document.body.classList.toggle("anGioTin", c.hienGioTin === false);
    capNhatLuoiNenGoi();
  }

  function luuCaiDatTuCongTac() {
    if (!TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/cai-dat", "PUT", {
      timBangSDT: $("chkTimBangSDT").checked,
      laNhanTin: $("chkLaNhanTin").checked,
      laGoi: $("chkLaGoi").checked,
      enterGui: $("chkEnterGui").checked,
      hienGioTin: $("chkHienGioTin").checked,
      rungKhiGoiDen: $("chkRungKhiGoiDen").checked,
      tuongChiBanBe: $("chkTuongChiBanBe").checked,
      tuongThongBao: $("chkTuongThongBao").checked,
      danhBaSapXep: $("selDanhBaSapXep").value,
      giaoDien: docRadio("giaoDien") || "sang",
      nhacChuong: docRadio("nhacChuong") || "mac-dinh",
      nenGoiDen: nenGoiDenChon,
      nenGoiDenTep: nenGoiDenTepChon
    }, true).then(function (kq) {
      if (!kq.ok) { hienToast(kq.loi || "Chưa lưu được cài đặt."); return; }
      caiDatHT = kq.caiDat;
      trangThaiMe = kq.trangThai || trangThaiMe;
      khoaPinBatHT = kq.khoaPinBat === true;
      dienCaiDatVaoTrang();
      capNhatBongTrangThai();
      hienToast("Đã lưu cài đặt ⚙️");
    });
  }

  // Áp giao diện sáng/tối: class "toi" trên <html> + nhớ ở máy để mở app là đúng nền ngay
  function apGiaoDien(gd) {
    document.documentElement.classList.toggle("toi", gd === "toi");
    try { localStorage.setItem("tqd_giaodien", gd); } catch (e) {}
  }

  // ===== V5.1: KHÓA PIN (cổng khi mở app) =====
  function kiemTraKhoaPin() {
    if (!TQD_SERVER || !tokenMayChu) return;
    var daMo = false;
    try { daMo = sessionStorage.getItem("tqd_da_mo_khoa") === "1"; } catch (e) {}
    if (daMo) return;
    goiAPI("/api/cai-dat", "GET", null, true).then(function (kq) {
      if (kq.ok && kq.khoaPinBat) {
        khoaPinBatHT = true;
        $("loiKhoaPin").textContent = "";
        $("inpKhoaPin").value = "";
        $("manKhoaPin").classList.remove("an");
      }
    });
  }

  function moKhoaSuKien() {
    var pin = $("inpKhoaPin").value.replace(/\s/g, "");
    if (!pin) { $("loiKhoaPin").textContent = "Bạn chưa nhập PIN."; return; }
    goiAPI("/api/khoa-pin/xac-thuc", "POST", { pin: pin }, true).then(function (kq) {
      if (!kq.ok) { $("loiKhoaPin").textContent = kq.loi || "PIN chưa đúng."; return; }
      try { sessionStorage.setItem("tqd_da_mo_khoa", "1"); } catch (e) {}
      $("manKhoaPin").classList.add("an");
      hienToast("Đã mở khóa 🔓");
    });
  }

  function veKhuPin() {
    var kb = $("khuPinChuaBat"), db = $("khuPinDaBat");
    if (!kb || !db) return;
    kb.classList.toggle("an", khoaPinBatHT === true);
    db.classList.toggle("an", khoaPinBatHT !== true);
  }

  function taiThongTinTaiKhoan() {
    $("sdtTaiKhoan").textContent = sdtHienTai || "";
    veKhuPin();
    if (!TQD_SERVER || !tokenMayChu) {
      $("thongTinPhien").textContent = "Chế độ xem thử — chưa nối máy chủ.";
      return;
    }
    taiCaiDat();
    goiAPI("/api/phien-cua-toi", "GET", null, true).then(function (kq) {
      if (!kq.ok) { $("thongTinPhien").textContent = "Chưa lấy được thông tin phiên."; return; }
      var chu = "Tài khoản đang có " + kq.soPhien + " phiên đăng nhập đang mở.";
      if (kq.taoLuc) {
        var d = new Date(kq.taoLuc);
        chu = "Phiên hiện tại bắt đầu lúc " + dinhDangGio(kq.taoLuc) + " ngày " +
          d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear() + ". " + chu;
      }
      $("thongTinPhien").textContent = chu;
    });
  }

  function batPinSuKien() {
    var p1 = $("inpPinMoi").value.replace(/\s/g, "");
    var p2 = $("inpPinMoi2").value.replace(/\s/g, "");
    if (!/^\d{4,6}$/.test(p1)) { $("loiPin").textContent = "PIN cần gồm 4 đến 6 chữ số."; return; }
    if (p1 !== p2) { $("loiPin").textContent = "Hai lần nhập PIN chưa giống nhau."; return; }
    goiAPI("/api/khoa-pin/dat", "POST", { pin: p1 }, true).then(function (kq) {
      if (!kq.ok) { $("loiPin").textContent = kq.loi || "Chưa đặt được PIN."; return; }
      khoaPinBatHT = true;
      $("loiPin").textContent = "";
      $("inpPinMoi").value = ""; $("inpPinMoi2").value = "";
      try { sessionStorage.setItem("tqd_da_mo_khoa", "1"); } catch (e) {}
      veKhuPin();
      hienToast("Đã bật khóa PIN 🔒");
    });
  }

  function doiPinSuKien() {
    var cu = $("inpPinCu").value.replace(/\s/g, "");
    var m1 = $("inpPinDoi").value.replace(/\s/g, "");
    var m2 = $("inpPinDoi2").value.replace(/\s/g, "");
    if (!/^\d{4,6}$/.test(m1)) { $("loiPin").textContent = "PIN mới cần gồm 4 đến 6 chữ số."; return; }
    if (m1 !== m2) { $("loiPin").textContent = "Hai lần nhập PIN mới chưa giống nhau."; return; }
    goiAPI("/api/khoa-pin/dat", "POST", { pin: m1, pinCu: cu }, true).then(function (kq) {
      if (!kq.ok) { $("loiPin").textContent = kq.loi || "Chưa đổi được PIN."; return; }
      $("loiPin").textContent = "";
      $("inpPinCu").value = ""; $("inpPinDoi").value = ""; $("inpPinDoi2").value = "";
      hienToast("Đã đổi PIN 🔑");
    });
  }

  function tatPinSuKien() {
    var cu = $("inpPinCu").value.replace(/\s/g, "");
    if (!cu) { $("loiPin").textContent = "Nhập PIN hiện tại vào ô phía trên rồi mới tắt khóa được."; return; }
    goiAPI("/api/khoa-pin/tat", "POST", { pin: cu }, true).then(function (kq) {
      if (!kq.ok) { $("loiPin").textContent = kq.loi || "Chưa tắt được khóa PIN."; return; }
      khoaPinBatHT = false;
      $("loiPin").textContent = "";
      $("inpPinCu").value = "";
      veKhuPin();
      hienToast("Đã tắt khóa PIN 🔓");
    });
  }

  // ===== V5.1: TÀI LIỆU CỦA TÔI (tin nhắn đã lưu) =====
  function luuTinNhanVaoTaiLieu(t) {
    if (!chatVoi || !TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/da-luu", "POST", { sdt: chatVoi.sdt, tg: t.tg }, true).then(function (kq) {
      if (!kq.ok) { hienToast(kq.loi || "Chưa lưu được tin nhắn này."); return; }
      hienToast(kq.daTonTai ? "Tin này đã có trong Tài liệu của tôi rồi." : "Đã lưu vào Tài liệu của tôi 🔖");
    });
  }

  // Vẽ phần nội dung của một tin (chữ / ảnh / thoại / video / tệp) vào hộp cho trước —
  // dùng chung cho trang Tài liệu đã lưu và hCloud.
  function veXemTruocTep(hop, t) {
    var kieu = t.kieu || "van-ban";
    if (kieu === "anh" && t.tepId) {
      var img = document.createElement("img");
      img.className = "anhTrongChat";
      img.src = duongDanTep(t.tepId);
      img.alt = t.tenTep || "Ảnh";
      img.addEventListener("click", function () { window.open(duongDanTep(t.tepId), "_blank"); });
      hop.appendChild(img);
    } else if (kieu === "thoai" && t.tepId) {
      var au = document.createElement("audio");
      au.className = "amTrongChat";
      au.controls = true;
      au.preload = "metadata";
      au.src = duongDanTep(t.tepId);
      hop.appendChild(au);
    } else if (kieu === "tep" && t.tepId && (t.mimeTep || "").indexOf("video/") === 0) {
      var vd = document.createElement("video");
      vd.className = "videoTrongChat";
      vd.controls = true;
      vd.preload = "metadata";
      vd.src = duongDanTep(t.tepId);
      hop.appendChild(vd);
    } else if (t.tepId) {
      var a = document.createElement("a");
      a.className = "tepTrongChat";
      a.href = duongDanTep(t.tepId);
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "📎 " + (t.tenTep || "Tệp đính kèm");
      hop.appendChild(a);
    } else if (kieu !== "van-ban") {
      var sp = document.createElement("span");
      sp.className = "metaTep";
      sp.textContent = "🗑️ Tệp gốc đã bị xóa khỏi máy chủ";
      hop.appendChild(sp);
    } else {
      var p = document.createElement("p");
      p.className = "noiDungLuuChu";
      p.textContent = t.noiDung || "";
      hop.appendChild(p);
    }
  }

  function taiDaLuu() {
    var hop = $("dsDaLuu");
    if (!hop) return;
    hop.innerHTML = "";
    if (!TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/da-luu", "GET", null, true).then(function (kq) {
      hop.innerHTML = "";
      if (!kq.ok) return;
      var ds = kq.daLuu || [];
      $("trongDaLuu").classList.toggle("an", ds.length > 0);
      ds.forEach(function (m) {
        var the = document.createElement("div");
        the.className = "theMucLuu";
        var banSao = {};
        for (var k in m) banSao[k] = m[k];
        if (banSao.tepConTonTai === false) banSao.tepId = null; // tệp gốc đã xóa -> hiện nhãn đã xóa
        veXemTruocTep(the, banSao);
        var meta = document.createElement("p");
        meta.className = "moTa";
        meta.textContent = (m.cuaToi ? "Bạn đã gửi" : "Từ " + (m.nickNguoiGui || m.tu)) +
          " · tin lúc " + dinhDangGio(m.tgGoc) + " · lưu lúc " + dinhDangGio(m.luuLuc);
        the.appendChild(meta);
        the.appendChild(taoNutNhan("🗑️ Xóa khỏi tài liệu", "nutPhu nho", function () {
          goiAPI("/api/da-luu/xoa", "POST", { id: m.id }, true).then(function (kq2) {
            if (!kq2.ok) { hienToast(kq2.loi || "Chưa xóa được mục này."); return; }
            hienToast("Đã xóa khỏi Tài liệu của tôi.");
            taiDaLuu();
          });
        }));
        hop.appendChild(the);
      });
    });
  }

  // ===== V5.1: VÍ QR =====
  // Tải ẢNH riêng lên máy chủ (không tạo tin nhắn) — dùng cho ảnh Ví QR và ảnh nền cuộc gọi.
  function taiTepRiengLen(file, mucDich) {
    var headers = {
      "Content-Type": file.type || "application/octet-stream",
      "X-Muc-Dich": mucDich,
      "X-Ten-Tep": encodeURIComponent(file.name || "anh.png")
    };
    if (tokenMayChu) headers["Authorization"] = "Bearer " + tokenMayChu;
    return fetch(TQD_SERVER + "/api/tep-rieng/upload", {
      method: "POST", headers: headers, body: file
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, loi: "Máy chủ trả lời không hợp lệ." }; });
    }).catch(function () {
      return { ok: false, loi: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại nhé." };
    });
  }

  function themViQRuSuKien() {
    var ten = $("inpTenViQR").value.replace(/\s+/g, " ").trim();
    var loai = docRadio("loaiViQR") || "anh";
    $("loiViQR").textContent = "";
    if (!ten) { $("loiViQR").textContent = "Bạn chưa đặt tên cho mục QR này."; return; }
    if (loai === "anh") {
      if (!anhViQRFile) { $("loiViQR").textContent = "Bạn chưa chọn ảnh mã QR."; return; }
      taiTepRiengLen(anhViQRFile, "vi-qr").then(function (up) {
        if (!up.ok) { $("loiViQR").textContent = up.loi || "Tải ảnh lên chưa được."; return; }
        goiAPI("/api/vi-qr", "POST", { ten: ten, loai: "anh", tepId: up.tepId }, true).then(function (kq) {
          if (!kq.ok) { $("loiViQR").textContent = kq.loi || "Chưa thêm được mục QR."; return; }
          xongThemViQR();
        });
      });
    } else {
      var nd = $("inpNoiDungViQR").value.trim();
      if (!nd) { $("loiViQR").textContent = "Bạn chưa nhập nội dung cho mục QR."; return; }
      goiAPI("/api/vi-qr", "POST", { ten: ten, loai: "noi-dung", noiDung: nd }, true).then(function (kq) {
        if (!kq.ok) { $("loiViQR").textContent = kq.loi || "Chưa thêm được mục QR."; return; }
        $("inpNoiDungViQR").value = "";
        xongThemViQR();
      });
    }
  }

  function xongThemViQR() {
    $("inpTenViQR").value = "";
    anhViQRFile = null;
    $("tenAnhViQR").textContent = "";
    $("inpAnhViQR").value = "";
    hienToast("Đã thêm vào Ví QR 🔳");
    taiViQR();
  }

  function taiViQR() {
    var hop = $("dsViQR");
    if (!hop) return;
    hop.innerHTML = "";
    if (!TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/vi-qr", "GET", null, true).then(function (kq) {
      hop.innerHTML = "";
      if (!kq.ok) return;
      var ds = kq.viQR || [];
      $("trongViQR").classList.toggle("an", ds.length > 0);
      ds.forEach(function (m) {
        var the = document.createElement("div");
        the.className = "theViQR";
        var tieu = document.createElement("p");
        tieu.className = "tenNguoi";
        tieu.textContent = m.ten;
        the.appendChild(tieu);
        if (m.loai === "anh" && m.tepId) {
          var img = document.createElement("img");
          img.className = "anhViQR";
          img.src = duongDanTep(m.tepId);
          img.alt = m.ten;
          img.addEventListener("click", function () { window.open(duongDanTep(m.tepId), "_blank"); });
          the.appendChild(img);
          var ghi = document.createElement("p");
          ghi.className = "moTa";
          ghi.textContent = "Chạm vào ảnh để xem lớn.";
          the.appendChild(ghi);
        } else if (m.loai === "anh") {
          var mat = document.createElement("p");
          mat.className = "moTa";
          mat.textContent = "🗑️ Ảnh của mục này đã bị xóa (ở mục Dữ liệu lưu trữ).";
          the.appendChild(mat);
        } else {
          var nd = document.createElement("p");
          nd.className = "noiDungViQR";
          nd.textContent = m.noiDung || "";
          the.appendChild(nd);
          the.appendChild(taoNutNhan("📋 Sao chép nội dung", "nutPhu nho", function () {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(m.noiDung || "").then(function () {
                hienToast("Đã sao chép nội dung 📋");
              }, function () { hienToast("Trình duyệt không cho sao chép tự động."); });
            } else {
              hienToast("Trình duyệt này không hỗ trợ sao chép tự động.");
            }
          }));
        }
        the.appendChild(taoNutNhan("🗑️ Xóa mục này", "nutPhu nho nutDangXuat", function () {
          if (!window.confirm("Xóa mục \"" + m.ten + "\" khỏi Ví QR?")) return;
          goiAPI("/api/vi-qr/xoa", "POST", { id: m.id }, true).then(function (kq2) {
            if (!kq2.ok) { hienToast(kq2.loi || "Chưa xóa được mục này."); return; }
            hienToast("Đã xóa mục khỏi Ví QR.");
            taiViQR();
          });
        }));
        hop.appendChild(the);
      });
    });
  }

  // ===== V5.1: DỮ LIỆU LƯU TRỮ =====
  function taiLuuTru() {
    var el = $("thongTinLuuTru");
    if (!el) return;
    if (!TQD_SERVER || !tokenMayChu) { el.textContent = "Chế độ xem thử — chưa nối máy chủ."; return; }
    goiAPI("/api/luu-tru", "GET", null, true).then(function (kq) {
      if (!kq.ok) { el.textContent = "Chưa lấy được dung lượng."; return; }
      el.textContent =
        "Tệp đã gửi trong tin nhắn: " + kq.tinNhan.soTep + " tệp · " + dinhDangKichThuoc(kq.tinNhan.tongByte) +
        ". Tệp riêng (ảnh Ví QR, nền cuộc gọi): " + kq.tepRieng.soTep + " tệp · " + dinhDangKichThuoc(kq.tepRieng.tongByte) +
        ". Tổng cộng: " + kq.soTep + " tệp · " + dinhDangKichThuoc(kq.tongByte) + ".";
    });
  }

  function xoaHetTepSuKien() {
    if (!window.confirm("Xóa TẤT CẢ tệp bạn đã gửi?\n\nGồm tệp trong tin nhắn, ảnh Ví QR và ảnh nền cuộc gọi. Đã xóa là không lấy lại được.")) return;
    goiAPI("/api/luu-tru/xoa-het", "POST", {}, true).then(function (kq) {
      if (!kq.ok) { hienToast(kq.loi || "Chưa xóa được tệp."); return; }
      hienToast("Đã xóa " + (kq.daXoa || 0) + " tệp khỏi máy chủ 🗑️");
      taiLuuTru();
      taiCaiDat(); // nền cuộc gọi có thể đã quay về mặc định
    });
  }

  // ===== V5.1: hCloud (thư viện media trong chat, chỉ đọc) =====
  function taiDamMay() {
    var hopAnh = $("damMayAnh"), hopVideo = $("damMayVideo"),
        hopThoai = $("damMayThoai"), hopTep = $("damMayTep");
    if (!hopAnh) return;
    hopAnh.innerHTML = ""; hopVideo.innerHTML = ""; hopThoai.innerHTML = ""; hopTep.innerHTML = "";
    if (!TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/dam-may", "GET", null, true).then(function (kq) {
      if (!kq.ok) return;
      var ds = kq.tep || [];
      $("trongDamMay").classList.toggle("an", ds.length > 0);
      var dem = { anh: 0, video: 0, thoai: 0, tep: 0 };
      function metaCua(t) {
        var p = document.createElement("p");
        p.className = "moTa metaDamMay";
        p.textContent = (t.cuaToi ? "Bạn đã gửi" : "Từ " + (t.nickDoiTac || t.sdtDoiTac)) +
          " · " + dinhDangGio(t.tg) + " · " + dinhDangKichThuoc(t.kichThuocTep);
        return p;
      }
      ds.forEach(function (t) {
        var laVideo = t.kieu === "tep" && (t.mimeTep || "").indexOf("video/") === 0;
        if (t.kieu === "anh") {
          dem.anh++;
          var khung = document.createElement("div");
          khung.className = "oDamMay";
          var img = document.createElement("img");
          img.className = "anhDamMay";
          img.src = duongDanTep(t.tepId);
          img.alt = t.tenTep || "Ảnh";
          img.loading = "lazy";
          img.addEventListener("click", function () { window.open(duongDanTep(t.tepId), "_blank"); });
          khung.appendChild(img);
          khung.appendChild(metaCua(t));
          hopAnh.appendChild(khung);
        } else if (laVideo) {
          dem.video++;
          var khungV = document.createElement("div");
          khungV.className = "oDamMay";
          var vd = document.createElement("video");
          vd.className = "videoDamMay";
          vd.controls = true;
          vd.preload = "metadata";
          vd.src = duongDanTep(t.tepId);
          khungV.appendChild(vd);
          khungV.appendChild(metaCua(t));
          hopVideo.appendChild(khungV);
        } else if (t.kieu === "thoai") {
          dem.thoai++;
          var dong = document.createElement("div");
          dong.className = "theMucLuu";
          veXemTruocTep(dong, t);
          dong.appendChild(metaCua(t));
          hopThoai.appendChild(dong);
        } else {
          dem.tep++;
          var dongT = document.createElement("div");
          dongT.className = "theMucLuu";
          veXemTruocTep(dongT, t);
          dongT.appendChild(metaCua(t));
          hopTep.appendChild(dongT);
        }
      });
      var nhom = [
        ["ttDamMayAnh", hopAnh, dem.anh, "🖼️ Ảnh"],
        ["ttDamMayVideo", hopVideo, dem.video, "🎬 Video"],
        ["ttDamMayThoai", hopThoai, dem.thoai, "🎤 Tin nhắn thoại"],
        ["ttDamMayTep", hopTep, dem.tep, "📎 Tệp khác"]
      ];
      nhom.forEach(function (g) {
        $(g[0]).textContent = g[3] + " (" + g[2] + ")";
        $(g[0]).classList.toggle("an", g[2] === 0);
        g[1].classList.toggle("an", g[2] === 0);
      });
    });
  }

  // ===== V5.1: hStyle (nhạc chuông + nền cuộc gọi đến) =====
  function capNhatLuoiNenGoi() {
    var luoi = $("luoiNenGoi");
    if (!luoi) return;
    var btns = luoi.querySelectorAll(".oNenGoi");
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle("dangChon", btns[i].getAttribute("data-nen") === nenGoiDenChon);
    }
    var xt = $("xemTruocNenGoi");
    if (xt) {
      xt.className = "xemTruocNenGoi" + (nenGoiDenChon.indexOf("grad-") === 0 ? " " + nenGoiDenChon : "");
      if (nenGoiDenChon === "anh" && nenGoiDenTepChon) {
        xt.style.backgroundImage = "url(\"" + duongDanTep(nenGoiDenTepChon) + "\")";
      } else {
        xt.style.backgroundImage = "";
      }
    }
  }

  // Nghe thử một nhạc chuông preset (phát 1 lượt, không lặp)
  function ngheThuNhacChuong(ma) {
    var a = $("amNhacChuong");
    if (!a || ma === "mac-dinh") return;
    try {
      a.loop = false;
      a.src = "assets/nhac-" + ma + ".wav";
      a.currentTime = 0;
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  // Áp nền + rung cho màn hình CUỘC GỌI ĐẾN theo hStyle đã lưu
  function apNenGoiDenCho() {
    var hop = $("hopGoiDen");
    if (!hop) return;
    hop.classList.remove("nen-grad-1", "nen-grad-2", "nen-grad-3", "nen-grad-4");
    hop.style.backgroundImage = "";
    if (!caiDatHT) return;
    var nen = caiDatHT.nenGoiDen || "mac-dinh";
    if (nen.indexOf("grad-") === 0) {
      hop.classList.add("nen-" + nen);
    } else if (nen === "anh" && caiDatHT.nenGoiDenTep) {
      hop.style.backgroundImage = "url(\"" + duongDanTep(caiDatHT.nenGoiDenTep) + "\")";
      hop.style.backgroundSize = "cover";
      hop.style.backgroundPosition = "center";
    }
    if (caiDatHT.rungKhiGoiDen !== false && navigator.vibrate) {
      try { navigator.vibrate([350, 200, 350, 200, 350]); } catch (e) {}
    }
  }

  function taiDsChanCaNhan() {
    if (!TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/danh-sach-chan", "GET", null, true).then(function (kq) {
      var hop = $("dsChanCaNhan");
      hop.innerHTML = "";
      if (!kq.ok) return;
      var ds = kq.danhSachChan || [];
      $("trongChan").classList.toggle("an", ds.length > 0);
      ds.forEach(function (c) {
        var nut = taoNutNhan("Bỏ chặn", "nutPhu nho", function () {
          goiAPI("/api/bo-chan", "POST", { sdt: c.sdt }, true).then(function (kq2) {
            if (!kq2.ok) { hienToast(kq2.loi || "Chưa bỏ chặn được."); return; }
            hienToast("Đã bỏ chặn " + (c.nick || c.sdt) + ". (Không tự khôi phục bạn bè cũ.)");
            taiDsChanCaNhan();
          });
        });
        hop.appendChild(taoTheNguoi(c.emoji, c.nick || c.sdt, "📱 " + c.sdt, nut));
      });
    });
  }

  // ---------- Tiện ích (tab Khám phá) ----------
  var MA_THOI_TIET = {
    0: "Trời quang, nắng đẹp ☀️", 1: "Nắng nhẹ, ít mây 🌤", 2: "Có mây ⛅", 3: "Nhiều mây, âm u ☁️",
    45: "Sương mù 🌫", 48: "Sương mù 🌫", 51: "Mưa phùn nhẹ 🌦", 53: "Mưa phùn 🌦", 55: "Mưa phùn dày 🌦",
    61: "Mưa nhỏ 🌧", 63: "Mưa vừa 🌧", 65: "Mưa to 🌧",
    71: "Tuyết rơi nhẹ ❄️", 73: "Tuyết rơi ❄️", 75: "Tuyết dày ❄️",
    80: "Mưa rào nhẹ 🌦", 81: "Mưa rào 🌦", 82: "Mưa rào mạnh ⛈",
    95: "Giông ⛈", 96: "Giông kèm mưa đá ⛈", 99: "Giông kèm mưa đá ⛈"
  };

  function soDep(n, le) {
    return Number(n).toLocaleString("vi-VN", {
      minimumFractionDigits: le || 0, maximumFractionDigits: le || 0
    });
  }

  function moTienIch(loai) {
    var hop = $("chiTietTienIch");
    hop.classList.remove("an");
    hop.innerHTML = "<p class='moTa'>⏳ Đang tải dữ liệu…</p>";
    if (loai === "thoitiet") { taiThoiTiet(hop); return; }
    if (loai === "tygia") {
      goiAPI("/api/tien-ich/ty-gia", "GET", null, true).then(function (kq) { veTyGia(hop, kq); });
      return;
    }
    if (loai === "vang") {
      goiAPI("/api/tien-ich/vang", "GET", null, true).then(function (kq) { veVang(hop, kq); });
      return;
    }
    if (loai === "tintuc") {
      goiAPI("/api/tien-ich/tin-tuc", "GET", null, true).then(function (kq) { veTinTuc(hop, kq); });
    }
  }

  // Thời tiết: gọi Open-Meteo TRỰC TIẾP từ trình duyệt (như app phà), theo vị trí người dùng
  function taiThoiTiet(hop) {
    var vt = viTri || VI_TRI_MAC_DINH;
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + vt.lat + "&longitude=" + vt.lng +
      "&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto";
    fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      var c = j && j.current;
      if (!c) throw new Error("xau");
      hop.innerHTML = "";
      var lon = document.createElement("p");
      lon.className = "soLonTienIch";
      lon.textContent = Math.round(c.temperature_2m) + "°C";
      var mo = document.createElement("p");
      mo.className = "moTa";
      mo.textContent = (MA_THOI_TIET[c.weather_code] || "Thời tiết hiện tại") +
        " · Độ ẩm " + c.relative_humidity_2m + "% · Gió " + c.wind_speed_10m + " km/h" +
        (viTri && viTri.macDinh ? " · (theo vị trí mặc định Cát Hải)" : " · (theo vị trí của bạn)");
      hop.appendChild(lon);
      hop.appendChild(mo);
    }).catch(function () {
      hop.innerHTML = "<p class='moTa'>Chưa lấy được thời tiết. Bạn kiểm tra mạng rồi thử lại nhé.</p>";
    });
  }

  function veTyGia(hop, kq) {
    if (!kq.ok || !kq.rates) {
      hop.innerHTML = "<p class='moTa'>" + (kq.loi || "Chưa lấy được tỉ giá.") + "</p>";
      return;
    }
    var r = kq.rates;
    var dong = [];
    dong.push("🇺🇸 1 USD = " + soDep(r.VND) + " đ");
    if (r.EUR) dong.push("🇪🇺 1 EUR = " + soDep(r.VND / r.EUR) + " đ");
    if (r.CNY) dong.push("🇨🇳 1 CNY = " + soDep(r.VND / r.CNY) + " đ");
    if (r.JPY) dong.push("🇯🇵 100 JPY = " + soDep(r.VND / r.JPY * 100) + " đ");
    if (r.KRW) dong.push("🇰🇷 100 KRW = " + soDep(r.VND / r.KRW * 100) + " đ");
    if (r.THB) dong.push("🇹🇭 1 THB = " + soDep(r.VND / r.THB) + " đ");
    hop.innerHTML = "";
    dong.forEach(function (d) {
      var p = document.createElement("p");
      p.className = "dongTienIch";
      p.textContent = d;
      hop.appendChild(p);
    });
    var ghi = document.createElement("p");
    ghi.className = "moTa";
    ghi.textContent = "Tỉ giá tham khảo từ thị trường quốc tế, không phải tỉ giá mua bán tại ngân hàng.";
    hop.appendChild(ghi);
  }

  function veVang(hop, kq) {
    if (!kq.ok) {
      hop.innerHTML = "<p class='moTa'>" + (kq.loi || "Chưa lấy được giá vàng.") + "</p>";
      return;
    }
    hop.innerHTML = "";
    var lon = document.createElement("p");
    lon.className = "soLonTienIch";
    lon.textContent = "≈ " + soDep(kq.giaVndLuong) + " đ/lượng";
    var mo = document.createElement("p");
    mo.className = "moTa";
    mo.textContent = "Vàng thế giới: " + soDep(kq.giaUsdOz, 2) + " USD/oz · Tỉ giá dùng quy đổi: 1 USD = " +
      soDep(kq.tyGiaUsdVnd) + " đ. " + (kq.ghiChu || "");
    hop.appendChild(lon);
    hop.appendChild(mo);
  }

  function veTinTuc(hop, kq) {
    if (!kq.ok || !kq.tin || !kq.tin.length) {
      hop.innerHTML = "<p class='moTa'>" + (kq.loi || "Chưa lấy được tin tức.") +
        " <a href='https://vnexpress.net' target='_blank' rel='noopener'>Chạm để xem tại nguồn</a></p>";
      return;
    }
    hop.innerHTML = "";
    kq.tin.forEach(function (t) {
      var a = document.createElement("a");
      a.className = "dongTinTuc";
      a.href = t.link;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "📰 " + t.tieuDe + "  · " + t.nguon;
      hop.appendChild(a);
    });
  }

  // ======================================================================
  // ===== GÓI VIP (chỉ chế độ máy chủ) =====
  // V4.1: giá lấy từ máy chủ (nguồn sự thật duy nhất) qua /api/vip/goi — app không tự chốt giá.
  // V4.2: thanh toán TỰ ĐỘNG qua MoMo/ZaloPay. App chỉ mở trang thanh toán của cổng và
  //       hỏi lại trạng thái đơn — app KHÔNG có khả năng tự bật VIP cho bất kỳ ai.
  // ======================================================================
  var vipCuaToi = { vip: false, goi: null, hetHan: null }; // trạng thái VIP của chính mình
  var TEN_GOI_VIP = { tuan: "Gói tuần", thang: "Gói tháng", quy: "Gói 3 tháng", doi: "Gói trọn đời" };

  function dinhDangTien(n) { return Number(n).toLocaleString("vi-VN") + " đ"; }

  function dinhDangNgay(ms) {
    var d = new Date(ms);
    return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear();
  }

  function taiTrangThaiVip() {
    if (!TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/vip/trang-thai", "GET", null, true).then(function (kq) {
      if (!kq.ok) return;
      vipCuaToi = {
        vip: !!kq.vip, goi: kq.goi || null,
        hetHan: (typeof kq.hetHan === "number") ? kq.hetHan : null
      };
      veTrangThaiVip();
    });
  }

  function veTrangThaiVip() {
    var el = $("trangThaiVip");
    if (vipCuaToi.vip && vipCuaToi.hetHan === null) {
      el.textContent = "⭐ Bạn đang là VIP — Gói trọn đời. Tìm quanh đây không giới hạn, bán kính tới 20 km, nhắn tin được cho người lạ và được ưu tiên hiển thị.";
    } else if (vipCuaToi.vip) {
      el.textContent = "⭐ Bạn đang là VIP (" + (TEN_GOI_VIP[vipCuaToi.goi] || vipCuaToi.goi || "") + ") đến ngày " +
        dinhDangNgay(vipCuaToi.hetHan) + ". Tìm quanh đây không giới hạn, bán kính tới 20 km, nhắn tin được cho người lạ và được ưu tiên hiển thị.";
    } else {
      el.textContent = "Đang dùng bản miễn phí: Tìm quanh đây tối đa 10 hồ sơ/ngày trong bán kính 5 km. Nâng VIP để tìm không giới hạn tới 20 km và nhắn tin được cho người lạ.";
    }
    // Ghi chú "Bản miễn phí: tối đa 5 km" cạnh thanh trượt khoảng cách — chỉ hiện khi chưa VIP
    $("ghiChuKmFree").classList.toggle("an", vipCuaToi.vip);
  }

  function taiGoiVip() {
    if (!TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/vip/goi", "GET", null, true).then(function (kq) {
      var hop = $("dsGoiVip");
      hop.innerHTML = "";
      if (!kq.ok || !kq.goi) return;
      // V4.2: máy chủ cho biết cổng nào đã cấu hình + duyệt tay có bật không
      var congTT = kq.congThanhToan || { momo: false, zalopay: false };
      var coCong = !!(congTT.momo || congTT.zalopay);
      ["tuan", "thang", "quy", "doi"].forEach(function (key) {
        var g = kq.goi[key];
        if (!g) return;
        var the = document.createElement("div");
        the.className = "theGoiVip";
        var giua = document.createElement("div");
        giua.className = "thongTinNguoi";
        var ten = document.createElement("p");
        ten.className = "tenNguoi";
        ten.textContent = "⭐ " + g.ten;
        var gia = document.createElement("p");
        gia.className = "giaGoi";
        gia.textContent = dinhDangTien(g.gia);
        var han = document.createElement("p");
        han.className = "chiTietNguoi";
        han.textContent = g.ngay ? ("Dùng trong " + g.ngay + " ngày") : "Dùng trọn đời — trả một lần duy nhất";
        giua.appendChild(ten);
        giua.appendChild(gia);
        giua.appendChild(han);
        var phai = document.createElement("div");
        phai.className = "cotPhai";
        if (congTT.momo) {
          phai.appendChild(taoNutNhan("🟣 Trả qua MoMo", "nutChinh nho nutMomo", function () { datGoiVip(key, "momo"); }));
        }
        if (congTT.zalopay) {
          phai.appendChild(taoNutNhan("🔵 Trả qua ZaloPay", "nutChinh nho nutZaloPay", function () { datGoiVip(key, "zalopay"); }));
        }
        if (!coCong && !kq.manualPay) {
          phai.appendChild(taoNutNhan("Cổng thanh toán đang được cấu hình", "nutPhu nho", null, true));
        }
        // Chuyển khoản tay CHỈ hiện khi máy chủ bật MANUAL_PAY=on
        if (kq.manualPay) {
          phai.appendChild(taoNutNhan("🏦 Chuyển khoản tay", "nutPhu nho", function () { datGoiVip(key, null); }));
        }
        the.appendChild(giua);
        the.appendChild(phai);
        hop.appendChild(the);
      });
    });
  }

  // V4.2: đặt gói. cong = "momo" | "zalopay" | null (null = chuyển khoản tay, chỉ khi máy chủ bật)
  function datGoiVip(key, cong) {
    var thanGui = { goi: key };
    if (cong) thanGui.cong = cong;
    goiAPI("/api/vip/dat", "POST", thanGui, true).then(function (kq) {
      if (!kq.ok || !kq.don) { hienToast(kq.loi || "Chưa tạo được đơn. Thử lại nhé."); return; }
      if (cong) {
        // Luồng cổng tự động: mở trang thanh toán của cổng ở thẻ mới, rồi tự theo dõi trạng thái đơn.
        // LƯU Ý: app KHÔNG có cách nào tự bật VIP — chỉ máy chủ bật sau khi cổng xác nhận bằng chữ ký.
        $("panelThanhToanVip").classList.add("an");
        $("pcTenGoi").textContent = kq.don.tenGoi || TEN_GOI_VIP[key] || key;
        $("pcSoTien").textContent = dinhDangTien(kq.don.soTien);
        $("pcCong").textContent = cong === "momo" ? "MoMo" : "ZaloPay";
        $("pcMaDon").textContent = kq.don.ma;
        $("pcTrangThai").textContent = "⏳ Đang chờ bạn hoàn tất thanh toán trên trang của " +
          (cong === "momo" ? "MoMo" : "ZaloPay") + "… VIP sẽ tự bật ngay khi cổng xác nhận (thường vài giây).";
        var nutMo = $("pcMoLai");
        if (kq.payUrl) {
          nutMo.href = kq.payUrl;
          nutMo.classList.remove("an");
          window.open(kq.payUrl, "_blank");
        } else {
          nutMo.classList.add("an");
        }
        $("panelChoThanhToan").classList.remove("an");
        $("panelChoThanhToan").scrollIntoView({ behavior: "smooth", block: "center" });
        hienToast("Đã tạo đơn " + kq.don.ma + " — hoàn tất thanh toán ở thẻ mới nhé 💳");
        theoDoiDon(kq.don.ma);
        taiDonCuaToi();
        return;
      }
      // Luồng chuyển khoản tay (chỉ tới được khi máy chủ bật MANUAL_PAY)
      var hd = kq.huongDan || {};
      $("panelChoThanhToan").classList.add("an");
      $("ttTenGoi").textContent = kq.don.tenGoi || TEN_GOI_VIP[key] || key;
      $("ttSoTien").textContent = dinhDangTien(kq.don.soTien);
      $("ttNganHang").textContent = hd.tenNganHang || "";
      $("ttSoTk").textContent = hd.soTaiKhoan || "";
      $("ttChuTk").textContent = hd.chuTaiKhoan || "";
      $("ttMaDon").textContent = kq.don.ma;
      $("ttGhiChu").textContent = hd.ghiChu || "";
      $("panelThanhToanVip").classList.remove("an");
      $("panelThanhToanVip").scrollIntoView({ behavior: "smooth", block: "center" });
      hienToast("Đã tạo đơn " + kq.don.ma + " — chuyển khoản ghi đúng mã đơn này nhé 💳");
      taiDonCuaToi();
    });
  }

  // V4.2: tự hỏi lại trạng thái đơn mỗi 5 giây (tối đa 3 phút).
  // Việc hỏi này CHỈ để hiển thị — "khai đã trả" ở phía app không bật được VIP;
  // trạng thái "da-tra" chỉ xuất hiện khi máy chủ đã nhận callback kiểm chứng từ cổng.
  var boDemTheoDoi = null;
  function theoDoiDon(ma) {
    if (boDemTheoDoi) { clearInterval(boDemTheoDoi); boDemTheoDoi = null; }
    var soLan = 0;
    boDemTheoDoi = setInterval(function () {
      soLan++;
      goiAPI("/api/vip/don-cua-toi", "GET", null, true).then(function (kq) {
        if (!kq.ok) return;
        var don = null;
        (kq.donHang || []).forEach(function (d) { if (d.ma === ma) don = d; });
        if (don && don.trangThai === "da-tra") {
          clearInterval(boDemTheoDoi); boDemTheoDoi = null;
          $("pcTrangThai").textContent = "🎉 Thanh toán thành công — VIP đã được kích hoạt!";
          hienToast("🎉 VIP đã kích hoạt — chúc bạn tìm được người thương!");
          taiTrangThaiVip();
          taiDonCuaToi();
        } else if (don && (don.trangThai === "het-han" || don.trangThai === "huy-bo")) {
          clearInterval(boDemTheoDoi); boDemTheoDoi = null;
          $("pcTrangThai").textContent = "⌛ Đơn này đã hết hạn thanh toán. Bạn quay lên trên tạo đơn mới nhé.";
        } else if (soLan >= 36) {
          clearInterval(boDemTheoDoi); boDemTheoDoi = null;
          $("pcTrangThai").textContent = "Đơn vẫn đang chờ thanh toán. Nếu bạn đã trả tiền, VIP sẽ tự bật ngay khi cổng xác nhận — xem lại ở mục Đơn của tôi.";
        }
      });
    }, 5000);
  }

  function taiDonCuaToi() {
    if (!TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/vip/don-cua-toi", "GET", null, true).then(function (kq) {
      var hop = $("dsDonVip");
      hop.innerHTML = "";
      if (!kq.ok) return;
      if (kq.vip) { // đồng bộ trạng thái VIP mới nhất (ví dụ đơn vừa được chủ app duyệt)
        vipCuaToi = {
          vip: !!kq.vip.vip, goi: kq.vip.goi || null,
          hetHan: (typeof kq.vip.hetHan === "number") ? kq.vip.hetHan : null
        };
        veTrangThaiVip();
      }
      var ds = kq.donHang || [];
      $("trongDonVip").classList.toggle("an", ds.length > 0);
      var nhanTrangThai = {
        "cho-duyet": "⏳ Chờ duyệt", "da-duyet": "✅ Đã duyệt", "tu-choi": "❌ Bị từ chối",
        "cho-thanh-toan": "⏳ Chờ thanh toán", "da-tra": "✅ Đã thanh toán — VIP đã bật",
        "het-han": "⌛ Hết hạn thanh toán", "huy-bo": "🚫 Đã hủy"
      };
      ds.forEach(function (d) {
        var the = document.createElement("div");
        the.className = "theDonVip";
        var giua = document.createElement("div");
        giua.className = "thongTinNguoi";
        var dong1 = document.createElement("p");
        dong1.className = "tenNguoi";
        dong1.textContent = d.ma + " · " + (d.tenGoi || TEN_GOI_VIP[d.goi] || d.goi);
        var dong2 = document.createElement("p");
        dong2.className = "chiTietNguoi";
        dong2.textContent = dinhDangTien(d.soTien) + " · đặt lúc " + dinhDangGio(d.tg);
        giua.appendChild(dong1);
        giua.appendChild(dong2);
        var phai = document.createElement("div");
        phai.className = "cotPhai";
        var huy = document.createElement("span");
        huy.className = "huyHieuKm";
        huy.textContent = nhanTrangThai[d.trangThai] || d.trangThai;
        phai.appendChild(huy);
        the.appendChild(giua);
        the.appendChild(phai);
        hop.appendChild(the);
      });
    });
  }

  // --- Khởi tạo ---
  document.addEventListener("DOMContentLoaded", function () {
    dungChonEmoji();
    khoiPhucDangNhap();
    // V5.1: áp lại giao diện đã nhớ ở máy (sáng/tối) ngay khi mở app
    try {
      var gdNho = localStorage.getItem("tqd_giaodien");
      if (gdNho) { apGiaoDien(gdNho); datRadio("giaoDien", gdNho); }
    } catch (e) {}
    capNhatManHinh();
    kiemTraKhoaPin(); // V5.1: khóa PIN nếu tài khoản đã bật (phiên còn hiệu lực)
    datLocGioi(me ? gioiDoiDien(me.gioi) : "tatca");
    if (TQD_SERVER) {
      $("nhanDemoKetQua").textContent = "🌐 Chế độ máy chủ: đăng nhập bằng OTP thật rồi bấm Tìm — kết quả là người dùng thật đã bật hiển thị quanh bạn.";
    }

    // Luồng tài khoản OTP
    $("btnNhanOTP").addEventListener("click", guiMaOTPSuKien);
    $("btnXacNhanOTP").addEventListener("click", xacNhanOTPSuKien);
    $("btnGuiLai").addEventListener("click", guiLaiMaSuKien);
    $("btnDoiSo").addEventListener("click", doiSoSuKien);
    $("btnDangXuat").addEventListener("click", dangXuat);

    $("formHoSo").addEventListener("submit", luuHoSoSuKien);
    $("btnSuaHoSo").addEventListener("click", function () {
      dienFormTuMe();
      moTrangCaNhan("form"); // V5.1: form hồ sơ là một "trang" trong tab Cá nhân
    });
    $("chkHienThi").addEventListener("change", function () {
      if (me) { me.hienThi = $("chkHienThi").checked; luuMe(); dongBoHoSoLenMayChu(); }
    });

    var btns = $("locGioi").querySelectorAll("button");
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener("click", function () {
        daChonLocThuCong = true;
        datLocGioi(this.getAttribute("data-gt"));
      });
    }
    $("kmTruot").addEventListener("input", function () {
      $("kmDen").value = this.value;
      $("kmTruotVal").textContent = this.value;
    });
    $("btnDinhVi").addEventListener("click", batDinhVi);
    $("btnTim").addEventListener("click", chayTim);

    // ===== V4: thanh tab, danh bạ, chat, tường nhà, riêng tư, tiện ích =====
    if (!TQD_SERVER) {
      // Chế độ demo (chưa có máy chủ): ẩn hẳn các mục chỉ-dành-cho-máy-chủ, giữ nguyên giao diện v3
      $("mucTienIch").classList.add("an");
      $("mucVip").classList.add("an");
    }
    // ===== V4.1: gói VIP =====
    $("btnDonCuaToi").addEventListener("click", taiDonCuaToi);
    $("btnLenVip").addEventListener("click", function () {
      chonTab("canhan");
      var muc = $("mucVip");
      if (muc) muc.scrollIntoView({ behavior: "smooth" });
    });
    var tabBtns = $("thanhTab").querySelectorAll(".tabBtn");
    for (var ti = 0; ti < tabBtns.length; ti++) {
      tabBtns[ti].addEventListener("click", function () { chonTab(this.getAttribute("data-tab")); });
    }
    $("btnTimSdt").addEventListener("click", timBangSdtSuKien);
    $("inpTimSdt").addEventListener("keydown", function (ev) { if (ev.key === "Enter") timBangSdtSuKien(); });
    $("btnXemChan").addEventListener("click", function () { chonTab("canhan"); });
    $("btnGuiTin").addEventListener("click", guiTinSuKien);
    $("inpTinNhan").addEventListener("keydown", function (ev) {
      // V5.1: tôn trọng cài đặt "Nhấn Enter để gửi tin" (mặc định bật như trước)
      if (ev.key === "Enter" && (!caiDatHT || caiDatHT.enterGui !== false)) guiTinSuKien();
    });
    $("btnQuayLaiChat").addEventListener("click", function () { dongManChat(true); });
    $("btnChanTrongChat").addEventListener("click", chanTrongChatSuKien);
    // ===== V5: nút gọi + gửi media trong chat =====
    $("btnGoiThoai").addEventListener("click", function () { batDauGoi("thoai"); });
    $("btnGoiVideo").addEventListener("click", function () { batDauGoi("video"); });
    $("btnChapNhanGoi").addEventListener("click", chapNhanGoiDen);
    $("btnTuChoiGoi").addEventListener("click", tuChoiGoiDen);
    $("btnKetThucGoi").addEventListener("click", ketThucGoiTuNut);
    $("btnTatTieng").addEventListener("click", batTatTieng);
    $("btnTatCamera").addEventListener("click", batTatCamera);
    $("btnChonAnh").addEventListener("click", function () { $("inpChonAnh").click(); });
    $("inpChonAnh").addEventListener("change", function () { if (this.files && this.files[0]) guiAnhTuFile(this.files[0]); this.value = ""; });
    $("btnChonTep").addEventListener("click", function () { $("inpChonTep").click(); });
    $("inpChonTep").addEventListener("change", function () { if (this.files && this.files[0]) guiTepTuFile(this.files[0]); this.value = ""; });
    $("btnHuyTaiLen").addEventListener("click", huyTaiLenDangChay);
    $("btnGhiAm").addEventListener("click", batTatGhiAm);
    $("btnGuiAm").addEventListener("click", guiAmDaGhi);
    $("btnHuyAm").addEventListener("click", huyAmDaGhi);
    $("btnDangBai").addEventListener("click", dangBaiSuKien);
    ["chkTimBangSDT", "chkLaNhanTin", "chkLaGoi", "chkEnterGui", "chkHienGioTin",
     "chkRungKhiGoiDen", "chkTuongThongBao"].forEach(function (idCongTac) {
      $(idCongTac).addEventListener("change", luuCaiDatTuCongTac);
    });
    // V5.1: công tắc "gương" — cùng một khóa cài đặt xuất hiện ở 2 trang, đổi bên nào cũng đồng bộ
    function ganGuong(idA, idB) {
      $(idA).addEventListener("change", function () { $(idB).checked = $(idA).checked; luuCaiDatTuCongTac(); });
      $(idB).addEventListener("change", function () { $(idA).checked = $(idB).checked; luuCaiDatTuCongTac(); });
    }
    ganGuong("chkLaGoi", "chkLaGoiCd");
    ganGuong("chkTimBangSDT", "chkTimBangSDTDanhBa");
    ganGuong("chkTuongChiBanBe", "chkTuongChiBanBeRt");

    // ===== V5.1: điều hướng + điều khiển trung tâm Cá nhân =====
    $("btnCaiDatHub").addEventListener("click", function () { moTrangCaNhan("trangCaiDat"); });
    var nutMoTrang = document.querySelectorAll("[data-mo-trang]");
    for (var mt = 0; mt < nutMoTrang.length; mt++) {
      nutMoTrang[mt].addEventListener("click", function () { moTrangCaNhan(this.getAttribute("data-mo-trang")); });
    }
    var nutQuay = document.querySelectorAll("[data-quay-lai]");
    for (var ql = 0; ql < nutQuay.length; ql++) {
      nutQuay[ql].addEventListener("click", function () {
        var dich = this.getAttribute("data-quay-lai");
        moTrangCaNhan(dich === "hub" ? "hub" : dich);
      });
    }
    $("bongTrangThai").addEventListener("click", function () {
      $("inpTrangThai").value = trangThaiMe || "";
      $("hopSuaTrangThai").classList.remove("an");
      $("inpTrangThai").focus();
    });
    $("btnLuuTrangThai").addEventListener("click", luuTrangThaiSuKien);
    $("btnHuyTrangThai").addEventListener("click", function () { $("hopSuaTrangThai").classList.add("an"); });
    $("btnChuyenTaiKhoan").addEventListener("click", function () {
      if (window.confirm("Chuyển sang tài khoản khác?\n\nPhiên đăng nhập hiện tại sẽ kết thúc. Dữ liệu của tài khoản này vẫn còn nguyên trên máy chủ.")) dangXuat();
    });
    // Giao diện sáng/tối: áp ngay khi chọn, rồi lưu lên máy chủ
    var rdGiaoDien = document.querySelectorAll('input[name="giaoDien"]');
    for (var gd = 0; gd < rdGiaoDien.length; gd++) {
      rdGiaoDien[gd].addEventListener("change", function () {
        apGiaoDien(this.value);
        luuCaiDatTuCongTac();
      });
    }
    $("selDanhBaSapXep").addEventListener("change", luuCaiDatTuCongTac);
    // hStyle: nhạc chuông (chọn là lưu + nghe thử)
    var rdNhac = document.querySelectorAll('input[name="nhacChuong"]');
    for (var nc2 = 0; nc2 < rdNhac.length; nc2++) {
      rdNhac[nc2].addEventListener("change", function () {
        ngheThuNhacChuong(this.value);
        luuCaiDatTuCongTac();
      });
    }
    // hStyle: nền cuộc gọi đến
    var oNen = $("luoiNenGoi").querySelectorAll(".oNenGoi");
    for (var on2 = 0; on2 < oNen.length; on2++) {
      oNen[on2].addEventListener("click", function () {
        var nen = this.getAttribute("data-nen");
        if (nen === "anh" && !nenGoiDenTepChon) { $("inpAnhNenGoi").click(); return; }
        nenGoiDenChon = nen;
        capNhatLuoiNenGoi();
        luuCaiDatTuCongTac();
      });
    }
    $("btnChonAnhNenGoi").addEventListener("click", function () { $("inpAnhNenGoi").click(); });
    $("inpAnhNenGoi").addEventListener("change", function () {
      var f = this.files && this.files[0];
      this.value = "";
      if (!f) return;
      taiTepRiengLen(f, "nen-goi").then(function (up) {
        if (!up.ok) { hienToast(up.loi || "Tải ảnh nền lên chưa được."); return; }
        nenGoiDenTepChon = up.tepId;
        nenGoiDenChon = "anh";
        capNhatLuoiNenGoi();
        luuCaiDatTuCongTac();
        hienToast("Đã đặt ảnh nền cuộc gọi 🖼️");
      });
    });
    // Khóa PIN: đặt / đổi / tắt + cổng mở khóa
    $("btnBatPin").addEventListener("click", batPinSuKien);
    $("btnDoiPin").addEventListener("click", doiPinSuKien);
    $("btnTatPin").addEventListener("click", tatPinSuKien);
    $("btnMoKhoa").addEventListener("click", moKhoaSuKien);
    $("inpKhoaPin").addEventListener("keydown", function (ev) { if (ev.key === "Enter") moKhoaSuKien(); });
    $("btnKhoaDangXuat").addEventListener("click", dangXuat);
    // Ví QR
    var rdLoaiQR = document.querySelectorAll('input[name="loaiViQR"]');
    for (var lq = 0; lq < rdLoaiQR.length; lq++) {
      rdLoaiQR[lq].addEventListener("change", function () {
        var laAnh = this.value === "anh";
        $("hopQrAnh").classList.toggle("an", !laAnh);
        $("hopQrNoiDung").classList.toggle("an", laAnh);
      });
    }
    $("btnChonAnhViQR").addEventListener("click", function () { $("inpAnhViQR").click(); });
    $("inpAnhViQR").addEventListener("change", function () {
      anhViQRFile = (this.files && this.files[0]) || null;
      $("tenAnhViQR").textContent = anhViQRFile ? ("Đã chọn: " + anhViQRFile.name) : "";
    });
    $("btnThemViQR").addEventListener("click", themViQRuSuKien);
    // Dữ liệu lưu trữ
    $("btnXoaHetTep").addEventListener("click", xoaHetTepSuKien);
    var oTienIch = $("luoiTienIch").querySelectorAll("[data-tienich]");
    for (var ui = 0; ui < oTienIch.length; ui++) {
      oTienIch[ui].addEventListener("click", function () { moTienIch(this.getAttribute("data-tienich")); });
    }
    ketNoiTinHieu(); // V5: đã có sẵn phiên đăng nhập (tải lại trang) thì nối kênh gọi ngay
  });
}

// Cho phép Node nạp để kiểm thử logic thuần
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    TQD_SERVER: TQD_SERVER,
    VI_TRI_MAC_DINH: VI_TRI_MAC_DINH,
    HO_SO_DEMO: HO_SO_DEMO,
    DAU_SO_DI_DONG_VN: DAU_SO_DI_DONG_VN,
    kiemTraSoVN: kiemTraSoVN,
    sinhMaOTP: sinhMaOTP,
    taoPhienOTP: taoPhienOTP,
    kiemTraOTP: kiemTraOTP,
    giayChoGuiLai: giayChoGuiLai,
    haversineKm: haversineKm,
    diemDen: diemDen,
    taoViTriDemo: taoViTriDemo,
    locHoSo: locHoSo,
    dinhDangKhoangCach: dinhDangKhoangCach
  };
}
