import type {
  ApiResponse,
  CheckoutContext,
  DemoPersona,
  OrganizerView,
  UserView,
  WalletView,
} from '../contracts/types'

async function demoGet<T>(path: string, persona?: DemoPersona, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    headers: persona ? { 'x-demo-persona': persona } : {},
    signal,
    cache: 'no-store',
  })
  const body: ApiResponse<T> = await response.json()
  if (!response.ok || !body.success) throw new Error(body.message)
  return body.data
}
export const loadCheckoutContext = (persona: DemoPersona, signal?: AbortSignal) =>
  demoGet<CheckoutContext>('/api/demo/checkout-context', persona, signal)
export async function loadAccount(
  persona: DemoPersona,
  signal?: AbortSignal,
): Promise<{ user: UserView; rewards: WalletView | null }> {
  if (persona === 'customer') return loadCheckoutContext(persona, signal)
  return { user: await demoGet<UserView>('/api/demo/me', persona, signal), rewards: null }
}
export const loadOrganizer = (id: string, signal?: AbortSignal) =>
  demoGet<OrganizerView>(`/api/demo/organizers/${encodeURIComponent(id)}`, undefined, signal)
