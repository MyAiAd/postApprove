import OpenAI from 'openai'

/**
 * Gets the OpenAI client instance using the API key from localStorage
 * Note: This should only be called from client components
 */
export function getOpenAIClient(): OpenAI | null {
  if (typeof window === 'undefined') {
    console.error('OpenAI client can only be initialized in the browser')
    return null
  }

  const apiKey = localStorage.getItem('openai_api_key')
  
  if (!apiKey) {
    console.error('OpenAI API key not found. Please set it in Settings.')
    return null
  }

  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true // Required for client-side usage
  })
}

/**
 * Checks if an OpenAI API key is configured
 */
export function hasOpenAIKey(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem('openai_api_key')
}

/**
 * Example helper function for generating campaign content
 */
export async function generateCampaignContent(prompt: string): Promise<string | null> {
  const client = getOpenAIClient()
  
  if (!client) {
    throw new Error('OpenAI client not available. Please configure your API key in Settings.')
  }

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that creates engaging social media content.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
    })

    return completion.choices[0]?.message?.content || null
  } catch (error) {
    console.error('Error generating content:', error)
    throw error
  }
}

