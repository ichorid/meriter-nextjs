import { getAuth } from "projects/meriter/utils/auth";

import { walletGet, walletsGet } from "projects/meriter/actions/transaction";

export default async (req, res) => {
  const { tgChatId, comm } = req.query as any;
  const user = await getAuth(req, res);
  const { tgUserId } = user ?? {};

  if (tgChatId) {
    const balance = await walletGet({
      tgUserId,
      currencyOfCommunityTgChatId: tgChatId,
    });
    return res.json({ balance });
  }

  if (comm) {
    const wallets = await walletsGet({ tgUserId: comm });
    return res.json({ wallets });
  }

  const wallets = await walletsGet({ tgUserId });
  return res.json({ wallets });
};
