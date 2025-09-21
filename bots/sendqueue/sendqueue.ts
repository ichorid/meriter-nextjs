import { Bots } from "bots/bots.data";
import { telegramSendMessage } from "bots/telegram/telegramapi";
import { textToHTML, textToTelegramHTML } from "utils/text";
import { Sendqueue } from "./sendqueue.model";
import { ISendqueue } from "./sendqueue.type";

export async function sendqueueSendSomeOfMeantTo(
    now = Date.now(),
    caller = ""
) {
    [1, 2];
}

export async function sendEmail(email: ISendqueue) {
    // if (!result || (result as any)?.error) return result
}

export async function sendSMS(sms: ISendqueue) {}
export async function sendTelegram(telegram: ISendqueue) {
    if (process.env.NODE_ENV === "test") {
        console.log("emulate send telegram", telegram.uid);
        return "ok";
    }
    const projects = {};

    try {
        const result = await telegramSendMessage(
            Bots.telegram[projects[telegram.fromId]].token,
            telegram.recieverId,
            textToTelegramHTML(telegram.text)
        );

        return "ok";
    } catch (e) {
        return e;
    }
}

export async function sendqueuePush(message: ISendqueue) {
    return await Sendqueue.create(message);
}

export const senqueueProjectParams = {
    meritterra: {
        senderName: "Meriter",
    },
    test: {
        senderName: "Test Sender",
    },
};
