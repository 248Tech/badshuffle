import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, setToken } from '../api';
import styles from './AuthPage.module.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.auth.login({ email, password });
      setToken(data.token);
      navigate('/inventory', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>🔀</div>
        <h1 className={styles.title}>BadShuffle</h1>
        <p className={styles.sub}>Sign in to your account</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
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
          <label className={styles.label}>
            Password
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </label>
          <button className={`btn btn-primary ${styles.submit}`} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className={styles.footer}>
          <Link to="/forgot" className={styles.link}>Forgot password?</Link>
        </div>
      </div>
    </div>
  );
}
