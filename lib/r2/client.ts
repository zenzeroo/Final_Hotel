import { S3Client } from '@aws-sdk/client-s3'
import { env, hasR2 } from '../env'

/**
 * Server-side R2 client (S3-compatible).
 * Used by migration scripts and server-side uploads.
 * Returns null if R2 credentials are not configured.
 */
export const r2Client = hasR2
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null

export const R2_BUCKET = env.R2_BUCKET_NAME
