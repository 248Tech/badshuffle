import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api';
import styles from './AuthPage.module.css';

function StepIndicator({ step }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
      {[1, 2, 3].map(n => (
        <React.Fragment key={n}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 12, fontWeight: 700,
            background: n === step ? 'var(--color-primary)' : n < step ? 'var(--color-primary)' : 'var(--color-border)',
            color: n <= step ? '#fff' : 'var(--color-text-muted)',
            opacity: n < step ? 0.5 : 1,
          }}>{n}</div>
          {n < 3 && <div style={{ flex: 1, height: 2, background: n < step ? 'var(--color-primary)' : 'var(--color-border)', opacity: n < step ? 0.5 : 1 }} />}
        </React.Fragment>
      ))}
    </div>
  );
}

function Step1({ onDone }) {
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
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {error && <div className={styles.error}>{error}</div>}
      <label className={styles.label}>
        Email
        <input className={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
      </label>
      <label className={styles.label}>
        Password
        <input className={styles.input} type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
      </label>
      <label className={styles.label}>
        Confirm password
        <input className={styles.input} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
      </label>
      <button className={`btn btn-primary ${styles.submit}`} disabled={loading}>
        {loading ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}

function Step2({ onDone, onSkip }) {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [secure, setSecure] = useState(false);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [from, setFrom] = useState('');
  const [error, setError] = useState('');
  const [testMsg, setTestMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  async function handleTest(e) {
    e.preventDefault();
    setTestMsg('');
    setError('');
    setTesting(true);
    try {
      await api.auth.testMail({ to: from, smtp_host: host, smtp_port: port, smtp_secure: String(secure), smtp_user: user, smtp_pass: pass, smtp_from: from });
      setTestMsg('Email sent successfully');
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.updateSettings({ smtp_host: host, smtp_port: port, smtp_secure: String(secure), smtp_user: user, smtp_pass_enc: pass, smtp_from: from });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSave} className={styles.form}>
      {error && <div className={styles.error}>{error}</div>}
      {testMsg && <div style={{ color: 'var(--color-success, green)', fontSize: 13 }}>{testMsg}</div>}
      <label className={styles.label}>
        SMTP Host
        <input className={styles.input} type="text" value={host} onChange={e => setHost(e.target.value)} placeholder="smtp.example.com" />
      </label>
      <div style={{ display: 'flex', gap: 10 }}>
        <label className={styles.label} style={{ flex: 1 }}>
          Port
          <input className={styles.input} type="number" value={port} onChange={e => setPort(e.target.value)} />
        </label>
        <label className={styles.label} style={{ justifyContent: 'flex-end', gap: 6 }}>
          <span>SSL/TLS</span>
          <input type="checkbox" checked={secure} onChange={e => setSecure(e.target.checked)} style={{ width: 16, height: 16 }} />
        </label>
      </div>
      <label className={styles.label}>
        Username
        <input className={styles.input} type="text" value={user} onChange={e => setUser(e.target.value)} autoComplete="off" />
      </label>
      <label className={styles.label}>
        Password
        <input className={styles.input} type="password" value={pass} onChange={e => setPass(e.target.value)} autoComplete="new-password" />
      </label>
      <label className={styles.label}>
        From address
        <input className={styles.input} type="email" value={from} onChange={e => setFrom(e.target.value)} placeholder="noreply@example.com" />
      </label>
      <button type="button" className="btn btn-secondary" onClick={handleTest} disabled={testing || !host}>
        {testing ? 'Sending…' : 'Send test email'}
      </button>
      <button className={`btn btn-primary ${styles.submit}`} disabled={loading}>
        {loading ? 'Saving…' : 'Save & Continue'}
      </button>
      <div className={styles.footer}>
        <button type="button" className={styles.link} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={onSkip}>
          Skip for now
        </button>
      </div>
    </form>
  );
}

function Step3({ onDone, onSkip }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.admin.createUser({ email, password });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {error && <div className={styles.error}>{error}</div>}
      <label className={styles.label}>
        Email
        <input className={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
      </label>
      <label className={styles.label}>
        Password
        <input className={styles.input} type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
      </label>
      <button className={`btn btn-primary ${styles.submit}`} disabled={loading}>
        {loading ? 'Creating…' : 'Create user'}
      </button>
      <div className={styles.footer}>
        <button type="button" className={styles.link} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={onSkip}>
          Skip
        </button>
      </div>
    </form>
  );
}

export default function SetupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const stepTitles = ['Create admin account', 'Mail server', 'Add first user'];
  const stepSubs = [
    'Set up your BadShuffle admin account',
    'Configure outbound email (optional)',
    'Invite your first team member (optional)',
  ];

  function finish() {
    navigate('/inventory', { replace: true });
  }

  return (
    <div className={styles.page}>
      <div className={styles.card} style={{ maxWidth: step === 2 ? 500 : 380 }}>
        <div className={styles.logo}>🔀</div>
        <h1 className={styles.title}>BadShuffle</h1>
        <StepIndicator step={step} />
        <p className={styles.sub}>{stepSubs[step - 1]}</p>

        {step === 1 && <Step1 onDone={() => setStep(2)} />}
        {step === 2 && <Step2 onDone={() => setStep(3)} onSkip={() => setStep(3)} />}
        {step === 3 && <Step3 onDone={finish} onSkip={finish} />}
      </div>
    </div>
  );
}
