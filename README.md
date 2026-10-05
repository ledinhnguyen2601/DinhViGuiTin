# Geofencing Tracker v1.0 📍
**Ứng dụng tự động báo tin cho người thân khi đã đến nơi (Android & Web App)**

Hệ thống theo dõi định vị ngầm tự động nhận diện khi người đi đường vào bán kính điểm đến (geofence) và tự động gửi thông báo an toàn cho gia đình/người thân qua **Telegram Bot / Discord Webhook** (kênh chính) và tự động chuyển sang **SMS từ SIM** (kênh dự phòng) khi mất mạng hoặc các kênh online bị gián đoạn.

---

## 🌟 Tính Năng Nổi Bật

1. **Tự động nhận diện đến đích (Noise-Immune Geofencing)**:
   - Sử dụng công thức toán học mặt cầu **Haversine**.
   - Cơ chế chống nhiễu kép: yêu cầu 2 mẫu GPS hợp lệ liên tiếp trong bán kính (mặc định 100m) cách nhau tối thiểu 5 giây và độ sai số $\le 50\text{ m}$.
   - Tự động lọc bỏ các mẫu GPS nhảy cóc vô lý ($> 216\text{ km/h}$).

2. **Kênh Báo Tin Đa Tầng Cực Kỳ Tin Cậy (Telegram, Discord, SMS)**:
   - **Kênh chính**: Hỗ trợ gửi tin nhắn miễn phí vào nhóm gia đình qua **Telegram Bot API** hoặc **Discord Webhook**.
   - **Kênh dự phòng: SMS SIM máy**: Nếu kênh chính không phản hồi sau 3 lần thử (0s, 5s, 20s) hoặc quá 60s mất mạng, ứng dụng tự động gửi 1 tin nhắn SMS không dấu ($\le 160$ ký tự, tiết kiệm cước) từ SIM máy tới 1–2 số điện thoại người thân.
   - **Hàng đợi lưu bền (Persistent Queue)**: Tự động lên lịch gửi bù qua mạng online khi mạng phục hồi, ghi rõ thời gian trễ và đã báo qua SMS.
   - **Chống gửi trùng tuyệt đối**: Cờ `arrivedNotified` lưu bền đảm bảo mỗi chuyến chỉ có đúng 1 thông báo đến nơi.

3. **Chọn Điểm Đến Bằng Link & Bản Đồ Vệ Tinh Siêu Nhẹ**:
   - Dán trực tiếp link Google Maps (hỗ trợ cả link rút gọn `maps.app.goo.gl`) để ứng dụng tự động bóc tách và điền tọa độ chính xác.
   - Tích hợp bản đồ trực quan bằng Leaflet hiển thị trực tiếp lớp ảnh Vệ tinh/Lai của Google Maps mà không cần nhúng Google SDK nguyên bản, giúp giữ RAM thiết bị luôn ở mức siêu thấp (< 100MB).

4. **Truy Vấn Vị Trí Ngược (Live Query Qua Telegram)**:
   - Người thân có thể dùng lệnh Telegram `/vitri [Tên người]` để chủ động lấy tọa độ hiện tại.
   - Hỗ trợ gọi tên riêng trong nhóm chat (ví dụ `/vitri Nam`) để phân biệt tự động máy của ai sẽ trả lời.
   - Báo cáo rõ ràng: Tọa độ, tốc độ, **Tình trạng Pin** (kèm trạng thái sạc) và **Tình trạng Mạng** (Wi-Fi/4G/Mất kết nối).
5. **Chạy Ngầm Tiết Kiệm Pin (Adaptive Tracking)**:
   - Tần suất thích ứng (`distanceFilter`):
     - $> 5\text{ km}$: 200m
     - $1 - 5\text{ km}$: 50m
     - $< 1\text{ km}$: 15m
   - Tự động dừng theo dõi và tắt dịch vụ nền ngay khi đến đích hoặc sau thời gian tối đa (1–24 giờ).
   - Tích hợp giao diện **Quản lý quyền (Permissions)** tối ưu để hướng dẫn tắt hạn chế pin cho từng hãng máy (Xiaomi, Samsung, Oppo, Pixel...).

6. **Giao Diện Quản Lý Thông Minh**:
   - **Bảng điều khiển trực quan**: Báo cáo tình trạng pin, kết nối mạng Wi-Fi/4G ngay tại màn hình chính.
   - **Lịch sử hoạt động (Logs)**: Ghi lại toàn bộ lịch sử di chuyển, trạng thái gửi tin, lỗi mạng giúp dễ dàng theo dõi.
   - **Quản lý quyền**: Giao diện tập trung giúp cấp quyền định vị nền, SMS và tối ưu pin dễ dàng.

---

## 🛠️ Công Nghệ Sử Dụng

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Canvas Confetti.
- **Nền tảng Native**: Capacitor 6 (`@capacitor/android`, `@capacitor/geolocation`, `@capacitor/preferences`, `@capacitor/app`).
- **Lõi tính toán & trạng thái**: `geo.js` (Haversine), `tripMachine.js` (State Machine), `queue.js` (Persistent queue), `notifier.js` (Điều phối Telegram, Discord & SMS).
- **Kiểm thử tự động**: Vitest (100% ca kiểm thử cho logic khoảng cách, máy trạng thái, hàng đợi bền).

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
Truy cập `http://localhost:3000` trên trình duyệt để sử dụng ứng dụng.

### 4. Chạy kiểm thử tự động (Unit & Integration Tests)
```bash
npm test
```
Toàn bộ các bài kiểm thử cốt lõi sẽ được thực thi để đảm bảo tính chính xác của hệ thống định vị và gửi tin.

### 5. Đóng gói cho Android
```bash
# Build mã nguồn web
npm run build

# Đồng bộ tài nguyên sang thư mục android
npm run cap:sync

# Mở dự án trong Android Studio để build APK / chạy máy thật
npm run cap:open
```

---

## 🔒 Bảo Mật & Quyền Riêng Tư (Security & Privacy)

- **Không lộ Token**: Token Telegram/Discord chỉ lưu trong bộ nhớ cục bộ của thiết bị.
- **Không Cleartext HTTP**: Tất cả các yêu cầu gửi đi đều buộc dùng giao thức bảo mật HTTPS.
- **Tắt sao lưu tự động Android**: Khai báo `android:allowBackup="false"` trong `AndroidManifest.xml` để ngăn chặn trích xuất token qua các bản backup ADB.
- **Không theo dõi vị trí liên tục**: Ứng dụng không ghi lịch sử hành trình dài hạn lên máy chủ ngoài, chỉ đọc GPS cục bộ.

---

## 📋 Bản Quyền & Tác Giả

- **Tác giả thiết kế**: Đình Nguyên
- **Phiên bản**: v1.0.0
- **Mã nguồn**: [GitHub Repository](https://github.com/ledinhnguyen2601/DinhViGuiTin.git)
