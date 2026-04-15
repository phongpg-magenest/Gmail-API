# Gmail API — Tài liệu tích hợp

## 1. Setup Google Cloud

### 1.1 Tạo project trên Google Cloud Console

1. Truy cập [console.cloud.google.com](https://console.cloud.google.com)
2. Tạo project mới (hoặc dùng project có sẵn)
3. Vào **APIs & Services → Library**, tìm và bật **Gmail API**

### 1.2 Tạo OAuth 2.0 Credentials

1. Vào **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. Application type: **Web application**
3. Thêm Authorized redirect URIs:
   ```
   http://localhost:3000/auth/google/callback
   ```
4. Lưu lại `Client ID` và `Client Secret`

### 1.3 Cấu hình OAuth Consent Screen

1. Vào **APIs & Services → OAuth consent screen**
2. User Type: **External** (hoặc Internal nếu dùng Google Workspace)
3. Điền App name, support email
4. Thêm scopes:
   ```
   https://www.googleapis.com/auth/gmail.readonly
   ```
5. Thêm test users (email của tài khoản Gmail muốn kết nối)

> **Lưu ý:** Khi app ở trạng thái "Testing", chỉ các email trong danh sách test users mới đăng nhập được. Để mở rộng cần submit Google verification.

### 1.4 Cấu hình .env

```env
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
TOKEN_ENCRYPTION_SECRET=random_32_char_string_for_aes_encryption
GEMINI_API_KEY=your_gemini_api_key
DEMO_USER_EMAIL=your@email.com
DEMO_USER_PASSWORD=yourpassword
```

---

## 2. OAuth Flow

```
User → GET /auth/google/start
     → redirect đến Google OAuth consent screen
     → User chấp thuận
     → Google redirect về /auth/google/callback?code=...
     → App dùng code đổi lấy access_token + refresh_token
     → Lưu refresh_token (đã mã hóa AES) vào SQLite
     → Dùng refresh_token để lấy access_token mỗi khi gọi Gmail API
```

**Scopes sử dụng:**

| Scope | Quyền |
|---|---|
| `gmail.readonly` | Đọc mail, không thể gửi/xóa |
| `userinfo.email` | Lấy email của tài khoản |
| `userinfo.profile` | Lấy thông tin cơ bản |

---

## 3. Gmail API — Threads

Gmail tổ chức email theo **thread** (luồng hội thoại). Mỗi thread gồm nhiều message cùng subject/conversation.

### 3.1 List Threads

```
GET https://gmail.googleapis.com/gmail/v1/users/me/threads
```

**Query params:**

| Param | Mô tả | Ví dụ |
|---|---|---|
| `q` | Gmail search query | `from:@magenest.com newer_than:7d` |
| `labelIds` | Lọc theo label | `INBOX`, `SPAM`, `CATEGORY_PROMOTIONS` |
| `maxResults` | Số thread tối đa | `20` |
| `pageToken` | Phân trang | token từ response trước |

**Response:**

```json
{
  "threads": [
    { "id": "18f3a1b2c3d4e5f6", "snippet": "Xin chào, tôi muốn hỏi về..." },
    { "id": "18f3a1b2c3d4e5f7", "snippet": "Re: Báo giá dự án..." }
  ],
  "nextPageToken": "abc123",
  "resultSizeEstimate": 42
}
```

---

### 3.2 Get Thread Detail

```
GET https://gmail.googleapis.com/gmail/v1/users/me/threads/{threadId}
```

**Query params:**

| Param | Mô tả |
|---|---|
| `format` | `full` (body đầy đủ), `metadata` (chỉ headers + snippet), `minimal` |
| `metadataHeaders` | Headers cần lấy khi dùng `metadata` format, vd: `["From","To","Subject","Date"]` |

**Response (format: metadata):**

```json
{
  "id": "18f3a1b2c3d4e5f6",
  "historyId": "1234567",
  "messages": [
    {
      "id": "18f3a1b2c3d4e5f6",
      "threadId": "18f3a1b2c3d4e5f6",
      "labelIds": ["INBOX", "UNREAD", "IMPORTANT"],
      "snippet": "Xin chào anh Phong, tôi muốn hỏi về gói dịch vụ...",
      "payload": {
        "headers": [
          { "name": "From",    "value": "Nguyen Van A <nguyenvana@example.com>" },
          { "name": "To",      "value": "phongpg@magenest.com" },
          { "name": "Subject", "value": "Hỏi về gói dịch vụ Magento" },
          { "name": "Date",    "value": "Mon, 13 Apr 2026 09:15:00 +0700" }
        ]
      }
    },
    {
      "id": "18f3a1b2c3d4e5f8",
      "threadId": "18f3a1b2c3d4e5f6",
      "labelIds": ["SENT"],
      "snippet": "Chào anh, cảm ơn anh đã liên hệ. Bên mình có các gói...",
      "payload": {
        "headers": [
          { "name": "From",    "value": "Phong <phongpg@magenest.com>" },
          { "name": "To",      "value": "nguyenvana@example.com" },
          { "name": "Subject", "value": "Re: Hỏi về gói dịch vụ Magento" },
          { "name": "Date",    "value": "Mon, 13 Apr 2026 10:30:00 +0700" }
        ]
      }
    },
    {
      "id": "18f3a1b2c3d4e5fa",
      "threadId": "18f3a1b2c3d4e5f6",
      "labelIds": ["INBOX"],
      "snippet": "Cảm ơn anh rất nhiều, anh cho mình xin báo giá chi tiết được không?",
      "payload": {
        "headers": [
          { "name": "From",    "value": "Nguyen Van A <nguyenvana@example.com>" },
          { "name": "To",      "value": "phongpg@magenest.com" },
          { "name": "Subject", "value": "Re: Hỏi về gói dịch vụ Magento" },
          { "name": "Date",    "value": "Mon, 13 Apr 2026 14:05:00 +0700" }
        ]
      }
    }
  ]
}
```

---

## 4. Label IDs

Gmail dùng label để phân loại email. Một message có thể có nhiều label cùng lúc.

### System Labels

| Label ID | Ý nghĩa |
|---|---|
| `INBOX` | Hộp thư đến |
| `SENT` | Đã gửi |
| `DRAFT` | Nháp |
| `TRASH` | Thùng rác |
| `SPAM` | Thư rác |
| `STARRED` | Có gắn sao |
| `IMPORTANT` | Google đánh dấu quan trọng |
| `UNREAD` | Chưa đọc |

### Category Labels (Gmail tự phân loại)

| Label ID | Tab trong Gmail |
|---|---|
| `CATEGORY_PERSONAL` | Cá nhân |
| `CATEGORY_SOCIAL` | Mạng xã hội |
| `CATEGORY_PROMOTIONS` | Quảng cáo |
| `CATEGORY_UPDATES` | Thông báo |
| `CATEGORY_FORUMS` | Diễn đàn |

---

## 5. Gmail Search Query (tham số `q`)

Cú pháp tương tự thanh tìm kiếm trong Gmail:

| Query | Ý nghĩa |
|---|---|
| `from:@magenest.com` | Từ domain magenest.com |
| `to:phong@example.com` | Gửi đến email cụ thể |
| `subject:báo giá` | Tiêu đề chứa "báo giá" |
| `newer_than:7d` | Trong 7 ngày qua |
| `newer_than:1d` | Trong 24 giờ qua |
| `older_than:30d` | Cũ hơn 30 ngày |
| `has:attachment` | Có đính kèm |
| `is:unread` | Chưa đọc |
| `is:starred` | Có gắn sao |
| `label:INBOX` | Trong inbox |

Có thể kết hợp: `from:@magenest.com newer_than:7d is:unread`

---

## 6. ThreadSummary — Cấu trúc dữ liệu trong app

Sau khi fetch từ Gmail API, app chuẩn hóa thành `ThreadSummary`:

```typescript
type ThreadSummary = {
  id: string           // threadId (dùng làm cache key)
  subject: string      // subject của message đầu tiên
  messageCount: number // tổng số message trong thread

  // Message đầu tiên (người khởi tạo)
  firstFrom: string    // "Nguyen Van A <nguyenvana@example.com>"
  firstDate: string    // "Mon, 13 Apr 2026 09:15:00 +0700"

  // Message cuối cùng (trạng thái hiện tại)
  lastFrom: string     // người gửi gần nhất
  lastDate: string     // thời gian gần nhất
  lastSnippet: string  // preview nội dung gần nhất
  lastLabelIds: string[] // labels của message cuối (UNREAD, STARRED...)

  // Toàn bộ snippets để LLM đánh giá
  allSnippets: string[]
}
```

---

## 7. LLM Classification Cache

Kết quả phân loại được lưu vào SQLite để tránh gọi lại LLM mỗi lần load:

```sql
CREATE TABLE thread_classifications (
  thread_id   TEXT PRIMARY KEY,
  important   INTEGER NOT NULL,  -- 0 hoặc 1
  reason      TEXT NOT NULL,     -- lý do ngắn gọn từ LLM
  message_count INTEGER NOT NULL, -- dùng để detect khi có reply mới
  classified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Logic invalidation:**

```
thread_id có trong DB && message_count == cached_count → dùng cache
thread_id có trong DB && message_count > cached_count  → có reply mới → gọi LLM lại
thread_id chưa có trong DB                             → thread mới → gọi LLM
```
