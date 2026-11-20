import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/db/db';
import { resetAll } from '../src/db/repo';
import { lookupBarcode, OFF_ENDPOINT } from '../src/db/off';

const CODE = '3017624010701';
const body = {
  code: CODE,
  status: 1,
  product: { product_name: 'Choco Spread', brands: 'Acme', serving_quantity: 15, serving_size: '15 g', nutriments: { 'energy-kcal_100g': 540, proteins_100g: 6, carbohydrates_100g: 58, fat_100g: 31 } },
};
const ok = (json: unknown, status = 200) => ({ ok: status < 400, status, json: async () => json }) as Response;

beforeEach(async () => {
  await resetAll();
});

describe('lookupBarcode', () => {
  it('fetches from Open Food Facts, converts, and caches the product locally', async () => {
    const f = vi.fn().mockResolvedValue(ok(body));
    const r = await lookupBarcode(CODE, { fetchImpl: f as unknown as typeof fetch });
    expect(r.kind).toBe('found');
    if (r.kind !== 'found') return;
    expect(r.cached).toBe(false);
    expect(r.food).toMatchObject({ name: 'Choco Spread', kcal: 81, grams: 15, barcode: CODE });
    expect(String(f.mock.calls[0][0])).toContain(`${OFF_ENDPOINT}/${CODE}?fields=`);
    expect(await db.foods.get(`bc-${CODE}`)).toBeDefined();
  });

  it('second lookup is served from the device (works offline)', async () => {
    await lookupBarcode(CODE, { fetchImpl: vi.fn().mockResolvedValue(ok(body)) as unknown as typeof fetch });
    const boom = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const r = await lookupBarcode(CODE, { fetchImpl: boom as unknown as typeof fetch });
    expect(r.kind).toBe('found');
    expect(boom).not.toHaveBeenCalled();
    if (r.kind === 'found') expect(r.cached).toBe(true);
  });

  it('finds a user-created food that carries the barcode', async () => {
    await db.foods.put({ id: 'cmine', name: 'ขนมของฉัน', emoji: '🍪', serving: '1 ชิ้น', grams: 20, kcal: 90, protein: 1, carb: 12, fat: 4, source: 'custom', barcode: CODE });
    const boom = vi.fn();
    const r = await lookupBarcode(CODE, { fetchImpl: boom as unknown as typeof fetch });
    expect(r.kind === 'found' && r.food.id).toBe('cmine');
    expect(boom).not.toHaveBeenCalled();
  });

  it('404 and status 0 = not found; nothing is cached', async () => {
    expect((await lookupBarcode(CODE, { fetchImpl: vi.fn().mockResolvedValue(ok({}, 404)) as unknown as typeof fetch })).kind).toBe('notfound');
    expect((await lookupBarcode(CODE, { fetchImpl: vi.fn().mockResolvedValue(ok({ code: CODE, status: 0 })) as unknown as typeof fetch })).kind).toBe('notfound');
    expect(await db.foods.count()).toBe(0);
  });

  it('product without energy = nodata, not cached', async () => {
    const r = await lookupBarcode(CODE, { fetchImpl: vi.fn().mockResolvedValue(ok({ status: 1, product: { product_name: 'ไม่มีข้อมูล', nutriments: {} } })) as unknown as typeof fetch });
    expect(r).toEqual({ kind: 'nodata', name: 'ไม่มีข้อมูล' });
    expect(await db.foods.count()).toBe(0);
  });

  it('network failure and timeout = offline', async () => {
    expect((await lookupBarcode(CODE, { fetchImpl: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch })).kind).toBe('offline');
    const hang = ((_u: string, init?: RequestInit) =>
      new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))))) as unknown as typeof fetch;
    expect((await lookupBarcode(CODE, { fetchImpl: hang, timeoutMs: 20 })).kind).toBe('offline');
  });

  it('server error = error with a readable message', async () => {
    const r = await lookupBarcode(CODE, { fetchImpl: vi.fn().mockResolvedValue(ok({}, 503)) as unknown as typeof fetch });
    expect(r.kind).toBe('error');
  });
});
