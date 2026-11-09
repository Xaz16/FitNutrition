import { Navigate, NavLink, Outlet, useLocation, useMatch } from 'react-router';
import { currentPlan, useSession } from '../session';
import { Loading } from './ui';

function planScopedPath(section: 'shopping' | 'basket' | 'analysis', planId: string | null) {
  return planId ? `/plans/${planId}/${section}` : '/plans';
}

export function Layout() {
  const { user, ready, signOut } = useSession();
  const location = useLocation();
  const planMatch = useMatch('/plans/:planId/*');
  const routePlanId = planMatch?.params.planId && planMatch.params.planId !== 'new' ? planMatch.params.planId : null;
  const planId = routePlanId ?? currentPlan.get();

  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!user.hasProfile && location.pathname !== '/profile') return <Navigate to="/profile" replace />;

  const link = ({ isActive }: { isActive: boolean }) => `nav__link${isActive ? ' nav__link--active' : ''}`;
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/plans" className="brand">
          Fit Nutrition Supply
        </NavLink>
        <nav className="nav" aria-label="Основная навигация">
          <NavLink to={planId ? `/plans/${planId}` : '/plans'} end className={link}>
            Рацион
          </NavLink>
          <NavLink to={planScopedPath('shopping', planId)} className={link}>
            Покупки
          </NavLink>
          <NavLink to={planScopedPath('basket', planId)} className={link}>
            Корзина
          </NavLink>
          <NavLink to="/profile" className={link}>
            Профиль
          </NavLink>
          <NavLink to="/family" className={link}>
            Семья
          </NavLink>
        </nav>
        <div className="topbar__user">
          <span className="muted">{user.email}</span>
          <button type="button" className="btn btn--ghost" onClick={signOut}>
            Выйти
          </button>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}
