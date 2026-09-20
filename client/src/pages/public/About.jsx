import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { Spinner } from '../../components/UI';
import { Reveal, ZoomIn, Eyebrow, ArrowRight, Odometer } from '../../components/Motion';
import PageHero from '../../components/PageHero';

const PRINCIPLES = [
  {
    title: 'One partner, not five suppliers',
    body: 'The waste in most projects is not the work itself — it is the handovers between the designer, the developer, the printer and the events team. We remove the handovers.',
  },
  {
    title: 'Scope written down before we start',
    body: 'Every quote states what is included, how many revisions you get and what is not covered. Nobody is surprised halfway through.',
  },
  {
    title: 'Capacity, never "unlimited"',
    body: 'Our retainers include a stated number of deliverables each month. Unlimited-scope retainers are how agencies quietly reduce quality to protect margin. We would rather be honest about the maths.',
  },
  {
    title: 'AI as an operating layer, not a gimmick',
    body: 'Our assistants answer only from information you have approved, and hand over to a person when they are unsure. You can read every conversation they have had.',
  },
  {
    title: 'Own the relationship, partner on capacity',
    body: 'We keep the client relationship, the standards and the creative leadership in-house, and use a vetted supplier network for peak production. You always know who is accountable.',
  },
  {
    title: 'Built for this market',
    body: 'Mobile-first because that is how Tanzania browses. Mobile money because that is how Tanzania pays. Prices in shillings, with USD when you need it.',
  },
];

