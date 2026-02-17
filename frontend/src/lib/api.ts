import axios from 'axios'
import { supabase } from './supabase'
import type { ItineraryDay, Activity, CreateItineraryDay, CreateActivity, UpdateActivity, Checklist, ChecklistItem, CreateChecklist, CreateChecklistItem } from './types'

export const api = axios.create({
  baseURL: '/api', // Vite proxy strips this, hits localhost:8000
})

// Request interceptor: attach JWT
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

// Response interceptor: refresh token and retry once on 401
let refreshPromise: Promise<string | null> | null = null

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      if (!refreshPromise) {
        refreshPromise = supabase.auth.refreshSession()
          .then(({ data, error: refreshError }) => {
            if (refreshError || !data.session) {
              supabase.auth.signOut()
              return null
            }
            return data.session.access_token
          })
          .finally(() => { refreshPromise = null })
      }

      const newToken = await refreshPromise
      if (!newToken) return Promise.reject(error)

      originalRequest.headers.Authorization = `Bearer ${newToken}`
      return api(originalRequest)
    }
    return Promise.reject(error)
  }
)

export const itineraryApi = {
  listDays: (tripId: string) =>
    api.get<ItineraryDay[]>(`/itinerary/trips/${tripId}/days`),

  createDay: (tripId: string, data: CreateItineraryDay) =>
    api.post<ItineraryDay>(`/itinerary/trips/${tripId}/days`, data),

  listActivities: (dayId: string) =>
    api.get<Activity[]>(`/itinerary/days/${dayId}/activities`),

  createActivity: (dayId: string, data: CreateActivity) =>
    api.post<Activity>(`/itinerary/days/${dayId}/activities`, data),

  updateActivity: (activityId: string, data: UpdateActivity) =>
    api.patch<Activity>(`/itinerary/activities/${activityId}`, data),

  deleteActivity: (activityId: string) =>
    api.delete(`/itinerary/activities/${activityId}`),
}

export const checklistApi = {
  list: (tripId: string) =>
    api.get<Checklist[]>(`/checklist/trips/${tripId}/checklists`),

  create: (tripId: string, data: CreateChecklist) =>
    api.post<Checklist>(`/checklist/trips/${tripId}/checklists`, data),

  addItem: (checklistId: string, data: CreateChecklistItem) =>
    api.post<ChecklistItem>(`/checklist/checklists/${checklistId}/items`, data),

  toggleItem: (itemId: string) =>
    api.post<ChecklistItem>(`/checklist/items/${itemId}/toggle`, {}),
}
