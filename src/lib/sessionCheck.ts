import { getIsTossLoginIntegratedService } from '@apps-in-toss/web-framework';

export async function checkTossSession(): Promise<boolean> {
  try {
    return (await getIsTossLoginIntegratedService()) === true;
  } catch {
    return false;
  }
}
