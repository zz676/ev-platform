import { formatTweetContent } from '../twitter';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('twitter.ts', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('formatTweetContent', () => {
    it('should format a basic post correctly', () => {
      const post = {
        translatedTitle: 'BYD Sets New Sales Record',
        translatedSummary: 'BYD delivered 300K+ vehicles in January 2025, up 45% YoY.',
        categories: ['BYD', 'Sales'],
        source: 'OFFICIAL',
        sourceUrl: 'https://example.com/news/1',
      };

      const result = formatTweetContent(post);

      expect(result).toContain('BYD');
      expect(result).toContain('BYD Sets New Sales Record');
      expect(result).toContain('300K+');
      expect(result).toContain('#ChinaEV');
      expect(result).toContain('#BYD');
      expect(result).toContain('#Sales');
      expect(result).toContain('Source: Official');
      expect(result).toContain('https://test.chinaevnews.com');
    });

    it('should use correct emoji for different categories', () => {
      const categories = [
        { cat: 'BYD', emoji: '🔋' },
        { cat: 'NIO', emoji: '🔵' },
        { cat: 'XPeng', emoji: '🟢' },
        { cat: 'Li Auto', emoji: '💜' },
        { cat: 'Xiaomi', emoji: '🟠' },
        { cat: 'Zeekr', emoji: '⚡' },
        { cat: 'Sales', emoji: '📊' },
        { cat: 'Technology', emoji: '🔧' },
        { cat: 'Policy', emoji: '📋' },
        { cat: 'Charging', emoji: '🔌' },
        { cat: 'Unknown', emoji: '🚗' }, // default
      ];

      for (const { cat, emoji } of categories) {
        const post = {
          translatedTitle: 'Test Title',
          translatedSummary: 'Test summary',
          categories: [cat],
          source: 'OFFICIAL',
          sourceUrl: 'https://example.com',
        };

        const result = formatTweetContent(post);
        expect(result).toContain(emoji);
      }
    });

    it('should handle post without title', () => {
      const post = {
        translatedTitle: null,
        translatedSummary: 'Just a summary without title',
        categories: ['NIO'],
        source: 'WEIBO',
        sourceUrl: 'https://example.com',
      };

      const result = formatTweetContent(post);

      expect(result).toContain('🔵 NIO');
      expect(result).not.toContain('|'); // No title separator
      expect(result).toContain('Just a summary');
      expect(result).toContain('Source: Weibo');
    });

    it('should format different source types correctly', () => {
      const sources = [
        { source: 'OFFICIAL', label: 'Official' },
        { source: 'MEDIA', label: 'Media' },
        { source: 'WEIBO', label: 'Weibo' },
        { source: 'MANUAL', label: 'Report' },
      ];

      for (const { source, label } of sources) {
        const post = {
          translatedTitle: 'Test',
          translatedSummary: 'Test summary',
          categories: ['BYD'],
          source,
          sourceUrl: 'https://example.com',
        };

        const result = formatTweetContent(post);
        expect(result).toContain(`Source: ${label}`);
      }
    });

    it('should truncate long summaries to fit character limit', () => {
      const longSummary = 'A'.repeat(500); // Very long summary
      const post = {
        translatedTitle: 'Test Title',
        translatedSummary: longSummary,
        categories: ['BYD'],
        source: 'OFFICIAL',
        sourceUrl: 'https://example.com',
      };

      const result = formatTweetContent(post);

      // Tweet should not exceed 280 characters (though we have some flexibility with media)
      // The summary should be truncated with '...'
      expect(result).toContain('...');
      expect(result.length).toBeLessThan(400); // Allow some margin for formatting
    });

    it('should limit hashtags to 4 total (ChinaEV + 3 categories)', () => {
      const post = {
        translatedTitle: 'Test',
        translatedSummary: 'Test summary',
        categories: ['BYD', 'NIO', 'XPeng', 'Li Auto', 'Zeekr'], // 5 categories
        source: 'OFFICIAL',
        sourceUrl: 'https://example.com',
      };

      const result = formatTweetContent(post);
      const hashtagCount = (result.match(/#/g) || []).length;

      expect(hashtagCount).toBe(4); // #ChinaEV + 3 from categories
    });

    it('should sanitize category names for hashtags', () => {
      const post = {
        translatedTitle: 'Test',
        translatedSummary: 'Test summary',
        categories: ['Li Auto', 'New Energy Vehicle'],
        source: 'OFFICIAL',
        sourceUrl: 'https://example.com',
      };

      const result = formatTweetContent(post);

      expect(result).toContain('#LiAuto'); // Space removed
      expect(result).toContain('#NewEnergyVehicle'); // Spaces removed
    });

    it('should handle empty categories gracefully', () => {
      const post = {
        translatedTitle: 'Test',
        translatedSummary: 'Test summary',
        categories: [],
        source: 'OFFICIAL',
        sourceUrl: 'https://example.com',
      };

      const result = formatTweetContent(post);

      expect(result).toContain('🚗 EV News'); // Default category
      expect(result).toContain('#ChinaEV');
    });
  });

  describe('uploadMedia', () => {
    // We need to import dynamically to allow mocking
    let uploadMedia: typeof import('../twitter').uploadMedia;

    beforeEach(async () => {
      jest.resetModules();
      const twitter = await import('../twitter');
      uploadMedia = twitter.uploadMedia;
    });

    it('should upload media and return media id', async () => {
      // Mock image download
      const mockImageBuffer = Buffer.from('fake-image-data');
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(mockImageBuffer),
        })
        // Mock X API media upload response (v2 format)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: {
              id: '1234567890',
              media_key: '3_1234567890',
            },
          }),
        });

      const result = await uploadMedia('https://example.com/image.jpg');

      expect(result).toBe('1234567890');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Verify second call is to X API
      const uploadCall = mockFetch.mock.calls[1];
      expect(uploadCall[0]).toBe('https://api.x.com/2/media/upload');
      expect(uploadCall[1].method).toBe('POST');
      expect(uploadCall[1].headers['Content-Type']).toBe('application/json');

      // Verify JSON body contains required fields
      const body = JSON.parse(uploadCall[1].body);
      expect(body.media).toBeDefined();
      expect(body.media_category).toBe('tweet_image');
    });

    it('should throw error when image download fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(uploadMedia('https://example.com/missing.jpg'))
        .rejects.toThrow('Failed to download image: 404');
    });

    it('should throw error when X API returns error', async () => {
      // Mock successful image download
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(Buffer.from('fake-image')),
        })
        // Mock X API error
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          text: () => Promise.resolve('Forbidden'),
        });

      await expect(uploadMedia('https://example.com/image.jpg'))
        .rejects.toThrow('X Media Upload error: 403 - Forbidden');
    });
  });

  describe('postTweet', () => {
    let postTweet: typeof import('../twitter').postTweet;

    beforeEach(async () => {
      jest.resetModules();
      const twitter = await import('../twitter');
      postTweet = twitter.postTweet;
    });

    it('should post a tweet without media', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            id: '1234567890',
            text: 'Test tweet',
          },
        }),
      });

      const result = await postTweet('Test tweet');

      expect(result.data.id).toBe('1234567890');
      expect(result.data.text).toBe('Test tweet');

      const call = mockFetch.mock.calls[0];
      expect(call[0]).toBe('https://api.x.com/2/tweets');
      expect(call[1].method).toBe('POST');

      const body = JSON.parse(call[1].body);
      expect(body.text).toBe('Test tweet');
      expect(body.media).toBeUndefined();
    });

    it('should post a tweet with media', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            id: '1234567890',
            text: 'Test tweet with image',
          },
        }),
      });

      const result = await postTweet('Test tweet with image', ['9876543210']);

      expect(result.data.id).toBe('1234567890');

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.text).toBe('Test tweet with image');
      expect(body.media).toEqual({ media_ids: ['9876543210'] });
    });

    it('should throw error when X API returns error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          title: 'Forbidden',
          detail: 'You are not authorized to perform this action',
        }),
      });

      await expect(postTweet('Test tweet'))
        .rejects.toThrow('X API error: You are not authorized to perform this action');
    });
  });

  describe('verifyCredentials', () => {
    let verifyCredentials: typeof import('../twitter').verifyCredentials;

    beforeEach(async () => {
      jest.resetModules();
      const twitter = await import('../twitter');
      verifyCredentials = twitter.verifyCredentials;
    });

    it('should return true when credentials are valid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const result = await verifyCredentials();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.x.com/2/users/me',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer test-bearer-token',
          },
        })
      );
    });

    it('should return false when credentials are invalid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await verifyCredentials();

      expect(result).toBe(false);
    });

    it('should return false when fetch throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await verifyCredentials();

      expect(result).toBe(false);
    });
  });

  describe('X API v2 endpoint verification', () => {
    it('should use api.x.com domain for media upload', async () => {
      jest.resetModules();
      const twitter = await import('../twitter');

      // Mock successful responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(Buffer.from('fake-image')),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: { id: '123', media_key: '3_123' },
          }),
        });

      await twitter.uploadMedia('https://example.com/image.jpg');

      const uploadCall = mockFetch.mock.calls[1];
      expect(uploadCall[0]).toBe('https://api.x.com/2/media/upload');
    });

    it('should use api.x.com domain for posting tweets', async () => {
      jest.resetModules();
      const twitter = await import('../twitter');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: { id: '123', text: 'test' },
        }),
      });

      await twitter.postTweet('test');

      const call = mockFetch.mock.calls[0];
      expect(call[0]).toBe('https://api.x.com/2/tweets');
    });

    it('should use api.x.com domain for credential verification', async () => {
      jest.resetModules();
      const twitter = await import('../twitter');

      mockFetch.mockResolvedValueOnce({ ok: true });

      await twitter.verifyCredentials();

      const call = mockFetch.mock.calls[0];
      expect(call[0]).toBe('https://api.x.com/2/users/me');
    });
  });
});
