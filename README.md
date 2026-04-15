# Gmail API Demo

Ứng dụng web demo tích hợp Gmail API, cho phép đọc và phân loại email thông minh bằng LLM (Gemini). Xây dựng với **Bun + TypeScript + Express**, lưu trữ bằng **SQLite**.

## Tính năng

- **Đăng nhập demo** — tài khoản local đơn giản để bảo vệ ứng dụng
- **OAuth2 Gmail** — kết nối tài khoản Google qua OAuth2, refresh token được mã hoá AES-256 trước khi lưu vào SQLite
- **Inbox theo thread** — hiển thị email gộp theo luồng hội thoại (giống Gmail)
- **Lọc & tìm kiếm** — lọc theo người gửi, ngày, nhãn (Inbox / Spam / Quảng cáo / Mạng xã hội / Thông báo), tìm kiếm full-text
- **LLM phân loại** — dùng Gemini 2.0 Flash để đánh giá mức độ quan trọng và tóm tắt 1 câu cho từng thread
- **Cache SQLite** — kết quả LLM được cache, chỉ re-classify khi số tin nhắn thay đổi
- **Newsletter filter** — tự động ẩn newsletter/digest/quảng cáo theo blocklist (Medium, LinkedIn, GitHub, Substack...)
- **Domain ưu tiên** — email từ domain ưu tiên được đẩy lên đầu inbox
- **Auto-refresh** — đếm ngược 60 giây rồi tự tải lại trang

## Kiến trúc

```
src/
├── server.ts              # Express app entrypoint
├── config.ts              # Đọc biến môi trường (Zod validation)
├── db.ts                  # Khởi tạo SQLite, schema migrations
├── auth/
│   ├── session.ts         # Middleware xác thực session (cookie signed)
│   └── demoUser.ts        # Xử lý login/logout tài khoản demo
├── google/
│   ├── oauth.ts           # Tạo OAuth2 client, xử lý callback
│   └── gmail.ts           # Wrapper Gmail API (threads.list, threads.get)
├── llm/
│   └── importance.ts      # Gemini classifier — phân loại quan trọng + tóm tắt
├── routes/
│   ├── auth.ts            # Routes: /login, /logout, /auth/google/*
│   └── gmail.ts           # Routes: /inbox, /inbox/:id, /gmail/disconnect
├── security/
│   ├── encryption.ts      # AES-256-CBC mã hoá refresh token
│   └── password.ts        # bcrypt hash mật khẩu
└── views/
    └── pages.ts           # Server-side HTML rendering (không dùng template engine)
```

## Database Schema

```sql
-- Tài khoản demo
users (id, email, password_hash, created_at, updated_at)

-- Tài khoản Gmail đã kết nối
gmail_accounts (id, user_id, google_sub, google_email,
                refresh_token_encrypted, scope, created_at, updated_at)

-- Cache kết quả LLM phân loại thread
thread_classifications (thread_id, important, reason, summary,
                        message_count, classified_at)
```

## Luồng hoạt động

```
User → Login (demo account)
     → Connect Gmail (OAuth2 consent screen)
     → /inbox → Gmail API threads.list
              → Newsletter filter (blocklist)
              → [tuỳ chọn] Gemini classify + summarize
              → Sort (Starred > Priority+LLM > Priority > LLM > Google Important)
              → Render HTML
```

## Cài đặt

### Yêu cầu

