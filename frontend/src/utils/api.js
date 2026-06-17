const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function analyzeResume(resumeFile, jobDescription) {
  const form = new FormData()
  form.append('resume', resumeFile)
  form.append('job_description', jobDescription)

  const res = await fetch(`${API_URL}/analyze`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(err.detail || `Server error ${res.status}`)
  }

  return res.json()
}