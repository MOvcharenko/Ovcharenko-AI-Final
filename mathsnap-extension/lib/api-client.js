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
              text: `Solve this math problem step by step.

Return ONLY a JSON object with this EXACT format:
{
  "problem": "the original problem",
  "steps": [
    {"step": 1, "description": "Subtract 5 from both sides", "equation": "2x + 5 - 5 = 15 - 5"},
    {"step": 2, "description": "Simplify", "equation": "2x = 10"}
  ],
  "answer": "x = 5"
}

No other text, just the JSON.`
            }
          ]
        }
      ];
    } else {
      return [
        {
          role: 'user',
          content: `Solve this math problem step by step: ${input}

Return ONLY a JSON object with this EXACT format:
{
  "problem": "${input}",
  "steps": [
    {"step": 1, "description": "what we do in this step", "equation": "the equation"},
    {"step": 2, "description": "next step", "equation": "simplified equation"}
  ],
  "answer": "final answer"
}

No other text, just the JSON.`
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
      console.log('📏 Text length:', text.length);
      
      // Try to parse as JSON
      let solution;
      
      // Remove markdown code blocks if present
      let cleanText = text.replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();
      
      // Also try to extract JSON from text if it's wrapped in other content
      const jsonMatch = text.match(/\{[\s\S]*"problem"[\s\S]*"steps"[\s\S]*"answer"[\s\S]*\}/);
      if (jsonMatch) {
        cleanText = jsonMatch[0];
        console.log('🎯 Found JSON in text:', cleanText);
      }
      
      console.log('🧹 Cleaned text for parsing:', cleanText.substring(0, 200) + '...');
      
      try {
        solution = JSON.parse(cleanText);
        console.log('✅ Successfully parsed JSON solution:', JSON.stringify(solution, null, 2));
      } catch (jsonError) {
        console.warn('⚠️ Failed to parse JSON:', jsonError.message);
        console.warn('Attempted to parse:', cleanText.substring(0, 100));
        solution = this.createFallbackSolution(text, originalInput);
      }
      
      // Validate and fix solution structure
      if (!solution.problem) {
        console.warn('⚠️ Missing "problem" field, adding it');
        solution.problem = typeof originalInput === 'string' ? originalInput : 'Math problem';
      }
      
      // Fix steps format if needed
      if (!solution.steps || !Array.isArray(solution.steps) || solution.steps.length === 0) {
        console.warn('⚠️ Missing or invalid "steps" field');
        console.log('Current steps:', solution.steps);
        solution.steps = this.extractStepsFromText(text);
      } else if (typeof solution.steps[0] === 'string') {
        // Steps are strings, convert to objects
        console.log('🔧 Converting string steps to objects');
        solution.steps = solution.steps.map((stepText, index) => ({
          step: index + 1,
          description: index === 0 ? 'Starting equation' : `Step ${index}`,
          equation: stepText
        }));
      } else if (!solution.steps[0].step || !solution.steps[0].equation) {
        // Steps are objects but missing required fields
        console.log('🔧 Fixing step objects');
        solution.steps = solution.steps.map((step, index) => ({
          step: step.step || index + 1,
          description: step.description || `Step ${index + 1}`,
          equation: step.equation || step.text || step.expression || ''
        }));
      }
      
      // Fix answer field
      if (!solution.answer) {
        console.warn('⚠️ Missing "answer" field, extracting from text');
        // Check for "solution" field (what Claude returned)
        if (solution.solution) {
          solution.answer = solution.solution;
        } else {
          solution.answer = this.extractAnswerFromText(text, solution);
        }
      }
      
      console.log('✅ Final validated solution:', JSON.stringify(solution, null, 2));
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
  extractAnswerFromText(text, solution) {
    // First check if answer is in the solution object but wrong format
    if (solution && solution.answer && solution.answer !== '') {
      return solution.answer;
    }
    
    // Try to find patterns like "x = 5" or "Answer: 5" or "= 5"
    const answerPatterns = [
      /(?:final\s+answer|answer|result|solution)[:\s]+([^\n]+?)(?:\n|$)/i,
      /(?:therefore|thus|so)[,:\s]+x\s*=\s*([^\n]+?)(?:\n|$)/i,
      /x\s*=\s*([^\n]+?)(?:\n|$)/i,
      /=\s*([0-9\-+*/\.\s]+?)(?:\n|$)/
    ];
    
    for (const pattern of answerPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // Check last step for answer
    if (solution && solution.steps && solution.steps.length > 0) {
      const lastStep = solution.steps[solution.steps.length - 1];
      if (lastStep.equation) {
        // Extract value after = in last equation
        const eqMatch = lastStep.equation.match(/=\s*([^\n]+)$/);
        if (eqMatch) {
          return eqMatch[1].trim();
        }
        return lastStep.equation;
      }
    }
    
    // If nothing found, return last non-empty line
    const lines = text.split('\n').filter(l => l.trim());
    return lines[lines.length - 1]?.trim() || 'See solution above';
  }
};

// Export the unified client
window.APIClient = APIClient;