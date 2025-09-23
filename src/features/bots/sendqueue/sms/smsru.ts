import Axios from "axios";

const tokens = {};

export async function smsSend(project, phone, msg) {
    console.log("SEND SMS", project, phone, msg);
    if (tokens[project])
        return await Axios.get("https://sms.ru/sms/send", {
            params: {
                api_id: tokens[project],
                to: phone,
                msg,
                json: 1,
            },
        });
}
