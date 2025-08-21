import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          auth_user_id: string | null
          invited: boolean
          full_name: string | null
          first_name: string | null
          last_name: string | null
        }
        Insert: {
          email: string
          auth_user_id?: string | null
          invited?: boolean
          full_name?: string | null
          first_name?: string | null
          last_name?: string | null
        }
        Update: {
          auth_user_id?: string | null
          invited?: boolean
          full_name?: string | null
          first_name?: string | null
          last_name?: string | null
        }
      }
      security_events: {
        Row: {
          id: string
          event_type: string
          user_email: string | null
          metadata: any
          severity: 'low' | 'medium' | 'high' | 'critical'
          created_at: string
        }
        Insert: {
          event_type: string
          user_email?: string | null
          metadata?: any
          severity?: 'low' | 'medium' | 'high' | 'critical'
        }
      }
    }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get users that need auth accounts created
    const { data: usersNeedingAuth, error: fetchError } = await supabase
      .from('users')
      .select('id, email, full_name, first_name, last_name')
      .is('auth_user_id', null)
      .eq('invited', true)

    if (fetchError) {
      console.error('Error fetching users:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users needing auth accounts' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!usersNeedingAuth || usersNeedingAuth.length === 0) {
      console.log('No users need auth account creation')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No users need auth account creation',
          created: 0,
          failed: 0
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Found ${usersNeedingAuth.length} users needing auth accounts`)

    let successCount = 0
    let failureCount = 0
    const failures: { email: string, error: string }[] = []

    // Process users in small batches with throttling
    const batchSize = 3
    const batches = []
    for (let i = 0; i < usersNeedingAuth.length; i += batchSize) {
      batches.push(usersNeedingAuth.slice(i, i + batchSize))
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} users`)

      // Process each user in the batch
      for (const user of batch) {
        try {
          // Generate a secure random password
          const tempPassword = crypto.randomUUID() + crypto.randomUUID()

          // Create auth user
          const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: user.email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              full_name: user.full_name,
              first_name: user.first_name,
              last_name: user.last_name
            }
          })

          if (authError) {
            console.error(`Failed to create auth user for ${user.email}:`, authError)
            failureCount++
            failures.push({ email: user.email, error: authError.message })
            continue
          }

          if (!authUser.user) {
            console.error(`No auth user returned for ${user.email}`)
            failureCount++
            failures.push({ email: user.email, error: 'No auth user returned' })
            continue
          }

          // Update the user record with the auth_user_id
          const { error: updateError } = await supabase
            .from('users')
            .update({ auth_user_id: authUser.user.id })
            .eq('id', user.id)

          if (updateError) {
            console.error(`Failed to update user ${user.email} with auth_user_id:`, updateError)
            // Try to clean up the auth user
            await supabase.auth.admin.deleteUser(authUser.user.id)
            failureCount++
            failures.push({ email: user.email, error: updateError.message })
            continue
          }

          console.log(`Successfully created auth account for ${user.email}`)
          successCount++

          // Log security event
          await supabase.from('security_events').insert({
            event_type: 'auth_user_created_bulk',
            user_email: user.email,
            metadata: {
              auth_user_id: authUser.user.id,
              user_id: user.id,
              batch_index: batchIndex + 1
            },
            severity: 'low'
          })

        } catch (error) {
          console.error(`Exception creating auth for ${user.email}:`, error)
          failureCount++
          failures.push({ 
            email: user.email, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          })
        }

        // Small delay between individual users
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      // Progressive delay between batches
      if (batchIndex < batches.length - 1) {
        const delay = 5000 + (batchIndex * 1000) // 5s + 1s per batch
        console.log(`Waiting ${delay}ms before next batch...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // Log summary security event
    await supabase.from('security_events').insert({
      event_type: 'bulk_auth_creation_completed',
      metadata: {
        total_processed: usersNeedingAuth.length,
        successful: successCount,
        failed: failureCount,
        failures: failures.slice(0, 10) // Log first 10 failures
      },
      severity: failureCount > 0 ? 'medium' : 'low'
    })

    console.log(`Auth creation completed: ${successCount} successful, ${failureCount} failed`)

    return new Response(
      JSON.stringify({
        success: true,
        created: successCount,
        failed: failureCount,
        failures: failures,
        message: `Created ${successCount} auth accounts, ${failureCount} failures`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})