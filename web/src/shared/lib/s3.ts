import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import stream from 'stream'

// Check if S3 is configured
const isS3Enabled = () => {
    return !!(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
};

export const uploadStream = ({ Bucket, Key }: { Bucket: string; Key: string }) => {
    const pass = new stream.PassThrough()
    
    // Return no-op stream if S3 not configured
    if (!isS3Enabled()) {
        pass.on('data', () => {}); // consume data to prevent backpressure
        return {
            writeStream: pass,
            promise: Promise.resolve({ Location: null }), // resolve immediately with null
        };
    }

    const s3 = new S3Client({
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID!,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        },
        endpoint: process.env.S3_ENDPOINT || 'https://hb.bizmrg.com',
        region: process.env.S3_REGION || 'ru-msk',
    })

    const upload = new Upload({
        client: s3,
        params: {
            Bucket,
            Key,
            Body: pass,
            ACL: 'public-read',
        },
    })

    return {
        writeStream: pass,
        promise: upload.done(),
    }
}
/*
const { writeStream, promise } = uploadStream({Bucket: 'yourbucket', Key: 'yourfile.mp4'});
const readStream = fs.createReadStream('/path/to/yourfile.mp4');

const pipeline = readStream.pipe(writeStream);
*/
