import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { date } from '../../utils/format';
import { Spinner, Empty } from '../../components/UI';
import { Reveal, Eyebrow, ArrowRight, Odometer } from '../../components/Motion';
import PageHero from '../../components/PageHero';

export default function WorkDetail() {
  const { slug } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/public/work/${slug}`)
      .then((res) => setItem(res.data))
      .catch(() => setItem(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <Spinner center />;
  if (!item) {
    return (
      <div className="container section" style={{ paddingTop: 'calc(var(--header-h) + 80px)' }}>
        <Empty
          title="Case study not found"
          action={<Link to="/work" className="btn"><span>All work</span></Link>}
        />
      </div>
    );
  }

  const accent = item.division_color || 'var(--flame)';
  const sections = [
    ['The challenge', item.challenge],
    ['Our approach', item.approach],
    ['The result', item.result],
  ].filter(([, body]) => body);

  return (
    <>
      <PageHero
        back={{ to: '/work', label: 'All work' }}
        eyebrow={item.division_name}
        title={item.title}
        lead={item.summary}
        accent={accent}
        meta={
          <>
            {item.client_name && <span>Client: <strong>{item.client_name}</strong></span>}
            {item.location && <span>Location: <strong>{item.location}</strong></span>}
            {item.project_date && <span><strong>{date(item.project_date)}</strong></span>}
          </>
        }
      />

      {item.cover_url && (
        <div className="wd-cover">
          <img src={item.cover_url} alt={item.title} />
        </div>
      )}

      <section className="section">
        <div className="container">
          {item.metrics?.length > 0 && (
            <Reveal className="wd-metrics" stagger={110}>
              {item.metrics.map((metric, i) => (
                <div key={i} className="wd-metric">
                  <Odometer value={String(metric.value)} />
                  <span>{metric.label}</span>
                </div>
              ))}
            </Reveal>
          )}

          <div className="wd-body">
            {sections.map(([heading, body], i) => (
              <Reveal key={heading} className="wd-section" stagger={60}>
                <div className="wd-section__label">
                  <span className="wd-section__n" style={{ background: accent }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h2 className="h2">{heading}</h2>
                </div>
                <p>{body}</p>
              </Reveal>
            ))}
          </div>

          {item.gallery_media?.length > 0 && (
            <Reveal className="wd-gallery" stagger={90}>
              {item.gallery_media.map((media) => (
                <div key={media.id} className="media media--4x3">
                  <img src={media.public_url} alt={media.alt_text || ''} loading="lazy" />
                </div>
              ))}
            </Reveal>
          )}

          {item.testimonial && (
            <Reveal className="wd-quote" stagger={70}>
              <blockquote>"{item.testimonial.quote}"</blockquote>
              <footer>
                <strong>{item.testimonial.author_name}</strong>
                <span>
                  {[item.testimonial.author_title, item.testimonial.company]
                    .filter(Boolean).join(', ')}
                </span>
              </footer>
            </Reveal>
          )}

          <Reveal className="wd-cta" stagger={80}>
            <div>
              <Eyebrow>Next step</Eyebrow>
              <h2 className="h2" style={{ marginTop: 14 }}>Have a project like this?</h2>
            </div>
            <Link to="/contact" className="btn btn-lg">
              <span>Start a conversation</span><ArrowRight />
            </Link>
          </Reveal>
        </div>
      </section>

      <style>{`
        .wd-cover { max-height: 560px; overflow: clip; }
        .wd-cover img { width: 100%; object-fit: cover; }

        .wd-metrics {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 28px;
          padding-bottom: clamp(40px, 5vw, 64px);
          border-bottom: 1px solid var(--line);
        }
        .wd-metric { display: flex; flex-direction: column; gap: 6px; }
        .wd-metric .odo { font-size: clamp(34px, 4vw, 48px); }
        .wd-metric span { font-size: 14px; color: var(--muted); max-width: 20ch; line-height: 1.4; }

        .wd-body { max-width: 760px; margin: 0 auto; }
        .wd-section { margin-top: clamp(44px, 5vw, 72px); }
        .wd-section__label { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
        .wd-section__n {
          width: 34px; height: 34px; flex: none;
          display: grid; place-items: center; border-radius: 50%;
          font-family: var(--display); font-size: 12px; font-weight: 700;
          color: #fff;
        }
        .wd-section p {
          font-size: clamp(16px, 1.4vw, 18px); line-height: 1.8;
          color: var(--ink-2); white-space: pre-wrap;
        }

        .wd-gallery {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 18px; margin-top: clamp(48px, 6vw, 80px);
        }

        .wd-quote {
          margin-top: clamp(48px, 6vw, 80px);
          padding: clamp(36px, 5vw, 60px);
          background: var(--ink); color: #fff;
          border-radius: var(--r-lg);
          max-width: 860px; margin-inline: auto;
        }
        .wd-quote blockquote {
          margin: 0; font-family: var(--head);
          font-size: clamp(20px, 2.2vw, 27px); line-height: 1.5;
          letter-spacing: -.02em; color: #fff;
        }
        .wd-quote footer { margin-top: 26px; display: flex; flex-direction: column; gap: 3px; }
        .wd-quote footer strong { font-size: 15px; color: var(--primary); }
        .wd-quote footer span { font-size: 14px; color: rgba(255, 255, 255, .54); }

        .wd-cta {
          display: flex; align-items: center; justify-content: space-between;
          gap: 32px; flex-wrap: wrap;
          margin-top: clamp(56px, 7vw, 96px);
          padding: clamp(36px, 5vw, 56px);
          background: var(--surface-2);
          border-radius: var(--r-lg);
        }
      `}</style>
    </>
  );
}
