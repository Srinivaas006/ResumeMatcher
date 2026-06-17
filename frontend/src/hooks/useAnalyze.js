import { useState } from 'react'
import { analyzeResume } from '../utils/api'

export function useAnalyze() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function analyze(resumeFile, jobDescription) {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await analyzeResume(resumeFile, jobDescription)
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setResult(null)
    setError(null)
  }

  return { result, loading, error, analyze, reset }
}
