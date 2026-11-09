import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useSession } from '../session';
import { ErrorNotice, Field, fieldError } from '../components/ui';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, signIn } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  if (user) return <Navigate to={user.hasProfile ? '/plans' : '/profile'} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const signedIn = await signIn(mode, email, password);
      navigate(signedIn.hasProfile ? '/plans' : '/profile', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  };

  const isLogin = mode === 'login';
  return (
    <div className="auth">
      <form className="card auth__card" onSubmit={submit} noValidate>
        <h1 className="brand brand--large">Fit Nutrition Supply</h1>
        <p className="muted">Рацион, список покупок и самая выгодная корзина в пяти сетях</p>
        <div className="tabs" role="tablist">
          <Link to="/login" className={`tabs__tab${isLogin ? ' tabs__tab--active' : ''}`} role="tab" aria-selected={isLogin}>
            Вход
          </Link>
          <Link to="/register" className={`tabs__tab${!isLogin ? ' tabs__tab--active' : ''}`} role="tab" aria-selected={!isLogin}>
            Регистрация
          </Link>
        </div>
        <Field label="Email" error={fieldError(error, 'email')}>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field
          label="Пароль"
          error={fieldError(error, 'password')}
          hint={isLogin ? undefined : 'Не короче 8 символов'}
        >
          <input
            type="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        {error !== null && fieldError(error, 'email') === undefined && fieldError(error, 'password') === undefined && <ErrorNotice error={error} />}
        <button type="submit" className="btn btn--primary btn--block" disabled={pending}>
          {pending ? 'Подождите…' : isLogin ? 'Войти' : 'Зарегистрироваться'}
        </button>
        {isLogin && <p className="muted small">Демо-доступ: demo@fitnutrition.local / demo12345</p>}
      </form>
    </div>
  );
}
