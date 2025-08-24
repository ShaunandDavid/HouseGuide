import bcrypt from 'bcrypt';
import { db } from './server/db';
import { guides } from './shared/schema';
import { eq } from 'drizzle-orm';

async function setupTestAccount() {
  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash('Test123!', 10);
    
    // Update the guide's password
    const result = await db.update(guides)
      .set({ password: hashedPassword })
      .where(eq(guides.email, 'level7mediaofficial@gmail.com'))
      .returning();
    
    if (result.length > 0) {
      console.log('✅ Password updated successfully for:', result[0].email);
      console.log('You can now login with:');
      console.log('Email: level7mediaofficial@gmail.com');
      console.log('Password: Test123!');
    } else {
      console.log('❌ No user found with that email');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating password:', error);
    process.exit(1);
  }
}

setupTestAccount();