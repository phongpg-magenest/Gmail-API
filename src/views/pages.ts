function pageShell(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        --bg: #f4efe6;
        --card: #fffdf8;
        --ink: #1f1a17;
        --accent: #9d4b2e;
        --muted: #76685f;
        --line: #dccfc4;
      }
      body {
        margin: 0;
        font-family: Georgia, "Iowan Old Style", serif;
        background:
          radial-gradient(circle at top left, rgba(157, 75, 46, 0.12), transparent 28%),
          linear-gradient(180deg, #f8f2ea 0%, var(--bg) 100%);
        color: var(--ink);
      }
      .wrap {
        max-width: 900px;
        margin: 40px auto;
        padding: 0 20px;
      }
      .card {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 24px;
        box-shadow: 0 18px 40px rgba(60, 33, 23, 0.08);
      }
      h1, h2 {
        margin-top: 0;
      }
      form {
        display: grid;
        gap: 12px;
      }
      input, button, textarea {
        font: inherit;
      }
      input, textarea {
        width: 100%;
        padding: 12px;
        border-radius: 12px;
        border: 1px solid var(--line);
        background: #fff;
        box-sizing: border-box;
      }
      button, .button-link {
        display: inline-block;
        padding: 12px 16px;
        border: none;
        border-radius: 999px;
        background: var(--accent);
        color: white;
        text-decoration: none;
        cursor: pointer;
      }
      .button-link.secondary, button.secondary {
        background: #ebe1d7;
        color: var(--ink);
      }
      .row {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      .muted {
        color: var(--muted);
      }
      .status {
        padding: 12px 14px;
        border-radius: 12px;
        background: #f3e3db;
        margin-bottom: 16px;
      }
      code, pre {
        background: #f5eee8;
        border-radius: 12px;
      }
      pre {
        padding: 14px;
        overflow: auto;
      }
    </style>
  </head>
  <body>
    <div class="wrap">${body}</div>
  </body>
</html>`
}

export function renderLoginPage(args: { error?: string; email?: string }) {
  return pageShell(
    'Mail Demo Login',
    `<div class="card">
      <h1>Mail Demo</h1>
      <p class="muted">Login with the demo account first. Gmail is connected separately through Google OAuth.</p>
      ${args.error ? `<div class="status">${args.error}</div>` : ''}
      <form method="post" action="/login">
        <label>
          Email
          <input type="email" name="email" value="${args.email ?? ''}" required />
        </label>
        <label>
          Password
          <input type="password" name="password" required />
        </label>
        <button type="submit">Login</button>
      </form>
    </div>`,
  )
}

type ThreadSummary = {
  id: string
  subject: string
  messageCount: number
  firstFrom: string
  firstDate: string
  lastFrom: string
  lastDate: string
  lastSnippet: string
  lastLabelIds: string[]
  allSnippets: string[]
  llmImportant: boolean
  llmReason: string
  llmSummary: string
}

const TABS = [
  { label: 'Inbox',        labelId: 'INBOX' },
  { label: 'Spam',         labelId: 'SPAM' },
  { label: 'Quảng cáo',   labelId: 'CATEGORY_PROMOTIONS' },
  { label: 'Mạng xã hội', labelId: 'CATEGORY_SOCIAL' },
  { label: 'Thông báo',   labelId: 'CATEGORY_UPDATES' },
]

const DATE_OPTIONS = [
  { label: 'Tất cả',     value: '' },
  { label: 'Hôm nay',    value: '1d' },
  { label: '7 ngày',     value: '7d' },
  { label: '30 ngày',    value: '30d' },
  { label: '3 tháng',    value: '90d' },
]

export function renderInboxPage(args: {
  gmailEmail: string
  threads: ThreadSummary[]
  q: string
  labelId: string
  fromFilter: string
  dateFilter: string
  useLLM: boolean
  hideNewsletter: boolean
}) {
  const rows = args.threads.map(t => {
    const from = t.lastFrom || t.firstFrom
    const date = t.lastDate ? new Date(t.lastDate).toLocaleString('vi-VN') : ''
    const snippet = t.lastSnippet.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    const isStarred = t.lastLabelIds.includes('STARRED')
    const isImportant = t.lastLabelIds.includes('IMPORTANT')
    const isUnread = t.lastLabelIds.includes('UNREAD')
    const countBadge = t.messageCount > 1 ? `<span class="badge badge-count">${t.messageCount}</span>` : ''
    const badge = isStarred
      ? `<span class="badge badge-star">⭐ Starred</span>`
      : t.llmImportant
        ? `<span class="badge badge-llm" title="${escapeHtml(t.llmReason)}">🤖 Quan trọng</span>`
        : isImportant
          ? `<span class="badge badge-important">● Google</span>`
          : ''
    const summaryLine = args.useLLM && t.llmSummary
      ? `<div class="mail-llm-summary">${escapeHtml(t.llmSummary)}</div>`
      : ''
    return `<a class="mail-row${isUnread ? ' mail-unread' : ''}" href="/inbox/${t.id}?label=${encodeURIComponent(args.labelId)}&q=${encodeURIComponent(args.q)}">
      <div class="mail-from">${escapeHtml(from)}</div>
      <div class="mail-subject">${escapeHtml(t.subject)} ${countBadge} ${badge}</div>
      <div class="mail-snippet">${escapeHtml(snippet)}</div>
      ${summaryLine}
      <div class="mail-date">${date}</div>
    </a>`
  }).join('')

  const tabs = TABS.map(t => {
    const active = t.labelId === args.labelId
    return `<a class="tab${active ? ' tab-active' : ''}" href="/inbox?label=${t.labelId}">${t.label}</a>`
  }).join('')

  return pageShell(
    'Inbox',
    `<style>
      .mail-list { display: flex; flex-direction: column; gap: 0; }
      .mail-row { display: grid; grid-template-columns: 220px 1fr auto; grid-template-rows: auto auto; gap: 2px 12px; padding: 14px 18px; border-bottom: 1px solid var(--line); background: var(--card); text-decoration: none; color: inherit; }
      .mail-row:first-child { border-radius: 18px 18px 0 0; }
      .mail-row:last-child { border-bottom: none; border-radius: 0 0 18px 18px; }
      .mail-row:hover { background: #f5ede4; }
      .mail-from { font-weight: 600; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .mail-subject { font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .mail-snippet { grid-column: 2; font-size: 0.82rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .mail-date { grid-column: 3; grid-row: 1; font-size: 0.8rem; color: var(--muted); white-space: nowrap; }
      form.search { display: flex; gap: 8px; margin-bottom: 16px; }
      form.search input { flex: 1; }
      form.search button { flex-shrink: 0; }
      .tabs { display: flex; gap: 4px; margin-bottom: 16px; flex-wrap: wrap; }
      .tab { padding: 8px 16px; border-radius: 999px; text-decoration: none; color: var(--muted); background: var(--card); border: 1px solid var(--line); font-size: 0.9rem; }
      .tab:hover { background: #f5ede4; }
      .tab-active { background: var(--accent); color: white; border-color: var(--accent); }
      .mail-unread .mail-from, .mail-unread .mail-subject { font-weight: 700; color: var(--ink); }
      .badge { font-size: 0.72rem; padding: 2px 7px; border-radius: 999px; vertical-align: middle; }
      .badge-star { background: #fff3cd; color: #856404; }
      .badge-llm { background: #e8f4fd; color: #1565c0; cursor: help; }
      .badge-important { background: #fde8e0; color: var(--accent); }
      .badge-count { background: #ebe1d7; color: var(--muted); }
      .mail-llm-summary { grid-column: 2; font-size: 0.8rem; color: #1565c0; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .filters { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
      .filter-row { display: flex; gap: 8px; margin-bottom: 16px; }
      .filter-row input { flex: 1; }
      select { font: inherit; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line); background: #fff; color: var(--ink); width: 100%; box-sizing: border-box; }
    </style>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <a href="/" style="color:var(--muted);text-decoration:none;">← Dashboard</a>
        <span style="color:var(--muted);">${escapeHtml(args.gmailEmail)}</span>
        <span class="muted" style="font-size:0.78rem;" id="refresh-timer">tự động làm mới sau <span id="countdown">60</span>s</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <a href="/inbox?label=${encodeURIComponent(args.labelId)}&from=${encodeURIComponent(args.fromFilter)}&date=${encodeURIComponent(args.dateFilter)}&q=${encodeURIComponent(args.q)}&llm=${args.useLLM ? '1' : '0'}&hide=${args.hideNewsletter ? '1' : '0'}"
           class="button-link secondary" style="font-size:0.85rem;padding:8px 14px;">↻ Làm mới</a>
        <a href="/inbox?label=${encodeURIComponent(args.labelId)}&from=${encodeURIComponent(args.fromFilter)}&date=${encodeURIComponent(args.dateFilter)}&q=${encodeURIComponent(args.q)}&llm=${args.useLLM ? '0' : '1'}&hide=${args.hideNewsletter ? '1' : '0'}"
           class="${args.useLLM ? 'button-link' : 'button-link secondary'}"
           style="font-size:0.85rem;padding:8px 14px;">
          🤖 LLM: ${args.useLLM ? 'Bật' : 'Tắt'}
        </a>
        <a href="/inbox?label=${encodeURIComponent(args.labelId)}&from=${encodeURIComponent(args.fromFilter)}&date=${encodeURIComponent(args.dateFilter)}&q=${encodeURIComponent(args.q)}&llm=${args.useLLM ? '1' : '0'}&hide=${args.hideNewsletter ? '0' : '1'}"
           class="${args.hideNewsletter ? 'button-link' : 'button-link secondary'}"
           style="font-size:0.85rem;padding:8px 14px;">
          🚫 Newsletter: ${args.hideNewsletter ? 'Ẩn' : 'Hiện'}
        </a>
      </div>
    </div>
    <script>
      let t = 60;
      const el = document.getElementById('countdown');
      const iv = setInterval(() => {
        t--;
        if (el) el.textContent = t;
        if (t <= 0) { clearInterval(iv); location.reload(); }
      }, 1000);
    </script>
    <div class="tabs">${tabs}</div>
    <form method="get" action="/inbox">
      <input type="hidden" name="label" value="${escapeHtml(args.labelId)}" />
      <div class="filters">
        <input type="text" name="from" value="${escapeHtml(args.fromFilter)}" placeholder="Người gửi / domain (vd: @magenest.com)" />
        <select name="date">
          ${DATE_OPTIONS.map(o => `<option value="${o.value}"${o.value === args.dateFilter ? ' selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </div>
      <div class="filter-row">
        <input type="text" name="q" value="${escapeHtml(args.q)}" placeholder="Tìm thêm (subject, từ khóa...)" />
        <button type="submit">Lọc</button>
      </div>
    </form>
    <div class="card" style="padding:0;overflow:hidden;">
      <div class="mail-list">
        ${rows || '<p style="padding:24px;color:var(--muted)">Không có thư.</p>'}
      </div>
    </div>`,
  )
}

type ThreadDetail = {
  threadId: string
  subject: string
  messageCount: number
  messages: Array<{
    id: string
    snippet: string
    headers: Record<string, string>
    labelIds: string[]
  }>
}

export function renderThreadDetailPage(args: {
  gmailEmail: string
  thread: ThreadDetail
  q: string
  labelId: string
}) {
  const { thread } = args
  const backHref = `/inbox?label=${encodeURIComponent(args.labelId)}${args.q ? `&q=${encodeURIComponent(args.q)}` : ''}`

  const messageRows = thread.messages.map((m, i) => {
    const from = m.headers.from ?? ''
    const date = m.headers.date ? new Date(m.headers.date).toLocaleString('vi-VN') : ''
    const snippet = m.snippet.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    const isUnread = m.labelIds.includes('UNREAD')
    return `<div style="padding:16px 0;border-bottom:1px solid var(--line);${isUnread ? 'font-weight:600;' : ''}">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:0.9rem;">${escapeHtml(from)}</span>
        <span class="muted" style="font-size:0.8rem;">${date}</span>
      </div>
      <p style="margin:0;font-size:0.9rem;color:var(--muted);">${escapeHtml(snippet)}</p>
      <p style="margin:6px 0 0;font-size:0.75rem;color:#bbb;">[${i + 1}/${thread.messageCount}] — snippet preview</p>
    </div>`
  }).join('')

  return pageShell(
    thread.subject,
    `<style>
      .thread-header { margin-bottom: 16px; }
    </style>
    <div style="margin-bottom:16px;">
      <a href="${backHref}" style="color:var(--muted);text-decoration:none;">← Quay lại</a>
    </div>
    <div class="card">
      <h2 style="margin-bottom:4px;">${escapeHtml(thread.subject)}</h2>
      <p class="muted" style="margin:0 0 16px;font-size:0.85rem;">${thread.messageCount} tin nhắn trong luồng</p>
      ${messageRows || '<p class="muted">Không có tin nhắn.</p>'}
    </div>`,
  )
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function renderDashboardPage(args: {
  userEmail: string
  gmailEmail?: string
  statusMessage?: string
}) {
  return pageShell(
    'Mail Demo Dashboard',
    `<div class="card">
      <h1>Mail Demo Dashboard</h1>
      <p><strong>Demo user:</strong> ${args.userEmail}</p>
      <p><strong>Connected Gmail:</strong> ${args.gmailEmail ?? 'Not connected'}</p>
      ${args.statusMessage ? `<div class="status">${args.statusMessage}</div>` : ''}

      <div class="row" style="margin-bottom: 16px;">
        ${args.gmailEmail
          ? `<a class="button-link" href="/inbox">View Inbox</a>`
          : `<a class="button-link" href="/auth/google/start">Connect Gmail</a>`}
        <form method="post" action="/gmail/disconnect">
          <button class="secondary" type="submit">Disconnect Gmail</button>
        </form>
      </div>
    </div>`,
  )
}
