'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()
  const [apiKey, setApiKey] = useState('')
  const [savedApiKey, setSavedApiKey] = useState('')
  const [message, setMessage] = useState('')
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    // Load API key from localStorage on mount
    const stored = localStorage.getItem('openai_api_key')
    if (stored) {
      setSavedApiKey(stored)
      setApiKey(stored)
    }
  }, [])

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!apiKey.trim()) {
      setMessage('Please enter an API key')
      return
    }

    // Validate that it looks like an OpenAI key
    if (!apiKey.startsWith('sk-')) {
      setMessage('OpenAI API keys should start with "sk-"')
      return
    }

    // Save to localStorage
    localStorage.setItem('openai_api_key', apiKey)
    setSavedApiKey(apiKey)
    setMessage('API key saved successfully!')
    
    // Clear message after 3 seconds
    setTimeout(() => setMessage(''), 3000)
  }

  const handleClear = () => {
    if (confirm('Are you sure you want to remove your saved API key?')) {
      localStorage.removeItem('openai_api_key')
      setApiKey('')
      setSavedApiKey('')
      setMessage('API key removed')
      setTimeout(() => setMessage(''), 3000)
    }
  }

  return (
    <div className="container">
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>
          Settings
        </h1>

        {message && (
          <div className={message.includes('Error') || message.includes('removed') ? 'error' : 'success'}>
            {message}
          </div>
        )}

        <form onSubmit={handleSave} className="upload-form">
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>
            OpenAI API Key
          </h2>

          <div className="form-group">
            <label htmlFor="apiKey">
              API Key:
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                style={{ paddingRight: '100px' }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#3b82f6',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
              Your API key is stored locally in your browser and never sent to our servers.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="submit" className="btn">
              Save API Key
            </button>
            {savedApiKey && (
              <button
                type="button"
                onClick={handleClear}
                className="delete-btn"
              >
                Clear API Key
              </button>
            )}
          </div>
        </form>

        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', color: '#0369a1' }}>
            How to get an OpenAI API Key:
          </h3>
          <ol style={{ paddingLeft: '1.5rem', color: '#0c4a6e', lineHeight: '1.8' }}>
            <li>Go to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>platform.openai.com/api-keys</a></li>
            <li>Sign in or create an account</li>
            <li>Click "Create new secret key"</li>
            <li>Copy the key and paste it above</li>
          </ol>
        </div>

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button
            onClick={() => router.push('/')}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              cursor: 'pointer',
              fontSize: '0.875rem',
              textDecoration: 'underline',
            }}
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}