export default function About() {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const { siteSettings, slot} = useApp();

  useEffect(() => {
    api.get('/public/team')
      .then((res) => setTeam(res.data || []))
      .catch(() => setTeam([]))
      .finally(() => setLoading(false));
  }, []);

  const brand = siteSettings.brand || {};

  return (
    <>
      <PageHero
        eyebrow="Our approach"
        title="We built the company"
        highlight="we kept wishing existed."
        lead={brand.promise || 'One partner. One engine. Everything from idea to execution.'}
        media={slot('about-studio')}
        mediaAlt="The Creative Engine studio space with the team at work"
      />

      {/* ----------------------------------------------------- WHY WE EXIST */}
      <section className="section">
        <div className="container">
          <div className="why">
            <Reveal className="why__copy" stagger={80}>
              <Eyebrow>Why we exist</Eyebrow>
              <h2 className="h2">
                Six suppliers.<br />
                Six people to <span className="accent--plain">blame.</span>
              </h2>
              <p>
                A marketing manager in Dar es Salaam who wants to launch a product ends up
                managing a designer, a web developer, a printer, an events supplier, an AV
                company and possibly a technology vendor. Six relationships, six invoices,
                six sets of deadlines — and when something slips, each one points at another.
              </p>
              <p>
                Creative Engine exists to collapse that into one brief and one accountable
                team. The creative work feeds the website. The website feeds the AI assistant.
                The event generates the print order and the content. Each part makes the next
                part cheaper and faster, because it is all under one roof.
              </p>
              <p>
                We are deliberately built in layers: creative services first, recurring digital
                infrastructure second, AI systems third, and platform scale last. The goal is
                not to be the biggest supplier of everything. It is to be the engine that
                coordinates the whole thing properly.
              </p>
            </Reveal>

            <ZoomIn
              src={slot('about-why')}
              alt="A creative direction session working through a campaign concept"
              ratio="3x4"
              className="why__media"
            />
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- PRINCIPLES */}
      <section className="section section--surface">
        <div className="container">
          <Reveal className="sec-head sec-head--split" stagger={70}>
            <div className="sec-head__copy">
              <Eyebrow>How we work</Eyebrow>
              <h2 className="h2">Six things we hold to</h2>
              <p className="lead measure-sm">
                Most of these cost us money in the short term. They are the reason
                clients stay.
              </p>
            </div>
          </Reveal>

          <Reveal className="prin-grid" stagger={80}>
            {PRINCIPLES.map((principle, i) => (
              <div key={principle.title} className="prin-card">
                <span className="prin-card__n">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="h4">{principle.title}</h3>
                <p>{principle.body}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* --------------------------------------------------------- THE TEAM */}
      {loading ? null : team.length > 0 && (
        <section className="section">
          <div className="container">
            <Reveal className="sec-head sec-head--split" stagger={70}>
              <div className="sec-head__copy">
                <Eyebrow>The team</Eyebrow>
                <h2 className="h2">Who you will actually work with</h2>
              </div>
            </Reveal>

            <Reveal className="team-grid" stagger={80}>
              {team.map((member) => (
                <div key={member.id} className="tm">
                  <div className="tm__photo">
                    {member.photo_url ? (
                      <img src={member.photo_url} alt={member.name} />
                    ) : (
                      <span>{member.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                    )}
                  </div>
                  <h3 className="h4">{member.name}</h3>
                  <div className="tm__role">{member.role_title}</div>
                  {member.bio && <p className="tm__bio">{member.bio}</p>}
                </div>
              ))}
            </Reveal>
          </div>
        </section>
      )}

      {/* --------------------------------------------------------------- CTA */}
      <section className="section">
        <div className="container">
          <Reveal className="about-cta" stagger={90}>
            <h2 className="display display--sm">
              Work with <span className="accent">us.</span>
            </h2>
            <p className="lead">
              Tell us what you are trying to achieve. If we are not the right people
              for it, we will say so and point you somewhere better.
            </p>
            <Link to="/contact" className="btn btn-lg">
              <span>Get in touch</span><ArrowRight />
            </Link>
          </Reveal>
        </div>
      </section>

      <style>{`
        .why {
          display: grid; grid-template-columns: 1.15fr .85fr;
          gap: clamp(36px, 5vw, 76px); align-items: start;
        }
        .why__copy { display: flex; flex-direction: column; align-items: flex-start; gap: 20px; }
        .why__copy p {
          font-size: clamp(16px, 1.4vw, 18px); line-height: 1.75; color: var(--ink-2);
        }
        .why__media { position: sticky; top: calc(var(--header-h) + 24px); }

        .prin-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
          gap: 20px;
        }
        .prin-card {
          padding: 28px 26px;
          background: var(--white);
          border: 1px solid var(--stroke);
          border-radius: var(--r-md);
          transition: transform var(--fast) var(--ease), box-shadow var(--fast) var(--ease);
        }
        .prin-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); }
        .prin-card__n {
          display: inline-block; margin-bottom: 14px;
          font-family: var(--display); font-size: 13px; font-weight: 700;
          letter-spacing: .08em; color: var(--on-primary);
          background: var(--primary); padding: 4px 10px; border-radius: var(--r-pill);
        }
        .prin-card p { margin-top: 10px; font-size: 14.5px; line-height: 1.65; color: var(--body); }

        .team-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 24px;
        }
        .tm { display: flex; flex-direction: column; gap: 6px; }
        .tm__photo {
          width: 100%; aspect-ratio: 1; margin-bottom: 14px;
          border-radius: var(--r-md); overflow: clip;
          background: var(--surface-2);
          display: grid; place-items: center;
          font-family: var(--display); font-weight: 700; font-size: 32px;
          color: var(--ink-300);
        }
        .tm__photo img { width: 100%; height: 100%; object-fit: cover; }
        .tm__role { font-size: 14px; color: var(--flame); font-weight: 500; }
        .tm__bio { font-size: 14px; color: var(--body); line-height: 1.6; margin-top: 4px; }

        .about-cta {
          display: flex; flex-direction: column; align-items: center;
          text-align: center; gap: 22px;
          padding: clamp(56px, 8vw, 100px) clamp(24px, 5vw, 56px);
          background: var(--ink); color: #fff;
          border-radius: var(--r-lg);
        }
        .about-cta .display { color: #fff; }
        .about-cta .lead { color: rgba(255, 255, 255, .64); max-width: 46ch; }

        @media (max-width: 960px) {
          .why { grid-template-columns: 1fr; }
          .why__media { position: static; }
        }
      `}</style>
    </>
  );
}
