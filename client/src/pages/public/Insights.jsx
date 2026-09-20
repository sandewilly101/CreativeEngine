import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { truncate, date } from '../../utils/format';
import PageHero from '../../components/PageHero';
import { Reveal, Eyebrow, ArrowRight } from '../../components/Motion';
import { Spinner, Empty } from '../../components/UI';

export default function Insights() {
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/public/posts${category ? `?category=${category}` : ''}`).catch(() => ({ data: [] })),
      api.get('/public/post-categories').catch(() => ({ data: [] })),
    ])
      .then(([p, c]) => {
        setPosts(p.data || []);
        setCategories(c.data || []);
      })
      .finally(() => setLoading(false));
  }, [category]);

  return (
    <>
      <PageHero
        eyebrow="Insights"
        title="What we are learning,"
        highlight="written down."
        lead="Thinking on brand, marketing, AI and production in the Tanzanian market."
      />

      <section className="section">
        <div className="container">
          <div className="row row-wrap" style={{ gap: 'var(--s2)', marginBottom: 'var(--s10)' }}>
            <button
              className={`filter ${!category ? 'is-on' : ''}`}
              onClick={() => setCategory('')}
            >
              All topics
            </button>
            {categories.map((cat) => (
              <button
                key={cat.slug}
                className={`filter ${category === cat.slug ? 'is-on' : ''}`}
                onClick={() => setCategory(cat.slug)}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {loading ? <Spinner center /> : posts.length === 0 ? (
            <Empty
              title="No articles published yet"
              description="Articles written in the admin appear here once published."
            />
          ) : (
            <div className="grid grid-3">
              {posts.map((post) => (
                <Link key={post.slug} to={`/insights/${post.slug}`} className="card card-hover">
                  {(post.cover_thumb || post.cover_url) && (
                    <div style={{
                      aspectRatio: '16/9',
                      background: `url(${post.cover_thumb || post.cover_url}) center/cover`,
                    }} />
                  )}
                  <div className="card-pad">
                    {post.category_name && (
                      <span className="tiny bold" style={{ color: post.category_color || 'var(--flame)' }}>
                        {post.category_name}
                      </span>
                    )}
                    <h4 style={{ fontSize: 'var(--text-lg)', marginTop: 4 }}>{post.title}</h4>
                    <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
                      {truncate(post.excerpt, 120)}
                    </p>
                    <div className="row" style={{ gap: 'var(--s3)', marginTop: 'var(--s4)' }}>
                      <span className="tiny muted">{date(post.published_at)}</span>
                      {post.reading_minutes && (
                        <span className="tiny muted">· {post.reading_minutes} min read</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
