# Geofencing Tracker v1.0 📍
**Ứng dụng tự động báo tin cho người thân khi đã đến nơi (Android & Web App)**

Hệ thống theo dõi định vị ngầm tự động nhận diện khi người đi đường vào bán kính điểm đến (geofence) và tự động gửi thông báo an toàn cho gia đình/người thân qua **Telegram Bot / Discord Webhook** (kênh chính) và tự động chuyển sang **SMS từ SIM** (kênh dự phòng) khi mất mạng hoặc các kênh online bị gián đoạn.

---

## 🌟 Tính Năng Nổi Bật

### 1. Tự động nhận diện đến đích (Noise-Immune Geofencing)
- Sử dụng công thức toán học mặt cầu **Haversine** tính toán khoảng cách tọa độ chuẩn xác từng mét.
- Cơ chế chống nhiễu kép: yêu cầu 2 mẫu GPS hợp lệ liên tiếp trong bán kính (mặc định 100m) cách nhau tối thiểu 5 giây và độ sai số $\le 50\text{ m}$.
- Tự động lọc bỏ các mẫu GPS nhảy cóc vô lý ($> 216\text{ km/h}$).

### 2. Kênh Báo Tin Đa Tầng Cực Kỳ Tin Cậy (Telegram, Discord, SMS)
- **Kênh chính**: Gửi tin nhắn tức thì vào nhóm gia đình qua **Telegram Bot API** hoặc **Discord Webhook** (hỗ trợ cả tin báo xuất phát và tin báo đến nơi).
- **Kênh dự phòng (SMS SIM máy)**: Nếu kênh chính không phản hồi sau 3 lần thử (0s, 5s, 20s) hoặc quá 60s mất mạng, ứng dụng tự động gửi 1 tin nhắn SMS không dấu ($\le 160$ ký tự, tiết kiệm cước) từ SIM máy tới 1–2 số điện thoại người thân.
- **Hàng đợi lưu bền (Persistent Queue)**: Tự động lên lịch gửi bù qua mạng online khi mạng phục hồi, ghi rõ thời gian trễ và đã báo qua SMS.
- **Chống gửi trùng tuyệt đối**: Cờ `arrivedNotified` lưu bền đảm bảo mỗi chuyến chỉ có đúng 1 thông báo đến nơi.

### 3. Thanh Lưu Điểm Đến Ghim Sẵn Nằm Ngang (Saved Destinations Bar)
- **Vuốt ngang chọn điểm đến tức thì**: Danh sách các điểm đến yêu thích được lưu bền vững dạng thẻ ngang ở đầu trang chủ (Home). Chỉ cần 1 chạm để chuyển ngay điểm đến.
- **Tự động đo khoảng cách**: Hiển thị khoảng cách trực tiếp từ vị trí hiện tại đến từng điểm đã lưu (VD: Nhà: 2.1 km, Cơ quan: 8.5 km, Quê: 45 km...).
- **Chấm ghim trực tiếp trên bản đồ**: Cho phép bấm vào bất kỳ vị trí nào trên bản đồ để đặt tên tự chọn và lưu vào danh bạ điểm đến.
- **Nút "Chỉ đường" Google Maps**: Bấm 1 chạm từ banner điểm đến để mở ngay ứng dụng Google Maps ở chế độ dẫn đường từng chặng (Turn-by-Turn driving navigation).

