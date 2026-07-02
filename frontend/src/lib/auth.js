const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const TOKEN_KEY = 'rm_token'
const USER_KEY = 'rm_user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

export function isLoggedIn() {
  return !!getToken()
}

function saveSession(data) {
  localStorage.setItem(TOKEN_KEY, data.access_token)
  localStorage.setItem(USER_KEY, JSON.stringify({
    id: data.user_id,
    name: data.name,
    email: data.email,
  }))
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export async function signup(email, name, password) {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Signup failed')
  saveSession(data)
  return data
}

export async function login(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Login failed')
  saveSession(data)
  return data
}

export async function fetchHistory() {
  const res = await fetch(`${API_URL}/history`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) throw new Error('Failed to load history')
  return res.json()
}

export async function fetchHistoryItem(id) {
  const res = await fetch(`${API_URL}/history/${id}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) throw new Error('Failed to load analysis')
  return res.json()
}

export async function deleteHistoryItem(id) {
  const res = await fetch(`${API_URL}/history/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) throw new Error('Failed to delete')
  return res.json()
}

export async function saveAnalysis({ jobTitle, jobDescription, resumeText, score, verdict, resultJson }) {
  const token = getToken()
  if (!token) return null
  const form = new FormData()
  form.append('job_title', jobTitle)
  form.append('job_description', jobDescription)
  form.append('resume_text', resumeText)
  form.append('score', score)
  form.append('verdict', verdict)
  form.append('result_json', JSON.stringify(resultJson))
  const res = await fetch(`${API_URL}/analyze/save`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) return null
  return res.json()
}