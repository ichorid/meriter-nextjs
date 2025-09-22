import S3 from 'aws-sdk/clients/s3'
const stream = require('stream')

export const uploadStream = ({ Bucket, Key }) => {
    const s3 = new S3({
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        endpoint: 'https://hb.bizmrg.com',
    })
    const pass = new stream.PassThrough()

    return {
        writeStream: pass,
        promise: s3.upload({ Bucket, Key, Body: pass, ACL: 'public-read' }).promise(),
    }
}
/*
const { writeStream, promise } = uploadStream({Bucket: 'yourbucket', Key: 'yourfile.mp4'});
const readStream = fs.createReadStream('/path/to/yourfile.mp4');

const pipeline = readStream.pipe(writeStream);
*/
