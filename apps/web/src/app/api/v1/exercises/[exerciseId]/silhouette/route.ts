import { uploadExerciseSilhouette, IMAGE_MAX_BYTES } from '@tp/application';
import { DomainError } from '@tp/domain';
import { authedRoute } from '@/server/api';

/** multipart/form-data with a `file` field. The image type is sniffed from its bytes. */
export const POST = authedRoute(async ({ req, ctx, params }) => {
  const len = Number(req.headers.get('content-length') ?? '0');
  if (len > IMAGE_MAX_BYTES + 64 * 1024)
    throw new DomainError('validation', 'La imagen debe ocupar como máximo 2 MB.', {
      file: ['too_large'],
    });
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string')
    throw new DomainError('validation', 'Falta el archivo.', { file: ['required'] });
  return uploadExerciseSilhouette(
    ctx,
    params.exerciseId!,
    new Uint8Array(await file.arrayBuffer()),
  );
});
