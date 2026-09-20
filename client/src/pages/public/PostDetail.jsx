import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { date } from '../../utils/format';
import { Spinner, Empty } from '../../components/UI';

export default function PostDetail() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/public/posts/${slug}`)
      .then((res) => setPost(res.data))
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <Spinner center />;
  if (!post) {
    return (
      <div className="container section">
        <Empty
          title="Article not found"
          action={<Link to="/insights" className="btn">All insights</Link>}
        />
      </div>
    );
  }

  return (
    <>
      {/* data-nav-dark: runs up under the fixed header, so the nav must
          switch to its light treatment over it. */}
      <section data-nav-dark style={{
        background: 'var(--ink)', color: 'white',
        marginTop: 'calc(var(--header-h) * -1)',
        paddingTop: 'calc(var(--header-h) + var(--s12))',
        paddingBottom: 'var(--s12)',
      }}>
        <div className="container container-narrow">
          <Link to="/insights" className="small" style={{ color: 'var(--orange-400)' }}>← Insights</Link>
          {post.category_name && (
            <div className="tiny bold" style={{ color: 'var(--orange-400)', marginTop: 'var(--s4)' }}>
              {post.category_name}
            </div>
          )}
          <h1 style={{ color: 'white', marginTop: 'var(--s2)' }}>{post.title}</h1>
          <div className="row row-wrap" style={{ gap: 'var(--s4)', marginTop: 'var(--s5)', color: 'var(--ink-400)' }}>
            {post.author_name && <span className="small">{post.author_name}</span>}
            <span className="small">{date(post.published_at)}</span>
            {post.reading_minutes && <span className="small">{post.reading_minutes} min read</span>}
          </div>
        </div>
      </section>

      {post.cover_url && (
        <div style={{ maxHeight: 460, overflow: 'hidden' }}>
          <img src={post.cover_url} alt={post.title} style={{ width: '100%', objectFit: 'cover' }} />
        </div>
      )}

      <article className="section">
        <div className="container container-narrow">
          {post.excerpt && (
            <p className="lead" style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--s8)' }}>
              {post.excerpt}
            </p>
          )}

          <div
            style={{ fontSize: 'var(--text-lg)', lineHeight: 1.85, whiteSpace: 'pre-wrap', color: 'var(--ink-700)' }}
          >
            {post.body}
          </div>

          {post.tags?.length > 0 && (
            <div className="row row-wrap" style={{ gap: 'var(--s2)', marginTop: 'var(--s10)' }}>
              {post.tags.map((tag) => (
                <span key={tag} className="badge badge-neutral">{tag}</span>
              ))}
            </div>
          )}

          {post.related?.length > 0 && (
            <div style={{ marginTop: 'var(--s16)' }}>
              <h3>Keep reading</h3>
              <div className="stack" style={{ marginTop: 'var(--s5)' }}>
                {post.related.map((item) => (
                  <Link key={item.slug} to={`/insights/${item.slug}`} className="card card-hover card-pad">
                    <h4 style={{ fontSize: 'var(--text-base)' }}>{item.title}</h4>
                    {item.excerpt && <p className="small muted" style={{ marginTop: 4 }}>{item.excerpt}</p>}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>
    </>
  );
}
