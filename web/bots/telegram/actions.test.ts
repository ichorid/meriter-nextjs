import { telegramGetChatPhotoUrl } from './actions'
import { BOT_TOKEN } from 'projects/meriter/config'

describe('telegramGetChatPhotoUrl', () => {
    test('puts photo to s3', async () => {
        await telegramGetChatPhotoUrl(BOT_TOKEN, 12123123)
    })
})

export {}
