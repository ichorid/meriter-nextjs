import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import { ConfigService } from '@nestjs/config';

/**
 * Mail.ru OAuth Strategy
 */
@Injectable()
export class MailruStrategy extends PassportStrategy(Strategy, 'mailru') {
    private readonly logger = new Logger(MailruStrategy.name);

    constructor(private configService: ConfigService) {
        const clientID = process.env.OAUTH_MAILRU_CLIENT_ID;
        const clientSecret = process.env.OAUTH_MAILRU_CLIENT_SECRET;
        const callbackURL = process.env.OAUTH_MAILRU_REDIRECT_URI
            || process.env.OAUTH_MAILRU_CALLBACK_URL;

        if (!clientID || !clientSecret || !callbackURL) {
            throw new Error(
                'Mail.ru OAuth credentials not configured. ' +
                'Set OAUTH_MAILRU_CLIENT_ID, OAUTH_MAILRU_CLIENT_SECRET, and OAUTH_MAILRU_CALLBACK_URL.'
            );
        }

        super({
            authorizationURL: 'https://oauth.mail.ru/login',
            tokenURL: 'https://oauth.mail.ru/token',
            clientID,
            clientSecret,
            callbackURL,
            scope: ['userinfo'],
        });

        const logger = new Logger(MailruStrategy.name);
        logger.log(`Mail.ru OAuth strategy initialized with callbackURL: ${callbackURL}`);
    }

    async validate(
        accessToken: string,
        refreshToken: string,
        profile: any,
        done: (err: any, user: any, info?: any) => void,
    ): Promise<any> {
        const { id, email, first_name, last_name, nickname, image } = profile;

        const user = {
            provider: 'mailru',
            providerId: id,
            email: email,
            firstName: first_name || '',
            lastName: last_name || '',
            displayName: nickname || first_name || email,
            avatarUrl: image,
            accessToken,
            refreshToken,
        };

        this.logger.log(`Mail.ru OAuth validation successful for user: ${user.email}`);
        done(null, user);
    }

    // Override userProfile to fetch user info manually if needed, 
    // but passport-oauth2 might need standardizing.
    // Mail.ru usually returns JSON.
    userProfile(accessToken: string, done: (err?: Error | null, profile?: any) => void): void {
        fetch(`https://oauth.mail.ru/userinfo?access_token=${accessToken}`)
            .then(res => res.json())
            .then(json => {
                done(null, json);
            })
            .catch(err => {
                done(new Error(`Failed to fetch user profile: ${err.message}`));
            });
    }
}
