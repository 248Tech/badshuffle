import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import styles from './AuthPage.module.css';

export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.auth.forgot({ email });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo} aria-hidden="true">🔀</div>
        <h1 className={styles.title}>Reset password</h1>

        {sent ? (
          <>
            <p className={styles.sub}>Check your inbox — if that email exists we've sent a reset link.</p>
            <div className={styles.footer}>
              <Link to="/login" className={styles.link}>Back to sign in</Link>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <p className={styles.sub}>Enter your email and we'll send a reset link.</p>
            {error && <div className={styles.error} role="alert">{error}</div>}
            <label className={styles.label}>
              Email
              <input
                className={styles.input}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </label>
            <button className={`btn btn-primary ${styles.submit}`} disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <div className={styles.footer}>
              <Link to="/login" className={styles.link}>Back to sign in</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
