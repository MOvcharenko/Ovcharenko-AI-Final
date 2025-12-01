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
   * Initialize - Load API key from storage
   */
  async init() {
    console.log('🔧 Initializing API client...');
    
    const result = await chrome.storage.local.get(['apiKey', 'apiProvider']);
    
    console.log('📦 Storage result:', {
      hasApiKey: !!result.apiKey,
      apiKeyLength: result.apiKey ? result.apiKey.length : 0,
      apiKeyPrefix: result.apiKey ? result.apiKey.substring(0, 15) : 'NONE',
      provider: result.apiProvider
    });
    
    this.API_KEY = result.apiKey;
    this.API_PROVIDER = result.apiProvider || 'anthropic';
    
    if (!this.API_KEY) {
      console.error('❌ No API key found in storage!');
      throw new Error('NO_API_KEY');
    }
    
    console.log('✅ API client initialized successfully');
  },
  
  /**
   * Solve a math problem using AI
   * @param {string|ArrayBuffer} input - Problem text or base64 image
   * @param {string} type - 'text' or 'image'
   * @returns {Promise<Object>} Solution object
   */
  async solveMath(input, type = 'text') {
    try {
      console.log('🚀 solveMath called with type:', type);
      
      // Load API key if not already loaded
      if (!this.API_KEY) {
        console.log('🔑 API key not loaded, initializing...');
        await this.init();
      }
      
      console.log('✓ API key loaded:', this.API_KEY ? this.API_KEY.substring(0, 15) + '...' : 'MISSING');
      console.log('✓ Provider:', this.API_PROVIDER);
      
      const messages = this.buildMessage(input, type);
      console.log('📨 Built messages:', messages);
      
      const response = await this.callAPI(messages);
      console.log('✅ Got response from API');
      
      return this.parseSolution(response, input);
    } catch (error) {
      console.error('❌ API Error in solveMath:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      if (error.message === 'NO_API_KEY') {
        throw new Error('Please configure your API key in settings');
      }
      
      throw new Error('Failed to solve problem. Please check your API key and try again.');
    }
  },
  
  /**
   * Build the message payload for the API
   */
  buildMessage(input, type) {
    const systemPrompt = `You are a helpful math tutor. Solve the math problem step-by-step.

CRITICAL: You MUST respond with ONLY valid JSON, no other text. Format:
{
  "problem": "original problem",
  "steps": [
    {"step": 1, "description": "what we do", "equation": "the math"},
    {"step": 2, "description": "next step", "equation": "more math"}
  ],
  "answer": "final answer"
}

Do not include markdown code blocks, just pure JSON.`;

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
              text: 'Solve this math problem step by step. Respond with ONLY JSON, no other text.'
            }
          ]
        }
      ];
    } else {
      return [
        {
          role: 'user',
          content: `Solve this math problem: ${input}\n\nRespond with ONLY the JSON object, nothing else.`
        }
      ];
    }
  },
  
  /**
   * Call the appropriate AI API based on provider
   */
  async callAPI(messages) {
    if (this.API_PROVIDER === 'anthropic') {
      return this.callAnthropicAPI(messages);
    } else {
      return this.callOpenAIAPI(messages);
    }
  },
  
  /**
   * Call the Anthropic API
   */
  async callAnthropicAPI(messages) {
    console.log('🔑 API Key check:', {
      exists: !!this.API_KEY,
      length: this.API_KEY ? this.API_KEY.length : 0,
      prefix: this.API_KEY ? this.API_KEY.substring(0, 15) : 'NONE',
      startsWithCorrect: this.API_KEY ? this.API_KEY.startsWith('sk-ant-') : false
    });
    console.log('📡 Calling Anthropic API...');
    console.log('📝 Endpoint:', this.ANTHROPIC_ENDPOINT);
    
    const requestBody = {
      model: this.ANTHROPIC_MODEL,
      max_tokens: 2000,
      messages: messages,
      temperature: 0.3
    };
    
    console.log('📨 Request body:', JSON.stringify(requestBody, null, 2));
    
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': this.API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    };
    
    console.log('📋 Headers (without key):', {
      'Content-Type': headers['Content-Type'],
      'anthropic-version': headers['anthropic-version'],
      'anthropic-dangerous-direct-browser-access': headers['anthropic-dangerous-direct-browser-access'],
      'x-api-key': this.API_KEY ? `${this.API_KEY.substring(0, 10)}...` : 'MISSING'
    });
    
    const response = await fetch(this.ANTHROPIC_ENDPOINT, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });
    
    console.log('📬 Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      
      let error;
      try {
        error = JSON.parse(errorText);
      } catch (e) {
        error = { message: errorText };
      }
      
      throw new Error(error.error?.message || error.message || 'API request failed');
    }
    
    console.log('✅ API Response received successfully');
    const data = await response.json();
    console.log('📦 Response data:', data);
    return data;
  },
  
  /**
   * Call the OpenAI API
   */
  async callOpenAIAPI(messages) {
    // Convert Anthropic-style messages to OpenAI format
    const openaiMessages = messages.map(msg => {
      if (typeof msg.content === 'string') {
        return msg;
      }
      // Handle image content
      return {
        role: msg.role,
        content: msg.content.map(item => {
          if (item.type === 'image') {
            return {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${item.source.data}`
              }
            };
          }
          return item;
        })
      };
    });
    
    const response = await fetch(this.OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.API_KEY}`
      },
      body: JSON.stringify({
        model: this.OPENAI_MODEL,
        max_tokens: 2000,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful math tutor. Solve problems step-by-step and return as JSON.'
          },
          ...openaiMessages
        ],
        temperature: 0.3
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }
    
    const data = await response.json();
    
    // Convert OpenAI response to Anthropic format
    return {
      content: [{
        type: 'text',
        text: data.choices[0].message.content
      }]
    };
  },
  
  /**
   * Parse the AI response into structured solution
   */
  parseSolution(apiResponse, originalInput) {
    try {
      console.log('🔍 Parsing API response...');
      console.log('📦 Full API response:', JSON.stringify(apiResponse, null, 2));
      
      // Extract text from response
      const text = apiResponse.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');
      
      console.log('📝 Extracted text:', text);
      
      // Try to parse as JSON
      let solution;
      
      // Remove markdown code blocks if present
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      console.log('🧹 Cleaned text:', cleanText);
      
      try {
        solution = JSON.parse(cleanText);
        console.log('✅ Parsed JSON solution:', solution);
      } catch (jsonError) {
        // If JSON parsing fails, create a simple solution
        console.warn('⚠️ Failed to parse JSON, creating fallback solution');
        console.warn('JSON error:', jsonError.message);
        solution = this.createFallbackSolution(text, originalInput);
      }
      
      // Validate solution structure
      if (!solution.problem) {
        console.warn('⚠️ Missing "problem" field, adding it');
        solution.problem = typeof originalInput === 'string' ? originalInput : 'Math problem from image';
      }
      
      if (!solution.steps || !Array.isArray(solution.steps)) {
        console.warn('⚠️ Missing or invalid "steps" field, creating from text');
        solution.steps = this.extractStepsFromText(text);
      }
      
      if (!solution.answer) {
        console.warn('⚠️ Missing "answer" field, extracting from text');
        solution.answer = this.extractAnswerFromText(text);
      }
      
      console.log('✅ Final solution:', solution);
      return solution;
      
    } catch (error) {
      console.error('❌ Parsing error:', error);
      console.error('Error stack:', error.stack);
      throw new Error('Failed to parse solution');
    }
  },
  
  /**
   * Create a fallback solution if JSON parsing fails
   */
  createFallbackSolution(text, originalInput) {
    console.log('🔧 Creating fallback solution from raw text');
    
    return {
      problem: typeof originalInput === 'string' ? originalInput : 'Math problem',
      steps: this.extractStepsFromText(text),
      answer: this.extractAnswerFromText(text)
    };
  },
  
  /**
   * Extract steps from plain text response
   */
  extractStepsFromText(text) {
    const lines = text.split('\n').filter(line => line.trim());
    const steps = [];
    
    // Try to find numbered steps
    lines.forEach((line, index) => {
      // Match patterns like "1.", "Step 1:", "1)", etc.
      const stepMatch = line.match(/^(?:Step\s+)?(\d+)[\.:)]\s*(.+)$/i);
      if (stepMatch) {
        steps.push({
          step: parseInt(stepMatch[1]),
          description: stepMatch[2].trim(),
          equation: stepMatch[2].trim()
        });
      }
    });
    
    // If no numbered steps found, create one from the whole text
    if (steps.length === 0) {
      steps.push({
        step: 1,
        description: 'Solution',
        equation: text.substring(0, 200)
      });
    }
    
    return steps;
  },
  
  /**
   * Extract answer from text
   */
  extractAnswerFromText(text) {
    // Try to find patterns like "x = 5" or "Answer: 5" or "= 5"
    const answerPatterns = [
      /(?:answer|result|solution):\s*(.+?)(?:\n|$)/i,
      /(?:final answer|the answer is):\s*(.+?)(?:\n|$)/i,
      /=\s*([^\n=]+?)(?:\n|$)/,
      /x\s*=\s*([^\n]+?)(?:\n|$)/i
    ];
    
    for (const pattern of answerPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    // If nothing found, return last line
    const lines = text.split('\n').filter(l => l.trim());
    return lines[lines.length - 1] || 'See solution above';
  }
};

// Export the unified client
window.APIClient = APIClient;