#!/usr/bin/env node

/**
 * Complete Authentication Fix Script
 * 
 * This script performs a comprehensive fix of the authentication system:
 * 1. Links all existing auth users to database records
 * 2. Creates missing auth users for invited database users
 * 3. Provides detailed verification and status reporting
 * 
 * Run: node run-complete-auth-fix.js
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://emnemfewmpjczkgwzrjv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtbmVtZmV3bXBqY3prZ3d6cmp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNTMwOTIsImV4cCI6MjA3MDYyOTA5Mn0.n5x7VHDee9vCJuQnrPfpdRl7iE0y0lfe1pRO3BxHwkA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runCompleteAuthFix() {
  console.log('\n🔧 STARTING COMPLETE AUTHENTICATION FIX');
  console.log('='.repeat(50));
  
  try {
    // Step 1: Check current state
    console.log('\n📊 Step 1: Analyzing Current State...');
    
    const { data: allUsers, error: usersError } = await supabase
      .from('users')
      .select('id, email, auth_user_id, invited, order_submitted')
      .eq('invited', true);
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }
    
    const { data: allAdmins, error: adminsError } = await supabase
      .from('admin_users')
      .select('id, email, auth_user_id, active')
      .eq('active', true);
    
    if (adminsError) {
      console.error('❌ Error fetching admins:', adminsError);
      return;
    }
    
    const usersNeedingAuth = allUsers.filter(user => !user.auth_user_id);
    const adminsNeedingAuth = allAdmins.filter(admin => !admin.auth_user_id);
    
    console.log(`📈 Current Status:`);
    console.log(`   - Total invited users: ${allUsers.length}`);
    console.log(`   - Users needing auth: ${usersNeedingAuth.length}`);
    console.log(`   - Active admins: ${allAdmins.length}`);
    console.log(`   - Admins needing auth: ${adminsNeedingAuth.length}`);
    
    if (usersNeedingAuth.length === 0 && adminsNeedingAuth.length === 0) {
      console.log('\n✅ All users and admins already have auth accounts linked!');
      return;
    }
    
    // Step 2: Run the comprehensive auth linking
    console.log('\n🔗 Step 2: Running Comprehensive Auth Linking...');
    
    const { data: linkResult, error: linkError } = await supabase.functions.invoke('link-existing-auth-users', {
      body: {
        testMode: false, // Run for real
        targetEmails: null // Process all eligible users
      }
    });
    
    if (linkError) {
      console.error('❌ Auth linking failed:', linkError);
      return;
    }
    
    console.log('\n📋 Auth Linking Results:');
    console.log(`   - Processed: ${linkResult.processed || 0}`);
    console.log(`   - Successful: ${linkResult.successful || 0}`);
    console.log(`   - Errors: ${linkResult.errors || 0}`);
    
    if (linkResult.results && Array.isArray(linkResult.results)) {
      console.log('\n📄 Individual Results:');
      linkResult.results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        console.log(`   ${status} ${result.email}: ${result.action || result.error || 'unknown'}`);
      });
    }
    
    // Step 3: Verification
    console.log('\n🔍 Step 3: Post-Fix Verification...');
    
    // Re-fetch to see current state
    const { data: updatedUsers, error: updatedUsersError } = await supabase
      .from('users')
      .select('id, email, auth_user_id, invited, order_submitted')
      .eq('invited', true);
    
    const { data: updatedAdmins, error: updatedAdminsError } = await supabase
      .from('admin_users')
      .select('id, email, auth_user_id, active')
      .eq('active', true);
    
    if (updatedUsersError || updatedAdminsError) {
      console.error('❌ Error during verification');
      return;
    }
    
    const stillNeedingAuth = updatedUsers.filter(user => !user.auth_user_id);
    const adminsStillNeedingAuth = updatedAdmins.filter(admin => !admin.auth_user_id);
    
    console.log('\n📊 Final Status:');
    console.log(`   - Users with auth linked: ${updatedUsers.length - stillNeedingAuth.length}/${updatedUsers.length}`);
    console.log(`   - Admins with auth linked: ${updatedAdmins.length - adminsStillNeedingAuth.length}/${updatedAdmins.length}`);
    
    if (stillNeedingAuth.length > 0) {
      console.log('\n⚠️  Users still needing auth:');
      stillNeedingAuth.forEach(user => {
        console.log(`   - ${user.email}`);
      });
    }
    
    if (adminsStillNeedingAuth.length > 0) {
      console.log('\n⚠️  Admins still needing auth:');
      adminsStillNeedingAuth.forEach(admin => {
        console.log(`   - ${admin.email}`);
      });
    }
    
    // Step 4: Test recommendations
    console.log('\n🧪 Step 4: Testing Recommendations');
    console.log('='.repeat(30));
    
    if (stillNeedingAuth.length === 0 && adminsStillNeedingAuth.length === 0) {
      console.log('✅ All accounts are now linked! Test login flow:');
      console.log('   1. Go to /auth');
      console.log('   2. Try logging in with your email (tod.ellington@whitestonebranding.com)');
      console.log('   3. Check magic link in email');
      console.log('   4. Verify you can access the app');
    } else {
      console.log('⚠️  Some accounts still need manual intervention');
      console.log('   Consider running this script again or investigating specific cases');
    }
    
    console.log('\n🏁 AUTHENTICATION FIX COMPLETE');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('\n❌ Unexpected error during auth fix:', error);
    console.log('\n🔍 Debugging steps:');
    console.log('   1. Check if Supabase is accessible');
    console.log('   2. Verify edge function is deployed');
    console.log('   3. Check console for detailed error messages');
  }
}

// Run the complete auth fix
runCompleteAuthFix();