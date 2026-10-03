import { beginTotpEnrollment } from '@tp/application';
import QRCode from 'qrcode';
import { authedRoute } from '@/server/api';

export const POST = authedRoute(async ({ ctx }) => {
  const { secret, uri } = await beginTotpEnrollment(ctx);
  return { secret, qrDataUrl: await QRCode.toDataURL(uri) };
});
