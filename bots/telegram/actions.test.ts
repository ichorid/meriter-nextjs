import { telegramGetChatPhotoUrl } from './actions'
import { Bots } from '../bots.data'
const token = Bots.telegram['@meriterrabot'].token

describe('telegramGetChatPhotoUrl', () => {
    test('puts photo to s3', async () => {
        await telegramGetChatPhotoUrl(token, 12123123)
    })
})

export {}
