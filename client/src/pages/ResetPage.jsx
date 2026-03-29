import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api';
import styles from './AuthPage.module.css';

export default function ResetPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('Passwords do not match');
    setLoading(true);
    try {
      await api.auth.reset({ token, password });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.logo} aria-hidden="true">🔀</div>
          <h1 className={styles.title}>Invalid link</h1>
          <p className={styles.sub}>This reset link is missing a token.</p>
          <div className={styles.footer}>
            <Link to="/forgot" className={styles.link}>Request a new link</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo} aria-hidden="true">🔀</div>
        <h1 className={styles.title}>Set new password</h1>

        {done ? (
          <>
            <p className={styles.sub}>Password updated. You can now sign in.</p>
            <div className={styles.footer}>
              <Link to="/login" className={styles.link}>Sign in</Link>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {error && <div className={styles.error} role="alert">{error}</div>}
            <label className={styles.label}>
              New password
              <input
                className={styles.input}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                autoFocus
              />
            </label>
            <label className={styles.label}>
              Confirm password
              <input
                className={styles.input}
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
              />
            </label>
            <button className={`btn btn-primary ${styles.submit}`} disabled={loading}>
              {loading ? 'Saving…' : 'Set password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
