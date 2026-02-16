import axios from 'axios'
import { supabase } from './supabase'

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

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const { error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) {
        await supabase.auth.signOut()
      }
    }
    return Promise.reject(error)
  }
)
