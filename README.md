# Geofencing Tracker v1.0 📍
**Ứng dụng tự động báo tin cho người thân khi đã đến nơi (Android & Web App)**

Hệ thống theo dõi định vị ngầm tự động nhận diện khi người đi đường vào bán kính điểm đến (geofence) và tự động gửi thông báo an toàn cho gia đình/người thân qua **Telegram Bot** (kênh chính) và tự động chuyển sang **SMS từ SIM** (kênh dự phòng) khi mất mạng hoặc Telegram bị gián đoạn.

---

## 🌟 Tính Năng Nổi Bật

1. **Tự động nhận diện đến đích (Noise-Immune Geofencing)**:
   - Sử dụng công thức toán học mặt cầu **Haversine**.
   - Cơ chế chống nhiễu kép: yêu cầu 2 mẫu GPS hợp lệ liên tiếp trong bán kính (mặc định 100m) cách nhau tối thiểu 5 giây và độ sai số $\le 50\text{ m}$.
   - Tự động lọc bỏ các mẫu GPS nhảy cóc vô lý ($> 216\text{ km/h}$).

2. **Kênh Báo Tin Đa Tầng Cực Kỳ Tin Cậy**:
   - **Kênh chính: Telegram Bot API**: Gửi tin nhắn miễn phí vào nhóm gia đình, hỗ trợ Markdown/HTML, không giới hạn 24 giờ.
   - **Kênh dự phòng: SMS SIM máy**: Nếu Telegram không phản hồi sau 3 lần thử (0s, 5s, 20s) hoặc quá 60s mất mạng, ứng dụng tự động gửi 1 tin nhắn SMS không dấu ($\le 160$ ký tự, tiết kiệm cước) từ SIM máy tới 1–2 số điện thoại người thân.
   - **Hàng đợi lưu bền (Persistent Queue)**: Tự động lên lịch gửi bù qua Telegram khi mạng phục hồi, ghi rõ thời gian trễ và đã báo qua SMS.
   - **Chống gửi trùng tuyệt đối**: Cờ `arrivedNotified` lưu bền đảm bảo mỗi chuyến chỉ có đúng 1 thông báo đến nơi.

3. **Chạy Ngầm Tiết Kiệm Pin (Adaptive Tracking)**:
   - Tần suất thích ứng (`distanceFilter`):
     - $> 5\text{ km}$: 200m
     - $1 - 5\text{ km}$: 50m
     - $< 1\text{ km}$: 15m
   - Tự động dừng theo dõi và tắt dịch vụ nền ngay khi đến đích hoặc sau thời gian tối đa (1–24 giờ).
   - Tích hợp hướng dẫn tắt tối ưu pin cho từng hãng máy (Xiaomi, Samsung, Oppo, Pixel...).

4. **Bộ Giả Lập GPS Thực Địa (In-App Simulator)**:
   - Cho phép chạy mô phỏng các tình huống thực tế (xe di chuyển tới đích, GPS nhảy cóc, mẫu sai số kém...) ngay trên ứng dụng mà không cần phải ra đường.

---

## 🛠️ Công Nghệ Sử Dụng

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Canvas Confetti.
- **Nền tảng Native**: Capacitor 6 (`@capacitor/android`, `@capacitor/geolocation`, `@capacitor/preferences`, `@capacitor/app`).
- **Lõi tính toán & trạng thái**: `geo.js` (Haversine, EMA speed, ETA), `tripMachine.js` (State Machine), `queue.js` (Persistent queue & exponential backoff), `notifier.js` (Điều phối Telegram & SMS).
- **Kiểm thử tự động**: Vitest (100% ca kiểm thử TC-01 đến TC-16, kiểm tra bảo mật token, chống injection).

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
Truy cập `http://localhost:3000` trên trình duyệt để sử dụng và chạy bộ giả lập GPS.

### 4. Chạy kiểm thử tự động (Unit & Integration Tests)
```bash
npm test
```
Toàn bộ 28 bài kiểm thử về khoảng cách Haversine, máy trạng thái, hàng đợi bền, chống gửi trùng và bảo mật token sẽ được thực thi.

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

- **Không lộ Token**: Token Telegram Bot chỉ lưu trong bộ nhớ riêng của ứng dụng trên máy người dùng, **tuyệt đối không được ghi ra file log** hoặc đẩy lên Git.
- **Không Cleartext HTTP**: Tất cả các yêu cầu gửi đi đều buộc dùng giao thức bảo mật HTTPS tới `api.telegram.org`.
- **Tắt sao lưu tự động Android**: Khai báo `android:allowBackup="false"` trong `AndroidManifest.xml` để ngăn chặn trích xuất token qua các bản backup ADB.
- **Không theo dõi vị trí liên tục**: Ứng dụng không ghi lịch sử hành trình dài hạn lên máy chủ ngoài, chỉ đọc GPS cục bộ và thông báo 1 lần khi vào bán kính điểm đến.

---

## 📋 Bản Quyền & Tác Giả

- **Tác giả thiết kế**: Đình Nguyên
- **Phiên bản**: v1.0.0
- **Mã nguồn**: [GitHub Repository](https://github.com/ledinhnguyen2601/DinhViGuiTin.git)
