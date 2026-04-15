import { Router } from 'express'
import { requireSession } from '../auth/session'
import {
  disconnectGmailAccount,
  getGmailAccountForUser,
  getThreadForUser,
  listThreadsForUser,
} from '../google/gmail'
import { renderInboxPage, renderThreadDetailPage } from '../views/pages'
import { classifyImportance } from '../llm/importance'

const router = Router()

// Domain ưu tiên cao
const PRIORITY_DOMAINS = ['@magenest.com']

// Newsletter/spam tự động bị ẩn khỏi inbox (không cần LLM)
const NEWSLETTER_BLOCKLIST = [
  'noreply@medium.com',
  'digest@medium.com',
  'no-reply@medium.com',
  'noreply@linkedin.com',
  'messages-noreply@linkedin.com',
  'noreply@github.com',
  'notifications@github.com',
  'noreply-apps-scripts-notifications@google.com',
  'noreply@alibabacloud.com',
  'newsletter@',
  'digest@',
  'no-reply@substack.com',
  'noreply@substack.com',
]

function isBlocklisted(from: string): boolean {
  const f = from.toLowerCase()
  return NEWSLETTER_BLOCKLIST.some(pattern => f.includes(pattern))
}

function isFromPriorityDomain(from: string): boolean {
  const f = from.toLowerCase()
  return PRIORITY_DOMAINS.some(d => f.includes(d))
}

router.post('/gmail/disconnect', requireSession, (req, res) => {
  disconnectGmailAccount(req.sessionUser!.id)
  res.redirect('/?gmailDisconnected=1')
})

router.get('/inbox', requireSession, async (req, res) => {
  const account = getGmailAccountForUser(req.sessionUser!.id)
  if (!account) {
    res.redirect('/')
    return
  }

  const labelId = typeof req.query.label === 'string' && req.query.label ? req.query.label : 'INBOX'
  const fromFilter = typeof req.query.from === 'string' ? req.query.from.trim() : ''
  const dateFilter = typeof req.query.date === 'string' ? req.query.date : ''
  const qRaw = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const useLLM = req.query.llm === '1'
  const hideNewsletter = req.query.hide !== '0' // mặc định bật filter

  const parts: string[] = []
  if (fromFilter) parts.push(`from:${fromFilter}`)
  if (dateFilter) parts.push(`newer_than:${dateFilter}`)
  if (qRaw) parts.push(qRaw)
  const q = parts.join(' ')

  try {
    const result = await listThreadsForUser({
      userId: req.sessionUser!.id,
      q: q || undefined,
      labelIds: [labelId],
      maxResults: 30, // fetch thêm vì sẽ bị filter bớt
    })

    let threads = result.threads.map(t => ({
      ...t,
      llmImportant: false,
      llmReason: '',
      llmSummary: '',
    }))

    // Filter newsletter blocklist
    if (hideNewsletter) {
      threads = threads.filter(t =>
        !isBlocklisted(t.firstFrom) && !isBlocklisted(t.lastFrom)
      )
    }

    if (useLLM) {
      const llmMap = await classifyImportance(
        threads.map(t => ({
          id: t.id,
          subject: t.subject,
          firstFrom: t.firstFrom,
          lastFrom: t.lastFrom,
          messageCount: t.messageCount,
          allSnippets: t.allSnippets,
        }))
      )
      threads = threads.map(t => ({
        ...t,
        llmImportant: llmMap.get(t.id)?.important ?? false,
        llmReason: llmMap.get(t.id)?.reason ?? '',
        llmSummary: llmMap.get(t.id)?.summary ?? '',
      }))

      // Ẩn luôn những thread LLM đánh không quan trọng (nếu muốn)
      // threads = threads.filter(t => t.llmImportant)
    }

    threads.sort((a, b) => {
      const rank = (t: typeof a) => {
        const isPriority = isFromPriorityDomain(t.firstFrom) || isFromPriorityDomain(t.lastFrom)
        if (t.lastLabelIds.includes('STARRED')) return 0
        if (isPriority && useLLM && t.llmImportant) return 1
        if (isPriority) return 2
        if (useLLM && t.llmImportant) return 3
        if (t.lastLabelIds.includes('IMPORTANT')) return 4
        return 5
      }
      return rank(a) - rank(b)
    })

    res.type('html').send(renderInboxPage({
      gmailEmail: account.google_email,
      threads,
      labelId,
      fromFilter,
      dateFilter,
      q: qRaw,
      useLLM,
      hideNewsletter,
    }))
  } catch (error) {
    res.status(500).send(error instanceof Error ? error.message : 'Failed to load inbox.')
  }
})

router.get('/inbox/:id', requireSession, async (req, res) => {
  const account = getGmailAccountForUser(req.sessionUser!.id)
  if (!account) {
    res.redirect('/')
    return
  }

  const q = typeof req.query.q === 'string' ? req.query.q : ''
  const labelId = typeof req.query.label === 'string' ? req.query.label : 'INBOX'
  try {
    const thread = await getThreadForUser({
      userId: req.sessionUser!.id,
      threadId: String(req.params.id),
    })
    res.type('html').send(renderThreadDetailPage({
      gmailEmail: account.google_email,
      thread,
      q,
      labelId,
    }))
  } catch (error) {
    res.status(500).send(error instanceof Error ? error.message : 'Failed to load thread.')
  }
})

export default router
