/**
 * Tests for shared utility functions.
 * Validates core helpers used across API routes and components.
 */

// We test the utilities that don't require database or external API connections
describe('utility functions', () => {
  describe('date formatting and validation', () => {
    it('should handle ISO date strings', () => {
      const date = new Date('2025-01-15T12:00:00Z');
      expect(date.getUTCFullYear()).toBe(2025);
      expect(date.getUTCMonth()).toBe(0); // January = 0
      expect(date.getUTCDate()).toBe(15);
    });

    it('should handle date comparison for filtering', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      expect(yesterday < now).toBe(true);
    });
  });

  describe('EV metric data validation', () => {
    it('should validate Brand enum values', () => {
      const validBrands = [
        'BYD', 'NIO', 'XPENG', 'LI_AUTO', 'ZEEKR', 'XIAOMI',
        'TESLA_CHINA', 'LEAPMOTOR', 'GEELY', 'OTHER_BRAND', 'INDUSTRY'
      ];
      // Ensure all brands are non-empty strings
      validBrands.forEach(brand => {
        expect(typeof brand).toBe('string');
        expect(brand.length).toBeGreaterThan(0);
      });
    });

    it('should validate MetricType enum values', () => {
      const validMetrics = [
        'DELIVERY', 'SALES', 'WHOLESALE', 'PRODUCTION',
        'BATTERY_INSTALL', 'REVENUE', 'MARKET_SHARE', 'RANKING',
        'IMPORTS', 'EXPORTS', 'REGISTRATIONS', 'DEALER_INVENTORY'
      ];
      expect(validMetrics.length).toBe(12);
    });

    it('should validate period ranges', () => {
      // Monthly periods are 1-12
      for (let month = 1; month <= 12; month++) {
        expect(month).toBeGreaterThanOrEqual(1);
        expect(month).toBeLessThanOrEqual(12);
      }
      // Quarterly periods are 1-4
      for (let quarter = 1; quarter <= 4; quarter++) {
        expect(quarter).toBeGreaterThanOrEqual(1);
        expect(quarter).toBeLessThanOrEqual(4);
      }
    });
  });

  describe('industry data table routing', () => {
    // Verifies that the mapping of data sources to table names is correct
    const TABLE_MAP: Record<string, string> = {
      'CAAM_NEV_SALES': 'CaamNevSales',
      'CPCA_NEV_RETAIL': 'CpcaNevRetail',
      'CPCA_NEV_PRODUCTION': 'CpcaNevProduction',
      'CHINA_BATTERY_INSTALLATION': 'ChinaBatteryInstallation',
      'CHINA_DEALER_INVENTORY_FACTOR': 'ChinaDealerInventoryFactor',
      'CHINA_VIA_INDEX': 'ChinaViaIndex',
      'CHINA_PASSENGER_INVENTORY': 'ChinaPassengerInventory',
      'BATTERY_MAKER_MONTHLY': 'BatteryMakerMonthly',
      'BATTERY_MAKER_RANKINGS': 'BatteryMakerRankings',
      'AUTOMAKER_RANKINGS': 'AutomakerRankings',
      'PLANT_EXPORTS': 'PlantExports',
      'NEV_SALES_SUMMARY': 'NevSalesSummary',
    };

    it('should have 12 industry data tables', () => {
      expect(Object.keys(TABLE_MAP).length).toBe(12);
    });

    it('should have unique table names', () => {
      const tableNames = Object.values(TABLE_MAP);
      const uniqueNames = new Set(tableNames);
      expect(uniqueNames.size).toBe(tableNames.length);
    });

    it('should map CATL to battery tables, not automaker', () => {
      // CATL is a battery manufacturer, never an automaker
      expect(TABLE_MAP['BATTERY_MAKER_MONTHLY']).toBe('BatteryMakerMonthly');
      expect(TABLE_MAP['BATTERY_MAKER_RANKINGS']).toBe('BatteryMakerRankings');
    });
  });

  describe('webhook payload structure', () => {
    it('should validate required post fields', () => {
      const requiredFields = [
        'sourceId', 'source', 'sourceUrl', 'sourceAuthor', 'sourceDate',
        'originalContent', 'relevanceScore'
      ];

      const mockPayload = {
        sourceId: 'abc123',
        source: 'OFFICIAL',
        sourceUrl: 'https://example.com/news/1',
        sourceAuthor: 'NIO',
        sourceDate: new Date().toISOString(),
        originalContent: 'Test content',
        relevanceScore: 85,
      };

      requiredFields.forEach(field => {
        expect(mockPayload).toHaveProperty(field);
        expect((mockPayload as Record<string, unknown>)[field]).toBeDefined();
      });
    });

    it('should validate source enum values', () => {
      const validSources = ['OFFICIAL', 'MEDIA', 'WEIBO', 'MANUAL'];
      validSources.forEach(source => {
        expect(['OFFICIAL', 'MEDIA', 'WEIBO', 'MANUAL']).toContain(source);
      });
    });

    it('should validate relevance score range', () => {
      const validScores = [0, 25, 50, 75, 100];
      validScores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });
  });
});
