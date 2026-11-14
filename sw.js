/* Hialo service worker: network-first cho file cùng nguồn (trang luôn mới khi có mạng). */
var TEN_CACHE = 'hialo-v12';
self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== TEN_CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(TEN_CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () { return caches.match(e.request); })
  );
});

/* V6: nhom chat + cong dong (05/11/2026) */
/* V6.2: QR & Tien ich — quet QR, Ma QR cua toi, trang Tien ich, loi tat quet nhanh (05/11/2026) */
/* kich hoat lai Pages build cho dot V6.2 */
/* hialo-v6 (07/11/2026): tu xoa tai khoan trong app cho Google Play */

/* hialo-v7 (10/11/2026): xoa doan chu 'ban mau xem thu' con sot + sua nhan huong dan dang nhap OTP */

/* hialo-v8 (10/11/2026): tu dang xuat khi phien het han o may chu (401) de nguoi dung dang nhap lai duoc */

/* hialo-v9 (10/11/2026): muc Xo so tro sang trang KQXSMB cua chu app (kqxsmb.hialo.vn) */

/* hialo-v10 (10/11/2026): khoi phuc index.html day du (ban 86KB bi ban cu 17KB ghi de), giu fx + Xo so->KQXSMB, chan dung khoi tao khi thieu phan tu tuy chon */

/* hialo-v12 (14/11/2026): Goi 1 — xac thuc ho so + huy hieu, tin nhan cho, chi nhan tin tu ban be, bao cao, anh mo tu nguoi la, TURN (coturn) cho cuoc goi */
