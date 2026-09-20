import express from 'express';
import rateLimit from 'express-rate-limit';
import { query, queryOne, execute, transaction } from '../config/db.js';
import { config } from '../config/env.js';
import { authenticate, requirePermission, optionalAuth } from '../middleware/auth.js';
import { createCrudRouter } from '../services/crudFactory.js';
import { notifyByPermission } from '../services/notifications.js';
import { logActivity } from '../services/activityLog.js';
import { ApiError, asyncHandler, randomToken, generateReference, parseJsonFields } from '../utils/helpers.js';

/**
 * AI business systems.
 *
 * Two principles from the blueprint drive this design:
 *  1. The assistant answers only from an approved knowledge base. If it
 *     cannot ground an answer, it says so and offers a human. That is the
 *     stated control against hallucination.
 *  2. The provider is swappable. Everything vendor-specific lives in
 *     callProvider(), so switching model or vendor touches one function.
 */
const router = express.Router();

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'You are sending messages too quickly. Please slow down.' },
});

// ------------------------------------------------- KNOWLEDGE RETRIEVAL
/**
 * Fetch the knowledge items most relevant to a question.
 * Uses MySQL full-text search in natural language mode, which is adequate
 * for a curated base of a few hundred items and needs no vector service.
 */
async function retrieveKnowledge(assistantId, question, limit = 6) {
  const cleaned = String(question).replace(/[+\-><()~*"@]/g, ' ').trim();
  if (!cleaned) return [];

  let rows = [];
  try {
    rows = await query(
      `SELECT id, title, content, source_type, priority,
              MATCH(title, content) AGAINST(? IN NATURAL LANGUAGE MODE) AS relevance
         FROM ai_knowledge_items
        WHERE assistant_id = ? AND is_active = 1 AND deleted_at IS NULL
          AND MATCH(title, content) AGAINST(? IN NATURAL LANGUAGE MODE)
        ORDER BY priority DESC, relevance DESC
        LIMIT ?`,
      [cleaned, assistantId, cleaned, limit]
    );
  } catch {
    rows = [];
  }

  // Fall back to keyword LIKE if full-text found nothing useful.
  if (rows.length === 0) {
    const words = cleaned.split(/\s+/).filter((w) => w.length > 3).slice(0, 5);
    if (words.length) {
      const likeClause = words.map(() => '(title LIKE ? OR content LIKE ?)').join(' OR ');
      const params = [assistantId];
      words.forEach((w) => params.push(`%${w}%`, `%${w}%`));
      rows = await query(
        `SELECT id, title, content, source_type, priority
           FROM ai_knowledge_items
          WHERE assistant_id = ? AND is_active = 1 AND deleted_at IS NULL AND (${likeClause})
          ORDER BY priority DESC LIMIT ${limit}`,
        params
      );
    }
  }
  return rows;
}

/**
 * Call the configured model provider. Anthropic's Messages API is the
 * default; the shape is isolated here so another vendor is a small change.
 */
async function callProvider({ systemPrompt, messages, model, temperature, maxTokens }) {
  if (!config.ai.apiKey) {
    throw new ApiError(503, 'The AI service is not configured. Add AI_API_KEY to the server environment.');
  }

  const started = Date.now();
  const response = await fetch(config.ai.apiUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.ai.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || config.ai.model,
      max_tokens: maxTokens || 1024,
      temperature: temperature ?? 0.3,
      system: systemPrompt,
      messages,
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ApiError(502, `The AI provider returned an error (${response.status})`, detail.slice(0, 400));
  }

  const json = await response.json();
  const text = json.content?.map((c) => c.text).filter(Boolean).join('\n') ?? '';
  return {
    text,
    tokens: (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0),
    latencyMs: Date.now() - started,
  };
}

function buildSystemPrompt(assistant, knowledge) {
  const base = assistant.system_prompt?.trim() || `You are the customer assistant for ${assistant.name}.`;

  const sources = knowledge.length
    ? knowledge.map((k, i) => `[${i + 1}] ${k.title}\n${k.content}`).join('\n\n')
    : '(no matching information found in the knowledge base)';

  return `${base}

You answer using ONLY the approved information below. These are the rules you must follow:

1. If the approved information does not cover the question, say plainly that you do not have that detail and offer to connect the person with the team. Never guess, never invent prices, dates, capabilities or policies.
2. Keep answers short and practical — two or three sentences unless asked for more.
3. Prices are in Tanzanian shillings unless stated otherwise. Never quote a price that does not appear below.
4. If someone asks to speak to a person, is making a complaint, or is discussing a large or complex project, tell them you are passing this to the team.
5. Write the way a helpful Tanzanian colleague would: warm, direct, no marketing language.

APPROVED INFORMATION
====================
${sources}`;
}

// ----------------------------------------------- ASSISTANT MANAGEMENT
router.use('/assistants', createCrudRouter({
  table: 'ai_assistants',
  module: 'ai',
  fields: ['organisation_id', 'subscription_id', 'name', 'slug', 'description', 'avatar_media_id',
    'greeting', 'system_prompt', 'provider', 'model', 'temperature', 'max_tokens', 'channels',
    'fallback_message', 'escalation_email', 'escalation_phone', 'handoff_keywords',
    'capture_leads', 'require_kb_grounding', 'theme_color', 'widget_position', 'is_active',
    'monthly_message_limit'],
  searchable: ['name', 'description'],
  filterable: ['is_active', 'organisation_id', 'provider'],
  sortable: ['id', 'name', 'created_at', 'messages_this_month'],
  jsonFields: ['channels', 'handoff_keywords'],
  slugFrom: 'name',
  defaultSort: 'created_at',
  listSelect: `SELECT ai_assistants.*, o.name AS organisation_name,
                      (SELECT COUNT(*) FROM ai_knowledge_items k WHERE k.assistant_id = ai_assistants.id AND k.deleted_at IS NULL) AS knowledge_count,
                      (SELECT COUNT(*) FROM ai_conversations c WHERE c.assistant_id = ai_assistants.id) AS conversation_count
                 FROM ai_assistants LEFT JOIN organisations o ON o.id = ai_assistants.organisation_id`,
}));

router.use('/knowledge', createCrudRouter({
  table: 'ai_knowledge_items',
  module: 'ai',
  fields: ['assistant_id', 'title', 'content', 'source_type', 'source_ref', 'media_id',
    'tags', 'is_active', 'priority'],
  searchable: ['title', 'content'],
  filterable: ['assistant_id', 'source_type', 'is_active'],
  sortable: ['id', 'title', 'priority', 'created_at'],
  jsonFields: ['tags'],
  labelField: 'title',
  defaultSort: 'priority',
  beforeCreate: async (data, req) => ({ ...data, created_by: req.user.id }),
}));

/** Populate a knowledge base from existing site content. */
router.post('/assistants/:id/sync-knowledge', authenticate, requirePermission('ai.update'), asyncHandler(async (req, res) => {
  const assistant = await queryOne('SELECT * FROM ai_assistants WHERE id = ?', [req.params.id]);
  if (!assistant) throw ApiError.notFound('Assistant not found');

  const sources = req.body.sources || ['faqs', 'services', 'packages'];
  let imported = 0;

  await transaction(async (tx) => {
    if (sources.includes('faqs')) {
      const faqs = await tx.query('SELECT * FROM faqs WHERE is_published = 1 AND use_in_ai_kb = 1');
      for (const faq of faqs) {
        await tx.execute(
          `INSERT INTO ai_knowledge_items (assistant_id, title, content, source_type, source_ref, priority, created_by)
           VALUES (?,?,?,'faq',?,10,?)
           ON DUPLICATE KEY UPDATE content = VALUES(content)`,
          [assistant.id, faq.question, faq.answer, `faq:${faq.id}`, req.user.id]
        );
        imported += 1;
      }
    }

    if (sources.includes('services')) {
      const services = await tx.query(
        `SELECT s.*, d.name AS division_name FROM services s
           JOIN divisions d ON d.id = s.division_id
          WHERE s.status = 'published' AND s.deleted_at IS NULL`
      );
      for (const s of services) {
        const deliverables = (() => {
          try { return JSON.parse(s.deliverables || '[]'); } catch { return []; }
        })();
        const priceLine = s.base_price_cents > 0
          ? `Indicative price: TZS ${(Number(s.base_price_cents) / 100).toLocaleString()}${s.pricing_model === 'from' ? ' (starting from)' : ''}${s.recurring_interval !== 'none' ? ` per ${s.recurring_interval.replace('ly', '')}` : ''}.`
          : 'Priced on application after a scoping conversation.';

        const content = [
          `Division: ${s.division_name}.`,
          s.short_description,
          s.description,
          priceLine,
          deliverables.length ? `What is included: ${deliverables.join('; ')}.` : '',
          s.turnaround_days ? `Typical turnaround: ${s.turnaround_days} days.` : '',
          s.revision_limit ? `Includes ${s.revision_limit} rounds of revision.` : '',
        ].filter(Boolean).join('\n');

        await tx.execute(
          `INSERT INTO ai_knowledge_items (assistant_id, title, content, source_type, source_ref, priority, created_by)
           VALUES (?,?,?,'service',?,8,?)
           ON DUPLICATE KEY UPDATE content = VALUES(content)`,
          [assistant.id, s.name, content, `service:${s.id}`, req.user.id]
        );
        imported += 1;
      }
    }

    if (sources.includes('packages')) {
      const packages = await tx.query("SELECT * FROM packages WHERE status='published' AND deleted_at IS NULL");
      for (const p of packages) {
        const features = (() => {
          try { return JSON.parse(p.features || '[]'); } catch { return []; }
        })();
        const included = features.filter((f) => f.included).map((f) => f.label);
        const content = [
          p.tagline, p.description,
          p.price_cents > 0 ? `Price: TZS ${(Number(p.price_cents) / 100).toLocaleString()} ${p.billing_interval === 'once' ? 'one-off' : `per ${p.billing_interval.replace('ly', '')}`}.` : 'Priced per scope.',
          p.capacity_note ? `Capacity: ${p.capacity_note}.` : '',
          included.length ? `Includes: ${included.join('; ')}.` : '',
        ].filter(Boolean).join('\n');

        await tx.execute(
          `INSERT INTO ai_knowledge_items (assistant_id, title, content, source_type, source_ref, priority, created_by)
           VALUES (?,?,?,'service',?,9,?)
           ON DUPLICATE KEY UPDATE content = VALUES(content)`,
          [assistant.id, `Package: ${p.name}`, content, `package:${p.id}`, req.user.id]
        );
        imported += 1;
      }
    }
  });

  await logActivity(req, 'synced_knowledge', 'ai_assistants', assistant.id, assistant.name, { imported });
  res.json({ message: `${imported} knowledge item(s) synced`, data: { imported } });
}));

// ------------------------------------------------------------ PUBLIC CHAT
/** Start a conversation. No auth — this runs on the public site widget. */
router.post('/chat/start', chatLimiter, optionalAuth, asyncHandler(async (req, res) => {
  const assistant = await queryOne(
    'SELECT * FROM ai_assistants WHERE slug = ? AND is_active = 1 AND deleted_at IS NULL',
    [req.body.assistant_slug || 'creative-engine-assistant']
  );
  if (!assistant) throw ApiError.notFound('Assistant not available');

  const token = randomToken(24);
  await execute(
    `INSERT INTO ai_conversations
       (assistant_id, session_token, channel, visitor_name, visitor_email, visitor_phone,
        user_id, ip_address, user_agent)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      assistant.id, token, req.body.channel || 'website',
      req.body.visitor_name || null, req.body.visitor_email || null, req.body.visitor_phone || null,
      req.user?.id || null, req.ip?.slice(0, 45) ?? null,
      req.headers['user-agent']?.slice(0, 255) ?? null,
    ]
  );

  res.status(201).json({
    data: {
      session_token: token,
      greeting: assistant.greeting || `Hello. I am the ${assistant.name}. How can I help you today?`,
      assistant_name: assistant.name,
      theme_color: assistant.theme_color,
    },
  });
}));

router.post('/chat/message', chatLimiter, asyncHandler(async (req, res) => {
  const { session_token, message } = req.body;
  if (!session_token || !message?.trim()) {
    throw ApiError.badRequest('A session token and message are required');
  }

  const conversation = await queryOne(
    `SELECT c.*, a.* , c.id AS conversation_id, a.id AS assistant_id
       FROM ai_conversations c JOIN ai_assistants a ON a.id = c.assistant_id
      WHERE c.session_token = ? AND c.ended_at IS NULL`,
    [session_token]
  );
  if (!conversation) throw ApiError.notFound('Conversation not found or has ended');

  const assistant = parseJsonFields(conversation, ['channels', 'handoff_keywords']);

  if (assistant.monthly_message_limit
      && assistant.messages_this_month >= assistant.monthly_message_limit) {
    throw new ApiError(429, 'This assistant has reached its monthly message allowance.');
  }

  await execute(
    "INSERT INTO ai_messages (conversation_id, role, content) VALUES (?, 'user', ?)",
    [conversation.conversation_id, message.trim()]
  );

  // Explicit handoff request beats any model response.
  const handoffWords = Array.isArray(assistant.handoff_keywords)
    ? assistant.handoff_keywords
    : ['speak to someone', 'talk to a person', 'human', 'complaint', 'manager', 'call me'];
  const wantsHuman = handoffWords.some((w) => message.toLowerCase().includes(String(w).toLowerCase()));

  if (wantsHuman) {
    const reply = assistant.fallback_message
      || 'Of course — I am passing this to a member of our team, who will come back to you shortly. If it is urgent, you can call us directly.';
    await execute(
      "INSERT INTO ai_messages (conversation_id, role, content, was_fallback) VALUES (?, 'assistant', ?, 1)",
      [conversation.conversation_id, reply]
    );
    await execute(
      'UPDATE ai_conversations SET was_escalated = 1, escalated_at = NOW(), message_count = message_count + 2, last_message_at = NOW() WHERE id = ?',
      [conversation.conversation_id]
    );
    await notifyByPermission('ai.conversations', {
      type: 'ai.escalation',
      title: 'A visitor has asked to speak to a person',
      body: message.slice(0, 160),
      linkUrl: `/admin/ai/conversations/${conversation.conversation_id}`,
      entityType: 'ai_conversations', entityId: conversation.conversation_id, icon: 'phone',
    });
    return res.json({ data: { reply, escalated: true } });
  }

  const knowledge = await retrieveKnowledge(assistant.assistant_id, message);

  // With grounding required and nothing found, do not call the model at all.
  if (assistant.require_kb_grounding && knowledge.length === 0) {
    const reply = assistant.fallback_message
      || 'I do not have that detail to hand. Let me pass you to a colleague who can answer properly — could you share your name and the best number to reach you?';
    await execute(
      "INSERT INTO ai_messages (conversation_id, role, content, was_fallback) VALUES (?, 'assistant', ?, 1)",
      [conversation.conversation_id, reply]
    );
    await execute(
      'UPDATE ai_conversations SET message_count = message_count + 2, last_message_at = NOW() WHERE id = ?',
      [conversation.conversation_id]
    );
    return res.json({ data: { reply, grounded: false } });
  }

  const history = await query(
    `SELECT role, content FROM ai_messages
      WHERE conversation_id = ? AND role IN ('user','assistant')
      ORDER BY id DESC LIMIT 10`,
    [conversation.conversation_id]
  );
  const messages = history.reverse().map((m) => ({ role: m.role, content: m.content }));

  let result;
  try {
    result = await callProvider({
      systemPrompt: buildSystemPrompt(assistant, knowledge),
      messages,
      model: assistant.model,
      temperature: Number(assistant.temperature),
      maxTokens: assistant.max_tokens,
    });
  } catch (err) {
    const reply = assistant.fallback_message
      || 'I am having trouble answering right now. Please leave your contact details and our team will get back to you.';
    await execute(
      "INSERT INTO ai_messages (conversation_id, role, content, was_fallback) VALUES (?, 'assistant', ?, 1)",
      [conversation.conversation_id, reply]
    );
    console.error('[ai] provider call failed:', err.message);
    return res.json({ data: { reply, error: true } });
  }

  await execute(
    `INSERT INTO ai_messages (conversation_id, role, content, tokens_used, latency_ms, kb_items_used)
     VALUES (?, 'assistant', ?, ?, ?, ?)`,
    [
      conversation.conversation_id, result.text, result.tokens, result.latencyMs,
      JSON.stringify(knowledge.map((k) => ({ id: k.id, title: k.title }))),
    ]
  );
  await execute(
    'UPDATE ai_conversations SET message_count = message_count + 2, last_message_at = NOW() WHERE id = ?',
    [conversation.conversation_id]
  );
  await execute(
    'UPDATE ai_assistants SET messages_this_month = messages_this_month + 1 WHERE id = ?',
    [assistant.assistant_id]
  );

  res.json({
    data: {
      reply: result.text,
      grounded: knowledge.length > 0,
      sources: knowledge.map((k) => k.title),
    },
  });
}));

/** Capture a lead from inside the chat. */
router.post('/chat/capture-lead', chatLimiter, asyncHandler(async (req, res) => {
  const { session_token, name, email, phone, message } = req.body;
  const conversation = await queryOne(
    'SELECT * FROM ai_conversations WHERE session_token = ?',
    [session_token]
  );
  if (!conversation) throw ApiError.notFound('Conversation not found');
  if (!name?.trim() || (!email && !phone)) {
    throw ApiError.badRequest('A name and either an email address or phone number are required');
  }

  const lead = await transaction(async (tx) => {
    const reference = await generateReference('lead', tx);
    const result = await tx.execute(
      `INSERT INTO leads (reference, contact_name, email, phone, message, source, source_detail, ip_address)
       VALUES (?,?,?,?,?,'ai_assistant',?,?)`,
      [
        reference, name.trim(), email || null, phone || null,
        message || 'Captured by the AI assistant',
        `conversation:${conversation.id}`, req.ip?.slice(0, 45) ?? null,
      ]
    );
    await tx.execute(
      'UPDATE ai_conversations SET lead_id = ?, visitor_name = ?, visitor_email = ?, visitor_phone = ? WHERE id = ?',
      [result.insertId, name.trim(), email || null, phone || null, conversation.id]
    );
    return { id: result.insertId, reference };
  });

  await notifyByPermission('leads.view', {
    type: 'lead.ai_captured',
    title: `AI assistant captured a lead: ${name}`,
    body: message?.slice(0, 160) || '',
    linkUrl: `/admin/leads/${lead.id}`,
    entityType: 'leads', entityId: lead.id, icon: 'user-plus',
  });

  res.status(201).json({
    message: 'Thank you. Someone from our team will be in touch shortly.',
    data: { reference: lead.reference },
  });
}));

router.get('/chat/history/:token', asyncHandler(async (req, res) => {
  const conversation = await queryOne(
    'SELECT id FROM ai_conversations WHERE session_token = ?',
    [req.params.token]
  );
  if (!conversation) throw ApiError.notFound('Conversation not found');
  const messages = await query(
    "SELECT role, content, created_at FROM ai_messages WHERE conversation_id = ? AND role != 'system' ORDER BY id",
    [conversation.id]
  );
  res.json({ data: messages });
}));

// --------------------------------------------------- CONVERSATION REVIEW
router.get('/conversations', authenticate, requirePermission('ai.conversations'), asyncHandler(async (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 30);
  const where = [];
  const params = [];
  if (req.query.assistant_id) { where.push('c.assistant_id = ?'); params.push(req.query.assistant_id); }
  if (req.query.escalated === 'true') where.push('c.was_escalated = 1');
  if (req.query.with_lead === 'true') where.push('c.lead_id IS NOT NULL');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await query(
    `SELECT c.*, a.name AS assistant_name, l.reference AS lead_reference
       FROM ai_conversations c
       JOIN ai_assistants a ON a.id = c.assistant_id
  LEFT JOIN leads l ON l.id = c.lead_id
       ${whereSql} ORDER BY c.started_at DESC LIMIT ${limit}`,
    params
  );
  res.json({ data: rows });
}));

router.get('/conversations/:id', authenticate, requirePermission('ai.conversations'), asyncHandler(async (req, res) => {
  const conversation = await queryOne(
    `SELECT c.*, a.name AS assistant_name FROM ai_conversations c
       JOIN ai_assistants a ON a.id = c.assistant_id WHERE c.id = ?`,
    [req.params.id]
  );
  if (!conversation) throw ApiError.notFound('Conversation not found');
  const messages = await query(
    'SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY id',
    [req.params.id]
  );
  res.json({
    data: { ...conversation, messages: messages.map((m) => parseJsonFields(m, ['kb_items_used'])) },
  });
}));

/** What visitors actually ask — the most useful output of the whole pillar. */
router.get('/insights', authenticate, requirePermission('ai.view'), asyncHandler(async (req, res) => {
  const days = Math.min(365, parseInt(req.query.days, 10) || 30);
  const [summary, unanswered, topSources] = await Promise.all([
    queryOne(
      `SELECT COUNT(*) AS conversations,
              COALESCE(SUM(message_count),0) AS messages,
              SUM(was_escalated) AS escalations,
              SUM(lead_id IS NOT NULL) AS leads_captured,
              ROUND(AVG(satisfaction),2) AS avg_satisfaction
         FROM ai_conversations WHERE started_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [days]
    ),
    query(
      `SELECT m.content, m.created_at, c.id AS conversation_id
         FROM ai_messages m JOIN ai_conversations c ON c.id = m.conversation_id
        WHERE m.was_fallback = 1 AND m.role = 'assistant'
          AND m.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        ORDER BY m.created_at DESC LIMIT 25`,
      [days]
    ),
    query(
      `SELECT k.title, COUNT(*) AS times_used
         FROM ai_messages m
         JOIN ai_knowledge_items k ON JSON_CONTAINS(m.kb_items_used, JSON_OBJECT('id', k.id))
        WHERE m.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY k.id ORDER BY times_used DESC LIMIT 15`,
      [days]
    ).catch(() => []),
  ]);

  res.json({ data: { summary, unanswered_questions: unanswered, most_used_knowledge: topSources } });
}));

export default router;
