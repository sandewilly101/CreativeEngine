import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

export default function NotFound() {
  const { slot, slotAlt } = useApp();
  const art = slot('error-404');

  return (
    <div data-nav-dark style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      background: 'var(--ink)', color: 'white', padding: 'var(--s6)',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 560 }}>
        {art && (
          <img
            src={art}
            alt={slotAlt('error-404')}
            style={{ width: 'min(420px, 80vw)', height: 'auto', marginBottom: 'var(--s5)' }}
          />
        )}
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: '5rem',
          fontWeight: 800, color: 'var(--flame)', lineHeight: 1,
        }}>
          404
        </div>
        <h2 style={{ color: 'white', marginTop: 'var(--s5)' }}>This page does not exist</h2>
        <p className="lead" style={{ color: 'var(--ink-400)', marginTop: 'var(--s4)' }}>
          The link may be out of date, or the page may have moved.
        </p>
        <div className="row" style={{ justifyContent: 'center', gap: 'var(--s3)', marginTop: 'var(--s8)' }}>
          <Link to="/" className="btn">Back to home</Link>
          <Link to="/contact" className="btn btn-light">Contact us</Link>
        </div>
      </div>
    </div>
  );
}
