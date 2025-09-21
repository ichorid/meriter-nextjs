import {
  balanceOfPublicationCalc,
  walletUpdate,
} from "projects/meriter/actions/transaction";
import { getAuth } from "projects/meriter/utils/auth";
import { MERITERRA_TG_CHAT_ID } from "projects/meriter/config";

export default async (req, res) => {
  const user = await getAuth(req, res);

  //console.dir(req.body);

  await walletUpdate({
    tgUserId: user.tgUserId,
    currencyOfCommunityTgChatId: MERITERRA_TG_CHAT_ID,
    delta: 5,
  });
  await walletUpdate({
    tgUserId: user.tgUserId,
    currencyOfCommunityTgChatId: -1001165010428,
    delta: 10,
  });

  //let b = await balanceOfPublicationCalc({ publicationSlug: "CR57csdLx" });

  res.json({ ok: "added 5 merits and 10 turgiks" });
};