### 4. Tự Động Cập Nhật GPS & Phục Hồi Polling Telegram Bot Tức Thì
- **Tự động cập nhật vị trí khi mở App**: Lắng nghe sự kiện vòng đời (`App.addListener('appStateChange')` & `visibilitychange`), vị trí GPS và khoảng cách tự động được làm mới ngay khi bạn mở lại ứng dụng hoặc bật sáng màn hình.
- **Quét GPS nhẹ nhàng ở trạng thái chờ (IDLE)**: Cập nhật độ chính xác và tọa độ định kỳ mỗi 12 giây khi ở màn hình chính, không cần phải bấm nút tròn xoay tải lại thủ công.
- **Nhận lệnh Bot tức thời**: Cơ chế polling Telegram API với timeout 5s, tự động phục hồi kết nối và ngắt socket treo (Watchdog Timer + AbortController).
- **Truy vấn vị trí ngược (/vitri)**: Người thân trong nhóm có thể gửi `/vitri` hoặc `/vitri [Tên người]` để bot báo cáo ngay: Tọa độ, tốc độ, dung lượng Pin, trạng thái sạc, loại mạng (Wi-Fi/4G/Mất mạng) và link xem bản đồ Google Maps.
- **Bảo mật nội dung tin nhắn**: Toàn bộ dữ liệu hiển thị được lọc qua `escapeHtml` chống injection và chống lỗi vỡ định dạng HTML Telegram.

### 5. Bộ Gõ Tiếng Việt Tối Ưu Cho Android (SmartInput Native Buffer)
- Hoàn toàn tương thích với bàn phím tiếng Việt (Gboard, Laban Key, bàn phím Samsung, Xiaomi Poco, v.v.):
  - Gõ Telex/VNI chữ hiển thị mượt mà tức thì, không bị lỗi phải ấn phím Cách (Space) mới hiện chữ.
  - Tự do bấm phím xóa lùi (Backspace), bôi đen, chỉnh sửa ký tự ở bất kỳ vị trí nào mà không bị kẹt con trỏ hay nuốt chữ.
  - Cấu hình chuẩn Android WebView: `captureInput: false` và `android:windowSoftInputMode="adjustResize"`.

### 6. Chạy Ngầm Tiết Kiệm Pin (Adaptive Tracking)
- Tần suất định vị tự động co giãn theo khoảng cách (`distanceFilter`):
  - $> 5\text{ km}$: Lọc 200m
  - $1 - 5\text{ km}$: Lọc 50m
  - $< 1\text{ km}$: Lọc 15m
- Tự động dừng theo dõi và tắt định vị nền ngay khi đến đích hoặc sau thời gian tối đa cài đặt (1–24 giờ).
- Hướng dẫn cấu hình tắt hạn chế pin riêng cho từng dòng máy (Xiaomi MIUI/HyperOS, Samsung OneUI, Oppo ColorOS, Pixel...).

---

## 🛠️ Công Nghệ Sử Dụng

- **Frontend Core**: React 18, Vite 6, Tailwind CSS, Lucide React, Canvas Confetti.
- **Nền tảng Native Android**: Capacitor 6 (`@capacitor/android`, `@capacitor/app`, `@capacitor/geolocation`, `@capacitor/device`, `@capacitor/network`, `@capacitor/preferences`).
- **Bản đồ trực quan**: Leaflet & React-Leaflet (Lớp bản đồ vệ tinh / lai Google Maps nhẹ hơn 90% so với nhúng full Google Maps SDK, RAM < 100MB).
- **Hệ thống logic lõi**:
  - `src/state/tripMachine.js`: Finite State Machine quản lý vòng đời chuyến đi.
  - `src/services/location.js`: Điều phối định vị vệ tinh GPS đa tầng.
  - `src/services/notifier.js`: Điều phối gửi tin Telegram, Discord và SMS fallback.
  - `src/services/telegram.js`: API Telegram Bot độc lập, hỗ trợ long-polling và abort signal.
  - `src/services/queue.js`: Hàng đợi tin nhắn ngoại tuyến chống mất dữ liệu.
  - `src/services/storage.js`: Lưu trữ bền vững dữ liệu cấu hình và điểm ghim.
- **Kiểm thử tự động (Unit & Integration Testing)**: Vitest (10 bộ kiểm thử, 52/52 bài test đạt chuẩn 100%).

---

## 🚀 Hướng Dẫn Cài Đặt & Phát Triển

