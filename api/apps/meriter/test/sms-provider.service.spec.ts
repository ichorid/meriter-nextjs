import { ConfigService } from '@nestjs/config';
import { SmsProviderService } from '../src/api-v1/auth/sms-provider.service';
import { AuthMagicLinkService } from '../src/api-v1/auth/auth-magic-link.service';

describe('SmsProviderService', () => {
  const authMagicLinkServiceMock = {
    createToken: jest.fn(),
  };

  function createService(config: Record<string, unknown>): SmsProviderService {
    const configService = {
      get: jest.fn((key: string) => config[key]),
    } as unknown as ConfigService;

    return new SmsProviderService(
      configService,
      {} as never,
      authMagicLinkServiceMock as unknown as AuthMagicLinkService,
    );
  }

  it('does not throw when SMS and phone auth are disabled without API credentials', () => {
    expect(() =>
      createService({
        sms: {
          enabled: false,
          provider: 'smsru',
          apiUrl: 'https://sms.ru/sms',
          testMode: false,
          otpLength: 6,
          otpExpiryMinutes: 5,
          maxAttemptsPerOtp: 3,
          rateLimitPerHour: 3,
          resendCooldownSeconds: 60,
        },
        phone: { enabled: false },
      }),
    ).not.toThrow();
  });

  it('throws when SMS is enabled but API ID is missing in production test mode', () => {
    expect(() =>
      createService({
        sms: {
          enabled: true,
          provider: 'smsru',
          apiUrl: 'https://sms.ru/sms',
          testMode: false,
          otpLength: 6,
          otpExpiryMinutes: 5,
          maxAttemptsPerOtp: 3,
          rateLimitPerHour: 3,
          resendCooldownSeconds: 60,
        },
        phone: { enabled: false },
      }),
    ).toThrow('SMS.ru API ID is required when not in test mode');
  });

  it('initiateCallVerification throws when provider was not initialized', async () => {
    const service = createService({
      sms: {
        enabled: false,
        provider: 'smsru',
        otpLength: 6,
        otpExpiryMinutes: 5,
        maxAttemptsPerOtp: 3,
        rateLimitPerHour: 3,
        resendCooldownSeconds: 60,
      },
      phone: { enabled: false },
    });

    await expect(service.initiateCallVerification('+79991234567')).rejects.toThrow(
      'SMS provider is not configured',
    );
  });
});
