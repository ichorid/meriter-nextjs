import {
  Publication,
  Wallet,
  Capitalization,
  Transaction,
  Entity,
  SentTGMessageLog,
} from "projects/meriter/schema/index.schema";
import { balanceOfPublicationCalc } from "projects/meriter/actions/transaction";
import { MARKET_TG_CHAT_ID } from "projects/meriter/config";
import transaction from "./transaction";

export default async (req, res) => {
  //const user = await getAuth(req, res);
  /*console.dir(req.body);

  let p = await (Publication as any).find({});
  let w = await (Wallet as any).find({});
  let c = await (Capitalization as any).find({});
  let t = await (Transaction as any).find({});
  let e = await (Entity as any).find({});
  let s = await (SentTGMessageLog as any).find({});

  await Wallet.deleteMany({ currencyOfCommunityTgChatId: MARKET_TG_CHAT_ID });

  //let b = await balanceOfPublicationCalc({ publicationSlug: "CR57csdLx" });
  */

  //res.json({ t, p, w, c, s });

  const t =await (Transaction as any).findOne({_id:"5facfb919026780a7089656d"})
  res.json({t});
};
