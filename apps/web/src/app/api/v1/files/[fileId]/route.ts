import { getFile } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => {
  const f = await getFile(ctx, params.fileId!);
  return new Response(Buffer.from(f.bytes), {
    headers: {
      'Content-Type': f.contentType,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  });
});
