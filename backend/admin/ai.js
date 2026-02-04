const express = require('express');
const Groq = require('groq-sdk');
const { adminAuth } = require('./auth');

const router = express.Router();

// Default model for text generation
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

/**
 * POST /admin/ai/generate
 * Generate text using Groq AI
 * 
 * Body:
 *   - prompt: string (required) - The user's request
 *   - system_prompt: string (optional) - System context for the AI
 *   - model: string (optional) - Groq model to use
 *   - max_tokens: number (optional) - Maximum tokens in response
 */
router.post('/generate', adminAuth, async (req, res) => {
    try {
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey) {
            return res.status(500).json({
                message: 'Groq API key not configured. Please set GROQ_API_KEY in environment variables.'
            });
        }

        const {
            prompt,
            system_prompt = 'You are a helpful assistant that generates text for a Telegram bot admin panel. Generate concise, friendly, and professional messages. Do not include any markdown formatting unless specifically requested.',
            model = DEFAULT_MODEL,
            max_tokens = 1024
        } = req.body || {};

        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
            return res.status(400).json({ message: 'Prompt is required' });
        }

        const groq = new Groq({ apiKey });

        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: system_prompt },
                { role: 'user', content: prompt.trim() }
            ],
            model,
            max_tokens,
            temperature: 0.7,
        });

        const generatedText = completion.choices?.[0]?.message?.content || '';

        res.json({
            ok: true,
            text: generatedText,
            model,
            usage: completion.usage
        });

    } catch (error) {
        console.error('Error generating AI text:', error);

        // Handle specific Groq errors
        if (error.status === 401) {
            return res.status(401).json({ message: 'Invalid Groq API key' });
        }
        if (error.status === 429) {
            return res.status(429).json({ message: 'Rate limit exceeded. Please try again later.' });
        }

        res.status(500).json({
            message: error.message || 'Failed to generate text'
        });
    }
});

/**
 * POST /admin/ai/generate-flow-question
 * Generate a complete flow question with options (for choice types)
 * 
 * Body:
 *   - prompt: string (required) - Description of what to ask
 *   - type: string (required) - Question type (text, single_choice, multi_choice, etc.)
 *   - model: string (optional) - Groq model to use
 */
router.post('/generate-flow-question', adminAuth, async (req, res) => {
    try {
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey) {
            return res.status(500).json({
                message: 'Groq API key not configured. Please set GROQ_API_KEY in environment variables.'
            });
        }

        const {
            prompt,
            type = 'text',
            model = DEFAULT_MODEL
        } = req.body || {};

        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
            return res.status(400).json({ message: 'Prompt is required' });
        }

        const groq = new Groq({ apiKey });

        const isChoiceType = type === 'single_choice' || type === 'multi_choice';

        const systemPrompt = isChoiceType
            ? `You are creating a question for a Telegram bot conversation flow.
The question type is: ${type}

You must respond with ONLY valid JSON in this exact format:
{
  "question": "Your question text here",
  "options": ["Option 1", "Option 2", "Option 3"]
}

Rules:
- The question should be friendly and conversational
- Keep it concise (1-2 sentences max)
- For single_choice: provide 2-5 options that make sense for the question
- For multi_choice: provide 2-6 options that users can select multiple of
- Do NOT use markdown formatting in the question
- Options should be short button labels (1-4 words each)
- Respond with ONLY the JSON, no other text`
            : `You are creating a question for a Telegram bot conversation flow.
The question type is: ${type}

Respond with ONLY the question text. Keep it:
- Friendly and conversational
- Concise (1-2 sentences max)
- No markdown formatting
- Appropriate for the question type (${type})`;

        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt.trim() }
            ],
            model,
            max_tokens: 512,
            temperature: 0.7,
        });

        const generatedContent = completion.choices?.[0]?.message?.content || '';

        let result = { question: '', options: [] };

        if (isChoiceType) {
            try {
                // Try to parse JSON from the response
                const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    result.question = parsed.question || '';
                    result.options = Array.isArray(parsed.options) ? parsed.options : [];
                } else {
                    // Fallback: use the content as question text
                    result.question = generatedContent.trim();
                }
            } catch (parseError) {
                // If JSON parsing fails, use the content as question text
                result.question = generatedContent.trim();
            }
        } else {
            result.question = generatedContent.trim();
        }

        res.json({
            ok: true,
            ...result,
            type,
            model,
            usage: completion.usage
        });

    } catch (error) {
        console.error('Error generating flow question:', error);

        if (error.status === 401) {
            return res.status(401).json({ message: 'Invalid Groq API key' });
        }
        if (error.status === 429) {
            return res.status(429).json({ message: 'Rate limit exceeded. Please try again later.' });
        }

        res.status(500).json({
            message: error.message || 'Failed to generate question'
        });
    }
});

/**
 * GET /admin/ai/status
 * Check if AI is configured and working
 */
router.get('/status', adminAuth, async (req, res) => {
    const apiKey = process.env.GROQ_API_KEY;

    res.json({
        configured: !!apiKey,
        model: DEFAULT_MODEL
    });
});

module.exports = router;
