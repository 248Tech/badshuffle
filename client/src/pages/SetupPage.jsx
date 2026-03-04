import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api';
import styles from './AuthPage.module.css';

export default function SetupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('Passwords do not match');
    setLoading(true);
    try {
      const data = await api.auth.setup({ email, password });
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
        <p className={styles.sub}>Create your admin account</p>

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
              minLength={8}
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
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
