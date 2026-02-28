import { query } from '../config/database';
import logger from '../utils/logger';

export interface PriceSnapshot {
  id: number;
  productId: number;
  price: number;
  snapshotTime: Date;
  source?: string;
  metadata?: any;
}

export class PriceSnapshotService {
  async createSnapshot(
    productId: number,
    price: number,
    source: string = 'SYSTEM'
  ): Promise<PriceSnapshot> {
    const result = await query(
      `INSERT INTO price_snapshots (product_id, price, snapshot_time, source)
       VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
       RETURNING *`,
      [productId, price, source]
    );

    logger.debug(`Price snapshot created for product ${productId}: ${price}`);

    return result.rows[0];
  }

  async getLatestSnapshot(productId: number): Promise<PriceSnapshot | null> {
    const result = await query(
      `SELECT * FROM price_snapshots
       WHERE product_id = $1
       ORDER BY snapshot_time DESC
       LIMIT 1`,
      [productId]
    );

    return result.rows[0] || null;
  }

  async getSnapshotByTime(
    productId: number,
    snapshotTime: Date
  ): Promise<PriceSnapshot | null> {
    const result = await query(
      `SELECT * FROM price_snapshots
       WHERE product_id = $1 AND snapshot_time <= $2
       ORDER BY snapshot_time DESC
       LIMIT 1`,
      [productId, snapshotTime]
    );

    return result.rows[0] || null;
  }

  async createSnapshotsForAllProducts(
    products: Array<{ id: number; currentPrice: number }>,
    source: string = 'SYSTEM'
  ): Promise<PriceSnapshot[]> {
    const snapshots: PriceSnapshot[] = [];

    for (const product of products) {
      try {
        const snapshot = await this.createSnapshot(
          product.id,
          product.currentPrice,
          source
        );
        snapshots.push(snapshot);
      } catch (error) {
        logger.error(
          `Failed to create snapshot for product ${product.id}:`,
          error
        );
      }
    }

    return snapshots;
  }

  async cleanupOldSnapshots(retentionDays: number = 30): Promise<number> {
    const result = await query(
      `DELETE FROM price_snapshots
       WHERE snapshot_time < CURRENT_TIMESTAMP - INTERVAL '${retentionDays} days'
       RETURNING id`
    );

    logger.info(`Cleaned up ${result.rows.length} old price snapshots`);

    return result.rows.length;
  }
}

export const priceSnapshotService = new PriceSnapshotService();