### 1. Yêu cầu môi trường
- Node.js $\ge 18$
- Android Studio (kèm Android SDK API 29-34) để build file `.apk`

### 2. Cài đặt thư viện
```bash
npm install
```

### 3. Chạy môi trường phát triển (Web Dev)
```bash
npm run dev
```
Truy cập `http://localhost:3000` trên trình duyệt để kiểm tra giao diện.

### 4. Chạy kiểm thử tự động (Unit & Integration Tests)
```bash
npm test
```
Toàn bộ 10 bộ kiểm thử (52 bài test) bao gồm toán học Haversine, máy trạng thái, hàng đợi bền, bộ gõ tiếng Việt SmartInput, bảo mật và kết nối bot sẽ được thực thi tự động.

### 5. Đóng gói ứng dụng cho Android
```bash
# 1. Biên dịch mã nguồn web (tối ưu bundle ~140KB gzipped)
npm run build

# 2. Đồng bộ mã nguồn sang thư mục native Android
npx cap sync

# 3. Mở Android Studio để cắm máy thật hoặc build file APK
npx cap open android
```

---

## 🔒 Bảo Mật & Quyền Riêng Tư (Security & Privacy)

- **Bảo mật Token**: Bot Token Telegram và Webhook Discord chỉ lưu cục bộ trong bộ nhớ an toàn của thiết bị (`@capacitor/preferences`), không gửi lên máy chủ trung gian.
- **Bắt buộc HTTPS**: Toàn bộ luồng kết nối ra ngoài đều tuân thủ HTTPS mã hóa đầu cuối.
- **Tắt sao lưu ADB tự động**: `android:allowBackup="false"` trong `AndroidManifest.xml` ngăn chặn trích xuất cấu hình qua cổng kết nối máy tính.
- **Lọc ký tự đặc biệt**: Tự động thoát chuỗi HTML (`escapeHtml`) cho mọi nội dung tên người dùng và địa điểm gửi về nhóm chat.
- **Không lưu vết vị trí dài hạn**: Không ghi nhật ký tọa độ liên tục lên máy chủ ngoài, tôn trọng tuyệt đối quyền riêng tư của người dùng.

---

## 📋 Danh Mục Kiểm Thử (52 Tests Passed)

| Bộ kiểm thử | Số ca test | Nội dung kiểm tra |
|---|:---:|---|
| `tests/geo.test.js` | 14 | Khoảng cách Haversine, lọc nhiễu nhảy vọt, tính ETA, bóc tách link Google Maps |
| `tests/queue.test.js` | 5 | Hàng đợi tin nhắn ngoại tuyến, gửi bù khi có mạng |
| `tests/discord.test.js` | 4 | Định dạng và điều phối webhook Discord |
| `tests/saved_destinations.test.js` | 4 | Lưu trữ danh sách điểm đến yêu thích, kiểm tra trùng lặp |
| `tests/tripMachine.test.js` | 5 | Chuyển đổi trạng thái hành trình IDLE -> TRACKING -> ARRIVED |
| `tests/trip_reset_and_geofence.test.js` | 3 | Xác nhận geofence kép 5s và cơ chế reset hành trình |
| `tests/security.test.js` | 6 | Che giấu token riêng tư, vệ sinh dữ liệu, chống rò rỉ mã |
| `tests/settings_storage.test.js` | 2 | Đọc/ghi cấu hình bền vững vào bộ nhớ thiết bị |
| `tests/notifier.test.js` | 4 | Điều phối đa kênh Telegram, Discord và SMS fallback |
| `tests/smart_input_and_bot.test.js` | 5 | Bộ gõ tiếng Việt Telex/VNI, Backspace, cấu hình Android và Bot polling |

---

## 👤 Bản Quyền & Tác Giả

- **Tác giả thiết kế & phát triển**: Lê Đình Nguyên
- **Phiên bản**: v1.0.0
- **Mã nguồn**: [GitHub Repository](https://github.com/ledinhnguyen2601/DinhViGuiTin.git)
