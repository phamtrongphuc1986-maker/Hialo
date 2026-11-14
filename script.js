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

// ================= GÓI 5: ĐA NGÔN NGỮ (i18n) =================
// Bảng chuỗi theo KHÓA cho 5 ngôn ngữ: vi (gốc) · en · tl (Tagalog) · id (Bahasa
// Indonesia) · th (ไทย). Phần tử HTML gắn data-i18n (nội dung) / data-i18n-ph
// (placeholder) / data-i18n-title (title) sẽ được apDungNgonNgu() quét và thay mỗi
// khi đổi ngôn ngữ — áp dụng ngay, không tải lại trang. Chuỗi thiếu ở một ngôn ngữ
// rơi về TIẾNG ANH rồi TIẾNG VIỆT (hàm trichChuoi) — không bao giờ hiện khóa thô.
// Ngôn ngữ đã chọn lưu ở máy (localStorage "hialo_ngon_ngu") VÀ trên máy chủ theo
// tài khoản (caiDat.ngonNgu) để đồng bộ đa thiết bị; chưa chọn lần nào thì suy từ
// ngôn ngữ trình duyệt. Ngôn ngữ đã chọn cũng là đích mặc định của nút Dịch (Gói 4).
var NGON_NGU_HOP_LE_G5 = ["vi", "en", "tl", "id", "th"];
var TEN_NGON_NGU_GOC = { vi: "Tiếng Việt", en: "English", tl: "Tagalog", id: "Bahasa Indonesia", th: "ไทย" };
var BANG_NGON_NGU = {
vi: {
  phu_de: "Tìm người ở gần bạn — theo giới tính, độ tuổi và khoảng cách",
  tim_kiem_ph: "Tìm trong HIALO: đăng nhập, chính sách, hỗ trợ…",
  tab_tinnhan: "Tin nhắn", tab_danhba: "Danh bạ", tab_khampha: "Khám phá", tab_tuongnha: "Tường nhà", tab_canhan: "Cá nhân",
  ho_so_tieu_de: "👤 Tài khoản & hồ sơ của tôi",
  nhan_sdt: "Số điện thoại của bạn",
  sdt_ph: "Ví dụ: 0912 345 678",
  mo_ta_sdt: "Đăng ký / đăng nhập bằng số điện thoại. Chỉ nhận <strong>số di động Việt Nam</strong> (10 số, đầu 03 / 05 / 07 / 08 / 09) — không nhận số bàn, số nước ngoài, số tổng đài 1900 / 1800.",
  btn_nhan_otp: "📩 Nhận mã OTP",
  nhan_otp: "Mã OTP", btn_xac_nhan: "✅ Xác nhận", btn_gui_lai: "Gửi lại mã", btn_doi_so: "← Đổi số điện thoại",
  hoac_tiep_tuc: "— hoặc tiếp tục bằng —", btn_dn_facebook: "Đăng nhập bằng Facebook",
  nhan_nick: "Nick (tên hiển thị)", nhan_gioi: "Giới tính", gioi_nam: "🧑 Nam", gioi_nu: "👩 Nữ",
  nhan_tuoi: "Tuổi", nhan_emoji: "Chọn 1 emoji làm ảnh đại diện",
  nhan_muc_dich: "Mục đích kết bạn", chua_chon: "— Chưa chọn —", tat_ca_muc_dich: "Tất cả mục đích",
  md_ket_ban: "🤝 Kết bạn", md_hen_ho: "💘 Hẹn hò", md_tro_chuyen: "💬 Trò chuyện", md_nguoi_yeu: "💍 Tìm người yêu",
  nhan_so_thich: "Sở thích (cách nhau bằng dấu phẩy, tối đa 10)", btn_luu_ho_so: "💾 Lưu hồ sơ",
  cai_dat: "Cài đặt", trang_thai_ph: "Trạng thái của bạn (tối đa 60 ký tự)", btn_luu: "💾 Lưu", btn_huy: "Hủy",
  hub_hcloud_mo: "Không gian lưu trữ dữ liệu trên đám mây", hub_hstyle_mo: "Hình nền và nhạc cho cuộc gọi Hialo",
  hub_tai_lieu: "Tài liệu của tôi", hub_tai_lieu_mo: "Tin nhắn và tệp quan trọng bạn đã lưu",
  hub_du_lieu: "Dữ liệu lưu trữ", hub_du_lieu_mo: "Dung lượng tệp bạn đã gửi",
  hub_viqr: "Ví QR", hub_viqr_mo: "Mã QR ngân hàng, ví điện tử của bạn",
  hub_taikhoan: "Tài khoản và bảo mật", hub_taikhoan_mo: "Hồ sơ, khóa PIN, phiên đăng nhập",
  hub_riengtu: "Quyền riêng tư", hub_riengtu_mo: "Ai tìm thấy, nhắn tin và gọi cho bạn",
  cd_tieu_de: "Cài đặt",
  cd_tin_nhan: "Tin nhắn", cd_tin_nhan_mo: "Cách gửi và hiển thị tin nhắn",
  cd_cuoc_goi: "Cuộc gọi", cd_cuoc_goi_mo: "Ai gọi được cho bạn, rung khi có cuộc gọi",
  cd_tuong_nha: "Tường nhà", cd_tuong_nha_mo: "Ai xem được tường nhà của bạn",
  cd_danh_ba: "Danh bạ", cd_danh_ba_mo: "Tìm bạn bằng số điện thoại, cách sắp xếp",
  cd_tien_ich: "Tiện ích", cd_tien_ich_mo: "Mã QR trong ảnh, thẻ ngân hàng, cách mở link",
  cd_giao_dien: "Giao diện và ngôn ngữ", cd_giao_dien_mo: "Sáng / tối, ngôn ngữ hiển thị",
  cd_thong_tin: "Thông tin về Hialo", cd_thong_tin_mo: "Phiên bản và giới thiệu ứng dụng",
  cd_ho_tro: "Liên hệ hỗ trợ", cd_ho_tro_mo: "Email hỗ trợ và câu hỏi thường gặp",
  cd_chuyen_tk: "Chuyển tài khoản", cd_chuyen_tk_mo: "Đăng nhập bằng số điện thoại khác",
  cd_xoa_tk: "Xóa tài khoản", cd_xoa_tk_mo: "Xóa vĩnh viễn tài khoản và dữ liệu của bạn",
  btn_dang_xuat: "Đăng xuất",
  cdtn_enter: "Nhấn Enter để gửi tin", cdtn_hien_gio: "Hiện giờ dưới mỗi tin nhắn",
  cdti_qr_anh: "Tự nhận diện mã QR trong ảnh", cdti_qr_the: "Hiện thẻ QR khi tin nhắn nhắc tài khoản ngân hàng",
  cdgoi_la: "Cho phép người lạ gọi", cdgoi_rung: "Rung khi có cuộc gọi đến",
  cdtn_tuong: "Chỉ bạn bè xem được tường nhà của tôi", cdtn_tb_tuong: "Thông báo khi có tương tác trên tường",
  gd_giao_dien: "Giao diện", gd_sang: "☀️ Sáng", gd_toi: "🌙 Tối", gd_ngon_ngu: "Ngôn ngữ / Language",
  gd_ngon_ngu_mo: "Đổi ngôn ngữ là áp dụng ngay, không cần tải lại trang. Lựa chọn được lưu theo tài khoản và đồng bộ sang mọi thiết bị bạn đăng nhập; ngôn ngữ này cũng là ngôn ngữ đích mặc định của nút Dịch trong trò chuyện.",
  rt_hien_thi: "Cho phép người khác tìm thấy tôi quanh đây",
  rt_tim_sdt: "Cho phép tìm tôi bằng số điện thoại",
  rt_la_tin: "Cho phép người lạ nhắn tin", rt_chi_ban_be: "Chỉ nhận tin từ bạn bè",
  rt_da_xem: "Hiện trạng thái \"Đã xem\" trong trò chuyện",
  rt_ds_chan: "🚫 Danh sách chặn", rt_chua_chan: "Bạn chưa chặn ai.", rt_quyen: "🧩 Quyền của tiện ích và ứng dụng",
  cddb_sap_xep: "Sắp xếp danh sách bạn bè", cddb_mac_dinh: "Mặc định (thứ tự kết bạn)", cddb_theo_ten: "Theo tên A → Z",
  tk_sdt_nhan: "Số điện thoại:", btn_sua_ho_so: "✏️ Sửa hồ sơ (tên hiển thị, ảnh đại diện)",
  tk_pin_tieu_de: "🔑 Khóa ứng dụng bằng PIN",
  nhan_pin_moi: "PIN mới", nhan_pin_moi2: "Nhập lại PIN mới", btn_bat_pin: "🔒 Bật khóa PIN",
  nhan_pin_cu: "PIN hiện tại", nhan_pin_doi: "PIN mới (chỉ khi muốn đổi)", btn_doi_pin: "Đổi PIN", btn_tat_pin: "Tắt khóa PIN",
  tk_phien_tieu_de: "🖥️ Phiên đăng nhập", tk_xacthuc_tieu_de: "🛡️ Xác thực hồ sơ", btn_gui_xacthuc: "📸 Gửi ảnh selfie xác thực",
  tk_btn_xoa: "🗑 Xóa tài khoản",
  tk_lien_ket_tieu_de: "🔗 Tài khoản liên kết",
  tk_lien_ket_mo: "Liên kết Google / Facebook để đăng nhập nhanh bằng cùng một tài khoản. Một tài khoản mạng xã hội chỉ liên kết được với một tài khoản HIALO.",
  tk_can_sdt: "Tài khoản này đăng nhập bằng mạng xã hội và chưa có số điện thoại — hãy bổ sung số điện thoại ở phần Hồ sơ nếu bạn muốn dùng các tính năng cần số điện thoại (như xác thực MO-SMS).",
  lk_chua: "Chưa liên kết", lk_da: "Đã liên kết", lk_khong_bat: "Chưa bật trên máy chủ", btn_lien_ket: "Liên kết", btn_huy_lien_ket: "Hủy liên kết",
  xac_nhan_huy_lk: "Hủy liên kết nhà cung cấp này khỏi tài khoản của bạn?",
  dang_nhap_xa_hoi: "Tài khoản mạng xã hội",
  kp_khoanh_khac: "📸 Khoảnh khắc", kp_kk_24h: "(tự biến mất sau 24 giờ)",
  btn_chon_anh: "🖼 Chọn ảnh", btn_bo_anh: "✕ Bỏ ảnh", kk_ph: "Viết đôi dòng cho khoảnh khắc này…",
  btn_dang_kk: "📸 Đăng khoảnh khắc", kp_thong_bao: "🔔 Thông báo",
  kp_tim: "🔎 Tìm quanh đây", btn_dinh_vi: "📍 Bật định vị & Tìm quanh đây",
  loc_gioi_tinh: "Tìm giới tính", loc_tat_ca: "Tất cả", loc_tuoi_tu: "Tuổi từ", loc_den: "đến",
  loc_km_tu: "Cách từ (km)", loc_den_km: "đến (km)",
  kp_ho_chieu: "🧳 Hộ chiếu — tìm ở vị trí khác", btn_ho_chieu: "🧳 Dùng vị trí hộ chiếu",
  btn_tim: "🔎 Tìm", kp_ket_qua: "💞 Kết quả quanh bạn", btn_luoi: "🔲 Dạng lưới", btn_thich: "❤️ Thích",
  kp_ghep_doi: "💞 Ghép đôi", btn_boost: "🚀 Boost hồ sơ 30 phút",
  kp_diem_danh: "🎁 Điểm danh & quà tặng", btn_diem_danh: "✅ Điểm danh hôm nay (+10 điểm)",
  kp_phong_thoai: "🎙️ Phòng thoại quanh bạn", btn_tao_phong_mo: "➕ Tạo phòng thoại",
  nhan_ten_phong: "Tên phòng", nhan_chu_de: "Chủ đề", btn_tao_phong: "🎙️ Tạo & vào phòng",
  kp_tien_ich: "🧭 Tiện ích",
  db_tim_sdt_tieu_de: "🔍 Tìm bạn bằng số điện thoại", nhan_tim_sdt: "Số điện thoại người bạn muốn tìm",
  db_loi_moi: "📩 Lời mời kết bạn", db_nguoi_quen: "📇 Người quen trong danh bạ máy",
  btn_quen_danh_ba: "📇 Xem người quen từ danh bạ máy", db_ban_be: "👥 Bạn bè",
  tn_tieu_de: "💬 Tin nhắn", quet_qr: "Quét mã QR", them_moi: "Thêm mới",
  tn_tao_nhom: "👥 Tạo nhóm", tn_them_ban: "➕ Thêm bạn", tn_quet_qr: "🔳 Quét mã QR", tn_ma_qr: "🪪 Mã QR của tôi",
  tn_cho: "📥 Tin nhắn chờ", tn_cho_trong: "Không có tin nhắn chờ nào.",
  goi_thoai: "Gọi thoại", goi_video: "Gọi video", bao_cao_nguoi_nay: "Báo cáo người này", btn_chan: "🚫 Chặn",
  gui_anh: "Gửi ảnh", gui_tep: "Gửi tệp hoặc video (tối đa 200 MB)", ghi_am: "Ghi âm tin nhắn thoại",
  tang_qua: "Tặng quà bằng điểm thưởng", gui_sticker: "Gửi sticker",
  tuhuy_tat: "⏳ Tự huỷ: Tắt", tuhuy_10s: "💨 10 giây", tuhuy_1p: "💨 1 phút", tuhuy_1h: "💨 1 giờ",
  inp_tin_ph: "Nhập tin nhắn…", inp_tin_nhom_ph: "Nhắn tin tới nhóm…", btn_gui: "Gửi ➤", btn_gui_am: "Gửi 🎤",
  dich: "🌐 Dịch", dang_dich: "Đang dịch…", da_xem: "✓✓ Đã xem", dang_nhap_lbl: "đang nhập…",
  ban_dich: "🌐 Bản dịch",
  tuong_tieu_de: "🏠 Tường nhà", tuong_dang_moi: "Đăng bài mới", tuong_ph: "Bạn đang nghĩ gì? (tối đa 500 ký tự)",
  btn_dang_bai: "📝 Đăng bài",
  quet_qr_tieu_de: "🔳 Quét mã QR", btn_dong: "✕ Đóng",
  da_doi_ngon_ngu: "Đã đổi ngôn ngữ hiển thị.",
  loi_xa_hoi: "Chưa đăng nhập được bằng mạng xã hội — thử lại sau nhé."
},
en: {
  phu_de: "Find people near you — by gender, age and distance",
  tim_kiem_ph: "Search HIALO: sign-in, policies, support…",
  tab_tinnhan: "Messages", tab_danhba: "Contacts", tab_khampha: "Explore", tab_tuongnha: "Wall", tab_canhan: "Profile",
  ho_so_tieu_de: "👤 My account & profile",
  nhan_sdt: "Your phone number",
  sdt_ph: "E.g.: 0912 345 678",
  mo_ta_sdt: "Register / sign in with your phone number. Only <strong>Vietnamese mobile numbers</strong> are accepted (10 digits, starting 03 / 05 / 07 / 08 / 09) — no landlines, foreign numbers or 1900 / 1800 hotlines.",
  btn_nhan_otp: "📩 Get OTP code",
  nhan_otp: "OTP code", btn_xac_nhan: "✅ Confirm", btn_gui_lai: "Resend code", btn_doi_so: "← Change phone number",
  hoac_tiep_tuc: "— or continue with —", btn_dn_facebook: "Continue with Facebook",
  nhan_nick: "Nickname (display name)", nhan_gioi: "Gender", gioi_nam: "🧑 Male", gioi_nu: "👩 Female",
  nhan_tuoi: "Age", nhan_emoji: "Pick 1 emoji as your avatar",
  nhan_muc_dich: "Purpose", chua_chon: "— Not selected —", tat_ca_muc_dich: "All purposes",
  md_ket_ban: "🤝 Make friends", md_hen_ho: "💘 Dating", md_tro_chuyen: "💬 Chat", md_nguoi_yeu: "💍 Find a partner",
  nhan_so_thich: "Interests (comma separated, max 10)", btn_luu_ho_so: "💾 Save profile",
  cai_dat: "Settings", trang_thai_ph: "Your status (max 60 characters)", btn_luu: "💾 Save", btn_huy: "Cancel",
  hub_hcloud_mo: "Your cloud data storage", hub_hstyle_mo: "Wallpapers and music for Hialo calls",
  hub_tai_lieu: "My documents", hub_tai_lieu_mo: "Important messages and files you saved",
  hub_du_lieu: "Storage data", hub_du_lieu_mo: "Size of files you have sent",
  hub_viqr: "QR wallet", hub_viqr_mo: "Your bank and e-wallet QR codes",
  hub_taikhoan: "Account & security", hub_taikhoan_mo: "Profile, PIN lock, sign-in sessions",
  hub_riengtu: "Privacy", hub_riengtu_mo: "Who can find, message and call you",
  cd_tieu_de: "Settings",
  cd_tin_nhan: "Messages", cd_tin_nhan_mo: "How messages are sent and shown",
  cd_cuoc_goi: "Calls", cd_cuoc_goi_mo: "Who can call you, vibrate on incoming calls",
  cd_tuong_nha: "Wall", cd_tuong_nha_mo: "Who can see your wall",
  cd_danh_ba: "Contacts", cd_danh_ba_mo: "Find friends by phone number, sorting",
  cd_tien_ich: "Utilities", cd_tien_ich_mo: "QR codes in photos, bank cards, how links open",
  cd_giao_dien: "Appearance & language", cd_giao_dien_mo: "Light / dark, display language",
  cd_thong_tin: "About Hialo", cd_thong_tin_mo: "App version and introduction",
  cd_ho_tro: "Contact support", cd_ho_tro_mo: "Support email and FAQs",
  cd_chuyen_tk: "Switch account", cd_chuyen_tk_mo: "Sign in with a different phone number",
  cd_xoa_tk: "Delete account", cd_xoa_tk_mo: "Permanently delete your account and data",
  btn_dang_xuat: "Log out",
  cdtn_enter: "Press Enter to send", cdtn_hien_gio: "Show time under each message",
  cdti_qr_anh: "Auto-detect QR codes in photos", cdti_qr_the: "Show a QR card when a message mentions a bank account",
  cdgoi_la: "Allow calls from strangers", cdgoi_rung: "Vibrate on incoming calls",
  cdtn_tuong: "Only friends can see my wall", cdtn_tb_tuong: "Notify me about wall interactions",
  gd_giao_dien: "Appearance", gd_sang: "☀️ Light", gd_toi: "🌙 Dark", gd_ngon_ngu: "Language / Ngôn ngữ",
  gd_ngon_ngu_mo: "Changing the language applies instantly, with no reload. Your choice is saved to your account and synced to every device you sign in on; it is also the default target language of the Translate button in chats.",
  rt_hien_thi: "Let others find me nearby",
  rt_tim_sdt: "Let others find me by phone number",
  rt_la_tin: "Allow messages from strangers", rt_chi_ban_be: "Only receive messages from friends",
  rt_da_xem: "Show \"Seen\" status in chats",
  rt_ds_chan: "🚫 Blocked list", rt_chua_chan: "You have not blocked anyone.", rt_quyen: "🧩 Utility & app permissions",
  cddb_sap_xep: "Sort friend list", cddb_mac_dinh: "Default (friend order)", cddb_theo_ten: "By name A → Z",
  tk_sdt_nhan: "Phone number:", btn_sua_ho_so: "✏️ Edit profile (display name, avatar)",
  tk_pin_tieu_de: "🔑 App lock with PIN",
  nhan_pin_moi: "New PIN", nhan_pin_moi2: "Re-enter new PIN", btn_bat_pin: "🔒 Turn on PIN lock",
  nhan_pin_cu: "Current PIN", nhan_pin_doi: "New PIN (only if changing)", btn_doi_pin: "Change PIN", btn_tat_pin: "Turn off PIN lock",
  tk_phien_tieu_de: "🖥️ Sign-in sessions", tk_xacthuc_tieu_de: "🛡️ Profile verification", btn_gui_xacthuc: "📸 Send a verification selfie",
  tk_btn_xoa: "🗑 Delete account",
  tk_lien_ket_tieu_de: "🔗 Linked accounts",
  tk_lien_ket_mo: "Link Google / Facebook for quick sign-in with the same account. One social account can only be linked to one HIALO account.",
  tk_can_sdt: "This account signed in with a social account and has no phone number yet — add your phone number in Profile if you want features that need one (such as MO-SMS verification).",
  lk_chua: "Not linked", lk_da: "Linked", lk_khong_bat: "Not enabled on the server", btn_lien_ket: "Link", btn_huy_lien_ket: "Unlink",
  xac_nhan_huy_lk: "Unlink this provider from your account?",
  dang_nhap_xa_hoi: "Social account",
  kp_khoanh_khac: "📸 Moments", kp_kk_24h: "(disappear after 24 hours)",
  btn_chon_anh: "🖼 Choose photo", btn_bo_anh: "✕ Remove photo", kk_ph: "Write a few words for this moment…",
  btn_dang_kk: "📸 Post moment", kp_thong_bao: "🔔 Notifications",
  kp_tim: "🔎 Find nearby", btn_dinh_vi: "📍 Turn on location & Find nearby",
  loc_gioi_tinh: "Looking for", loc_tat_ca: "Everyone", loc_tuoi_tu: "Age from", loc_den: "to",
  loc_km_tu: "From (km)", loc_den_km: "to (km)",
  kp_ho_chieu: "🧳 Passport — search at another place", btn_ho_chieu: "🧳 Use passport location",
  btn_tim: "🔎 Search", kp_ket_qua: "💞 People near you", btn_luoi: "🔲 Grid view", btn_thich: "❤️ Like",
  kp_ghep_doi: "💞 Match", btn_boost: "🚀 Boost profile for 30 minutes",
  kp_diem_danh: "🎁 Check-in & gifts", btn_diem_danh: "✅ Check in today (+10 points)",
  kp_phong_thoai: "🎙️ Voice rooms near you", btn_tao_phong_mo: "➕ Create a voice room",
  nhan_ten_phong: "Room name", nhan_chu_de: "Topic", btn_tao_phong: "🎙️ Create & join room",
  kp_tien_ich: "🧭 Utilities",
  db_tim_sdt_tieu_de: "🔍 Find friends by phone number", nhan_tim_sdt: "Phone number of the friend you want to find",
  db_loi_moi: "📩 Friend requests", db_nguoi_quen: "📇 People in your phone contacts",
  btn_quen_danh_ba: "📇 See people from phone contacts", db_ban_be: "👥 Friends",
  tn_tieu_de: "💬 Messages", quet_qr: "Scan QR code", them_moi: "Add new",
  tn_tao_nhom: "👥 Create group", tn_them_ban: "➕ Add friend", tn_quet_qr: "🔳 Scan QR code", tn_ma_qr: "🪪 My QR code",
  tn_cho: "📥 Message requests", tn_cho_trong: "No message requests.",
  goi_thoai: "Voice call", goi_video: "Video call", bao_cao_nguoi_nay: "Report this person", btn_chan: "🚫 Block",
  gui_anh: "Send photo", gui_tep: "Send file or video (max 200 MB)", ghi_am: "Record a voice message",
  tang_qua: "Send a gift with reward points", gui_sticker: "Send sticker",
  tuhuy_tat: "⏳ Self-destruct: Off", tuhuy_10s: "💨 10 seconds", tuhuy_1p: "💨 1 minute", tuhuy_1h: "💨 1 hour",
  inp_tin_ph: "Type a message…", inp_tin_nhom_ph: "Message the group…", btn_gui: "Send ➤", btn_gui_am: "Send 🎤",
  dich: "🌐 Translate", dang_dich: "Translating…", da_xem: "✓✓ Seen", dang_nhap_lbl: "is typing…",
  ban_dich: "🌐 Translation",
  tuong_tieu_de: "🏠 Wall", tuong_dang_moi: "New post", tuong_ph: "What's on your mind? (max 500 characters)",
  btn_dang_bai: "📝 Post",
  quet_qr_tieu_de: "🔳 Scan QR code", btn_dong: "✕ Close",
  da_doi_ngon_ngu: "Display language changed.",
  loi_xa_hoi: "Could not sign in with the social account — please try again later."
},
tl: {
  phu_de: "Maghanap ng mga taong malapit sa iyo — ayon sa kasarian, edad at distansya",
  tim_kiem_ph: "Maghanap sa HIALO: pag-sign in, mga patakaran, suporta…",
  tab_tinnhan: "Mga Mensahe", tab_danhba: "Mga Contact", tab_khampha: "Tuklasin", tab_tuongnha: "Wall", tab_canhan: "Profile",
  ho_so_tieu_de: "👤 Ang aking account at profile",
  nhan_sdt: "Ang iyong numero ng telepono",
  sdt_ph: "Hal.: 0912 345 678",
  mo_ta_sdt: "Magrehistro / mag-sign in gamit ang numero ng telepono. <strong>Mga mobile number ng Vietnam</strong> lang ang tinatanggap (10 numero, nagsisimula sa 03 / 05 / 07 / 08 / 09) — hindi tinatanggap ang landline, banyagang numero o hotline na 1900 / 1800.",
  btn_nhan_otp: "📩 Kumuha ng OTP code",
  nhan_otp: "OTP code", btn_xac_nhan: "✅ Kumpirmahin", btn_gui_lai: "Ipadala ulit ang code", btn_doi_so: "← Palitan ang numero",
  hoac_tiep_tuc: "— o magpatuloy gamit ang —", btn_dn_facebook: "Magpatuloy gamit ang Facebook",
  nhan_nick: "Nickname (display name)", nhan_gioi: "Kasarian", gioi_nam: "🧑 Lalaki", gioi_nu: "👩 Babae",
  nhan_tuoi: "Edad", nhan_emoji: "Pumili ng 1 emoji bilang avatar",
  nhan_muc_dich: "Layunin", chua_chon: "— Wala pang napili —", tat_ca_muc_dich: "Lahat ng layunin",
  md_ket_ban: "🤝 Makipagkaibigan", md_hen_ho: "💘 Pakikipag-date", md_tro_chuyen: "💬 Makipag-chat", md_nguoi_yeu: "💍 Maghanap ng karelasyon",
  nhan_so_thich: "Mga interes (paghiwalayin ng kuwit, max 10)", btn_luu_ho_so: "💾 I-save ang profile",
  cai_dat: "Mga Setting", trang_thai_ph: "Ang iyong status (max 60 karakter)", btn_luu: "💾 I-save", btn_huy: "Kanselahin",
  hub_hcloud_mo: "Ang iyong cloud data storage", hub_hstyle_mo: "Mga wallpaper at musika para sa mga tawag sa Hialo",
  hub_tai_lieu: "Aking mga dokumento", hub_tai_lieu_mo: "Mahahalagang mensahe at file na na-save mo",
  hub_du_lieu: "Data ng storage", hub_du_lieu_mo: "Laki ng mga file na naipadala mo",
  hub_viqr: "QR wallet", hub_viqr_mo: "Mga QR code ng bangko at e-wallet mo",
  hub_taikhoan: "Account at seguridad", hub_taikhoan_mo: "Profile, PIN lock, mga session ng pag-sign in",
  hub_riengtu: "Privacy", hub_riengtu_mo: "Sino ang makakahanap, makaka-mensahe at makakatawag sa iyo",
  cd_tieu_de: "Mga Setting",
  cd_tin_nhan: "Mga Mensahe", cd_tin_nhan_mo: "Paano ipinapadala at ipinapakita ang mga mensahe",
  cd_cuoc_goi: "Mga Tawag", cd_cuoc_goi_mo: "Sino ang makakatawag sa iyo, vibrate sa tawag",
  cd_tuong_nha: "Wall", cd_tuong_nha_mo: "Sino ang makakakita sa wall mo",
  cd_danh_ba: "Mga Contact", cd_danh_ba_mo: "Maghanap ng kaibigan gamit ang numero, pag-sort",
  cd_tien_ich: "Mga Utility", cd_tien_ich_mo: "QR code sa mga larawan, bank card, paano bumubukas ang link",
  cd_giao_dien: "Hitsura at wika", cd_giao_dien_mo: "Maliwanag / madilim, wika ng display",
  cd_thong_tin: "Tungkol sa Hialo", cd_thong_tin_mo: "Bersyon ng app at pagpapakilala",
  cd_ho_tro: "Makipag-ugnayan sa suporta", cd_ho_tro_mo: "Email ng suporta at mga FAQ",
  cd_chuyen_tk: "Magpalit ng account", cd_chuyen_tk_mo: "Mag-sign in gamit ang ibang numero",
  cd_xoa_tk: "Burahin ang account", cd_xoa_tk_mo: "Permanenteng burahin ang account at data mo",
  btn_dang_xuat: "Mag-log out",
  cdtn_enter: "Pindutin ang Enter para magpadala", cdtn_hien_gio: "Ipakita ang oras sa ilalim ng bawat mensahe",
  cdti_qr_anh: "Awtomatikong kilalanin ang QR code sa mga larawan", cdti_qr_the: "Magpakita ng QR card kapag may binanggit na bank account ang mensahe",
  cdgoi_la: "Payagan ang tawag mula sa hindi kakilala", cdgoi_rung: "Mag-vibrate kapag may papasok na tawag",
  cdtn_tuong: "Mga kaibigan lang ang makakakita sa wall ko", cdtn_tb_tuong: "Abisuhan ako tungkol sa mga interaksyon sa wall",
  gd_giao_dien: "Hitsura", gd_sang: "☀️ Maliwanag", gd_toi: "🌙 Madilim", gd_ngon_ngu: "Wika / Language",
  gd_ngon_ngu_mo: "Agad naa-apply ang pagpapalit ng wika, hindi kailangang i-reload. Naka-save ang pinili mo sa account mo at naka-sync sa lahat ng device na pinag-sign-in-an mo; ito rin ang default na target na wika ng Translate button sa mga chat.",
  rt_hien_thi: "Payagan ang iba na makita ako sa malapit",
  rt_tim_sdt: "Payagan ang iba na makita ako gamit ang numero ng telepono",
  rt_la_tin: "Payagan ang mensahe mula sa hindi kakilala", rt_chi_ban_be: "Tumatanggap lang ng mensahe mula sa mga kaibigan",
  rt_da_xem: "Ipakita ang status na \"Nakita na\" sa mga chat",
  rt_ds_chan: "🚫 Listahan ng naka-block", rt_chua_chan: "Wala ka pang naba-block.", rt_quyen: "🧩 Mga pahintulot ng utility at app",
  cddb_sap_xep: "Ayusin ang listahan ng kaibigan", cddb_mac_dinh: "Default (ay ayon sa pagkakaibigan)", cddb_theo_ten: "Ayon sa pangalan A → Z",
  tk_sdt_nhan: "Numero ng telepono:", btn_sua_ho_so: "✏️ I-edit ang profile (display name, avatar)",
  tk_pin_tieu_de: "🔑 I-lock ang app gamit ang PIN",
  nhan_pin_moi: "Bagong PIN", nhan_pin_moi2: "I-type ulit ang bagong PIN", btn_bat_pin: "🔒 I-on ang PIN lock",
  nhan_pin_cu: "Kasalukuyang PIN", nhan_pin_doi: "Bagong PIN (kung papalitan lang)", btn_doi_pin: "Palitan ang PIN", btn_tat_pin: "I-off ang PIN lock",
  tk_phien_tieu_de: "🖥️ Mga session ng pag-sign in", tk_xacthuc_tieu_de: "🛡️ Pag-verify ng profile", btn_gui_xacthuc: "📸 Magpadala ng selfie para sa verification",
  tk_btn_xoa: "🗑 Burahin ang account",
  tk_lien_ket_tieu_de: "🔗 Mga naka-link na account",
  tk_lien_ket_mo: "I-link ang Google / Facebook para mabilis na makapag-sign in gamit ang parehong account. Isang social account lang ang puwedeng i-link sa isang HIALO account.",
  tk_can_sdt: "Naka-sign in ang account na ito gamit ang social account at wala pang numero ng telepono — idagdag ang numero mo sa Profile kung gusto mong gumamit ng mga feature na nangangailangan nito (tulad ng MO-SMS verification).",
  lk_chua: "Hindi pa naka-link", lk_da: "Naka-link na", lk_khong_bat: "Hindi pa naka-on sa server", btn_lien_ket: "I-link", btn_huy_lien_ket: "I-unlink",
  xac_nhan_huy_lk: "I-unlink ang provider na ito sa account mo?",
  dang_nhap_xa_hoi: "Social account",
  kp_khoanh_khac: "📸 Mga Moment", kp_kk_24h: "(nawawala pagkalipas ng 24 oras)",
  btn_chon_anh: "🖼 Pumili ng larawan", btn_bo_anh: "✕ Alisin ang larawan", kk_ph: "Magsulat ng ilang salita para sa moment na ito…",
  btn_dang_kk: "📸 I-post ang moment", kp_thong_bao: "🔔 Mga Abiso",
  kp_tim: "🔎 Maghanap sa malapit", btn_dinh_vi: "📍 I-on ang lokasyon at Maghanap sa malapit",
  loc_gioi_tinh: "Hinahanap", loc_tat_ca: "Lahat", loc_tuoi_tu: "Edad mula", loc_den: "hanggang",
  loc_km_tu: "Mula (km)", loc_den_km: "hanggang (km)",
  kp_ho_chieu: "🧳 Passport — maghanap sa ibang lugar", btn_ho_chieu: "🧳 Gamitin ang lokasyon ng passport",
  btn_tim: "🔎 Maghanap", kp_ket_qua: "💞 Mga tao sa paligid mo", btn_luoi: "🔲 Grid view", btn_thich: "❤️ I-like",
  kp_ghep_doi: "💞 Match", btn_boost: "🚀 I-boost ang profile sa loob ng 30 minuto",
  kp_diem_danh: "🎁 Check-in at mga regalo", btn_diem_danh: "✅ Mag-check in ngayon (+10 puntos)",
  kp_phong_thoai: "🎙️ Mga voice room sa paligid mo", btn_tao_phong_mo: "➕ Gumawa ng voice room",
  nhan_ten_phong: "Pangalan ng room", nhan_chu_de: "Paksa", btn_tao_phong: "🎙️ Gumawa at sumali sa room",
  kp_tien_ich: "🧭 Mga Utility",
  db_tim_sdt_tieu_de: "🔍 Maghanap ng kaibigan gamit ang numero", nhan_tim_sdt: "Numero ng teleponong ng kaibigang hinahanap mo",
  db_loi_moi: "📩 Mga friend request", db_nguoi_quen: "📇 Mga tao sa contacts ng telepono mo",
  btn_quen_danh_ba: "📇 Tingnan ang mga tao mula sa contacts", db_ban_be: "👥 Mga Kaibigan",
  tn_tieu_de: "💬 Mga Mensahe", quet_qr: "Mag-scan ng QR code", them_moi: "Magdagdag",
  tn_tao_nhom: "👥 Gumawa ng grupo", tn_them_ban: "➕ Magdagdag ng kaibigan", tn_quet_qr: "🔳 Mag-scan ng QR code", tn_ma_qr: "🪪 QR code ko",
  tn_cho: "📥 Mga message request", tn_cho_trong: "Walang message request.",
  goi_thoai: "Voice call", goi_video: "Video call", bao_cao_nguoi_nay: "I-report ang taong ito", btn_chan: "🚫 I-block",
  gui_anh: "Magpadala ng larawan", gui_tep: "Magpadala ng file o video (max 200 MB)", ghi_am: "Mag-record ng voice message",
  tang_qua: "Magpadala ng regalo gamit ang reward points", gui_sticker: "Magpadala ng sticker",
  tuhuy_tat: "⏳ Self-destruct: Naka-off", tuhuy_10s: "💨 10 segundo", tuhuy_1p: "💨 1 minuto", tuhuy_1h: "💨 1 oras",
  inp_tin_ph: "Mag-type ng mensahe…", inp_tin_nhom_ph: "Mag-mensahe sa grupo…", btn_gui: "Ipadala ➤", btn_gui_am: "Ipadala 🎤",
  dich: "🌐 Isalin", dang_dich: "Isinasalin…", da_xem: "✓✓ Nakita na", dang_nhap_lbl: "ay nagta-type…",
  ban_dich: "🌐 Salin",
  tuong_tieu_de: "🏠 Wall", tuong_dang_moi: "Bagong post", tuong_ph: "Ano ang nasa isip mo? (max 500 karakter)",
  btn_dang_bai: "📝 I-post",
  quet_qr_tieu_de: "🔳 Mag-scan ng QR code", btn_dong: "✕ Isara",
  da_doi_ngon_ngu: "Napalitan na ang wika ng display.",
  loi_xa_hoi: "Hindi nakapag-sign in gamit ang social account — subukan ulit mamaya."
},
id: {
  phu_de: "Temukan orang di dekat Anda — berdasarkan jenis kelamin, usia, dan jarak",
  tim_kiem_ph: "Cari di HIALO: masuk, kebijakan, dukungan…",
  tab_tinnhan: "Pesan", tab_danhba: "Kontak", tab_khampha: "Jelajahi", tab_tuongnha: "Dinding", tab_canhan: "Profil",
  ho_so_tieu_de: "👤 Akun & profil saya",
  nhan_sdt: "Nomor telepon Anda",
  sdt_ph: "Contoh: 0912 345 678",
  mo_ta_sdt: "Daftar / masuk dengan nomor telepon. Hanya <strong>nomor ponsel Vietnam</strong> yang diterima (10 digit, awalan 03 / 05 / 07 / 08 / 09) — bukan nomor rumah, nomor luar negeri, atau hotline 1900 / 1800.",
  btn_nhan_otp: "📩 Minta kode OTP",
  nhan_otp: "Kode OTP", btn_xac_nhan: "✅ Konfirmasi", btn_gui_lai: "Kirim ulang kode", btn_doi_so: "← Ganti nomor telepon",
  hoac_tiep_tuc: "— atau lanjutkan dengan —", btn_dn_facebook: "Lanjutkan dengan Facebook",
  nhan_nick: "Nama panggilan (nama tampilan)", nhan_gioi: "Jenis kelamin", gioi_nam: "🧑 Pria", gioi_nu: "👩 Wanita",
  nhan_tuoi: "Usia", nhan_emoji: "Pilih 1 emoji sebagai avatar",
  nhan_muc_dich: "Tujuan", chua_chon: "— Belum dipilih —", tat_ca_muc_dich: "Semua tujuan",
  md_ket_ban: "🤝 Berteman", md_hen_ho: "💘 Kencan", md_tro_chuyen: "💬 Mengobrol", md_nguoi_yeu: "💍 Cari pasangan",
  nhan_so_thich: "Minat (pisahkan dengan koma, maks 10)", btn_luu_ho_so: "💾 Simpan profil",
  cai_dat: "Pengaturan", trang_thai_ph: "Status Anda (maks 60 karakter)", btn_luu: "💾 Simpan", btn_huy: "Batal",
  hub_hcloud_mo: "Penyimpanan data cloud Anda", hub_hstyle_mo: "Wallpaper dan musik untuk panggilan Hialo",
  hub_tai_lieu: "Dokumen saya", hub_tai_lieu_mo: "Pesan dan file penting yang Anda simpan",
  hub_du_lieu: "Data penyimpanan", hub_du_lieu_mo: "Ukuran file yang telah Anda kirim",
  hub_viqr: "Dompet QR", hub_viqr_mo: "Kode QR bank dan e-wallet Anda",
  hub_taikhoan: "Akun & keamanan", hub_taikhoan_mo: "Profil, kunci PIN, sesi masuk",
  hub_riengtu: "Privasi", hub_riengtu_mo: "Siapa yang dapat menemukan, mengirim pesan, dan menelepon Anda",
  cd_tieu_de: "Pengaturan",
  cd_tin_nhan: "Pesan", cd_tin_nhan_mo: "Cara pesan dikirim dan ditampilkan",
  cd_cuoc_goi: "Panggilan", cd_cuoc_goi_mo: "Siapa yang dapat menelepon Anda, getar saat panggilan masuk",
  cd_tuong_nha: "Dinding", cd_tuong_nha_mo: "Siapa yang dapat melihat dinding Anda",
  cd_danh_ba: "Kontak", cd_danh_ba_mo: "Cari teman dengan nomor telepon, pengurutan",
  cd_tien_ich: "Utilitas", cd_tien_ich_mo: "Kode QR dalam foto, kartu bank, cara tautan dibuka",
  cd_giao_dien: "Tampilan & bahasa", cd_giao_dien_mo: "Terang / gelap, bahasa tampilan",
  cd_thong_tin: "Tentang Hialo", cd_thong_tin_mo: "Versi aplikasi dan perkenalan",
  cd_ho_tro: "Hubungi dukungan", cd_ho_tro_mo: "Email dukungan dan FAQ",
  cd_chuyen_tk: "Ganti akun", cd_chuyen_tk_mo: "Masuk dengan nomor telepon lain",
  cd_xoa_tk: "Hapus akun", cd_xoa_tk_mo: "Hapus akun dan data Anda secara permanen",
  btn_dang_xuat: "Keluar",
  cdtn_enter: "Tekan Enter untuk mengirim", cdtn_hien_gio: "Tampilkan waktu di bawah setiap pesan",
  cdti_qr_anh: "Deteksi otomatis kode QR dalam foto", cdti_qr_the: "Tampilkan kartu QR saat pesan menyebut rekening bank",
  cdgoi_la: "Izinkan panggilan dari orang asing", cdgoi_rung: "Bergetar saat panggilan masuk",
  cdtn_tuong: "Hanya teman yang dapat melihat dinding saya", cdtn_tb_tuong: "Beritahu saya tentang interaksi di dinding",
  gd_giao_dien: "Tampilan", gd_sang: "☀️ Terang", gd_toi: "🌙 Gelap", gd_ngon_ngu: "Bahasa / Language",
  gd_ngon_ngu_mo: "Mengganti bahasa langsung diterapkan tanpa memuat ulang. Pilihan Anda disimpan ke akun dan disinkronkan ke semua perangkat tempat Anda masuk; bahasa ini juga menjadi bahasa tujuan bawaan tombol Terjemahkan di obrolan.",
  rt_hien_thi: "Izinkan orang lain menemukan saya di sekitar",
  rt_tim_sdt: "Izinkan orang lain menemukan saya lewat nomor telepon",
  rt_la_tin: "Izinkan pesan dari orang asing", rt_chi_ban_be: "Hanya terima pesan dari teman",
  rt_da_xem: "Tampilkan status \"Dilihat\" di obrolan",
  rt_ds_chan: "🚫 Daftar blokir", rt_chua_chan: "Anda belum memblokir siapa pun.", rt_quyen: "🧩 Izin utilitas & aplikasi",
  cddb_sap_xep: "Urutkan daftar teman", cddb_mac_dinh: "Bawaan (urutan pertemanan)", cddb_theo_ten: "Berdasarkan nama A → Z",
  tk_sdt_nhan: "Nomor telepon:", btn_sua_ho_so: "✏️ Edit profil (nama tampilan, avatar)",
  tk_pin_tieu_de: "🔑 Kunci aplikasi dengan PIN",
  nhan_pin_moi: "PIN baru", nhan_pin_moi2: "Masukkan ulang PIN baru", btn_bat_pin: "🔒 Aktifkan kunci PIN",
  nhan_pin_cu: "PIN saat ini", nhan_pin_doi: "PIN baru (hanya jika ingin mengganti)", btn_doi_pin: "Ganti PIN", btn_tat_pin: "Matikan kunci PIN",
  tk_phien_tieu_de: "🖥️ Sesi masuk", tk_xacthuc_tieu_de: "🛡️ Verifikasi profil", btn_gui_xacthuc: "📸 Kirim selfie verifikasi",
  tk_btn_xoa: "🗑 Hapus akun",
  tk_lien_ket_tieu_de: "🔗 Akun tertaut",
  tk_lien_ket_mo: "Tautkan Google / Facebook untuk masuk cepat dengan akun yang sama. Satu akun sosial hanya dapat ditautkan ke satu akun HIALO.",
  tk_can_sdt: "Akun ini masuk dengan akun sosial dan belum memiliki nomor telepon — tambahkan nomor Anda di Profil jika ingin memakai fitur yang memerlukannya (seperti verifikasi MO-SMS).",
  lk_chua: "Belum tertaut", lk_da: "Sudah tertaut", lk_khong_bat: "Belum diaktifkan di server", btn_lien_ket: "Tautkan", btn_huy_lien_ket: "Lepaskan",
  xac_nhan_huy_lk: "Lepaskan penyedia ini dari akun Anda?",
  dang_nhap_xa_hoi: "Akun sosial",
  kp_khoanh_khac: "📸 Momen", kp_kk_24h: "(hilang setelah 24 jam)",
  btn_chon_anh: "🖼 Pilih foto", btn_bo_anh: "✕ Hapus foto", kk_ph: "Tulis beberapa kata untuk momen ini…",
  btn_dang_kk: "📸 Posting momen", kp_thong_bao: "🔔 Notifikasi",
  kp_tim: "🔎 Cari di sekitar", btn_dinh_vi: "📍 Aktifkan lokasi & Cari di sekitar",
  loc_gioi_tinh: "Mencari", loc_tat_ca: "Semua", loc_tuoi_tu: "Usia dari", loc_den: "sampai",
  loc_km_tu: "Dari (km)", loc_den_km: "sampai (km)",
  kp_ho_chieu: "🧳 Paspor — cari di tempat lain", btn_ho_chieu: "🧳 Gunakan lokasi paspor",
  btn_tim: "🔎 Cari", kp_ket_qua: "💞 Orang di sekitar Anda", btn_luoi: "🔲 Tampilan grid", btn_thich: "❤️ Suka",
  kp_ghep_doi: "💞 Pasangan", btn_boost: "🚀 Boost profil selama 30 menit",
  kp_diem_danh: "🎁 Check-in & hadiah", btn_diem_danh: "✅ Check-in hari ini (+10 poin)",
  kp_phong_thoai: "🎙️ Ruang suara di sekitar Anda", btn_tao_phong_mo: "➕ Buat ruang suara",
  nhan_ten_phong: "Nama ruang", nhan_chu_de: "Topik", btn_tao_phong: "🎙️ Buat & masuk ruang",
  kp_tien_ich: "🧭 Utilitas",
  db_tim_sdt_tieu_de: "🔍 Cari teman dengan nomor telepon", nhan_tim_sdt: "Nomor telepon teman yang ingin Anda cari",
  db_loi_moi: "📩 Permintaan pertemanan", db_nguoi_quen: "📇 Orang di kontak telepon Anda",
  btn_quen_danh_ba: "📇 Lihat orang dari kontak telepon", db_ban_be: "👥 Teman",
  tn_tieu_de: "💬 Pesan", quet_qr: "Pindai kode QR", them_moi: "Tambah baru",
  tn_tao_nhom: "👥 Buat grup", tn_them_ban: "➕ Tambah teman", tn_quet_qr: "🔳 Pindai kode QR", tn_ma_qr: "🪪 Kode QR saya",
  tn_cho: "📥 Permintaan pesan", tn_cho_trong: "Tidak ada permintaan pesan.",
  goi_thoai: "Panggilan suara", goi_video: "Panggilan video", bao_cao_nguoi_nay: "Laporkan orang ini", btn_chan: "🚫 Blokir",
  gui_anh: "Kirim foto", gui_tep: "Kirim file atau video (maks 200 MB)", ghi_am: "Rekam pesan suara",
  tang_qua: "Kirim hadiah dengan poin hadiah", gui_sticker: "Kirim stiker",
  tuhuy_tat: "⏳ Hancur sendiri: Mati", tuhuy_10s: "💨 10 detik", tuhuy_1p: "💨 1 menit", tuhuy_1h: "💨 1 jam",
  inp_tin_ph: "Ketik pesan…", inp_tin_nhom_ph: "Pesan ke grup…", btn_gui: "Kirim ➤", btn_gui_am: "Kirim 🎤",
  dich: "🌐 Terjemahkan", dang_dich: "Menerjemahkan…", da_xem: "✓✓ Dilihat", dang_nhap_lbl: "sedang mengetik…",
  ban_dich: "🌐 Terjemahan",
  tuong_tieu_de: "🏠 Dinding", tuong_dang_moi: "Postingan baru", tuong_ph: "Apa yang Anda pikirkan? (maks 500 karakter)",
  btn_dang_bai: "📝 Posting",
  quet_qr_tieu_de: "🔳 Pindai kode QR", btn_dong: "✕ Tutup",
  da_doi_ngon_ngu: "Bahasa tampilan telah diubah.",
  loi_xa_hoi: "Tidak dapat masuk dengan akun sosial — coba lagi nanti."
},
th: {
  phu_de: "ค้นหาผู้คนใกล้ตัวคุณ — ตามเพศ อายุ และระยะทาง",
  tim_kiem_ph: "ค้นหาใน HIALO: การเข้าสู่ระบบ นโยบาย การสนับสนุน…",
  tab_tinnhan: "ข้อความ", tab_danhba: "รายชื่อ", tab_khampha: "สำรวจ", tab_tuongnha: "วอลล์", tab_canhan: "โปรไฟล์",
  ho_so_tieu_de: "👤 บัญชีและโปรไฟล์ของฉัน",
  nhan_sdt: "หมายเลขโทรศัพท์ของคุณ",
  sdt_ph: "ตัวอย่าง: 0912 345 678",
  mo_ta_sdt: "ลงทะเบียน / เข้าสู่ระบบด้วยหมายเลขโทรศัพท์ รับเฉพาะ <strong>หมายเลขมือถือเวียดนาม</strong> (10 หลัก ขึ้นต้น 03 / 05 / 07 / 08 / 09) — ไม่รับเบอร์บ้าน เบอร์ต่างประเทศ หรือสายด่วน 1900 / 1800",
  btn_nhan_otp: "📩 รับรหัส OTP",
  nhan_otp: "รหัส OTP", btn_xac_nhan: "✅ ยืนยัน", btn_gui_lai: "ส่งรหัสอีกครั้ง", btn_doi_so: "← เปลี่ยนหมายเลขโทรศัพท์",
  hoac_tiep_tuc: "— หรือดำเนินการต่อด้วย —", btn_dn_facebook: "ดำเนินการต่อด้วย Facebook",
  nhan_nick: "ชื่อเล่น (ชื่อที่แสดง)", nhan_gioi: "เพศ", gioi_nam: "🧑 ชาย", gioi_nu: "👩 หญิง",
  nhan_tuoi: "อายุ", nhan_emoji: "เลือกอิโมจิ 1 อันเป็นรูปโปรไฟล์",
  nhan_muc_dich: "วัตถุประสงค์", chua_chon: "— ยังไม่ได้เลือก —", tat_ca_muc_dich: "ทุกวัตถุประสงค์",
  md_ket_ban: "🤝 หาเพื่อน", md_hen_ho: "💘 ออกเดท", md_tro_chuyen: "💬 แชท", md_nguoi_yeu: "💍 หาคู่",
  nhan_so_thich: "ความสนใจ (คั่นด้วยจุลภาค สูงสุด 10)", btn_luu_ho_so: "💾 บันทึกโปรไฟล์",
  cai_dat: "การตั้งค่า", trang_thai_ph: "สถานะของคุณ (สูงสุด 60 ตัวอักษร)", btn_luu: "💾 บันทึก", btn_huy: "ยกเลิก",
  hub_hcloud_mo: "พื้นที่เก็บข้อมูลบนคลาวด์ของคุณ", hub_hstyle_mo: "วอลเปเปอร์และเพลงสำหรับการโทร Hialo",
  hub_tai_lieu: "เอกสารของฉัน", hub_tai_lieu_mo: "ข้อความและไฟล์สำคัญที่คุณบันทึกไว้",
  hub_du_lieu: "ข้อมูลพื้นที่จัดเก็บ", hub_du_lieu_mo: "ขนาดไฟล์ที่คุณส่งไป",
  hub_viqr: "กระเป๋า QR", hub_viqr_mo: "คิวอาร์โค้ดธนาคารและอีวอลเล็ตของคุณ",
  hub_taikhoan: "บัญชีและความปลอดภัย", hub_taikhoan_mo: "โปรไฟล์ ล็อก PIN เซสชันการเข้าสู่ระบบ",
  hub_riengtu: "ความเป็นส่วนตัว", hub_riengtu_mo: "ใครสามารถค้นหา ส่งข้อความ และโทรหาคุณได้",
  cd_tieu_de: "การตั้งค่า",
  cd_tin_nhan: "ข้อความ", cd_tin_nhan_mo: "วิธีส่งและแสดงข้อความ",
  cd_cuoc_goi: "การโทร", cd_cuoc_goi_mo: "ใครโทรหาคุณได้ สั่นเมื่อมีสายเข้า",
  cd_tuong_nha: "วอลล์", cd_tuong_nha_mo: "ใครเห็นวอลล์ของคุณได้",
  cd_danh_ba: "รายชื่อ", cd_danh_ba_mo: "หาเพื่อนด้วยหมายเลขโทรศัพท์ การเรียงลำดับ",
  cd_tien_ich: "เครื่องมือ", cd_tien_ich_mo: "คิวอาร์โค้ดในรูปภาพ บัตรธนาคาร วิธีเปิดลิงก์",
  cd_giao_dien: "รูปลักษณ์และภาษา", cd_giao_dien_mo: "สว่าง / มืด ภาษาที่แสดง",
  cd_thong_tin: "เกี่ยวกับ Hialo", cd_thong_tin_mo: "เวอร์ชันแอปและคำแนะนำ",
  cd_ho_tro: "ติดต่อฝ่ายสนับสนุน", cd_ho_tro_mo: "อีเมลสนับสนุนและคำถามที่พบบ่อย",
  cd_chuyen_tk: "สลับบัญชี", cd_chuyen_tk_mo: "เข้าสู่ระบบด้วยหมายเลขอื่น",
  cd_xoa_tk: "ลบบัญชี", cd_xoa_tk_mo: "ลบบัญชีและข้อมูลของคุณอย่างถาวร",
  btn_dang_xuat: "ออกจากระบบ",
  cdtn_enter: "กด Enter เพื่อส่ง", cdtn_hien_gio: "แสดงเวลาใต้ทุกข้อความ",
  cdti_qr_anh: "ตรวจจับคิวอาร์โค้ดในรูปภาพอัตโนมัติ", cdti_qr_the: "แสดงการ์ด QR เมื่อข้อความกล่าวถึงบัญชีธนาคาร",
  cdgoi_la: "อนุญาตให้คนแปลกหน้าโทรหา", cdgoi_rung: "สั่นเมื่อมีสายเข้า",
  cdtn_tuong: "เฉพาะเพื่อนเท่านั้นที่เห็นวอลล์ของฉัน", cdtn_tb_tuong: "แจ้งเตือนเมื่อมีปฏิสัมพันธ์บนวอลล์",
  gd_giao_dien: "รูปลักษณ์", gd_sang: "☀️ สว่าง", gd_toi: "🌙 มืด", gd_ngon_ngu: "ภาษา / Language",
  gd_ngon_ngu_mo: "การเปลี่ยนภาษามีผลทันทีโดยไม่ต้องโหลดหน้าใหม่ ตัวเลือกของคุณจะถูกบันทึกในบัญชีและซิงค์ไปยังทุกอุปกรณ์ที่คุณเข้าสู่ระบบ และยังเป็นภาษาเป้าหมายเริ่มต้นของปุ่มแปลในแชทด้วย",
  rt_hien_thi: "ให้ผู้อื่นค้นหาฉันในบริเวณใกล้เคียง",
  rt_tim_sdt: "ให้ผู้อื่นค้นหาฉันด้วยหมายเลขโทรศัพท์",
  rt_la_tin: "อนุญาตข้อความจากคนแปลกหน้า", rt_chi_ban_be: "รับข้อความจากเพื่อนเท่านั้น",
  rt_da_xem: "แสดงสถานะ \"อ่านแล้ว\" ในแชท",
  rt_ds_chan: "🚫 รายชื่อที่บล็อก", rt_chua_chan: "คุณยังไม่ได้บล็อกใคร", rt_quyen: "🧩 สิทธิ์ของเครื่องมือและแอป",
  cddb_sap_xep: "เรียงรายชื่อเพื่อน", cddb_mac_dinh: "ค่าเริ่มต้น (ลำดับการเป็นเพื่อน)", cddb_theo_ten: "ตามชื่อ A → Z",
  tk_sdt_nhan: "หมายเลขโทรศัพท์:", btn_sua_ho_so: "✏️ แก้ไขโปรไฟล์ (ชื่อที่แสดง รูปโปรไฟล์)",
  tk_pin_tieu_de: "🔑 ล็อกแอปด้วย PIN",
  nhan_pin_moi: "PIN ใหม่", nhan_pin_moi2: "ใส่ PIN ใหม่อีกครั้ง", btn_bat_pin: "🔒 เปิดล็อก PIN",
  nhan_pin_cu: "PIN ปัจจุบัน", nhan_pin_doi: "PIN ใหม่ (เฉพาะเมื่อต้องการเปลี่ยน)", btn_doi_pin: "เปลี่ยน PIN", btn_tat_pin: "ปิดล็อก PIN",
  tk_phien_tieu_de: "🖥️ เซสชันการเข้าสู่ระบบ", tk_xacthuc_tieu_de: "🛡️ การยืนยันโปรไฟล์", btn_gui_xacthuc: "📸 ส่งเซลฟี่ยืนยันตัวตน",
  tk_btn_xoa: "🗑 ลบบัญชี",
  tk_lien_ket_tieu_de: "🔗 บัญชีที่เชื่อมโยง",
  tk_lien_ket_mo: "เชื่อมโยง Google / Facebook เพื่อเข้าสู่ระบบอย่างรวดเร็วด้วยบัญชีเดียวกัน บัญชีโซเชียลหนึ่งบัญชีเชื่อมโยงกับบัญชี HIALO ได้เพียงบัญชีเดียว",
  tk_can_sdt: "บัญชีนี้เข้าสู่ระบบด้วยบัญชีโซเชียลและยังไม่มีหมายเลขโทรศัพท์ — โปรดเพิ่มหมายเลขของคุณในโปรไฟล์หากต้องการใช้ฟีเจอร์ที่ต้องใช้หมายเลข (เช่น การยืนยัน MO-SMS)",
  lk_chua: "ยังไม่ได้เชื่อมโยง", lk_da: "เชื่อมโยงแล้ว", lk_khong_bat: "ยังไม่เปิดใช้งานบนเซิร์ฟเวอร์", btn_lien_ket: "เชื่อมโยง", btn_huy_lien_ket: "ยกเลิกการเชื่อมโยง",
  xac_nhan_huy_lk: "ยกเลิกการเชื่อมโยงผู้ให้บริการนี้จากบัญชีของคุณ?",
  dang_nhap_xa_hoi: "บัญชีโซเชียล",
  kp_khoanh_khac: "📸 โมเมนต์", kp_kk_24h: "(หายไปหลัง 24 ชั่วโมง)",
  btn_chon_anh: "🖼 เลือกรูปภาพ", btn_bo_anh: "✕ ลบรูปภาพ", kk_ph: "เขียนสักสองสามคำสำหรับโมเมนต์นี้…",
  btn_dang_kk: "📸 โพสต์โมเมนต์", kp_thong_bao: "🔔 การแจ้งเตือน",
  kp_tim: "🔎 ค้นหาใกล้ตัว", btn_dinh_vi: "📍 เปิดตำแหน่งและค้นหาใกล้ตัว",
  loc_gioi_tinh: "กำลังมองหา", loc_tat_ca: "ทุกคน", loc_tuoi_tu: "อายุตั้งแต่", loc_den: "ถึง",
  loc_km_tu: "ตั้งแต่ (กม.)", loc_den_km: "ถึง (กม.)",
  kp_ho_chieu: "🧳 พาสปอร์ต — ค้นหาที่สถานที่อื่น", btn_ho_chieu: "🧳 ใช้ตำแหน่งพาสปอร์ต",
  btn_tim: "🔎 ค้นหา", kp_ket_qua: "💞 ผู้คนใกล้ตัวคุณ", btn_luoi: "🔲 มุมมองตาราง", btn_thich: "❤️ ถูกใจ",
  kp_ghep_doi: "💞 จับคู่", btn_boost: "🚀 บูสต์โปรไฟล์ 30 นาที",
  kp_diem_danh: "🎁 เช็คอินและของขวัญ", btn_diem_danh: "✅ เช็คอินวันนี้ (+10 แต้ม)",
  kp_phong_thoai: "🎙️ ห้องเสียงใกล้ตัวคุณ", btn_tao_phong_mo: "➕ สร้างห้องเสียง",
  nhan_ten_phong: "ชื่อห้อง", nhan_chu_de: "หัวข้อ", btn_tao_phong: "🎙️ สร้างและเข้าห้อง",
  kp_tien_ich: "🧭 เครื่องมือ",
  db_tim_sdt_tieu_de: "🔍 หาเพื่อนด้วยหมายเลขโทรศัพท์", nhan_tim_sdt: "หมายเลขโทรศัพท์ของเพื่อนที่คุณต้องการค้นหา",
  db_loi_moi: "📩 คำขอเป็นเพื่อน", db_nguoi_quen: "📇 ผู้คนในรายชื่อโทรศัพท์ของคุณ",
  btn_quen_danh_ba: "📇 ดูผู้คนจากรายชื่อโทรศัพท์", db_ban_be: "👥 เพื่อน",
  tn_tieu_de: "💬 ข้อความ", quet_qr: "สแกนคิวอาร์โค้ด", them_moi: "เพิ่มใหม่",
  tn_tao_nhom: "👥 สร้างกลุ่ม", tn_them_ban: "➕ เพิ่มเพื่อน", tn_quet_qr: "🔳 สแกนคิวอาร์โค้ด", tn_ma_qr: "🪪 คิวอาร์โค้ดของฉัน",
  tn_cho: "📥 คำขอข้อความ", tn_cho_trong: "ไม่มีคำขอข้อความ",
  goi_thoai: "โทรเสียง", goi_video: "วิดีโอคอล", bao_cao_nguoi_nay: "รายงานบุคคลนี้", btn_chan: "🚫 บล็อก",
  gui_anh: "ส่งรูปภาพ", gui_tep: "ส่งไฟล์หรือวิดีโอ (สูงสุด 200 MB)", ghi_am: "บันทึกข้อความเสียง",
  tang_qua: "ส่งของขวัญด้วยแต้มรางวัล", gui_sticker: "ส่งสติกเกอร์",
  tuhuy_tat: "⏳ ทำลายตัวเอง: ปิด", tuhuy_10s: "💨 10 วินาที", tuhuy_1p: "💨 1 นาที", tuhuy_1h: "💨 1 ชั่วโมง",
  inp_tin_ph: "พิมพ์ข้อความ…", inp_tin_nhom_ph: "ส่งข้อความถึงกลุ่ม…", btn_gui: "ส่ง ➤", btn_gui_am: "ส่ง 🎤",
  dich: "🌐 แปล", dang_dich: "กำลังแปล…", da_xem: "✓✓ อ่านแล้ว", dang_nhap_lbl: "กำลังพิมพ์…",
  ban_dich: "🌐 คำแปล",
  tuong_tieu_de: "🏠 วอลล์", tuong_dang_moi: "โพสต์ใหม่", tuong_ph: "คุณกำลังคิดอะไรอยู่? (สูงสุด 500 ตัวอักษร)",
  btn_dang_bai: "📝 โพสต์",
  quet_qr_tieu_de: "🔳 สแกนคิวอาร์โค้ด", btn_dong: "✕ ปิด",
  da_doi_ngon_ngu: "เปลี่ยนภาษาที่แสดงแล้ว",
  loi_xa_hoi: "ไม่สามารถเข้าสู่ระบบด้วยบัญชีโซเชียลได้ — โปรดลองอีกครั้งภายหลัง"
}
};
// Lấy chuỗi theo khóa: ngôn ngữ yêu cầu -> tiếng Anh -> tiếng Việt -> chính khóa.
// (Hàm thuần, không đụng DOM — kiểm thử được bằng Node.)
function trichChuoi(khoa, ngonNgu) {
  var bang = BANG_NGON_NGU;
  if (bang[ngonNgu] && typeof bang[ngonNgu][khoa] === "string") return bang[ngonNgu][khoa];
  if (bang.en && typeof bang.en[khoa] === "string") return bang.en[khoa];
  if (bang.vi && typeof bang.vi[khoa] === "string") return bang.vi[khoa];
  return khoa;
}
// Suy ngôn ngữ từ mã trình duyệt (navigator.language): fil/tl -> tl, in/id -> id,
// th -> th, en -> en, còn lại mặc định vi (khách chính của HIALO hiện tại).
function phatHienNgonNguTuTrinhDuyet(maTrinhDuyet) {
  var m = String(maTrinhDuyet || "").toLowerCase();
  if (m.indexOf("fil") === 0 || m.indexOf("tl") === 0) return "tl";
  if (m.indexOf("id") === 0 || m.indexOf("in") === 0) return "id";
  if (m.indexOf("th") === 0) return "th";
  if (m.indexOf("en") === 0) return "en";
  return "vi";
}

