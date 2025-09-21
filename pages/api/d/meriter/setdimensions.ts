import { iUser, Publication, Transaction } from "projects/meriter/schema/index.schema";
import { getAuth } from "projects/meriter/utils/auth";
import { noMongoInjection } from "utils/security";
  
export default async (req, res) => {
    noMongoInjection(req,res);
    const user:iUser = await getAuth(req, res);
    
    const {publicationSlug,transactionId,dimensions} = req.body;

    if (publicationSlug){
        const isMy = await Publication.count({slug:String(publicationSlug),tgAuthorId:user.tgUserId});
        if (!isMy) return res.status(403).json({error:"not your publication"}) 

        await Publication.updateOne({slug:String(publicationSlug)},{dimensions})

       return res.json({ok:true})
    }

    if (transactionId){
        const isMy = await Transaction.count({_id:String(transactionId),tgAuthorId:user.tgUserId});
        if (!isMy) return res.status(403).json({error:"not your publication"}) 

        await Transaction.updateOne({slug:String(publicationSlug)},{dimensions})

       return res.json({ok:true})
    }
    return res.status(400).json({})
    
  
    
  };
  