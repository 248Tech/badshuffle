import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, setToken } from '../api';
import styles from './AuthPage.module.css';

function randomOneToTwelve() {
  return Math.floor(Math.random() * 12) + 1;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [[mathA, mathB], setMath] = useState(() => [randomOneToTwelve(), randomOneToTwelve()]);
  const [mathAnswer, setMathAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaConfig, setCaptchaConfig] = useState(null);
  const [recaptchaReady, setRecaptchaReady] = useState(false);
  const recaptchaContainerRef = useRef(null);
  const recaptchaWidgetIdRef = useRef(null);

  useEffect(() => {
    api.auth.captchaConfig()
      .then(c => setCaptchaConfig(c))
      .catch(() => setCaptchaConfig({ math_required: true, recaptcha_enabled: false, recaptcha_site_key: '' }));
  }, []);

  useEffect(() => {
    if (!captchaConfig?.recaptcha_enabled || !captchaConfig?.recaptcha_site_key || !recaptchaContainerRef.current) return;
    if (window.grecaptcha && window.grecaptcha.render) {
      try {
        recaptchaWidgetIdRef.current = window.grecaptcha.render(recaptchaContainerRef.current, {
          sitekey: captchaConfig.recaptcha_site_key,
          theme: 'light'
        });
        setRecaptchaReady(true);
      } catch (e) {
        console.warn('reCAPTCHA render failed', e);
      }
      return;
    }
    const onload = () => {
      try {
        if (recaptchaContainerRef.current && window.grecaptcha && window.grecaptcha.render) {
          recaptchaWidgetIdRef.current = window.grecaptcha.render(recaptchaContainerRef.current, {
            sitekey: captchaConfig.recaptcha_site_key,
            theme: 'light'
          });
          setRecaptchaReady(true);
        }
      } catch (e) {
        console.warn('reCAPTCHA render failed', e);
      }
    };
    window.onRecaptchaLoad = onload;
    if (document.querySelector('script[src*="google.com/recaptcha"]')) {
      onload();
      return;
    }
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    return () => {
      window.onRecaptchaLoad = null;
    };
  }, [captchaConfig?.recaptcha_enabled, captchaConfig?.recaptcha_site_key]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const mathRequired = captchaConfig?.math_required !== false;
    if (mathRequired) {
      const expected = mathA + mathB;
      const answer = parseInt(mathAnswer, 10);
      if (isNaN(answer) || answer !== expected) {
        setError('Incorrect answer to the math question.');
        return;
      }
    }
    const recaptchaRequired = captchaConfig?.recaptcha_enabled && captchaConfig?.recaptcha_site_key;
    let recaptchaToken = '';
    if (recaptchaRequired && window.grecaptcha && window.grecaptcha.getResponse) {
      recaptchaToken = window.grecaptcha.getResponse();
      if (!recaptchaToken) {
        setError('Please complete the reCAPTCHA.');
        return;
      }
    }
    setLoading(true);
    try {
      const body = {
        email,
        password,
        math_a: mathA,
        math_b: mathB,
        math_answer: mathRequired ? parseInt(mathAnswer, 10) : undefined
      };
      if (recaptchaToken) body.recaptcha_response = recaptchaToken;
      const data = await api.auth.login(body);
      setToken(data.token);
      if (recaptchaRequired && window.grecaptcha && window.grecaptcha.reset && recaptchaWidgetIdRef.current != null) {
        window.grecaptcha.reset(recaptchaWidgetIdRef.current);
      }
      setMath([randomOneToTwelve(), randomOneToTwelve()]);
      setMathAnswer('');
      navigate('/inventory', { replace: true });
    } catch (err) {
      setError(err.message);
      if (recaptchaRequired && window.grecaptcha && window.grecaptcha.reset && recaptchaWidgetIdRef.current != null) {
        window.grecaptcha.reset(recaptchaWidgetIdRef.current);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo} aria-hidden="true">🔀</div>
        <h1 className={styles.title}>BadShuffle</h1>
        <p className={styles.sub}>Sign in to your account</p>

        <form onSubmit={handleSubmit} className={styles.form}>
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
          {captchaConfig?.math_required !== false && (
            <label className={styles.label}>
              What is {mathA} + {mathB}?
              <input
                className={styles.input}
                type="number"
                min="0"
                max="24"
                value={mathAnswer}
                onChange={e => setMathAnswer(e.target.value)}
                required
                placeholder="Answer"
              />
            </label>
          )}
          {captchaConfig?.recaptcha_enabled && captchaConfig?.recaptcha_site_key && (
            <div className={styles.recaptchaWrap} ref={recaptchaContainerRef} />
          )}
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
