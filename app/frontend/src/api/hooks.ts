import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  Allergen,
  Alternative,
  Analysis,
  BasketComparison,
  Ingredient,
  MemberInput,
  Plan,
  PlanSummary,
  Profile,
  ProfileInput,
  Recipe,
  ShoppingGroup,
} from './types';

export const keys = {
  profile: ['profile'] as const,
  allergens: ['allergens'] as const,
  ingredients: ['ingredients'] as const,
  plans: ['plans'] as const,
  plan: (id: string) => ['plans', id] as const,
  alternatives: (planId: string, mealId: string) => ['plans', planId, 'alternatives', mealId] as const,
  shopping: (id: string) => ['plans', id, 'shopping'] as const,
  baskets: (id: string) => ['plans', id, 'baskets'] as const,
  analysis: (id: string) => ['plans', id, 'analysis'] as const,
  recipe: (id: number, servings: number) => ['dishes', id, servings] as const,
};

export const useProfile = () => useQuery({ queryKey: keys.profile, queryFn: () => api<Profile | null>('/profile') });
export const useAllergens = () =>
  useQuery({ queryKey: keys.allergens, queryFn: () => api<Allergen[]>('/allergens'), staleTime: Infinity });
export const useIngredients = () =>
  useQuery({ queryKey: keys.ingredients, queryFn: () => api<Ingredient[]>('/ingredients'), staleTime: Infinity });
export const usePlans = () => useQuery({ queryKey: keys.plans, queryFn: () => api<PlanSummary[]>('/plans') });
export const usePlan = (id: string) => useQuery({ queryKey: keys.plan(id), queryFn: () => api<Plan>(`/plans/${id}`) });
export const useShoppingList = (id: string) =>
  useQuery({ queryKey: keys.shopping(id), queryFn: () => api<ShoppingGroup[]>(`/plans/${id}/shopping-list`) });
export const useBaskets = (id: string) =>
  useQuery({ queryKey: keys.baskets(id), queryFn: () => api<BasketComparison>(`/plans/${id}/baskets`) });
export const useLatestAnalysis = (id: string) =>
  useQuery({ queryKey: keys.analysis(id), queryFn: () => api<Analysis | null>(`/plans/${id}/analysis`) });
export const useRecipe = (id: number, servings: number) =>
  useQuery({ queryKey: keys.recipe(id, servings), queryFn: () => api<Recipe>(`/dishes/${id}?servings=${servings}`) });
export const useAlternatives = (planId: string, mealId: string | null) =>
  useQuery({
    queryKey: keys.alternatives(planId, mealId ?? ''),
    queryFn: () => api<Alternative[]>(`/plans/${planId}/meals/${mealId}/alternatives`),
    enabled: mealId !== null,
  });

function useInvalidatePlans() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: keys.plans });
}

export function useSaveProfile() {
  const client = useQueryClient();
  const invalidatePlans = useInvalidatePlans();
  return useMutation({
    mutationFn: (input: ProfileInput) => api<Profile>('/profile', { method: 'PUT', body: input }),
    onSuccess: (profile) => {
      client.setQueryData(keys.profile, profile);
      void invalidatePlans();
    },
  });
}

export function useMemberMutations() {
  const client = useQueryClient();
  const invalidatePlans = useInvalidatePlans();
  const onSuccess = (profile: Profile) => {
    client.setQueryData(keys.profile, profile);
    void invalidatePlans();
  };
  return {
    add: useMutation({ mutationFn: (input: MemberInput) => api<Profile>('/household/members', { method: 'POST', body: input }), onSuccess }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: MemberInput }) =>
        api<Profile>(`/household/members/${id}`, { method: 'PUT', body: input }),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: string) => api<Profile>(`/household/members/${id}`, { method: 'DELETE' }), onSuccess }),
  };
}

export function useCreatePlan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { startDate: string; days: number; budgetRub?: number }) => api<Plan>('/plans', { method: 'POST', body: input }),
    onSuccess: (plan) => {
      client.setQueryData(keys.plan(plan.id), plan);
      void client.invalidateQueries({ queryKey: keys.plans, exact: true });
    },
  });
}

export function useReplaceMeal(planId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ mealId, dishId }: { mealId: string; dishId: number }) =>
      api<Plan>(`/plans/${planId}/meals/${mealId}`, { method: 'PUT', body: { dishId } }),
    onSuccess: (plan) => {
      client.setQueryData(keys.plan(planId), plan);
      void client.invalidateQueries({ queryKey: keys.shopping(planId) });
      void client.invalidateQueries({ queryKey: keys.baskets(planId) });
    },
  });
}

export function useSetBudget(planId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (budgetRub: number) => api<Plan>(`/plans/${planId}/budget`, { method: 'PUT', body: { budgetRub } }),
    onSuccess: (plan) => {
      client.setQueryData(keys.plan(planId), plan);
      void client.invalidateQueries({ queryKey: keys.baskets(planId) });
    },
  });
}

export function useMarkShopping(planId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ ingredientId, ...body }: { ingredientId: number; bought?: boolean; atHomeQty?: number }) =>
      api<ShoppingGroup[]>(`/plans/${planId}/shopping-list/${ingredientId}`, { method: 'PATCH', body }),
    onSuccess: (groups) => {
      client.setQueryData(keys.shopping(planId), groups);
      void client.invalidateQueries({ queryKey: keys.baskets(planId) });
    },
  });
}

export function useRunAnalysis(planId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<Analysis>(`/plans/${planId}/analysis`, { method: 'POST' }),
    onSuccess: (analysis) => client.setQueryData(keys.analysis(planId), analysis),
  });
}
