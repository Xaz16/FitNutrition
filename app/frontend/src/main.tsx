import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from './api/client';
import { SessionProvider } from './session';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/AuthPage';
import { ProfilePage } from './pages/ProfilePage';
import { FamilyPage } from './pages/FamilyPage';
import { NewPlanPage, PlansIndexPage, PlansListPage } from './pages/PlansPage';
import { PlanPage } from './pages/PlanPage';
import { RecipePage } from './pages/RecipePage';
import { ShoppingPage } from './pages/ShoppingPage';
import { BasketPage } from './pages/BasketPage';
import { AnalysisPage } from './pages/AnalysisPage';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createBrowserRouter([
  { path: '/login', element: <AuthPage mode="login" /> },
  { path: '/register', element: <AuthPage mode="register" /> },
  {
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/plans" replace /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'family', element: <FamilyPage /> },
      { path: 'plans', element: <PlansIndexPage /> },
      { path: 'plans/all', element: <PlansListPage /> },
      { path: 'plans/new', element: <NewPlanPage /> },
      { path: 'plans/:planId', element: <PlanPage /> },
      { path: 'plans/:planId/dishes/:dishId', element: <RecipePage /> },
      { path: 'plans/:planId/shopping', element: <ShoppingPage /> },
      { path: 'plans/:planId/basket', element: <BasketPage /> },
      { path: 'plans/:planId/analysis', element: <AnalysisPage /> },
      { path: '*', element: <Navigate to="/plans" replace /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
);
