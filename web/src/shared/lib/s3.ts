import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import stream from 'stream'
import { config } from '@/config'

// Check if S3 is configured
const isS3Enabled = () => {
    return config.s3.enabled;
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
                    accessKeyId: config.s3.accessKeyId!,
                    secretAccessKey: config.s3.secretAccessKey!,
                },
                endpoint: config.s3.endpoint,
                region: config.s3.region,
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
