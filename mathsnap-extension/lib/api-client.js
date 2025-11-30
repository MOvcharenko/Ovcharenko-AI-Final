// API Client for Math Solving
// Replace with your actual API key (store securely in production!)

const APIClient = {
  // Configuration - API key is loaded from Chrome storage
  API_KEY: null,
  API_PROVIDER: null,
  
  // Endpoints
  ANTHROPIC_ENDPOINT: 'https://api.anthropic.com/v1/messages',
  OPENAI_ENDPOINT: 'https://api.openai.com/v1/chat/completions',
  
  // Models
  ANTHROPIC_MODEL: 'claude-sonnet-4-20250514',
  OPENAI_MODEL: 'gpt-4-vision-preview',
  
  /**
   * Solve a math problem using AI
   * @param {string|ArrayBuffer} input - Problem text or base64 image
   * @param {string} type - 'text' or 'image'
   * @returns {Promise<Object>} Solution object
   */
  async solveMath(input, type = 'text') {
    try {
      const messages = this.buildMessage(input, type);
      const response = await this.callAPI(messages);
      return this.parseSolution(response, input);
    } catch (error) {
      console.error('API Error:', error);
      throw new Error('Failed to solve problem. Please check your API key and try again.');
    }
  },
  
  /**
   * Build the message payload for the API
   */
  buildMessage(input, type) {
    const systemPrompt = `You are a helpful math tutor. When given a math problem:
1. Identify the problem clearly
2. Solve it step-by-step
3. Format your response EXACTLY as JSON with this structure:
{
  "problem": "the original problem in clear notation",
  "steps": [
    {
      "step": 1,
      "description": "what we're doing in this step",
      "equation": "the mathematical expression for this step"
    }
  ],
  "answer": "the final answer"
}

Important:
- Keep equations simple and readable
- Explain each step clearly
- Use proper mathematical notation
- For complex equations, break them down
- Always return valid JSON, no markdown formatting`;

    if (type === 'image') {
      return [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: input
              }
            },
            {
              type: 'text',
              text: 'Solve this math problem step by step. Return your response as JSON.'
            }
          ]
        }
      ];
    } else {
      return [
        {
          role: 'user',
          content: `Solve this math problem step by step: ${input}\n\nReturn your response as JSON.`
        }
      ];
    }
  },
  
  /**
   * Call the Anthropic API
   */
  async callAPI(messages) {
    const response = await fetch(this.API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.MODEL,
        max_tokens: 2000,
        messages: messages,
        temperature: 0.3 // Lower temperature for more consistent math
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }
    
    const data = await response.json();
    return data;
  },
  
  /**
   * Parse the AI response into structured solution
   */
  parseSolution(apiResponse, originalInput) {
    try {
      // Extract text from response
      const text = apiResponse.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');
      
      // Try to parse as JSON
      let solution;
      
      // Remove markdown code blocks if present
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      
      try {
        solution = JSON.parse(cleanText);
      } catch (jsonError) {
        // If JSON parsing fails, create a simple solution
        console.warn('Failed to parse JSON, creating fallback solution');
        solution = this.createFallbackSolution(text, originalInput);
      }
      
      // Validate solution structure
      if (!solution.problem || !solution.steps || !solution.answer) {
        throw new Error('Invalid solution structure');
      }
      
      return solution;
      
    } catch (error) {
      console.error('Parsing error:', error);
      throw new Error('Failed to parse solution');
    }
  },
  
  /**
   * Create a fallback solution if JSON parsing fails
   */
  createFallbackSolution(text, originalInput) {
    return {
      problem: typeof originalInput === 'string' ? originalInput : 'Math problem from image',
      steps: [
        {
          step: 1,
          description: 'Solution provided by AI',
          equation: text.substring(0, 100) + '...'
        }
      ],
      answer: 'See full solution above'
    };
  }
};

// Alternative: OpenAI GPT-4 Vision (if you prefer)
const OpenAIClient = {
  API_KEY: 'YOUR_OPENAI_KEY_HERE',
  API_ENDPOINT: 'https://api.openai.com/v1/chat/completions',
  
  async solveMath(input, type = 'text') {
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful math tutor. Solve problems step-by-step and return solutions as JSON.'
      }
    ];
    
    if (type === 'image') {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${input}`
            }
          },
          {
            type: 'text',
            text: 'Solve this math problem and return as JSON'
          }
        ]
      });
    } else {
      messages.push({
        role: 'user',
        content: `Solve this: ${input}`
      });
    }
    
    const response = await fetch(this.API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4-vision-preview',
        messages: messages,
        max_tokens: 1000
      })
    });
    
    const data = await response.json();
    const text = data.choices[0].message.content;
    
    return APIClient.parseSolution({ content: [{ type: 'text', text }] }, input);
  }
};

// Export (uncomment the one you want to use)
// window.APIClient = APIClient; // For Anthropic Claude
// window.APIClient = OpenAIClient; // For OpenAI