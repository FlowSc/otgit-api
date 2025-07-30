import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  console.log('Checking if users table exists...');
  
  try {
    // Try to query the users table
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('Users table does not exist:', error.message);
      console.log('\nPlease create the table using the SQL in src/database/schema.sql');
      console.log('You can run it in the Supabase Dashboard SQL Editor.');
    } else {
      console.log('Users table exists!');
      
      // Check table structure
      const { data: columns, error: columnsError } = await supabase
        .rpc('get_table_columns', { table_name: 'users' })
        .limit(20);
      
      if (!columnsError && columns) {
        console.log('\nTable columns:', columns);
      }
    }
  } catch (err) {
    console.error('Error checking tables:', err);
  }
}

checkTables();