import { useState, useEffect, useCallback } from 'react';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { number, timeAgo, dateTime, humanise, truncate } from '../../utils/format';
import {
  Card, Button, Tabs, Badge, Spinner, Empty, Modal, Field,
  Input, Textarea, Select, DataTable, StatTile, Alert,
} from '../../components/UI';
import ResourceManager from '../../components/ResourceManager';

export default function AiAssistants() {
  const [tab, setTab] = useState('assistants');
  const [assistants, setAssistants] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [syncing, setSyncing] = useState(null);
  const { toast } = useApp();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'conversations') {
        const res = await api.get('/ai/conversations?limit=50');
        setConversations(res.data || []);
      } else if (tab === 'insights') {
        const res = await api.get('/ai/insights?days=30');
        setInsights(res.data);
      } else {
        const res = await api.get('/ai/assistants?limit=50');
        setAssistants(res.data || []);
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, toast]);

  useEffect(() => { load(); }, [load]);

  const syncKnowledge = async (assistant) => {
    setSyncing(assistant.id);
    try {
      const res = await api.post(`/ai/assistants/${assistant.id}/sync-knowledge`, {
        sources: ['faqs', 'services', 'packages'],
      });
      toast(res.message, 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSyncing(null);
    }
  };

  const openConversation = async (row) => {
    try {
      const res = await api.get(`/ai/conversations/${row.id}`);
      setViewing(res.data);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const TABS = [
    { key: 'assistants', label: 'Assistants' },
    { key: 'knowledge', label: 'Knowledge base' },
    { key: 'conversations', label: 'Conversations' },
    { key: 'insights', label: 'Insights' },
  ];

  return (
    <div className="stack-lg">
      <div>
        <h2>AI business systems</h2>
        <p className="muted small">
          Assistants answer only from knowledge you approve, and hand over to a person
          when they are unsure. Every conversation is logged.
        </p>
      </div>

      <Alert tone="info" title="How this is designed to work">
        The assistant will not invent prices, dates or policies. If the approved knowledge
        base does not cover a question, it says so and offers a human instead — that is the
        single most important guardrail against an assistant embarrassing you in front of a client.
      </Alert>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'assistants' && (
        loading ? <Spinner center /> : (
          <>
            <div className="grid grid-2">
              {assistants.map((assistant) => (
                <Card key={assistant.id} pad>
                  <div className="row-between" style={{ marginBottom: 'var(--s4)' }}>
                    <div>
                      <div className="row" style={{ gap: 'var(--s2)' }}>
                        <h4 style={{ fontSize: 'var(--text-lg)' }}>{assistant.name}</h4>
                        <Badge tone={assistant.is_active ? 'success' : 'neutral'}>
                          {assistant.is_active ? 'Live' : 'Off'}
                        </Badge>
                      </div>
                      <div className="tiny muted">
                        {assistant.organisation_name || 'Our own website'} · {assistant.model}
                      </div>
                    </div>
                  </div>

                  <p className="small muted">{assistant.description}</p>

                  <div className="row" style={{ gap: 'var(--s6)', marginTop: 'var(--s5)' }}>
                    <div>
                      <div className="tiny muted">Knowledge items</div>
                      <div className="bold">{number(assistant.knowledge_count)}</div>
                    </div>
                    <div>
                      <div className="tiny muted">Conversations</div>
                      <div className="bold">{number(assistant.conversation_count)}</div>
                    </div>
                    <div>
                      <div className="tiny muted">This month</div>
                      <div className="bold">
                        {number(assistant.messages_this_month)}
                        {assistant.monthly_message_limit && ` / ${number(assistant.monthly_message_limit)}`}
                      </div>
                    </div>
                  </div>

                  {Number(assistant.knowledge_count) === 0 && (
                    <Alert tone="warning" title="No knowledge yet">
                      With grounding required and nothing to ground on, this assistant will
                      refer everyone to a human. Sync your FAQs and services first.
                    </Alert>
                  )}

                  <div className="row" style={{ gap: 'var(--s2)', marginTop: 'var(--s5)' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncKnowledge(assistant)}
                      loading={syncing === assistant.id}
                    >
                      Sync knowledge from site
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {assistants.length === 0 && (
              <Empty
                title="No assistants configured"
                description="Create one, add an API key in the server environment, then sync your FAQs and services into its knowledge base."
              />
            )}

            <ResourceManager
              title="Assistants"
              endpoint="/ai/assistants"
              modalSize="lg"
              searchPlaceholder="Search assistants…"
              columns={[
                { key: 'name', label: 'Name', render: (row) => <span className="bold">{row.name}</span> },
                { key: 'model', label: 'Model', render: (row) => <span className="tiny mono">{row.model}</span> },
                {
                  key: 'require_kb_grounding',
                  label: 'Grounded',
                  render: (row) => (
                    <Badge tone={row.require_kb_grounding ? 'success' : 'danger'}>
                      {row.require_kb_grounding ? 'Yes' : 'No — risky'}
                    </Badge>
                  ),
                },
                {
                  key: 'is_active',
                  label: 'Status',
                  render: (row) => (
                    <Badge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Live' : 'Off'}</Badge>
                  ),
                },
              ]}
              fields={[
                { name: 'name', label: 'Assistant name', required: true },
                { name: 'description', label: 'What it is for', type: 'textarea', rows: 2 },
                { name: 'greeting', label: 'Opening message', type: 'textarea', rows: 2 },
                {
                  name: 'system_prompt',
                  label: 'Role instructions',
                  type: 'textarea',
                  rows: 5,
                  hint: 'Who the assistant is. The grounding rules are added automatically.',
                },
                {
                  name: 'model',
                  label: 'Model',
                  type: 'select',
                  default: 'claude-sonnet-5',
                  options: [
                    { value: 'claude-sonnet-5', label: 'Claude Sonnet 5 — balanced' },
                    { value: 'claude-opus-5', label: 'Claude Opus 5 — most capable' },
                    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — fastest' },
                  ],
                },
                {
                  name: 'temperature',
                  label: 'Temperature',
                  type: 'number',
                  default: 0.3,
                  hint: 'Lower is more predictable. Keep it low for a customer assistant.',
                },
                { name: 'max_tokens', label: 'Max response length', type: 'number', default: 1024 },
                {
                  name: 'require_kb_grounding',
                  label: 'Only answer from approved knowledge',
                  type: 'checkbox',
                  default: 1,
                  hint: 'Strongly recommended. Turning this off allows invented answers.',
                },
                {
                  name: 'fallback_message',
                  label: 'What it says when it does not know',
                  type: 'textarea',
                  rows: 2,
                },
                {
                  name: 'handoff_keywords',
                  label: 'Phrases that force a human handover',
                  type: 'json',
                  placeholder: '["speak to someone","complaint","manager"]',
                },
                { name: 'capture_leads', label: 'Capture contact details', type: 'checkbox', default: 1 },
                { name: 'escalation_email', label: 'Escalation email', type: 'email' },
                { name: 'theme_color', label: 'Widget colour', placeholder: '#f74932' },
                { name: 'monthly_message_limit', label: 'Monthly message allowance', type: 'number' },
                { name: 'is_active', label: 'Live on the site', type: 'checkbox' },
              ]}
            />
          </>
        )
      )}

      {tab === 'knowledge' && (
        <ResourceManager
          title="Knowledge items"
          description="What the assistant is allowed to say. Nothing outside this is used."
          endpoint="/ai/knowledge"
          modalSize="lg"
          searchPlaceholder="Search knowledge…"
          defaultSort="priority:desc"
          filters={[
            {
              name: 'source_type',
              label: 'All sources',
              options: ['manual', 'faq', 'service', 'page', 'document', 'url']
                .map((s) => ({ value: s, label: humanise(s) })),
            },
          ]}
          columns={[
            {
              key: 'title',
              label: 'Item',
              render: (row) => (
                <div style={{ minWidth: 0 }}>
                  <div className="bold truncate">{row.title}</div>
                  <div className="tiny muted truncate">{truncate(row.content, 90)}</div>
                </div>
              ),
            },
            { key: 'source_type', label: 'Source', render: (row) => <span className="tiny">{humanise(row.source_type)}</span> },
            { key: 'priority', label: 'Priority', align: 'right' },
            {
              key: 'is_active',
              label: 'Active',
              render: (row) => <Badge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Yes' : 'No'}</Badge>,
            },
          ]}
          fields={[
            { name: 'assistant_id', label: 'Assistant ID', type: 'number', required: true },
            { name: 'title', label: 'Title', required: true },
            { name: 'content', label: 'Content', type: 'textarea', rows: 8, required: true },
            {
              name: 'priority',
              label: 'Priority',
              type: 'number',
              default: 0,
              hint: 'Higher priority items are preferred when several match',
            },
            { name: 'is_active', label: 'Active', type: 'checkbox', default: 1 },
          ]}
        />
      )}

      {tab === 'conversations' && (
        <Card>
          <div className="card-header"><h4>Recent conversations</h4></div>
          <DataTable
            loading={loading}
            rows={conversations}
            onRowClick={openConversation}
            empty={<Empty title="No conversations yet" description="They appear here as soon as visitors start chatting." />}
            columns={[
              {
                key: 'visitor_name',
                label: 'Visitor',
                render: (row) => (
                  <div style={{ minWidth: 0 }}>
                    <div className="bold truncate">{row.visitor_name || 'Anonymous'}</div>
                    <div className="tiny muted truncate">{row.visitor_email || row.visitor_phone || '—'}</div>
                  </div>
                ),
              },
              { key: 'assistant_name', label: 'Assistant', render: (row) => <span className="small">{row.assistant_name}</span> },
              { key: 'channel', label: 'Channel', render: (row) => <span className="tiny">{humanise(row.channel)}</span> },
              { key: 'message_count', label: 'Messages', align: 'right' },
              {
                key: 'lead_reference',
                label: 'Lead',
                render: (row) => (row.lead_reference
                  ? <span className="badge badge-success">{row.lead_reference}</span>
                  : <span className="muted tiny">—</span>),
              },
              {
                key: 'was_escalated',
                label: 'Escalated',
                render: (row) => (row.was_escalated
                  ? <span className="badge badge-warning">Yes</span>
                  : <span className="muted tiny">No</span>),
              },
              { key: 'started_at', label: 'When', render: (row) => <span className="tiny muted">{timeAgo(row.started_at)}</span> },
            ]}
          />
        </Card>
      )}

      {tab === 'insights' && (
        loading ? <Spinner center /> : insights ? (
          <div className="stack-lg">
            <div className="grid grid-4">
              <StatTile label="Conversations" value={number(insights.summary?.conversations || 0)} sub="Last 30 days" />
              <StatTile label="Leads captured" value={number(insights.summary?.leads_captured || 0)} tone="success" />
              <StatTile label="Escalations" value={number(insights.summary?.escalations || 0)} sub="Handed to a person" />
              <StatTile
                label="Satisfaction"
                value={insights.summary?.avg_satisfaction ? `${insights.summary.avg_satisfaction}/5` : '—'}
              />
            </div>

            <Card>
              <div className="card-header">
                <div>
                  <h4>Questions it could not answer</h4>
                  <span className="tiny muted">
                    This is the most valuable list here — each one is a gap in your knowledge base
                  </span>
                </div>
              </div>
              <div className="card-body">
                {insights.unanswered_questions?.length ? (
                  <div className="stack" style={{ gap: 'var(--s3)' }}>
                    {insights.unanswered_questions.map((item, i) => (
                      <div key={i} className="card card-pad" style={{ background: 'var(--warning-bg)', border: 'none' }}>
                        <div className="small">{item.content}</div>
                        <div className="tiny muted" style={{ marginTop: 4 }}>{timeAgo(item.created_at)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="small muted">
                    Nothing went unanswered in this period. Either the knowledge base is good,
                    or nobody has asked anything difficult yet.
                  </p>
                )}
              </div>
            </Card>

            {insights.most_used_knowledge?.length > 0 && (
              <Card>
                <div className="card-header"><h4>Most used knowledge</h4></div>
                <DataTable
                  rows={insights.most_used_knowledge}
                  columns={[
                    { key: 'title', label: 'Knowledge item', render: (row) => <span className="small">{row.title}</span> },
                    { key: 'times_used', label: 'Times used', align: 'right' },
                  ]}
                />
              </Card>
            )}
          </div>
        ) : <Empty title="No data yet" />
      )}

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Conversation transcript"
        size="lg"
        footer={<Button variant="outline" onClick={() => setViewing(null)}>Close</Button>}
      >
        {viewing && (
          <>
            <div className="row row-wrap" style={{ gap: 'var(--s5)', marginBottom: 'var(--s5)' }}>
              <div>
                <div className="tiny muted">Visitor</div>
                <div className="small bold">{viewing.visitor_name || 'Anonymous'}</div>
              </div>
              <div>
                <div className="tiny muted">Started</div>
                <div className="small">{dateTime(viewing.started_at)}</div>
              </div>
              <div>
                <div className="tiny muted">Channel</div>
                <div className="small">{humanise(viewing.channel)}</div>
              </div>
            </div>

            <div className="stack" style={{ gap: 'var(--s3)' }}>
              {viewing.messages?.filter((m) => m.role !== 'system').map((message) => (
                <div
                  key={message.id}
                  style={{
                    display: 'flex',
                    justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div style={{
                    maxWidth: '78%',
                    padding: 'var(--s3) var(--s4)',
                    borderRadius: 'var(--radius)',
                    background: message.role === 'user' ? 'var(--orange-500)' : 'var(--ink-100)',
                    color: message.role === 'user' ? 'white' : 'var(--ink-800)',
                    fontSize: 'var(--text-sm)',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {message.content}
                    {message.was_fallback === 1 && (
                      <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>
                        Fallback — no grounded answer was available
                      </div>
                    )}
                    {message.kb_items_used?.length > 0 && (
                      <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>
                        Sources: {message.kb_items_used.map((k) => k.title).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
