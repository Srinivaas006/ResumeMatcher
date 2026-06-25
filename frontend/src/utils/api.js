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

export async function fetchRoadmap(missingSkills, context = '') {
  const form = new FormData()
  form.append('missing_skills', JSON.stringify(missingSkills))
  form.append('context', context)

  const res = await fetch(`${API_URL}/roadmap`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(err.detail || `Server error ${res.status}`)
  }

  return res.json()
}

export async function analyzeGitHub(username, targetRole = '') {
  const form = new FormData()
  form.append('github_username', username)
  form.append('target_role', targetRole)

  const res = await fetch(`${API_URL}/analyze-github`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(err.detail || `Server error ${res.status}`)
  }

  return res.json()
}