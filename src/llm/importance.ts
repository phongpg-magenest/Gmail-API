import { GoogleGenerativeAI } from '@google/generative-ai'
import { env } from '../config'
import { db, type ThreadClassificationRow } from '../db'

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

export type ThreadInput = {
  id: string
  subject: string
  firstFrom: string
  lastFrom: string
  messageCount: number
  allSnippets: string[]
}

export type ImportanceResult = {
  id: string
  important: boolean
  reason: string
  summary: string
}

const PROMPT_TEMPLATE = `Bạn là trợ lý phân loại luồng email (thread) cho Phong (email: phongpg@magenest.com), AI Engineer Lead tại Magenest.

Mỗi luồng gồm nhiều tin nhắn. Bạn nhận được:
- firstFrom: người khởi tạo luồng
- lastFrom: người gửi tin cuối cùng
- messageCount: tổng số tin trong luồng
- snippets: nội dung tóm tắt các tin (theo thứ tự)

Nhiệm vụ: đánh giá mức độ quan trọng VÀ tóm tắt nội dung luồng.

QUAN TRỌNG (important: true):
- Khách hàng, đối tác, cấp trên đang chờ phản hồi (lastFrom không phải @magenest.com)
- Mail từ đồng nghiệp, HR, nội bộ Magenest có thông tin cần đọc / hành động
- Có yêu cầu hành động, deadline, approval, lịch họp
- Lỗi hệ thống từ hệ thống đang vận hành (server down, production error, CI/CD fail)
- Liên quan dự án, hợp đồng, tài liệu cần review

KHÔNG QUAN TRỌNG (important: false):
- Newsletter, digest, promotional (Medium, Alibaba Cloud, Kimi, Fireworks, LinkedIn digest...)
- Thông báo mạng xã hội (likes, stars, follows...)
- Thông báo tự động không cần action (Google Docs share, Apps Script failure, noreply-*)
- Thread đã kết thúc hoàn toàn (cảm ơn, vấn đề xong, Phong đã reply cuối)

KHI KHÔNG CHẮC: ưu tiên important: true

SUMMARY: tóm tắt 1 câu ngắn bằng tiếng Việt nội dung chính của luồng (không cần lịch sự, thẳng vào vấn đề).
Ví dụ: "Khách hỏi về giá gói Enterprise", "HR thông báo lịch họp all-hands thứ 6", "Newsletter Medium về AI workflows"

Trả về JSON array (không có markdown, không có backtick), mỗi phần tử:
{"id": "...", "important": true/false, "reason": "lý do ngắn", "summary": "tóm tắt 1 câu"}

Danh sách luồng:
`

function loadFromDb(threadId: string): ThreadClassificationRow | null {
  return (
    db
      .query('SELECT thread_id, important, reason, summary, message_count FROM thread_classifications WHERE thread_id = ?')
      .get(threadId) as ThreadClassificationRow | null
  ) ?? null
}

function saveToDb(result: ImportanceResult, messageCount: number) {
  db.query(`
    INSERT INTO thread_classifications (thread_id, important, reason, summary, message_count)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(thread_id) DO UPDATE SET
      important = excluded.important,
      reason = excluded.reason,
      summary = excluded.summary,
      message_count = excluded.message_count,
      classified_at = CURRENT_TIMESTAMP
  `).run(result.id, result.important ? 1 : 0, result.reason, result.summary ?? '', messageCount)
}

export async function classifyImportance(threads: ThreadInput[]): Promise<Map<string, ImportanceResult>> {
  const map = new Map<string, ImportanceResult>()

  const needsClassification = threads.filter(t => {
    const cached = loadFromDb(t.id)
    if (cached && cached.message_count === t.messageCount) {
      map.set(t.id, {
        id: t.id,
        important: cached.important === 1,
        reason: cached.reason,
        summary: cached.summary ?? '',
      })
      return false
    }
    return true
  })

  if (needsClassification.length === 0) return map

  console.log(`[LLM] Classifying ${needsClassification.length} threads (${threads.length - needsClassification.length} from cache)`)

  const input = needsClassification.map((t, i) => {
    const snippetSummary = t.allSnippets.map((s, j) => `  [${j + 1}] ${s.slice(0, 100)}`).join('\n')
    return `${i + 1}. id="${t.id}" | subject="${t.subject}" | ${t.messageCount} tin | firstFrom="${t.firstFrom}" | lastFrom="${t.lastFrom}"\n${snippetSummary}`
  }).join('\n\n')

  const result = await model.generateContent(PROMPT_TEMPLATE + input)
  let text = result.response.text().trim()
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  try {
    const parsed = JSON.parse(text) as ImportanceResult[]
    for (const item of parsed) {
      const thread = needsClassification.find(t => t.id === item.id)
      if (thread) saveToDb(item, thread.messageCount)
      map.set(item.id, item)
    }
  } catch (e) {
    console.error('LLM parse error:', e, '\nRaw:', text.slice(0, 300))
  }

  return map
}
