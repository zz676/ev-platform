// Mock OpenAI before importing the module
const mockCreate = jest.fn();
const mockImagesGenerate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
    images: {
      generate: mockImagesGenerate,
    },
  }));
});

describe('ai.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset modules to clear cached imports
    jest.resetModules();
  });

  describe('generatePostImage', () => {
    it('should generate an image with DALL-E 3', async () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';

      mockImagesGenerate.mockResolvedValueOnce({
        data: [
          { url: 'https://dalle.example.com/generated-image.png' },
        ],
      });

      // Re-import after setting up mocks
      const { generatePostImage } = await import('../ai');

      const result = await generatePostImage(
        'BYD Sets New Sales Record',
        'BYD delivered 300K+ vehicles in January 2025'
      );

      expect(result).toBe('https://dalle.example.com/generated-image.png');
      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'dall-e-3',
          n: 1,
          size: '1024x1024',
          quality: 'standard',
        })
      );

      // Verify prompt contains title and summary context
      const call = mockImagesGenerate.mock.calls[0][0];
      expect(call.prompt).toContain('BYD Sets New Sales Record');
      expect(call.prompt).toContain('electric vehicle');
    });

    it('should throw error when OpenAI key is not configured', async () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.DEEPSEEK_API_KEY;

      const { generatePostImage } = await import('../ai');

      await expect(generatePostImage('Test', 'Test summary'))
        .rejects.toThrow('OpenAI API key required for image generation');
    });

    it('should throw error when no data is returned', async () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';

      mockImagesGenerate.mockResolvedValueOnce({
        data: [],
      });

      const { generatePostImage } = await import('../ai');

      await expect(generatePostImage('Test', 'Test summary'))
        .rejects.toThrow('Failed to generate image: no data returned');
    });

    it('should throw error when no URL is returned', async () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';

      mockImagesGenerate.mockResolvedValueOnce({
        data: [{ url: undefined }],
      });

      const { generatePostImage } = await import('../ai');

      await expect(generatePostImage('Test', 'Test summary'))
        .rejects.toThrow('Failed to generate image: no URL returned');
    });

    it('should truncate long summaries in prompt', async () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';
      const longSummary = 'A'.repeat(500);

      mockImagesGenerate.mockResolvedValueOnce({
        data: [{ url: 'https://example.com/image.png' }],
      });

      const { generatePostImage } = await import('../ai');
      await generatePostImage('Test Title', longSummary);

      const call = mockImagesGenerate.mock.calls[0][0];
      // Summary should be sliced to 200 chars in prompt
      expect(call.prompt).not.toContain('A'.repeat(300));
    });
  });

  describe('getAIClient', () => {
    it('should prefer DeepSeek when both keys are available', async () => {
      process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
      process.env.OPENAI_API_KEY = 'test-openai-key';

      const { getAIClient } = await import('../ai');
      const { model } = await getAIClient();

      expect(model).toBe('deepseek-chat');
    });

    it('should fall back to OpenAI when DeepSeek key is missing', async () => {
      delete process.env.DEEPSEEK_API_KEY;
      process.env.OPENAI_API_KEY = 'test-openai-key';

      const { getAIClient } = await import('../ai');
      const { model } = await getAIClient();

      expect(model).toBe('gpt-4o-mini');
    });

    it('should throw error when no API keys are configured', async () => {
      delete process.env.DEEPSEEK_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const { getAIClient } = await import('../ai');

      await expect(getAIClient()).rejects.toThrow('No AI provider configured');
    });
  });

  describe('processEVContent', () => {
    it('should process content and return structured JSON', async () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';

      const mockResponse = {
        relevance_score: 85,
        categories: ['BYD', 'Sales'],
        translated_title: 'BYD January Sales Hit Record',
        translated_content: 'BYD delivered over 300,000 vehicles...',
        x_summary: 'BYD delivers 300K+ vehicles in January, up 45% YoY.',
        hashtags: ['#BYD', '#ChinaEV', '#EVSales'],
      };

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify(mockResponse),
            },
          },
        ],
      });

      const { processEVContent } = await import('../ai');
      const result = await processEVContent(
        '比亚迪1月销量突破30万',
        'OFFICIAL'
      );

      expect(result).toEqual(mockResponse);
      expect(result.relevance_score).toBe(85);
      expect(result.categories).toContain('BYD');
    });

    it('should return null when AI returns no content', async () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      });

      const { processEVContent } = await import('../ai');
      const result = await processEVContent('Test content', 'WEIBO');

      expect(result).toBeNull();
    });
  });

  describe('translateContent', () => {
    it('should translate Chinese content to English', async () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: 'BYD delivered 300,000 vehicles in January',
            },
          },
        ],
      });

      const { translateContent } = await import('../ai');
      const result = await translateContent('比亚迪1月交付30万辆');

      expect(result).toBe('BYD delivered 300,000 vehicles in January');
    });
  });

  describe('generateXSummary', () => {
    it('should generate a concise X summary', async () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: 'BYD hits 300K deliveries in Jan, up 45% YoY',
            },
          },
        ],
      });

      const { generateXSummary } = await import('../ai');
      const result = await generateXSummary('BYD delivered over 300,000 vehicles...');

      expect(result).toBe('BYD hits 300K deliveries in Jan, up 45% YoY');
    });
  });
});
