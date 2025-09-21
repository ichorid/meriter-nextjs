import Axios from "axios";
import { textToHTML } from "utils/text";

const unisender = {
    URL: "",
    token: "",
    sender_email: "",
    sender_name: "",
    list_id: 20818987,
};
function uniPOST(url, data) {
    console.log(unisender.URL + url, { ...data, api_key: unisender.token });
    return Axios.get(unisender.URL + url, {
        params: { ...data, api_key: unisender.token },
    }).then((d) => d.data);
}

export async function unisenderSendMail(
    email,
    subject,
    body,
    sender_name = unisender.sender_name,
    sender_email = unisender.sender_email
) {
    console.log("unisender send email");
    try {
        await uniPOST("/sendEmail", {
            list_id: unisender.list_id,
            email,
            subject,
            body: textToHTML(body),
            sender_name,
            sender_email,
        });
        return "ok";
    } catch (e) {
        return e;
    }
}
export async function unisenderSendMailFromScope(scope, email, subject, body) {
    throw "no email sender on scope";
}
