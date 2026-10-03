import 'dotenv/config';
import { prepareTestDatabase } from '@tp/db/testing';

export default async function setup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is required for integration tests');
  await prepareTestDatabase(url);
}
