import { listFindings, type FindingOption, type RequestContext } from '@tp/application';

/** Every visible finding for the claim editor picker (the API pages at 100). */
export async function allFindings(ctx: RequestContext): Promise<FindingOption[]> {
  const out: FindingOption[] = [];
  for (let offset = 0; offset < 2000; offset += 100) {
    const page = await listFindings(ctx, { limit: 100, offset });
    out.push(...page);
    if (page.length < 100) break;
  }
  return out;
}
