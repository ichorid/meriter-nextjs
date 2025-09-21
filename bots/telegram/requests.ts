export function emulateTgMessage({ text, fromTgUserId, fromTgUsername, inTgChatId, replyTo }: any) {
    return {
        update_id: 123123,
        message: {
            message_id: 5,
            from: {
                id: fromTgUserId,
                is_bot: false,
                first_name: "Test",
                last_name: "Name",
                username: fromTgUsername,
                language_code: "en",
            },
            chat: {
                id: inTgChatId,
                first_name: "Test",
                last_name: "Name",
                username: fromTgUsername,
                type: "private",
            },
            reply_to_message: replyTo
                ? {
                      message_id: replyTo,
                      from: [Object],
                      chat: [Object],
                      date: 1597612139,
                      text: "123",
                  }
                : undefined,
            date: 1597612175,
            text: text,
        },
    };
}

export function emulateTgAddedToChat({ tgUserName, toTgChatId }) {
    return {
        update_id: 123123,
        message: {
            message_id: 109,
            from: {
                id: 123123,
                is_bot: false,
                first_name: "name",
                last_name: "lastname",
                username: "username",
                language_code: "en",
            },
            chat: {
                id: toTgChatId,
                title: "Тест",
                username: "meriterratest",
                type: "supergroup",
            },
            date: 1597612392,
            new_chat_participant: {
                id: 123123,
                is_bot: true,
                first_name: "Meritterra",
                username: tgUserName,
            },
            new_chat_member: {
                id: 123123,
                is_bot: true,
                first_name: "Meritterra",
                username: tgUserName,
            },
            new_chat_members: [[1]],
        },
    };
}

export function emulateTgLeftChatMember() {
    return {
        update_id: 123123,
        message: {
            message_id: 108,
            from: {
                id: 123123,
                is_bot: false,
                first_name: "name",
                last_name: "lastname",
                username: "username",
                language_code: "en",
            },
            chat: { id: -123123, title: "Тест", type: "supergroup" },
            date: 1597612343,
            left_chat_participant: {
                id: 123123,
                is_bot: true,
                first_name: "Meritterra",
                username: "meritterrabot",
            },
            left_chat_member: {
                id: 123123,
                is_bot: true,
                first_name: "Meritterra",
                username: "meritterrabot",
            },
        },
    };
}
export function emulateTgMessageImage({ text, fromTgUserId, fromTgUsername, inTgChatId }: any) {
    return {
        update_id: 123123,
        message: {
            message_id: 110,
            from: {
                id: fromTgUserId,
                is_bot: false,
                first_name: "name",
                last_name: "lastname",
                username: fromTgUsername,
                language_code: "en",
            },
            chat: {
                id: inTgChatId,
                title: "Тест",
                username: "meriterratest",
                type: "supergroup",
            },
            date: 1597612687,
            photo: [[1], [1]],
            caption: text,
        },
    };
}
