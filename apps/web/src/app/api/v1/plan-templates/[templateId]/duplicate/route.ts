import { duplicateTemplate } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

/** «Duplicar en mis plantillas»: an independent copy to edit. */
export const POST = authedRoute(async ({ req, ctx, params }) =>
  duplicateTemplate(ctx, params.templateId!, await readJson(req)),
);
