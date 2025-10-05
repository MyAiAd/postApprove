import OpenAI from 'openai'
import { supabase } from './supabase'

/**
 * Gets the OpenAI API key from Supabase
 */
export async function getOpenAIKey(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'openai_api_key')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null
      }
      throw error
    }

    return data?.value || null
  } catch (error) {
    console.error('Error fetching OpenAI API key:', error)
    return null
  }
}

/**
 * Gets the OpenAI client instance using the API key from Supabase
 */
export async function getOpenAIClient(): Promise<OpenAI | null> {
  const apiKey = await getOpenAIKey()
  
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
export async function hasOpenAIKey(): Promise<boolean> {
  const key = await getOpenAIKey()
  return !!key
}

/**
 * Example helper function for generating campaign content
 */
export async function generateCampaignContent(prompt: string): Promise<string | null> {
  const client = await getOpenAIClient()
  
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

