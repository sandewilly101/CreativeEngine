import { useState, useRef, useEffect } from 'react';
import { api } from '../utils/api';
import { useApp } from '../context/AppContext';

/**
 * The AI assistant widget on the public site.
 *
 * It stays hidden until the assistant is switched on and configured, so an
 * unconfigured install never shows a chat bubble that cannot answer anything.
 */
export default function ChatWidget() {
  const { slot } = useApp();
  const avatar = slot('ai-avatar');
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState(false);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [lead, setLead] = useState({ name: '', email: '', phone: '' });
  const scrollRef = useRef(null);

  // Probe once: start a session and see whether an assistant answers.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.post('/ai/chat/start', { channel: 'website' });
        if (cancelled) return;
        setSession(res.data);
        setMessages([{ role: 'assistant', content: res.data.greeting }]);
        setAvailable(true);
      } catch {
        setAvailable(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, showLeadForm]);

  const send = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending || !session) return;

    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    setSending(true);

    try {
      const res = await api.post('/ai/chat/message', {
        session_token: session.session_token,
        message: text,
      });
      setMessages((m) => [...m, { role: 'assistant', content: res.data.reply }]);
      // Offer the handoff form when the assistant could not answer.
      if (res.data.escalated || res.data.grounded === false) setShowLeadForm(true);
    } catch (err) {
      setMessages((m) => [...m, {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again, or use the contact form.',
      }]);
    } finally {
      setSending(false);
    }
  };

  const submitLead = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/ai/chat/capture-lead', {
        session_token: session.session_token,
        ...lead,
        message: messages.filter((m) => m.role === 'user').map((m) => m.content).join(' | '),
      });
      setShowLeadForm(false);
      setMessages((m) => [...m, { role: 'assistant', content: res.message }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: err.message }]);
    }
  };

  if (!available) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open chat"
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 150,
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--flame)', color: 'white',
            border: 'none', cursor: 'pointer',
            boxShadow: 'var(--shadow-lg)',
            fontSize: 22,
            display: 'grid', placeItems: 'center',
          }}
        >
          ◔
        </button>
      )}

      {open && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 150,
          width: 'min(380px, calc(100vw - 32px))',
          height: 'min(560px, calc(100vh - 48px))',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}>
          <div style={{
            padding: 'var(--s4) var(--s5)',
            background: 'var(--ink)', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
              {avatar && (
                <img
                  src={avatar}
                  alt=""
                  width={36}
                  height={36}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    objectFit: 'cover', background: 'rgba(255,255,255,.08)', flex: 'none',
                  }}
                />
              )}
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.95rem' }}>
                  {session?.assistant_name || 'Assistant'}
                </div>
                <div className="tiny" style={{ opacity: 0.7 }}>Usually replies instantly</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: 'white', fontSize: 18, cursor: 'pointer', opacity: 0.8 }}
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 'var(--s4)' }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: 'var(--s3)',
                }}
              >
                <div style={{
                  maxWidth: '82%',
                  padding: '0.6rem 0.85rem',
                  borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.role === 'user' ? 'var(--flame)' : 'var(--ink-100)',
                  color: m.role === 'user' ? 'white' : 'var(--ink-800)',
                  fontSize: 'var(--text-sm)',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {sending && (
              <div style={{ display: 'flex', gap: 4, padding: '0.6rem 0.85rem' }}>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--ink-400)',
                      animation: `bounce 1.2s ${i * 0.15}s infinite`,
                    }}
                  />
                ))}
              </div>
            )}

            {showLeadForm && (
              <form onSubmit={submitLead} style={{
                background: 'var(--ink-50)', padding: 'var(--s4)',
                borderRadius: 'var(--radius)', marginTop: 'var(--s3)',
                border: '1px solid var(--border)',
              }}>
                <div className="small bold" style={{ marginBottom: 'var(--s3)' }}>
                  Leave your details and our team will come back to you
                </div>
                <input
                  className="input" placeholder="Your name" required
                  value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })}
                  style={{ marginBottom: 'var(--s2)' }}
                />
                <input
                  className="input" type="email" placeholder="Email address"
                  value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })}
                  style={{ marginBottom: 'var(--s2)' }}
                />
                <input
                  className="input" placeholder="Phone (+255…)"
                  value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })}
                  style={{ marginBottom: 'var(--s3)' }}
                />
                <div className="row" style={{ gap: 'var(--s2)' }}>
                  <button type="submit" className="btn btn-sm">Send</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowLeadForm(false)}>
                    Not now
                  </button>
                </div>
              </form>
            )}
          </div>

          <form onSubmit={send} style={{
            padding: 'var(--s3)', borderTop: '1px solid var(--border)',
            display: 'flex', gap: 'var(--s2)',
          }}>
            <input
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              disabled={sending}
            />
            <button type="submit" className="btn" disabled={sending || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </>
  );
}
