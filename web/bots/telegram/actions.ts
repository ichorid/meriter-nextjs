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
import { BOT_TOKEN } from "projects/meriter/config";

export function telegramGetBotToken() {
    return BOT_TOKEN;
}

// Check if S3 is configured
const isS3Enabled = () => {
    return !!(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
};

export async function telegramGetChatPhotoUrl(
    token,
    chat_id,
    revalidate = false
) {
    // Return empty string if test mode or S3 disabled
    const telegramCdnUrl = process.env.TELEGRAM_CDN_URL || "https://telegram.hb.bizmrg.com";
    const dicebearApiUrl = process.env.DICEBEAR_API_URL || "https://avatars.dicebear.com";
    
    if (process.env.NODE_ENV === "test" || !isS3Enabled()) {
        return "";
    }

    try {
        const url = `${telegramCdnUrl}/telegram_small_avatars/${chat_id}.jpg`;
        const status = await Axios.head(url).then((d) => d.status);
        if (status === 200)
            return `${telegramCdnUrl}/telegram_small_avatars/${chat_id}.jpg`;
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
            url: `${dicebearApiUrl}/api/jdenticon/${chat_id}.svg`,
            responseType: "stream",
        }).then((d) => d.data.pipe(toJpeg).pipe(writeStream2));

        await promise2;
        return "";
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

    return `${telegramCdnUrl}/telegram_small_avatars/${chat_id}.jpg`;
}
