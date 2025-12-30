import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { Storage } from '@google-cloud/storage';

const execAsync = promisify(exec);

export class DatabaseBackup {
  private storage?: Storage;
  private backupDir = path.join(process.cwd(), 'backups');

  constructor() {
    // Initialize Google Cloud Storage if credentials are available
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      this.storage = new Storage();
    }
  }

  // Create local backup
  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.sql`;
    const filepath = path.join(this.backupDir, filename);

    // Ensure backup directory exists
    await fs.mkdir(this.backupDir, { recursive: true });

    // Get database URL and parse it
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    // Create backup using pg_dump
    const backupCommand = `pg_dump "${dbUrl}" > "${filepath}"`;
    
    try {
      await execAsync(backupCommand);
      console.log(`Backup created: ${filepath}`);
      
      // Compress the backup
      const compressedPath = `${filepath}.gz`;
      await execAsync(`gzip -9 "${filepath}"`);
      
      return compressedPath;
    } catch (error) {
      console.error('Backup failed:', error);
      throw error;
    }
  }

  // Upload backup to cloud storage
  async uploadToCloud(filepath: string): Promise<void> {
    if (!this.storage) {
      console.warn('Cloud storage not configured, skipping upload');
      return;
    }

    const bucket = this.storage.bucket(process.env.BACKUP_BUCKET || 'houseguide-backups');
    const filename = path.basename(filepath);
    const destination = `database/${new Date().getFullYear()}/${filename}`;

    try {
      await bucket.upload(filepath, {
        destination,
        metadata: {
          contentType: 'application/gzip',
          metadata: {
            created: new Date().toISOString(),
            type: 'database-backup'
          }
        }
      });
      
      console.log(`Backup uploaded to cloud: ${destination}`);
    } catch (error) {
      console.error('Cloud upload failed:', error);
      throw error;
    }
  }

  // Restore from backup
  async restoreBackup(filepath: string): Promise<void> {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    // Decompress if needed
    let sqlFile = filepath;
    if (filepath.endsWith('.gz')) {
      await execAsync(`gunzip -c "${filepath}" > "${filepath.replace('.gz', '')}"`);
      sqlFile = filepath.replace('.gz', '');
    }

    // Restore database
    const restoreCommand = `psql "${dbUrl}" < "${sqlFile}"`;
    
    try {
      await execAsync(restoreCommand);
      console.log('Database restored successfully');
    } catch (error) {
      console.error('Restore failed:', error);
      throw error;
    }
  }

  // Clean up old backups
  async cleanupOldBackups(retentionDays: number = 7): Promise<void> {
    const files = await fs.readdir(this.backupDir);
    const now = Date.now();
    const maxAge = retentionDays * 24 * 60 * 60 * 1000;

    for (const file of files) {
      const filepath = path.join(this.backupDir, file);
      const stats = await fs.stat(filepath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        await fs.unlink(filepath);
        console.log(`Deleted old backup: ${file}`);
      }
    }
  }

  // Automated backup job
  async runScheduledBackup(): Promise<void> {
    console.log('Starting scheduled backup...');
    
    try {
      // Create backup
      const backupPath = await this.createBackup();
      
      // Upload to cloud
      await this.uploadToCloud(backupPath);
      
      // Clean up old local backups
      await this.cleanupOldBackups();
      
      // Log success
      console.log('Scheduled backup completed successfully');
      
      // Send notification (if configured)
      await this.sendBackupNotification('success', backupPath);
    } catch (error) {
      console.error('Scheduled backup failed:', error);
      await this.sendBackupNotification('failure', '', error);
      throw error;
    }
  }

  // Send backup notification
  private async sendBackupNotification(status: 'success' | 'failure', filepath: string, error?: any): Promise<void> {
    // Import email service
    const { sendEmail } = await import('./email');
    
    if (!process.env.BACKUP_NOTIFICATION_EMAIL) {
      return;
    }

    const subject = status === 'success' 
      ? '✅ Database Backup Successful'
      : '❌ Database Backup Failed';
      
    const html = status === 'success'
      ? `
        <h2>Database Backup Completed</h2>
        <p>The database backup was completed successfully.</p>
        <p><strong>Backup File:</strong> ${path.basename(filepath)}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      `
      : `
        <h2>Database Backup Failed</h2>
        <p>The database backup failed with the following error:</p>
        <pre>${error?.message || 'Unknown error'}</pre>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      `;

    await sendEmail({
      from: process.env.SENDGRID_FROM_EMAIL || "noreply@houseguide.app",
      to: process.env.BACKUP_NOTIFICATION_EMAIL,
      subject,
      html
    });
  }

  // Verify backup integrity
  async verifyBackup(filepath: string): Promise<boolean> {
    try {
      // Check if file exists
      await fs.access(filepath);
      
      // Check file size
      const stats = await fs.stat(filepath);
      if (stats.size === 0) {
        throw new Error('Backup file is empty');
      }
      
      // If it's a SQL file, do basic validation
      if (filepath.endsWith('.sql')) {
        const content = await fs.readFile(filepath, 'utf-8');
        if (!content.includes('CREATE TABLE') && !content.includes('INSERT INTO')) {
          throw new Error('Backup file does not contain valid SQL');
        }
      }
      
      return true;
    } catch (error) {
      console.error('Backup verification failed:', error);
      return false;
    }
  }
}

// Backup scheduler
export class BackupScheduler {
  private backup: DatabaseBackup;
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.backup = new DatabaseBackup();
  }

  // Start scheduled backups
  start(cronSchedule: string = '0 2 * * *'): void {
    // For simplicity, using setInterval instead of cron
    // In production, use node-cron or similar
    const interval = this.parseScheduleToMs(cronSchedule);
    
    this.intervalId = setInterval(async () => {
      try {
        await this.backup.runScheduledBackup();
      } catch (error) {
        console.error('Scheduled backup error:', error);
      }
    }, interval);
    
    console.log(`Backup scheduler started: ${cronSchedule}`);
  }

  // Stop scheduled backups
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      console.log('Backup scheduler stopped');
    }
  }

  // Parse cron-like schedule to milliseconds
  private parseScheduleToMs(schedule: string): number {
    // Simple parser for daily backups
    if (schedule === '0 2 * * *') {
      return 24 * 60 * 60 * 1000; // Daily
    }
    // Default to daily
    return 24 * 60 * 60 * 1000;
  }
}

// Initialize backup scheduler in production
if (process.env.NODE_ENV === 'production' && process.env.ENABLE_BACKUPS === 'true') {
  const scheduler = new BackupScheduler();
  scheduler.start(process.env.BACKUP_SCHEDULE || '0 2 * * *');
}
