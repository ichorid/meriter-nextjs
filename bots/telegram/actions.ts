import { Bots } from "bots/bots.data";
import fileDownload from "js-file-download";
import {
    telegramGetChat,
    telegramGetFile,
    telegramPrepareFile,
} from "./telegramapi";
import fs from "fs";
import { uploadStream } from "utils/s3";
import Axios from "axios";
import sharp from "sharp";

export function telegramGetBotToken(name) {
    return Bots.telegram[name]?.token;
}

export async function telegramGetChatPhotoUrl(
    token,
    chat_id,
    revalidate = false
) {
    if (process.env.NODE_ENV === "test") return ``;

    try {
        const url = `https://telegram.hb.bizmrg.com/telegram_small_avatars/${chat_id}.jpg`;
        const status = await Axios.head(url).then((d) => d.status);
        if (status === 200)
            return `https://telegram.hb.bizmrg.com/telegram_small_avatars/${chat_id}.jpg`;
    } catch (e) {
        console.log("not found ", chat_id);
    }

    const chat = await telegramGetChat(token, chat_id).then((d) => d.data);

    const photo = chat?.result?.photo;

    //    console.log(chat)
    if (!photo) {
        const photoUrl2 = `telegram_small_avatars/${chat_id}.jpg`;

        const { writeStream: writeStream2, promise: promise2 } = uploadStream({
            Bucket: "telegram",
            Key: photoUrl2,
        });

        const toJpeg = sharp()
            .resize(200, 200)

            .jpeg({ quality: 100 });

        await Axios({
            method: "get",
            url: `https://avatars.dicebear.com/api/jdenticon/${chat_id}.svg`,
            responseType: "stream",
        }).then((d) => d.data.pipe(toJpeg).pipe(writeStream2));

        return null;
    }
    const { small_file_id, small_file_unique_id, big_file_id } = photo;
    const { file_path } = await telegramPrepareFile(token, small_file_id);
    const photoUrl = `telegram_images/${small_file_unique_id}.jpg`;
    const photoUrl2 = `telegram_small_avatars/${chat_id}.jpg`;
    //const photoUrl2 = `public/telegram_avatars/${small_file_unique_id}.jpg`
    const { writeStream, promise } = uploadStream({
        Bucket: "telegram",
        Key: photoUrl,
    });
    const { writeStream: writeStream2, promise: promise2 } = uploadStream({
        Bucket: "telegram",
        Key: photoUrl2,
    });
    const f = await telegramGetFile(token, file_path).then((d) => {
        d.data.pipe(writeStream);
        d.data.pipe(writeStream2);
        //console.log(d.headers);
        //writeFileSync(photoUrl,d.data)
        // fileDownload()
    }); //fileDownload(d,"public/tmp"));
    await Promise.all([promise, promise2]);

    return `https://telegram.hb.bizmrg.com/telegram_small_avatars/${chat_id}.jpg`;
}
