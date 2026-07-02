import { useEffect, useState } from 'react'

const DEFAULT_MESSAGES = [
  'Extracting skills from JD…',
  'Reading your resume…',
  'Comparing with resume…',
  'Calculating score…',
  'Almost done…',
]

export function useLoadingMessages(active, messages = DEFAULT_MESSAGES, intervalMs = 1800) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!active) {
      setIndex(0)
      return
    }
    const id = setInterval(() => {
      setIndex((i) => (i + 1 < messages.length ? i + 1 : i))
    }, intervalMs)
    return () => clearInterval(id)
  }, [active, messages, intervalMs])

  return messages[index]
}