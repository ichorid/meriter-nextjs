import { Space, Transaction, User } from "projects/meriter/schema/index.schema";
import { dimensionConfigExample } from "projects/meriter/schema/types";
import { mongooseConnect, mongooseTypes } from "utils/mongooseconnect";
import { noMongoInjection } from "utils/security";

export default async (req, res) => {
    const spaceSlug = req.query.spaceSlug;
    noMongoInjection(req, res);

    if (!spaceSlug) return res.json({});

    const aggr = await Transaction.aggregate([
        { $match: { inSpaceSlug: spaceSlug } },
        {
            $group: {
                _id: "$toUserTgId",
                rating: {
                    $sum: {
                        $cond: {
                            if: "$directionPlus",
                            then: "$amountTotal",
                            else: { $subtract: [0, "$amountTotal"] },
                        },
                    },
                },
            },
        },
    ]).sort({ rating: -1 });

    const ids = aggr.map((r) => r._id);
    console.log(ids);

    /*
    $cond: {
                            if: "$directionPlus",
                            then: "$amountTotal",
                            else: { $subtract: [0, "$amountTotal"] },
                        },
    */
    const users = await User.find({ tgUserId: { $in: ids } });

    const rank = aggr
        .map((a) => {
            const user = users.find((u) => u?.tgUserId === a._id);
            if (user && user.name)
                return {
                    name: user.name,
                    tgUserId: user?.tgUserId,
                    rating: a.rating,
                };
        })
        .filter((a) => a);
    //const space = await Space.findOne({ slug: spaceSlug });

    res.json({
        rank,
        aggr,
        users,
    });
};
