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
var TQD_SERVER = "";

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
  function veKhuHoSo() {
    var co = !!me;
    $("formHoSo").classList.toggle("an", co);
    $("tomTatHoSo").classList.toggle("an", !co);
    if (co) {
      $("avatarMe").textContent = me.emoji || "😀";
      $("loiChao").textContent = "Xin chào, " + me.nick + "!";
      $("thongTinMe").textContent =
        (me.gioi === "nu" ? "👩 Nữ" : "🧑 Nam") + " · " + me.tuoi + " tuổi";
      $("sdtMe").textContent = "📱 " + (sdtHienTai || "");
      $("chkHienThi").checked = me.hienThi !== false;
      if (!daChonLocThuCong) datLocGioi(gioiDoiDien(me.gioi)); // mặc định tìm khác giới
    }
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
    veKhuHoSo();
    hienToast("Đã lưu hồ sơ. Chúc bạn tìm được người hợp ý! 💞");
  }

  function dangXuat() {
    dungPollChat(); // V4: dừng tự làm mới chat
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
    bong.textContent = t.noiDung;
    var gio = document.createElement("div");
    gio.className = "gioTin";
    gio.textContent = dinhDangGio(t.tg);
    bong.appendChild(gio);
    dong.appendChild(bong);
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
  function taiCaiDat() {
    if (!TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/cai-dat", "GET", null, true).then(function (kq) {
      if (!kq.ok || !kq.caiDat) return;
      $("chkTimBangSDT").checked = !!kq.caiDat.timBangSDT;
      $("chkLaNhanTin").checked = !!kq.caiDat.laNhanTin;
      $("chkLaGoi").checked = !!kq.caiDat.laGoi;
    });
  }

  function luuCaiDatTuCongTac() {
    if (!TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/cai-dat", "PUT", {
      timBangSDT: $("chkTimBangSDT").checked,
      laNhanTin: $("chkLaNhanTin").checked,
      laGoi: $("chkLaGoi").checked
    }, true).then(function (kq) {
      hienToast(kq.ok ? "Đã lưu cài đặt riêng tư 🔒" : (kq.loi || "Chưa lưu được cài đặt."));
    });
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
    capNhatManHinh();
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
      $("tomTatHoSo").classList.add("an");
      $("formHoSo").classList.remove("an");
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
      $("khuRiengTu").classList.add("an");
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
    $("inpTinNhan").addEventListener("keydown", function (ev) { if (ev.key === "Enter") guiTinSuKien(); });
    $("btnQuayLaiChat").addEventListener("click", function () { dongManChat(true); });
    $("btnChanTrongChat").addEventListener("click", chanTrongChatSuKien);
    $("btnDangBai").addEventListener("click", dangBaiSuKien);
    ["chkTimBangSDT", "chkLaNhanTin", "chkLaGoi"].forEach(function (idCongTac) {
      $(idCongTac).addEventListener("change", luuCaiDatTuCongTac);
    });
    var oTienIch = $("luoiTienIch").querySelectorAll("[data-tienich]");
    for (var ui = 0; ui < oTienIch.length; ui++) {
      oTienIch[ui].addEventListener("click", function () { moTienIch(this.getAttribute("data-tienich")); });
    }
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