- [Bun](https://bun.sh) >= 1.3
- Tài khoản Google Cloud với Gmail API được bật
- Gemini API Key (miễn phí tại [Google AI Studio](https://aistudio.google.com))

### Bước 1 — Clone & cài dependencies

```bash
git clone git@github.com:phongpg-magenest/Gmail-API.git
cd Gmail-API
bun install
```

### Bước 2 — Cấu hình Google Cloud

1. Vào [Google Cloud Console](https://console.cloud.google.com)
2. Tạo project mới hoặc dùng project có sẵn
3. Bật **Gmail API**: *APIs & Services → Library → Gmail API → Enable*
4. Tạo OAuth2 credentials: *APIs & Services → Credentials → Create Credentials → OAuth client ID*
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3000/auth/google/callback`
5. Copy **Client ID** và **Client Secret**
6. Cấu hình OAuth consent screen: thêm scope `gmail.readonly`

### Bước 3 — Biến môi trường

```bash
cp .env.example .env
```

Điền vào `.env`:

```env
PORT=3000
APP_BASE_URL=http://localhost:3000

# Tạo bằng: openssl rand -hex 32
APP_SESSION_SECRET=your-long-random-secret
TOKEN_ENCRYPTION_SECRET=another-long-random-secret

# Tài khoản đăng nhập demo
DEMO_USER_EMAIL=demo@example.com
DEMO_USER_PASSWORD=your-password

# Google OAuth2
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# Gemini (https://aistudio.google.com/apikey)
GEMINI_API_KEY=your-gemini-api-key
```

### Bước 4 — Chạy

```bash
# Development (hot reload)
bun run dev

# Production
bun run start
```

Mở trình duyệt tại `http://localhost:3000`

## Sử dụng

1. **Đăng nhập** bằng tài khoản demo (`DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD`)
2. **Kết nối Gmail** — click "Connect Gmail", cho phép quyền đọc email
3. **Xem Inbox** — email hiển thị theo thread, mới nhất trên đầu
4. **Bật LLM** — click nút "🤖 LLM: Tắt" để bật phân loại tự động
   - Lần đầu gọi Gemini API, kết quả được cache vào SQLite
   - Mỗi thread hiển thị badge quan trọng và tóm tắt 1 câu (tiếng Việt)
5. **Filter newsletter** — nút "🚫 Newsletter: Ẩn/Hiện" để toggle
6. **Xem chi tiết thread** — click vào thread để xem tất cả tin nhắn

## LLM Classification

Gemini 2.0 Flash đánh giá từng thread dựa trên:

**Quan trọng (`important: true`):**
- Khách hàng / đối tác / cấp trên đang chờ phản hồi
- Email nội bộ có thông tin cần hành động
- Có deadline, approval, lịch họp
- Lỗi production, CI/CD fail từ hệ thống đang vận hành
- Liên quan hợp đồng, tài liệu cần review

**Không quan trọng (`important: false`):**
- Newsletter, digest, promotional
- Thông báo mạng xã hội (likes, stars, follows)
- Noreply tự động không cần action

Cache được invalidate khi `message_count` của thread thay đổi (có tin mới).

## Newsletter Blocklist

Các địa chỉ/pattern bị ẩn mặc định:

```
noreply@medium.com, digest@medium.com
noreply@linkedin.com, messages-noreply@linkedin.com
noreply@github.com, notifications@github.com
noreply-apps-scripts-notifications@google.com
noreply@alibabacloud.com
newsletter@*, digest@*, no-reply@substack.com
```

## Tech Stack

| Thành phần | Công nghệ |
|---|---|
| Runtime | Bun 1.3 |
| Web framework | Express 5 |
| Language | TypeScript |
| Database | SQLite (bun:sqlite) |
| Gmail | googleapis (Node.js client) |
| LLM | @google/generative-ai (Gemini 2.0 Flash) |
| UI | Server-side HTML (không framework) |
| Security | AES-256-CBC (token), bcrypt (password), signed cookie (session) |

## Bảo mật

- Refresh token được mã hoá AES-256-CBC trước khi lưu DB
- Mật khẩu demo được hash bcrypt
- Session lưu trong cookie signed (HMAC)
- `.env` và `data/` được gitignore — không commit credentials

## Scripts

```bash
bun run dev      # Hot reload development
bun run start    # Production
bun run check    # TypeScript type check
```

## License

MIT
