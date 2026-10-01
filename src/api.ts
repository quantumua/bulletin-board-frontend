export interface Ad {
  id: number
  title: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface AdInput {
  title: string
  description: string
}

// Empty in development (requests go through the Vite proxy); set VITE_API_BASE_URL for other setups
const BASE_URL = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/ads`

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    const problem = await response.json().catch(() => null)
    throw new Error(problem?.detail ?? `Request failed with status ${response.status}`)
  }
  return response.json()
}

export function listAds(): Promise<Ad[]> {
  return request(BASE_URL)
}

export function createAd(input: AdInput): Promise<Ad> {
  return request(BASE_URL, { method: 'POST', body: JSON.stringify(input) })
}

export function updateAd(id: number, input: AdInput): Promise<Ad> {
  return request(`${BASE_URL}/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}
