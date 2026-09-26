import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');

if (!stripeSecret) {
  console.error('STRIPE_SECRET_KEY is not configured');
}

const stripe = stripeSecret ? new Stripe(stripeSecret, {
  appInfo: {
    name: 'PROMTP',
    version: '1.0.0',
  },
}) : null;

function corsResponse(body: string | object | null, status = 200) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  if (status === 204) {
    return new Response(null, { status, headers });
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return corsResponse({}, 204);
    }

    if (req.method !== 'POST') {
      return corsResponse({ error: 'Method not allowed' }, 405);
    }

    if (!stripe) {
      return corsResponse({ error: 'Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment variables.' }, 500);
    }

    const body = await req.json();
    const { success_url, cancel_url, return_url, ui_mode, email, metadata } = body;
    let { price_id, mode } = body;
    const embedded = ui_mode === 'embedded';

    // AI credit packs. One-time, priced inline so no Stripe product setup is
    // needed. Jose's numbers: 100 for $9, 500 for $35.
    const PACKS: Record<string, { credits: number; cents: number; name: string }> = {
      credits_100: { credits: 100, cents: 900, name: '100 AI credits' },
      credits_500: { credits: 500, cents: 3500, name: '500 AI credits' },
    };
    const pack = typeof body.pack === 'string' ? PACKS[body.pack] : undefined;
    if (body.pack && !pack) return corsResponse({ error: 'Unknown credit pack' }, 400);
    if (pack) { mode = 'payment'; price_id = price_id || 'pack'; }

    const isSignupFlow = metadata?.signup_flow === 'true';

    let user = null;
    let userEmail = email;

    if (!isSignupFlow) {
      const error = embedded
        ? validateParameters(
            { price_id, return_url, mode },
            { price_id: 'string', return_url: 'string', mode: { values: ['payment', 'subscription'] } },
          )
        : validateParameters(
            { price_id, success_url, cancel_url, mode },
            {
              cancel_url: 'string',
              price_id: 'string',
              success_url: 'string',
              mode: { values: ['payment', 'subscription'] },
            },
          );

      if (error) {
        return corsResponse({ error }, 400);
      }

      const authHeader = req.headers.get('Authorization')!;
      const token = authHeader.replace('Bearer ', '');
      const {
        data: { user: authUser },
        error: getUserError,
      } = await supabase.auth.getUser(token);

      if (getUserError) {
        return corsResponse({ error: 'Failed to authenticate user' }, 401);
      }

      if (!authUser) {
        return corsResponse({ error: 'User not found' }, 404);
      }

      user = authUser;
      userEmail = user.email;
    } else {
      if (!email) {
        return corsResponse({ error: 'Email is required for signup' }, 400);
      }
    }

    let customer = null;
    let customerId;

    if (user) {
      const { data: existingCustomer, error: getCustomerError } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .maybeSingle();

      if (getCustomerError) {
        console.error('Failed to fetch customer information from the database', getCustomerError);
        return corsResponse({ error: 'Failed to fetch customer information' }, 500);
      }

      customer = existingCustomer;
    }

    if (!customer || !customer.customer_id) {
      const customerMetadata: any = { email: userEmail };

      if (user) {
        customerMetadata.userId = user.id;
      }

      const newCustomer = await stripe.customers.create({
        email: userEmail,
        metadata: customerMetadata,
      });

      console.log(`Created new Stripe customer ${newCustomer.id} for ${userEmail}`);

      if (user) {
        const { error: createCustomerError } = await supabase.from('stripe_customers').insert({
          user_id: user.id,
          customer_id: newCustomer.id,
        });

        if (createCustomerError) {
          console.error('Failed to save customer information in the database', createCustomerError);

          try {
            await stripe.customers.del(newCustomer.id);
            await supabase.from('stripe_subscriptions').delete().eq('customer_id', newCustomer.id);
          } catch (deleteError) {
            console.error('Failed to clean up after customer mapping error:', deleteError);
          }

          return corsResponse({ error: 'Failed to create customer mapping' }, 500);
        }
      }

      if (mode === 'subscription') {
        const { error: createSubscriptionError } = await supabase.from('stripe_subscriptions').insert({
          customer_id: newCustomer.id,
          status: 'not_started',
        });

        if (createSubscriptionError) {
          console.error('Failed to save subscription in the database', createSubscriptionError);

          try {
            await stripe.customers.del(newCustomer.id);
          } catch (deleteError) {
            console.error('Failed to delete Stripe customer after subscription creation error:', deleteError);
          }

          return corsResponse({ error: 'Unable to save the subscription in the database' }, 500);
        }
      }

      customerId = newCustomer.id;

      console.log(`Successfully set up new customer ${customerId} with subscription record`);
    } else {
      customerId = customer.customer_id;

      if (mode === 'subscription') {
        const { data: subscription, error: getSubscriptionError } = await supabase
          .from('stripe_subscriptions')
          .select('status')
          .eq('customer_id', customerId)
          .maybeSingle();

        if (getSubscriptionError) {
          console.error('Failed to fetch subscription information from the database', getSubscriptionError);

          return corsResponse({ error: 'Failed to fetch subscription information' }, 500);
        }

        if (!subscription) {
          const { error: createSubscriptionError } = await supabase.from('stripe_subscriptions').insert({
            customer_id: customerId,
            status: 'not_started',
          });

          if (createSubscriptionError) {
            console.error('Failed to create subscription record for existing customer', createSubscriptionError);

            return corsResponse({ error: 'Failed to create subscription record for existing customer' }, 500);
          }
        }
      }
    }

    const sessionMetadata: Record<string, string> = { ...(metadata || {}) };
    if (user) {
      const { data: om } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle();
      if (om?.organization_id) sessionMetadata.organization_id = om.organization_id;
    }
    if (pack) {
      if (!sessionMetadata.organization_id) return corsResponse({ error: 'Sign in to buy credits.' }, 401);
      sessionMetadata.credits = String(pack.credits);
      sessionMetadata.pack = body.pack;
      delete sessionMetadata.tier;
    } else if (!sessionMetadata.tier) {
      sessionMetadata.tier = price_id === 'price_1UG3GxGeegvFIqACTTpeqq4n' ? 'pro' : 'starter';
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        pack
          ? {
              price_data: {
                currency: 'usd',
                unit_amount: pack.cents,
                product_data: { name: pack.name, description: 'PROMOTER OS AI credits. Never expire.' },
              },
              quantity: 1,
            }
          : { price: price_id, quantity: 1 },
      ],
      mode,
      ...(embedded ? { ui_mode: 'embedded', return_url } : { success_url, cancel_url }),
      metadata: sessionMetadata,
      subscription_data: mode === 'subscription'
        ? {
            trial_period_days: metadata?.trial_period_days !== undefined ? Number(metadata.trial_period_days) : 14,
            metadata: sessionMetadata
          }
        : undefined,
    });

    console.log(`Created checkout session ${session.id} for customer ${customerId}`);

    return corsResponse({ sessionId: session.id, url: session.url, clientSecret: session.client_secret });
  } catch (error: any) {
    console.error(`Checkout error: ${error.message}`);
    return corsResponse({ error: error.message }, 500);
  }
});

type ExpectedType = 'string' | { values: string[] };
type Expectations<T> = { [K in keyof T]: ExpectedType };

function validateParameters<T extends Record<string, any>>(values: T, expected: Expectations<T>): string | undefined {
  for (const parameter in values) {
    const expectation = expected[parameter];
    const value = values[parameter];

    if (expectation === 'string') {
      if (value == null) {
        return `Missing required parameter ${parameter}`;
      }
      if (typeof value !== 'string') {
        return `Expected parameter ${parameter} to be a string got ${JSON.stringify(value)}`;
      }
    } else {
      if (!expectation.values.includes(value)) {
        return `Expected parameter ${parameter} to be one of ${expectation.values.join(', ')}`;
      }
    }
  }

  return undefined;
}