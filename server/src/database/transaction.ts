import { db } from './init';

export interface TransactionOperation {
  query: string;
  params?: any[];
}

export class DatabaseTransaction {
  private operations: TransactionOperation[] = [];
  private isExecuted: boolean = false;

  /**
   * Add a database operation to the transaction
   */
  add(query: string, params?: any[]): this {
    if (this.isExecuted) {
      throw new Error('Cannot add operations to an already executed transaction');
    }
    
    this.operations.push({ query, params });
    return this;
  }

  /**
   * Execute all operations in a single transaction
   */
  async execute(): Promise<any[]> {
    if (this.isExecuted) {
      throw new Error('Transaction has already been executed');
    }

    this.isExecuted = true;

    return new Promise((resolve, reject) => {
      const results: any[] = [];

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        let operationCount = 0;
        let hasError = false;

        const executeOperation = (operation: TransactionOperation, index: number) => {
          return new Promise<any>((opResolve, opReject) => {
            const callback = function(this: any, err: Error | null) {
              if (err) {
                opReject(err); // Remove hasError setting here, let Promise.all handle rejections
              } else {
                // For INSERT operations, capture lastID
                const result = this.lastID ? { lastID: this.lastID, changes: this.changes } : { changes: this.changes };
                results[index] = result;
                opResolve(result);
              }
            };

            if (operation.query.trim().toUpperCase().startsWith('SELECT')) {
              db.get(operation.query, operation.params || [], (err, row) => {
                if (err) {
                  opReject(err); // Remove hasError setting here too
                } else {
                  results[index] = row;
                  opResolve(row);
                }
              });
            } else {
              db.run(operation.query, operation.params || [], callback);
            }
          });
        };

        // Execute all operations
        const operationPromises = this.operations.map((operation, index) => 
          executeOperation(operation, index)
        );

        Promise.all(operationPromises)
          .then(() => {
            // All operations succeeded, commit the transaction
            db.run('COMMIT', (err) => {
              if (err) {
                db.run('ROLLBACK', () => {
                  reject(new Error('Transaction commit failed and was rolled back'));
                });
              } else {
                resolve(results);
              }
            });
          })
          .catch((error) => {
            db.run('ROLLBACK', (rollbackErr) => {
              reject(new Error(`Transaction failed: ${error.message}`));
            });
          });
      });
    });
  }

  /**
   * Execute a simple transaction with a callback
   */
  static async executeTransaction<T>(callback: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> {
    const transaction = new DatabaseTransaction();
    
    try {
      const result = await callback(transaction);
      await transaction.execute();
      return result;
    } catch (error) {
      // Transaction will be rolled back automatically if execute() was called
      throw error;
    }
  }
}

/**
 * Helper function for simple database operations with automatic transaction
 */
export async function withTransaction(operations: TransactionOperation[]): Promise<any[]> {
  const transaction = new DatabaseTransaction();
  
  operations.forEach(op => {
    transaction.add(op.query, op.params);
  });
  
  return transaction.execute();
}

/**
 * Helper for single operation with transaction (useful for critical operations)
 */
export async function executeWithTransaction(query: string, params?: any[]): Promise<any> {
  const results = await withTransaction([{ query, params }]);
  return results[0];
}