import { Space, Transaction, User } from "projects/meriter/schema/index.schema";
import { dimensionConfigExample } from "projects/meriter/schema/types";
import { linkResolveShort, linkSet } from "transactions/links/links";
import { mongooseConnect, mongooseTypes } from "utils/mongooseconnect";
import { noMongoInjection } from "utils/security";

export default async (req, res) => {
    const { fullPath, short_id } = req.query;
    noMongoInjection(req, res);
    console.log('redirectLink')
    if (fullPath) {
        console.log('fullPath')
        const link = await linkSet(
            {
                fullPath,
            },
            999999
        );
        return res.json({ short_id: link?.short_id });
    }

    if (short_id) {
        const payload = await linkResolveShort(short_id);
        return res.json({ fullPath: payload?.fullPath });
    }
    res.json({});
};
