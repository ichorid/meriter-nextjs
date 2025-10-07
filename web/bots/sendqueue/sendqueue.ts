import { telegramSendMessage } from "bots/telegram/telegramapi";
import { textToHTML, textToTelegramHTML } from "utils/text";
import { Sendqueue } from "./sendqueue.model";
import { ISendqueue } from "./sendqueue.type";
import { BOT_TOKEN } from "projects/meriter/config";

export async function sendqueueSendSomeOfMeantTo(
    now = Date.now(),
    caller = ""
) {
    [1, 2];
}

export async function sendTelegram(telegram: ISendqueue) {
    if (process.env.NODE_ENV === "test") {
        console.log("emulate send telegram", telegram.uid);
        return "ok";
    }

    try {
        const result = await telegramSendMessage(
            BOT_TOKEN,
            telegram.recieverId,
            textToTelegramHTML(telegram.text)
        );

        return "ok";
    } catch (e) {
        return e;
    }
}

export async function sendqueuePush(message: ISendqueue) {
    return await (Sendqueue as any).create(message);
}

export const senqueueProjectParams = {
    meritterra: {
        senderName: "Meriter",
    },
    test: {
        senderName: "Test Sender",
    },
};