// ===== PHẦN TRÌNH DUYỆT =====
if (typeof document !== "undefined") {
  var me = null;               // hồ sơ của số đang đăng nhập (nếu đã tạo)
  var sdtHienTai = null;       // số điện thoại đang đăng nhập
  var tokenMayChu = null;      // token phiên đăng nhập (chỉ khi TQD_SERVER khác rỗng)
  var phienOTP = null;         // phiên OTP đang chờ nhập mã
  var phienSmsDen = null;      // V5.3: phiên MO-SMS đang chờ { sdt, phienToken, hetHanLuc }
  var idKiemTraSmsDen = null;  // V5.3: interval tự kiểm tra kết quả MO-SMS mỗi 3 giây
  var soCongSmsDen = "";       // V5.3: số cổng MO-SMS máy chủ công bố (chỉ khi tính năng bật)
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
      return r.json().catch(function () { return { ok: false, loi: "Máy chủ trả lời không hợp lệ." }; }).then(function (kq) {
        // V7.1: phien het han o may chu (vd may chu khoi dong lai) -> tu dang xuat o may de hien man dang nhap
        if (r.status === 401 && canToken && tokenMayChu && duongDan !== "/api/dang-xuat") {
          hetPhienVuaXayRa = true;
          tokenMayChu = null;
          luuToken();
          dangXuat();
        }
        return kq;
      });
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
      hienThi: me.hienThi !== false,
      mucDich: me.mucDich || "", // Gói 2
      soThich: Array.isArray(me.soThich) ? me.soThich : [] // Gói 2
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
      return (typeof s === "string" && (/^0\d{9}$/.test(s) || /^(gg|fb)-[0-9a-f]{16}$/.test(s))) ? s : null;
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
      $("sdtMe").textContent = /^0\d{9}$/.test(sdtHienTai || "") ? ("📱 " + sdtHienTai) : ("🔗 " + trichChuoi("dang_nhap_xa_hoi", ngonNguHT));
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
    else if (ten === "trangXoaTaiKhoan") chuanBiTrangXoaTaiKhoan();
    else if (ten === "trangRiengTu") { taiCaiDat(); taiDsChanCaNhan(); taiQuyenTienIch(); }
    else if (ten === "trangMaQRCuaToi") veMaQRCuaToi();
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
    if ($("selMucDichHoSo")) $("selMucDichHoSo").value = me.mucDich || ""; // Gói 2
    if ($("inpSoThichHoSo")) $("inpSoThichHoSo").value = Array.isArray(me.soThich) ? me.soThich.join(", ") : ""; // Gói 2
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

  // Gói 2: đọc sở thích từ ô nhập (phân tách bằng dấu phẩy, tối đa 10 mục)
  function docSoThichTuForm() {
    var v = $("inpSoThichHoSo") ? $("inpSoThichHoSo").value : "";
    var ra = [];
    String(v || "").split(",").forEach(function (x) {
      var t = x.trim().slice(0, 24);
      if (t && ra.indexOf(t) === -1) ra.push(t);
    });
    return ra.slice(0, 10);
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
      hienThi: $("chkHienThi").checked,
      mucDich: $("selMucDichHoSo") ? $("selMucDichHoSo").value : "", // Gói 2
      soThich: docSoThichTuForm() // Gói 2
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
    dungChoSmsDen(); // V5.3: dừng chờ MO-SMS khi đăng xuất
    luuPhienDangNhap();
    $("inpSdt").value = "";
    $("loiSdt").textContent = "";
    capNhatManHinh();
    hienToast(hetPhienVuaXayRa ? "Phiên đăng nhập đã hết hạn — đăng nhập lại nhé." : "Đã đăng xuất. Hẹn gặp lại bạn! 👋");
    hetPhienVuaXayRa = false;
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
    dungChoSmsDen();
    capNhatManHinh();
  }

  // Áp dụng kết quả đăng nhập thành công từ MÁY CHỦ (dùng chung cho OTP và MO-SMS V5.3):
  // kq là response có { token, hoSo } đúng định dạng /api/otp/verify trả về.
  function hoanTatDangNhapTuMayChu(kq, sdt) {
    tokenMayChu = kq.token || null;
    luuToken();
    phienOTP = null;
    sdtDangCho = null;
    if (idDemNguoc) { clearInterval(idDemNguoc); idDemNguoc = null; }
    dungChoSmsDen();
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
  }

  // Chế độ máy chủ: xác thực mã qua API, nhận token phiên đăng nhập
  function xacNhanOTPMayChu() {
    goiAPI("/api/otp/verify", "POST", { phone: sdtDangCho, code: $("inpOTP").value }, false)
      .then(function (kq) {
        if (!kq.ok) { $("loiOTP").textContent = kq.loi || "Mã chưa đúng. Kiểm tra lại nhé."; return; }
        hoanTatDangNhapTuMayChu(kq, sdtDangCho);
      });
  }

  // ===== V5.3: XÁC THỰC BẰNG TIN NHẮN TỰ GỬI (MO-SMS) =====
  // Hỏi máy chủ xem tính năng có bật không; chỉ khi bật mới hiện khối MO-SMS trong thẻ
  // đăng nhập. Tắt -> khối ẩn hoàn toàn, luồng OTP cũ không thay đổi gì.
  function taiCauHinhXacThuc() {
    if (!TQD_SERVER) return;
    goiAPI("/api/cau-hinh-xac-thuc", "GET", null, false).then(function (kq) {
      if (kq && kq.ok && kq.smsDenBat && kq.soCong) {
        soCongSmsDen = kq.soCong;
        $("khuSmsDen").classList.remove("an");
        khoiPhucPhienSmsDen();
      }
    });
  }

  function dungChoSmsDen() {
    if (idKiemTraSmsDen) { clearInterval(idKiemTraSmsDen); idKiemTraSmsDen = null; }
    phienSmsDen = null;
    try { localStorage.removeItem("hialo_phien_sms_den"); } catch (e) {}
    var khuCho = $("khuChoSmsDen");
    if (khuCho) khuCho.classList.add("an");
  }

  // Lưu phiên chờ MO-SMS xuống localStorage: nếu Chrome tải lại trang trong lúc
  // người dùng qua app nhắn tin gửi SMS (rất hay xảy ra khi pin yếu), quay lại
  // trang vẫn tiếp tục chờ và tự đăng nhập khi máy chủ đã khớp tin.
  function luuPhienSmsDenCho() {
    if (!phienSmsDen) return;
    try {
      localStorage.setItem("hialo_phien_sms_den", JSON.stringify({
        sdt: phienSmsDen.sdt,
        phienToken: phienSmsDen.phienToken,
        hetHanLuc: phienSmsDen.hetHanLuc,
        cuPhap: $("cuPhapSmsDen").textContent,
        soCong: $("soCongSmsDen").textContent
      }));
    } catch (e) {}
  }

  function khoiPhucPhienSmsDen() {
    var tho = null;
    try { tho = localStorage.getItem("hialo_phien_sms_den"); } catch (e) {}
    if (!tho) return;
    var luu = null;
    try { luu = JSON.parse(tho); } catch (e) {}
    if (!luu || !luu.phienToken || !luu.hetHanLuc || Date.now() > luu.hetHanLuc) {
      try { localStorage.removeItem("hialo_phien_sms_den"); } catch (e) {}
      return;
    }
    var oNhap = $("inpSdt");
    if (oNhap && oNhap.value && oNhap.value.replace(/\D/g, "") !== String(luu.sdt).replace(/\D/g, "")) return;
    if (oNhap && !oNhap.value) oNhap.value = luu.sdt;
    phienSmsDen = { sdt: luu.sdt, phienToken: luu.phienToken, hetHanLuc: luu.hetHanLuc };
    if (luu.cuPhap) $("cuPhapSmsDen").textContent = luu.cuPhap;
    if (luu.soCong) {
      $("soCongSmsDen").textContent = luu.soCong;
      soCongSmsDen = luu.soCong;
      if (luu.cuPhap) $("btnMoAppSms").href = "sms:" + luu.soCong + "?body=" + encodeURIComponent(luu.cuPhap);
    }
    $("khuChoSmsDen").classList.remove("an");
    if (idKiemTraSmsDen) clearInterval(idKiemTraSmsDen);
    idKiemTraSmsDen = setInterval(kiemTraSmsDenDinhKy, 3000);
    kiemTraSmsDenDinhKy();
  }

  function layMaSmsDenSuKien() {
    var kt = kiemTraSoVN($("inpSdt").value);
    if (!kt.hople) { $("loiSmsDen").textContent = kt.lyDo; return; }
    $("loiSmsDen").textContent = "";
    goiAPI("/api/xacthuc-sms/bat-dau", "POST", { soDienThoai: kt.so }, false).then(function (kq) {
      if (!kq.ok) { $("loiSmsDen").textContent = kq.loi || "Chưa lấy được mã. Thử lại sau nhé."; return; }
      dungChoSmsDen();
      phienSmsDen = {
        sdt: kt.so,
        phienToken: kq.phienToken,
        hetHanLuc: Date.now() + (Number(kq.hetHanGiay) || 300) * 1000
      };
      $("cuPhapSmsDen").textContent = kq.cuPhap;
      $("soCongSmsDen").textContent = kq.soCong;
      $("btnMoAppSms").href = "sms:" + kq.soCong + "?body=" + encodeURIComponent(kq.cuPhap);
      $("trangThaiSmsDen").textContent = "Đang chờ tin nhắn từ số của bạn… (mã còn hiệu lực " + Math.round((Number(kq.hetHanGiay) || 300) / 60) + " phút)";
      $("khuChoSmsDen").classList.remove("an");
      luuPhienSmsDenCho();
      idKiemTraSmsDen = setInterval(kiemTraSmsDenDinhKy, 3000);
      kiemTraSmsDenDinhKy();
    });
  }

  function kiemTraSmsDenDinhKy() {
    if (!phienSmsDen) { dungChoSmsDen(); return; }
    var conGiay = Math.round((phienSmsDen.hetHanLuc - Date.now()) / 1000);
    if (conGiay <= 0) {
      dungChoSmsDen();
      $("loiSmsDen").textContent = "Mã đã hết hạn. Bấm \"Lấy mã để gửi tin\" để lấy mã mới nhé.";
      return;
    }
    $("trangThaiSmsDen").textContent = "Đang chờ tin nhắn từ số của bạn… (còn " + conGiay + " giây)";
    var phien = phienSmsDen;
    goiAPI("/api/xacthuc-sms/kiem-tra", "POST", { soDienThoai: phien.sdt, phienToken: phien.phienToken }, false)
      .then(function (kq) {
        if (!phienSmsDen || phienSmsDen !== phien) return; // phiên đã đổi/hủy trong lúc chờ
        if (kq && kq.token) { // đã xác thực -> đăng nhập như luồng OTP
          try { localStorage.removeItem("hialo_phien_sms_den"); } catch (e) {}
          hoanTatDangNhapTuMayChu(kq, phien.sdt);
          return;
        }
        if (kq && kq.hetHan) {
          dungChoSmsDen();
          $("loiSmsDen").textContent = "Mã đã hết hạn. Bấm \"Lấy mã để gửi tin\" để lấy mã mới nhé.";
        }
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
    return {
      gioi: locGioiChon, tuoiTu: tuoiTu, tuoiDen: tuoiDen, kmTu: kmTu, kmDen: kmDen,
      mucDich: $("locMucDich") ? $("locMucDich").value : "", // Gói 2
      chungSoThich: !!($("locChungSoThich") && $("locChungSoThich").checked) // Gói 2
    };
  }

  // Gói 2: dòng trạng thái hoạt động ("Đang online" / "Hoạt động ... trước")
  function dongHoatDong(p) {
    if (!p.hoatDong || !p.hoatDong.luc) return null;
    var el = document.createElement("p");
    el.className = "chiTietNguoi chamTrangThai";
    if (p.hoatDong.online) {
      el.innerHTML = "<span class=\"dangOnline\">●</span> Đang online";
    } else {
      var phut = Math.max(1, Math.round((Date.now() - p.hoatDong.luc) / 60000));
      var chu = phut < 60 ? phut + " phút trước"
        : phut < 1440 ? Math.round(phut / 60) + " giờ trước"
        : Math.round(phut / 1440) + " ngày trước";
      el.innerHTML = "<span class=\"ngoaiTuyen\">●</span> Hoạt động " + chu;
    }
    return el;
  }

  // Gói 2: chips sở thích (tối đa 4 chip + số còn lại)
  function dongSoThich(p) {
    if (!p.soThich || !p.soThich.length) return null;
    var el = document.createElement("p");
    el.className = "chiTietNguoi";
    var hien = p.soThich.slice(0, 4);
    el.textContent = "🎯 " + hien.join(" · ") + (p.soThich.length > 4 ? " · +" + (p.soThich.length - 4) : "");
    return el;
  }

  function veKetQua(kq) {
    var hop = $("ketQua");
    hop.innerHTML = "";
    $("goiYTrong").classList.toggle("an", kq.length > 0);
    kq.forEach(function (p) {
      var the = document.createElement("div");
      the.className = "theNguoi" + (p.dangBoost ? " dangBoostThe" : "") + (p.thichMinh === "sieu" ? " duocSieuThich" : "");

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
      if (p.xacThuc) { // Gói 1: huy hiệu ✅ hồ sơ đã xác thực
        var huyXT = document.createElement("span");
        huyXT.className = "huyHieuXacThuc";
        huyXT.textContent = " ✅";
        huyXT.title = "Hồ sơ đã xác thực";
        ten.appendChild(huyXT);
      }
      var ct = document.createElement("p");
      ct.className = "chiTietNguoi";
      ct.textContent = (p.gioi === "nu" ? "♀ Nữ" : "♂ Nam") + " · " + p.tuoi + " tuổi" +
        (p.mucDich && nhanMucDich(p.mucDich) ? " · " + nhanMucDich(p.mucDich) : "");
      giua.appendChild(ten);
      giua.appendChild(ct);
      var hd = dongHoatDong(p); // Gói 2
      if (hd) giua.appendChild(hd);
      if (p.trangThai) { // Gói 2: dòng trạng thái của hồ sơ
        var tt = document.createElement("p");
        tt.className = "chiTietNguoi";
        tt.textContent = "“" + p.trangThai + "”";
        giua.appendChild(tt);
      }
      var st = dongSoThich(p); // Gói 2
      if (st) giua.appendChild(st);
      if (p.thichMinh === "sieu") { // Gói 2: người này đã siêu thích mình
        var nSieu = document.createElement("p");
        nSieu.innerHTML = "<span class=\"nhanDuocThich\">⭐ Đã siêu thích bạn</span>";
        giua.appendChild(nSieu);
      } else if (p.thichMinh === "thuong") {
        var nThuong = document.createElement("p");
        nThuong.innerHTML = "<span class=\"nhanDuocThich\">❤️ Đã thích bạn</span>";
        giua.appendChild(nThuong);
      }

      var phai = document.createElement("div");
      phai.className = "cotPhai";
      var huy = document.createElement("span");
      huy.className = "huyHieuKm";
      huy.textContent = "📍 " + dinhDangKhoangCach(p.khoangCach);
      phai.appendChild(huy);
      if (p.dangBoost) { // Gói 2
        var nBoost = document.createElement("span");
        nBoost.className = "nhanBoost";
        nBoost.textContent = "🚀 Đang Boost";
        phai.appendChild(nBoost);
      }
      if (p.tongQuaNhan > 0) { // Gói 3: tổng quà hồ sơ đã nhận
        var nQua = document.createElement("span");
        nQua.className = "nhanTongQua";
        nQua.textContent = "🎁 ×" + p.tongQuaNhan;
        phai.appendChild(nQua);
      }
      var hangNut = document.createElement("div");
      hangNut.className = "cotNutDuoi";
      var nut = document.createElement("button");
      nut.type = "button";
      nut.className = "nutChao";
      nut.textContent = "👋 Gửi lời chào";
      nut.addEventListener("click", function () {
        hienToast("Tính năng nhắn tin sẽ có ở bản máy chủ 💌");
      });
      hangNut.appendChild(nut);
      if (p.id) { // Gói 2: nút Thích + Siêu thích (chỉ hồ sơ máy chủ mới có định danh)
        var nutThich = document.createElement("button");
        nutThich.type = "button";
        nutThich.className = "nutChao nutThich" + (p.daThich ? " dangThich" : "");
        nutThich.textContent = p.daThich ? "💖 Đã thích" : "❤️ Thích";
        nutThich.addEventListener("click", function () {
          if (p.daThich) { hienToast("Bạn đã thích " + p.ten + " rồi 💖"); return; }
          thichHoSo(p, "thuong", function () { veKetQua(dsQuanhDayHT); });
        });
        hangNut.appendChild(nutThich);
        var nutSieu = document.createElement("button");
        nutSieu.type = "button";
        nutSieu.className = "nutChao nutSieuThich";
        nutSieu.textContent = "⭐ Siêu thích";
        nutSieu.addEventListener("click", function () {
          if (p.daThich === "sieu") { hienToast("Bạn đã siêu thích " + p.ten + " rồi ⭐"); return; }
          thichHoSo(p, "sieu", function () { veKetQua(dsQuanhDayHT); });
        });
        hangNut.appendChild(nutSieu);
        var nutQua = document.createElement("button"); // Gói 3: tặng quà bằng điểm thưởng
        nutQua.type = "button";
        nutQua.className = "nutChao nutTangQua";
        nutQua.textContent = "🎁 Tặng quà";
        nutQua.addEventListener("click", function () {
          moChonQua({ id: p.id, nick: p.ten });
        });
        hangNut.appendChild(nutQua);
      }
      phai.appendChild(hangNut);

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
        "&kmTu=" + loc.kmTu + "&kmDen=" + loc.kmDen +
        (loc.mucDich ? "&mucDich=" + encodeURIComponent(loc.mucDich) : "") + // Gói 2
        (loc.chungSoThich ? "&chungSoThich=1" : "") + // Gói 2
        (hoChieuDangDung ? "&hoChieu=1" : ""); // Gói 2: Passport
      goiAPI("/api/nearby" + qs, "GET", null, true).then(function (kq) {
        if (!kq.ok) { hienToast(kq.loi || "Không lấy được danh sách từ máy chủ."); veKetQua([]); return; }
        var ds = (kq.ketQua || []).map(function (p) {
          return {
            ten: p.ten || p.nick, gioi: p.gioi || p.gioiTinh,
            tuoi: p.tuoi, emoji: p.emoji, khoangCach: p.khoangCach,
            vip: p.vip === true, // V4.1
            xacThuc: p.xacThuc === true, // Gói 1
            // Gói 2: trường ghép đôi
            id: p.id || "", mucDich: p.mucDich || "",
            soThich: Array.isArray(p.soThich) ? p.soThich : [],
            trangThai: p.trangThai || "",
            dangBoost: p.dangBoost === true,
            daThich: p.daThich || "", thichMinh: p.thichMinh || "",
            hoatDong: p.hoatDong || null
          };
        });
        dsQuanhDayHT = ds; // Gói 2: giữ bản đầy đủ cho chế độ quẹt
        // V4.1: hết lượt xem miễn phí trong ngày -> hiện banner mời nâng VIP
        $("bannerHetLuot").classList.toggle("an", !kq.hetLuot);
        if (cheDoQuet) { chiSoQuet = 0; veQuet(); } else { veKetQua(ds); } // Gói 2
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
  // ===== GÓI 2: GHÉP ĐÔI (thích/quẹt, ai đã thích bạn, siêu thích, =====
  // ===== Boost, Passport, trạng thái online)                        =====
  // ======================================================================
  var dsQuanhDayHT = [];        // kết quả quanh đây gần nhất (đầy đủ trường Gói 2)
  var cheDoQuet = false;        // đang xem dạng quẹt?
  var chiSoQuet = 0;            // vị trí thẻ hiện tại trong hàng đợi quẹt
  var trangThaiGD = null;       // trạng thái ghép đôi gần nhất từ máy chủ
  var hoChieuDangDung = false;  // lần Tìm sắp tới có dùng vị trí hộ chiếu không
  var idDemBoost = null;        // interval đếm ngược Boost
  var boostHetLucDia = 0;       // mốc hết Boost theo đồng hồ của máy này
  var aiThichDangMo = false;    // mục Ai đã thích bạn đang mở?
  var ghepDoiDangMo = false;    // mục Ghép đôi của tôi đang mở?

  var NHAN_MUC_DICH = {
    "ket-ban": "🤝 Kết bạn", "hen-ho": "💘 Hẹn hò",
    "tro-chuyen": "💬 Trò chuyện", "nguoi-yeu": "💍 Tìm người yêu"
  };
  function nhanMucDich(md) { return NHAN_MUC_DICH[md] || ""; }

  function datHuyBadge(id, so) {
    var e = $(id);
    if (!e) return;
    e.textContent = so || 0;
    e.classList.toggle("an", !so);
  }

  // ---------- Trạng thái + hạn mức ghép đôi ----------
  function taiTrangThaiGhepDoi() {
    if (!TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/ghep-doi/trang-thai", "GET", null, true).then(function (kq) {
      if (!kq.ok) return;
      trangThaiGD = kq;
      capNhatGiaoDienGhepDoi();
    });
  }

  function capNhatGiaoDienGhepDoi() {
    var kq = trangThaiGD;
    if (!kq) return;
    var dong = "⭐ Siêu thích hôm nay còn " + kq.sieuThichConLai + "/" + kq.sieuThichHanMuc + " lượt";
    dong += kq.laVIP ? " · 🚀 Boost còn " + kq.boostConLai + " lượt hôm nay" : " · 🚀 Boost là tính năng VIP";
    if ($("txtHanMucGhepDoi")) $("txtHanMucGhepDoi").textContent = dong;
    datHuyBadge("huySoThich", kq.soNguoiThich);
    datHuyBadge("huySoGhepDoi", kq.soGhepDoi);
    // Boost: nút + đếm ngược
    var btnB = $("btnBoost");
    if (btnB) btnB.textContent = kq.dangBoost ? "🚀 Đang Boost…" : "🚀 Boost hồ sơ 30 phút";
    if (kq.dangBoost && kq.boostConLaiGiay > 0) {
      boostHetLucDia = Date.now() + kq.boostConLaiGiay * 1000;
      batDemNguocBoost();
    } else {
      dungDemNguocBoost();
      if ($("txtDemNguocBoost")) $("txtDemNguocBoost").textContent = "";
    }
    // Passport: trạng thái + điền sẵn form từ hộ chiếu đã lưu
    var hc = kq.hoChieu;
    if ($("txtHoChieu")) {
      $("txtHoChieu").textContent = !hc
        ? "Đang tìm theo vị trí thật của bạn."
        : hoChieuDangDung
          ? "🧳 Đang tìm theo Hộ chiếu tại: " + hc.ten
          : "🧳 Hộ chiếu đã lưu tại: " + hc.ten + " (đang tìm theo vị trí thật — bấm “Dùng vị trí hộ chiếu” để chuyển).";
    }
    if ($("btnTatHoChieu")) $("btnTatHoChieu").classList.toggle("an", !hc);
    if (hc && $("inpTenHoChieu") && !$("inpTenHoChieu").value) {
      $("inpTenHoChieu").value = hc.ten || "";
      $("inpLatHoChieu").value = hc.lat;
      $("inpLngHoChieu").value = hc.lng;
    }
    if ($("goiYHoChieuKhoa")) $("goiYHoChieuKhoa").classList.toggle("an", kq.laVIP === true);
    // Đồng bộ mục đích/sở thích từ máy chủ về máy này nếu máy chưa có (đổi máy không mất)
    if (me) {
      var doi = false;
      if (!me.mucDich && kq.mucDich) { me.mucDich = kq.mucDich; doi = true; }
      if ((!Array.isArray(me.soThich) || !me.soThich.length) && Array.isArray(kq.soThich) && kq.soThich.length) {
        me.soThich = kq.soThich; doi = true;
      }
      if (doi) luuMe();
    }
  }

  function batDemNguocBoost() {
    dungDemNguocBoost();
    capNhatDemBoost();
    idDemBoost = setInterval(capNhatDemBoost, 1000);
  }
  function dungDemNguocBoost() {
    if (idDemBoost) { clearInterval(idDemBoost); idDemBoost = null; }
  }
  function capNhatDemBoost() {
    var con = Math.max(0, Math.round((boostHetLucDia - Date.now()) / 1000));
    var el = $("txtDemNguocBoost");
    if (con <= 0) {
      dungDemNguocBoost();
      if (el) el.textContent = "";
      taiTrangThaiGhepDoi();
      return;
    }
    var ph = Math.floor(con / 60), gi = con % 60;
    if (el) el.textContent = "⏳ Boost còn " + ph + ":" + (gi < 10 ? "0" : "") + gi;
  }

  // ---------- Thích / Siêu thích / Bỏ qua ----------
  function thichHoSo(p, loai, sauKhi) {
    if (!p || !p.id) {
      hienToast("Hồ sơ mẫu (demo) — hãy đăng nhập bản máy chủ để dùng Ghép đôi 💞");
      return;
    }
    goiAPI("/api/ghep-doi/thich", "POST", { id: p.id, loai: loai }, true).then(function (kq) {
      if (!kq.ok) {
        hienToast(kq.loi || "Chưa thích được, thử lại nhé.");
        taiTrangThaiGhepDoi();
        return;
      }
      p.daThich = kq.loai || loai;
      if (kq.ghepDoi) {
        hienToast("🎉 GHÉP ĐÔI với " + (p.ten || p.nick) + "! Hai bạn đã nhắn tin được cho nhau — xem mục 💞 Ghép đôi nhé.");
      } else if (loai === "sieu") {
        hienToast("⭐ Đã gửi Siêu thích tới " + (p.ten || p.nick));
      } else {
        hienToast("❤️ Đã thích " + (p.ten || p.nick));
      }
      taiTrangThaiGhepDoi();
      if (typeof sauKhi === "function") sauKhi(kq);
    });
  }

  function boQuaHoSo(p, sauKhi) {
    if (!p || !p.id) { if (typeof sauKhi === "function") sauKhi(); return; }
    goiAPI("/api/ghep-doi/bo-qua", "POST", { id: p.id }, true).then(function (kq) {
      if (!kq.ok) { hienToast(kq.loi || "Chưa bỏ qua được."); return; }
      dsQuanhDayHT = dsQuanhDayHT.filter(function (x) { return x.id !== p.id; });
      taiTrangThaiGhepDoi();
      if (typeof sauKhi === "function") sauKhi(kq);
    });
  }

  // ---------- Chế độ quẹt ----------
  function hangDoiQuet() {
    return dsQuanhDayHT.filter(function (p) { return !p.daThich; });
  }

  function taoTheQuet(p) {
    var the = document.createElement("div");
    the.className = "theNguoi theQuetLon" + (p.dangBoost ? " dangBoostThe" : "") + (p.thichMinh === "sieu" ? " duocSieuThich" : "");
    var av = document.createElement("span");
    av.className = "avatarLon";
    av.textContent = p.emoji;
    the.appendChild(av);
    var ten = document.createElement("p");
    ten.className = "tenNguoi";
    ten.textContent = p.ten + (p.vip ? " ⭐" : "") + (p.xacThuc ? " ✅" : "");
    the.appendChild(ten);
    var ct = document.createElement("p");
    ct.className = "chiTietNguoi";
    ct.textContent = (p.gioi === "nu" ? "♀ Nữ" : "♂ Nam") + " · " + p.tuoi + " tuổi · 📍 " +
      dinhDangKhoangCach(p.khoangCach) +
      (p.mucDich && nhanMucDich(p.mucDich) ? " · " + nhanMucDich(p.mucDich) : "");
    the.appendChild(ct);
    var hd = dongHoatDong(p);
    if (hd) the.appendChild(hd);
    if (p.trangThai) {
      var tt = document.createElement("p");
      tt.className = "chiTietNguoi";
      tt.textContent = "“" + p.trangThai + "”";
      the.appendChild(tt);
    }
    var st = dongSoThich(p);
    if (st) the.appendChild(st);
    if (p.dangBoost) {
      var nb = document.createElement("p");
      nb.innerHTML = "<span class=\"nhanBoost\">🚀 Đang Boost</span>";
      the.appendChild(nb);
    }
    if (p.thichMinh === "sieu") {
      var ns = document.createElement("p");
      ns.innerHTML = "<span class=\"nhanDuocThich\">⭐ Đã siêu thích bạn</span>";
      the.appendChild(ns);
    } else if (p.thichMinh === "thuong") {
      var nt = document.createElement("p");
      nt.innerHTML = "<span class=\"nhanDuocThich\">❤️ Đã thích bạn</span>";
      the.appendChild(nt);
    }
    return the;
  }

  function veQuet() {
    var hop = $("theQuet");
    if (!hop) return;
    hop.innerHTML = "";
    var hang = hangDoiQuet();
    if (chiSoQuet >= hang.length) chiSoQuet = Math.max(0, hang.length - 1);
    var p = hang[chiSoQuet];
    $("txtQuetTrong").classList.toggle("an", !!p);
    ["btnQuetBoQua", "btnQuetThich", "btnQuetSieuThich"].forEach(function (id) {
      var b = $(id);
      if (b) b.disabled = !p;
    });
    if (p) hop.appendChild(taoTheQuet(p));
  }

  function datCheDoQuet(quet) {
    if (quet && (!TQD_SERVER || !tokenMayChu)) {
      hienToast("Chế độ quẹt là tính năng bản máy chủ — hãy đăng nhập để quẹt tìm bạn 💞");
      return;
    }
    cheDoQuet = !!quet;
    $("ketQua").classList.toggle("an", cheDoQuet);
    $("khungQuet").classList.toggle("an", !cheDoQuet);
    $("btnCheDoLuoi").className = cheDoQuet ? "nutPhu nho" : "nutChinh nho";
    $("btnCheDoQuet").className = cheDoQuet ? "nutChinh nho" : "nutPhu nho";
    if (cheDoQuet) { chiSoQuet = 0; veQuet(); }
    else veKetQua(dsQuanhDayHT);
  }

  // ---------- Ai đã thích bạn ----------
  function taoTheBiMo(m) {
    var the = document.createElement("div");
    the.className = "theNguoi";
    var av = document.createElement("span");
    av.className = "avatarLon anhMoGhepDoi";
    av.textContent = "🙈";
    var giua = document.createElement("div");
    giua.className = "thongTinNguoi";
    var ten = document.createElement("p");
    ten.className = "tenNguoi";
    ten.textContent = "Một người dùng HIALO";
    var ct = document.createElement("p");
    ct.className = "chiTietNguoi";
    ct.textContent = m.sieu ? "⭐ Đã siêu thích bạn" : "❤️ Đã thích bạn";
    giua.appendChild(ten);
    giua.appendChild(ct);
    the.appendChild(av);
    the.appendChild(giua);
    return the;
  }

  function taiAiThich() {
    goiAPI("/api/ghep-doi/ai-thich", "GET", null, true).then(function (kq) {
      if (!kq.ok) { hienToast(kq.loi || "Không tải được danh sách ai đã thích bạn."); return; }
      var hop = $("dsAiThich");
      hop.innerHTML = "";
      $("trongAiThich").classList.toggle("an", kq.tongSo > 0);
      $("goiYAiThichVip").classList.toggle("an", kq.laVIP === true || kq.tongSo === 0);
      (kq.danhSach || []).forEach(function (m) {
        if (m.biMo) { hop.appendChild(taoTheBiMo(m)); return; }
        var cot = document.createElement("div");
        cot.className = "cotNutDuoi";
        cot.appendChild(taoNutNhan("❤️ Thích lại", "nutChinh nho", function () {
          thichHoSo({ id: m.id, ten: m.nick }, "thuong", function () { taiAiThich(); });
        }));
        cot.appendChild(taoNutNhan("✖ Bỏ qua", "nutPhu nho", function () {
          boQuaHoSo({ id: m.id }, function () { taiAiThich(); });
        }));
        var chiTiet = (m.gioiTinh === "nu" ? "♀ Nữ" : "♂ Nam") + " · " + m.tuoi + " tuổi" +
          (typeof m.khoangCach === "number" ? " · 📍 " + dinhDangKhoangCach(m.khoangCach) : "") +
          (m.mucDich && nhanMucDich(m.mucDich) ? " · " + nhanMucDich(m.mucDich) : "") +
          (m.sieu ? " · ⭐ Siêu thích" : "");
        var the = taoTheNguoi(m.emoji, m.nick, chiTiet, cot);
        ganHuyHieuXacThuc(the, m.xacThuc === true);
        hop.appendChild(the);
      });
    });
  }

  // ---------- Ghép đôi của tôi ----------
  function taiGhepDoiCuaToi() {
    goiAPI("/api/ghep-doi/danh-sach", "GET", null, true).then(function (kq) {
      if (!kq.ok) { hienToast(kq.loi || "Không tải được danh sách ghép đôi."); return; }
      var hop = $("dsGhepDoi");
      hop.innerHTML = "";
      var ds = kq.danhSach || [];
      $("trongGhepDoi").classList.toggle("an", ds.length > 0);
      ds.forEach(function (m) {
        var cot = document.createElement("div");
        cot.className = "cotNutDuoi";
        cot.appendChild(taoNutNhan("💬 Nhắn tin", "nutChinh nho", function () {
          moChat(m.sdt, m.nick, m.emoji, { laBanBe: false, xacThuc: m.xacThuc === true });
        }));
        cot.appendChild(taoNutNhan("✖ Bỏ ghép", "nutPhu nho", function () {
          goiAPI("/api/ghep-doi/bo-thich", "POST", { id: m.id }, true).then(function (kq2) {
            if (!kq2.ok) { hienToast(kq2.loi || "Chưa bỏ ghép được."); return; }
            hienToast("Đã bỏ ghép đôi với " + m.nick);
            taiGhepDoiCuaToi();
            taiTrangThaiGhepDoi();
          });
        }));
        var chiTiet = (m.gioiTinh === "nu" ? "♀ Nữ" : "♂ Nam") + " · " + m.tuoi + " tuổi" +
          (typeof m.khoangCach === "number" ? " · 📍 " + dinhDangKhoangCach(m.khoangCach) : "") +
          (m.mucDich && nhanMucDich(m.mucDich) ? " · " + nhanMucDich(m.mucDich) : "");
        var the = taoTheNguoi(m.emoji, m.nick, chiTiet, cot);
        ganHuyHieuXacThuc(the, m.xacThuc === true);
        hop.appendChild(the);
      });
    });
  }

  // ---------- Boost ----------
  function batBoostHoSo() {
    goiAPI("/api/ghep-doi/boost", "POST", {}, true).then(function (kq) {
      if (!kq.ok) { hienToast(kq.loi || "Chưa Boost được hồ sơ."); return; }
      hienToast("🚀 Đã Boost! Hồ sơ của bạn đứng đầu kết quả tìm quanh đây trong 30 phút.");
      taiTrangThaiGhepDoi();
    });
  }

  // ---------- Passport ----------
  function chonThanhPhoHoChieu() {
    var sel = $("selThanhPhoHoChieu");
    if (!sel) return;
    var opt = sel.options[sel.selectedIndex];
    if (!opt || !opt.getAttribute("data-lat")) return;
    $("inpTenHoChieu").value = opt.textContent;
    $("inpLatHoChieu").value = opt.getAttribute("data-lat");
    $("inpLngHoChieu").value = opt.getAttribute("data-lng");
  }

  function datHoChieuTuForm() {
    var ten = $("inpTenHoChieu").value.trim();
    var lat = parseFloat($("inpLatHoChieu").value);
    var lng = parseFloat($("inpLngHoChieu").value);
    if (!ten || isNaN(lat) || isNaN(lng)) {
      hienToast("Hãy chọn thành phố có sẵn hoặc nhập tên nơi + tọa độ (lat/lng) nhé.");
      return;
    }
    goiAPI("/api/ho-chieu", "POST", { ten: ten, lat: lat, lng: lng }, true).then(function (kq) {
      if (!kq.ok) { hienToast(kq.loi || "Chưa đặt được hộ chiếu."); return; }
      hoChieuDangDung = true;
      hienToast("🧳 Đã bật Hộ chiếu tại " + ten + " — đang tìm quanh vị trí này.");
      taiTrangThaiGhepDoi();
      chayTim();
    });
  }

  function xoaHoChieu() {
    goiAPI("/api/ho-chieu/xoa", "POST", {}, true).then(function (kq) {
      if (!kq.ok) { hienToast(kq.loi || "Chưa xóa được hộ chiếu."); return; }
      hoChieuDangDung = false;
      $("inpTenHoChieu").value = "";
      $("inpLatHoChieu").value = "";
      $("inpLngHoChieu").value = "";
      if ($("selThanhPhoHoChieu")) $("selThanhPhoHoChieu").selectedIndex = 0;
      hienToast("📍 Đã xóa hộ chiếu — quay về tìm theo vị trí thật của bạn.");
      taiTrangThaiGhepDoi();
      chayTim();
    });
  }

  // ======================================================================
  // ===== GÓI 3: HIỆN DIỆN & CỘNG ĐỒNG (khoảnh khắc 24h, điểm danh +   =====
  // ===== điểm thưởng, quà ảo, phòng thoại, thông báo người mới)      =====
  // ======================================================================
  var nhomKKHT = [];        // nguồn khoảnh khắc gần nhất từ máy chủ
  var xemKK = null;         // { nhom, i } đang xem khoảnh khắc
  var anhKKDangChon = null; // File ảnh chờ đăng khoảnh khắc
  var quaDich = null;       // { sdt?, id?, nick } người sắp nhận quà
  var danhMucQuaHT = [];    // danh mục quà từ máy chủ
  var phongHT = null;       // { id, ten, laChu, idCuaToi, pcs:{}, amThanh:{}, iceCho:{}, luongMic, tatMicTu, danhSach:[] }

  function thoiGianConLaiKK(hetLuc) {
    var ms = hetLuc - Date.now();
    if (ms <= 0) return "đã hết hạn";
    var gio = Math.floor(ms / 3600000), phut = Math.round((ms % 3600000) / 60000);
    return gio > 0 ? ("còn " + gio + " giờ" + (phut ? " " + phut + " phút" : "")) : ("còn " + phut + " phút");
  }

  // ---------- Khoảnh khắc ----------
  function taiKhoanhKhac() {
    if (!TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/khoanh-khac", "GET", null, true).then(function (kq) {
      if (!kq.ok) return;
      nhomKKHT = kq.nhom || [];
      veHangKhoanhKhac();
    });
  }

  function veHangKhoanhKhac() {
    var hang = $("hangKhoanhKhac");
    if (!hang) return;
    hang.innerHTML = "";
    var nhomCuaToi = null;
    nhomKKHT.forEach(function (n) { if (n.cuaToi) nhomCuaToi = n; });
    // Ô của tôi (luôn đầu hàng): bấm avatar xem lại, bấm dấu + đăng mới
    var oToi = document.createElement("button");
    oToi.type = "button"; oToi.className = "oKhoanhKhac";
    var vongToi = document.createElement("span");
    vongToi.className = "vongKK cuaToi";
    vongToi.textContent = nhomCuaToi ? (nhomCuaToi.emoji || "😀") : "📸";
    var cong = document.createElement("span");
    cong.className = "dauCongKK"; cong.textContent = "+";
    vongToi.appendChild(cong);
    var tenToi = document.createElement("span");
    tenToi.className = "tenKK"; tenToi.textContent = "Của bạn";
    oToi.appendChild(vongToi); oToi.appendChild(tenToi);
    oToi.addEventListener("click", function (e) {
      if (nhomCuaToi) moXemKhoanhKhac(nhomCuaToi, 0);
      else moHopDangKK();
    });
    cong.addEventListener("click", function (e) { e.stopPropagation(); moHopDangKK(); });
    hang.appendChild(oToi);
    nhomKKHT.forEach(function (n) {
      if (n.cuaToi) return;
      var o = document.createElement("button");
      o.type = "button"; o.className = "oKhoanhKhac";
      var v = document.createElement("span");
      v.className = "vongKK" + (n.chuaXem > 0 ? " chuaXem" : "");
      v.textContent = n.emoji || "😀";
      var t = document.createElement("span");
      t.className = "tenKK"; t.textContent = n.nick || "";
      o.appendChild(v); o.appendChild(t);
      o.addEventListener("click", function () { moXemKhoanhKhac(n, 0); });
      hang.appendChild(o);
    });
    $("trongKhoanhKhac").classList.toggle("an", nhomKKHT.length > 0);
  }

  function moHopDangKK() {
    $("hopDangKhoanhKhac").classList.remove("an");
    $("inpChuKhoanhKhac").focus();
  }
  function dongHopDangKK() {
    $("hopDangKhoanhKhac").classList.add("an");
    anhKKDangChon = null;
    $("inpChuKhoanhKhac").value = "";
    $("tenAnhKhoanhKhac").textContent = "Chưa chọn ảnh (đăng chữ không cũng được)";
    $("btnBoAnhKhoanhKhac").classList.add("an");
  }

  function dangKhoanhKhac() {
    var chu = $("inpChuKhoanhKhac").value.trim();
    var gui = function (tepId) {
      goiAPI("/api/khoanh-khac", "POST", { tepId: tepId || "", chu: chu }, true).then(function (kq) {
        if (!kq.ok) { hienToast(kq.loi || "Chưa đăng được khoảnh khắc."); return; }
        dongHopDangKK();
        hienToast("📸 Đã đăng khoảnh khắc — sẽ tự biến mất sau 24 giờ.");
        taiKhoanhKhac();
      });
    };
    if (anhKKDangChon) {
      taiTepRiengLen(anhKKDangChon, "khoanh-khac").then(function (up) {
        if (!up.ok) { hienToast(up.loi || "Chưa tải được ảnh lên."); return; }
        gui(up.tepId);
      });
    } else {
      if (!chu) { hienToast("Hãy chọn ảnh hoặc viết đôi dòng cho khoảnh khắc nhé."); return; }
      gui("");
    }
  }

  function moXemKhoanhKhac(nhom, i) {
    if (!nhom || !nhom.khoanhKhac || !nhom.khoanhKhac.length) return;
    xemKK = { nhom: nhom, i: Math.max(0, Math.min(i, nhom.khoanhKhac.length - 1)) };
    $("manXemKhoanhKhac").classList.remove("an");
    veXemKhoanhKhac();
  }
  function dongXemKhoanhKhac() {
    $("manXemKhoanhKhac").classList.add("an");
    xemKK = null;
    taiKhoanhKhac();
  }
  function veXemKhoanhKhac() {
    if (!xemKK) return;
    var n = xemKK.nhom, k = n.khoanhKhac[xemKK.i];
    if (!k) return;
    $("avatarXemKK").textContent = n.emoji || "😀";
    $("tenXemKK").textContent = (n.nick || "") + (n.xacThuc ? " ✅" : "") + " · " + (xemKK.i + 1) + "/" + n.khoanhKhac.length;
    $("gioXemKK").textContent = dinhDangGio(k.luc) + " · " + thoiGianConLaiKK(k.hetLuc);
    var anh = $("anhXemKK");
    if (k.tepId) { anh.src = duongDanTep(k.tepId); anh.classList.remove("an"); }
    else { anh.classList.add("an"); anh.removeAttribute("src"); }
    $("chuXemKK").textContent = k.chu || "";
    $("btnKKTrangTruoc").disabled = xemKK.i <= 0;
    $("btnKKTiepTheo").disabled = xemKK.i >= n.khoanhKhac.length - 1;
    $("btnXoaKK").classList.toggle("an", !n.cuaToi);
    var hopXem = $("dsNguoiXemKK");
    hopXem.innerHTML = "";
    $("txtNguoiXemKK").classList.add("an");
    if (n.cuaToi) {
      // Chính chủ: tải danh sách người đã xem của khoảnh khắc này
      goiAPI("/api/khoanh-khac/cua-toi", "GET", null, true).then(function (kq) {
        if (!kq.ok || !xemKK) return;
        var cuaToi = (kq.khoanhKhac || []).filter(function (x) { return x.id === k.id; })[0];
        if (!cuaToi) return;
        $("txtNguoiXemKK").textContent = "👁 " + (cuaToi.soNguoiXem || 0) + " người đã xem khoảnh khắc này";
        $("txtNguoiXemKK").classList.remove("an");
        (cuaToi.nguoiXem || []).forEach(function (ng) {
          hopXem.appendChild(taoTheNguoi(ng.emoji, ng.nick, "Đã xem lúc " + dinhDangGio(ng.luc), null));
        });
      });
    } else if (!k.daXemBoiToi) {
      goiAPI("/api/khoanh-khac/xem", "POST", { id: k.id }, true).then(function (kq) {
        if (kq.ok) k.daXemBoiToi = true;
      });
    }
  }

  // ---------- Thông báo ----------
  function taiThongBao() {
    if (!TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/thong-bao", "GET", null, true).then(function (kq) {
      if (!kq.ok) return;
      var ds = kq.thongBao || [];
      var hop = $("dsThongBao");
      hop.innerHTML = "";
      ds.forEach(function (t) {
        var the = document.createElement("div");
        the.className = "theThongBao" + (!t.daDoc ? " chuaDocTB" : "");
        var ic = document.createElement("span");
        ic.className = "avatarChat";
        ic.textContent = t.loai === "nguoi-moi" ? "🆕" : "🔔";
        var giua = document.createElement("div");
        giua.className = "thongTinNguoi";
        var nd = document.createElement("p");
        nd.className = "tenNguoi"; nd.textContent = t.noiDung;
        var tg = document.createElement("p");
        tg.className = "chiTietNguoi"; tg.textContent = dinhDangGio(t.luc);
        giua.appendChild(nd); giua.appendChild(tg);
        the.appendChild(ic); the.appendChild(giua);
        hop.appendChild(the);
      });
      $("trongThongBao").classList.toggle("an", ds.length > 0);
      var huy = $("huySoThongBao");
      huy.textContent = kq.chuaDoc || 0;
      huy.classList.toggle("an", !(kq.chuaDoc > 0));
      if (kq.chuaDoc > 0) {
        // Đã hiện cho người dùng thấy -> đánh dấu đã đọc ở máy chủ
        goiAPI("/api/thong-bao/da-doc", "POST", {}, true);
      }
    });
  }

  // ---------- Điểm danh + điểm thưởng + quà ----------
  function taiDiemThuong() {
    if (!TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/diem", "GET", null, true).then(function (kq) {
      if (!kq.ok) return;
      var chuoi = kq.chuoi || 0;
      var dong = "🔥 Chuỗi điểm danh: " + chuoi + " ngày · ⭐ Điểm thưởng: " + (kq.diem || 0);
      if (kq.mocTiepTheo) dong += " · Đạt " + kq.mocTiepTheo + " ngày liên tiếp được +" + kq.thuongMocTiep + " điểm";
      $("txtTrangThaiDiem").textContent = dong;
      var nut = $("btnDiemDanh");
      nut.disabled = !!kq.daDiemDanhHomNay;
      nut.textContent = kq.daDiemDanhHomNay ? "✅ Hôm nay đã điểm danh" : "✅ Điểm danh hôm nay (+" + (kq.diemDanhDuoc || 10) + " điểm)";
      var lt = kq.luotThem || {};
      $("txtLuotThem").textContent = "Lượt đổi bằng điểm đang có: ⭐ Siêu thích +" + (lt.sieuThich || 0) + " · 🚀 Boost +" + (lt.boost || 0) + " (tự dùng khi hết lượt thường trong ngày).";
    });
    goiAPI("/api/qua-tang/danh-muc", "GET", null, true).then(function (kq) {
      if (!kq.ok) return;
      danhMucQuaHT = kq.danhMuc || [];
      $("txtTongQuaNhan").textContent = kq.tongQuaNhan || 0;
      var hop = $("dsQuaGanDay");
      hop.innerHTML = "";
      (kq.quaGanDay || []).forEach(function (q) {
        hop.appendChild(taoTheNguoi(q.emoji, q.ten, "Từ " + (q.nguoiTang.nick || "một người bạn") + " · " + dinhDangGio(q.luc), null));
      });
    });
  }

  function diemDanhHomNay() {
    goiAPI("/api/diem/diem-danh", "POST", {}, true).then(function (kq) {
      if (!kq.ok) { hienToast(kq.loi || "Chưa điểm danh được."); return; }
      var msg = "✅ Điểm danh thành công: +" + (kq.diemVuaNhan || 10) + " điểm";
      if (kq.thuongMocVuaNhan > 0) msg += " + thưởng mốc chuỗi " + (kq.chuoi || 0) + " ngày: +" + kq.thuongMocVuaNhan + " điểm 🎉";
      hienToast(msg);
      taiDiemThuong();
      taiTrangThaiGhepDoi();
    });
  }

  function doiDiemThuong(loai) {
    goiAPI("/api/diem/doi", "POST", { loai: loai }, true).then(function (kq) {
      if (!kq.ok) { hienToast(kq.loi || "Chưa đổi được điểm."); return; }
      hienToast(loai === "boost" ? "🚀 Đã đổi +1 lượt Boost — dùng ở mục Ghép đôi nhé." : "⭐ Đã đổi +1 lượt Siêu thích.");
      taiDiemThuong();
      taiTrangThaiGhepDoi();
    });
  }

  // ---------- Tặng quà ----------
  function moChonQua(dich) {
    if (!TQD_SERVER || !tokenMayChu) return;
    quaDich = dich;
    $("tenNguoiNhanQua").textContent = dich.nick || "";
    $("inpLoiNhanQua").value = "";
    $("hopChonQua").classList.remove("an");
    goiAPI("/api/qua-tang/danh-muc", "GET", null, true).then(function (kq) {
      if (!kq.ok) return;
      danhMucQuaHT = kq.danhMuc || [];
      $("txtDiemKhiTangQua").textContent = kq.diem || 0;
      veLuoiQua();
    });
  }
  function dongChonQua() {
    $("hopChonQua").classList.add("an");
    quaDich = null;
  }
  function veLuoiQua() {
    var luoi = $("luoiQua");
    luoi.innerHTML = "";
    danhMucQuaHT.forEach(function (q) {
      var o = document.createElement("button");
      o.type = "button"; o.className = "oQua";
      var e = document.createElement("span"); e.className = "emojiQua"; e.textContent = q.emoji;
      var t = document.createElement("span"); t.textContent = q.ten;
      var g = document.createElement("span"); g.className = "giaQua"; g.textContent = q.gia + " điểm";
      o.appendChild(e); o.appendChild(t); o.appendChild(g);
      o.addEventListener("click", function () { guiQua(q); });
      luoi.appendChild(o);
    });
  }
  function guiQua(q) {
    if (!quaDich) return;
    var than = { quaId: q.id, loiNhan: $("inpLoiNhanQua").value.trim() };
    if (quaDich.sdt) than.sdt = quaDich.sdt;
    else if (quaDich.id) than.id = quaDich.id;
    var dichLucGui = quaDich;
    goiAPI("/api/qua-tang", "POST", than, true).then(function (kq) {
      if (!kq.ok) { hienToast(kq.loi || "Chưa tặng được quà."); return; }
      hienToast("🎁 Đã tặng " + q.ten + " cho " + (dichLucGui.nick || "người ấy") + "!");
      dongChonQua();
      taiDiemThuong();
      // Đang ở đúng màn chat với người nhận -> hiện thẻ quà ngay
      if (chatVoi && kq.tin && ((dichLucGui.sdt && chatVoi.sdt === dichLucGui.sdt))) {
        themBongBong(kq.tin);
        if (kq.tin.tg > chatSince) chatSince = kq.tin.tg;
      }
    });
  }

  // ---------- Phòng thoại ----------
  function taiPhongThoai() {
    if (!TQD_SERVER || !tokenMayChu) return;
    var qs = (viTri && typeof viTri.lat === "number") ? ("?lat=" + encodeURIComponent(viTri.lat) + "&lng=" + encodeURIComponent(viTri.lng)) : "";
    goiAPI("/api/phong-thoai" + qs, "GET", null, true).then(function (kq) {
      if (!kq.ok) return;
      var hop = $("dsPhongThoai");
      hop.innerHTML = "";
      var ds = kq.phong || [];
      ds.forEach(function (p) {
        var the = document.createElement("div");
        the.className = "thePhongThoai";
        var ic = document.createElement("span");
        ic.className = "avatarChat"; ic.textContent = "🎙️";
        var giua = document.createElement("div");
        giua.className = "thongTinNguoi";
        var ten = document.createElement("p");
        ten.className = "tenNguoi"; ten.textContent = p.ten;
        var ct = document.createElement("p");
        ct.className = "chiTietNguoi";
        ct.textContent = "📍 " + p.khuVucTen + " · 👥 " + p.soNguoi + "/" + (kq.toiDaNguoi || 8) +
          " · Chủ phòng: " + (p.chuPhong.nick || "") + (p.chuDe ? " · " + p.chuDe : "");
        giua.appendChild(ten); giua.appendChild(ct);
        var nutVao = document.createElement("button");
        nutVao.type = "button"; nutVao.className = "nutChinh nho"; nutVao.textContent = "Vào phòng";
        nutVao.addEventListener("click", function () { vaoPhongThoai(p); });
        the.appendChild(ic); the.appendChild(giua); the.appendChild(nutVao);
        if (p.cuaToi) {
          var nutDong = document.createElement("button");
          nutDong.type = "button"; nutDong.className = "nutPhu nho nutDangXuat"; nutDong.textContent = "Đóng";
          nutDong.addEventListener("click", function () {
            goiAPI("/api/phong-thoai/dong", "POST", { id: p.id }, true).then(function (kq2) {
              if (!kq2.ok) { hienToast(kq2.loi || "Chưa đóng được phòng."); return; }
              hienToast("Đã đóng phòng thoại.");
              taiPhongThoai();
            });
          });
          the.appendChild(nutDong);
        }
        hop.appendChild(the);
      });
      $("trongPhongThoai").classList.toggle("an", ds.length > 0);
    });
  }

  function taoPhongThoaiMoi() {
    var ten = $("inpTenPhong").value.trim();
    if (!ten) { hienToast("Hãy đặt tên cho phòng thoại nhé."); return; }
    var than = { ten: ten, chuDe: $("inpChuDePhong").value.trim() };
    if (viTri && typeof viTri.lat === "number" && !viTri.macDinh) { than.lat = viTri.lat; than.lng = viTri.lng; }
    goiAPI("/api/phong-thoai", "POST", than, true).then(function (kq) {
      if (!kq.ok) { hienToast(kq.loi || "Chưa tạo được phòng."); return; }
      $("hopTaoPhong").classList.add("an");
      $("inpTenPhong").value = ""; $("inpChuDePhong").value = "";
      taiPhongThoai();
      vaoPhongThoai(kq.phong);
    });
  }

  function guiTinHieuKhiSanSang(obj, soLan) {
    if (guiTinHieu(obj)) return;
    if ((soLan || 0) >= 6) { hienToast("Chưa kết nối được kênh thoại. Kiểm tra mạng rồi thử lại nhé."); roiPhongCucBo(); return; }
    ketNoiTinHieu();
    setTimeout(function () { if (phongHT) guiTinHieuKhiSanSang(obj, (soLan || 0) + 1); }, 700);
  }

  function vaoPhongThoai(p) {
    if (!p || phongHT) return;
    if (goiHT) { hienToast("Bạn đang trong cuộc gọi 1-1 — hãy kết thúc cuộc gọi trước khi vào phòng thoại nhé."); return; }
    if (!hoTroGoi()) { hienToast("Thiết bị/trình duyệt này chưa hỗ trợ gọi thoại."); return; }
    taiCauHinhICE();
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (luong) {
      phongHT = {
        id: p.id, ten: p.ten, chuDe: p.chuDe || "", laChu: !!p.cuaToi,
        idCuaToi: "", pcs: {}, amThanh: {}, iceCho: {}, danhSach: [],
        luongMic: luong, tatMicTu: false, tatMicBoiChu: false
      };
      $("tenPhongDangO").textContent = "🎙️ " + p.ten;
      $("chuDePhongDangO").textContent = "📍 " + (p.khuVucTen || "") + (p.chuDe ? " · " + p.chuDe : "");
      $("loiPhong").textContent = "";
      $("btnDongPhong").classList.toggle("an", !phongHT.laChu);
      $("manPhongThoai").classList.remove("an");
      capNhatNutMicPhong();
      ketNoiTinHieu();
      guiTinHieuKhiSanSang({ loaiTin: "phong-vao", phongId: p.id }, 0);
    }).catch(function (e) {
      hienToast(loiQuyenMedia(e, "thoai"));
    });
  }

  function phongTaoPC(idBan, chuDong) {
    if (!phongHT || phongHT.pcs[idBan]) return phongHT && phongHT.pcs[idBan];
    var pc = new RTCPeerConnection({ iceServers: cauHinhICEHT });
    phongHT.pcs[idBan] = pc;
    if (phongHT.luongMic) {
      phongHT.luongMic.getAudioTracks().forEach(function (tr) { pc.addTrack(tr, phongHT.luongMic); });
    }
    pc.onicecandidate = function (ev) {
      if (ev.candidate) guiTinHieu({ loaiTin: "phong-ice", phongId: phongHT.id, denId: idBan, candidate: ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate });
    };
    pc.ontrack = function (ev) {
      if (!phongHT) return;
      var au = phongHT.amThanh[idBan];
      if (!au) {
        au = document.createElement("audio");
        au.autoplay = true; au.setAttribute("playsinline", "");
        document.body.appendChild(au);
        phongHT.amThanh[idBan] = au;
      }
      if (ev.streams && ev.streams[0]) au.srcObject = ev.streams[0];
    };
    pc.onconnectionstatechange = function () {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") phongDongPC(idBan);
    };
    if (chuDong) {
      pc.createOffer().then(function (offer) { return pc.setLocalDescription(offer); }).then(function () {
        guiTinHieu({ loaiTin: "phong-offer", phongId: phongHT.id, denId: idBan, offer: pc.localDescription });
      }).catch(function () {});
    }
    return pc;
  }
  function phongDongPC(idBan) {
    if (!phongHT) return;
    var pc = phongHT.pcs[idBan];
    if (pc) { try { pc.close(); } catch (e) {} delete phongHT.pcs[idBan]; }
    var au = phongHT.amThanh[idBan];
    if (au) { try { au.srcObject = null; au.remove(); } catch (e) {} delete phongHT.amThanh[idBan]; }
    delete phongHT.iceCho[idBan];
  }
  function phongNapIce(idBan) {
    if (!phongHT) return;
    var pc = phongHT.pcs[idBan];
    var hang = phongHT.iceCho[idBan] || [];
    if (!pc || !pc.remoteDescription) return;
    while (hang.length) {
      var c = hang.shift();
      try { pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) {}
    }
  }
  function apTrangThaiMicPhong() {
    if (!phongHT || !phongHT.luongMic) return;
    var bat = !phongHT.tatMicTu && !phongHT.tatMicBoiChu;
    phongHT.luongMic.getAudioTracks().forEach(function (tr) { tr.enabled = bat; });
    capNhatNutMicPhong();
  }
  function capNhatNutMicPhong() {
    var nut = $("btnMicPhong");
    if (!nut || !phongHT) return;
    if (phongHT.tatMicBoiChu) { nut.textContent = "🔇 Chủ phòng đã tắt mic"; nut.disabled = true; }
    else { nut.disabled = false; nut.textContent = phongHT.tatMicTu ? "🔇 Mic đang tắt" : "🎤 Mic đang bật"; }
  }
  function veThanhVienPhong() {
    if (!phongHT) return;
    var hop = $("dsThanhVienPhong");
    hop.innerHTML = "";
    phongHT.danhSach.forEach(function (tv) {
      var nutPhai = null;
      if (phongHT.laChu && tv.id !== phongHT.idCuaToi) {
        nutPhai = document.createElement("button");
        nutPhai.type = "button"; nutPhai.className = "nutPhu nho";
        nutPhai.textContent = tv.tatMicBoiChu ? "🔊 Bật mic" : "🔇 Tắt mic";
        (function (tv2, nut2) {
          nut2.addEventListener("click", function () {
            guiTinHieu({ loaiTin: "phong-tat-mic", phongId: phongHT.id, denId: tv2.id, tat: !tv2.tatMicBoiChu });
          });
        })(tv, nutPhai);
      }
      var chiTiet = (tv.chuPhong ? "👑 Chủ phòng · " : "") + ((tv.tatMicTu || tv.tatMicBoiChu) ? "🔇 Đang tắt mic" : "🎤 Đang mở mic");
      hop.appendChild(taoTheNguoi(tv.emoji, tv.nick, chiTiet, nutPhai));
    });
  }
  function roiPhongCucBo() {
    if (!phongHT) return;
    Object.keys(phongHT.pcs).forEach(function (id) { phongDongPC(id); });
    if (phongHT.luongMic) phongHT.luongMic.getTracks().forEach(function (tr) { try { tr.stop(); } catch (e) {} });
    phongHT = null;
    $("manPhongThoai").classList.add("an");
  }
  function roiPhongThoai() {
    if (!phongHT) return;
    var laChu = phongHT.laChu;
    guiTinHieu({ loaiTin: "phong-roi", phongId: phongHT.id });
    roiPhongCucBo();
    if (laChu) hienToast("Bạn rời phòng — phòng thoại đã đóng cho mọi người.");
    taiPhongThoai();
  }

  function xuLyTinPhong(msg) {
    if (!phongHT) {
      // Chưa ở trong phòng nhưng chủ phòng đóng phòng mình đang xem danh sách -> làm mới
      if (msg.loaiTin === "phong-dong") taiPhongThoai();
      return;
    }
    if (msg.phongId && msg.phongId !== phongHT.id) return;
    if (msg.loaiTin === "phong-vao-ok") {
      phongHT.idCuaToi = msg.idCuaToi || "";
      phongHT.laChu = !!msg.chuPhong;
      phongHT.danhSach = msg.danhSach || [];
      $("btnDongPhong").classList.toggle("an", !phongHT.laChu);
      veThanhVienPhong();
      return;
    }
    if (msg.loaiTin === "phong-nguoi-vao") {
      if (msg.nguoi && msg.nguoi.id && msg.nguoi.id !== phongHT.idCuaToi) phongTaoPC(msg.nguoi.id, true);
      return;
    }
    if (msg.loaiTin === "phong-offer") {
      var pcNhan = phongTaoPC(msg.tuId, false);
      if (!pcNhan) return;
      pcNhan.setRemoteDescription(new RTCSessionDescription(msg.offer)).then(function () {
        phongNapIce(msg.tuId);
        return pcNhan.createAnswer();
      }).then(function (ans) { return pcNhan.setLocalDescription(ans); }).then(function () {
        guiTinHieu({ loaiTin: "phong-tra-loi", phongId: phongHT.id, denId: msg.tuId, answer: pcNhan.localDescription });
      }).catch(function () {});
      return;
    }
    if (msg.loaiTin === "phong-tra-loi") {
      var pcTra = phongHT.pcs[msg.tuId];
      if (pcTra) {
        pcTra.setRemoteDescription(new RTCSessionDescription(msg.answer)).then(function () { phongNapIce(msg.tuId); }).catch(function () {});
      }
      return;
    }
    if (msg.loaiTin === "phong-ice") {
      if (!msg.candidate) return;
      if (!phongHT.iceCho[msg.tuId]) phongHT.iceCho[msg.tuId] = [];
      phongHT.iceCho[msg.tuId].push(msg.candidate);
      phongNapIce(msg.tuId);
      return;
    }
    if (msg.loaiTin === "phong-nguoi-roi") { phongDongPC(msg.id); return; }
    if (msg.loaiTin === "phong-danh-sach") { phongHT.danhSach = msg.danhSach || []; veThanhVienPhong(); return; }
    if (msg.loaiTin === "phong-mic") {
      phongHT.danhSach.forEach(function (tv) {
        if (tv.id === msg.id) { tv.tatMicTu = msg.tatMicTu; tv.tatMicBoiChu = msg.tatMicBoiChu; }
      });
      if (msg.id === phongHT.idCuaToi) {
        var biChuTat = msg.tatMicBoiChu && !phongHT.tatMicBoiChu;
        phongHT.tatMicBoiChu = !!msg.tatMicBoiChu;
        phongHT.tatMicTu = !!msg.tatMicTu;
        apTrangThaiMicPhong();
        if (biChuTat) hienToast("👑 Chủ phòng đã tắt mic của bạn.");
      }
      veThanhVienPhong();
      return;
    }
    if (msg.loaiTin === "phong-dong") {
      hienToast("Chủ phòng đã đóng phòng thoại.");
      roiPhongCucBo();
      taiPhongThoai();
      return;
    }
  }

  function ganSuKienGoi3() {
    // Khoảnh khắc
    $("btnChonAnhKhoanhKhac").addEventListener("click", function () { $("inpAnhKhoanhKhac").click(); });
    $("inpAnhKhoanhKhac").addEventListener("change", function () {
      anhKKDangChon = this.files && this.files[0] ? this.files[0] : null;
      $("tenAnhKhoanhKhac").textContent = anhKKDangChon ? ("Đã chọn: " + anhKKDangChon.name) : "Chưa chọn ảnh (đăng chữ không cũng được)";
      $("btnBoAnhKhoanhKhac").classList.toggle("an", !anhKKDangChon);
    });
    $("btnBoAnhKhoanhKhac").addEventListener("click", function () {
      anhKKDangChon = null; $("inpAnhKhoanhKhac").value = "";
      $("tenAnhKhoanhKhac").textContent = "Chưa chọn ảnh (đăng chữ không cũng được)";
      $("btnBoAnhKhoanhKhac").classList.add("an");
    });
    $("btnDangKhoanhKhac").addEventListener("click", dangKhoanhKhac);
    $("btnHuyDangKhoanhKhac").addEventListener("click", dongHopDangKK);
    $("btnDongXemKK").addEventListener("click", dongXemKhoanhKhac);
    $("btnKKTrangTruoc").addEventListener("click", function () { if (xemKK && xemKK.i > 0) { xemKK.i--; veXemKhoanhKhac(); } });
    $("btnKKTiepTheo").addEventListener("click", function () { if (xemKK && xemKK.i < xemKK.nhom.khoanhKhac.length - 1) { xemKK.i++; veXemKhoanhKhac(); } });
    $("btnXoaKK").addEventListener("click", function () {
      if (!xemKK) return;
      var k = xemKK.nhom.khoanhKhac[xemKK.i];
      if (!k) return;
      goiAPI("/api/khoanh-khac/xoa", "POST", { id: k.id }, true).then(function (kq) {
        if (!kq.ok) { hienToast(kq.loi || "Chưa xóa được khoảnh khắc."); return; }
        hienToast("Đã xóa khoảnh khắc.");
        dongXemKhoanhKhac();
      });
    });
    // Điểm danh + đổi điểm
    $("btnDiemDanh").addEventListener("click", diemDanhHomNay);
    $("btnDoiSieuThich").addEventListener("click", function () { doiDiemThuong("sieu-thich"); });
    $("btnDoiBoost").addEventListener("click", function () { doiDiemThuong("boost"); });
    // Quà trong chat
    $("btnTangQuaTrongChat").addEventListener("click", function () {
      if (chatVoi) moChonQua({ sdt: chatVoi.sdt, nick: chatVoi.nick });
    });
    $("btnDongChonQua").addEventListener("click", dongChonQua);
    // Phòng thoại
    $("btnLamMoiPhong").addEventListener("click", taiPhongThoai);
    $("btnMoTaoPhong").addEventListener("click", function () { $("hopTaoPhong").classList.remove("an"); $("inpTenPhong").focus(); });
    $("btnHuyTaoPhong").addEventListener("click", function () { $("hopTaoPhong").classList.add("an"); });
    $("btnTaoPhong").addEventListener("click", taoPhongThoaiMoi);
    $("btnRoiPhong").addEventListener("click", roiPhongThoai);
    $("btnDongPhong").addEventListener("click", function () {
      if (!phongHT) return;
      guiTinHieu({ loaiTin: "phong-dong", phongId: phongHT.id });
      roiPhongCucBo();
      taiPhongThoai();
    });
    $("btnMicPhong").addEventListener("click", function () {
      if (!phongHT || phongHT.tatMicBoiChu) return;
      phongHT.tatMicTu = !phongHT.tatMicTu;
      apTrangThaiMicPhong();
      guiTinHieu({ loaiTin: "phong-mic-tu", phongId: phongHT.id, tat: phongHT.tatMicTu });
    });
  }
  document.addEventListener("DOMContentLoaded", function () { ganSuKienGoi3(); });

  // ======================================================================
  // ===== V4: KHUNG 5 TAB + TẦNG XÃ HỘI (chỉ bật khi TQD_SERVER có URL) =====
  // ======================================================================
  var CAC_TAB = ["tinnhan", "danhba", "khampha", "tuongnha", "canhan"];
  var ID_TAB = {
    tinnhan: "tabTinNhan", danhba: "tabDanhBa", khampha: "tabKhamPha",
    tuongnha: "tabTuongNha", canhan: "tabCaNhan"
  };
  var tabDangChon = "khampha";       // tab mặc định: Khám phá
  var hetPhienVuaXayRa = false;   // V7.1: co bao vua bi may chu cat phien (401)
  var chatVoi = null;                // { sdt, nick, emoji } đang trò chuyện
  var chatSince = 0;                 // mốc tg tin nhắn mới nhất đã hiện trong màn chat
  var chatSuaSince = 0;              // Gói 4: mốc suaLuc đã đồng bộ (tin bị thu hồi / tự huỷ)
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
      khoiTaoPlayBilling(); // PLAY BILLING: chỉ bật trong bản app ?play=1 có Digital Goods API
      // Gói 3: tab mặc định là Khám phá -> nạp sẵn khoảnh khắc/thông báo/điểm/phòng
      taiKhoanhKhac(); taiThongBao(); taiDiemThuong(); taiPhongThoai();
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
    if (ten === "khampha") { // Gói 2 + Gói 3
      taiTrangThaiGhepDoi();
      taiKhoanhKhac(); taiThongBao(); taiDiemThuong(); taiPhongThoai();
    }
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
        nut = taoNutNhan("💬 Nhắn tin", "nutChinh nho", function () { moChat(sdt, kq.nick, kq.emoji, { laBanBe: true, xacThuc: kq.xacThuc === true }); });
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
      var cotNutTim = document.createElement("div");
      cotNutTim.className = "hangHaiNut";
      cotNutTim.appendChild(nut);
      cotNutTim.appendChild(taoNutNhan("🚩", "nutPhu nho", function () { baoCaoNguoi(sdt, kq.nick); }));
      var theTim = taoTheNguoi(kq.emoji, kq.nick,
        (kq.gioiTinh === "nu" ? "♀ Nữ" : "♂ Nam") + " · " + kq.tuoi + " tuổi", cotNutTim);
      ganHuyHieuXacThuc(theTim, kq.xacThuc === true);
      hop.appendChild(theTim);
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
        cot.appendChild(taoNutNhan("🚩", "nutPhu nho", function () { baoCaoNguoi(m.sdt, m.nick); }));
        var theMoi = taoTheNguoi(m.emoji, m.nick,
          (m.gioiTinh === "nu" ? "♀ Nữ" : "♂ Nam") + " · " + m.tuoi + " tuổi", cot);
        ganHuyHieuXacThuc(theMoi, m.xacThuc === true);
        hop.appendChild(theMoi);
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
        ganHuyHieuXacThuc(the, b.xacThuc === true);
        the.classList.add("bamDuoc");
        the.addEventListener("click", function () { moChat(b.sdt, b.nick, b.emoji, { laBanBe: true, xacThuc: b.xacThuc === true }); });
        hop.appendChild(the);
      });
    });
  }

  // ---------- Gói 1: huy hiệu xác thực, báo cáo, tin nhắn chờ, xác thực hồ sơ ----------
  // Gắn huy hiệu ✅ vào thẻ người (nếu hồ sơ đã xác thực)
  function ganHuyHieuXacThuc(the, xacThuc) {
    if (!xacThuc || !the) return;
    var ten = the.querySelector(".tenNguoi");
    if (!ten) return;
    var huy = document.createElement("span");
    huy.className = "huyHieuXacThuc";
    huy.textContent = " ✅";
    huy.title = "Hồ sơ đã xác thực";
    ten.appendChild(huy);
  }

  // Báo cáo một người dùng — máy chủ lưu lại cho quản trị viên xử lý
  function baoCaoNguoi(sdt, nick) {
    var ten = nick || sdt;
    var lyDo = window.prompt("Báo cáo " + ten + " vì lý do gì?\n(Ví dụ: quấy rối, lừa đảo, nội dung phản cảm, giả mạo…)", "");
    if (lyDo === null) return;
    goiAPI("/api/bao-cao", "POST", { sdt: sdt, lyDo: lyDo }, true).then(function (kq) {
      if (!kq.ok) { hienToast(kq.loi || "Chưa gửi được báo cáo."); return; }
      hienToast("Đã gửi báo cáo. Cảm ơn bạn — đội ngũ sẽ xem xét 🚩");
    });
  }

  // ----- Tin nhắn chờ -----
  var dsTinChoHT = [];
  function taiSoTinCho() {
    if (!TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/tin-nhan/cho", "GET", null, true).then(function (kq) {
      if (!kq.ok) return;
      dsTinChoHT = kq.tinCho || [];
      var btn = $("btnMoTinCho");
      if (!btn) return;
      btn.classList.toggle("an", dsTinChoHT.length === 0);
      var tong = 0;
      dsTinChoHT.forEach(function (m) { tong += m.soTin || 0; });
      $("soTinCho").textContent = tong ? "(" + tong + " tin)" : "";
    });
  }

  function moManTinCho() {
    hienManTinNhan("manTinCho");
    veDsTinCho();
    taiSoTinCho();
  }

  function veDsTinCho() {
    var hop = $("dsTinCho");
    if (!hop) return;
    hop.innerHTML = "";
    $("trongTinCho").classList.toggle("an", dsTinChoHT.length > 0);
    dsTinChoHT.forEach(function (m) {
      var cot = document.createElement("div");
      cot.className = "hangHaiNut";
      cot.appendChild(taoNutNhan("✔ Đồng ý & xem tin", "nutChinh nho", function () { traLoiTinCho(m, true); }));
      cot.appendChild(taoNutNhan("🗑 Xóa", "nutPhu nho", function () { traLoiTinCho(m, false); }));
      var the = taoTheNguoi(m.emoji, m.nick,
        (m.gioiTinh === "nu" ? "♀ Nữ" : "♂ Nam") + " · " + m.tuoi + " tuổi · " + m.soTin + " tin chờ · “" + (m.tinCuoi.noiDung || "") + "”",
        cot);
      ganHuyHieuXacThuc(the, m.xacThuc === true);
      hop.appendChild(the);
    });
  }

  function traLoiTinCho(m, chapNhan) {
    goiAPI("/api/tin-nhan/cho/tra-loi", "POST", { sdt: m.sdt, chapNhan: chapNhan }, true).then(function (kq) {
      if (!kq.ok) { hienToast(kq.loi || "Chưa xử lý được."); return; }
      dsTinChoHT = dsTinChoHT.filter(function (x) { return x.sdt !== m.sdt; });
      taiSoTinCho();
      if (chapNhan) {
        hienToast("Đã đồng ý trò chuyện với " + m.nick + " 💬");
        moChat(m.sdt, m.nick, m.emoji, { laBanBe: false, xacThuc: m.xacThuc === true });
      } else {
        hienToast("Đã xóa tin chờ của " + m.nick);
        veDsTinCho();
      }
    });
  }

  // ----- Xác thực hồ sơ bằng selfie -----
  function taiTrangThaiXacThuc() {
    if (!TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/xac-thuc", "GET", null, true).then(function (kq) {
      var el = $("trangThaiXacThucHoSo");
      if (!el) return;
      var khu = $("khuGuiXacThuc");
      if (!kq.ok) { el.textContent = "Chưa tải được trạng thái xác thực."; return; }
      if (kq.trangThai === "da") {
        el.textContent = "✅ Hồ sơ của bạn ĐÃ được xác thực — huy hiệu ✅ đang hiện cạnh tên bạn ở mọi nơi.";
        if (khu) khu.classList.add("an");
      } else if (kq.trangThai === "cho") {
        el.textContent = "⏳ Ảnh selfie của bạn đang chờ duyệt. Đội ngũ sẽ xem trong vòng 24 giờ.";
        if (khu) khu.classList.add("an");
      } else if (kq.trangThai === "tu-choi") {
        el.textContent = "❌ Lần gửi trước chưa được duyệt (ảnh chưa rõ mặt hoặc chưa khớp hồ sơ). Bạn gửi lại ảnh selfie rõ mặt nhé.";
        if (khu) khu.classList.remove("an");
      } else {
        el.textContent = "Hồ sơ của bạn chưa được xác thực. Gửi ảnh selfie để nhận huy hiệu ✅ Đã xác thực.";
        if (khu) khu.classList.remove("an");
      }
    });
  }

  function guiSelfieXacThuc(file) {
    $("loiXacThuc").textContent = "";
    if (!file || (file.type || "").indexOf("image/") !== 0) {
      $("loiXacThuc").textContent = "Hãy chọn một file ảnh selfie.";
      return;
    }
    hienToast("Đang tải ảnh xác thực lên…");
    taiTepRiengLen(file, "xac-thuc").then(function (up) {
      if (!up.ok) { $("loiXacThuc").textContent = up.loi || "Tải ảnh lên chưa được."; return; }
      goiAPI("/api/xac-thuc/gui", "POST", { tepId: up.tepId }, true).then(function (kq) {
        if (!kq.ok) { $("loiXacThuc").textContent = kq.loi || "Chưa gửi được yêu cầu xác thực."; return; }
        hienToast("Đã gửi ảnh xác thực — đang chờ duyệt 🛡️");
        taiTrangThaiXacThuc();
      });
    });
  }

  // ---------- Tin nhắn / chat ----------
  function taiDsTroChuyen() {
    if (!TQD_SERVER || !tokenMayChu) return;
    taiSoTinCho(); // Gói 1: cập nhật nút Tin nhắn chờ
    // V6: gộp cả nhóm chat vào danh sách, sắp chung theo thời gian tin cuối
    Promise.all([
      goiAPI("/api/tin-nhan/danh-sach", "GET", null, true),
      goiAPI("/api/nhom/danh-sach", "GET", null, true)
    ]).then(function (kqs) {
      var kq = kqs[0], kqN = kqs[1];
      var hop = $("dsTroChuyen");
      hop.innerHTML = "";
      if (!kq.ok) {
        $("trongTroChuyen").textContent = kq.loi || "Không tải được danh sách trò chuyện.";
        $("trongTroChuyen").classList.remove("an");
        return;
      }
      var muc = [];
      (kq.troChuyen || []).forEach(function (c) { muc.push({ laNhom: false, tg: c.tinCuoi.tg, c: c }); });
      if (kqN && kqN.ok) (kqN.nhom || []).forEach(function (g) {
        muc.push({ laNhom: true, tg: g.tinCuoi ? g.tinCuoi.tg : g.taoLuc, g: g });
      });
      muc.sort(function (a, b) { return b.tg - a.tg; });
      $("trongTroChuyen").textContent = "Chưa có cuộc trò chuyện nào. Vào Danh bạ, chọn một người bạn để nhắn tin nhé.";
      $("trongTroChuyen").classList.toggle("an", muc.length > 0);
      muc.forEach(function (m) {
        var phai = document.createElement("div");
        phai.className = "cotPhai";
        var gio = document.createElement("span");
        gio.className = "gioNho";
        phai.appendChild(gio);
        if (!m.laNhom) {
          var c = m.c;
          gio.textContent = dinhDangGio(c.tinCuoi.tg);
          if (c.chuaDoc > 0) {
            var cham = document.createElement("span");
            cham.className = "chamChuaDoc";
            cham.textContent = c.chuaDoc;
            phai.appendChild(cham);
          }
          var xemTruoc = (c.tinCuoi.cuaToi ? "Bạn: " : "") + c.tinCuoi.noiDung;
          var the = taoTheNguoi(c.emoji, c.nick, xemTruoc, phai);
          ganHuyHieuXacThuc(the, c.xacThuc === true);
          the.classList.add("bamDuoc");
          the.addEventListener("click", function () { moChat(c.sdt, c.nick, c.emoji, { laBanBe: c.laBanBe === true, xacThuc: c.xacThuc === true }); });
          hop.appendChild(the);
        } else {
          var g = m.g;
          gio.textContent = dinhDangGio(m.tg);
          if (g.chuaDoc > 0) {
            var chamN = document.createElement("span");
            chamN.className = "chamChuaDoc";
            chamN.textContent = g.chuaDoc;
            phai.appendChild(chamN);
          }
          var xemTruocN = "";
          if (g.tinCuoi) {
            var nguoiGuiCuoi = (sdtHienTai && g.tinCuoi.tu === sdtHienTai) ? "Bạn" : (g.tinCuoi.nick || "Ai đó");
            // Gói 4: xem trước tin nhóm đã thu hồi / sticker
            var ndCuoiN = g.tinCuoi.daThuHoi ? "↩️ Tin nhắn đã được thu hồi"
              : (g.tinCuoi.kieu === "sticker" ? ((g.tinCuoi.noiDung || "🌟") + " Sticker") : g.tinCuoi.noiDung);
            xemTruocN = nguoiGuiCuoi + ": " + ndCuoiN;
          } else {
            xemTruocN = "Nhóm mới — hãy gửi tin đầu tiên 👋";
          }
          if (g.loai === "cong-dong") xemTruocN = "Cộng đồng · " + g.soThanhVien + " thành viên · " + xemTruocN;
          var theN = taoTheNguoi(g.emoji || "👥", g.ten, xemTruocN, phai);
          if (g.loai === "cong-dong") {
            var huy = document.createElement("span");
            huy.className = "huyHieuCongDong";
            huy.textContent = "Cộng đồng";
            theN.querySelector(".tenNguoi").appendChild(huy);
          }
          theN.classList.add("bamDuoc");
          theN.addEventListener("click", function () { moChatNhom(g); });
          hop.appendChild(theN);
        }
      });
    });
  }

  function moChat(sdt, nick, emoji, tuyChon) {
    chatVoi = { sdt: sdt, nick: nick || "", emoji: emoji || "😀",
      laBanBe: !!(tuyChon && tuyChon.laBanBe), xacThuc: !!(tuyChon && tuyChon.xacThuc) };
    chatSince = 0;
    chatSuaSince = 0; // Gói 4
    chatDaXemDen = 0; chatToiHienDaXem = true; // Gói 4
    anDongDangNhap();
    var hopSt = $("hopSticker"); if (hopSt) hopSt.classList.add("an");
    chayDemTuHuy(); // Gói 4: đồng hồ đếm ngược tin tự huỷ đang hiện
    tabDangChon = "tinnhan";
    capNhatKhungTab();
    $("khuDsTroChuyen").classList.add("an");
    $("manChat").classList.remove("an");
    // V6: đóng các màn nhóm đang mở dở để không chồng màn hình
    dungPollChatNhom();
    nhomDangChat = null;
    ["manChatNhom", "manTaoNhom", "manThongTinNhom", "manTinCho"].forEach(function (id) {
      var e = $(id);
      if (e) e.classList.add("an");
    });
    $("avatarChat").textContent = chatVoi.emoji;
    $("tenChat").textContent = chatVoi.nick || chatVoi.sdt;
    var huyChat = $("huyHieuChat");
    if (huyChat) huyChat.classList.toggle("an", !chatVoi.xacThuc); // Gói 1: huy hiệu ✅ trong chat
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
    dungPollChatNhom(); // V6: dừng poll nhóm khi rời tab Tin nhắn
    dungDemTuHuy(); // Gói 4
    anDongDangNhap(); // Gói 4
    nhomDangChat = null;
    chatVoi = null;
    chatSince = 0;
    chatSuaSince = 0;
    var mc = $("manChat");
    if (mc) mc.classList.add("an");
    // V6: các màn nhóm cũng quay về danh sách
    ["manChatNhom", "manTaoNhom", "manThongTinNhom", "manTinCho"].forEach(function (id) {
      var e = $(id);
      if (e) e.classList.add("an");
    });
    nhomThongTin = null;
    var ds = $("khuDsTroChuyen");
    if (ds) ds.classList.remove("an");
    if (napLaiDs) taiDsTroChuyen();
  }

  function taiTinNhanMoi() {
    if (!chatVoi || !tokenMayChu) return;
    var dich = chatVoi.sdt;
    goiAPI("/api/tin-nhan?sdt=" + encodeURIComponent(dich) + "&since=" + chatSince + "&sinceSua=" + chatSuaSince, "GET", null, true)
      .then(function (kq) {
        if (!kq.ok || !chatVoi || chatVoi.sdt !== dich) return;
        (kq.tinNhan || []).forEach(function (t) {
          themBongBong(t);
          if (t.tg > chatSince) chatSince = t.tg;
        });
        // Gói 4: vá tại chỗ các tin cũ đã thay đổi (thu hồi / bắt đầu đếm tự huỷ / đã tự huỷ)
        (kq.tinCapNhat || []).forEach(function (t) {
          capNhatBongBong(t);
          if (t.suaLuc && t.suaLuc > chatSuaSince) chatSuaSince = t.suaLuc;
        });
        // Gói 4: trạng thái "Đã xem" của đối phương
        if (typeof kq.daXemDen === "number") {
          chatDaXemDen = kq.daXemDen;
          chatToiHienDaXem = kq.toiHienDaXem !== false;
          capNhatChiThiDaXem();
        }
      });
  }

  // Gói 4: tạo MỘT dòng tin hoàn chỉnh — dùng cho cả thêm mới lẫn vá tại chỗ khi
  // tin bị thu hồi / bắt đầu đếm tự huỷ / đã tự huỷ (máy chủ báo qua tinCapNhat).
  function taoDongTin(t) {
    var dong = document.createElement("div");
    dong.className = "dongTin " + (t.cuaToi ? "cuaToi" : "cuaHo");
    if (t.id) dong.dataset.tinId = t.id;
    dong.dataset.tg = t.tg || 0;
    var bong = document.createElement("div");
    bong.className = "bongBong";
    var kieu = t.kieu || "van-ban";
    if (t.daThuHoi) {
      var spThuHoi = document.createElement("span");
      spThuHoi.className = "tinBiThuHoi";
      spThuHoi.textContent = "↩️ Tin nhắn đã được thu hồi";
      bong.appendChild(spThuHoi);
    } else if (t.daHetHan) {
      var spHetHan = document.createElement("span");
      spHetHan.className = "tinBiThuHoi";
      spHetHan.textContent = "💨 Tin nhắn đã tự huỷ";
      bong.appendChild(spHetHan);
    } else if (kieu === "sticker") {
      // Gói 4: sticker hiển thị to
      bong.classList.add("bongSticker");
      var stLon = document.createElement("div");
      stLon.className = "stickerTrongChat";
      stLon.textContent = t.noiDung || "🌟";
      bong.appendChild(stLon);
    } else if (kieu === "anh" && t.tepId) {
      // V5: tin ảnh — bấm vào mở ảnh lớn
      var img = document.createElement("img");
      img.className = "anhTrongChat";
      img.src = duongDanTep(t.tepId);
      img.alt = t.tenTep || "Ảnh";
      // Gói 1: ảnh từ người CHƯA phải bạn bè -> làm mờ + nút Xem rõ (chống ảnh nhạy cảm bất ngờ)
      if (!t.cuaToi && chatVoi && chatVoi.laBanBe !== true) {
        img.classList.add("anhBiMo");
        var nutXemAnh = document.createElement("button");
        nutXemAnh.type = "button";
        nutXemAnh.className = "nutXemAnhMo";
        nutXemAnh.textContent = "👁 Ảnh từ người chưa phải bạn bè — chạm để xem rõ";
        nutXemAnh.addEventListener("click", function () {
          img.classList.remove("anhBiMo");
          nutXemAnh.remove();
          img.addEventListener("click", function () { window.open(duongDanTep(t.tepId), "_blank"); });
        });
        bong.appendChild(img);
        bong.appendChild(nutXemAnh);
      } else {
        img.addEventListener("click", function () { window.open(duongDanTep(t.tepId), "_blank"); });
        bong.appendChild(img);
      }
      lichQuetQRTrongAnh(t.tepId, bong);
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
    } else if (kieu === "qua") {
      // Gói 3: thẻ quà ảo trong chat
      var theQua = document.createElement("div");
      theQua.className = "theQuaTrongChat";
      var eQua = document.createElement("div");
      eQua.className = "emojiQuaLon";
      eQua.textContent = t.quaEmoji || "🎁";
      var tenQua = document.createElement("div");
      tenQua.className = "tenQuaLon";
      tenQua.textContent = t.quaTen || "Quà tặng";
      var ghiChuQua = document.createElement("div");
      ghiChuQua.className = "metaTep";
      ghiChuQua.textContent = t.cuaToi ? "Bạn đã tặng món quà này 🎁" : "Đã tặng bạn món quà này 🎁";
      theQua.appendChild(eQua); theQua.appendChild(tenQua); theQua.appendChild(ghiChuQua);
      if (t.noiDung) {
        var loiNhan = document.createElement("div");
        loiNhan.textContent = "“" + t.noiDung + "”";
        theQua.appendChild(loiNhan);
      }
      bong.appendChild(theQua);
    } else if (t.tepDaXoa || (kieu !== "van-ban" && !t.tepId)) {
      // V5.1: tin media mà tệp đã bị người gửi xóa khỏi máy chủ
      var spXoa = document.createElement("span");
      spXoa.className = "metaTep";
      spXoa.textContent = "🗑️ Tệp đã bị xóa khỏi máy chủ";
      bong.appendChild(spXoa);
    } else {
      trangTriTinVanBan(bong, t.noiDung || "");
    }
    var gio = document.createElement("div");
    gio.className = "gioTin";
    gio.textContent = dinhDangGio(t.tg);
    bong.appendChild(gio);
    // Gói 4: nhãn tin tự huỷ (chưa đếm ngược / đang đếm ngược theo hetLuc)
    if (t.tuHuy && !t.daThuHoi && !t.daHetHan) {
      var nhanTuHuy = document.createElement("div");
      nhanTuHuy.className = "nhanTuHuy";
      if (t.hetLuc) {
        nhanTuHuy.dataset.hetLuc = t.hetLuc;
        nhanTuHuy.textContent = "💨 Sẽ tự huỷ sau " + nhanDemNguoc((t.hetLuc - Date.now()) / 1000);
      } else {
        nhanTuHuy.textContent = "⏳ Tự huỷ " + nhanThoiGianTuHuy(t.tuHuy) + " sau khi người nhận xem";
      }
      bong.appendChild(nhanTuHuy);
    }
    dong.appendChild(bong);
    // V5.1: nút Lưu dưới mỗi tin -> cất snapshot vào "Tài liệu của tôi"
    // Gói 4: tin đã thu hồi / đã tự huỷ thì không còn nội dung để lưu, dịch hay thu hồi nữa.
    if (TQD_SERVER && tokenMayChu && !t.daThuHoi && !t.daHetHan) {
      var nutLuu = document.createElement("button");
      nutLuu.type = "button";
      nutLuu.className = "nutLuuTin";
      nutLuu.textContent = "💾 Lưu";
      nutLuu.title = "Lưu vào Tài liệu của tôi";
      nutLuu.addEventListener("click", function () { luuTinNhanVaoTaiLieu(t); });
      dong.appendChild(nutLuu);
      if (kieu === "van-ban" && t.noiDung) {
        var nutDich = document.createElement("button");
        nutDich.type = "button";
        nutDich.className = "nutLuuTin";
        nutDich.textContent = trichChuoi("dich", ngonNguHT);
        nutDich.title = "Dịch tin nhắn này";
        nutDich.addEventListener("click", function () { dichTinNhan(t, dong); });
        dong.appendChild(nutDich);
      }
      if (t.cuaToi && t.id && (Date.now() - t.tg) < 86400000) {
        var nutThuHoi = document.createElement("button");
        nutThuHoi.type = "button";
        nutThuHoi.className = "nutLuuTin";
        nutThuHoi.textContent = "↩ Thu hồi";
        nutThuHoi.title = "Thu hồi tin nhắn này ở cả hai phía (trong 24 giờ đầu)";
        nutThuHoi.addEventListener("click", function () { thuHoiTinChat(t); });
        dong.appendChild(nutThuHoi);
      }
    }
    dong._tin = t;
    return dong;
  }

  function themBongBong(t) {
    var hop = $("hopTinNhan");
    hop.appendChild(taoDongTin(t));
    hop.scrollTop = hop.scrollHeight;
  }

  // Gói 4: thay một dòng tin đã hiện bằng bản mới nhất từ máy chủ (theo id).
  function capNhatBongBong(t) {
    if (!t || !t.id) return;
    var hop = $("hopTinNhan");
    if (!hop) return;
    var cu = null;
    hop.querySelectorAll(".dongTin").forEach(function (d) { if (d.dataset.tinId === t.id) cu = d; });
    if (!cu) { themBongBong(t); return; }
    cu.replaceWith(taoDongTin(t));
    capNhatChiThiDaXem();
  }

  // ================= GÓI 4: DỊCH / THU HỒI / ĐÃ XEM / ĐANG NHẬP / TỰ HUỶ / STICKER =================
  var chatDaXemDen = 0;         // mốc thời gian đối phương đã đọc tới (ms)
  var chatToiHienDaXem = true;  // cài đặt hienDaXem của chính mình (tắt = ẩn hai chiều)
  var idDemTuHuy = null;
  var lucGuiDangNhapCuoi = 0;
  var henAnDangNhap = null;

  function nhanThoiGianTuHuy(giay) {
    return giay >= 3600 ? "1 giờ" : (giay >= 60 ? "1 phút" : (giay + " giây"));
  }
  function nhanDemNguoc(giayTho) {
    var g = Math.max(0, Math.ceil(giayTho));
    return g > 90 ? (Math.ceil(g / 60) + " phút") : (g + " giây");
  }

  // Chỉ thị "✓✓ Đã xem" nằm ngay dưới tin cuối cùng của mình đã được đối phương đọc.
  function capNhatChiThiDaXem() {
    var hop = $("hopTinNhan");
    if (!hop || !chatVoi) return;
    var cu = $("dongDaXemChat");
    if (cu) cu.remove();
    if (!chatToiHienDaXem || !chatDaXemDen) return;
    var dongCuoi = null;
    hop.querySelectorAll(".dongTin.cuaToi").forEach(function (d) {
      if ((parseInt(d.dataset.tg, 10) || 0) <= chatDaXemDen) dongCuoi = d;
    });
    if (!dongCuoi) return;
    var dv = document.createElement("div");
    dv.id = "dongDaXemChat";
    dv.className = "dongDaXem";
    dv.textContent = trichChuoi("da_xem", ngonNguHT) + " " + dinhDangGio(chatDaXemDen);
    dongCuoi.after(dv);
  }

  // Đếm ngược tại máy người xem: hết giờ là ẩn nội dung ngay (máy chủ cũng xóa
  // nội dung ở lần đọc kế tiếp — hai lớp cùng chạy).
  function chayDemTuHuy() {
    dungDemTuHuy();
    idDemTuHuy = setInterval(function () {
      if (!chatVoi) return;
      var bayGio = Date.now();
      document.querySelectorAll("#hopTinNhan .nhanTuHuy[data-het-luc]").forEach(function (el) {
        var hetLuc = parseInt(el.dataset.hetLuc, 10) || 0;
        if (hetLuc - bayGio <= 0) {
          var dong = el.closest(".dongTin");
          if (dong && dong._tin) {
            var t2 = Object.assign({}, dong._tin, { daHetHan: true, noiDung: "", tepId: null });
            dong.replaceWith(taoDongTin(t2));
          }
        } else {
          el.textContent = "💨 Sẽ tự huỷ sau " + nhanDemNguoc((hetLuc - bayGio) / 1000);
        }
      });
    }, 500);
  }
  function dungDemTuHuy() {
    if (idDemTuHuy) { clearInterval(idDemTuHuy); idDemTuHuy = null; }
  }

  // Dịch tin: bấm lần 1 hiện bản dịch ngay dưới bong bóng, bấm lần nữa thì ẩn.
  function dichTinNhan(t, dong) {
    var co = dong.querySelector(".banDich");
    if (co) { co.remove(); return; }
    hienToast(trichChuoi("dang_dich", ngonNguHT) + " 🌐");
    goiAPI("/api/dich", "POST", { vanBan: t.noiDung, dichSang: ngonNguHT }, true).then(function (kq) {
      if (!kq.ok) { hienToast(kq.loi || "Chưa dịch được lúc này."); return; }
      var dv = document.createElement("div");
      dv.className = "banDich";
      var nd = document.createElement("div");
      nd.textContent = kq.dich || "";
      var nguon = document.createElement("div");
      nguon.className = "metaTep";
      nguon.textContent = trichChuoi("ban_dich", ngonNguHT) + (TEN_NGON_NGU_GOC[kq.dichSang] ? (" (" + TEN_NGON_NGU_GOC[kq.dichSang] + ")") : "") + " · " + (kq.nguon || "");
      dv.appendChild(nd);
      dv.appendChild(nguon);
      dong.appendChild(dv);
    });
  }

  function thuHoiTinChat(t) {
    if (!window.confirm("Thu hồi tin nhắn này?\n\nNội dung sẽ biến mất ở cả hai phía.")) return;
    goiAPI("/api/tin-nhan/thu-hoi", "POST", { id: t.id }, true).then(function (kq) {
      if (!kq.ok) { hienToast(kq.loi || "Chưa thu hồi được."); return; }
      if (kq.tin) capNhatBongBong(kq.tin);
      hienToast("Đã thu hồi tin nhắn ↩️");
    });
  }

  function thuHoiTinNhom(t) {
    if (!nhomDangChat) return;
    if (!window.confirm("Thu hồi tin nhắn này khỏi nhóm?\n\nNội dung sẽ biến mất với mọi thành viên.")) return;
    var idNhom = nhomDangChat.id;
    goiAPI("/api/nhom/tin-nhan/thu-hoi", "POST", { nhom: idNhom, id: t.id }, true).then(function (kq) {
      if (!kq.ok) { hienToast(kq.loi || "Chưa thu hồi được."); return; }
      if (kq.tin && nhomDangChat && nhomDangChat.id === idNhom) capNhatBongBongNhom(kq.tin);
      hienToast("Đã thu hồi tin nhắn ↩️");
    });
  }

  // Đang nhập: gửi tín hiệu WS tối đa 1 lần / 2,5 giây khi gõ trong ô chat.
  function baoDangNhap() {
    if (!chatVoi) return;
    var bayGio = Date.now();
    if (bayGio - lucGuiDangNhapCuoi < 2500) return;
    lucGuiDangNhapCuoi = bayGio;
    guiTinHieu({ loaiTin: "dang-nhap", den: chatVoi.sdt });
  }
  function nhanTinDangNhap(msg) {
    if (!chatVoi || msg.tu !== chatVoi.sdt) return;
    var el = $("dongDangNhap");
    if (!el) return;
    el.textContent = "✍️ " + (chatVoi.nick || "Đối phương") + " " + trichChuoi("dang_nhap_lbl", ngonNguHT);
    el.classList.remove("an");
    if (henAnDangNhap) clearTimeout(henAnDangNhap);
    henAnDangNhap = setTimeout(anDongDangNhap, 3500);
  }
  function anDongDangNhap() {
    var el = $("dongDangNhap");
    if (el) el.classList.add("an");
  }

  function layTuHuyDangChon() {
    var s = $("selTuHuy");
    return s ? (parseInt(s.value, 10) || 0) : 0;
  }

  // ---------- Gói 4: STICKER (danh mục lấy từ máy chủ, có bộ dự phòng gọn) ----------
  var boStickerHT = null;
  var boStickerDangChon = {};
  var STICKER_DU_PHONG = [
    { id: "cam-xuc", ten: "😀 Cảm xúc", muc: [
      { id: "cx-cuoi", emoji: "😂", nhan: "Cười ngất" }, { id: "cx-yeu", emoji: "🥰", nhan: "Yêu quá" },
      { id: "cx-tim", emoji: "😍", nhan: "Mê luôn" }, { id: "cx-ngau", emoji: "😎", nhan: "Ngầu" },
      { id: "tc-tim", emoji: "❤️", nhan: "Trái tim" }, { id: "ch-chao", emoji: "👋", nhan: "Xin chào" },
      { id: "ch-like", emoji: "👍", nhan: "Chuẩn" }, { id: "ch-lua", emoji: "🔥", nhan: "Cháy" }
    ] }
  ];
  function taiBoSticker() {
    if (boStickerHT || !TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/sticker", "GET", null, true).then(function (kq) {
      if (kq.ok && Array.isArray(kq.bo) && kq.bo.length) boStickerHT = kq.bo;
    });
  }
  function veHopSticker(idHop, nguCanh) {
    var hop = $(idHop);
    if (!hop) return;
    var bo = boStickerHT || STICKER_DU_PHONG;
    var dangChon = boStickerDangChon[idHop] || bo[0].id;
    hop.innerHTML = "";
    var hangTab = document.createElement("div");
    hangTab.className = "hangTabSticker";
    bo.forEach(function (b) {
      var tab = document.createElement("button");
      tab.type = "button";
      tab.className = "tabSticker" + (b.id === dangChon ? " dangChon" : "");
      tab.textContent = b.ten;
      tab.addEventListener("click", function () {
        boStickerDangChon[idHop] = b.id;
        veHopSticker(idHop, nguCanh);
      });
      hangTab.appendChild(tab);
    });
    hop.appendChild(hangTab);
    var boHT = null;
    bo.forEach(function (b) { if (b.id === dangChon) boHT = b; });
    if (!boHT) boHT = bo[0];
    var luoi = document.createElement("div");
    luoi.className = "luoiSticker";
    (boHT.muc || []).forEach(function (m) {
      var o = document.createElement("button");
      o.type = "button";
      o.className = "oSticker";
      o.title = m.nhan;
      var em = document.createElement("span");
      em.className = "emojiSticker";
      em.textContent = m.emoji;
      var nhan = document.createElement("span");
      nhan.className = "nhanSticker";
      nhan.textContent = m.nhan;
      o.appendChild(em);
      o.appendChild(nhan);
      o.addEventListener("click", function () { guiStickerTheoNguCanh(nguCanh, m.id); });
      luoi.appendChild(o);
    });
    hop.appendChild(luoi);
  }
  function moHopSticker1v1() {
    var hop = $("hopSticker");
    if (!hop) return;
    var seMo = hop.classList.contains("an");
    hop.classList.toggle("an", !seMo);
    if (seMo) { taiBoSticker(); veHopSticker("hopSticker", "1v1"); }
  }
  function moHopStickerNhom() {
    var hop = $("hopStickerNhom");
    if (!hop) return;
    var seMo = hop.classList.contains("an");
    hop.classList.toggle("an", !seMo);
    if (seMo) { taiBoSticker(); veHopSticker("hopStickerNhom", "nhom"); }
  }
  function guiStickerTheoNguCanh(nguCanh, stickerId) {
    if (nguCanh === "nhom") {
      if (!nhomDangChat) return;
      var idNhom = nhomDangChat.id;
      goiAPI("/api/nhom/tin-nhan/sticker", "POST", { nhom: idNhom, stickerId: stickerId }, true).then(function (kq) {
        if (!kq.ok) { $("loiChatNhom").textContent = kq.loi || "Không gửi được sticker."; return; }
        $("loiChatNhom").textContent = "";
        var hopN = $("hopStickerNhom"); if (hopN) hopN.classList.add("an");
        if (nhomDangChat && nhomDangChat.id === idNhom && kq.tin) {
          themBongBongNhom(kq.tin);
          if (kq.tin.tg > nhomChatSince) nhomChatSince = kq.tin.tg;
        }
      });
      return;
    }
    if (!chatVoi) return;
    var dich = chatVoi;
    goiAPI("/api/tin-nhan/sticker", "POST", { sdt: dich.sdt, stickerId: stickerId, tuHuy: layTuHuyDangChon() }, true).then(function (kq) {
      if (!kq.ok) { $("loiChat").textContent = kq.loi || "Không gửi được sticker."; return; }
      $("loiChat").textContent = "";
      var hopS = $("hopSticker"); if (hopS) hopS.classList.add("an");
      if (chatVoi && chatVoi.sdt === dich.sdt && kq.tin) {
        themBongBong(kq.tin);
        if (kq.tin.tg > chatSince) chatSince = kq.tin.tg;
      }
      if (kq.dangCho) hienToast("Sticker đã gửi vào hộp Tin nhắn chờ của " + (dich.nick || "người ấy") + " 📥");
    });
  }

  function guiTinSuKien() {
    if (!chatVoi) return;
    var noiDung = $("inpTinNhan").value.trim();
    if (!noiDung) return;
    var dich = chatVoi;
    goiAPI("/api/tin-nhan", "POST", { sdt: dich.sdt, noiDung: noiDung, tuHuy: layTuHuyDangChon() }, true).then(function (kq) {
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
      if (kq.dangCho) hienToast("Tin đã gửi vào hộp Tin nhắn chờ của " + (dich.nick || "người ấy") + " — họ đồng ý trò chuyện thì tin mới vào hộp thư chính 📥");
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

  // ================= V6: NHÓM CHAT + CỘNG ĐỒNG =================
  // Nhóm thường tối đa 100 thành viên; đủ 100 thì trưởng nhóm (phải còn hạn mức:
  // tài khoản thường 0, VIP 10) nâng cấp một chiều lên Cộng đồng tối đa 1000.
  var nhomDangChat = null;      // bản tóm tắt nhóm đang mở (từ danh sách / chi tiết)
  var nhomChatSince = 0;
  var nhomSuaSince = 0; // Gói 4: mốc suaLuc đã đồng bộ trong nhóm (thu hồi)
  var idPollChatNhom = null;
  var nhomThongTin = null;      // chi tiết đầy đủ của nhóm ở màn Thông tin nhóm

  function hienManTinNhan(idMan) {
    ["khuDsTroChuyen", "manChat", "manChatNhom", "manTaoNhom", "manThongTinNhom", "manTinCho"].forEach(function (id) {
      var el = $(id);
      if (el) el.classList.toggle("an", id !== idMan);
    });
  }

  function dungPollChatNhom() {
    if (idPollChatNhom) { clearInterval(idPollChatNhom); idPollChatNhom = null; }
  }

  function capNhatDauChatNhom() {
    if (!nhomDangChat) return;
    $("avatarChatNhom").textContent = nhomDangChat.emoji || "👥";
    $("tenChatNhom").textContent = nhomDangChat.ten || "";
    $("chiTietChatNhom").textContent = (nhomDangChat.loai === "cong-dong" ? "🌐 Cộng đồng" : "👥 Nhóm thường") +
      " · " + nhomDangChat.soThanhVien + " thành viên";
  }

  function moChatNhom(g) {
    nhomDangChat = g;
    nhomChatSince = 0;
    nhomSuaSince = 0; // Gói 4
    var hopStN = $("hopStickerNhom"); if (hopStN) hopStN.classList.add("an");
    tabDangChon = "tinnhan";
    capNhatKhungTab();
    hienManTinNhan("manChatNhom");
    capNhatDauChatNhom();
    $("hopTinNhanNhom").innerHTML = "";
    $("loiChatNhom").textContent = "";
    $("inpTinNhanNhom").value = "";
    taiTinNhomMoi();
    dungPollChatNhom();
    idPollChatNhom = setInterval(taiTinNhomMoi, 3000);
    window.scrollTo(0, 0);
  }

  function dongManChatNhom(napLaiDs) {
    dungPollChatNhom();
    nhomDangChat = null;
    nhomChatSince = 0;
    nhomSuaSince = 0;
    nhomThongTin = null;
    hienManTinNhan("khuDsTroChuyen");
    if (napLaiDs) taiDsTroChuyen();
  }

  // Gói 4: tạo dòng tin nhóm (thêm mới + vá tại chỗ khi thu hồi giống chat 1-1)
  function taoDongTinNhom(t) {
    var dong = document.createElement("div");
    dong.className = "dongTin " + (t.cuaToi ? "cuaToi" : "cuaHo");
    if (t.id) dong.dataset.tinId = t.id;
    dong.dataset.tg = t.tg || 0;
    if (!t.cuaToi) {
      var ten = document.createElement("div");
      ten.className = "tenNguoiGuiTrongNhom";
      ten.textContent = (t.emoji || "😀") + " " + (t.nick || "");
      dong.appendChild(ten);
    }
    var bong = document.createElement("div");
    bong.className = "bongBong";
    var kieuN = t.kieu || "van-ban";
    if (t.daThuHoi) {
      var spThuHoiN = document.createElement("span");
      spThuHoiN.className = "tinBiThuHoi";
      spThuHoiN.textContent = "↩️ Tin nhắn đã được thu hồi";
      bong.appendChild(spThuHoiN);
    } else if (kieuN === "sticker") {
      bong.classList.add("bongSticker");
      var stLonN = document.createElement("div");
      stLonN.className = "stickerTrongChat";
      stLonN.textContent = t.noiDung || "🌟";
      bong.appendChild(stLonN);
    } else {
      trangTriTinVanBan(bong, t.noiDung || "");
    }
    dong.appendChild(bong);
    var gio = document.createElement("span");
    gio.className = "gioNho";
    gio.textContent = dinhDangGio(t.tg);
    dong.appendChild(gio);
    if (TQD_SERVER && tokenMayChu && !t.daThuHoi) {
      if (kieuN === "van-ban" && t.noiDung) {
        var nutDichN = document.createElement("button");
        nutDichN.type = "button";
        nutDichN.className = "nutLuuTin";
        nutDichN.textContent = trichChuoi("dich", ngonNguHT);
        nutDichN.addEventListener("click", function () { dichTinNhan(t, dong); });
        dong.appendChild(nutDichN);
      }
      if (t.cuaToi && t.id && (Date.now() - t.tg) < 86400000) {
        var nutThuHoiN = document.createElement("button");
        nutThuHoiN.type = "button";
        nutThuHoiN.className = "nutLuuTin";
        nutThuHoiN.textContent = "↩ Thu hồi";
        nutThuHoiN.addEventListener("click", function () { thuHoiTinNhom(t); });
        dong.appendChild(nutThuHoiN);
      }
    }
    dong._tin = t;
    return dong;
  }

  function themBongBongNhom(t) {
    var hop = $("hopTinNhanNhom");
    hop.appendChild(taoDongTinNhom(t));
    hop.scrollTop = hop.scrollHeight;
  }

  function capNhatBongBongNhom(t) {
    if (!t || !t.id) return;
    var hop = $("hopTinNhanNhom");
    if (!hop) return;
    var cu = null;
    hop.querySelectorAll(".dongTin").forEach(function (d) { if (d.dataset.tinId === t.id) cu = d; });
    if (!cu) { themBongBongNhom(t); return; }
    cu.replaceWith(taoDongTinNhom(t));
  }

  function taiTinNhomMoi() {
    if (!nhomDangChat || !tokenMayChu) return;
    var id = nhomDangChat.id;
    goiAPI("/api/nhom/tin-nhan?nhom=" + encodeURIComponent(id) + "&since=" + nhomChatSince + "&sinceSua=" + nhomSuaSince, "GET", null, true)
      .then(function (kq) {
        if (!kq.ok || !nhomDangChat || nhomDangChat.id !== id) return;
        (kq.tinNhan || []).forEach(function (t) {
          themBongBongNhom(t);
          if (t.tg > nhomChatSince) nhomChatSince = t.tg;
        });
        // Gói 4: vá tại chỗ tin nhóm đã bị thu hồi
        (kq.tinCapNhat || []).forEach(function (t) {
          capNhatBongBongNhom(t);
          if (t.suaLuc && t.suaLuc > nhomSuaSince) nhomSuaSince = t.suaLuc;
        });
      });
  }

  function guiTinNhomSuKien() {
    if (!nhomDangChat) return;
    var inp = $("inpTinNhanNhom");
    var noiDung = inp.value.trim();
    var loiEl = $("loiChatNhom");
    loiEl.textContent = "";
    if (!noiDung) return;
    var id = nhomDangChat.id;
    goiAPI("/api/nhom/tin-nhan", "POST", { nhom: id, noiDung: noiDung }, true).then(function (kq) {
      if (!kq.ok) { loiEl.textContent = kq.loi || "Không gửi được tin."; return; }
      inp.value = "";
      if (nhomDangChat && nhomDangChat.id === id) {
        themBongBongNhom(kq.tin);
        if (kq.tin.tg > nhomChatSince) nhomChatSince = kq.tin.tg;
      }
    });
  }

  // --- Tạo nhóm: vẽ danh sách bạn bè kèm ô chọn (dùng chung cho Thêm thành viên) ---
  function veDsChonBanBe(idHop, cacSdtLoaiTru, idTrong) {
    var hop = $(idHop);
    hop.innerHTML = "";
    return goiAPI("/api/ban-be", "GET", null, true).then(function (kq) {
      var ds = (kq && kq.ok && kq.banBe) ? kq.banBe : [];
      ds = ds.filter(function (b) { return cacSdtLoaiTru.indexOf(b.sdt) === -1; });
      if (idTrong) {
        $(idTrong).textContent = ds.length ? "" : "Bạn chưa có người bạn nào để mời vào nhóm.";
        $(idTrong).classList.toggle("an", ds.length > 0);
      }
      if (!ds.length && !idTrong) {
        var p = document.createElement("p");
        p.className = "goiY";
        p.textContent = "Không còn người bạn nào ở ngoài nhóm.";
        hop.appendChild(p);
      }
      ds.forEach(function (b) {
        var lb = document.createElement("label");
        lb.className = "dongChonBanBe";
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = b.sdt;
        cb.className = "oChonBanBe";
        var av = document.createElement("span");
        av.className = "avatarLon";
        av.textContent = b.emoji || "😀";
        var ten = document.createElement("span");
        ten.textContent = b.nick || b.sdt;
        lb.appendChild(cb);
        lb.appendChild(av);
        lb.appendChild(ten);
        hop.appendChild(lb);
      });
      return ds.length;
    });
  }

  function layDsDaChon(idHop) {
    var ra = [];
    $(idHop).querySelectorAll("input.oChonBanBe:checked").forEach(function (cb) { ra.push(cb.value); });
    return ra;
  }

  function moManTaoNhom() {
    $("menuCong").classList.add("an");
    hienManTinNhan("manTaoNhom");
    $("loiTaoNhom").textContent = "";
    $("trongBanBeTaoNhom").textContent = "Đang tải danh sách bạn bè…";
    $("trongBanBeTaoNhom").classList.remove("an");
    veDsChonBanBe("dsBanBeTaoNhom", [], "trongBanBeTaoNhom");
    window.scrollTo(0, 0);
  }

  function taoNhomSuKien() {
    var ten = $("inpTenNhom").value.trim();
    var emoji = $("inpEmojiNhom").value.trim() || "👥";
    var ds = layDsDaChon("dsBanBeTaoNhom");
    var loiEl = $("loiTaoNhom");
    loiEl.textContent = "";
    if (!ten) { loiEl.textContent = "Bạn chưa đặt tên cho nhóm."; return; }
    if (ds.length < 2) { loiEl.textContent = "Nhóm cần ít nhất 2 người bạn được mời."; return; }
    goiAPI("/api/nhom/tao", "POST", { ten: ten, emoji: emoji, dsSDT: ds }, true).then(function (kq) {
      if (!kq.ok) { loiEl.textContent = kq.loi || "Không tạo được nhóm."; return; }
      hienToast("Đã tạo nhóm “" + kq.nhom.ten + "” 🎉");
      taiDsTroChuyen();
      moChatNhom(kq.nhom);
    });
  }

  // --- Thông tin nhóm ---
  function taiChiTietNhom(id, coMoMan) {
    return goiAPI("/api/nhom/chi-tiet?nhom=" + encodeURIComponent(id), "GET", null, true).then(function (kq) {
      if (!kq.ok) {
        hienToast(kq.loi || "Không tải được thông tin nhóm.");
        if (!nhomDangChat) dongManChatNhom(true);
        return null;
      }
      nhomThongTin = kq.nhom;
      if (nhomDangChat && nhomDangChat.id === id) {
        nhomDangChat.ten = kq.nhom.ten;
        nhomDangChat.emoji = kq.nhom.emoji;
        nhomDangChat.loai = kq.nhom.loai;
        nhomDangChat.soThanhVien = kq.nhom.soThanhVien;
        capNhatDauChatNhom();
      }
      if (coMoMan) { hienManTinNhan("manThongTinNhom"); window.scrollTo(0, 0); }
      veThongTinNhom();
      return kq.nhom;
    });
  }

  function veThongTinNhom() {
    var g = nhomThongTin;
    if (!g) return;
    var loiEl = $("loiThongTinNhom");
    loiEl.textContent = "";
    $("avatarThongTinNhom").textContent = g.emoji || "👥";
    $("tenThongTinNhom").textContent = g.ten;
    $("chiTietThongTinNhom").textContent = (g.loai === "cong-dong" ? "🌐 Cộng đồng" : "👥 Nhóm thường") +
      " · " + g.soThanhVien + "/" + g.tran + " thành viên";
    var vaiCuaToi = g.vai;
    var toiQuanTri = (vaiCuaToi === "truong" || vaiCuaToi === "pho");

    // Khối nâng cấp cộng đồng — 4 trạng thái rõ ràng
    var khoi = $("khoiNangCapNhom");
    khoi.innerHTML = "";
    if (g.loai === "cong-dong") {
      var pCd = document.createElement("p");
      pCd.className = "goiY";
      pCd.textContent = "🌐 Đây là Cộng đồng — tối đa 1000 thành viên.";
      khoi.appendChild(pCd);
    } else if (vaiCuaToi !== "truong") {
      var pTv = document.createElement("p");
      pTv.className = "goiY";
      pTv.textContent = "Khi nhóm đủ 100 thành viên, trưởng nhóm có thể nâng cấp lên Cộng đồng (tối đa 1000 thành viên).";
      khoi.appendChild(pTv);
    } else if (g.soThanhVien < 100) {
      var pThieu = document.createElement("p");
      pThieu.className = "goiY";
      pThieu.textContent = "⬆️ Nâng cấp lên Cộng đồng khi nhóm đủ 100 thành viên (hiện " + g.soThanhVien + "/100).";
      khoi.appendChild(pThieu);
    } else if (g.soCongDongCuaToi < g.hanMucCongDongCuaToi) {
      var btnNc = document.createElement("button");
      btnNc.type = "button";
      btnNc.className = "nutChinh";
      btnNc.textContent = "⬆️ Nâng cấp lên Cộng đồng (tối đa 1000 thành viên)";
      btnNc.addEventListener("click", function () {
        if (!confirm("Nâng cấp nhóm này lên Cộng đồng? Việc nâng cấp là một chiều — không hạ xuống nhóm thường được nữa.")) return;
        goiAPI("/api/nhom/nang-cap", "POST", { nhom: g.id }, true).then(function (kq) {
          if (!kq.ok) { loiEl.textContent = kq.loi || "Không nâng cấp được."; return; }
          hienToast("Đã nâng cấp lên Cộng đồng 🌐");
          taiChiTietNhom(g.id, false);
          taiDsTroChuyen();
        });
      });
      khoi.appendChild(btnNc);
    } else {
      var pHet = document.createElement("p");
      pHet.className = "goiY";
      pHet.textContent = g.toiLaVIP
        ? "Bạn đang sở hữu tối đa " + g.hanMucCongDongCuaToi + " cộng đồng theo cấp tài khoản VIP nên chưa nâng cấp thêm được."
        : "Tài khoản thường không sở hữu được cộng đồng. Nâng cấp VIP để nâng nhóm này lên Cộng đồng (tối đa 1000 thành viên).";
      khoi.appendChild(pHet);
      if (!g.toiLaVIP) {
        var btnVip = document.createElement("button");
        btnVip.type = "button";
        btnVip.className = "nutChinh nho";
        btnVip.textContent = "⭐ Xem các gói VIP";
        btnVip.addEventListener("click", function () { dongManChatNhom(false); chonTab("canhan"); });
        khoi.appendChild(btnVip);
      }
    }

    // Đổi tên + thêm thành viên: chỉ trưởng/phó
    $("khoiDoiTenNhom").classList.toggle("an", !toiQuanTri);
    if (toiQuanTri) $("inpDoiTenNhom").value = g.ten;
    $("khoiThemThanhVien").classList.toggle("an", !toiQuanTri);
    if (toiQuanTri) {
      var daCo = (g.thanhVien || []).map(function (tv) { return tv.sdt; });
      veDsChonBanBe("dsBanBeThemNhom", daCo, null);
    }

    // Danh sách thành viên + nút quản trị theo vai trò
    var hop = $("dsThanhVienNhom");
    hop.innerHTML = "";
    (g.thanhVien || []).forEach(function (tv) {
      var nhanVai = tv.vai === "truong" ? " · Trưởng nhóm" : (tv.vai === "pho" ? " · Phó nhóm" : "");
      var cot = document.createElement("div");
      cot.className = "cotNutThanhVien";
      if (tv.sdt !== sdtHienTai) {
        if (vaiCuaToi === "truong") {
          var bTruong = document.createElement("button");
          bTruong.type = "button";
          bTruong.className = "nutPhu nho";
          bTruong.textContent = "👑 Nhường trưởng";
          bTruong.addEventListener("click", function () { chuyenTruongSuKien(tv); });
          cot.appendChild(bTruong);
          var bPho = document.createElement("button");
          bPho.type = "button";
          bPho.className = "nutPhu nho";
          bPho.textContent = tv.vai === "pho" ? "⬇️ Hạ phó" : "⭐ Phong phó";
          bPho.addEventListener("click", function () {
            goiAPI("/api/nhom/pho", "POST", { nhom: g.id, sdt: tv.sdt, bat: tv.vai !== "pho" }, true).then(function (kq) {
              if (!kq.ok) { loiEl.textContent = kq.loi || "Không thực hiện được."; return; }
              taiChiTietNhom(g.id, false);
            });
          });
          cot.appendChild(bPho);
          var bXoaT = document.createElement("button");
          bXoaT.type = "button";
          bXoaT.className = "nutPhu nho nutDangXuat";
          bXoaT.textContent = "❌ Xóa";
          bXoaT.addEventListener("click", function () { xoaThanhVienSuKien(tv); });
          cot.appendChild(bXoaT);
        } else if (vaiCuaToi === "pho" && tv.vai === "thanh-vien") {
          var bXoaP = document.createElement("button");
          bXoaP.type = "button";
          bXoaP.className = "nutPhu nho nutDangXuat";
          bXoaP.textContent = "❌ Xóa";
          bXoaP.addEventListener("click", function () { xoaThanhVienSuKien(tv); });
          cot.appendChild(bXoaP);
        }
      }
      var the = taoTheNguoi(tv.emoji, tv.nick || tv.sdt, (tv.sdt === sdtHienTai ? "Bạn" : "Thành viên") + nhanVai, cot.childNodes.length ? cot : null);
      hop.appendChild(the);
    });

    $("btnGiaiTanNhom").classList.toggle("an", vaiCuaToi !== "truong");
  }

  function xoaThanhVienSuKien(tv) {
    var g = nhomThongTin;
    if (!g) return;
    if (!confirm("Xóa " + (tv.nick || tv.sdt) + " khỏi nhóm?")) return;
    goiAPI("/api/nhom/xoa-thanh-vien", "POST", { nhom: g.id, sdt: tv.sdt }, true).then(function (kq) {
      if (!kq.ok) { $("loiThongTinNhom").textContent = kq.loi || "Không xóa được."; return; }
      hienToast("Đã xóa thành viên khỏi nhóm.");
      taiChiTietNhom(g.id, false);
      taiDsTroChuyen();
    });
  }

  function chuyenTruongSuKien(tv) {
    var g = nhomThongTin;
    if (!g) return;
    if (!confirm("Chuyển quyền trưởng nhóm cho " + (tv.nick || tv.sdt) + "? Bạn sẽ trở thành thành viên thường.")) return;
    goiAPI("/api/nhom/chuyen-truong", "POST", { nhom: g.id, sdtNhan: tv.sdt }, true).then(function (kq) {
      if (!kq.ok) { $("loiThongTinNhom").textContent = kq.loi || "Không chuyển quyền được."; return; }
      hienToast("Đã chuyển quyền trưởng nhóm 👑");
      taiChiTietNhom(g.id, false);
      taiDsTroChuyen();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var btnMenu = $("btnMenuCong");
    if (btnMenu) btnMenu.addEventListener("click", function (e) {
      e.stopPropagation();
      $("menuCong").classList.toggle("an");
    });
    document.addEventListener("click", function (e) {
      var m = $("menuCong");
      if (m && !m.classList.contains("an") && !e.target.closest(".oMenuCong")) m.classList.add("an");
    });
    var mucTao = $("mucTaoNhom");
    if (mucTao) mucTao.addEventListener("click", moManTaoNhom);
    var btnQlN = $("btnQuayLaiNhom");
    if (btnQlN) btnQlN.addEventListener("click", function () { dongManChatNhom(true); });
    var btnTt = $("btnThongTinNhom");
    if (btnTt) btnTt.addEventListener("click", function () {
      if (nhomDangChat) taiChiTietNhom(nhomDangChat.id, true);
    });
    var btnGuiN = $("btnGuiTinNhom");
    if (btnGuiN) btnGuiN.addEventListener("click", guiTinNhomSuKien);
    var inpN = $("inpTinNhanNhom");
    if (inpN) inpN.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); guiTinNhomSuKien(); }
    });
    var btnQlTao = $("btnQuayLaiTaoNhom");
    if (btnQlTao) btnQlTao.addEventListener("click", function () { dongManChatNhom(true); });
    var btnTaoXn = $("btnTaoNhomXacNhan");
    if (btnTaoXn) btnTaoXn.addEventListener("click", taoNhomSuKien);
    var btnQlTt = $("btnQuayLaiThongTinNhom");
    if (btnQlTt) btnQlTt.addEventListener("click", function () { hienManTinNhan("manChatNhom"); });
    var btnDoiTen = $("btnDoiTenNhom");
    if (btnDoiTen) btnDoiTen.addEventListener("click", function () {
      var g = nhomThongTin;
      if (!g) return;
      var ten = $("inpDoiTenNhom").value.trim();
      if (!ten) { $("loiThongTinNhom").textContent = "Tên nhóm không được để trống."; return; }
      goiAPI("/api/nhom/doi-ten", "POST", { nhom: g.id, ten: ten }, true).then(function (kq) {
        if (!kq.ok) { $("loiThongTinNhom").textContent = kq.loi || "Không đổi tên được."; return; }
        hienToast("Đã đổi tên nhóm.");
        taiChiTietNhom(g.id, false);
        taiDsTroChuyen();
      });
    });
    var btnThemXn = $("btnThemThanhVienXacNhan");
    if (btnThemXn) btnThemXn.addEventListener("click", function () {
      var g = nhomThongTin;
      if (!g) return;
      var ds = layDsDaChon("dsBanBeThemNhom");
      if (!ds.length) { $("loiThongTinNhom").textContent = "Bạn chưa chọn người bạn nào để thêm."; return; }
      goiAPI("/api/nhom/them-thanh-vien", "POST", { nhom: g.id, dsSDT: ds }, true).then(function (kq) {
        if (!kq.ok) { $("loiThongTinNhom").textContent = kq.loi || "Không thêm được thành viên."; return; }
        hienToast("Đã thêm thành viên vào nhóm 👥");
        taiChiTietNhom(g.id, false);
        taiDsTroChuyen();
      });
    });
    var btnRoi = $("btnRoiNhom");
    if (btnRoi) btnRoi.addEventListener("click", function () {
      var g = nhomThongTin;
      if (!g) return;
      if (!confirm("Bạn rời nhóm “" + g.ten + "”?")) return;
      goiAPI("/api/nhom/roi", "POST", { nhom: g.id }, true).then(function (kq) {
        if (!kq.ok) { $("loiThongTinNhom").textContent = kq.loi || "Không rời nhóm được."; return; }
        hienToast("Bạn đã rời nhóm.");
        dongManChatNhom(true);
      });
    });
    var btnGt = $("btnGiaiTanNhom");
    if (btnGt) btnGt.addEventListener("click", function () {
      var g = nhomThongTin;
      if (!g) return;
      if (!confirm("Giải tán nhóm “" + g.ten + "”? Toàn bộ tin nhắn của nhóm sẽ bị xóa, không khôi phục được.")) return;
      goiAPI("/api/nhom/giai-tan", "POST", { nhom: g.id }, true).then(function (kq) {
        if (!kq.ok) { $("loiThongTinNhom").textContent = kq.loi || "Không giải tán được."; return; }
        hienToast("Đã giải tán nhóm.");
        dongManChatNhom(true);
      });
    });
  });

  // ================= V6.2: QR & TIỆN ÍCH (quét QR, mã QR của tôi, thẻ ngân hàng, cách mở link) =================
  // Động cơ giải mã: BarcodeDetector (Chrome Android, có sẵn trong máy) trước; dự phòng jsQR
  // đóng gói cục bộ (jsqr.js). Sinh mã QR cá nhân: qrcode.js (Arase, MIT) vẽ ra canvas.
  // KHÔNG thêm endpoint máy chủ nào: lưu QR dùng lại POST /api/vi-qr (loai "noi-dung").

  var qrStream = null;          // luồng camera đang mở ở màn quét
  var qrTrack = null;           // track video (để bật đèn pin)
  var qrVongLap = null;         // id timeout của vòng quét camera
  var qrDangMo = false;         // màn quét đang mở
  var qrPhatHienXong = false;   // đã có kết quả trong lần mở này (dừng quét, chờ thao tác)
  var qrDenPinDangBat = false;
  var qrDetector = null;        // BarcodeDetector dùng chung
  var qrCacheAnh = {};          // tepId -> chuỗi QR ("" = đã quét, không có mã) — nhớ trong phiên
  var qrHangDoiAnh = [];        // hàng đợi quét ảnh chat: [{tepId, bong}]
  var qrDangQuetAnh = false;    // khóa: 1 ảnh tại một thời điểm

  function layDetector() {
    if (typeof window === "undefined" || !("BarcodeDetector" in window)) return null;
    if (!qrDetector) {
      try { qrDetector = new window.BarcodeDetector({ formats: ["qr_code"] }); }
      catch (e) { qrDetector = null; }
    }
    return qrDetector;
  }

  // Giải mã QR từ một nguồn ảnh (video / canvas / ImageBitmap). Trả Promise<chuỗi|null>.
  function giaiMaQR(nguon) {
    var det = layDetector();
    if (det) {
      return det.detect(nguon)
        .then(function (ds) { return (ds && ds.length && ds[0].rawValue) ? String(ds[0].rawValue) : null; })
        .catch(function () { return giaiMaBangJsQR(nguon); });
    }
    return Promise.resolve().then(function () { return giaiMaBangJsQR(nguon); });
  }

  function giaiMaBangJsQR(nguon) {
    try {
      if (typeof jsQR !== "function") return null;
      var cv = $("canvasQuetQR");
      if (!cv) return null;
      var w = nguon.videoWidth || nguon.width || 0;
      var h = nguon.videoHeight || nguon.height || 0;
      if (!w || !h) return null;
      // Thu nhỏ về tối đa 1000px/chiều cho giải mã nhanh (đo thực tế: ~0,1–0,3 giây/ảnh sạch)
      var tiLe = Math.min(1, 1000 / Math.max(w, h));
      cv.width = Math.max(1, Math.round(w * tiLe));
      cv.height = Math.max(1, Math.round(h * tiLe));
      var ctx = cv.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(nguon, 0, 0, cv.width, cv.height);
      var imgData = ctx.getImageData(0, 0, cv.width, cv.height);
      var kq = jsQR(imgData.data, cv.width, cv.height, { inversionAttempts: "attemptBoth" });
      return (kq && kq.data) ? kq.data : null;
    } catch (e) { return null; }
  }

  function giaiMaQRTuTep(file) {
    if (!file || !window.createImageBitmap) return Promise.resolve(null);
    return createImageBitmap(file)
      .then(function (bmp) { return giaiMaQR(bmp); })
      .catch(function () { return null; });
  }

  // ---------- Màn hình quét QR ----------
  function moManQuetQR() {
    qrDangMo = true;
    qrPhatHienXong = false;
    qrDenPinDangBat = false;
    $("manQuetQR").classList.remove("an");
    $("hopKetQuaQR").classList.add("an");
    $("nhanKhongCamera").classList.add("an");
    batCameraQR();
  }

  function dongManQuetQR() {
    qrDangMo = false;
    dungCameraQR();
    $("manQuetQR").classList.add("an");
  }

  function dungCameraQR() {
    if (qrVongLap) { clearTimeout(qrVongLap); qrVongLap = null; }
    if (qrStream) {
      qrStream.getTracks().forEach(function (t) { t.stop(); });
      qrStream = null;
      qrTrack = null;
    }
    var v = $("videoQuetQR");
    if (v) v.srcObject = null;
    var nutPin = $("btnDenPinQR");
    if (nutPin) nutPin.classList.add("an");
  }

  function batCameraQR() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      $("nhanKhongCamera").classList.remove("an");
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(function (stream) {
        if (!qrDangMo) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        qrStream = stream;
        qrTrack = stream.getVideoTracks()[0] || null;
        var v = $("videoQuetQR");
        v.srcObject = stream;
        if (v.play) v.play().catch(function () {});
        try {
          var caps = (qrTrack && qrTrack.getCapabilities) ? qrTrack.getCapabilities() : null;
          if (caps && caps.torch) $("btnDenPinQR").classList.remove("an");
        } catch (e) {}
        vongQuetCamera();
      })
      .catch(function () { $("nhanKhongCamera").classList.remove("an"); });
  }

  function vongQuetCamera() {
    if (!qrDangMo || qrPhatHienXong) return;
    var video = $("videoQuetQR");
    if (video && video.readyState >= 2) {
      giaiMaQR(video).then(function (chuoi) {
        if (!qrDangMo || qrPhatHienXong) return;
        if (chuoi) {
          qrPhatHienXong = true;
          dungCameraQR();
          hienKetQuaQR(chuoi);
        } else {
          qrVongLap = setTimeout(vongQuetCamera, 300);
        }
      });
    } else {
      qrVongLap = setTimeout(vongQuetCamera, 300);
    }
  }

  function batTatDenPinQR() {
    if (!qrTrack || !qrTrack.applyConstraints) return;
    qrDenPinDangBat = !qrDenPinDangBat;
    qrTrack.applyConstraints({ advanced: [{ torch: qrDenPinDangBat }] })
      .catch(function () { qrDenPinDangBat = false; });
  }

  function quetTuAnhSuKien(file) {
    if (!file) return;
    giaiMaQRTuTep(file).then(function (chuoi) {
      if (chuoi) {
        qrPhatHienXong = true;
        dungCameraQR();
        hienKetQuaQR(chuoi);
      } else {
        hienToast("Không tìm thấy mã QR trong ảnh này.");
      }
    });
  }

  // ---------- Phân loại kết quả quét ----------
  function chuanSdtVN(s) {
    var d = String(s || "").replace(/[^0-9]/g, "");
    if (d.length === 11 && d.indexOf("84") === 0) d = "0" + d.slice(2);
    return /^0[0-9]{9}$/.test(d) ? d : null;
  }

  function tachSdtKetBan(chuoi) {
    // Link Hialo kèm ?ketban= / ?goi= -> SĐT đích; chuỗi CHỈ gồm SĐT thuần cũng coi là mã kết bạn
    // (chuỗi dạng khác — kể cả URL lạ chứa số — để dành cho nhánh link/nội dung ở dưới)
    if (chuoi.indexOf("hialo.vn") !== -1) {
      var m = chuoi.match(/[?&](?:ketban|goi)=([0-9+]+)/);
      if (m) return chuanSdtVN(m[1]);
    }
    if (/^\+?[0-9][0-9 ]{8,14}$/.test(chuoi.trim())) return chuanSdtVN(chuoi);
    return null;
  }

  function moKetBanTuSDT(sdt) {
    dongManQuetQR();
    chonTab("danhba");
    var inp = $("inpTimSdt");
    if (inp) inp.value = sdt;
    setTimeout(function () { var n = $("btnTimSdt"); if (n) n.click(); }, 600);
  }

  function saoChepChuoi(chuoi) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(chuoi).then(
        function () { hienToast("Đã sao chép 📋"); },
        function () { hienToast("Không sao chép tự động được."); }
      );
    } else {
      hienToast("Trình duyệt không hỗ trợ sao chép tự động.");
    }
  }

  function luuVaoViQR(ten, noiDung) {
    goiAPI("/api/vi-qr", "POST", { ten: ten, loai: "noi-dung", noiDung: noiDung }, true).then(function (kq) {
      if (!kq.ok) { hienToast(kq.loi || "Chưa lưu được vào Ví QR."); return; }
      hienToast("Đã lưu vào Ví QR 🔳");
    });
  }

  function moLienKet(url) {
    if (caiDatHT && caiDatHT.moLink === "trong-app") location.assign(url);
    else window.open(url, "_blank", "noopener");
  }

  // Bóc tách VietQR (EMVCo): trường 38 -> GUID A000000727 + (BIN 6 số + STK)
  var BANG_BIN = {
    "970418": "BIDV", "970436": "Vietcombank", "970422": "MB Bank", "970407": "Techcombank",
    "970415": "VietinBank", "970405": "Agribank", "970416": "ACB", "970432": "VPBank",
    "970403": "Sacombank", "970423": "TPBank", "970437": "HDBank", "970440": "SeABank",
    "970441": "VIB", "970443": "SHB", "970431": "Eximbank", "970426": "MSB",
    "970448": "OCB", "970449": "LienVietPostBank", "970428": "Nam A Bank", "970452": "KienlongBank"
  };

  function docTLV(chuoi, ketThuc) {
    var ra = {};
    var i = 0;
    while (i + 4 <= ketThuc) {
      var id = chuoi.substr(i, 2);
      var dai = parseInt(chuoi.substr(i + 2, 2), 10);
      if (isNaN(dai) || i + 4 + dai > ketThuc) break;
      ra[id] = chuoi.substr(i + 4, dai);
      i += 4 + dai;
    }
    return ra;
  }

  function tachVietQR(chuoi) {
    try {
      var goc = docTLV(chuoi, chuoi.length);
      var f38 = goc["38"];
      if (!f38) return null;
      var con = docTLV(f38, f38.length);
      if (con["00"] !== "A000000727") return null;
      var binStk = con["01"] || "";
      var bin = binStk.slice(0, 6);
      var stk = binStk.slice(6);
      if (!stk) return null;
      return { bin: bin, stk: stk, nganHang: BANG_BIN[bin] || ("Ngân hàng BIN " + bin) };
    } catch (e) { return null; }
  }

  function hienKetQuaQR(chuoiTho) {
    var chuoi = String(chuoiTho || "").trim();
    if (!chuoi) return;
    if (!qrDangMo) {
      // Mở màn ở chế độ xem kết quả (không bật camera) — đường vào từ thẻ QR trong ảnh chat
      qrDangMo = true;
      $("manQuetQR").classList.remove("an");
      $("nhanKhongCamera").classList.add("an");
    }
    qrPhatHienXong = true;
    var hop = $("hopKetQuaQR");
    var tieu = $("tieuDeKetQuaQR");
    var nd = $("noiDungKetQuaQR");
    var hangNut = $("hangNutKetQuaQR");
    hangNut.innerHTML = "";
    hop.classList.remove("an");
    function nutNhan(nhan, lop, fn) { hangNut.appendChild(taoNutNhan(nhan, lop, fn)); }
    function nutQuetTiep() {
      nutNhan("🔳 Quét tiếp", "nutPhu nho", function () {
        hop.classList.add("an");
        qrPhatHienXong = false;
        batCameraQR();
      });
    }
    function nutDong() { nutNhan("Đóng", "nutPhu nho", function () { dongManQuetQR(); }); }

    var sdtKB = tachSdtKetBan(chuoi);
    if (sdtKB) {
      tieu.textContent = "🔳 Mã kết bạn Hialo";
      nd.textContent = "Số điện thoại: " + sdtKB;
      nutNhan("👋 Mở trang kết bạn", "nutChinh nho", function () { moKetBanTuSDT(sdtKB); });
      nutQuetTiep(); nutDong();
      return;
    }
    if (chuoi.indexOf("000201") === 0) {
      var tt = tachVietQR(chuoi);
      tieu.textContent = "🏦 Mã VietQR";
      nd.textContent = tt
        ? (tt.nganHang + " — Số tài khoản " + tt.stk)
        : "Không đọc được thông tin ngân hàng trong mã này. Bạn vẫn có thể lưu nguyên nội dung vào Ví QR.";
      nutNhan("💾 Lưu vào Ví QR", "nutChinh nho", function () {
        luuVaoViQR(tt ? ("VietQR " + tt.nganHang + " " + tt.stk) : "VietQR", chuoi);
      });
      nutQuetTiep(); nutDong();
      return;
    }
    if (/^https?:\/\//i.test(chuoi)) {
      tieu.textContent = "🔗 Liên kết web";
      nd.textContent = chuoi;
      nutNhan("🌐 Mở link", "nutChinh nho", function () {
        if (window.confirm("Mở liên kết này?\n\n" + chuoi)) moLienKet(chuoi);
      });
      nutNhan("📋 Sao chép", "nutPhu nho", function () { saoChepChuoi(chuoi); });
      nutQuetTiep(); nutDong();
      return;
    }
    tieu.textContent = "📄 Nội dung mã QR";
    nd.textContent = chuoi;
    nutNhan("📋 Sao chép", "nutChinh nho", function () { saoChepChuoi(chuoi); });
    nutNhan("💾 Lưu vào Ví QR", "nutPhu nho", function () { luuVaoViQR("Mã QR đã quét", chuoi); });
    nutQuetTiep(); nutDong();
  }

  // ---------- Trang trí tin văn bản: linkify + thẻ ngân hàng ----------
  // Chữ thường luôn là text node (không chèn HTML thô từ nội dung tin) nên an toàn XSS.
  function trangTriTinVanBan(bong, noiDung) {
    var re = /(https?:\/\/[^\s<>"']+)/g;
    var con = 0;
    var m;
    while ((m = re.exec(noiDung)) !== null) {
      var url = m[1];
      var duoi = "";
      while (url.length > 8 && ".,;:!?)".indexOf(url.charAt(url.length - 1)) !== -1) {
        duoi = url.charAt(url.length - 1) + duoi;
        url = url.slice(0, -1);
      }
      if (m.index > con) bong.appendChild(document.createTextNode(noiDung.slice(con, m.index)));
      var a = document.createElement("a");
      a.className = "linkTrongChat";
      a.href = url;
      a.textContent = url;
      a.rel = "noopener";
      (function (u) {
        a.addEventListener("click", function (e) { e.preventDefault(); moLienKet(u); });
      })(url);
      bong.appendChild(a);
      if (duoi) bong.appendChild(document.createTextNode(duoi));
      con = m.index + m[1].length;
    }
    if (con < noiDung.length) bong.appendChild(document.createTextNode(noiDung.slice(con)));
    ganTheNganHang(bong, noiDung);
  }

  var TU_KHOA_NGAN_HANG = [
    ["bidv", "BIDV"], ["vietcombank", "Vietcombank"], ["vcb", "Vietcombank"],
    ["mb bank", "MB Bank"], ["mbbank", "MB Bank"], ["techcombank", "Techcombank"],
    ["vietinbank", "VietinBank"], ["agribank", "Agribank"], ["acb", "ACB"],
    ["vpbank", "VPBank"], ["sacombank", "Sacombank"], ["tpbank", "TPBank"],
    ["ocb", "OCB"], ["hdbank", "HDBank"], ["seabank", "SeABank"], ["vib", "VIB"],
    ["shb", "SHB"], ["eximbank", "Eximbank"], ["msb", "MSB"],
    ["momo", "MoMo"], ["zalopay", "ZaloPay"], ["shopeepay", "ShopeePay"], ["vnpay", "VNPay"]
  ];

  // Nhận diện thận trọng: BẮT BUỘC có tên ngân hàng/ví đi kèm một dãy 6–19 chữ số trong cùng tin.
  function phatHienTheNganHang(noiDung) {
    if (!noiDung) return null;
    var thuong = " " + noiDung.toLowerCase() + " ";
    var tenNH = null;
    for (var i = 0; i < TU_KHOA_NGAN_HANG.length; i++) {
      if (thuong.indexOf(TU_KHOA_NGAN_HANG[i][0]) !== -1) { tenNH = TU_KHOA_NGAN_HANG[i][1]; break; }
    }
    if (!tenNH) return null;
    var m = noiDung.match(/\d[\d ]{4,20}\d|\d{6,19}/);
    if (!m) return null;
    var stk = m[0].replace(/ /g, "");
    if (stk.length < 6 || stk.length > 19) return null;
    return { nganHang: tenNH, stk: stk };
  }

  function ganTheNganHang(bong, noiDung) {
    if (!caiDatHT || caiDatHT.qrTheNganHang === false) return;
    var tt = phatHienTheNganHang(noiDung);
    if (!tt) return;
    var the = document.createElement("div");
    the.className = "theNganHangTrongChat";
    var dong1 = document.createElement("div");
    dong1.className = "dongTheNganHang";
    var che = tt.stk.length > 8 ? (tt.stk.slice(0, 4) + "••••" + tt.stk.slice(-4)) : tt.stk;
    dong1.textContent = "🏦 " + tt.nganHang + " • " + che;
    the.appendChild(dong1);
    var dong2 = document.createElement("div");
    dong2.className = "dongTheNganHang";
    dong2.appendChild(taoNutNhan("📋 Sao chép STK", "nutPhu nho", function () { saoChepChuoi(tt.stk); }));
    dong2.appendChild(taoNutNhan("💾 Lưu Ví QR", "nutPhu nho", function () { luuVaoViQR(tt.nganHang + " " + tt.stk, tt.stk); }));
    the.appendChild(dong2);
    bong.appendChild(the);
  }

  // ---------- Tự nhận diện QR trong ảnh chat (chỉ khi user bật công tắc) ----------
  // Kỷ luật hiệu năng: chỉ ảnh của cuộc trò chuyện đang mở (điểm vẽ tin gọi vào đây),
  // hàng đợi chạy 1 ảnh/lúc, nhớ kết quả theo tepId trong phiên, không quét lại.
  function lichQuetQRTrongAnh(tepId, bong) {
    if (!tepId || !bong) return;
    if (!caiDatHT || !caiDatHT.qrTuDongTrongAnh) return;
    if (Object.prototype.hasOwnProperty.call(qrCacheAnh, tepId)) {
      if (qrCacheAnh[tepId]) ganChipQR(bong, qrCacheAnh[tepId]);
      return;
    }
    qrHangDoiAnh.push({ tepId: tepId, bong: bong });
    chayHangDoiQuetAnh();
  }

  function chayHangDoiQuetAnh() {
    if (qrDangQuetAnh) return;
    var muc = qrHangDoiAnh.shift();
    if (!muc) return;
    qrDangQuetAnh = true;
    quetAnhChat(muc.tepId).then(function (chuoi) {
      qrCacheAnh[muc.tepId] = chuoi || "";
      if (chuoi && muc.bong && document.contains(muc.bong)) ganChipQR(muc.bong, chuoi);
      qrDangQuetAnh = false;
      chayHangDoiQuetAnh();
    });
  }

  function quetAnhChat(tepId) {
    var url = duongDanTep(tepId);
    if (!url || !window.fetch || !window.createImageBitmap) return Promise.resolve(null);
    return fetch(url)
      .then(function (r) { return r.blob(); })
      .then(function (blob) { return createImageBitmap(blob); })
      .then(function (bmp) { return giaiMaQR(bmp); })
      .catch(function () { return null; });
  }

  function ganChipQR(bong, chuoi) {
    if (bong.querySelector(".chipQRTrongAnh")) return;
    var chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chipQRTrongAnh";
    chip.textContent = "🔳 Mã QR — chạm để xem";
    chip.addEventListener("click", function () { hienKetQuaQR(chuoi); });
    bong.appendChild(chip);
  }

  // ---------- Mã QR của tôi ----------
  function veMaQRCuaToi() {
    var canvas = $("canvasMaQR");
    if (!canvas) return;
    $("nickMaQR").textContent = (me && me.nick) ? me.nick : "";
    $("sdtMaQR").textContent = sdtHienTai ? ("📱 " + sdtHienTai) : "";
    if (!sdtHienTai || typeof qrcode !== "function") return;
    var link = "https://www.hialo.vn/?ketban=" + encodeURIComponent(sdtHienTai);
    try {
      var qr = qrcode(0, "M");
      qr.addData(link);
      qr.make();
      var n = qr.getModuleCount();
      var vungDem = 4;
      var o = Math.max(2, Math.floor(264 / (n + vungDem * 2)));
      var kich = (n + vungDem * 2) * o;
      canvas.width = kich;
      canvas.height = kich;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, kich, kich);
      ctx.fillStyle = "#000000";
      for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
          if (qr.isDark(r, c)) ctx.fillRect((c + vungDem) * o, (r + vungDem) * o, o, o);
        }
      }
    } catch (e) {
      $("sdtMaQR").textContent = "Không tạo được mã QR trên trình duyệt này.";
    }
  }

  function luuAnhMaQR() {
    var canvas = $("canvasMaQR");
    if (!canvas || !canvas.toBlob) { hienToast("Trình duyệt không hỗ trợ lưu ảnh."); return; }
    canvas.toBlob(function (blob) {
      if (!blob) return;
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "hialo-ma-qr-cua-toi.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    }, "image/png");
  }

  function chiaSeMaQR() {
    var link = "https://www.hialo.vn/?ketban=" + encodeURIComponent(sdtHienTai || "");
    var canvas = $("canvasMaQR");
    function chiaSeChu() {
      if (navigator.share) {
        navigator.share({ title: "Mã QR Hialo của tôi", text: "Kết bạn với tôi trên HIALO:", url: link }).catch(function () {});
      } else {
        saoChepChuoi(link);
      }
    }
    if (canvas && canvas.toBlob && navigator.canShare && navigator.share) {
      canvas.toBlob(function (blob) {
        if (!blob) { chiaSeChu(); return; }
        var file = new File([blob], "hialo-ma-qr.png", { type: "image/png" });
        var duLieu = { files: [file], title: "Mã QR Hialo của tôi" };
        if (navigator.canShare(duLieu)) navigator.share(duLieu).catch(function () {});
        else chiaSeChu();
      }, "image/png");
    } else {
      chiaSeChu();
    }
  }

  // ---------- Quyền của tiện ích và ứng dụng (trang Quyền riêng tư) ----------
  function taiQuyenTienIch() {
    datTrangThaiQuyen("camera", "quyenCamera", "btnThuQuyenCamera");
    datTrangThaiQuyen("microphone", "quyenMicro", "btnThuQuyenMicro");
    datTrangThaiQuyen("geolocation", "quyenViTri", "btnThuQuyenViTri");
    var elTB = $("quyenThongBao");
    var nutTB = $("btnThuQuyenThongBao");
    if (elTB) {
      if (!("Notification" in window)) {
        elTB.textContent = "Trình duyệt không hỗ trợ";
        if (nutTB) nutTB.classList.add("an");
      } else if (Notification.permission === "granted") {
        elTB.textContent = "Đã cấp";
        if (nutTB) nutTB.classList.add("an");
      } else if (Notification.permission === "denied") {
        elTB.textContent = "Đã từ chối — mở lại trong cài đặt trang web của trình duyệt";
        if (nutTB) nutTB.classList.add("an");
      } else {
        elTB.textContent = "Chưa cấp";
        if (nutTB) nutTB.classList.remove("an");
      }
    }
    var ttQr = $("trangThaiQrTuDong");
    if (ttQr && caiDatHT) ttQr.textContent = caiDatHT.qrTuDongTrongAnh ? "Đang bật" : "Đang tắt";
  }

  function datTrangThaiQuyen(tenQuyen, idEl, idNut) {
    var el = $(idEl);
    var nut = $(idNut);
    if (!el) return;
    if (!navigator.permissions || !navigator.permissions.query) {
      el.textContent = "Xem trong cài đặt trình duyệt";
      return;
    }
    navigator.permissions.query({ name: tenQuyen }).then(function (st) {
      capNhatDongQuyen(el, nut, st.state);
      st.onchange = function () { capNhatDongQuyen(el, nut, st.state); };
    }).catch(function () {
      el.textContent = "Xem trong cài đặt trình duyệt";
    });
  }

  function capNhatDongQuyen(el, nut, trangThai) {
    if (trangThai === "granted") {
      el.textContent = "Đã cấp";
      if (nut) nut.classList.add("an");
    } else if (trangThai === "denied") {
      el.textContent = "Đã từ chối — mở lại trong cài đặt trang web của trình duyệt";
      if (nut) nut.classList.add("an");
    } else {
      el.textContent = "Chưa cấp";
      if (nut) nut.classList.remove("an");
    }
  }

  function thuCapQuyen(loai) {
    if (loai === "camera" || loai === "micro") {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        hienToast("Trình duyệt không hỗ trợ cấp quyền này.");
        return;
      }
      var dk = (loai === "camera") ? { video: true } : { audio: true };
      navigator.mediaDevices.getUserMedia(dk).then(function (s) {
        s.getTracks().forEach(function (t) { t.stop(); });
        hienToast("Đã cấp quyền ✅");
        taiQuyenTienIch();
      }).catch(function () {
        hienToast("Chưa cấp được quyền. Kiểm tra cài đặt trình duyệt nhé.");
        taiQuyenTienIch();
      });
    } else if (loai === "vitri") {
      if (!navigator.geolocation) { hienToast("Máy không hỗ trợ định vị."); return; }
      navigator.geolocation.getCurrentPosition(
        function () { hienToast("Đã cấp quyền vị trí ✅"); taiQuyenTienIch(); },
        function () { hienToast("Chưa cấp được quyền vị trí."); taiQuyenTienIch(); },
        { timeout: 10000 }
      );
    } else if (loai === "thongbao") {
      if (!("Notification" in window)) return;
      Notification.requestPermission().then(function () { taiQuyenTienIch(); });
    }
  }

  // ---------- Gắn sự kiện cho gói QR & Tiện ích ----------
  function anMenuCong() {
    var m = $("menuCong");
    if (m) m.classList.add("an");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var bQuet = $("btnQuetQR");
    if (bQuet) bQuet.addEventListener("click", function () { moManQuetQR(); });
    var mQuet = $("mucQuetQRMenu");
    if (mQuet) mQuet.addEventListener("click", function () { anMenuCong(); moManQuetQR(); });
    var mThemBan = $("mucThemBan");
    if (mThemBan) mThemBan.addEventListener("click", function () {
      anMenuCong();
      chonTab("danhba");
      setTimeout(function () { var i = $("inpTimSdt"); if (i) i.focus(); }, 350);
    });
    var mGoiNhom = $("mucGoiNhom");
    if (mGoiNhom) mGoiNhom.addEventListener("click", function () {
      anMenuCong();
      hienToast("Tính năng tạo cuộc gọi nhóm sắp có 📞");
    });
    var mMaQR = $("mucMaQR");
    if (mMaQR) mMaQR.addEventListener("click", function () {
      anMenuCong();
      chonTab("canhan");
      moTrangCaNhan("trangMaQRCuaToi");
    });
    var bDong = $("btnDongQuetQR");
    if (bDong) bDong.addEventListener("click", function () { dongManQuetQR(); });
    var bAnh = $("btnQuetTuAnh");
    if (bAnh) bAnh.addEventListener("click", function () { $("inpAnhQuetQR").click(); });
    var inpAnh = $("inpAnhQuetQR");
    if (inpAnh) inpAnh.addEventListener("change", function () {
      if (this.files && this.files[0]) quetTuAnhSuKien(this.files[0]);
      this.value = "";
    });
    var bPin = $("btnDenPinQR");
    if (bPin) bPin.addEventListener("click", function () { batTatDenPinQR(); });
    var bLuuQR = $("btnLuuAnhQR");
    if (bLuuQR) bLuuQR.addEventListener("click", function () { luuAnhMaQR(); });
    var bChiaSe = $("btnChiaSeQR");
    if (bChiaSe) bChiaSe.addEventListener("click", function () { chiaSeMaQR(); });
    var qCam = $("btnThuQuyenCamera");
    if (qCam) qCam.addEventListener("click", function () { thuCapQuyen("camera"); });
    var qMic = $("btnThuQuyenMicro");
    if (qMic) qMic.addEventListener("click", function () { thuCapQuyen("micro"); });
    var qVt = $("btnThuQuyenViTri");
    if (qVt) qVt.addEventListener("click", function () { thuCapQuyen("vitri"); });
    var qTb = $("btnThuQuyenThongBao");
    if (qTb) qTb.addEventListener("click", function () { thuCapQuyen("thongbao"); });
  });

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
    xhr.setRequestHeader("X-Tu-Huy", String(layTuHuyDangChon())); // Gói 4
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

  // Gói 1: cấu hình ICE lấy từ máy chủ (STUN Google + TURN của Hialo, credential
  // ngắn hạn 1 giờ). Chưa tải được thì dùng STUN Google như các bản trước.
  var cauHinhICEHT = [{ urls: "stun:stun.l.google.com:19302" }];
  var lucTaiICE = 0;
  function taiCauHinhICE() {
    if (!TQD_SERVER || !tokenMayChu) return;
    lucTaiICE = Date.now();
    goiAPI("/api/ice", "GET", null, true).then(function (kq) {
      if (kq.ok && Array.isArray(kq.iceServers) && kq.iceServers.length) cauHinhICEHT = kq.iceServers;
    });
  }

  function taoPC() {
    if (Date.now() - lucTaiICE > 3000000) taiCauHinhICE(); // Gói 1: làm mới credential TURN sau ~50 phút
    var pc = new RTCPeerConnection({ iceServers: cauHinhICEHT });
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
    if (phongHT) { hienToast("Bạn đang ở trong phòng thoại — hãy rời phòng trước khi gọi 1-1 nhé."); return; } // Gói 3
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
    if (goiHT || goiDenCho || phongHT) { // phía client đang bận (máy chủ đã lọc, đây là lớp dự phòng); Gói 3: đang ở phòng thoại cũng từ chối
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
    if (msg.loaiTin === "dang-nhap") { nhanTinDangNhap(msg); return; } // Gói 4: đang nhập…
    if (typeof msg.loaiTin === "string" && msg.loaiTin.indexOf("phong-") === 0) { xuLyTinPhong(msg); return; } // Gói 3
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
      taiTrangThaiXacThuc(); // Gói 1: trạng thái xác thực hồ sơ
      taiCauHinhICE(); // Gói 1: cấu hình ICE (STUN + TURN) cho cuộc gọi
    });
  }

  // Đổ toàn bộ cài đặt hiện tại vào MỌI trang con (nhiều trang dùng chung một khóa)
  function dienCaiDatVaoTrang() {
    if (!caiDatHT) return;
    var c = caiDatHT;
    $("chkTimBangSDT").checked = !!c.timBangSDT;
    $("chkTimBangSDTDanhBa").checked = !!c.timBangSDT;
    $("chkLaNhanTin").checked = !!c.laNhanTin;
    $("chkChiNhanTinBanBe").checked = !!c.chiNhanTinBanBe; // Gói 1
    $("chkHienDaXem").checked = c.hienDaXem !== false; // Gói 4
    $("chkLaGoi").checked = !!c.laGoi;
    $("chkLaGoiCd").checked = !!c.laGoi;
    $("chkEnterGui").checked = c.enterGui !== false;
    $("chkHienGioTin").checked = c.hienGioTin !== false;
    $("chkRungKhiGoiDen").checked = c.rungKhiGoiDen !== false;
    $("chkTuongChiBanBe").checked = c.tuongChiBanBe !== false;
    $("chkTuongChiBanBeRt").checked = c.tuongChiBanBe !== false;
    $("chkTuongThongBao").checked = !!c.tuongThongBao;
    $("selDanhBaSapXep").value = c.danhBaSapXep || "mac-dinh";
    $("chkQrTuDongTrongAnh").checked = !!c.qrTuDongTrongAnh;
    $("chkQrTheNganHang").checked = c.qrTheNganHang !== false;
    datRadio("moLink", c.moLink || "trinh-duyet");
    var ttQr = $("trangThaiQrTuDong");
    if (ttQr) ttQr.textContent = c.qrTuDongTrongAnh ? "Đang bật" : "Đang tắt";
    datRadio("giaoDien", c.giaoDien || "sang");
    datRadio("nhacChuong", c.nhacChuong || "mac-dinh");
    nenGoiDenChon = c.nenGoiDen || "mac-dinh";
    nenGoiDenTepChon = c.nenGoiDenTep || "";
    apGiaoDien(c.giaoDien || "sang");
    document.body.classList.toggle("anGioTin", c.hienGioTin === false);
    capNhatLuoiNenGoi();
    // Gói 5: ngôn ngữ lưu trên máy chủ là nguồn thật — khác ngôn ngữ đang hiện thì áp ngay
    if (c.ngonNgu && NGON_NGU_HOP_LE_G5.indexOf(c.ngonNgu) !== -1 && c.ngonNgu !== ngonNguHT) {
      datNgonNgu(c.ngonNgu, false);
    }
  }

  function luuCaiDatTuCongTac() {
    if (!TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/cai-dat", "PUT", {
      timBangSDT: $("chkTimBangSDT").checked,
      laNhanTin: $("chkLaNhanTin").checked,
      chiNhanTinBanBe: $("chkChiNhanTinBanBe").checked, // Gói 1
      hienDaXem: $("chkHienDaXem").checked, // Gói 4
      laGoi: $("chkLaGoi").checked,
      enterGui: $("chkEnterGui").checked,
      hienGioTin: $("chkHienGioTin").checked,
      rungKhiGoiDen: $("chkRungKhiGoiDen").checked,
      tuongChiBanBe: $("chkTuongChiBanBe").checked,
      tuongThongBao: $("chkTuongThongBao").checked,
      danhBaSapXep: $("selDanhBaSapXep").value,
      qrTuDongTrongAnh: $("chkQrTuDongTrongAnh").checked,
      qrTheNganHang: $("chkQrTheNganHang").checked,
      moLink: docRadio("moLink") || "trinh-duyet",
      giaoDien: docRadio("giaoDien") || "sang",
      nhacChuong: docRadio("nhacChuong") || "mac-dinh",
      nenGoiDen: nenGoiDenChon,
      nenGoiDenTep: nenGoiDenTepChon,
      ngonNgu: ngonNguHT // Gói 5: giữ ngôn ngữ đã chọn khi lưu cài đặt khác
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
    $("sdtTaiKhoan").textContent = /^0\d{9}$/.test(sdtHienTai || "") ? sdtHienTai : "—";
    taiTrangThaiLienKet(); // Gói 5: mục Tài khoản liên kết
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

  // ===== TỰ XÓA TÀI KHOẢN TRONG APP =====
  function chuanBiTrangXoaTaiKhoan() {
    $("sdtXoaTaiKhoan").textContent = sdtHienTai || "";
    $("chkHieuXoaTaiKhoan").checked = false;
    $("inpBonSoCuoiXoa").value = "";
    $("loiXoaTaiKhoan").textContent = "";
    capNhatNutXoaTaiKhoan();
  }

  function capNhatNutXoaTaiKhoan() {
    var nut = $("btnXoaTaiKhoanVinhVien");
    if (!nut) return;
    var bonSo = $("inpBonSoCuoiXoa").value.replace(/\D/g, "");
    nut.disabled = !($("chkHieuXoaTaiKhoan").checked && sdtHienTai && bonSo === sdtHienTai.slice(-4));
    nut.textContent = "🗑 Xóa tài khoản vĩnh viễn";
  }

  function xoaTaiKhoanSuKien() {
    var loi = $("loiXoaTaiKhoan");
    if (!TQD_SERVER || !tokenMayChu) {
      loi.textContent = "Chức năng này chỉ hoạt động khi ứng dụng đã nối máy chủ.";
      return;
    }
    var bonSo = $("inpBonSoCuoiXoa").value.replace(/\D/g, "");
    if (!$("chkHieuXoaTaiKhoan").checked || !sdtHienTai || bonSo !== sdtHienTai.slice(-4)) {
      loi.textContent = "Hãy tích xác nhận và nhập đúng 4 số cuối của số điện thoại.";
      capNhatNutXoaTaiKhoan();
      return;
    }
    var sdtBiXoa = sdtHienTai;
    var nut = $("btnXoaTaiKhoanVinhVien");
    nut.disabled = true;
    nut.textContent = "Đang xóa tài khoản…";
    loi.textContent = "";
    goiAPI("/api/tai-khoan/xoa", "POST", { xacNhan: true, bonSoCuoi: bonSo }, true).then(function (kq) {
      if (!kq.ok) {
        loi.textContent = kq.loi || "Chưa xóa được tài khoản. Thử lại sau nhé.";
        capNhatNutXoaTaiKhoan();
        return;
      }
      // Xóa bản sao hồ sơ của chính tài khoản này trên thiết bị, rồi dùng luồng đăng xuất
      // sẵn có để dừng chat/gọi, hủy trạng thái phiên phía client và quay về màn đăng nhập.
      try {
        var users = taiUsers();
        if (users && users[sdtBiXoa]) { delete users[sdtBiXoa]; luuUsers(users); }
        localStorage.removeItem("hialo_phien_sms_den");
        sessionStorage.removeItem("tqd_da_mo_khoa");
      } catch (e) {}
      trangCaNhanDangMo = "hub";
      dangXuat();
      setTimeout(function () { hienToast("Đã xóa tài khoản và dữ liệu của bạn."); }, 80);
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
      return r.json().catch(function () { return { ok: false, loi: "Máy chủ trả lời không hợp lệ." }; }).then(function (kq) {
        // V7.1: phien het han o may chu (vd may chu khoi dong lai) -> tu dang xuat o may de hien man dang nhap
        if (r.status === 401 && canToken && tokenMayChu && duongDan !== "/api/dang-xuat") {
          hetPhienVuaXayRa = true;
          tokenMayChu = null;
          luuToken();
          dangXuat();
        }
        return kq;
      });
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
  var TEN_GOI_VIP = { tuan: "Gói tuần", thang: "Gói tháng", quy: "Gói 3 tháng", doi: "Gói trọn đời", nam: "Gói năm" };

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
      var congTT = kq.congThanhToan || { momo: false, zalopay: false, vietqr: false };
      var coCong = !!(congTT.momo || congTT.zalopay || congTT.vietqr);
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
        if (congTT.vietqr) {
          phai.appendChild(taoNutNhan("🏦 Chuyển khoản VietQR", "nutChinh nho nutVietQR", function () { datGoiVip(key, "vietqr"); }));
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
        var tenCong = cong === "momo" ? "MoMo" : (cong === "zalopay" ? "ZaloPay" : "Chuyển khoản VietQR");
        $("pcCong").textContent = tenCong;
        $("pcMaDon").textContent = kq.don.ma;
        $("pcTrangThai").textContent = cong === "vietqr"
          ? "⏳ Quét mã VietQR bên dưới bằng app ngân hàng, chuyển ĐÚNG số tiền và ghi ĐÚNG mã đơn làm nội dung chuyển khoản. VIP sẽ tự bật ngay khi hệ thống đối soát thấy tiền về (thường vài giây)."
          : "⏳ Đang chờ bạn hoàn tất thanh toán trên trang của " + tenCong + "… VIP sẽ tự bật ngay khi cổng xác nhận (thường vài giây).";
        var nutMo = $("pcMoLai");
        if (kq.payUrl) {
          nutMo.href = kq.payUrl;
          nutMo.classList.remove("an");
          window.open(kq.payUrl, "_blank");
        } else {
          nutMo.classList.add("an");
        }
        // VietQR: hiện ảnh mã QR + thông tin tài khoản nhận tiền ngay trong panel chờ
        var hopQR = $("pcHopQR");
        if (hopQR) {
          if (cong === "vietqr" && kq.vietqr && kq.vietqr.anhQR) {
            $("pcAnhQR").src = kq.vietqr.anhQR;
            $("pcThongTinNH").textContent = "Ngân hàng: " + (kq.vietqr.tenNganHang || "") +
              " · Số TK: " + (kq.vietqr.soTaiKhoan || "") + " · Chủ TK: " + (kq.vietqr.chuTaiKhoan || "");
            hopQR.classList.remove("an");
          } else {
            hopQR.classList.add("an");
          }
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

  // ======================================================================
  // ===== PLAY BILLING — mua VIP qua Google Play (chỉ bản app ?play=1) ===
  // Điều kiện hiện khối: (1) chế độ app Play (class "playapp" trên <html> —
  // do ?play=1 hoặc referrer android-app:// đặt) VÀ (2) có
  // 'getDigitalGoodsService' trong window. Thiếu một trong hai -> khối giữ
  // class anPlay (ẩn êm); bản web thường giữ nguyên 100% luồng SePay.
  // Giá: lấy từ getDetails() (giá thật theo khu vực người dùng). Không
  // khớp được chi tiết -> giá VND tham chiếu của Console KÈM NHÃN; riêng
  // gói năm không có giá tham chiếu (giá do chủ app chốt trong Console)
  // -> hiện "Xem giá trên Google Play".
  // Mua: PaymentRequest method https://play.google.com/billing, sku lấy
  // đúng itemId mà getDetails trả về cho gói đó (Play có thể trả itemId
  // dạng "hialo_vip:<basePlanId>" cho từng base plan; không có chi tiết
  // thì rơi về productId). purchaseToken gửi lên POST /api/play/xac-minh —
  // MÁY CHỦ đối chiếu basePlanId + expiryTime thật với Google rồi mới cấp
  // VIP, nên quyền lợi luôn đúng gói đã trả tiền thật. Máy chủ chưa có
  // khóa dịch vụ -> 503 {loi:"chua-cau-hinh"} -> thông báo nhẹ + ẩn nút.
  // ======================================================================
  var PLAY_PROVIDER = "https://play.google.com/billing";
  var PLAY_SKU_SUB = "hialo_vip";
  var PLAY_SKU_DOI = "hialo_vip_lifetime";
  var PLAY_GOI = [
    { loai: "sub", productId: PLAY_SKU_SUB, basePlanId: "tuan", period: "P1W", ten: "Gói tuần", giaTC: 25000, han: "Dùng trong 7 ngày · tự gia hạn qua Google Play" },
    { loai: "sub", productId: PLAY_SKU_SUB, basePlanId: "thang", period: "P1M", ten: "Gói tháng", giaTC: 59000, han: "Dùng trong 30 ngày · tự gia hạn qua Google Play" },
    { loai: "sub", productId: PLAY_SKU_SUB, basePlanId: "3-thang", period: "P3M", ten: "Gói 3 tháng", giaTC: 149000, han: "Dùng trong 90 ngày · tự gia hạn qua Google Play" },
    { loai: "sub", productId: PLAY_SKU_SUB, basePlanId: "nam", period: "P1Y", ten: "Gói năm", giaTC: 0, han: "Dùng trong 365 ngày · tự gia hạn qua Google Play" },
    { loai: "mot-lan", productId: PLAY_SKU_DOI, basePlanId: null, period: null, ten: "Gói trọn đời", giaTC: 2990000, han: "Dùng trọn đời — trả một lần duy nhất" }
  ];
  var dichVuPlay = null;

  function playDatTrangThai(msg) {
    var el = $("playTrangThai");
    if (el) el.textContent = msg || "";
  }

  // Khớp ItemDetails của getDetails với một gói: ưu tiên itemId dạng
  // "productId:basePlanId", sau đó productId + subscriptionPeriod (ISO 8601).
  function playKhopChiTiet(goi, dsChiTiet) {
    var i, ct;
    for (i = 0; i < dsChiTiet.length; i++) {
      ct = dsChiTiet[i];
      if (goi.loai === "mot-lan" && ct.itemId === PLAY_SKU_DOI) return ct;
    }
    if (goi.loai === "mot-lan") return null;
    for (i = 0; i < dsChiTiet.length; i++) {
      ct = dsChiTiet[i];
      var phan = String(ct.itemId || "").split(":");
      if (phan[0] === PLAY_SKU_SUB && phan[1] === goi.basePlanId) return ct;
    }
    for (i = 0; i < dsChiTiet.length; i++) {
      ct = dsChiTiet[i];
      if (ct.itemId === PLAY_SKU_SUB && ct.subscriptionPeriod === goi.period) return ct;
    }
    return null;
  }

  function playDinhDangGia(ct) {
    try {
      return new Intl.NumberFormat(navigator.language || "vi-VN",
        { style: "currency", currency: ct.price.currency }).format(Number(ct.price.value));
    } catch (e) { return String(ct.price.value) + " " + ct.price.currency; }
  }

  function veDsGoiPlay(dsChiTiet) {
    var hop = $("dsGoiPlay");
    if (!hop) return;
    hop.innerHTML = "";
    PLAY_GOI.forEach(function (goi) {
      var ct = playKhopChiTiet(goi, dsChiTiet || []);
      goi.skuMua = ct ? ct.itemId : goi.productId;
      var the = document.createElement("div");
      the.className = "theGoiVip";
      var giua = document.createElement("div");
      giua.className = "thongTinNguoi";
      var ten = document.createElement("p");
      ten.className = "tenNguoi";
      ten.textContent = "⭐ " + goi.ten;
      var gia = document.createElement("p");
      gia.className = "giaGoi";
      if (ct) gia.textContent = playDinhDangGia(ct);
      else if (goi.giaTC) gia.textContent = dinhDangTien(goi.giaTC) + " (giá tham chiếu)";
      else gia.textContent = "Xem giá trên Google Play";
      var han = document.createElement("p");
      han.className = "chiTietNguoi";
      han.textContent = goi.han;
      giua.appendChild(ten); giua.appendChild(gia); giua.appendChild(han);
      var phai = document.createElement("div");
      phai.className = "cotPhai";
      phai.appendChild(taoNutNhan("🛒 Mua qua Google Play", "nutChinh nho", function () { muaQuaPlay(goi); }));
      the.appendChild(giua); the.appendChild(phai);
      hop.appendChild(the);
    });
  }

  function playXacMinhPhiaMayChu(loai, productId, purchaseToken) {
    return goiAPI("/api/play/xac-minh", "POST",
      { loai: loai, productId: productId, purchaseToken: purchaseToken }, true);
  }

  function anNutMuaPlay() {
    var hop = $("dsGoiPlay");
    if (hop) hop.innerHTML = "";
    var btn = $("btnKhoiPhucPlay");
    if (btn) btn.style.display = "none";
  }

  function playXuLyKetQuaXacMinh(kq, cauChuc) {
    if (kq && kq.loi === "chua-cau-hinh") {
      playDatTrangThai("Mua VIP trong ứng dụng đang được hoàn thiện và sẽ mở rất sớm. Cảm ơn bạn!");
      anNutMuaPlay();
      return;
    }
    if (kq && kq.ok) {
      vipCuaToi = {
        vip: !!kq.vip, goi: kq.goi || null,
        hetHan: (typeof kq.hetHan === "number") ? kq.hetHan : null
      };
      veTrangThaiVip();
      playDatTrangThai("");
      if (cauChuc) hienToast(cauChuc);
    } else {
      playDatTrangThai("");
      hienToast((kq && kq.loi) || "Chưa xác minh được giao dịch. Bạn thử “Khôi phục giao dịch” sau ít phút nhé.");
    }
  }

  function muaQuaPlay(goi) {
    if (!dichVuPlay) return;
    if (!tokenMayChu) { hienToast("Bạn cần đăng nhập trước khi mua VIP nhé."); return; }
    playDatTrangThai("Đang mở thanh toán Google Play…");
    var yeuCau;
    try {
      yeuCau = new PaymentRequest(
        [{ supportedMethods: PLAY_PROVIDER, data: { sku: goi.skuMua || goi.productId } }],
        // total bắt buộc theo Payment Request API; Google Play bỏ qua và dùng giá thật trên Play.
        { total: { label: "Tổng", amount: { currency: "USD", value: "0" } } }
      );
    } catch (e) {
      playDatTrangThai("");
      hienToast("Thiết bị chưa hỗ trợ thanh toán Google Play.");
      return;
    }
    yeuCau.show()
      .then(function (phanHoi) {
        var token = phanHoi.details && (phanHoi.details.purchaseToken || phanHoi.details.token);
        if (!token) {
          phanHoi.complete("fail");
          playDatTrangThai("");
          hienToast("Không nhận được mã giao dịch từ Google Play.");
          return;
        }
        // Xác minh phía máy chủ TRƯỚC, xong mới complete() (đúng khuyến nghị của Google).
        playXacMinhPhiaMayChu(goi.loai, goi.productId, token)
          .then(function (kq) {
            phanHoi.complete(kq && kq.ok ? "success" : "fail");
            playXuLyKetQuaXacMinh(kq, "🎉 Thanh toán thành công! VIP đã được bật cho tài khoản của bạn.");
          })
          .catch(function () {
            phanHoi.complete("fail");
            playDatTrangThai("");
            hienToast("Không kết nối được máy chủ để xác minh giao dịch. Bạn bấm “Khôi phục giao dịch” để nhận VIP nhé.");
          });
      })
      .catch(function () {
        // Người dùng tự hủy ở hộp thanh toán Play (AbortError) -> im lặng quay lại, không báo lỗi.
        playDatTrangThai("");
      });
  }

  // Khôi phục: liệt kê giao dịch đang sở hữu phía Google -> gửi từng token
  // lên máy chủ xác minh lại (thuê bao được đối chiếu hạn mới nhất ở máy chủ).
  function khoiPhucPlay() {
    if (!dichVuPlay) return;
    if (!tokenMayChu) { hienToast("Bạn cần đăng nhập trước khi khôi phục nhé."); return; }
    playDatTrangThai("Đang kiểm tra các giao dịch Google Play của bạn…");
    dichVuPlay.listPurchases()
      .then(function (ds) {
        if (!ds || !ds.length) {
          playDatTrangThai("Không tìm thấy giao dịch Google Play nào cho tài khoản Google này.");
          return null;
        }
        var kqTot = null;
        var chuoi = Promise.resolve();
        ds.forEach(function (gd) {
          chuoi = chuoi.then(function () {
            var productId = String(gd.itemId || "").split(":")[0];
            var loai = productId === PLAY_SKU_DOI ? "mot-lan" : "sub";
            return playXacMinhPhiaMayChu(loai, productId, gd.purchaseToken)
              .then(function (kq) { if (kq && kq.ok) kqTot = kq; })
              .catch(function () {});
          });
        });
        return chuoi.then(function () { return kqTot; });
      })
      .then(function (kqTot) {
        if (kqTot) {
          playXuLyKetQuaXacMinh(kqTot, "🎉 Đã khôi phục VIP từ giao dịch Google Play của bạn.");
        } else {
          taiTrangThaiVip();
          playDatTrangThai("Đã kiểm tra xong. Nếu bạn đã từng mua VIP mà chưa thấy bật, thử lại sau ít phút nhé.");
        }
      })
      .catch(function () {
        playDatTrangThai("Không kiểm tra được giao dịch lúc này. Thử lại sau nhé.");
      });
  }

  function khoiTaoPlayBilling() {
    var panel = $("panelPlayBilling");
    if (!panel || dichVuPlay) return;
    if (!document.documentElement.classList.contains("playapp")) return;
    if (!("getDigitalGoodsService" in window)) return;
    window.getDigitalGoodsService(PLAY_PROVIDER)
      .then(function (service) {
        dichVuPlay = service;
        return service.getDetails([PLAY_SKU_SUB, PLAY_SKU_DOI])
          .then(function (ds) { return ds || []; })
          .catch(function () { return []; }); // lỗi lấy giá -> vẫn hiện thẻ, dùng giá tham chiếu
      })
      .then(function (dsChiTiet) {
        veDsGoiPlay(dsChiTiet);
        panel.classList.remove("anPlay");
        var btn = $("btnKhoiPhucPlay");
        if (btn) btn.addEventListener("click", khoiPhucPlay);
      })
      .catch(function () { /* bối cảnh không hỗ trợ Digital Goods -> giữ khối ẩn êm */ });
  }

  // --- Khởi tạo ---
  // ================= GÓI 5 (tiếp): ÁP NGÔN NGỮ + ĐĂNG NHẬP GOOGLE/FACEBOOK =================
  var ngonNguHT = "vi"; // ngôn ngữ đang hiển thị trên máy này

  // t(khoa): lấy chuỗi theo ngôn ngữ đang hiển thị (rơi en -> vi như trichChuoi).
  function t(khoa) { return trichChuoi(khoa, ngonNguHT); }

  // Quét toàn bộ phần tử gắn data-i18n / data-i18n-ph / data-i18n-title và thay chuỗi.
  // Chuỗi có thẻ HTML (vd mo_ta_sdt có <strong>) thì gán innerHTML — giá trị lấy từ
  // bảng tĩnh của chính app, không phải dữ liệu người dùng, nên an toàn.
  function apDungNgonNgu() {
    try { document.documentElement.lang = ngonNguHT; } catch (e) {}
    var ds = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < ds.length; i++) {
      var el = ds[i];
      var chuoi = t(el.getAttribute("data-i18n"));
      if (chuoi.indexOf("<") !== -1) el.innerHTML = chuoi; else el.textContent = chuoi;
    }
    var dp = document.querySelectorAll("[data-i18n-ph]");
    for (var j = 0; j < dp.length; j++) {
      dp[j].setAttribute("placeholder", t(dp[j].getAttribute("data-i18n-ph")));
    }
    var dt = document.querySelectorAll("[data-i18n-title]");
    for (var h = 0; h < dt.length; h++) {
      dt[h].setAttribute("title", t(dt[h].getAttribute("data-i18n-title")));
    }
    var sel = $("selNgonNgu");
    if (sel && sel.value !== ngonNguHT) sel.value = ngonNguHT;
    // Hai dòng liên kết trong trang Tài khoản vẽ bằng JS — vẽ lại theo ngôn ngữ mới.
    if (typeof veLaiDongLienKet === "function") veLaiDongLienKet();
  }

  // Đặt ngôn ngữ hiển thị: áp ngay, nhớ ở máy, và (khi đang đăng nhập) lưu lên máy
  // chủ theo tài khoản để đồng bộ đa thiết bị. luuMayChu=false khi giá trị ĐẾN từ
  // máy chủ (tránh PUT thừa).
  function datNgonNgu(ma, luuMayChu) {
    if (NGON_NGU_HOP_LE_G5.indexOf(ma) === -1) ma = "vi";
    ngonNguHT = ma;
    try { localStorage.setItem("hialo_ngon_ngu", ma); } catch (e) {}
    apDungNgonNgu();
    if (luuMayChu && TQD_SERVER && tokenMayChu) {
      goiAPI("/api/cai-dat", "PUT", { ngonNgu: ma }, true).catch(function () {});
    }
  }

  // Khởi tạo lúc mở app: ưu tiên lựa chọn đã nhớ ở máy; chưa có thì suy từ trình
  // duyệt. Khi đăng nhập xong, taiCaiDat() sẽ kéo caiDat.ngonNgu từ máy chủ về và
  // dienCaiDatVaoTrang() áp đè nếu khác (nguồn thật là máy chủ).
  function khoiTaoNgonNgu() {
    var ma = null;
    try { ma = localStorage.getItem("hialo_ngon_ngu"); } catch (e) {}
    if (!ma || NGON_NGU_HOP_LE_G5.indexOf(ma) === -1) {
      ma = phatHienNgonNguTuTrinhDuyet(navigator.language || "vi");
    }
    ngonNguHT = ma;
    apDungNgonNgu();
    var sel = $("selNgonNgu");
    if (sel) sel.addEventListener("change", function () {
      datNgonNgu(sel.value, true);
      hienToast(t("da_doi_ngon_ngu"));
    });
  }

  // ----- Đăng nhập Google / Facebook (khung sẵn sàng — chỉ chạy khi máy chủ có khóa) -----
  // Luồng: GET /api/cau-hinh-oauth cho biết nhà cung cấp nào đang bật. Chưa bật nhà
  // nào -> khối nút ở màn đăng nhập giữ nguyên trạng thái ẩn, không nạp SDK nào.
  var cauHinhOAuthHT = null;
  var googleSanSang = false, facebookSanSang = false;
  var cheDoOAuth = "dang-nhap"; // "dang-nhap" ở màn hình vào · "lien-ket" ở trang Tài khoản
  var trangThaiLienKetHT = null;

  function taiCauHinhOAuth() {
    if (!TQD_SERVER) return;
    goiAPI("/api/cau-hinh-oauth", "GET", null, false).then(function (kq) {
      if (!kq || !kq.ok) return;
      cauHinhOAuthHT = kq;
      var coBat = false;
      if (kq.google && kq.google.bat && kq.google.clientId) { napGoogleSDK(kq.google.clientId); coBat = true; }
      if (kq.facebook && kq.facebook.bat && kq.facebook.appId) { napFacebookSDK(kq.facebook.appId); coBat = true; }
      if (coBat) {
        var khu = $("khuDangNhapXaHoi");
        if (khu) khu.classList.remove("an");
      }
    }).catch(function () {});
  }

  function napGoogleSDK(clientId) {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      khoiTaoGoogle(clientId); return;
    }
    var sc = document.createElement("script");
    sc.src = "https://accounts.google.com/gsi/client";
    sc.async = true; sc.defer = true;
    sc.onload = function () { khoiTaoGoogle(clientId); };
    document.head.appendChild(sc);
  }

  function khoiTaoGoogle(clientId) {
    try {
      window.google.accounts.id.initialize({ client_id: clientId, callback: xuLyGoogleCredential });
      var hop = $("hopNutGoogle");
      if (hop && !hop.hasChildNodes()) {
        window.google.accounts.id.renderButton(hop, { theme: "outline", size: "large", width: 280, text: "continue_with" });
      }
      googleSanSang = true;
      veLaiDongLienKet();
    } catch (e) {}
  }

  function xuLyGoogleCredential(resp) {
    if (resp && resp.credential) guiMaXaHoi("google", resp.credential);
  }

  function napFacebookSDK(appId) {
    window.fbAsyncInit = function () {
      try {
        window.FB.init({ appId: appId, cookie: false, xfbml: false, version: "v21.0" });
        facebookSanSang = true;
        var b = $("btnDangNhapFacebook");
        if (b) b.classList.remove("an");
        veLaiDongLienKet();
      } catch (e) {}
    };
    if (window.FB) { window.fbAsyncInit(); return; }
    var sc = document.createElement("script");
    sc.src = "https://connect.facebook.net/vi_VN/sdk.js";
    sc.async = true; sc.defer = true; sc.crossOrigin = "anonymous";
    document.head.appendChild(sc);
  }

  function batDauFacebook() {
    if (!facebookSanSang || !window.FB) return;
    window.FB.login(function (resp) {
      if (resp && resp.authResponse && resp.authResponse.accessToken) {
        guiMaXaHoi("facebook", resp.authResponse.accessToken);
      }
    }, { scope: "public_profile,email" });
  }

  // Gửi mã của nhà cung cấp lên máy chủ: chế độ đăng nhập thì vào thẳng app qua
  // hoanTatDangNhapTuMayChu (cùng đường với OTP/MO-SMS); chế độ liên kết thì ở lại
  // trang Tài khoản và vẽ lại trạng thái.
  function guiMaXaHoi(ncc, ma) {
    var dangLienKet = (cheDoOAuth === "lien-ket");
    var duong = dangLienKet ? ("/api/lien-ket/" + ncc) : ("/api/dang-nhap/" + ncc);
    var than = (ncc === "google") ? { idToken: ma } : { accessToken: ma };
    goiAPI(duong, "POST", than, dangLienKet).then(function (kq) {
      cheDoOAuth = "dang-nhap";
      if (!kq || !kq.ok) {
        hienLoiXaHoi((kq && kq.loi) || t("loi_xa_hoi"), dangLienKet);
        return;
      }
      if (dangLienKet) { taiTrangThaiLienKet(); return; }
      hoanTatDangNhapTuMayChu(kq, kq.sdt);
    }).catch(function () {
      cheDoOAuth = "dang-nhap";
      hienLoiXaHoi(t("loi_xa_hoi"), dangLienKet);
    });
  }

  function hienLoiXaHoi(loi, oTrangLienKet) {
    var el = $(oTrangLienKet ? "loiLienKet" : "loiXaHoi");
    if (el) el.textContent = loi || "";
  }

  // ----- Trạng thái liên kết trong trang Tài khoản & bảo mật -----
  function taiTrangThaiLienKet() {
    if (!TQD_SERVER || !tokenMayChu) return;
    goiAPI("/api/lien-ket", "GET", null, true).then(function (kq) {
      if (!kq || !kq.ok) return;
      trangThaiLienKetHT = kq;
      veDongLienKet("google", kq.lienKet.google);
      veDongLienKet("facebook", kq.lienKet.facebook);
      var gc = $("ghiChuCanSDT");
      if (gc) gc.classList.toggle("an", !kq.taiKhoanXaHoi);
    }).catch(function () {});
  }

  function veLaiDongLienKet() {
    if (!trangThaiLienKetHT) return;
    veDongLienKet("google", trangThaiLienKetHT.lienKet.google);
    veDongLienKet("facebook", trangThaiLienKetHT.lienKet.facebook);
  }

  function veDongLienKet(ncc, tt) {
    var elTt = $(ncc === "google" ? "ttLienKetGoogle" : "ttLienKetFacebook");
    var elBtn = $(ncc === "google" ? "btnLienKetGoogle" : "btnLienKetFacebook");
    if (!elTt || !elBtn || !tt) return;
    if (tt.daLienKet) {
      elTt.textContent = t("lk_da") + (tt.email ? " · " + tt.email : (tt.ten ? " · " + tt.ten : ""));
      elBtn.textContent = t("btn_huy_lien_ket");
      elBtn.disabled = false;
    } else if (!tt.bat) {
      elTt.textContent = t("lk_khong_bat");
      elBtn.textContent = t("btn_lien_ket");
      elBtn.disabled = true;
    } else {
      elTt.textContent = t("lk_chua");
      elBtn.textContent = t("btn_lien_ket");
      elBtn.disabled = false;
    }
  }

  function bamNutLienKet(ncc) {
    var tt = trangThaiLienKetHT && trangThaiLienKetHT.lienKet[ncc];
    if (!tt || !tt.bat) return;
    if (tt.daLienKet) {
      if (!window.confirm(t("xac_nhan_huy_lk"))) return;
      goiAPI("/api/huy-lien-ket", "POST", { nhaCungCap: ncc }, true).then(function (kq) {
        if (!kq || !kq.ok) { hienLoiXaHoi((kq && kq.loi) || t("loi_xa_hoi"), true); return; }
        taiTrangThaiLienKet();
      }).catch(function () {});
      return;
    }
    // Chưa liên kết: mở luồng của nhà cung cấp ở chế độ liên kết. Google dùng One
    // Tap (prompt) — tài khoản Google đang đăng nhập trình duyệt sẽ hiện hộp chọn.
    cheDoOAuth = "lien-ket";
    if (ncc === "google") {
      if (googleSanSang && window.google) window.google.accounts.id.prompt();
      else cheDoOAuth = "dang-nhap";
    } else {
      batDauFacebook();
    }
  }

  function ganSuKienOAuth() {
    var bFb = $("btnDangNhapFacebook");
    if (bFb) bFb.addEventListener("click", function () { cheDoOAuth = "dang-nhap"; batDauFacebook(); });
    var bG = $("btnLienKetGoogle");
    if (bG) bG.addEventListener("click", function () { bamNutLienKet("google"); });
    var bF = $("btnLienKetFacebook");
    if (bF) bF.addEventListener("click", function () { bamNutLienKet("facebook"); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    khoiTaoNgonNgu();
    ganSuKienOAuth();
    taiCauHinhOAuth();
  });

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
      $("nhanDemoKetQua").textContent = "🌐 Đăng nhập bằng mã OTP để thấy người dùng thật quanh bạn.";
    }

    // Luồng tài khoản OTP
    $("btnNhanOTP").addEventListener("click", guiMaOTPSuKien);
    $("btnXacNhanOTP").addEventListener("click", xacNhanOTPSuKien);
    $("btnGuiLai").addEventListener("click", guiLaiMaSuKien);
    $("btnDoiSo").addEventListener("click", doiSoSuKien);
    // Luồng MO-SMS (V5.3): chỉ hiện khi máy chủ bật tính năng
    var btnLayMaEl = $("btnLayMaSmsDen");
    if (btnLayMaEl) btnLayMaEl.addEventListener("click", layMaSmsDenSuKien);
    var btnHuySmsEl = $("btnHuySmsDen");
    if (btnHuySmsEl) btnHuySmsEl.addEventListener("click", function () {
      dungChoSmsDen();
      var loiSmsEl = $("loiSmsDen");
      if (loiSmsEl) loiSmsEl.textContent = "";
    });
    taiCauHinhXacThuc();
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
      if ($("mucGhepDoi")) $("mucGhepDoi").classList.add("an"); // Gói 2
      if ($("khungHoChieu")) $("khungHoChieu").classList.add("an"); // Gói 2
    }
    // ===== V4.1: gói VIP =====
    $("btnDonCuaToi").addEventListener("click", taiDonCuaToi);
    $("btnLenVip").addEventListener("click", function () {
      chonTab("canhan");
      var muc = $("mucVip");
      if (muc) muc.scrollIntoView({ behavior: "smooth" });
    });
    // ===== Gói 2: sự kiện Ghép đôi =====
    $("btnCheDoLuoi").addEventListener("click", function () { datCheDoQuet(false); });
    $("btnCheDoQuet").addEventListener("click", function () { datCheDoQuet(true); });
    $("btnQuetBoQua").addEventListener("click", function () {
      var p = hangDoiQuet()[chiSoQuet];
      if (p) boQuaHoSo(p, function () { veQuet(); });
    });
    $("btnQuetThich").addEventListener("click", function () {
      var p = hangDoiQuet()[chiSoQuet];
      if (p) thichHoSo(p, "thuong", function () { veQuet(); });
    });
    $("btnQuetSieuThich").addEventListener("click", function () {
      var p = hangDoiQuet()[chiSoQuet];
      if (p) thichHoSo(p, "sieu", function () { veQuet(); });
    });
    $("btnBoost").addEventListener("click", batBoostHoSo);
    $("btnMoAiThich").addEventListener("click", function () {
      aiThichDangMo = !aiThichDangMo;
      $("dsAiThich").classList.toggle("an", !aiThichDangMo);
      if (aiThichDangMo) taiAiThich();
      else {
        $("trongAiThich").classList.add("an");
        $("goiYAiThichVip").classList.add("an");
      }
    });
    $("btnMoGhepDoi").addEventListener("click", function () {
      ghepDoiDangMo = !ghepDoiDangMo;
      $("dsGhepDoi").classList.toggle("an", !ghepDoiDangMo);
      if (ghepDoiDangMo) taiGhepDoiCuaToi();
      else $("trongGhepDoi").classList.add("an");
    });
    $("btnLenVipTuAiThich").addEventListener("click", function () {
      chonTab("canhan");
      var muc = $("mucVip");
      if (muc) muc.scrollIntoView({ behavior: "smooth" });
    });
    $("selThanhPhoHoChieu").addEventListener("change", chonThanhPhoHoChieu);
    $("btnDatHoChieu").addEventListener("click", datHoChieuTuForm);
    $("btnTatHoChieu").addEventListener("click", xoaHoChieu);
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
    // Gói 4: sticker + đang nhập + chọn chế độ tự huỷ
    $("btnSticker").addEventListener("click", moHopSticker1v1);
    $("btnStickerNhom").addEventListener("click", moHopStickerNhom);
    $("inpTinNhan").addEventListener("input", baoDangNhap);
    $("selTuHuy").addEventListener("change", function () {
      $("goiYTuHuy").classList.toggle("an", layTuHuyDangChon() === 0);
    });
    $("btnQuayLaiChat").addEventListener("click", function () { dongManChat(true); });
    $("btnChanTrongChat").addEventListener("click", chanTrongChatSuKien);
    // Gói 1: báo cáo trong chat, tin nhắn chờ, gửi selfie xác thực
    $("btnBaoCaoTrongChat").addEventListener("click", function () {
      if (chatVoi) baoCaoNguoi(chatVoi.sdt, chatVoi.nick);
    });
    $("btnMoTinCho").addEventListener("click", moManTinCho);
    $("btnQuayLaiTinCho").addEventListener("click", function () {
      hienManTinNhan("khuDsTroChuyen");
      taiDsTroChuyen();
    });
    $("btnGuiXacThuc").addEventListener("click", function () { $("inpSelfieXacThuc").click(); });
    $("inpSelfieXacThuc").addEventListener("change", function () {
      if (this.files && this.files[0]) guiSelfieXacThuc(this.files[0]);
      this.value = "";
    });
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
     "chkRungKhiGoiDen", "chkTuongThongBao", "chkQrTuDongTrongAnh", "chkQrTheNganHang", "chkChiNhanTinBanBe", "chkHienDaXem"].forEach(function (idCongTac) {
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
    var rdMoLink = document.querySelectorAll('input[name="moLink"]');
    for (var ml = 0; ml < rdMoLink.length; ml++) {
      rdMoLink[ml].addEventListener("change", luuCaiDatTuCongTac);
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
    // Tự xóa tài khoản: nút chỉ bật khi đã tích hiểu + nhập đúng 4 số cuối SĐT của mình
    $("chkHieuXoaTaiKhoan").addEventListener("change", capNhatNutXoaTaiKhoan);
    $("inpBonSoCuoiXoa").addEventListener("input", function () {
      this.value = this.value.replace(/\D/g, "").slice(0, 4);
      capNhatNutXoaTaiKhoan();
    });
    $("btnXoaTaiKhoanVinhVien").addEventListener("click", xoaTaiKhoanSuKien);
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

// Gói 5: xuất thêm cho kiểm thử logic thuần (từ điển + rơi chuỗi + dò ngôn ngữ)
if (typeof module !== "undefined" && module.exports) {
  module.exports.BANG_NGON_NGU = BANG_NGON_NGU;
  module.exports.trichChuoi = trichChuoi;
  module.exports.phatHienNgonNguTuTrinhDuyet = phatHienNgonNguTuTrinhDuyet;
}
